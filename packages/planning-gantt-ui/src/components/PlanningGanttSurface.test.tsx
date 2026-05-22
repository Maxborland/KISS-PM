import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanningGanttSurface } from "./PlanningGanttSurface";
import type { PlanningGanttViewModel } from "../types/viewModel";

describe("PlanningGanttSurface", () => {
  it("renders synchronized WBS rows, Gantt bars, baseline and dependencies from one view model", () => {
    const html = renderToStaticMarkup(
      <PlanningGanttSurface viewModel={viewModel} />
    );

    expect(html).toContain("data-plan-version=\"4\"");
    expect(html).toContain("data-task-id=\"task-a\"");
    expect(html).toContain("data-task-id=\"task-b\"");
    expect(html).toContain("data-dependency-id=\"dep-a-b\"");
    expect(html).toContain("planningGanttBaseline");
    expect(html).toContain("Критический путь");
    expect(html).toContain("Подготовка");
  });
});

const viewModel: PlanningGanttViewModel = {
  project: {
    id: "project-alpha",
    plannedStart: "2026-06-01",
    plannedFinish: "2026-06-30",
    deadline: null,
    calendarId: "calendar-project"
  },
  tasks: [
    {
      id: "task-a",
      parentTaskId: null,
      wbsCode: "1",
      title: "Подготовка",
      statusId: "todo",
      schedulingMode: "auto",
      taskType: "fixed_units",
      effortDriven: false,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-03",
      durationMinutes: 1440,
      workMinutes: 960,
      percentComplete: 50,
      baselineStart: "2026-06-01",
      baselineFinish: "2026-06-02",
      baselineWorkMinutes: 960,
      startVarianceDays: 0,
      finishVarianceDays: 1,
      workVarianceMinutes: 0,
      isSummary: false,
      isMilestone: false,
      isCritical: true,
      slackMinutes: 0,
      validationIssueIds: []
    },
    {
      id: "task-b",
      parentTaskId: null,
      wbsCode: "2",
      title: "Запуск",
      statusId: "todo",
      schedulingMode: "auto",
      taskType: "fixed_units",
      effortDriven: false,
      plannedStart: "2026-06-04",
      plannedFinish: "2026-06-05",
      durationMinutes: 960,
      workMinutes: 480,
      percentComplete: 0,
      baselineStart: null,
      baselineFinish: null,
      baselineWorkMinutes: null,
      startVarianceDays: null,
      finishVarianceDays: null,
      workVarianceMinutes: null,
      isSummary: false,
      isMilestone: false,
      isCritical: false,
      slackMinutes: 480,
      validationIssueIds: []
    }
  ],
  dependencies: [
    {
      id: "dep-a-b",
      predecessorTaskId: "task-a",
      successorTaskId: "task-b",
      type: "FS",
      lagMinutes: 0,
      valid: true,
      issueCodes: []
    }
  ],
  baselines: [],
  validationIssues: [],
  resourceLoadBuckets: [],
  planVersion: 4,
  engineVersion: "planning-core-v1"
};
