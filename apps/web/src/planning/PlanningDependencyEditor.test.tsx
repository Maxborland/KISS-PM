import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PlanningDependencyEditor,
  buildDependencyDeleteIntent,
  buildDependencyDraft,
  buildDependencyUpsertIntent
} from "./PlanningDependencyEditor";
import type { PlanningGanttDependencyRow, PlanningGanttTaskRow } from "@kiss-pm/planning-gantt-ui";

describe("PlanningDependencyEditor", () => {
  it("renders selected task dependencies with Russian MS Project labels and permission reasons", () => {
    const html = renderToStaticMarkup(
      <PlanningDependencyEditor
        task={tasks[1] ?? null}
        tasks={tasks}
        dependencies={dependencies}
        canManagePlan={false}
        isPreviewPending={false}
        makeDependencyId={(prefix) => `${prefix}-generated`}
        onIntent={() => undefined}
      />
    );

    expect(html).toContain("Связи задачи");
    expect(html).toContain("Предшественники");
    expect(html).toContain("ОН / Finish-to-Start");
    expect(html).toContain("tenant.project_plan.manage");
    expect(html).toContain("Preview связи");
  });

  it("builds dependency upsert intents without applying schedule locally", () => {
    const task = secondTask();
    const draft = buildDependencyDraft(task, tasks, dependencies);
    draft.predecessorTaskId = "task-a";
    draft.dependencyType = "SS";
    draft.lagHours = "-2";

    expect(buildDependencyUpsertIntent(draft, task, dependencies, () => "dep-generated")).toEqual({
      type: "dependency.upsert",
      id: "dep-a-b",
      predecessorTaskId: "task-a",
      successorTaskId: "task-b",
      dependencyType: "SS",
      lagMinutes: -120
    });
  });

  it("builds dependency delete intents from an existing dependency id", () => {
    expect(buildDependencyDeleteIntent("dep-a-b")).toEqual({
      type: "dependency.delete",
      dependencyId: "dep-a-b"
    });
  });
});

const tasks: PlanningGanttTaskRow[] = [
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
    durationMinutes: 960,
    workMinutes: 960,
    percentComplete: 50,
    baselineStart: null,
    baselineFinish: null,
    baselineWorkMinutes: null,
    startVarianceDays: null,
    finishVarianceDays: null,
    workVarianceMinutes: null,
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
    durationMinutes: 480,
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
];

const dependencies: PlanningGanttDependencyRow[] = [{
  id: "dep-a-b",
  predecessorTaskId: "task-a",
  successorTaskId: "task-b",
  type: "FS",
  lagMinutes: 0,
  valid: true,
  issueCodes: []
}];

function secondTask(): PlanningGanttTaskRow {
  const task = tasks[1];
  if (!task) throw new Error("Dependency editor fixture must include a successor task");
  return task;
}
