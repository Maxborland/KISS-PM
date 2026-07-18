import { describe, expect, it } from "vitest";

import type { BackgroundJobRun } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "../apiTypes";
import { createDefaultBackgroundJobRegistry } from "./jobHandlers";

function purgeJob(payload: Record<string, unknown> = {}): BackgroundJobRun {
  return {
    id: "job-1",
    tenantId: "tenant-1",
    kind: "planning.expired_runs_purge",
    status: "running",
    priority: 0,
    payload,
    idempotencyKey: null,
    attempt: 1,
    maxAttempts: 5,
    runAfter: new Date("2026-07-18T00:00:00.000Z"),
    lockedBy: "worker",
    lockedAt: new Date("2026-07-18T00:00:00.000Z"),
    startedAt: new Date("2026-07-18T00:00:00.000Z"),
    finishedAt: null,
    lastError: null,
    createdAt: new Date("2026-07-18T00:00:00.000Z"),
    updatedAt: new Date("2026-07-18T00:00:00.000Z")
  };
}

describe("planning.expired_runs_purge handler", () => {
  it("зовёт purge с grace-периодом retentionHours и возвращает счётчики", async () => {
    const calls: Array<{ tenantId: string; expiredBefore: Date }> = [];
    const dataSource = {
      async purgeExpiredPlanningRuns(input: { tenantId: string; expiredBefore: Date }) {
        calls.push(input);
        return { scenarioRuns: 3, solverRuns: 1 };
      }
    } as unknown as ApiTenantDataSource;
    const handler = createDefaultBackgroundJobRegistry()["planning.expired_runs_purge"]!;
    const now = new Date("2026-07-18T12:00:00.000Z");

    const result = await handler(purgeJob({ retentionHours: 48 }), { dataSource, now });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.tenantId).toBe("tenant-1");
    // Grace: удаляем только истёкшее раньше, чем now - retentionHours.
    expect(calls[0]!.expiredBefore.toISOString()).toBe("2026-07-16T12:00:00.000Z");
    expect(result).toEqual({
      message: "Expired planning runs purged",
      metadata: { scenarioRuns: 3, solverRuns: 1, retentionHours: 48 }
    });
  });

  it("fail-closed без persistence-метода: бросает planning_runs_purge_not_configured", async () => {
    const handler = createDefaultBackgroundJobRegistry()["planning.expired_runs_purge"]!;
    await expect(
      handler(purgeJob(), { dataSource: {} as ApiTenantDataSource, now: new Date() })
    ).rejects.toThrow("planning_runs_purge_not_configured");
  });
});
