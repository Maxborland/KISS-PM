import { describe, expect, it } from "vitest";
import type { PlanSnapshot } from "@kiss-pm/domain";

import type { ApiApp, ApiRouteDeps } from "../routeTypes";
import type { ApiTenantDataSource } from "../apiTypes";

// detect/read_project_plan не делают переотправку — app не вызывается.
const fakeApp = { request: async () => new Response("{}", { status: 200 }) } as unknown as ApiApp;
import { createPlanningReadModel } from "../planning/planningReadModel";
import { buildAnalyzeExecutor } from "./agentRoutes";
import { findAgentTool } from "./toolRegistry";

// Снапшот с перегрузкой: две задачи по 480 мин на одного ресурса в один день
// → назначено 960 при ёмкости 480 → overload 480.
function overloadedSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    planVersion: 5,
    project: { id: "project-1", sourceType: "manual", sourceOpportunityId: null, plannedStart: "2026-06-01", plannedFinish: "2026-06-01", deadline: "2026-06-01", calendarId: "cal" },
    tasks: [
      { id: "task-a", parentTaskId: null, wbsCode: "1", title: "A", statusId: "todo", schedulingMode: "auto", taskType: "fixed_work", effortDriven: true, plannedStart: "2026-06-01", plannedFinish: null, durationMinutes: 480, workMinutes: 480, percentComplete: 0, calendarId: "cal", constraint: null },
      { id: "task-b", parentTaskId: null, wbsCode: "2", title: "B", statusId: "todo", schedulingMode: "auto", taskType: "fixed_work", effortDriven: true, plannedStart: "2026-06-01", plannedFinish: null, durationMinutes: 480, workMinutes: 480, percentComplete: 0, calendarId: "cal", constraint: null }
    ],
    assignments: [
      { id: "asg-a", taskId: "task-a", resourceId: "res-1", role: "executor", unitsPermille: 1000, workMinutes: 480, calendarId: null },
      { id: "asg-b", taskId: "task-b", resourceId: "res-1", role: "executor", unitsPermille: 1000, workMinutes: 480, calendarId: null }
    ],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "cal", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [{ id: "res-1", userId: "res-1", positionId: null, teamId: null, name: "Res", calendarId: "cal" }],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-24T00:00:00.000Z"
  };
}

function deps(snapshot: PlanSnapshot): ApiRouteDeps {
  const dataSource: Partial<ApiTenantDataSource> = {
    async getPlanSnapshot() { return snapshot; },
    async listProjects() { return [{ id: snapshot.projectId } as Awaited<ReturnType<NonNullable<ApiTenantDataSource["listProjects"]>>>[number]]; }
  };
  return { dataSource: dataSource as ApiTenantDataSource } as ApiRouteDeps;
}

describe("agent analyze: detect_resource_overloads", () => {
  it("aggregates the same overloads the planning read-model reports", async () => {
    const snapshot = overloadedSnapshot();
    const expected = createPlanningReadModel(snapshot).resourceLoad.overloads;
    expect(expected.length).toBeGreaterThan(0); // fixture must actually overload

    const exec = buildAnalyzeExecutor(deps(snapshot), fakeApp, null, "tenant-1", "user-1");
    const result = (await exec(findAgentTool("detect_resource_overloads")!, {})) as {
      overloadCount: number;
      overloads: Array<{ projectId: string; resourceId: string; overloadMinutes: number }>;
    };

    expect(result.overloadCount).toBe(expected.length);
    expect(result.overloads[0]!.resourceId).toBe("res-1");
    expect(result.overloads[0]!.projectId).toBe("project-1");
    expect(result.overloads[0]!.overloadMinutes).toBeGreaterThan(0);
  });

  it("read_project_plan returns plan version, tasks and overload count", async () => {
    const snapshot = overloadedSnapshot();
    const exec = buildAnalyzeExecutor(deps(snapshot), fakeApp, null, "tenant-1", "user-1");
    const result = (await exec(findAgentTool("read_project_plan")!, { projectId: "project-1" })) as {
      planVersion: number;
      tasks: unknown[];
      overloadCount: number;
    };
    expect(result.planVersion).toBe(5);
    expect(result.tasks).toHaveLength(2);
    expect(result.overloadCount).toBeGreaterThan(0);
  });
});

describe("agent analyze: list_task_statuses", () => {
  function statusRecord(over: { id: string; name: string; category: "new" | "waiting" | "in_progress" | "review" | "done"; status: "active" | "archived" }) {
    return { tenantId: "tenant-1", sortOrder: 0, isSystem: false, createdAt: new Date(), updatedAt: new Date(), ...over };
  }

  function statusDeps(records: ReturnType<typeof statusRecord>[]): ApiRouteDeps {
    const dataSource: Partial<ApiTenantDataSource> = {
      async listTaskStatuses() { return records as Awaited<ReturnType<NonNullable<ApiTenantDataSource["listTaskStatuses"]>>>; }
    };
    return { dataSource: dataSource as ApiTenantDataSource } as ApiRouteDeps;
  }

  it("returns only active statuses as {id,name,category} so the LLM picks a valid statusId", async () => {
    const exec = buildAnalyzeExecutor(statusDeps([
      statusRecord({ id: "todo", name: "К выполнению", category: "new", status: "active" }),
      statusRecord({ id: "review", name: "На проверке", category: "review", status: "active" }),
      statusRecord({ id: "legacy", name: "Старый", category: "done", status: "archived" })
    ]), fakeApp, null, "tenant-1", "user-1");

    const result = (await exec(findAgentTool("list_task_statuses")!, {})) as {
      statuses: Array<{ id: string; name: string; category: string }>;
    };

    expect(result.statuses).toEqual([
      { id: "todo", name: "К выполнению", category: "new" },
      { id: "review", name: "На проверке", category: "review" }
    ]);
  });

  it("degrades honestly without persistence", async () => {
    const exec = buildAnalyzeExecutor({ dataSource: {} as ApiTenantDataSource } as ApiRouteDeps, fakeApp, null, "tenant-1", "user-1");
    const result = (await exec(findAgentTool("list_task_statuses")!, {})) as { statuses: unknown[]; note?: string };
    expect(result.statuses).toEqual([]);
    expect(result.note).toBe("persistence_not_configured");
  });
});
