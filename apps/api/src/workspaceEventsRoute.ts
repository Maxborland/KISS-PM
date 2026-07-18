import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { resolveCollaborationEntityAccess, type CollaborationEntityAccessDataSource } from "./collaboration/entityAccess";
import type { ApiTenantDataSource } from "./apiTypes";
import {
  conversationChannel,
  emitPresenceChanged,
  subscribeWorkspaceEvents,
  tenantChannel,
  userChannel,
  type WorkspaceRealtimeEvent
} from "./workspaceEventBus";
import {
  presenceConnect,
  presenceDisconnect,
  presenceFor,
  presenceHeartbeat
} from "./presenceStore";

type WorkspaceEventsRouteDeps = {
  dataSource: Pick<ApiTenantDataSource, "findConversation" | "isConversationMember" | "listUsersByTenantId"> & CollaborationEntityAccessDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
};

/**
 * P4.1 — единый SSE-поток рабочей области (зеркало planningEventsRoute).
 * Подписывает текущего пользователя на канал user:{id} (его уведомления) и,
 * при ?conversationId=… с правом чтения, на canал conversation:{id} (сообщения
 * активной беседы). Без поллинга: chat/notifications живут на push.
 */
export function registerWorkspaceEventsRoute(app: Hono, deps: WorkspaceEventsRouteDeps) {
  app.get("/api/workspace/realtime/events", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    // user:{id} — уведомления; tenant:{id} — presence-события рабочей области.
    const channels = [userChannel(actor.id), tenantChannel(actor.tenantId)];

    const conversationIdRaw = context.req.query("conversationId");
    if (conversationIdRaw) {
      if (!deps.dataSource.findConversation) {
        return context.json({ error: "collaboration_not_configured" }, 501);
      }
      const conversation = await deps.dataSource.findConversation(actor.tenantId, conversationIdRaw);
      if (!conversation) return context.json({ error: "conversation_not_found" }, 404);
      if (conversation.conversationType === "direct" || conversation.conversationType === "agent") {
        // DM и тред агента: доступ по членству (а не по правам на сущность) —
        // generic entity-резолвер для 'agent' fail-closed и отдал бы 404.
        const member = deps.dataSource.isConversationMember
          ? await deps.dataSource.isConversationMember(actor.tenantId, conversation.id, actor.id)
          : false;
        if (!member) return context.json({ error: "conversation_forbidden" }, 403);
      } else {
        const profile = await deps.getActorProfile(actor);
        const access = await resolveCollaborationEntityAccess({
          actor,
          dataSource: deps.dataSource,
          entityId: conversation.entityId,
          entityType: conversation.entityType,
          profile
        });
        if (!access.ok) return context.json({ error: access.error }, access.status);
        if (!access.value.readDecision.allowed) {
          return context.json({ error: access.value.readDecision.reason }, 403);
        }
      }
      channels.push(conversationChannel(conversationIdRaw));
    }

    return streamSSE(context, async (stream) => {
      const send = async (event: WorkspaceRealtimeEvent) => {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      };
      const unsubscribers = channels.map((channel) =>
        subscribeWorkspaceEvents(channel, (event) => {
          void send(event);
        })
      );

      // Presence: соединение открыто → online (рассылаем переход всем в тенанте).
      if (presenceConnect(actor.tenantId, actor.id)) {
        emitPresenceChanged(actor.tenantId, actor.id, "online");
      }

      const heartbeat = setInterval(() => {
        presenceHeartbeat(actor.tenantId, actor.id);
        void stream.writeSSE({ event: "heartbeat", data: "{}" });
      }, 15_000);

      // Очистка ровно один раз — по abort (обрыв клиента) ИЛИ по выходу из sleep.
      // ВАЖНО: stream.sleep не прерывается обрывом клиента, поэтому disconnect ловим через onAbort.
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(heartbeat);
        for (const unsubscribe of unsubscribers) unsubscribe();
        // Последнее соединение закрылось → away (offline наступит по TTL, виден через GET).
        if (presenceDisconnect(actor.tenantId, actor.id)) {
          emitPresenceChanged(actor.tenantId, actor.id, "away");
        }
      };
      stream.onAbort(cleanup);

      try {
        await stream.sleep(60 * 60 * 1000);
      } finally {
        cleanup();
      }
    });
  });

  // P4.3 — снимок присутствия пользователей тенанта (начальное состояние для индикаторов).
  app.get("/api/workspace/presence", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listUsersByTenantId) {
      return context.json({ error: "collaboration_not_configured" }, 501);
    }
    const users = await deps.dataSource.listUsersByTenantId(actor.tenantId);
    return context.json({ presence: presenceFor(actor.tenantId, users.map((user) => user.id)) });
  });
}
