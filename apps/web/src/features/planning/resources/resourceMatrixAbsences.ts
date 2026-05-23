import type { ResourceAbsence } from "../../absences/useAbsences";
import { iterateIsoDateRange } from "../planningIsoDates";

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
    iterateIsoDateRange(absence.dateFrom, absence.dateTo, (date) => {
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
