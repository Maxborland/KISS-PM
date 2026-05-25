import { describe, expect, it } from "vitest";

import {
  barIssueClass,
  drawerIssueBlockClass,
  issueCellClass,
  issueClassForRow,
  issueSeverity,
  rowPlanningIssueStripeClass,
  worstIssueSeverity
} from "./gantt-issue-styling";
import type { GanttPlanningIssue, GanttRow } from "./types";

const baseRow = (issues?: GanttPlanningIssue[]): GanttRow => ({
  id: "t1",
  level: 1,
  kind: "task",
  name: "Task",
  startDay: 0,
  durationDays: 2,
  ...(issues ? { planningIssues: issues } : {})
});

describe("gantt issue styling", () => {
  it("maps issue types to severity", () => {
    expect(issueSeverity("resource_overload")).toBe("warning");
    expect(issueSeverity("invalid_date")).toBe("danger");
    expect(issueSeverity("backend_pending")).toBe("info");
  });

  it("returns calm cell class names", () => {
    const issue: GanttPlanningIssue = { type: "schedule_conflict", message: "Конфликт сроков" };
    expect(issueCellClass(issue)).toBe("gantt2__cell--issue-warning");
  });

  it("picks field-specific cell class", () => {
    const row = baseRow([
      { type: "schedule_conflict", message: "Конфликт", field: "finish" },
      { type: "resource_overload", message: "Перегруз", field: "resource" }
    ]);
    expect(issueClassForRow(row, "finish")).toBe("gantt2__cell--issue-warning");
    expect(issueClassForRow(row, "resource")).toBe("gantt2__cell--issue-warning");
  });

  it("uses worst severity for bar and drawer chrome", () => {
    const row = baseRow([
      { type: "backend_pending", message: "Ожидание" },
      { type: "invalid_date", message: "Дата" }
    ]);
    expect(worstIssueSeverity(row.planningIssues!)).toBe("danger");
    expect(barIssueClass(row)).toBe("gbar--issue-danger");
    expect(drawerIssueBlockClass(row)).toBe("gantt2__drawer-issues--danger");
    expect(rowPlanningIssueStripeClass(row)).toBe("gantt2__row--planning-issue-danger");
  });
});
