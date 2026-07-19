import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryWorkspaceEventPublisher, type WorkspaceRealtimeEvent } from "./workspaceEventBus";
import {
  createRedisWorkspaceEventPublisher,
  decodeWorkspaceEventEnvelope,
  encodeWorkspaceEventEnvelope,
  WORKSPACE_CHANNEL_PREFIX,
  workspaceRedisChannel
} from "./workspaceRedisEventBus";

// In-process эмуляция Redis pub/sub: как и настоящий Redis, доставляет публикацию
// ВСЕМ подписчикам канала, включая подписчика инстанса-отправителя, — ровно тот
// случай, где без origin-фильтра было бы эхо самому себе.
vi.mock("redis", () => {
  type Handler = (message: string) => void;
  const broker = new Map<string, Set<Handler>>();
  const createClient = () => ({
    connect: async () => {},
    on: () => {},
    publish: async (channel: string, message: string) => {
      for (const handler of broker.get(channel) ?? []) handler(message);
    },
    subscribe: async (channel: string, handler: Handler) => {
      const bucket = broker.get(channel) ?? new Set<Handler>();
      bucket.add(handler);
      broker.set(channel, bucket);
    },
    unsubscribe: async (channel: string, handler: Handler) => {
      broker.get(channel)?.delete(handler);
    },
    quit: async () => {}
  });
  return { createClient };
});

describe("workspaceRedisChannel", () => {
  it("prefixes bus channels with the workspace Redis namespace", () => {
    expect(WORKSPACE_CHANNEL_PREFIX).toBe("kiss-pm:workspace:");
    expect(workspaceRedisChannel("user:u-1")).toBe("kiss-pm:workspace:user:u-1");
    expect(workspaceRedisChannel("conversation:c-1")).toBe("kiss-pm:workspace:conversation:c-1");
    expect(workspaceRedisChannel("tenant:t-1")).toBe("kiss-pm:workspace:tenant:t-1");
  });
});

describe("workspace event envelope codec", () => {
  const event: WorkspaceRealtimeEvent = {
    type: "message.created",
    conversationId: "c-1",
    message: { id: "m-1", body: "привет" }
  };

  it("round-trips origin and event through JSON", () => {
    const decoded = decodeWorkspaceEventEnvelope(encodeWorkspaceEventEnvelope("origin-a", event));
    expect(decoded).toEqual({ origin: "origin-a", event });
  });

  it("rejects malformed payloads instead of throwing", () => {
    expect(decodeWorkspaceEventEnvelope("not-json")).toBeNull();
    expect(decodeWorkspaceEventEnvelope("42")).toBeNull();
    expect(decodeWorkspaceEventEnvelope(JSON.stringify({ event }))).toBeNull();
    expect(decodeWorkspaceEventEnvelope(JSON.stringify({ origin: "", event }))).toBeNull();
    expect(decodeWorkspaceEventEnvelope(JSON.stringify({ origin: "a" }))).toBeNull();
    expect(decodeWorkspaceEventEnvelope(JSON.stringify({ origin: "a", event: { body: 1 } }))).toBeNull();
  });
});

describe("Redis workspace publisher over mocked pub/sub", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("delivers cross-instance and never echoes a publisher's own event back to it", async () => {
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
    const redisA = await createRedisWorkspaceEventPublisher(new InMemoryWorkspaceEventPublisher());
    const redisB = await createRedisWorkspaceEventPublisher(new InMemoryWorkspaceEventPublisher());
    expect(redisA).not.toBeNull();
    expect(redisB).not.toBeNull();

    const receivedA: WorkspaceRealtimeEvent[] = [];
    const receivedB: WorkspaceRealtimeEvent[] = [];
    const unsubscribeA = redisA!.subscribe("conversation:c-1", (event) => receivedA.push(event));
    const unsubscribeB = redisB!.subscribe("conversation:c-1", (event) => receivedB.push(event));
    await Promise.resolve(); // подписки в mock-брокере регистрируются асинхронно

    const event: WorkspaceRealtimeEvent = {
      type: "message.created",
      conversationId: "c-1",
      message: { id: "m-1" }
    };
    redisA!.publish("conversation:c-1", event);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Чужой инстанс получает событие через pub/sub, свой — только локально (без дубля).
    expect(receivedB).toEqual([event]);
    expect(receivedA).toEqual([event]);

    // После unsubscribe доставка прекращается (снимается только свой handler).
    unsubscribeA();
    unsubscribeB();
    await Promise.resolve();
    redisA!.publish("conversation:c-1", event);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
    await Promise.allSettled([redisA!.close?.(), redisB!.close?.()]);
  });
});
