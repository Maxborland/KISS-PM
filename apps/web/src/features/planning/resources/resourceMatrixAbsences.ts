import type { ResourceAbsence } from "../../absences/useAbsences";

export type ResourceMatrixAbsenceInput = Pick<
  ResourceAbsence,
  "userId" | "dateFrom" | "dateTo"
>;

export function buildAbsenceDateKeySet(
  absences: ResourceMatrixAbsenceInput[],
  monthDates: ReadonlySet<string>
): Set<string> {
  const keys = new Set<string>();
  for (const absence of absences) {
    iterateIsoDates(absence.dateFrom, absence.dateTo, (date) => {
      if (!monthDates.has(date)) return;
      keys.add(`${absence.userId}:${date}`);
    });
  }
  return keys;
}

export function hasAbsenceOnDate(
  absenceKeys: ReadonlySet<string>,
  userId: string,
  date: string
): boolean {
  return absenceKeys.has(`${userId}:${date}`);
}

function iterateIsoDates(
  fromDate: string,
  toDate: string,
  onDate: (date: string) => void
): void {
  const start = parseIsoDate(fromDate);
  const end = parseIsoDate(toDate);
  if (start === null || end === null || end < start) return;
  for (let cursor = start; cursor <= end; cursor += 24 * 60 * 60 * 1000) {
    onDate(toIsoDate(cursor));
  }
}

function parseIsoDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const monthIndex = Number.parseInt(monthText ?? "", 10) - 1;
  const day = Number.parseInt(dayText ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null;
  }
  return Date.UTC(year, monthIndex, day);
}

function toIsoDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
