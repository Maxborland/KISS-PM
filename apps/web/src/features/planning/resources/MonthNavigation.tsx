"use client";

const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

export function MonthNavigation(props: {
  monthIso: string;
  onChange: (monthIso: string) => void;
}) {
  const [yearText, monthText] = props.monthIso.split("-");
  const year = Number.parseInt(yearText ?? "2026", 10);
  const monthIndex = Math.max(0, Math.min(11, Number.parseInt(monthText ?? "1", 10) - 1));

  return (
    <div className="planning-resource-matrix__nav" data-testid="planning-resource-matrix-nav">
      <button
        type="button"
        className="secondary-button"
        aria-label="Предыдущий месяц"
        onClick={() => props.onChange(shiftMonth(props.monthIso, -1))}
      >
        ‹
      </button>
      <strong>
        {MONTH_LABELS[monthIndex]} {year}
      </strong>
      <button
        type="button"
        className="secondary-button"
        aria-label="Следующий месяц"
        onClick={() => props.onChange(shiftMonth(props.monthIso, 1))}
      >
        ›
      </button>
      <button
        type="button"
        className="secondary-button"
        onClick={() => props.onChange(currentMonthIso())}
      >
        Сегодня
      </button>
    </div>
  );
}

function shiftMonth(monthIso: string, delta: number): string {
  const [yearText, monthText] = monthIso.split("-");
  const year = Number.parseInt(yearText ?? "2026", 10);
  const monthIndex = Number.parseInt(monthText ?? "1", 10) - 1;
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return toMonthIso(date);
}

export function currentMonthIso(): string {
  const now = new Date();
  return toMonthIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

function toMonthIso(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}
