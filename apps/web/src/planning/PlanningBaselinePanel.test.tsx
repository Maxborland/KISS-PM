import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanningBaselinePanel, summarizeBaselineComparison } from "./PlanningBaselinePanel";
import { createPlanningReadModelFixture } from "./planningReadModel.test-utils";

describe("PlanningBaselinePanel", () => {
  it("renders an explicit empty baseline state", () => {
    const html = renderToStaticMarkup(
      <PlanningBaselinePanel readModel={createPlanningReadModelFixture()} />
    );

    expect(html).toContain("Baseline пока не зафиксирован");
  });

  it("renders baseline variance summary and task rows from read model", () => {
    const html = renderToStaticMarkup(
      <PlanningBaselinePanel readModel={createPlanningReadModelFixture({
        baselineComparison: {
          baselineId: "baseline-a",
          capturedAt: "2026-06-01T00:00:00.000Z",
          tasks: [{
            taskId: "task-a",
            baselineStart: "2026-06-01",
            baselineFinish: "2026-06-02",
            baselineWorkMinutes: 480,
            currentStart: "2026-06-03",
            currentFinish: "2026-06-04",
            currentWorkMinutes: 600,
            startDeltaDays: 2,
            finishDeltaDays: 2,
            workDeltaMinutes: 120
          }]
        }
      })} />
    );

    expect(html).toContain("baseline-a");
    expect(html).toContain("Сдвиг старта");
    expect(html).toContain("+2 дн.");
    expect(html).toContain("+2 ч");
    expect(html).toContain("task-a");
  });

  it("summarizes nullable baseline deltas without inventing missing values", () => {
    expect(summarizeBaselineComparison([
      {
        taskId: "task-a",
        baselineStart: null,
        baselineFinish: null,
        baselineWorkMinutes: null,
        currentStart: "2026-06-01",
        currentFinish: "2026-06-02",
        currentWorkMinutes: 480,
        startDeltaDays: null,
        finishDeltaDays: 3,
        workDeltaMinutes: null
      }
    ])).toEqual({
      taskCount: 1,
      startVarianceDays: 0,
      finishVarianceDays: 3,
      workVarianceMinutes: 0
    });
  });
});
