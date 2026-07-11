export type OverviewTaskStatusCategory = "done" | "in_progress" | "other";

export function overviewTaskStatusCategory(statusId: string): OverviewTaskStatusCategory {
  const normalized = statusId.replace(/^task-status-/, "").replaceAll("-", "_");
  if (normalized === "done") return "done";
  if (normalized === "in_progress") return "in_progress";
  return "other";
}

export function isOverviewDoneStatus(statusId: string): boolean {
  return overviewTaskStatusCategory(statusId) === "done";
}

export function isOverviewInProgressStatus(statusId: string): boolean {
  return overviewTaskStatusCategory(statusId) === "in_progress";
}
