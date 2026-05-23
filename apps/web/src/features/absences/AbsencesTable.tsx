"use client";

import { ABSENCE_TYPE_LABELS, type AbsenceType } from "./absenceTypes";
import type { ResourceAbsence } from "./useAbsences";

export type AbsencesTableUser = {
  id: string;
  name: string;
};

export type AbsencesTableDay = {
  date: string;
  isoWeekday: number;
};

export function AbsencesTable(props: {
  users: AbsencesTableUser[];
  days: AbsencesTableDay[];
  absences: ResourceAbsence[];
  canManage: boolean;
  onDelete: (id: string) => void;
}) {
  const absencesByUserDate = buildAbsenceLookup(props.absences, props.days);

  return (
    <div className="absences-table-wrap" data-testid="absences-table">
      <table className="absences-table">
        <thead>
          <tr>
            <th className="absences-table__sticky">Сотрудник</th>
            {props.days.map((day) => (
              <th key={day.date} title={day.date}>
                {day.isoWeekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.users.map((user) => (
            <tr key={user.id}>
              <th className="absences-table__sticky" scope="row">
                {user.name}
              </th>
              {props.days.map((day) => {
                const absence = absencesByUserDate.get(`${user.id}:${day.date}`);
                return (
                  <td key={`${user.id}-${day.date}`} data-testid={`absence-cell-${user.id}-${day.date}`}>
                    {absence ? (
                      <button
                        type="button"
                        className="absences-table__chip"
                        title={`${ABSENCE_TYPE_LABELS[absence.type as AbsenceType]} · ${absence.dateFrom}–${absence.dateTo}`}
                        disabled={!props.canManage}
                        onClick={() => props.onDelete(absence.id)}
                      >
                        {ABSENCE_TYPE_LABELS[absence.type as AbsenceType].slice(0, 1)}
                      </button>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildAbsenceLookup(
  absences: ResourceAbsence[],
  days: AbsencesTableDay[]
): Map<string, ResourceAbsence> {
  const daySet = new Set(days.map((day) => day.date));
  const map = new Map<string, ResourceAbsence>();
  for (const absence of absences) {
    iterateIsoDates(absence.dateFrom, absence.dateTo, (date) => {
      if (!daySet.has(date)) return;
      map.set(`${absence.userId}:${date}`, absence);
    });
  }
  return map;
}

function iterateIsoDates(fromDate: string, toDate: string, onDate: (date: string) => void): void {
  const start = parseIsoDate(fromDate);
  const end = parseIsoDate(toDate);
  if (!start || !end || end < start) return;
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    onDate(toIsoDate(cursor));
  }
}

function parseIsoDate(value: string): number | null {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const monthIndex = Number.parseInt(monthText ?? "", 10) - 1;
  const day = Number.parseInt(dayText ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
  return Date.UTC(year, monthIndex, day);
}

function addUtcDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.getTime();
}

function toIsoDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
