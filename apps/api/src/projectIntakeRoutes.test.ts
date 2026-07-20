import { createAccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { ProjectRecord } from "@kiss-pm/persistence";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "./apiTypes";
import { ensureCompleteDataSource } from "./dataSourceCompletion";
import { registerProjectIntakeRoutes } from "./projectIntakeRoutes";

const actor: TenantUser = {
  id: "user-admin",
  tenantId: "tenant-alpha",
  name: "Анна Администратор",
  accessProfileId: "tenant-admin"
};

const readProfile = createAccessProfile({
  id: "reader",
  permissions: ["tenant.projects.read"]
});

const project = (id: string, status: ProjectRecord["status"]): ProjectRecord => ({
  id,
  tenantId: "tenant-alpha",
  sourceType: "manual",
  sourceOpportunityId: null,
  clientId: null,
  projectTypeId: null,
  title: id,
  clientName: "Внутренний проект",
  status,
  plannedStart: new Date("2026-06-01T00:00:00.000Z"),
  plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
  contractValue: 0,
  plannedHours: 0,
  templateId: null,
  createdAt: new Date("2026-05-20T00:00:00.000Z"),
  activatedAt: null,
  closedAt: null,
  demand: []
});

const stored: ProjectRecord[] = [
  project("project-draft", "draft"),
  project("project-active", "active"),
  project("project-paused", "paused"),
  project("project-closed", "closed")
];

function makeApp(): Hono {
  const app = new Hono();
  registerProjectIntakeRoutes(app, {
    dataSource: ensureCompleteDataSource({
      listProjects: async () => stored
    }) satisfies ApiTenantDataSource,
    getActorProfile: async () => readProfile,
    getSessionActorFromHeaders: async () => actor,
    runDataSourceTransaction: async (operation) => operation({} as never),
    appendManagementAuditEvent: async () => "audit-management"
  });
  return app;
}

async function listIds(query: string): Promise<{ status: number; body: unknown }> {
  const response = await makeApp().request(`/api/workspace/projects${query}`, {
    headers: { cookie: "kiss_pm_session=x" }
  });
  return { status: response.status, body: await response.json() };
}

function ids(body: unknown): string[] {
  return ((body as { projects: ProjectRecord[] }).projects ?? []).map((item) => item.id);
}

describe("GET /api/workspace/projects — фильтр статуса", () => {
  // Обратная совместимость: ручка исторически отдавала только активные проекты.
  it("defaults to active when the parameter is absent", async () => {
    const withoutParam = await listIds("");
    expect(withoutParam.status).toBe(200);
    expect(ids(withoutParam.body)).toEqual(["project-active"]);
  });

  it("supports every status a project can actually reach, plus all", async () => {
    // Регрессия: `draft` не был перечислен, и проекты-черновики (их создаёт
    // activateProjectCommand) нельзя было получить через эту ручку вообще.
    expect(ids((await listIds("?status=draft")).body)).toEqual(["project-draft"]);
    expect(ids((await listIds("?status=active")).body)).toEqual(["project-active"]);
    expect(ids((await listIds("?status=paused")).body)).toEqual(["project-paused"]);
    expect(ids((await listIds("?status=closed")).body)).toEqual(["project-closed"]);
    expect(ids((await listIds("?status=all")).body)).toHaveLength(4);
  });

  // Регрессия: любое нераспознанное значение молча падало в "active", поэтому
  // `?status=garbage` и опечатка `?status=Active` возвращали 200 и не тот список.
  it.each(["garbage", "Active", "ACTIVE", "", "cancelled", "active,closed"])(
    "rejects the invalid status %j with 400 instead of coercing it to active",
    async (value) => {
      const response = await listIds(`?status=${encodeURIComponent(value)}`);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_project_status_filter" });
    }
  );
});
