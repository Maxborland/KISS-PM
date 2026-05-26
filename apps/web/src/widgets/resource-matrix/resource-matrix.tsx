"use client";

import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { DayHeadCell, DayValueCell } from "./cells";
import type { MatrixPercent, MatrixRow, ResourceMatrixData } from "./types";

function PercentCell({ p }: { p: MatrixPercent | undefined }) {
  if (!p) return <div className="rmatrix__cell rmatrix__cell--pct" />;
  const tone =
    p.level === "low"
      ? "rmatrix__cell--pct-low"
      : p.level === "mid"
        ? "rmatrix__cell--pct-mid"
        : p.level === "high"
          ? "rmatrix__cell--pct-high"
          : p.level === "over"
            ? "rmatrix__cell--pct-over"
            : "rmatrix__cell--pct-norm";
  return <div className={cn("rmatrix__cell rmatrix__cell--pct", tone)}>{p.value}%</div>;
}

function NameCell({ row }: { row: MatrixRow }) {
  return (
    <div className={cn("rmatrix__cell rmatrix__cell--name")}>
      {row.indent ? (
        <span className={cn("wbs-indent", `wbs-indent--${row.indent}`)} aria-hidden />
      ) : null}
      {row.collapsible ? (
        <button
          type="button"
          className="rmatrix__toggle"
          aria-label={`Свернуть ${row.name}`}
        >
          <ChevronRight className="size-3" aria-hidden />
        </button>
      ) : null}
      {row.avatar ? (
        <span className={cn("rmatrix__avatar", `rmatrix__avatar--${row.avatar.color}`)}>
          {row.avatar.initials}
        </span>
      ) : null}
      <span className="rmatrix__name-text">{row.name}</span>
    </div>
  );
}

export type ResourceMatrixProps = {
  data: ResourceMatrixData;
  className?: string;
};

export function ResourceMatrix({ data, className }: ResourceMatrixProps) {
  const totalDays = data.days.length;
  const gridCols = `240px 56px repeat(${totalDays}, minmax(28px, 1fr))`;
  return (
    <div className={cn("rmatrix", className)} role="table" aria-label="Дневная матрица ресурсов">
      <div className="rmatrix__inner">
        <div
          className="rmatrix__row rmatrix__row--head"
          role="row"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="rmatrix__cell rmatrix__cell--name" role="columnheader">
            Сотрудник
          </div>
          <div className="rmatrix__cell rmatrix__cell--pct" role="columnheader">
            %
          </div>
          {data.days.map((d) => (
            <DayHeadCell key={d.day} day={d} />
          ))}
        </div>
        {data.rows.map((row) => (
          <div
            key={row.id}
            className={cn("rmatrix__row", `rmatrix__row--${row.kind}`)}
            role="row"
            style={{ gridTemplateColumns: gridCols }}
          >
            <NameCell row={row} />
            <PercentCell p={row.percent} />
            {row.cells.map((cell, idx) => {
              const day = data.days[idx];
              return (
                <DayValueCell
                  key={idx}
                  cell={cell}
                  isToday={Boolean(day?.today)}
                  weekday={day?.weekdayShort ?? ""}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export type { ResourceMatrixData } from "./types";
