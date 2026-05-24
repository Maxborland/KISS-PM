"use client";

import { useCallback, useState } from "react";

import { PlanningSelect, PlanningSelectLabel } from "../../components/ui/select";
import "../planning/planning.css";
import { ProductionCalendarMonthGrid } from "./ProductionCalendarMonthGrid";
import { ProductionCalendarPreset } from "./ProductionCalendarPreset";
import {
  useProductionCalendar,
  type ProductionCalendarException
} from "./useProductionCalendar";

const YEAR_OPTIONS = ["2025", "2026", "2027"] as const;
type YearOption = (typeof YEAR_OPTIONS)[number];

export function ProductionCalendarPage(props: {
  canRead: boolean;
  canManage: boolean;
}) {
  const [year, setYear] = useState<YearOption>("2026");
  const numericYear = Number.parseInt(year, 10);
  const calendar = useProductionCalendar(numericYear, props.canRead);

  const handleToggleDay = useCallback(
    (date: string, current: ProductionCalendarException | null) => {
      if (!props.canManage || !calendar.snapshot) return;
      const baseMinutes = calendar.snapshot.workingMinutesPerDay;
      const isWeekday = calendar.snapshot.workingWeekdays.includes(
        isoWeekdayFromDate(date)
      );
      const effectiveMinutes = current
        ? current.workingMinutes
        : isWeekday
          ? baseMinutes
          : 0;
      const nextMinutes = effectiveMinutes === 0 ? baseMinutes : 0;
      const reason = current?.reason ?? (nextMinutes === 0 ? "Праздничный день" : null);
      const nextException: ProductionCalendarException = {
        id: current?.id ?? `manual-${date}`,
        date,
        workingMinutes: nextMinutes,
        reason,
        resourceId: null
      };
      const otherExceptions = calendar.snapshot.exceptions.filter(
        (item) => !(item.date === date && item.resourceId === null)
      );
      void calendar.bulkUpsert({
        exceptions: [...otherExceptions, nextException]
      });
    },
    [calendar, props.canManage]
  );

  if (!props.canRead) {
    return (
      <main className="production-calendar-page" data-testid="production-calendar-forbidden">
        <p title="Нужно право tenant.workspace_config.read">
          Производственный календарь недоступен.
        </p>
      </main>
    );
  }

  return (
    <main className="production-calendar-page" data-testid="production-calendar-page">
      <header className="production-calendar-page__header">
        <div>
          <h1>Производственный календарь</h1>
          <p className="planning-pane__muted">
            Tenant-уровень. Используется по умолчанию для проектов без собственного календаря.
          </p>
        </div>
        <div className="production-calendar-page__toolbar">
          <PlanningSelectLabel>Год</PlanningSelectLabel>
          <PlanningSelect<YearOption>
            aria-label="Год календаря"
            value={year}
            options={YEAR_OPTIONS.map((option) => ({ value: option, label: option }))}
            onChange={(value) => setYear(value)}
          />
        </div>
      </header>

      {calendar.error ? (
        <p className="planning-pane__alert" data-testid="production-calendar-error">
          Не удалось загрузить календарь: {String(calendar.error)}
        </p>
      ) : null}

      {calendar.snapshot ? (
        <>
          <ProductionCalendarPreset
            year={numericYear}
            exceptions={calendar.snapshot.exceptions}
            disabled={!props.canManage || calendar.isSaving}
            onApplyPreset={calendar.bulkUpsert}
            onClearYear={calendar.bulkUpsert}
          />
          <ProductionCalendarMonthGrid
            year={numericYear}
            exceptions={calendar.snapshot.exceptions}
            workingWeekdays={calendar.snapshot.workingWeekdays}
            workingMinutesPerDay={calendar.snapshot.workingMinutesPerDay}
            onToggleDay={handleToggleDay}
            disabled={!props.canManage || calendar.isSaving}
          />
          {calendar.saveError ? (
            <p className="planning-pane__alert" data-testid="production-calendar-save-error">
              Не удалось сохранить: {String(calendar.saveError)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="planning-pane__muted">Загрузка...</p>
      )}
    </main>
  );
}

function isoWeekdayFromDate(dateIso: string): number {
  const [yearText, monthText, dayText] = dateIso.split("-");
  const yearValue = Number.parseInt(yearText ?? "0", 10);
  const monthValue = Number.parseInt(monthText ?? "1", 10);
  const dayValue = Number.parseInt(dayText ?? "1", 10);
  const date = new Date(Date.UTC(yearValue, monthValue - 1, dayValue));
  const js = date.getUTCDay();
  return js === 0 ? 7 : js;
}
