import type { BackgroundJobKind } from "@kiss-pm/domain";

import type { BackgroundJobScheduleSeedDataPort } from "../apiDataPorts";

// Дефолтные maintenance-расписания, которые воркер фоновых джоб засевает при
// старте. Только джобы с реальными хендлерами (см. jobHandlers.ts): no-op
// boundary-джобы (notification.dispatch, connector.sync,
// search.projection_rebuild, calls.recording_compose) намеренно НЕ засеваются —
// их выполнение ничего не делает и лишь шумит в background_job_runs.
export const defaultBackgroundJobScheduleSeeds: ReadonlyArray<{
  kind: BackgroundJobKind;
  intervalSeconds: number;
}> = [
  { kind: "storage.asset_cleanup", intervalSeconds: 86_400 },
  { kind: "calls.recording_janitor", intervalSeconds: 3_600 },
  { kind: "planning.expired_runs_purge", intervalSeconds: 86_400 }
];

export function defaultBackgroundJobScheduleKey(kind: BackgroundJobKind): string {
  return `default:${kind}`;
}

export type EnsureDefaultBackgroundJobSchedulesResult =
  | { status: "seeded"; tenants: number; schedules: number }
  | { status: "skipped"; reason: "background_job_seed_data_source_incomplete" };

// Идемпотентный сид per-tenant дефолтных расписаний maintenance-джоб. Вызывается
// в server.ts перед первым poll воркера. upsertBackgroundJobSchedule конфликтует
// по (tenant_id, schedule_key) — повторный старт не плодит дубли, а стабильный
// id `sched-<tenantId>-<kind>` используется только при первой вставке (id — text
// без ограничения длины, PK (tenant_id, id)). nextRunAt = now: первый тик
// воркера выполняет maintenance сразу.
export async function ensureDefaultBackgroundJobSchedules(input: {
  dataSource: Partial<BackgroundJobScheduleSeedDataPort>;
  now?: Date;
  warn?: (message: string) => void;
}): Promise<EnsureDefaultBackgroundJobSchedulesResult> {
  const warn = input.warn ?? ((message: string) => console.warn(message));
  const { listTenants, upsertBackgroundJobSchedule } = input.dataSource;
  if (!listTenants || !upsertBackgroundJobSchedule) {
    // Fail-soft: Partial-датасорс без нужных методов — воркер стартует без
    // сида, maintenance-расписания придётся завести иным путём.
    warn("background_jobs_seed_skipped: data source lacks listTenants/upsertBackgroundJobSchedule");
    return { status: "skipped", reason: "background_job_seed_data_source_incomplete" };
  }

  const now = input.now ?? new Date();
  const tenants = await listTenants.call(input.dataSource);
  let schedules = 0;
  for (const tenant of tenants) {
    for (const seed of defaultBackgroundJobScheduleSeeds) {
      await upsertBackgroundJobSchedule.call(input.dataSource, {
        id: `sched-${tenant.id}-${seed.kind}`,
        tenantId: tenant.id,
        kind: seed.kind,
        scheduleKey: defaultBackgroundJobScheduleKey(seed.kind),
        payload: {},
        intervalSeconds: seed.intervalSeconds,
        enabled: true,
        nextRunAt: now
      });
      schedules += 1;
    }
  }
  return { status: "seeded", tenants: tenants.length, schedules };
}
