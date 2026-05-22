import { describe, expect, it } from "vitest";

import {
  detectDependencyCycles,
  getSuccessorStartCandidate,
  getTopologicalTaskOrder
} from "./dependencyGraph";
import type { PlanCalendar } from "./types";

const calendar: PlanCalendar = {
  id: "calendar-default",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480
};

describe("dependency graph", () => {
  it("orders tasks by dependencies instead of WBS input order", () => {
    expect(
      getTopologicalTaskOrder(["task-b", "task-a"], [
        {
          id: "dep-a-b",
          predecessorTaskId: "task-a",
          successorTaskId: "task-b",
          type: "FS",
          lagMinutes: 0
        }
      ])
    ).toEqual(["task-a", "task-b"]);
  });

  it("detects dependency cycles", () => {
    expect(
      detectDependencyCycles([
        { id: "dep-a-b", predecessorTaskId: "task-a", successorTaskId: "task-b", type: "FS", lagMinutes: 0 },
        { id: "dep-b-a", predecessorTaskId: "task-b", successorTaskId: "task-a", type: "FS", lagMinutes: 0 }
      ])
    ).toEqual([
      expect.objectContaining({
        taskIds: ["task-a", "task-b"],
        dependencyIds: expect.arrayContaining(["dep-a-b", "dep-b-a"])
      })
    ]);
  });

  it("maps FS, SS, FF and SF dependency types to successor start candidates", () => {
    const predecessorStart = { date: "2026-06-01", minuteOfDay: 0 };
    const predecessorFinish = { date: "2026-06-01", minuteOfDay: 480 };

    expect(
      getSuccessorStartCandidate({
        dependencyType: "FS",
        lagMinutes: 0,
        predecessorStart,
        predecessorFinish,
        successorDurationMinutes: 480,
        calendar,
        calendarExceptions: []
      })
    ).toEqual({ date: "2026-06-02", minuteOfDay: 0 });
    expect(
      getSuccessorStartCandidate({
        dependencyType: "SS",
        lagMinutes: 120,
        predecessorStart,
        predecessorFinish,
        successorDurationMinutes: 480,
        calendar,
        calendarExceptions: []
      })
    ).toEqual({ date: "2026-06-01", minuteOfDay: 120 });
    expect(
      getSuccessorStartCandidate({
        dependencyType: "FF",
        lagMinutes: 0,
        predecessorStart,
        predecessorFinish,
        successorDurationMinutes: 480,
        calendar,
        calendarExceptions: []
      })
    ).toEqual({ date: "2026-06-01", minuteOfDay: 0 });
    expect(
      getSuccessorStartCandidate({
        dependencyType: "SF",
        lagMinutes: 0,
        predecessorStart,
        predecessorFinish,
        successorDurationMinutes: 480,
        calendar,
        calendarExceptions: []
      })
    ).toEqual({ date: "2026-05-29", minuteOfDay: 0 });
  });
});
