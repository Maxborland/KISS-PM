import { describe, expect, it } from "vitest";

import type { PlanningCommand } from "@kiss-pm/domain";

import type { PlanningReadModel } from "../api/types";
import { buildCompensatingCommands } from "./buildCompensatingCommands";

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