"use client";

import type { ResourceMatrixDayLoad } from "./useMonthlyResourceMatrix";

export function ResourceMatrixCell(props: {
  cell: ResourceMatrixDayLoad;
  resourceId: string | null;
  onActivate: (input: { resourceId: string; date: string }) => void;
  onHover: (input: { resourceId: string; date: string } | null) => void;
}) {
  const className = buildCellClassName(props.cell);
  const titleParts: string[] = [];
  titleParts.push(formatMinutes(props.cell.workMinutes));
  titleParts.push(`/ ${formatMinutes(props.cell.capacityMinutes)}`);
  if (props.cell.isHoliday) titleParts.push("праздник");
  if (props.cell.isOverload) titleParts.push("перегруз");

  return (
    <button
      type="button"
      className={className}
      data-testid={`resource-matrix-cell-${props.resourceId ?? "agg"}-${props.cell.date}`}
      title={titleParts.join(" · ")}
      onMouseEnter={() => {
        if (!props.resourceId) return;
        props.onHover({ resourceId: props.resourceId, date: props.cell.date });
      }}
      onMouseLeave={() => props.onHover(null)}
      onFocus={() => {
        if (!props.resourceId) return;
        props.onHover({ resourceId: props.resourceId, date: props.cell.date });
      }}
      onBlur={() => props.onHover(null)}
      onClick={() => {
        if (!props.resourceId) return;
        props.onActivate({ resourceId: props.resourceId, date: props.cell.date });
      }}
      disabled={!props.resourceId}
    >
      {props.cell.workMinutes > 0
        ? Math.round((props.cell.workMinutes / 60) * 10) / 10
        : ""}
    </button>
  );
}

function buildCellClassName(cell: ResourceMatrixDayLoad): string {
  const classes = ["planning-resource-matrix__cell"];
  if (cell.isOverload) classes.push("is-overload");
  else if (cell.heat === 1) classes.push("is-heat-1");
  else if (cell.heat === 2) classes.push("is-heat-2");
  else if (cell.heat === 3) classes.push("is-heat-3");
  if (cell.isHoliday) classes.push("is-holiday");
  else if (cell.isWeekend) classes.push("is-weekend");
  return classes.join(" ");
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0 ч";
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)} ч`;
  return `${Math.round(hours * 10) / 10} ч`;
}
