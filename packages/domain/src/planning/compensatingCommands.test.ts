import { describe, expect, it } from "vitest";
import type { PlanSnapshot, PlanTask } from "./types";
import { buildCompensatingCommandBatch, buildCompensatingCommands } from "./compensatingCommands";

// BUG-PROJ-24: инверсия команды по снапшоту «до» возвращает прежние значения.
function snapshot(task: Partial<PlanTask>): PlanSnapshot {
  return {
    tenantId: "t",
    projectId: "p",
    planVersion: 1,
    project: { id: "p", sourceType: "opportunity", sourceOpportunityId: "o", plannedStart: "2026-06-01", plannedFinish: "2026-06-30", deadline: null, calendarId: "cal" },
    tasks: [
      {
        id: "task-a",
        parentTaskId: null,
        wbsCode: "1",
        title: "Старое имя",
        statusId: "task-status-new",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-02",
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 25,
        calendarId: "cal",
        constraint: null,
        ...task
      }
    ],
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}

describe("buildCompensatingCommands", () => {
  it("inverts task.update_progress to the previous percent", () => {
    const inverse = buildCompensatingCommands(
      { type: "task.update_progress", payload: { taskId: "task-a", percentComplete: 90 } },
      snapshot({ percentComplete: 25 })
    );
    expect(inverse).toEqual([{ type: "task.update_progress", payload: { taskId: "task-a", percentComplete: 25 } }]);
  });

  it("inverts task.update_identity to the previous title", () => {
    const inverse = buildCompensatingCommands(
      { type: "task.update_identity", payload: { taskId: "task-a", title: "Новое" } },
      snapshot({ title: "Старое имя" })
    );
    expect(inverse).toEqual([{ type: "task.update_identity", payload: { taskId: "task-a", title: "Старое имя" } }]);
  });

  it("reverses a milestone batch in reverse order and restores assignment and custom field", () => {
    const before = snapshot({ customFields: { kind: "task" } });
    before.assignments = [
      {
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-a",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      }
    ];

    const inverse = buildCompensatingCommandBatch(
      [
        {
          type: "assignment.delete",
          payload: { assignmentId: "assignment-a" }
        },
        {
          type: "task.update_work_model",
          payload: {
            taskId: "task-a",
            taskType: "fixed_duration",
            effortDriven: false,
            durationMinutes: 0,
            workMinutes: 0
          }
        },
        {
          type: "task.update_custom_field",
          payload: { taskId: "task-a", fieldKey: "kind", value: "milestone" }
        }
      ],
      before
    );

    expect(inverse.map((command) => command.type)).toEqual([
      "task.update_custom_field",
      "task.update_work_model",
      "assignment.upsert"
    ]);
    expect(inverse[0]).toMatchObject({
      payload: { taskId: "task-a", fieldKey: "kind", value: "task" }
    });
    expect(inverse[2]).toMatchObject({
      payload: { id: "assignment-a", resourceId: "resource-a", workMinutes: 480 }
    });
  });

  it("does not publish a partially reversible compensation batch", () => {
    expect(
      buildCompensatingCommandBatch(
        [
          { type: "task.update_progress", payload: { taskId: "task-a", percentComplete: 80 } },
          {
            type: "task.create",
            payload: {
              id: "task-new",
              projectId: "p",
              parentTaskId: null,
              title: "New",
              statusId: "s",
              plannedStart: null,
              plannedFinish: null,
              workMinutes: 0,
              assignments: []
            }
          }
        ],
        snapshot({})
      )
    ).toEqual([]);
  });
  it("returns no inverse for irreversible commands (create)", () => {
    const inverse = buildCompensatingCommands(
      {
        type: "task.create",
        payload: { id: "task-x", projectId: "p", parentTaskId: null, title: "X", statusId: "s", plannedStart: null, plannedFinish: null, workMinutes: 0, assignments: [] }
      },
      snapshot({})
    );
    expect(inverse).toEqual([]);
  });
});
