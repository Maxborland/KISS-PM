import { createAccessProfile } from "@kiss-pm/access-control";
import { createTenantUser } from "@kiss-pm/domain";
import type { ProjectRecord, TaskRecord } from "@kiss-pm/persistence";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "../apiTypes";
import { createTaskReadWorkspace } from "./taskReadWorkspace";

const TENANT_ID = "tenant-task-read";

const actor = createTenantUser({
  id: "user-task-read",
  tenantId: TENANT_ID,
  name: "Task Reader",
  accessProfileId: "profile-task-read"
});

const profile = createAccessProfile({
  id: "profile-task-read",
  permissions: ["tenant.projects.read"]
});

const task: TaskRecord = {
  id: "task-detail-1",
  tenantId: TENANT_ID,
  projectId: "proj-detail-1",
  stageId: null,
  title: "Согласовать требования",
  description: null,
  status: "in_progress",
  statusId: "status-in-progress",
  statusName: "В работе",
  statusCategory: "in_progress",
  priority: "normal",
  requesterUserId: "user-task-read",
  ownerUserId: "user-task-read",
  plannedStart: new Date("2026-07-01T00:00:00Z"),
  plannedFinish: new Date("2026-07-10T00:00:00Z"),
  durationWorkingDays: 8,
  plannedWork: 40,
  actualWork: 10,
  progress: 25,
  requiresAcceptance: false,
  source: "manual",
  createdAt: new Date("2026-06-30T00:00:00Z"),
  updatedAt: new Date("2026-07-01T00:00:00Z"),
  archivedAt: null,
  participants: []
};

const project: ProjectRecord = {
  id: "proj-detail-1",
  tenantId: TENANT_ID,
  sourceType: "manual",
  sourceOpportunityId: null,
  clientId: null,
  projectTypeId: null,
  title: "Производственный портал",
  clientName: "ООО «Ромашка»",
  status: "active",
  plannedStart: new Date("2026-06-01T00:00:00Z"),
  plannedFinish: new Date("2026-09-01T00:00:00Z"),
  contractValue: 1_000_000,
  plannedHours: 500,
  templateId: null,
  createdAt: new Date("2026-05-01T00:00:00Z"),
  activatedAt: new Date("2026-06-01T00:00:00Z"),
  closedAt: null,
  demand: []
};

type DataSourceOverrides = { [K in keyof ApiTenantDataSource]?: ApiTenantDataSource[K] | undefined };

function createWorkspace(overrides: DataSourceOverrides = {}) {
  const dataSource = {
    findTaskById: async (tenantId: string, taskId: string) =>
      tenantId === TENANT_ID && taskId === task.id ? task : undefined,
    listTaskActivities: async () => [],
    listProjects: async (tenantId: string) => (tenantId === TENANT_ID ? [project] : []),
    ...overrides
  } as unknown as ApiTenantDataSource;
  return createTaskReadWorkspace({ dataSource });
}

describe("taskReadWorkspace.getProjectDetail — читаемость не-active проектов (ревью #265)", () => {
  it("отдаёт закрытый/приостановленный проект через findProjectById, а не 404", async () => {
    const closed = { ...project, status: "closed" } as ProjectRecord;
    const workspace = createWorkspace({
      // listProjects не возвращает closed (фильтр [draft,active,paused]) — деталь берёт findProjectById.
      listProjects: async () => [],
      listProjectTasks: async () => [],
      findProjectById: async (tenantId: string, projectId: string) =>
        tenantId === TENANT_ID && projectId === closed.id ? closed : undefined
    });
    const result = await workspace.getProjectDetail({ actor, profile, projectId: closed.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.status).toBe("closed");
  });

  it("404 когда проект не найден ни findProjectById, ни в списке", async () => {
    const workspace = createWorkspace({ listProjects: async () => [], listProjectTasks: async () => [], findProjectById: async () => undefined });
    const result = await workspace.getProjectDetail({ actor, profile, projectId: "ghost" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});

describe("taskReadWorkspace.getTaskDetail", () => {
  it("returns projectId and projectName resolved through listProjects", async () => {
    const workspace = createWorkspace();

    const result = await workspace.getTaskDetail({ actor, profile, taskId: task.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projectId).toBe("proj-detail-1");
    expect(result.projectName).toBe("Производственный портал");
  });

  it("fail-soft: projectName is null when the project is not in the list", async () => {
    const workspace = createWorkspace({ listProjects: async () => [] });

    const result = await workspace.getTaskDetail({ actor, profile, taskId: task.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projectId).toBe("proj-detail-1");
    expect(result.projectName).toBeNull();
  });

  it("fail-soft: projectName is null when listProjects is not configured", async () => {
    const workspace = createWorkspace({ listProjects: undefined });

    const result = await workspace.getTaskDetail({ actor, profile, taskId: task.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projectId).toBe("proj-detail-1");
    expect(result.projectName).toBeNull();
  });

  it("still returns 404 for an unknown task", async () => {
    const workspace = createWorkspace();

    const result = await workspace.getTaskDetail({ actor, profile, taskId: "task-missing" });

    expect(result).toEqual({ ok: false, status: 404, error: "task_not_found" });
  });
});
