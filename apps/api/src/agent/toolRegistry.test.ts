import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";

import { AGENT_TOOLS, allowedToolsForActor, listToolAvailability } from "./toolRegistry";

const actor: TenantUser = { id: "user-1", tenantId: "tenant-x", name: "Тест", accessProfileId: "ap" };
const profile = (permissions: string[]): AccessProfile => ({ id: "ap", permissions: permissions as AccessProfile["permissions"] });

const ALL = [
  "tenant.projects.read", "tenant.projects.manage",
  "tenant.project_plan.read", "tenant.project_plan.manage",
  "tenant.project_resources.read", "tenant.project_resources.manage",
  "tenant.planning_scenarios.preview", "tenant.planning_scenarios.apply",
  "tenant.tasks.create", "tenant.tasks.edit",
  // CRM
  "tenant.clients.read", "tenant.clients.manage",
  "tenant.contacts.read", "tenant.contacts.manage",
  "tenant.products.read", "tenant.products.manage",
  "tenant.opportunities.read", "tenant.opportunities.manage",
  "tenant.crm_pipelines.read", "tenant.crm_pipelines.manage", "tenant.crm_pipeline_rules.manage",
  // Коммуникации
  "tenant.communications.read", "tenant.communications.manage",
  // Админ/оргструктура
  "tenant.users.read", "tenant.users.manage",
  "tenant.access_profiles.read", "tenant.access_profiles.manage",
  "tenant.positions.read", "tenant.positions.manage",
  "tenant.org_structure.read", "tenant.task_statuses.manage",
  // Жизненный цикл проектов
  "tenant.project_activation.manage"
];

describe("agent tool registry RBAC filtering", () => {
  it("полный набор прав → доступны все инструменты", () => {
    const allowed = allowedToolsForActor(actor, profile(ALL));
    expect(allowed.length).toBe(AGENT_TOOLS.length);
  });

  it("без прав → ни одного инструмента, reason=permission_missing", () => {
    const avail = listToolAvailability(actor, profile([]));
    expect(avail.every((t) => !t.allowed)).toBe(true);
    expect(avail.every((t) => t.reason === "permission_missing")).toBe(true);
    expect(allowedToolsForActor(actor, profile([])).length).toBe(0);
  });

  it("только чтение проектов → доступны read-инструменты задач, но не сценарии/правка", () => {
    const avail = listToolAvailability(actor, profile(["tenant.projects.read"]));
    const byName = new Map(avail.map((t) => [t.name, t]));
    expect(byName.get("list_my_tasks")?.allowed).toBe(true);
    expect(byName.get("change_task_status")?.allowed).toBe(true); // грубый гейт = canReadProjects
    expect(byName.get("comment_task")?.allowed).toBe(true);
    expect(byName.get("update_task")?.allowed).toBe(false); // нужен tenant.tasks.edit
    expect(byName.get("preview_resource_resolution")?.allowed).toBe(false);
    expect(byName.get("apply_resource_resolution")?.allowed).toBe(false);
    expect(byName.get("read_project_plan")?.allowed).toBe(false); // нужен tenant.project_plan.read
  });

  it("scenarios.apply отдельно от scenarios.preview", () => {
    const previewOnly = new Map(listToolAvailability(actor, profile(["tenant.planning_scenarios.preview"])).map((t) => [t.name, t]));
    expect(previewOnly.get("preview_resource_resolution")?.allowed).toBe(true);
    expect(previewOnly.get("apply_resource_resolution")?.allowed).toBe(false);
  });

  it("кросс-тенант запрещён (actor.tenantId != target) — здесь target всегда тенант актора, поэтому решает наличие права", () => {
    // capability использует targetTenantId = actor.tenantId, значит cross_tenant_denied не достигается;
    // проверяем, что управление планом требует именно tenant.project_plan.manage.
    const planManage = new Map(listToolAvailability(actor, profile(["tenant.project_plan.manage"])).map((t) => [t.name, t]));
    expect(planManage.get("apply_plan_commands")?.allowed).toBe(true);
    expect(planManage.get("update_task")?.allowed).toBe(false);
  });
});
