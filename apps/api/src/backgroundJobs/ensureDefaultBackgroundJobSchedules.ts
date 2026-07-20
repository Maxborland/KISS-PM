import type { BackgroundJobKind } from "@kiss-pm/domain";

import type { BackgroundJobScheduleSeedDataPort } from "../apiDataPorts";

// Дефолтные maintenance-расписания, которые воркер фоновых джоб засевает при
// старте. Только джобы с реальными хендлерами (см. jobHandlers.ts): no-op
// boundary-джобы (connector.sync, search.projection_rebuild,
// calls.recording_compose) намеренно НЕ засеваются — их выполнение ничего не
// делает и лишь шумит в background_job_runs.
// notification.dispatch реализован: каждые 15 минут разбирает очередь
// непрочитанных уведомлений и шлёт email-дайджест. Интервал больше не обязан
// совпадать с каким-либо окном в хендлере: очередь определяется маркером
// delivered_at, поэтому интервал влияет только на задержку письма, а не на
// пропуски/дубликаты.
export const defaultBackgroundJobScheduleSeeds: ReadonlyArray<{
  kind: BackgroundJobKind;
  intervalSeconds: number;
}> = [
  { kind: "storage.asset_cleanup", intervalSeconds: 86_400 },
  { kind: "calls.recording_janitor", intervalSeconds: 3_600 },
  { kind: "planning.expired_runs_purge", intervalSeconds: 86_400 },
  { kind: "notification.dispatch", intervalSeconds: 900 }
];

// Ширина пачки параллельных вставок сида. Держим заметно ниже размера пула
// соединений, чтобы сид не выедал пул у остального старта API.
const SEED_INSERT_CONCURRENCY = 25;

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
  const rows = tenantIds.flatMap((tenantId) =>
    defaultBackgroundJobScheduleSeeds.map((seed) => ({
      id: `sched-${tenantId}-${seed.kind}`,
      tenantId,
      kind: seed.kind,
      scheduleKey: defaultBackgroundJobScheduleKey(seed.kind),
      payload: {},
      intervalSeconds: seed.intervalSeconds,
      enabled: true,
      nextRunAt: now
    }))
  );

  // Сид ждут перед первым poll воркера (server.ts), поэтому строго
  // последовательные вставки упирали время старта в число тенантов
  // (400 тенантов x 4 сида = 1600 round-trip'ов подряд). Пачки по
  // SEED_INSERT_CONCURRENCY режут это на порядок при том же
  // ON CONFLICT DO NOTHING и том же порядке строк в пределах пачки.
  let created = 0;
  let existing = 0;
  for (let offset = 0; offset < rows.length; offset += SEED_INSERT_CONCURRENCY) {
    const chunk = rows.slice(offset, offset + SEED_INSERT_CONCURRENCY);
    const results = await Promise.all(
      chunk.map((row) => insertBackgroundJobScheduleIfMissing.call(input.dataSource, row))
    );
    for (const inserted of results) {
      if (inserted) created += 1;
      else existing += 1;
    }
  }
  return { status: "seeded", tenants: tenantIds.length, created, existing };
}
