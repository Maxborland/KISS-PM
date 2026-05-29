"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { GanttDateField } from "./gantt-date-field";
import { GanttResourcePicker } from "./gantt-resource-picker";
import type { GanttResource } from "./gantt-resources";
import type { GanttCellField, GanttEditSession, GanttFocusCell, GanttRow } from "./types";

export function GanttGridCell({
  row,
  field,
  className,
  children,
  align = "left",
  mono,
  editable,
  selected,
  edit,
  focus,
  onFocus,
  onClick,
  onContextMenu,
  onDoubleClick,
  onCommit,
  onCancel,
  onDraftChange,
  onDateCommit,
  onAssignResource
}: {
  row: GanttRow;
  field: GanttCellField;
  className?: string;
  children: ReactNode;
  align?: "left" | "center" | "right";
  mono?: boolean;
  editable?: boolean;
  selected?: boolean;
  edit: GanttEditSession | null;
  focus: GanttFocusCell | null;
  onFocus?: () => void;
  onClick?: (event: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onCommit?: () => void;
  onCancel?: () => void;
  onDraftChange?: (value: string) => void;
  onDateCommit?: (label: string) => void;
  onAssignResource?: (resource: GanttResource | null) => void;
}) {
  const isEditing = edit?.rowId === row.id && edit.field === field;
  const isFocused = focus?.rowId === row.id && focus.field === field;
  const useDatePicker = isEditing && (field === "start" || field === "finish");
  const useResourcePicker = isEditing && field === "resource";

  return (
    <div
      role="gridcell"
      tabIndex={editable ? 0 : -1}
      className={cn(
        "gantt2__cell",
        align === "center" && "gantt2__cell--center",
        align === "right" && "gantt2__cell--right",
        mono && "gantt2__cell--mono",
        isFocused && "gantt2__cell--focus",
        selected && "gantt2__cell--selected",
        isEditing && "gantt2__cell--editing",
        edit?.error && isEditing && "gantt2__cell--error",
        editable && "gantt2__cell--editable",
        className
      )}
      onFocus={onFocus}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(event);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (editable) onDoubleClick?.();
      }}
      onKeyDown={(event) => {
        if (!isEditing) {
          if (event.key === "Enter" || event.key === "F2") {
            event.preventDefault();
            onDoubleClick?.();
          }
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit?.();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel?.();
        }
      }}
    >
      {isEditing && useDatePicker ? (
        <GanttDateField
          className="gantt2__cell-input gantt2__cell-input--date"
          value={edit.draft}
          ariaLabel={`Редактирование ${field}`}
          onChange={(label) => onDraftChange?.(label)}
          onBlurCommit={(label) => onDateCommit?.(label)}
        />
      ) : isEditing && useResourcePicker ? (
        <GanttResourcePicker
          value={edit.draft}
          triggerClassName="gantt2__cell-input"
          onAssign={(resource) => {
            onAssignResource?.(resource);
            onCancel?.();
          }}
        />
      ) : isEditing ? (
        <input
          className="gantt2__cell-input"
          value={edit.draft}
          aria-label={`Редактирование ${field}`}
          aria-invalid={Boolean(edit.error)}
          onChange={(e) => onDraftChange?.(e.target.value)}
          onBlur={onCommit}
          autoFocus
        />
      ) : (
        children
      )}
      {edit?.error && isEditing ? <span className="gantt2__cell-error">{edit.error}</span> : null}
    </div>
  );
}
