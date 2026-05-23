"use client";

import { rfHolidays2026 } from "./rfHolidays2026";
import type {
  ProductionCalendarBulkInput,
  ProductionCalendarException
} from "./useProductionCalendar";

export function ProductionCalendarPreset(props: {
  year: number;
  exceptions: ProductionCalendarException[];
  disabled: boolean;
  onApplyPreset: (input: ProductionCalendarBulkInput) => Promise<unknown>;
  onClearYear: (input: ProductionCalendarBulkInput) => Promise<unknown>;
}) {
  const presetAvailable = props.year === 2026;
  const matchedPresetCount = countMatchedPresetDates(props.exceptions);

  return (
    <div className="production-calendar-preset" data-testid="production-calendar-preset">
      <div className="production-calendar-preset__info">
        <strong>Пресет: Производственный календарь РФ {props.year}</strong>
        <span className="planning-pane__muted">
          {presetAvailable
            ? `Содержит ${rfHolidays2026.length} нерабочих дней. Применено: ${matchedPresetCount} из ${rfHolidays2026.length}.`
            : "Пресет доступен только для 2026 года."}
        </span>
      </div>
      <div className="production-calendar-preset__actions">
        <button
          className="primary-button"
          type="button"
          disabled={props.disabled || !presetAvailable}
          title={
            props.disabled
              ? "Нужно право tenant.workspace_config.manage"
              : presetAvailable
                ? undefined
                : "Пресет доступен только для 2026 года"
          }
          onClick={() =>
            void props.onApplyPreset({
              exceptions: rfHolidays2026.map((holiday) => ({
                date: holiday.date,
                workingMinutes: 0,
                reason: holiday.reason,
                resourceId: null
              }))
            })
          }
        >
          Применить пресет
        </button>
      </div>
    </div>
  );
}

function countMatchedPresetDates(exceptions: ProductionCalendarException[]): number {
  const overrideDates = new Set(
    exceptions
      .filter((item) => item.resourceId === null && item.workingMinutes === 0)
      .map((item) => item.date)
  );
  return rfHolidays2026.filter((holiday) => overrideDates.has(holiday.date)).length;
}
