"use client";

import { ChevronRight } from "lucide-react";

import { CapacityBar } from "@/components/domain/capacity-bar";
import { ParticipantList } from "@/components/domain/participant-list";
import { cn } from "@/lib/cn";
import { DayHeadCell, DayValueCell } from "./cells";
import type { MatrixRow, ResourceMatrixData } from "./types";

function PercentCell({ row }: { row: MatrixRow }) {
  const p = row.percent;
  if (!p) return <div className="rmatrix__cell rmatrix__cell--pct" />;
  if (row.kind === "person" && row.avatar) {
    return (
      <div className={cn("rmatrix__cell", "rmatrix__cell--pct", "rmatrix__cell--pct-bar")}>
        <CapacityBar label="" used={p.value} capacity={100} className="rmatrix__capacity" />
      </div>
    );
  }
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
  return <div className={cn("rmatrix__cell", "rmatrix__cell--pct", tone)}>{p.value}%</div>;
}

function NameCell({ row }: { row: MatrixRow }) {
  return (
    <div className={cn("rmatrix__cell", "rmatrix__cell--name", `rmatrix__cell--name-${row.kind}`)}>
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
      {row.kind === "person" && row.avatar ? (
        <ParticipantList
          participants={[
            {
              id: row.id,
              name: row.name,
              initials: row.avatar.initials
            }
          ]}
          maxAvatars={1}
          layout="compact"
        />
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
            <PercentCell row={row} />
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
