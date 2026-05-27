import type { PlanRealtimeEvent, PlanningEventPublisher } from "./planningEventBus";
import { setPlanningRealtimeStatusProvider, type PlanningRealtimeStatus } from "./planningRealtimeHealth";
import { requireSecureRedisUrl } from "./redisSecurity";

const CHANNEL_PREFIX = "kiss-pm:planning:";
const RETRY_DELAYS_MS = [200, 500, 1000] as const;

let lastStatus: PlanningRealtimeStatus = {
  backend: "memory",
  connected: false,
  redisConfigured: Boolean(process.env.REDIS_URL ?? process.env.PLANNING_EVENTS_REDIS_URL)
};

export function getPlanningRedisEventBusStatus(): PlanningRealtimeStatus {
  return lastStatus;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(
  connect: () => Promise<void>,
  label: string
): Promise<boolean> {
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
      `[planning-events] Redis unavailable for ${label}, falling back to in-memory`,
      lastError
    );
  }
  return false;
}

export async function createRedisPlanningEventPublisher(
  local: PlanningEventPublisher
): Promise<PlanningEventPublisher | null> {
  const rawRedisUrl = process.env.REDIS_URL ?? process.env.PLANNING_EVENTS_REDIS_URL;
  const redisUrl = rawRedisUrl
    ? requireSecureRedisUrl({
        allowInsecure: process.env.PLANNING_EVENTS_REDIS_ALLOW_INSECURE === "true",
        production: process.env.NODE_ENV === "production",
        url: rawRedisUrl
      })
    : undefined;
  if (!redisUrl) {
    lastStatus = {
      backend: "memory",
      connected: true,
      redisConfigured: false
    };
    setPlanningRealtimeStatusProvider(() => lastStatus);
    return null;
  }

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
    if (!publisherConnected || !subscriberConnected) {
      lastStatus = {
        backend: "memory",
        connected: false,
        redisConfigured: true
      };
      setPlanningRealtimeStatusProvider(() => lastStatus);
      return null;
    }

    lastStatus = {
      backend: "redis",
      connected: true,
      redisConfigured: true
    };
    setPlanningRealtimeStatusProvider(() => lastStatus);

    const channelFor = (projectId: string) => `${CHANNEL_PREFIX}${projectId}`;
    const markDisconnected = () => {
      lastStatus = {
        backend: "redis",
        connected: false,
        redisConfigured: true
      };
    };
    publisher.on("error", markDisconnected);
    subscriber.on("error", markDisconnected);

    return {
      publish(event: PlanRealtimeEvent) {
        local.publish(event);
        void publisher
          .publish(channelFor(event.projectId), JSON.stringify(event))
          .catch(markDisconnected);
      },
      subscribe(projectId: string, listener: (event: PlanRealtimeEvent) => void) {
        const localUnsub = local.subscribe(projectId, listener);
        const channel = channelFor(projectId);
        const handler = (message: string) => {
          try {
            const parsed = JSON.parse(message) as PlanRealtimeEvent;
            if (parsed.projectId === projectId) listener(parsed);
          } catch {
            // ignore malformed payloads
          }
        };
        void subscriber.subscribe(channel, handler).catch(markDisconnected);
        return () => {
          localUnsub();
          void subscriber.unsubscribe(channel).catch(markDisconnected);
        };
      },
      async close() {
        const results = await Promise.allSettled([subscriber.quit(), publisher.quit()]);
        if (results.some((result) => result.status === "rejected")) {
          markDisconnected();
        } else {
          lastStatus = {
            backend: "redis",
            connected: false,
            redisConfigured: true
          };
        }
      }
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[planning-events] Redis unavailable, falling back to in-memory", error);
    }
    lastStatus = {
      backend: "memory",
      connected: false,
      redisConfigured: true
    };
    setPlanningRealtimeStatusProvider(() => lastStatus);
    return null;
  }
}
