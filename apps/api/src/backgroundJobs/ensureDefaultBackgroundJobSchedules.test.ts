import { describe, expect, it, vi } from "vitest";

import type { BackgroundJobSchedule } from "@kiss-pm/domain";
import type { BackgroundJobScheduleInput } from "@kiss-pm/persistence";

import type { BackgroundJobScheduleSeedDataPort } from "../apiDataPorts";
import {
  defaultBackgroundJobScheduleSeeds,
  ensureDefaultBackgroundJobSchedules
} from "./ensureDefaultBackgroundJobSchedules";

function createFakeSeedDataSource(tenantIds: string[]): {
  dataSource: BackgroundJobScheduleSeedDataPort;
  upsertCalls: BackgroundJobScheduleInput[];
} {
  const upsertCalls: BackgroundJobScheduleInput[] = [];
  const dataSource: BackgroundJobScheduleSeedDataPort = {
    async listTenants() {
      return tenantIds.map((id) => ({ id, name: `Tenant ${id}` }));
    },
    async upsertBackgroundJobSchedule(input) {
      upsertCalls.push(input);
      return toSchedule(input);
    }
  };
  return { dataSource, upsertCalls };
}

function toSchedule(input: BackgroundJobScheduleInput): BackgroundJobSchedule {
  return {
    ...input,
    lastEnqueuedAt: null,
    createdAt: input.nextRunAt,
    updatedAt: input.nextRunAt
  };
}

describe("ensureDefaultBackgroundJobSchedules", () => {
  it("seeds three maintenance schedules per tenant with default: keys and nextRunAt=now", async () => {
    const { dataSource, upsertCalls } = createFakeSeedDataSource(["tenant-a", "tenant-b"]);
    const now = new Date("2026-07-19T10:00:00.000Z");

    const result = await ensureDefaultBackgroundJobSchedules({ dataSource, now });

    expect(result).toEqual({ status: "seeded", tenants: 2, schedules: 6 });
    expect(upsertCalls).toHaveLength(6);
    expect(upsertCalls.map((call) => [call.tenantId, call.scheduleKey])).toEqual([
      ["tenant-a", "default:storage.asset_cleanup"],
      ["tenant-a", "default:calls.recording_janitor"],
      ["tenant-a", "default:planning.expired_runs_purge"],
      ["tenant-b", "default:storage.asset_cleanup"],
      ["tenant-b", "default:calls.recording_janitor"],
      ["tenant-b", "default:planning.expired_runs_purge"]
    ]);
    for (const call of upsertCalls) {
      expect(call.id).toBe(`sched-${call.tenantId}-${call.kind}`);
      expect(call.payload).toEqual({});
      expect(call.enabled).toBe(true);
      expect(call.nextRunAt).toEqual(now);
    }
    const intervalByKind = new Map(
      upsertCalls.map((call) => [call.kind, call.intervalSeconds])
    );
    expect(intervalByKind.get("storage.asset_cleanup")).toBe(86_400);
    expect(intervalByKind.get("calls.recording_janitor")).toBe(3_600);
    expect(intervalByKind.get("planning.expired_runs_purge")).toBe(86_400);
  });

  it("does not seed no-op boundary jobs", () => {
    const seededKinds = defaultBackgroundJobScheduleSeeds.map((seed) => seed.kind);
    for (const noOpKind of [
      "notification.dispatch",
      "connector.sync",
      "search.projection_rebuild",
      "calls.recording_compose"
    ]) {
      expect(seededKinds).not.toContain(noOpKind);
    }
  });

  it("is idempotent: a second run targets the same (tenantId, scheduleKey, id) upsert keys", async () => {
    const { dataSource, upsertCalls } = createFakeSeedDataSource(["tenant-a", "tenant-b"]);

    await ensureDefaultBackgroundJobSchedules({ dataSource });
    const firstRunKeys = upsertCalls.map((call) =>
      [call.tenantId, call.scheduleKey, call.id].join("|")
    );
    upsertCalls.length = 0;
    await ensureDefaultBackgroundJobSchedules({ dataSource });
    const secondRunKeys = upsertCalls.map((call) =>
      [call.tenantId, call.scheduleKey, call.id].join("|")
    );

    // Конфликтный ключ upsert в persistence — (tenant_id, schedule_key):
    // одинаковые ключи между запусками означают update, а не дубли строк.
    expect(secondRunKeys).toEqual(firstRunKeys);
    expect(new Set(firstRunKeys).size).toBe(firstRunKeys.length);
  });

  it("fail-soft: warns and performs zero upserts when listTenants is unavailable", async () => {
    const upsertBackgroundJobSchedule = vi.fn();
    const warn = vi.fn();

    const result = await ensureDefaultBackgroundJobSchedules({
      dataSource: { upsertBackgroundJobSchedule },
      warn
    });

    expect(result).toEqual({
      status: "skipped",
      reason: "background_job_seed_data_source_incomplete"
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(upsertBackgroundJobSchedule).not.toHaveBeenCalled();
  });

  it("fail-soft: warns when upsertBackgroundJobSchedule is unavailable", async () => {
    const listTenants = vi.fn();
    const warn = vi.fn();

    const result = await ensureDefaultBackgroundJobSchedules({
      dataSource: { listTenants },
      warn
    });

    expect(result.status).toBe("skipped");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(listTenants).not.toHaveBeenCalled();
  });
});
