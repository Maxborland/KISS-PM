/**
 * Дата/время журнала аудита — ЕДИНАЯ зона для рендера и для границ фильтра.
 *
 * Почему UTC. Сервер сравнивает fromDate/toDate как абсолютные инстанты
 * (auditRoutes → repositories: gte(auditEvents.createdAt, fromDate)); ни tenant-,
 * ни user-таймзоны в контракте нет. Раньше границы пиналась к UTC, а строки
 * таблицы форматировались в зоне браузера без timeZone — оператор в UTC+3,
 * фильтруя «20 июл», терял события, которые эта же таблица подписывала
 * «20 июл, 01:30», и втягивал три часа 21-го. Зоны приведены к одной (UTC) —
 * так же, как в соседних админ-поверхностях (absences, production-calendar,
 * crm/deals), где формат уже пинается timeZone: "UTC".
 *
 * Про apps/web/src/lib/formatters.ts: там date-fns `format`, который рендерит
 * в ЛОКАЛЬНОЙ зоне процесса, то есть ровно тот баг, который здесь чинится.
 * Поэтому журнал аудита сознательно не переводится на общий модуль.
 */

export const AUDIT_TIME_ZONE = "UTC";

/**
 * Дата+время события (ru-RU, боевой формат журнала), пинается к AUDIT_TIME_ZONE.
 * Форматтер строится на вызов — как и раньше; окно ленты ≤ 100 строк.
 */
export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AUDIT_TIME_ZONE
  }).format(d);
}

/** ISO-инстант → YYYY-MM-DD для <input type="date">. */
export function auditDayInputValue(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** Нижняя граница выбранного дня в AUDIT_TIME_ZONE (включительно). */
export function auditFromDateBound(day: string): string | null {
  return day ? `${day}T00:00:00.000Z` : null;
}

/** Верхняя граница выбранного дня в AUDIT_TIME_ZONE (включительно). */
export function auditToDateBound(day: string): string | null {
  return day ? `${day}T23:59:59.999Z` : null;
}

/** Календарный день инстанта в AUDIT_TIME_ZONE (YYYY-MM-DD) — тот, что видит оператор. */
export function auditDayOfInstant(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
