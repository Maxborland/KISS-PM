import type { BackgroundJobKind } from "@kiss-pm/domain";

import type { BackgroundJobScheduleSeedDataPort } from "../apiDataPorts";

// Дефолтные maintenance-расписания, которые воркер фоновых джоб засевает при
// старте. Только джобы с реальными хендлерами (см. jobHandlers.ts): no-op
// boundary-джобы (connector.sync, search.projection_rebuild,
// calls.recording_compose) намеренно НЕ засеваются — их выполнение ничего не
// делает и лишь шумит в background_job_runs.
// notification.dispatch реализован: каждые 15 минут собирает непрочитанные
// уведомления и шлёт email-дайджест. Интервал совпадает с окном по умолчанию в
// хендлере (lookbackMinutes=15), чтобы окна не пересекались и не зияли.
export const defaultBackgroundJobScheduleSeeds: ReadonlyArray<{
  kind: BackgroundJobKind;
  intervalSeconds: number;
}> = [
  { kind: "storage.asset_cleanup", intervalSeconds: 86_400 },
  { kind: "calls.recording_janitor", intervalSeconds: 3_600 },
  { kind: "planning.expired_runs_purge", intervalSeconds: 86_400 },
  { kind: "notification.dispatch", intervalSeconds: 900 }
];

export function defaultBackgroundJobScheduleKey(kind: BackgroundJobKind): string {
  return `default:${kind}`;
}

export type EnsureDefaultBackgroundJobSchedulesResult =
  | { status: "seeded"; tenants: number; created: number; existing: number }
  | { status: "skipped"; reason: "background_job_seed_data_source_incomplete" };

// Идемпотентный сид per-tenant дефолтных расписаний maintenance-джоб.
// Вызывается в server.ts перед первым poll воркера и из регистрации workspace
// (tenantIds = [новый тенант]) — тенанты, созданные после старта, не остаются
// без maintenance до рестарта. Вставка — insertBackgroundJobScheduleIfMissing
// (ON CONFLICT DO NOTHING по (tenant_id, schedule_key)): существующие строки
// НЕ трогаются — выключенное или отложенное оператором расписание переживает
// рестарт. nextRunAt = now только для НОВЫХ строк: их первый тик — сразу.
export async function ensureDefaultBackgroundJobSchedules(input: {
  dataSource: Partial<BackgroundJobScheduleSeedDataPort>;
  tenantIds?: readonly string[];
  now?: Date;
  warn?: (message: string) => void;
}): Promise<EnsureDefaultBackgroundJobSchedulesResult> {
  const warn = input.warn ?? ((message: string) => console.warn(message));
  const { listTenants, insertBackgroundJobScheduleIfMissing } = input.dataSource;
  if (!insertBackgroundJobScheduleIfMissing || (!input.tenantIds && !listTenants)) {
    // Fail-soft: Partial-датасорс без нужных методов — воркер стартует без
    // сида, maintenance-расписания придётся завести иным путём.
    warn("background_jobs_seed_skipped: data source lacks listTenants/insertBackgroundJobScheduleIfMissing");
    return { status: "skipped", reason: "background_job_seed_data_source_incomplete" };
  }

  const now = input.now ?? new Date();
  const tenantIds =
    input.tenantIds ?? (await listTenants!.call(input.dataSource)).map((tenant) => tenant.id);
  let created = 0;
  let existing = 0;
  for (const tenantId of tenantIds) {
    for (const seed of defaultBackgroundJobScheduleSeeds) {
      const inserted = await insertBackgroundJobScheduleIfMissing.call(input.dataSource, {
        id: `sched-${tenantId}-${seed.kind}`,
        tenantId,
        kind: seed.kind,
        scheduleKey: defaultBackgroundJobScheduleKey(seed.kind),
        payload: {},
        intervalSeconds: seed.intervalSeconds,
        enabled: true,
        nextRunAt: now
      });
      if (inserted) created += 1;
      else existing += 1;
    }
  }
  return { status: "seeded", tenants: tenantIds.length, created, existing };
}
