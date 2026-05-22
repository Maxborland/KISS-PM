import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PlanningTaskInspector,
  buildTaskInspectorIntent,
  createTaskInspectorDraft
} from "./PlanningTaskInspector";
import { mapPlanningReadModelToGanttViewModel } from "./planningReadModelMapper";
import { createPlanningReadModelFixture } from "./planningReadModel.test-utils";

const task = firstTask();

describe("PlanningTaskInspector", () => {
  it("renders a selected task with real preview actions and disabled reasons", () => {
    const html = renderToStaticMarkup(
      <PlanningTaskInspector
        task={task}
        taskStatuses={[activeTaskStatus, reviewTaskStatus]}
        canManagePlan={false}
        isPreviewPending={false}
        onIntent={() => undefined}
      />
    );

    expect(html).toContain("Инспектор задачи");
    expect(html).toContain("Подготовка");
    expect(html).toContain("tenant.project_plan.manage");
    expect(html).toContain("Preview дат");
    expect(html).toContain("Preview статуса");
  });

  it("builds task status and schedule intents from inspector draft without applying locally", () => {
    const statusDraft = createTaskInspectorDraft(task);
    statusDraft.statusId = "task-status-review";

    expect(buildTaskInspectorIntent("status", statusDraft, task)).toEqual({
      type: "task.status.update",
      taskId: "task-a",
      statusId: "task-status-review"
    });

    const scheduleDraft = createTaskInspectorDraft(task);
    scheduleDraft.plannedStart = "2026-06-02";
    scheduleDraft.plannedFinish = "2026-06-04";

    expect(buildTaskInspectorIntent("schedule", scheduleDraft, task)).toEqual({
      type: "task.schedule.drag",
      taskId: "task-a",
      plannedStart: "2026-06-02",
      plannedFinish: "2026-06-04"
    });
  });

  it("does not emit a work-model intent when the draft is unchanged", () => {
    const draft = createTaskInspectorDraft(task);

    expect(buildTaskInspectorIntent("work", draft, task)).toBeNull();
  });
});

const activeTaskStatus = {
  id: "task-status-active",
  tenantId: "tenant-alpha",
  name: "В работе",
  category: "in_progress" as const,
  sortOrder: 10,
  status: "active" as const,
  isSystem: true,
  createdAt: "2026-05-22T00:00:00.000Z",
  updatedAt: "2026-05-22T00:00:00.000Z"
};

const reviewTaskStatus = {
  ...activeTaskStatus,
  id: "task-status-review",
  name: "На проверке",
  category: "review" as const,
  sortOrder: 20
};

function firstTask() {
  const candidate = mapPlanningReadModelToGanttViewModel(createPlanningReadModelFixture()).tasks[0];
  if (!candidate) throw new Error("Planning task fixture must include one task");
  return candidate;
}
