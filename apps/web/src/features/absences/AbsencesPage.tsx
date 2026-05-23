"use client";

import { useMemo, useState } from "react";

import {
  currentMonthIso,
  MonthNavigation
} from "../planning/resources/MonthNavigation";
import "../planning/planning.css";
import { AbsenceCreateDialog } from "./AbsenceCreateDialog";
import { AbsencesTable, type AbsencesTableDay } from "./AbsencesTable";
import { monthRangeIso, useAbsences } from "./useAbsences";

export function AbsencesPage(props: {
  canRead: boolean;
  canManage: boolean;
  users: Array<{ id: string; name: string }>;
}) {
  const [monthIso, setMonthIso] = useState(currentMonthIso());
  const [createOpen, setCreateOpen] = useState(false);
  const range = useMemo(() => monthRangeIso(monthIso), [monthIso]);
  const absencesQuery = useAbsences(range.fromDate, range.toDate, props.canRead);
  const days = useMemo(() => buildMonthDays(monthIso), [monthIso]);

  if (!props.canRead) {
    return (
      <main className="absences-page" data-testid="absences-forbidden">
        <p>Отсутствия недоступны без права tenant.absences.read.</p>
      </main>
    );
  }

  return (
    <main className="absences-page" data-testid="absences-page">
      <header className="absences-page__header">
        <div>
          <h1>Отсутствия</h1>
          <p className="planning-pane__muted">Отпуска, больничные и другие отсутствия сотрудников tenant.</p>
        </div>
        <div className="absences-page__toolbar">
          <MonthNavigation monthIso={monthIso} onChange={setMonthIso} />
          {props.canManage ? (
            <button
              className="primary-button"
              type="button"
              data-testid="absence-create-open"
              onClick={() => setCreateOpen(true)}
            >
              Добавить
            </button>
          ) : null}
        </div>
      </header>
      {absencesQuery.isLoading ? (
        <p className="planning-pane__muted">Загрузка…</p>
      ) : (
        <AbsencesTable
          users={props.users}
          days={days}
          absences={absencesQuery.absences}
          canManage={props.canManage}
          onDelete={(id) => void absencesQuery.deleteAbsence(id)}
        />
      )}
      <AbsenceCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={props.users}
        onSubmit={absencesQuery.createAbsence}
      />
    </main>
  );
}

function buildMonthDays(monthIso: string): AbsencesTableDay[] {
  const [yearText, monthText] = monthIso.split("-");
  const year = Number.parseInt(yearText ?? "2026", 10);
  const monthIndex = Number.parseInt(monthText ?? "1", 10) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const days: AbsencesTableDay[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    days.push({
      date: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      isoWeekday: isoWeekdayFromJsDay(date.getUTCDay())
    });
  }
  return days;
}

function isoWeekdayFromJsDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}
