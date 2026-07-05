import { describe, expect, it } from "vitest";
import type { PlanSnapshot, PlanTask } from "@kiss-pm/domain";

import { previewPlanningCommand } from "./planningCommandCore";

// Регресс BUG-PROJ-23 (робастность preview-scoping): пре-существующая ошибка плана
// (invalid_work_model у другой задачи) НЕ должна блокировать несвязанную команду;
// команда, ВНОСЯЩАЯ ошибку, — блокируется.
function task(id: string, over: Partial<PlanTask> = {}): PlanTask {
  return {
    id,
    parentTaskId: null,
    wbsCode: id,
    title: id,
    statusId: "task-status-new",
    schedulingMode: "auto",
    taskType: "fixed_units",
    effortDriven: false,
    plannedStart: "2026-06-01",
    plannedFinish: null,
    durationMinutes: 480,
    workMinutes: 480,
    percentComplete: 0,
    calendarId: "calendar-default",
    constraint: null,
    ...over
  };
}

function snapshotWith(tasks: PlanTask[]): PlanSnapshot {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 1,
    project: {
      id: "project-alpha",
      sourceType: "opportunity",
      sourceOpportunityId: "opp",
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-30",
      deadline: "2026-06-30",
      calendarId: "calendar-default"
    },
    tasks,
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}

describe("previewPlanningCommand issue scoping", () => {
  it("does not block an unrelated command on a pre-existing plan error", () => {
    // task-bad: work>0, duration=0 → invalid_work_model (пре-существующая ошибка)
    const snapshot = snapshotWith([task("task-good"), task("task-bad", { durationMinutes: 0, workMinutes: 480 })]);
    const preview = previewPlanningCommand(snapshot, {
      type: "task.update_identity",
      payload: { taskId: "task-good", title: "Обновлённое имя" }
    });
    // пре-существующий invalid_work_model НЕ попадает в блокирующие issue команды
    expect(preview.validationIssues.some((i) => i.code === "invalid_work_model")).toBe(false);
  });

  it("blocks a command that introduces an error", () => {
    const snapshot = snapshotWith([task("task-good")]);
    // делаем task-good невалидной (work>0, duration=0) — команда ВНОСИТ ошибку
    const preview = previewPlanningCommand(snapshot, {
      type: "task.update_work_model",
      payload: { taskId: "task-good", taskType: "fixed_work", effortDriven: false, durationMinutes: 0, workMinutes: 480 }
    });
    // ошибка, внесённая командой, блокирует (precondition planning_command_invalid
    // ИЛИ движковый invalid_work_model — обе severity:error).
    expect(preview.validationIssues.some((i) => i.severity === "error")).toBe(true);
  });
});
