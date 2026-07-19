/**
 * Redis-бекенд workspace-шины (Д5) — зеркало planningRedisEventBus, но поверх
 * обобщённых строковых каналов (user:/conversation:/tenant:).
 *
 * Доставка без дублей: publish() кладёт событие локальным подписчикам напрямую
 * (local.publish) и параллельно шлёт его в Redis в конверте с origin-меткой
 * инстанса; Redis-handler отбрасывает конверты со своим origin, поэтому свои же
 * публикации не приходят второй раз. Planning-вариант обходится без метки —
 * его planVersion-события идемпотентны, а message.created дублировать нельзя
 * (в чате появлялось бы два одинаковых сообщения).
 */
import { randomUUID } from "node:crypto";

import { requireSecureRedisUrl } from "./redisSecurity";
import type {
  WorkspaceEventListener,
  WorkspaceEventPublisher,
  WorkspaceRealtimeEvent
} from "./workspaceEventBus";

export const WORKSPACE_CHANNEL_PREFIX = "kiss-pm:workspace:";
const RETRY_DELAYS_MS = [200, 500, 1000] as const;

export function workspaceRedisChannel(channel: string): string {
  return `${WORKSPACE_CHANNEL_PREFIX}${channel}`;
}

export type WorkspaceEventEnvelope = {
  /** Уникальная метка publisher-инстанса — по ней отбрасываем эхо своих публикаций. */
  origin: string;
  event: WorkspaceRealtimeEvent;
};

export function encodeWorkspaceEventEnvelope(origin: string, event: WorkspaceRealtimeEvent): string {
  return JSON.stringify({ origin, event } satisfies WorkspaceEventEnvelope);
}

export function decodeWorkspaceEventEnvelope(message: string): WorkspaceEventEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(message);
    if (!parsed || typeof parsed !== "object") return null;
    const { origin, event } = parsed as { origin?: unknown; event?: unknown };
    if (typeof origin !== "string" || origin.length === 0) return null;
    if (!event || typeof event !== "object" || typeof (event as { type?: unknown }).type !== "string") {
      return null;
    }
    return { origin, event: event as WorkspaceRealtimeEvent };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(connect: () => Promise<void>, label: string): Promise<boolean> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await connect();
      return true;
    } catch (error) {
      lastError = error;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      await sleep(delay);
    }
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[workspace-events] Redis unavailable for ${label}, falling back to in-memory`,
      lastError
    );
  }
  return false;
}

export async function createRedisWorkspaceEventPublisher(
  local: WorkspaceEventPublisher
): Promise<WorkspaceEventPublisher | null> {
  const rawRedisUrl = process.env.REDIS_URL ?? process.env.PLANNING_EVENTS_REDIS_URL;
  const redisUrl = rawRedisUrl
    ? requireSecureRedisUrl({
        allowInsecure:
          process.env.WORKSPACE_EVENTS_REDIS_ALLOW_INSECURE === "true" ||
          process.env.PLANNING_EVENTS_REDIS_ALLOW_INSECURE === "true",
        production: process.env.NODE_ENV === "production",
        url: rawRedisUrl
      })
    : undefined;
  if (!redisUrl) return null;

  try {
    const { createClient } = await import("redis");
    const publisher = createClient({ url: redisUrl });
    const subscriber = createClient({ url: redisUrl });

    const publisherConnected = await connectWithRetry(async () => {
      await publisher.connect();
    }, "publisher");
    const subscriberConnected = await connectWithRetry(async () => {
      await subscriber.connect();
    }, "subscriber");
    if (!publisherConnected || !subscriberConnected) return null;

    const origin = randomUUID();
    let deliveryErrorLogged = false;
    const onDeliveryError = (error: unknown) => {
      if (deliveryErrorLogged) return;
      deliveryErrorLogged = true;
      console.error("[workspace-events] Redis delivery failed", error);
    };
    publisher.on("error", onDeliveryError);
    subscriber.on("error", onDeliveryError);

    return {
      publish(channel: string, event: WorkspaceRealtimeEvent) {
        // Своим подписчикам — напрямую; Redis-эхо этого же конверта отфильтрует origin.
        local.publish(channel, event);
        void publisher
          .publish(workspaceRedisChannel(channel), encodeWorkspaceEventEnvelope(origin, event))
          .catch(onDeliveryError);
      },
      subscribe(channel: string, listener: WorkspaceEventListener) {
        const localUnsub = local.subscribe(channel, listener);
        const redisChannel = workspaceRedisChannel(channel);
        const handler = (message: string) => {
          const envelope = decodeWorkspaceEventEnvelope(message);
          if (!envelope || envelope.origin === origin) return;
          listener(envelope.event);
        };
        void subscriber.subscribe(redisChannel, handler).catch(onDeliveryError);
        return () => {
          localUnsub();
          // Снимаем ТОЛЬКО свой handler (не весь канал): несколько подписчиков одного канала
          // мультиплексируются на один Redis-канал; unsubscribe(channel) без handler оборвал бы всех.
          void subscriber.unsubscribe(redisChannel, handler).catch(onDeliveryError);
        };
      },
      async close() {
        await Promise.allSettled([subscriber.quit(), publisher.quit()]);
      }
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[workspace-events] Redis unavailable, falling back to in-memory", error);
    }
    return null;
  }
}
