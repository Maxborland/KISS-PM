import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  conversationChannel,
  InMemoryWorkspaceEventPublisher,
  type WorkspaceRealtimeEvent
} from "./workspaceEventBus";
import { createRedisWorkspaceEventPublisher } from "./workspaceRedisEventBus";

const redisUrl = process.env.REDIS_URL ?? process.env.PLANNING_EVENTS_REDIS_URL;

describe("workspace Redis event bus smoke", () => {
  it.skipIf(!redisUrl)(
    "delivers events across two publisher instances exactly once, without echo to self",
    async () => {
      const redisA = await createRedisWorkspaceEventPublisher(new InMemoryWorkspaceEventPublisher());
      const redisB = await createRedisWorkspaceEventPublisher(new InMemoryWorkspaceEventPublisher());
      expect(redisA).not.toBeNull();
      expect(redisB).not.toBeNull();

      const conversationId = `conv-smoke-${randomUUID()}`;
      const channel = conversationChannel(conversationId);
      const receivedA: WorkspaceRealtimeEvent[] = [];
      const receivedB: WorkspaceRealtimeEvent[] = [];
      const unsubscribeA = redisA!.subscribe(channel, (event) => receivedA.push(event));
      const unsubscribeB = redisB!.subscribe(channel, (event) => receivedB.push(event));

      await new Promise((resolve) => setTimeout(resolve, 100));
      const event: WorkspaceRealtimeEvent = {
        type: "message.created",
        conversationId,
        message: { id: "m-smoke" }
      };
      redisA!.publish(channel, event);
      await new Promise((resolve) => setTimeout(resolve, 500));

      unsubscribeA();
      unsubscribeB();
      await Promise.allSettled([redisA!.close?.(), redisB!.close?.()]);

      // Чужой инстанс получает событие через Redis ровно один раз.
      expect(receivedB).toEqual([event]);
      // Свой инстанс — ровно один раз локально (Redis-эхо отфильтровано по origin).
      expect(receivedA).toEqual([event]);
    }
  );
});
