"use client";

import type { ReactNode } from "react";
import { ChevronRight, GripVertical } from "lucide-react";

import { cn } from "@/lib/cn";
import { gridTemplateColumns, gridTotalWidth, sortColumns } from "./gantt-column-settings";
import { dayIndexToDateLabel, finishDayIndex } from "./gantt-dates";
import { GanttGridCell } from "./gantt-grid-cell";
import { issueClassForRow, rowPlanningIssueStripeClass } from "./gantt-issue-styling";
import { hasPlanningIssue, planningIssueLabel } from "./gantt-planning-issues";
import { workHoursLabel } from "./gantt-effort";
import { isCellInRange } from "./gantt-selection";
import type {
  GanttCellField,
  GanttColumnConfig,
  GanttColumnId,
  GanttContextTarget,
  GanttEditSession,
  GanttFocusCell,
  GanttCellRange,
  GanttRow,
  GanttRowDragState
} from "./types";

const COLUMN_LABELS: Record<GanttColumnId, { head: string; sub?: string }> = {
  num: { head: "#", sub: "№" },
  mode: { head: "Реж" },
  wbs: { head: "WBS" },
  name: { head: "Название задачи" },
  duration: { head: "Длит.", sub: "дни" },
  progress: { head: "% зав.", sub: "%" },
  start: { head: "Начало", sub: "дата" },
  finish: { head: "Окончание", sub: "дата" },
  predecessors: { head: "Предш.", sub: "#" },
  resource: { head: "Ресурсы" },
  work: { head: "Трудозатраты", sub: "ч" }
};

function pctLabel(progress: number | undefined) {
  return `${Math.round((progress ?? 0) * 100)}%`;
}

function durationLabel(row: GanttRow) {
  if (row.kind === "milestone") return "0д";
  return `${row.durationDays}д`;
}

function NameCellContent({ row, onToggleCollapse }: { row: GanttRow; onToggleCollapse?: () => void }) {
  const indent = row.level > 0 ? Math.min(row.level, 6) : 0;
  return (
    <>
      {indent > 0 ? <span className={cn("wbs-indent", `wbs-indent--${indent}`)} aria-hidden /> : null}
      {row.collapsible ? (
        <button
          type="button"
          className="wbs-toggle"
          aria-label={row.collapsed ? "Развернуть" : "Свернуть"}
          aria-expanded={!row.collapsed}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse?.();
          }}
        >
          <ChevronRight className={cn("size-3", !row.collapsed && "rotate-90")} aria-hidden />
        </button>
      ) : null}
      {row.kind === "summary" ? <strong className="wbs-name">{row.name}</strong> : <span className="wbs-name">{row.name}</span>}
    </>
  );
}

function IssueBadge({ row }: { row: GanttRow }) {
  const issue = row.planningIssues?.[0];
  if (!issue) return null;
  return (
    <span className="gantt2__issue-marker" aria-label={issue.message} title={planningIssueLabel(issue.type)} />
  );
}

export function GanttWbsGrid({
  rows,
  rowOrder,
  columns,
  interactive,
  selectedRowId,
  edit,
  focus,
  selection,
  rowDrag,
  link,
  onColumnResize,
  onColumnReorder,
  onRowHeaderClick,
  onRowDragStart,
  onRowDragOver,
  onRowDragEnd,
  onToggleCollapse,
  onContextMenu,
  cellBind,
  cellProps
}: {
  rows: GanttRow[];
  rowOrder: string[];
  columns: GanttColumnConfig[];
  interactive: boolean;
  selectedRowId?: string;
  edit: GanttEditSession | null;
  focus: GanttFocusCell | null;
  selection: GanttCellRange | null;
  rowDrag: GanttRowDragState | null;
  link: boolean;
  onColumnResize?: (id: GanttColumnId, width: number) => void;
  onColumnReorder?: (fromId: GanttColumnId, toId: GanttColumnId) => void;
  onRowHeaderClick?: (rowId: string) => void;
  onRowDragStart?: (rowId: string) => void;
  onRowDragOver?: (rowId: string) => void;
  onRowDragEnd?: () => void;
  onToggleCollapse?: (rowId: string) => void;
  onContextMenu: (event: React.MouseEvent, target: GanttContextTarget) => void;
  cellBind: (row: GanttRow, field: GanttCellField) => Record<string, unknown>;
  cellProps: {
    edit: GanttEditSession | null;
    focus: GanttFocusCell | null;
    onCommit?: () => void;
    onCancel?: () => void;
    onDraftChange?: (value: string) => void;
  };
}) {
  const sorted = sortColumns(columns);
  const gridStyle = {
    gridTemplateColumns: gridTemplateColumns(columns),
    width: gridTotalWidth(columns),
    minWidth: gridTotalWidth(columns)
  } as const;

  const renderHeaderCell = (col: GanttColumnConfig, sub?: boolean) => {
    const labels = COLUMN_LABELS[col.id];
    const label = sub ? labels.sub : labels.head;
    return (
      <div
        key={`${col.id}-${sub ? "sub" : "head"}`}
        className={cn(
          "gantt2__cell",
          col.id === "num" && "gantt2__cell--num",
          (col.id === "duration" || col.id === "progress" || col.id === "start" || col.id === "finish" || col.id === "predecessors" || col.id === "work") &&
            "gantt2__cell--center"
        )}
      >
        {label ?? ""}
        {interactive && !sub && onColumnResize ? (
          <span
            className="gantt2__col-resize"
            title="Изменить ширину столбца"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const startX = event.clientX;
              const startW = col.width;
              const onMove = (e: PointerEvent) => {
                onColumnResize(col.id, startW + (e.clientX - startX));
              };
              const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
          />
        ) : null}
        {interactive && !sub && onColumnReorder ? (
          <button
            type="button"
            className="gantt2__col-drag"
            title="Перетащить столбец"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/gantt-col", col.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData("text/gantt-col") as GanttColumnId;
              if (from) onColumnReorder(from, col.id);
            }}
          >
            ⋮
          </button>
        ) : null}
      </div>
    );
  };

  const renderCell = (row: GanttRow, colId: GanttColumnId): ReactNode => {
    const issueProps = (field?: GanttCellField) => {
      const className = issueClassForRow(row, field);
      return className ? { className } : {};
    };
    switch (colId) {
      case "num":
        return (
          <div
            key={colId}
            className={cn("gantt2__cell gantt2__cell--num gantt2__cell--row-head", issueClassForRow(row))}
            onClick={(event) => {
              event.stopPropagation();
              onRowHeaderClick?.(row.id);
            }}
          >
            {interactive ? (
              <button
                type="button"
                className="gantt2__row-handle"
                title="Перетащить строку"
                aria-label="Перетащить строку"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onRowDragStart?.(row.id);
                }}
                onPointerUp={() => onRowDragEnd?.()}
              >
                <GripVertical className="size-3" aria-hidden />
              </button>
            ) : null}
            <span>{rowOrder.indexOf(row.id) + 1}</span>
          </div>
        );
      case "mode":
        return (
          <div key={colId} className={cn("gantt2__cell", issueClassForRow(row))}>
            <span className="wbs-mode" title="Режим: автопланирование">
              А
            </span>
          </div>
        );
      case "wbs":
        return (
          <div key={colId} className={cn("gantt2__cell gantt2__cell--mono gantt2__cell--muted", issueClassForRow(row))}>
            {row.wbs ?? "—"}
          </div>
        );
      case "name":
        return (
          <GanttGridCell
            key={colId}
            row={row}
            field="name"
            editable={interactive}
            {...issueProps("name")}
            {...cellBind(row, "name")}
            {...cellProps}
          >
            <NameCellContent
              row={row}
              {...(row.collapsible && onToggleCollapse ? { onToggleCollapse: () => onToggleCollapse(row.id) } : {})}
            />
            <IssueBadge row={row} />
          </GanttGridCell>
        );
      case "duration":
        return (
          <GanttGridCell
            key={colId}
            row={row}
            field="duration"
            align="center"
            editable={interactive && row.kind !== "summary"}
            {...issueProps("duration")}
            {...cellBind(row, "duration")}
            {...cellProps}
          >
            {durationLabel(row)}
          </GanttGridCell>
        );
      case "progress":
        return (
          <GanttGridCell
            key={colId}
            row={row}
            field="progress"
            align="center"
            editable={interactive && row.kind === "task"}
            {...issueProps("progress")}
            {...cellBind(row, "progress")}
            {...cellProps}
          >
            {pctLabel(row.progress)}
          </GanttGridCell>
        );
      case "start":
        return (
          <GanttGridCell
            key={colId}
            row={row}
            field="start"
            align="center"
            mono
            editable={interactive && row.kind !== "summary"}
            {...issueProps("start")}
            {...cellBind(row, "start")}
            {...cellProps}
          >
            {dayIndexToDateLabel(row.startDay)}
          </GanttGridCell>
        );
      case "finish":
        return (
          <GanttGridCell
            key={colId}
            row={row}
            field="finish"
            align="center"
            mono
            editable={interactive && row.kind !== "summary"}
            {...issueProps("finish")}
            {...cellBind(row, "finish")}
            {...cellProps}
          >
            {dayIndexToDateLabel(finishDayIndex(row))}
          </GanttGridCell>
        );
      case "predecessors":
        return (
          <GanttGridCell
            key={colId}
            row={row}
            field="predecessors"
            align="center"
            mono
            editable={interactive}
            {...issueProps("predecessors")}
            {...cellBind(row, "predecessors")}
            {...cellProps}
          >
            {row.predecessors ?? "—"}
          </GanttGridCell>
        );
      case "resource":
        return (
          <GanttGridCell
            key={colId}
            row={row}
            field="resource"
            editable={interactive && row.kind === "task"}
            {...issueProps("resource")}
            {...cellBind(row, "resource")}
            {...cellProps}
          >
            {row.assignee ? row.assignee.initials : "—"}
          </GanttGridCell>
        );
      case "work":
        return (
          <GanttGridCell
            key={colId}
            row={row}
            field="work"
            align="center"
            editable={interactive && row.kind === "task"}
            {...issueProps("work")}
            {...cellBind(row, "work")}
            {...cellProps}
          >
            {workHoursLabel(row)}
          </GanttGridCell>
        );
      default:
        return null;
    }
  };

  return (
    <div className="gantt2__wbs" role="rowgroup" aria-label="Таблица WBS">
      <div className="gantt2__row gantt2__row--head1 gantt2__row--wbs" role="row" style={gridStyle}>
        {sorted.map((col) => renderHeaderCell(col, false))}
      </div>
      <div className="gantt2__row gantt2__row--head2 gantt2__row--wbs" role="row" style={gridStyle}>
        {sorted.map((col) => renderHeaderCell(col, true))}
      </div>
      {rows.map((row) => {
        const selected = row.id === selectedRowId;
        const dropBefore = rowDrag?.dropBeforeRowId === row.id && !rowDrag.invalid;
        return (
          <div
            key={row.id}
            className={cn(
              "gantt2__row gantt2__row--wbs",
              selected && "gantt2__row--selected",
              row.kind === "summary" && "gantt2__row--group",
              hasPlanningIssue(row) && "gantt2__row--planning-issue",
              rowPlanningIssueStripeClass(row),
              dropBefore && "gantt2__row--drop-before",
              rowDrag?.rowId === row.id && "gantt2__row--dragging"
            )}
            role="row"
            aria-selected={selected}
            style={gridStyle}
            onPointerEnter={() => {
              if (rowDrag) onRowDragOver?.(row.id);
            }}
            onContextMenu={(event) => onContextMenu(event, { kind: "row", rowId: row.id })}
          >
            {sorted.map((col) => renderCell(row, col.id))}
          </div>
        );
      })}
    </div>
  );
}
