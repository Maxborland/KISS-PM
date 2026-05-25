import type {
  GanttCellField,
  GanttPlanningIssue,
  GanttPlanningIssueType,
  GanttRow
} from "./types";

export type GanttIssueSeverity = "info" | "warning" | "danger";

const SEVERITY_ORDER: Record<GanttIssueSeverity, number> = {
  info: 0,
  warning: 1,
  danger: 2
};

const SEVERITY_BY_TYPE: Record<GanttPlanningIssueType, GanttIssueSeverity> = {
  invalid_date: "danger",
  dependency_conflict: "warning",
  resource_overload: "warning",
  schedule_conflict: "warning",
  backend_pending: "info"
};

export function issueSeverity(type: GanttPlanningIssueType): GanttIssueSeverity {
  return SEVERITY_BY_TYPE[type];
}

export function worstIssueSeverity(issues: GanttPlanningIssue[]): GanttIssueSeverity | undefined {
  if (!issues.length) return undefined;
  return issues.reduce<GanttIssueSeverity>((worst, issue) => {
    const next = issueSeverity(issue.type);
    return SEVERITY_ORDER[next] > SEVERITY_ORDER[worst] ? next : worst;
  }, issueSeverity(issues[0]!.type));
}

export function issueForRowField(row: GanttRow, field?: GanttCellField): GanttPlanningIssue | undefined {
  const list = row.planningIssues ?? [];
  if (!list.length) return undefined;
  if (!field) return list[0];
  return list.find((i) => !i.field || i.field === field) ?? list[0];
}

export function issueCellClass(issue: GanttPlanningIssue | undefined): string | undefined {
  if (!issue) return undefined;
  return `gantt2__cell--issue-${issueSeverity(issue.type)}`;
}

export function issueClassForRow(row: GanttRow, field?: GanttCellField): string | undefined {
  return issueCellClass(issueForRowField(row, field));
}

export function barIssueClass(row: GanttRow): string | undefined {
  const severity = worstIssueSeverity(row.planningIssues ?? []);
  if (!severity) return undefined;
  return `gbar--issue-${severity}`;
}

/** Calm left stripe on WBS row number when any planning issue exists. */
export function rowPlanningIssueStripeClass(row: GanttRow): string | undefined {
  const severity = worstIssueSeverity(row.planningIssues ?? []);
  if (!severity) return undefined;
  return `gantt2__row--planning-issue-${severity}`;
}

/** Drawer alert block — soft tint + left stripe per worst severity. */
export function drawerIssueBlockClass(row: GanttRow): string | undefined {
  const severity = worstIssueSeverity(row.planningIssues ?? []);
  if (!severity) return undefined;
  return `gantt2__drawer-issues--${severity}`;
}
