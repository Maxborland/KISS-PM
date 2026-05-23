const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDateToUtcMs(value: string): number | null {
  const trimmed = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [yearText, monthText, dayText] = trimmed.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const monthIndex = Number.parseInt(monthText ?? "", 10) - 1;
  const day = Number.parseInt(dayText ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null;
  }
  return Date.UTC(year, monthIndex, day);
}

export function formatIsoDateUtc(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function iterateIsoDateRange(
  startIso: string,
  finishIso: string,
  callback: (dateIso: string) => void
): void {
  const startMs = parseIsoDateToUtcMs(startIso);
  const finishMs = parseIsoDateToUtcMs(finishIso);
  if (startMs === null || finishMs === null || finishMs < startMs) return;
  for (let ms = startMs; ms <= finishMs; ms += DAY_MS) {
    callback(formatIsoDateUtc(ms));
  }
}

export function countIsoDateSpanDays(startIso: string, finishIso: string): number {
  const start = parseIsoDateToUtcMs(startIso);
  const finish = parseIsoDateToUtcMs(finishIso);
  if (start === null || finish === null || finish < start) return 0;
  return Math.floor((finish - start) / DAY_MS) + 1;
}
