import { describe, expect, it } from "vitest";

import { buildMilestoneCommands } from "./schedule-milestone";

describe("buildMilestoneCommands", () => {
  it("removes resource load and atomically sets zero duration/work plus milestone kind", () => {
    expect(
      buildMilestoneCommands({
        taskId: "task-1",
        assignments: [{ id: "assignment-1" }, { id: "assignment-2" }]
      })
    ).toEqual([
      {
        type: "assignment.delete",
        payload: { assignmentId: "assignment-1" }
      },
      {
        type: "assignment.delete",
        payload: { assignmentId: "assignment-2" }
      },
      {
        type: "task.update_work_model",
        payload: {
          taskId: "task-1",
          taskType: "fixed_duration",
          effortDriven: false,
          durationMinutes: 0,
          workMinutes: 0
        }
      },
      {
        type: "task.update_custom_field",
        payload: {
          taskId: "task-1",
          fieldKey: "kind",
          value: "milestone"
        }
      }
    ]);
  });
});
