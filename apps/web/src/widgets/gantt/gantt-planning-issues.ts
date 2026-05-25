import { dateLabelToDayIndex } from "./gantt-dates";
import { wouldCreateCycle } from "./gantt-dependency-rules";
import type { GanttDependency, GanttPlanningIssue, GanttPlanningIssueType, GanttRow } from "./types";

export const PLANNING_ISSUE_LABELS: Record<GanttPlanningIssueType, string> = {
  invalid_date: "Некорректное значение",
  dependency_conflict: "Конфликт связей",
  resource_overload: "Перегруз ресурса",
  schedule_conflict: "Конфликт сроков",
  backend_pending: "Проверка планирования недоступна без серверного движка"
};

export function planningIssueLabel(type: GanttPlanningIssueType): string {
  if (type === "dependency_conflict") return "Ошибка планирования";
  if (type === "schedule_conflict") return "Конфликт сроков";
  if (type === "resource_overload") return "Перегруз ресурса";
  if (type === "invalid_date") return "Некорректное значение";
  return PLANNING_ISSUE_LABELS[type];
}

export function computeRowPlanningIssues(
  row: GanttRow,
  rows: GanttRow[],
  dependencies: GanttDependency[]
): GanttPlanningIssue[] {
  const issues: GanttPlanningIssue[] = [];

  if (row.scheduleState === "overdue") {
    issues.push({ type: "schedule_conflict", message: "Конфликт сроков", field: "finish" });
  }

  if (row.assignee && row.kind === "task") {
    const sameResource = rows.filter(
      (r) => r.id !== row.id && r.kind === "task" && r.assignee?.initials === row.assignee?.initials
    );
    const overlap = sameResource.some((other) => {
      const a0 = row.startDay;
      const a1 = row.startDay + row.durationDays;
      const b0 = other.startDay;
      const b1 = other.startDay + other.durationDays;
      return a0 < b1 && b0 < a1;
    });
    if (overlap) {
      issues.push({ type: "resource_overload", message: "Перегруз ресурса", field: "resource" });
    }
  }

  const preds = dependencies.filter((d) => d.toId === row.id);
  for (const dep of preds) {
    const from = rows.find((r) => r.id === dep.fromId);
    if (!from) continue;
    const lag = dep.lagDays ?? 0;
    const minStart = from.startDay + from.durationDays + lag;
    if (row.startDay < minStart && (dep.type ?? "FS") === "FS") {
      issues.push({
        type: "dependency_conflict",
        message: "Ошибка планирования",
        field: "predecessors"
      });
    }
    if (wouldCreateCycle(dependencies, dep.fromId, dep.toId)) {
      issues.push({ type: "dependency_conflict", message: "Конфликт связей" });
    }
  }

  return issues;
}

export function attachPlanningIssues(rows: GanttRow[], dependencies: GanttDependency[]): GanttRow[] {
  return rows.map((row) => ({
    ...row,
    planningIssues: computeRowPlanningIssues(row, rows, dependencies)
  }));
}

export function hasPlanningIssue(
  row: GanttRow,
  type?: GanttPlanningIssueType,
  field?: GanttPlanningIssue["field"]
): boolean {
  const list = row.planningIssues ?? [];
  return list.some((i) => (!type || i.type === type) && (!field || i.field === field));
}
