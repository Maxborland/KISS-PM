import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";

import type { AgentTool } from "./toolKit";
import { AGENT_TOOLS, allowedToolsForActor, assertUniqueToolNames, findAgentTool, listToolAvailability, tenantCapability } from "./toolRegistry";

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

// F1: имя инструмента = function.name на проводе. Дубликат → 400 от Anthropic/OpenRouter на
// ПЕРВОМ же вызове LLM у любого актора, которому доступны обе копии (сид «Администратор» даёт
// и tenant.projects.read, и tenant.task_statuses.manage), т.е. агент мёртв для админа целиком.
describe("agent tool registry: уникальность имён инструментов", () => {
  it("в AGENT_TOOLS нет двух инструментов с одним именем", () => {
    const names = AGENT_TOOLS.map((tool) => tool.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

    expect(duplicates).toEqual([]);
    expect(new Set(names).size).toBe(AGENT_TOOLS.length);
  });

  it("админ со ВСЕМИ правами получает набор без дублей имён на проводе", () => {
    // Полный профиль прав = самый широкий срез; именно на нём коллизия и проявлялась.
    const offeredNames = allowedToolsForActor(actor, profile(ALL)).map((tool) => tool.name);

    expect(new Set(offeredNames).size).toBe(offeredNames.length);
  });

  it("list_task_statuses объявлен ровно один раз (ручной analyze, гейт canReadProjects)", () => {
    const declarations = AGENT_TOOLS.filter((tool) => tool.name === "list_task_statuses");

    expect(declarations).toHaveLength(1);
    // Ручная декларация без binding: исполняется кастомным analyze-исполнителем и доступна
    // всем, кто читает проекты (иначе change_task_status некуда взять валидный statusId).
    expect(declarations[0]?.binding).toBeUndefined();
    expect(findAgentTool("list_task_statuses")?.capability({ actor, profile: profile(["tenant.projects.read"]) }).allowed).toBe(true);
  });

  it("assertUniqueToolNames падает громко на коллизии имён", () => {
    const clone = (name: string): AgentTool => ({
      name,
      title: name,
      description: name,
      kind: "analyze",
      inputSchema: { type: "object", properties: {} },
      capability: tenantCapability(() => ({ allowed: true, reason: "same_tenant_permission_granted" }))
    });

    expect(() => assertUniqueToolNames([clone("a"), clone("b"), clone("a")])).toThrow(/agent_tool_name_collision: a/);
    expect(() => assertUniqueToolNames([clone("a"), clone("b")])).not.toThrow();
  });
});

describe("agent tool registry RBAC filtering", () => {
  it("описывает plannedWork создания задачи в часах с default 8", () => {
    const createTask = AGENT_TOOLS.find((tool) => tool.name === "create_task");

    expect(createTask?.inputSchema.properties?.plannedWork).toEqual({
      type: "number",
      description: "Плановые часы; по умолчанию 8",
      default: 8
    });
  });
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
