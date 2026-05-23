export type DurationParseResult =
  | { ok: true; minutes: number; unit: "day" | "hour" }
  | { ok: false; error: string };

const DAY_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(дн?|дня|дней|d|day|days)\.?$/iu;
const HOUR_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(ч|h|hour|hours)\.?$/iu;

export function parseDurationOrWork(
  input: string,
  workingMinutesPerDay: number
): DurationParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "empty" };

  const dayMatch = DAY_PATTERN.exec(trimmed);
  if (dayMatch) {
    const days = Number(dayMatch[1]!.replace(",", "."));
    if (!Number.isFinite(days) || days <= 0) return { ok: false, error: "invalid_day" };
    return { ok: true, minutes: Math.round(days * workingMinutesPerDay), unit: "day" };
  }

  const hourMatch = HOUR_PATTERN.exec(trimmed);
  if (hourMatch) {
    const hours = Number(hourMatch[1]!.replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0) return { ok: false, error: "invalid_hour" };
    return { ok: true, minutes: Math.round(hours * 60), unit: "hour" };
  }

  return { ok: false, error: "unsupported_unit" };
}

export function formatDurationMinutes(minutes: number, workingMinutesPerDay: number): string {
  if (minutes <= 0) return "";
  if (minutes % workingMinutesPerDay === 0) {
    return `${minutes / workingMinutesPerDay} дн`;
  }
  if (minutes % 60 === 0) {
    return `${minutes / 60} ч`;
  }
  return `${minutes} м`;
}
