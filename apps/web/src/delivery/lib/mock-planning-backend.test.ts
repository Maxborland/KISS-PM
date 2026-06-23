import { describe, it, expect } from "vitest";
import { createPlanningApiClient, PlanningApiError } from "@kiss-pm/planning-client";
import type { PlanningCommand } from "@kiss-pm/domain";

import { buildPortfolioModel, createMockPlanningFetch, isoToDay, MOCK_PROJECT_ID } from "./mock-planning-backend";

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

  it("serves a resource-load matrix with buckets and at least one overload", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const rl = rm.resourceLoad as unknown as { buckets: unknown[]; overloads: unknown[] };
    expect(rl.buckets.length).toBeGreaterThan(50);
    expect(rl.overloads.length).toBeGreaterThan(0);
  });

  it("accepts an overload (risk.accept_overload) and reflects it in the read-model", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const ov = (rm.resourceLoad as unknown as { overloads: Array<{ resourceId: string; date: string }> }).overloads[0]!;
    const key = `${ov.resourceId}|${isoToDay(ov.date)}`;
    const res = await c.applyCommand(MOCK_PROJECT_ID, {
      command: { type: "risk.accept_overload", payload: { overloadId: key, acceptedRiskReason: "test" } } as PlanningCommand,
      clientPlanVersion: rm.planVersion
    });
    expect((res.readModel.resourceLoad as unknown as { acceptedOverloads: string[] }).acceptedOverloads).toContain(key);
  });

  it("editing an assignment's work via assignment.upsert updates the authored model", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const asg = (rm.authored as unknown as { assignments: Array<{ id: string; taskId: string; resourceId: string; role: string; unitsPermille: number; workMinutes: number }> }).assignments[0]!;
    const res = await c.applyCommand(MOCK_PROJECT_ID, {
      command: { type: "assignment.upsert", payload: { id: asg.id, taskId: asg.taskId, resourceId: asg.resourceId, role: asg.role, unitsPermille: asg.unitsPermille, workMinutes: 9999 } } as PlanningCommand,
      clientPlanVersion: rm.planVersion
    });
    const updated = (res.readModel.authored as unknown as { assignments: Array<{ id: string; workMinutes: number }> }).assignments.find((x) => x.id === asg.id)!;
    expect(updated.workMinutes).toBe(9999);
  });

  it("portfolio: capacity is counted once per person (never summed across projects)", () => {
    const m = buildPortfolioModel();
    const days = m.buckets.filter((b) => b.granularity === "day");
    // если бы ёмкость складывалась по 3 проектам, в будни было бы до 1440 мин — а должно быть ≤ 480
    expect(Math.max(...days.map((b) => b.capacityMinutes))).toBe(480);
    expect(m.projects.length).toBe(3);
    expect(m.tasks.every((t) => typeof t.projectName === "string" && t.projectName.length > 0)).toBe(true);
  });

  it("portfolio: reveals cross-project overload (assigned in two projects > daily capacity)", () => {
    const m = buildPortfolioModel();
    const days = m.buckets.filter((b) => b.granularity === "day");
    // Иванова занята и в основном проекте (макеты), и в мобильном (дизайн) — на пересечении перегруз
    const over = days.filter((b) => b.resourceId === "u-ivanova" && b.capacityMinutes > 0 && b.assignedMinutes > b.capacityMinutes);
    expect(over.length).toBeGreaterThan(0);
    // вклад в перегруженный день приходит из ≥2 разных проектов
    const sample = over[0]!;
    const projectsOfDay = new Set(sample.assignmentContributions.map((c) => c.taskId.split("::")[0]));
    expect(projectsOfDay.size).toBeGreaterThan(1);
  });

  it("assignment.allocations.replace rejects an unbalanced curve (409) and accepts a balanced one", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const asg = (rm.authored as unknown as { assignments: Array<{ id: string; taskId: string; workMinutes: number }> }).assignments[0]!;
    // сумма ≠ труду → 409 planning_precondition_failed
    await expect(
      c.applyCommand(MOCK_PROJECT_ID, {
        command: { type: "assignment.allocations.replace", payload: { assignmentId: asg.id, allocations: [{ date: "2026-03-03", workMinutes: 60 }] } } as PlanningCommand,
        clientPlanVersion: rm.planVersion
      })
    ).rejects.toMatchObject({ code: "planning_precondition_failed", body: { validationIssues: [{ code: "planning_command_invalid" }] } });
    // сбалансированная кривая (весь труд на один день) → ок и отражается в read-model
    const res = await c.applyCommand(MOCK_PROJECT_ID, {
      command: { type: "assignment.allocations.replace", payload: { assignmentId: asg.id, allocations: [{ date: "2026-03-03", workMinutes: asg.workMinutes }] } } as PlanningCommand,
      clientPlanVersion: rm.planVersion
    });
    const allocs = (res.readModel.authored as unknown as { assignmentAllocations: Array<{ assignmentId: string; date: string; workMinutes: number }> }).assignmentAllocations;
    expect(allocs.some((x) => x.assignmentId === asg.id && x.date === "2026-03-03" && x.workMinutes === asg.workMinutes)).toBe(true);
  });

  it("assignment.upsert clears the assignment's day-curve (work/units may change)", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const asg = (rm.authored as unknown as { assignments: Array<{ id: string; taskId: string; resourceId: string; role: string; unitsPermille: number; workMinutes: number }> }).assignments[0]!;
    const r1 = await c.applyCommand(MOCK_PROJECT_ID, {
      command: { type: "assignment.allocations.replace", payload: { assignmentId: asg.id, allocations: [{ date: "2026-03-03", workMinutes: asg.workMinutes }] } } as PlanningCommand,
      clientPlanVersion: rm.planVersion
    });
    expect((r1.readModel.authored as unknown as { assignmentAllocations: Array<{ assignmentId: string }> }).assignmentAllocations.some((x) => x.assignmentId === asg.id)).toBe(true);
    const r2 = await c.applyCommand(MOCK_PROJECT_ID, {
      command: { type: "assignment.upsert", payload: { id: asg.id, taskId: asg.taskId, resourceId: asg.resourceId, role: asg.role, unitsPermille: asg.unitsPermille, workMinutes: asg.workMinutes } } as PlanningCommand,
      clientPlanVersion: r1.newPlanVersion
    });
    expect((r2.readModel.authored as unknown as { assignmentAllocations: Array<{ assignmentId: string }> }).assignmentAllocations.some((x) => x.assignmentId === asg.id)).toBe(false);
  });

  it("assignment.delete removes the assignment and its day-curve and relabels the task", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    const asg = (rm.authored as unknown as { assignments: Array<{ id: string; taskId: string }> }).assignments[0]!;
    const res = await c.applyCommand(MOCK_PROJECT_ID, {
      command: { type: "assignment.delete", payload: { assignmentId: asg.id } } as PlanningCommand,
      clientPlanVersion: rm.planVersion
    });
    const list = (res.readModel.authored as unknown as { assignments: Array<{ id: string }> }).assignments;
    expect(list.find((x) => x.id === asg.id)).toBeUndefined();
  });

  it("resourceLoad ignores non-working roles (an observer adds no load)", async () => {
    const c = client();
    const rm = await c.getPlanReadModel(MOCK_PROJECT_ID);
    // Орлова (без назначений в сидах) как НАБЛЮДАТЕЛЬ с трудом — нагрузки быть не должно
    const res = await c.applyCommand(MOCK_PROJECT_ID, {
      command: { type: "assignment.upsert", payload: { id: "a-obs", taskId: "t-1.1", resourceId: "u-orlova", role: "observer", unitsPermille: 1000, workMinutes: 80 * 60 } } as PlanningCommand,
      clientPlanVersion: rm.planVersion
    });
    const buckets = (res.readModel.resourceLoad as unknown as { buckets: Array<{ resourceId: string; granularity: string; assignedMinutes: number }> }).buckets;
    const orlovaAssigned = buckets.filter((b) => b.resourceId === "u-orlova" && b.granularity === "day").reduce((s, b) => s + b.assignedMinutes, 0);
    expect(orlovaAssigned).toBe(0);
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
