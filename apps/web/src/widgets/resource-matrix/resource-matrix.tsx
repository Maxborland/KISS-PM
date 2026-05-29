"use client";

import { ChevronRight } from "lucide-react";

import { ParticipantList } from "@/components/domain/participant-list";
import { cn } from "@/lib/cn";
import { computePeriodPercent, personRowsInGroup } from "./aggregate-matrix";
import { DayHeadCell, DayValueCell } from "./cells";
import type { MatrixPercent, MatrixRow, ResourceMatrixData } from "./types";
import { useMatrixVisibleRows } from "./use-matrix-visible-rows";

function isAggregateRow(kind: MatrixRow["kind"]): boolean {
  return kind === "workshop" || kind === "role" || kind === "sub";
}

function percentToneClass(level: MatrixPercent["level"]): "norm" | "warn" | "over" {
  if (level === "over") return "over";
  if (level === "high") return "warn";
  return "norm";
}

function PercentCell({ row, days, allRows }: { row: MatrixRow; days: ResourceMatrixData["days"]; allRows: MatrixRow[] }) {
  const personRows = personRowsInGroup(row, allRows);
  if (personRows.length === 0) return <div className="rmatrix__cell rmatrix__cell--pct" />;

  const period = computePeriodPercent(personRows, days);
  const tone = percentToneClass(period.level);
  const display =
    Number.isInteger(period.value) ? `${period.value}%` : `${period.value.toFixed(1)}%`;

  return (
    <div
      className={cn("rmatrix__cell", "rmatrix__cell--pct", `rmatrix__cell--pct-${tone}`)}
      title={period.label}
    >
      <span className="rmatrix__pct-value mono">{display}</span>
    </div>
  );
}

function NameCell({
  row,
  depth,
  expanded,
  onToggle
}: {
  row: MatrixRow;
  depth: number;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className={cn("rmatrix__cell", "rmatrix__cell--name", `rmatrix__cell--name-${row.kind}`)}>
      <span className={cn("rmatrix__indent", `rmatrix__indent--${depth}`)} aria-hidden />
      {row.collapsible ? (
        <button
          type="button"
          className={cn("rmatrix__toggle", expanded && "rmatrix__toggle--open")}
          aria-expanded={expanded}
          aria-label={expanded ? `Свернуть ${row.name}` : `Развернуть ${row.name}`}
          onClick={() => onToggle(row.id)}
        >
          <ChevronRight className="size-3" aria-hidden />
        </button>
      ) : (
        <span className="rmatrix__toggle-spacer" aria-hidden />
      )}
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
  const { visible, toggle } = useMatrixVisibleRows(data.rows);
  const totalDays = data.days.length;
  const gridCols = `minmax(200px, 240px) 56px repeat(${totalDays}, minmax(28px, 1fr))`;

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
        {visible.map(({ row, depth, expanded }) => (
          <div
            key={row.id}
            className={cn(
              "rmatrix__row",
              `rmatrix__row--${row.kind}`,
              isAggregateRow(row.kind) && "rmatrix__row--aggregate"
            )}
            role="row"
            data-row-id={row.id}
            data-depth={depth}
            style={{ gridTemplateColumns: gridCols }}
          >
            <NameCell row={row} depth={depth} expanded={expanded} onToggle={toggle} />
            <PercentCell row={row} days={data.days} allRows={data.rows} />
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
