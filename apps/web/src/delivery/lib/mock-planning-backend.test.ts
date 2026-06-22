import { describe, it, expect } from "vitest";
import { createPlanningApiClient, PlanningApiError } from "@kiss-pm/planning-client";
import type { PlanningCommand } from "@kiss-pm/domain";

import { createMockPlanningFetch, MOCK_PROJECT_ID } from "./mock-planning-backend";

function client() {
  return createPlanningApiClient({ apiOrigin: "", fetchImpl: createMockPlanningFetch() });
}

describe("contract-mock planning backend (PM-as-code spine)", () => {
  it("serves a read-model with an engine-derived critical path", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    expect(rm.planVersion).toBe(17);
    expect(rm.engineVersion).toBe("planning-core-v1");
    const tasks = (rm.authored as { tasks: unknown[] }).tasks;
    expect(tasks.length).toBeGreaterThan(10);
    const crit = (rm.calculatedPlan as { criticalPathTaskIds: string[] }).criticalPathTaskIds;
    expect(crit.length).toBeGreaterThan(1); // путь, а не одна задача
  });

  it("previews a duration change with cascade and a plan-version bump", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const command = {
      type: "task.update_work_model",
      payload: { taskId: "t-1.1", taskType: "fixed_duration", effortDriven: false, durationMinutes: 30 * 480, workMinutes: 80 * 60 }
    } as PlanningCommand;
    const prev = await c.previewCommand(MOCK_PROJECT_ID, { command, clientPlanVersion: rm.planVersion });
    expect(prev.after.planVersion).toBe(rm.planVersion + 1);
    expect(prev.planDelta.changedTaskIds.length).toBeGreaterThan(1); // каскад на зависимые
  });

  it("rolls up summary work as the sum of its leaf descendants", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const tasks = (rm.authored as unknown as { tasks: Array<{ wbsCode: string; workMinutes: number; durationMinutes: number | null }> }).tasks;
    const summary = tasks.find((t) => t.wbsCode === "1")!; // Подготовка
    const leafSum = tasks.filter((t) => t.wbsCode.startsWith("1.") && t.durationMinutes !== null).reduce((a, k) => a + k.workMinutes, 0);
    expect(summary.workMinutes).toBe(leafSum);
  });

  it("rejects a dependency that would create a cycle (409 with a task-targeted issue)", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    // 1.1 → 1.2 уже есть; добавление 1.2 → 1.1 создаёт цикл
    await expect(
      c.applyCommand(MOCK_PROJECT_ID, {
        command: { type: "dependency.upsert", payload: { id: "dep-cycle", predecessorTaskId: "t-1.2", successorTaskId: "t-1.1", dependencyType: "FS", lagMinutes: 0 } } as PlanningCommand,
        clientPlanVersion: rm.planVersion
      })
    ).rejects.toMatchObject({ code: "planning_precondition_failed", body: { validationIssues: [{ code: "dependency_cycle_detected", entity: { id: "t-1.1" } }] } });
  });

  it("moves a task under another (indent) and renumbers wbs", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const res = await c.applyCommand(MOCK_PROJECT_ID, {
      command: { type: "task.move_wbs", payload: { taskId: "t-1.2", parentTaskId: "t-1.1", sortOrder: 0 } } as PlanningCommand,
      clientPlanVersion: rm.planVersion
    });
    const tasks = (res.readModel.authored as unknown as { tasks: Array<{ id: string; wbsCode: string; parentTaskId: string | null }> }).tasks;
    const moved = tasks.find((t) => t.id === "t-1.2")!;
    expect(moved.parentTaskId).toBe("t-1.1");
    expect(moved.wbsCode).toBe("1.1.1");
  });

  it("applies a batch of commands as a single plan-version bump", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const res = await c.applyCommandBatch(MOCK_PROJECT_ID, {
      commands: [
        { type: "task.update_progress", payload: { taskId: "t-1.1", percentComplete: 10 } },
        { type: "task.update_progress", payload: { taskId: "t-1.2", percentComplete: 20 } }
      ] as PlanningCommand[],
      clientPlanVersion: rm.planVersion
    });
    expect(res.newPlanVersion).toBe(rm.planVersion + 1);
  });

  it("applies a command, bumps the version, and rejects a stale version with 409", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const apply1 = await c.applyCommand(MOCK_PROJECT_ID, {
      command: { type: "task.update_progress", payload: { taskId: "t-3.2.1", percentComplete: 50 } } as PlanningCommand,
      clientPlanVersion: rm.planVersion
    });
    expect(apply1.newPlanVersion).toBe(rm.planVersion + 1);

    await expect(
      c.applyCommand(MOCK_PROJECT_ID, {
        command: { type: "task.update_progress", payload: { taskId: "t-3.2.1", percentComplete: 60 } } as PlanningCommand,
        clientPlanVersion: rm.planVersion // устаревшая версия
      })
    ).rejects.toBeInstanceOf(PlanningApiError);
  });
});
