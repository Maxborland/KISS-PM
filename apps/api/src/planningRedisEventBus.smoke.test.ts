import { describe, expect, it } from "vitest";

import { InMemoryPlanningEventPublisher } from "./planningEventBus";
import { createRedisPlanningEventPublisher } from "./planningRedisEventBus";

const redisUrl = process.env.REDIS_URL ?? process.env.PLANNING_EVENTS_REDIS_URL;

describe("planning Redis event bus smoke", () => {
  it.skipIf(!redisUrl)("delivers events across two publisher instances", async () => {
    const localA = new InMemoryPlanningEventPublisher();
    const localB = new InMemoryPlanningEventPublisher();
    const redisA = await createRedisPlanningEventPublisher(localA);
    const redisB = await createRedisPlanningEventPublisher(localB);
    expect(redisA).not.toBeNull();
    expect(redisB).not.toBeNull();

    const received: string[] = [];
    const unsubscribe = redisB!.subscribe("project-smoke", (event) => {
      if (event.type === "planVersionChanged") {
        received.push(`${event.projectId}:${event.planVersion}`);
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    redisA!.publish({ type: "planVersionChanged", projectId: "project-smoke", planVersion: 7 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    unsubscribe();
    expect(received).toContain("project-smoke:7");
  });
});
