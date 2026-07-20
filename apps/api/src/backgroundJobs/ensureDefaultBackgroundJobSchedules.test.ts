import { describe, expect, it, vi } from "vitest";

import type { BackgroundJobSchedule } from "@kiss-pm/domain";
import type { BackgroundJobScheduleInput } from "@kiss-pm/persistence";

import type { BackgroundJobScheduleSeedDataPort } from "../apiDataPorts";
import {
  defaultBackgroundJobScheduleSeeds,
  ensureDefaultBackgroundJobSchedules
} from "./ensureDefaultBackgroundJobSchedules";

function createFakeSeedDataSource(tenantIds: string[], options: { existingKeys?: Set<string> } = {}): {
  dataSource: BackgroundJobScheduleSeedDataPort;
  upsertCalls: BackgroundJobScheduleInput[];
} {
  const upsertCalls: BackgroundJobScheduleInput[] = [];
  const existingKeys = options.existingKeys ?? new Set<string>();
  const dataSource: BackgroundJobScheduleSeedDataPort = {
    async listTenants() {
      return tenantIds.map((id) => ({ id, name: `Tenant ${id}` }));
    },
    // Семантика ON CONFLICT DO NOTHING: существующая строка не трогается,
    // вызов возвращает undefined.
    async insertBackgroundJobScheduleIfMissing(input) {
      upsertCalls.push(input);
      const key = `${input.tenantId}|${input.scheduleKey}`;
      if (existingKeys.has(key)) return undefined;
      existingKeys.add(key);
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
  it("seeds four maintenance schedules per tenant with default: keys and nextRunAt=now", async () => {
    const { dataSource, upsertCalls } = createFakeSeedDataSource(["tenant-a", "tenant-b"]);
    const now = new Date("2026-07-19T10:00:00.000Z");

    const result = await ensureDefaultBackgroundJobSchedules({ dataSource, now });

    expect(result).toEqual({ status: "seeded", tenants: 2, created: 8, existing: 0 });
    expect(upsertCalls).toHaveLength(8);
    expect(upsertCalls.map((call) => [call.tenantId, call.scheduleKey])).toEqual([
      ["tenant-a", "default:storage.asset_cleanup"],
      ["tenant-a", "default:calls.recording_janitor"],
      ["tenant-a", "default:planning.expired_runs_purge"],
      ["tenant-a", "default:notification.dispatch"],
      ["tenant-b", "default:storage.asset_cleanup"],
      ["tenant-b", "default:calls.recording_janitor"],
      ["tenant-b", "default:planning.expired_runs_purge"],
      ["tenant-b", "default:notification.dispatch"]
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
    expect(intervalByKind.get("notification.dispatch")).toBe(900);
  });

  it("seeds implemented notification.dispatch but not no-op boundary jobs", () => {
    const seededKinds = defaultBackgroundJobScheduleSeeds.map((seed) => seed.kind);
    // notification.dispatch реализован (Блок 8) — засеваем.
    expect(seededKinds).toContain("notification.dispatch");
    for (const noOpKind of [
      "connector.sync",
      "search.projection_rebuild",
      "calls.recording_compose"
    ]) {
      expect(seededKinds).not.toContain(noOpKind);
    }
  });

  it("идемпотентен и сохраняет состояние оператора: повторный запуск не пересоздаёт строки", async () => {
    const { dataSource, upsertCalls } = createFakeSeedDataSource(["tenant-a", "tenant-b"]);

    const first = await ensureDefaultBackgroundJobSchedules({ dataSource });
    expect(first).toEqual({ status: "seeded", tenants: 2, created: 8, existing: 0 });
    upsertCalls.length = 0;

    // Второй старт (после рестарта API): все строки уже существуют — DO NOTHING,
    // enabled/nextRunAt оператора не перезатираются (ревью #258).
    const second = await ensureDefaultBackgroundJobSchedules({ dataSource });
    expect(second).toEqual({ status: "seeded", tenants: 2, created: 0, existing: 8 });
    const keys = upsertCalls.map((call) => [call.tenantId, call.scheduleKey, call.id].join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("tenantIds: точечный сид нового тенанта без listTenants (регистрация workspace)", async () => {
    const insertBackgroundJobScheduleIfMissing = vi.fn(async (input: BackgroundJobScheduleInput) => toSchedule(input));

    const result = await ensureDefaultBackgroundJobSchedules({
      dataSource: { insertBackgroundJobScheduleIfMissing },
      tenantIds: ["tenant-new"]
    });

    expect(result).toEqual({ status: "seeded", tenants: 1, created: 4, existing: 0 });
    expect(insertBackgroundJobScheduleIfMissing).toHaveBeenCalledTimes(4);
    expect(insertBackgroundJobScheduleIfMissing.mock.calls.map(([input]) => input.tenantId)).toEqual([
      "tenant-new", "tenant-new", "tenant-new", "tenant-new"
    ]);
  });

  // F4(b): сид ждут перед первым poll воркера, поэтому строго последовательные
  // вставки упирали время старта в число тенантов (400 x 4 = 1600 round-trip'ов).
  it("F4: вставки сида идут пачками параллельно, а не строго по одной", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const dataSource: BackgroundJobScheduleSeedDataPort = {
      async listTenants() {
        return Array.from({ length: 10 }, (_, index) => ({
          id: `tenant-${index}`,
          name: `Tenant ${index}`
        }));
      },
      async insertBackgroundJobScheduleIfMissing(input) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 0));
        inFlight -= 1;
        return toSchedule(input);
      }
    };

    const result = await ensureDefaultBackgroundJobSchedules({ dataSource });

    expect(result).toEqual({ status: "seeded", tenants: 10, created: 40, existing: 0 });
    // Последовательный цикл дал бы ровно 1.
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("fail-soft: warns and performs zero inserts when listTenants is unavailable", async () => {
    const insertBackgroundJobScheduleIfMissing = vi.fn();
    const warn = vi.fn();

    const result = await ensureDefaultBackgroundJobSchedules({
      dataSource: { insertBackgroundJobScheduleIfMissing },
      warn
    });

    expect(result).toEqual({
      status: "skipped",
      reason: "background_job_seed_data_source_incomplete"
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(insertBackgroundJobScheduleIfMissing).not.toHaveBeenCalled();
  });

  it("fail-soft: warns when insertBackgroundJobScheduleIfMissing is unavailable", async () => {
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
