import { dayIndexToDateLabel, finishDayIndex } from "./gantt-dates";
import {
  parseWorkHoursInput,
  updateTaskDuration,
  updateTaskFinishDate,
  updateTaskStartDate,
  updateTaskWorkHours
} from "./gantt-effort";
import { parseDurationDays, parseProgressPercent } from "./gantt-validation";
import type { GanttCellField, GanttRow } from "./types";

export function cellDraft(row: GanttRow, field: GanttCellField): string {
  switch (field) {
    case "name":
      return row.name;
    case "duration":
      return row.kind === "milestone" ? "0" : String(row.durationDays);
    case "progress":
      return `${Math.round((row.progress ?? 0) * 100)}`;
    case "start":
      return dayIndexToDateLabel(row.startDay);
    case "finish":
      return dayIndexToDateLabel(finishDayIndex(row));
    case "predecessors":
      return row.predecessors === "—" ? "" : (row.predecessors ?? "");
    case "resource":
      return row.assignee?.initials ?? "";
    case "work": {
      const h = row.workHours ?? (row.kind === "task" ? row.durationDays * (row.hoursPerDay ?? 8) : 0);
      return String(h);
    }
    case "notes":
      return row.notes ?? "";
    default:
      return "";
  }
}

export function applyCellCommit(row: GanttRow, field: GanttCellField, draft: string): GanttRow {
  switch (field) {
    case "name":
      return { ...row, name: draft.trim() };
    case "duration":
      return updateTaskDuration(row, parseDurationDays(draft, row));
    case "progress":
      return { ...row, progress: parseProgressPercent(draft) };
    case "start": {
      return updateTaskStartDate(row, draft) ?? row;
    }
    case "finish": {
      return updateTaskFinishDate(row, draft) ?? row;
    }
    case "work": {
      const hours = parseWorkHoursInput(draft);
      if (hours === null) return row;
      return updateTaskWorkHours(row, hours);
    }
    case "resource": {
      const initials = draft.trim();
      if (!initials) {
        const { assignee: _removed, ...rest } = row;
        return rest;
      }
      return { ...row, assignee: { initials, color: row.assignee?.color ?? "c1" } };
    }
    case "notes": {
      const text = draft.trim();
      if (!text) {
        const { notes: _removed, ...rest } = row;
        return rest;
      }
      return { ...row, notes: text };
    }
    default:
      return row;
  }
}
