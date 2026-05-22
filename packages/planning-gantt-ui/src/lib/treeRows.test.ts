import { describe, expect, it } from "vitest";

import {
  buildPlanningTreeIndex,
  computeFallbackWbsCodes,
  filterPlanningRowsByCollapsedState,
  flattenPlanningRows
} from "./treeRows";
import type { PlanningGanttTaskRow } from "../types/viewModel";

describe("planning tree rows", () => {
  it("sorts and flattens rows by backend WBS while preserving hierarchy depth", () => {
    const index = buildPlanningTreeIndex([
      task("task-b", "2", null),
      task("task-a-2", "1.2", "task-a"),
      task("task-a", "1", null),
      task("task-a-1", "1.1", "task-a")
    ]);

    expect(flattenPlanningRows(index)).toEqual([
      { id: "task-a", depth: 0, wbsCode: "1" },
      { id: "task-a-1", depth: 1, wbsCode: "1.1" },
      { id: "task-a-2", depth: 1, wbsCode: "1.2" },
      { id: "task-b", depth: 0, wbsCode: "2" }
    ]);
  });

  it("omits descendants under collapsed tasks", () => {
    const index = buildPlanningTreeIndex([
      task("task-a", "1", null),
      task("task-a-1", "1.1", "task-a"),
      task("task-b", "2", null)
    ]);

    expect(flattenPlanningRows(index, new Set(["task-a"]))).toEqual([
      { id: "task-a", depth: 0, wbsCode: "1" },
      { id: "task-b", depth: 0, wbsCode: "2" }
    ]);
  });

  it("filters visible Gantt rows with the same collapsed WBS state", () => {
    expect(
      filterPlanningRowsByCollapsedState([
        task("task-a", "1", null),
        task("task-a-1", "1.1", "task-a"),
        task("task-b", "2", null)
      ], new Set(["task-a"])).map((row) => row.id)
    ).toEqual(["task-a", "task-b"]);
  });

  it("computes fallback WBS for draft rows only from controlled hierarchy", () => {
    const fallback = computeFallbackWbsCodes([
      task("task-b", "", null),
      task("task-a", "", null),
      task("task-a-1", "", "task-a")
    ]);

    expect(Object.fromEntries(fallback)).toEqual({
      "task-a": "1",
      "task-a-1": "1.1",
      "task-b": "2"
    });
  });
});

function task(id: string, wbsCode: string, parentTaskId: string | null): PlanningGanttTaskRow {
  return {
    id,
    parentTaskId,
    wbsCode,
    title: id,
    statusId: "todo",
    schedulingMode: "auto",
    taskType: "fixed_units",
    effortDriven: false,
    plannedStart: null,
    plannedFinish: null,
    durationMinutes: null,
    workMinutes: 0,
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
    slackMinutes: null,
    validationIssueIds: []
  };
}
