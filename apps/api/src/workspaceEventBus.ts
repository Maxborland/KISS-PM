/**
 * Workspace realtime event bus (P4.1 SSE) — зеркало planningEventBus, но с
 * обобщённым строковым каналом вместо projectId. Каналы:
 *   user:{userId}          — уведомления текущего пользователя (notification.created)
 *   conversation:{convId}  — сообщения беседы (message.created)
 *
 * Бекенды: in-memory publisher (один процесс, дефолт) либо Redis pub/sub
 * (workspaceRedisEventBus) для >1 реплики — выбирается на буте сервера через
 * bootstrapWorkspaceEventPublisher (WORKSPACE_EVENTS_BACKEND, по умолчанию
 * наследует PLANNING_EVENTS_BACKEND).
 */
import { parseWorkspaceEventsBackend } from "./serverConfig";
import type { PresenceStatus } from "./presenceStore";

export type WorkspaceRealtimeEvent =
  | { type: "message.created"; conversationId: string; message: unknown }
  | { type: "notification.created"; userId: string; notificationType: string }
  | { type: "presence.changed"; userId: string; status: PresenceStatus };

export type WorkspaceEventListener = (event: WorkspaceRealtimeEvent) => void;

export interface WorkspaceEventPublisher {
  publish(channel: string, event: WorkspaceRealtimeEvent): void;
  subscribe(channel: string, listener: WorkspaceEventListener): () => void;
  close?(): Promise<void>;
}

export class InMemoryWorkspaceEventPublisher implements WorkspaceEventPublisher {
  private readonly listenersByChannel = new Map<string, Set<WorkspaceEventListener>>();

  subscribe(channel: string, listener: WorkspaceEventListener): () => void {
    const bucket = this.listenersByChannel.get(channel) ?? new Set<WorkspaceEventListener>();
    bucket.add(listener);
    this.listenersByChannel.set(channel, bucket);
    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) this.listenersByChannel.delete(channel);
    };
  }

  publish(channel: string, event: WorkspaceRealtimeEvent): void {
    const bucket = this.listenersByChannel.get(channel);
    if (!bucket) return;
    for (const listener of bucket) listener(event);
  }
}

let publisher: WorkspaceEventPublisher | null = null;

function getWorkspaceEventPublisher(): WorkspaceEventPublisher {
  if (!publisher) publisher = new InMemoryWorkspaceEventPublisher();
  return publisher;
}

export function setWorkspaceEventPublisher(next: WorkspaceEventPublisher): void {
  publisher = next;
}

/**
 * Async-фабрика для бута сервера (зеркало bootstrapPlanningEventPublisher):
 * при redis-бекенде и доступном Redis возвращает Redis-publisher, иначе in-memory.
 * В production недоступный Redis — fail-fast: молчаливый даунгрейд до in-memory
 * ломал бы чат/бейджи между репликами незаметно.
 */
export async function bootstrapWorkspaceEventPublisher(): Promise<WorkspaceEventPublisher> {
  const backend = parseWorkspaceEventsBackend(
    process.env.WORKSPACE_EVENTS_BACKEND,
    process.env.PLANNING_EVENTS_BACKEND
  );
  const memory = new InMemoryWorkspaceEventPublisher();
  if (backend === "redis") {
    const { createRedisWorkspaceEventPublisher } = await import("./workspaceRedisEventBus.js");
    const redis = await createRedisWorkspaceEventPublisher(memory);
    if (redis) return redis;
    if (process.env.NODE_ENV === "production") {
      throw new Error("workspace_events_redis_unavailable");
    }
    console.warn("[workspace-events] Redis unavailable, falling back to in-memory publisher");
  }
  return memory;
}

export const userChannel = (userId: string): string => `user:${userId}`;
export const conversationChannel = (conversationId: string): string => `conversation:${conversationId}`;
// Канал тенанта: presence-события рассылаются всем подписчикам рабочей области.
export const tenantChannel = (tenantId: string): string => `tenant:${tenantId}`;

export function subscribeWorkspaceEvents(
  channel: string,
  listener: WorkspaceEventListener
): () => void {
  return getWorkspaceEventPublisher().subscribe(channel, listener);
}

export function emitWorkspaceEvent(channel: string, event: WorkspaceRealtimeEvent): void {
  getWorkspaceEventPublisher().publish(channel, event);
}

export function emitMessageCreated(conversationId: string, message: unknown): void {
  emitWorkspaceEvent(conversationChannel(conversationId), { type: "message.created", conversationId, message });
}

export function emitNotificationCreated(userId: string, notificationType: string): void {
  emitWorkspaceEvent(userChannel(userId), { type: "notification.created", userId, notificationType });
}

export function emitPresenceChanged(tenantId: string, userId: string, status: PresenceStatus): void {
  emitWorkspaceEvent(tenantChannel(tenantId), { type: "presence.changed", userId, status });
}
