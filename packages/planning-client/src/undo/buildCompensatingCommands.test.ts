import { describe, expect, it } from "vitest";

import type { PlanningCommand } from "@kiss-pm/domain";

import type { PlanningReadModel } from "../api/types";
import { buildCompensatingCommands, buildCompensatingCommandBatch } from "./buildCompensatingCommands";

function readModel(): PlanningReadModel {
  return {
    authored: {
      tasks: [],
      dependencies: [],
      assignments: [{
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-a",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      }],
      assignmentAllocations: [{
        assignmentId: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-a",
        date: "2026-06-02",
        workMinutes: 480
      }],
      baselines: []
    }
  } as unknown as PlanningReadModel;
}

describe("client planning undo compensation", () => {
  it.each([
    {
      type: "assignment.upsert",
      payload: {
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-b",
        role: "executor",
        unitsPermille: 500,
        workMinutes: 240
      }
    },
    { type: "assignment.delete", payload: { assignmentId: "assignment-a" } }
  ] as PlanningCommand[])("restores allocation curves for $type", (command) => {
    expect(buildCompensatingCommands(command, readModel())).toEqual([
      {
        type: "assignment.upsert",
        payload: {
          id: "assignment-a",
          taskId: "task-a",
          resourceId: "resource-a",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 480
        }
      },
      {
        type: "assignment.allocations.replace",
        payload: {
          assignmentId: "assignment-a",
          allocations: [{ date: "2026-06-02", workMinutes: 480 }]
        }
      }
    ]);
  });
});

// Обратимость удаления задачи (Блок 9): компенсация для task.delete_or_archive должна
// пересоздать задачу со всеми её данными, чтобы «Откат» вернул ветку WBS.
function deletableReadModel(): PlanningReadModel {
  return {
    project: { id: "project-1", sourceType: "manual", sourceOpportunityId: null, plannedStart: "2026-06-01", plannedFinish: "2026-06-30", deadline: null, calendarId: "cal" },
    authored: {
      tasks: [
        { id: "parent", parentTaskId: null, wbsCode: "1", title: "Родитель", statusId: "todo", schedulingMode: "auto", taskType: "fixed_units", effortDriven: false, plannedStart: "2026-06-01", plannedFinish: "2026-06-10", durationMinutes: null, workMinutes: 0, percentComplete: 0, calendarId: "cal", constraint: null },
        { id: "task-a", parentTaskId: "parent", wbsCode: "1.1", title: "A", statusId: "in_progress", schedulingMode: "auto", taskType: "fixed_work", effortDriven: true, plannedStart: "2026-06-01", plannedFinish: "2026-06-02", durationMinutes: 480, workMinutes: 480, percentComplete: 40, calendarId: "cal", customFields: { risk: "high" }, constraint: { id: "c-a", taskId: "task-a", type: "start_no_earlier_than", date: "2026-06-01" } },
        { id: "task-b", parentTaskId: "parent", wbsCode: "1.2", title: "B", statusId: "todo", schedulingMode: "auto", taskType: "fixed_work", effortDriven: true, plannedStart: "2026-06-03", plannedFinish: "2026-06-04", durationMinutes: 480, workMinutes: 480, percentComplete: 0, calendarId: "cal", constraint: null }
      ],
      dependencies: [
        { id: "dep-ab", predecessorTaskId: "task-a", successorTaskId: "task-b", type: "FS", lagMinutes: 0 }
      ],
      assignments: [
        { id: "asg-a", taskId: "task-a", resourceId: "res-1", role: "executor", unitsPermille: 1000, workMinutes: 480, calendarId: null }
      ],
      assignmentAllocations: [
        { assignmentId: "asg-a", taskId: "task-a", resourceId: "res-1", date: "2026-06-01", workMinutes: 480 }
      ],
      baselines: []
    }
  } as unknown as PlanningReadModel;
}

describe("client planning undo — task.delete_or_archive reversal", () => {
  const deleteA: PlanningCommand = { type: "task.delete_or_archive", payload: { taskId: "task-a", mode: "delete" } };

  it("пересоздаёт удалённую задачу с назначением, распределением, прогрессом, моделью труда и связью", () => {
    const inverse = buildCompensatingCommands(deleteA, deletableReadModel());
    const create = inverse.find((command) => command.type === "task.create");
    expect(create).toMatchObject({
      type: "task.create",
      payload: {
        id: "task-a",
        projectId: "project-1",
        parentTaskId: "parent",
        title: "A",
        statusId: "in_progress",
        workMinutes: 480,
        assignments: [{ id: "asg-a", resourceId: "res-1", role: "executor", unitsPermille: 1000, workMinutes: 480 }]
      }
    });
    expect(inverse).toContainEqual({ type: "task.update_work_model", payload: { taskId: "task-a", taskType: "fixed_work", effortDriven: true, durationMinutes: 480, workMinutes: 480 } });
    expect(inverse).toContainEqual({ type: "task.update_progress", payload: { taskId: "task-a", percentComplete: 40 } });
    expect(inverse).toContainEqual({ type: "task.update_custom_field", payload: { taskId: "task-a", fieldKey: "risk", value: "high" } });
    expect(inverse).toContainEqual({ type: "assignment.allocations.replace", payload: { assignmentId: "asg-a", allocations: [{ date: "2026-06-01", workMinutes: 480 }] } });
    expect(inverse).toContainEqual({ type: "dependency.upsert", payload: { id: "dep-ab", predecessorTaskId: "task-a", successorTaskId: "task-b", dependencyType: "FS", lagMinutes: 0 } });
    expect(inverse).toContainEqual({ type: "constraint.update", payload: { taskId: "task-a", constraintId: "c-a", type: "start_no_earlier_than", date: "2026-06-01" } });
  });

  it("для удаления поддерева выносит все task.create вперёд связей (иначе связь сослалась бы на несозданную задачу)", () => {
    // удаление summary шлётся листья→корень; батч переворачивает в корень→листья
    const batch: PlanningCommand[] = [
      { type: "task.delete_or_archive", payload: { taskId: "task-a", mode: "delete" } },
      { type: "task.delete_or_archive", payload: { taskId: "task-b", mode: "delete" } },
      { type: "task.delete_or_archive", payload: { taskId: "parent", mode: "delete" } }
    ];
    const inverse = buildCompensatingCommandBatch(batch, deletableReadModel());
    const firstNonCreate = inverse.findIndex((command) => command.type !== "task.create");
    const lastCreate = inverse.map((command) => command.type).lastIndexOf("task.create");
    expect(lastCreate).toBeLessThan(firstNonCreate);
    // родитель создаётся раньше детей (parentTaskId уже существует к моменту вставки ребёнка)
    const createIds = inverse.filter((command) => command.type === "task.create").map((command) => (command as Extract<PlanningCommand, { type: "task.create" }>).payload.id);
    expect(createIds).toEqual(["parent", "task-b", "task-a"]);
  });

  it("не оставляет пустой компенсации: удаление задачи откатывается (canUndo включён)", () => {
    expect(buildCompensatingCommandBatch([deleteA], deletableReadModel()).length).toBeGreaterThan(0);
  });
});