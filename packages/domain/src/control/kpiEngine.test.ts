import { expect, test } from "vitest";

import type { CalculatedPlan, PlanSnapshot, ResourceLoadMatrix } from "../index";
import { buildProjectKpiMetrics } from "./kpiEngine";

const calculatedPlan = { projectFinish: null, criticalPathTaskIds: [] } as unknown as CalculatedPlan;
const resourceLoad = { overloads: [] } as unknown as ResourceLoadMatrix;

function snapshotWithTasks(tasks: Array<{ percentComplete: number; workMinutes: number }>): PlanSnapshot {
  return {
    baselines: [],
    project: { deadline: null },
    tasks
  } as unknown as PlanSnapshot;
}

// KPI-003: прогресс должен быть взвешен по трудоёмкости, а не «полностью закрытые / всего».
test("progress_percent взвешен по трудоёмкости, почти готовый проект не показывает 0%", () => {
  const snapshot = snapshotWithTasks([
    { percentComplete: 99, workMinutes: 900 },
    { percentComplete: 0, workMinutes: 100 }
  ]);
  const metrics = buildProjectKpiMetrics({ snapshot, calculatedPlan, resourceLoad });
  // Σ(pct·work)/Σ(work) = (0.99·900)/1000 = 89.1 → 89. Старый расчёт (закрытые/всего) дал бы 0.
  expect(metrics.progress_percent).toBe(89);
});

test("progress_percent падает на среднее percentComplete, когда трудоёмкость нигде не задана", () => {
  const snapshot = snapshotWithTasks([
    { percentComplete: 50, workMinutes: 0 },
    { percentComplete: 100, workMinutes: 0 }
  ]);
  const metrics = buildProjectKpiMetrics({ snapshot, calculatedPlan, resourceLoad });
  expect(metrics.progress_percent).toBe(75);
});

test("progress_percent = 0 для проекта без задач", () => {
  const metrics = buildProjectKpiMetrics({ snapshot: snapshotWithTasks([]), calculatedPlan, resourceLoad });
  expect(metrics.progress_percent).toBe(0);
});
