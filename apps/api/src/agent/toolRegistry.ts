import {
  canApplyPlanningScenarios,
  canCreateTasks,
  canEditTasks,
  canManageProjectPlan,
  canPreviewPlanningScenarios,
  canReadProjectPlan,
  canReadProjectResources,
  canReadProjects,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

/**
 * Реестр инструментов агента (P-agent slice 1).
 *
 * Агент НЕ содержит собственной бизнес-логики: каждый tool — тонкая обёртка над уже
 * существующим, RBAC-гейтнутым контрактом (governed planning apply / task preflight+command /
 * scenario apply). Здесь определяются только метаданные + JSON-схема входа (для Anthropic
 * tool-calling) + грубый capability-гейт (canX) для фильтрации набора под права актора.
 *
 * kind:
 *   - "analyze"  — только чтение; исполняется вживую в LLM-цикле (slice 2).
 *   - "mutation" — изменяет систему; в цикле НЕ исполняется (возвращается как предложение),
 *                  применяется отдельным /execute по подтверждению (slice 3) с повторной
 *                  server-side RBAC-проверкой.
 *
 * Capability здесь — ГРУБЫЙ фильтр («есть ли у сотрудника хоть какой-то доступ к этому
 * инструменту»). Точная per-resource проверка (участник задачи, per-command право,
 * version-lock) выполняется в момент execute существующими гейтами.
 */
export type AgentToolKind = "analyze" | "mutation";

export type AgentToolCapabilityInput = { actor: TenantUser; profile: AccessProfile };
export type AgentToolCapability = (input: AgentToolCapabilityInput) => PolicyDecision;

export type AgentTool = {
  name: string;
  title: string;
  description: string;
  kind: AgentToolKind;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  capability: AgentToolCapability;
};

// Грубый capability из тенант-scoped canX (targetTenantId = тенант актора).
const tenantCapability =
  (canX: (input: { actor: TenantUser; profile: AccessProfile; targetTenantId: string }) => PolicyDecision): AgentToolCapability =>
  ({ actor, profile }) =>
    canX({ actor, profile, targetTenantId: actor.tenantId });

export const AGENT_TOOLS: AgentTool[] = [
  // ---- analyze (только чтение) ----
  {
    name: "list_my_tasks",
    title: "Мои задачи",
    description: "Вернуть задачи текущего сотрудника с их статусами и проектами (GET /api/workspace/my-work). Только чтение.",
    kind: "analyze",
    inputSchema: { type: "object", properties: {} },
    capability: tenantCapability(canReadProjects)
  },
  {
    name: "read_project_plan",
    title: "План проекта",
    description: "Прочитать план проекта (read-model): задачи, назначения, нагрузка ресурсов, перегрузки. Только чтение.",
    kind: "analyze",
    inputSchema: { type: "object", properties: { projectId: { type: "string", description: "Идентификатор проекта" } }, required: ["projectId"] },
    capability: tenantCapability(canReadProjectPlan)
  },
  {
    name: "detect_resource_overloads",
    title: "Найти перегрузки ресурсов",
    description: "Найти перегруженные ресурсы по тенанту/проекту (capacity summary + read-model overloads): кто перегружен, на сколько минут, какие задачи. Только чтение.",
    kind: "analyze",
    inputSchema: { type: "object", properties: { projectId: { type: "string" }, monthIso: { type: "string", description: "YYYY-MM" } } },
    capability: tenantCapability(canReadProjectResources)
  },
  {
    name: "preview_resource_resolution",
    title: "Предложить план разрешения перегрузки",
    description: "Сгенерировать варианты плана разрешения ресурсной перегрузки (3 профиля: aggressive/balanced/resilient) с объяснением (сдвиг дедлайна, риск, изменённые задачи). Только чтение/превью, без применения.",
    kind: "analyze",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        target: {
          type: "object",
          description: "Цель перегрузки",
          properties: { resourceId: { type: "string" }, date: { type: "string" }, overloadMinutes: { type: "number" }, taskIds: { type: "array", items: { type: "string" } } },
          required: ["resourceId", "date"]
        }
      },
      required: ["projectId", "target"]
    },
    capability: tenantCapability(canPreviewPlanningScenarios)
  },

  // ---- mutation (изменяют систему; предлагаются, не исполняются в цикле) ----
  {
    name: "change_task_status",
    title: "Сменить статус задачи",
    description: "Перевести задачу в другой статус (PATCH .../tasks/:id/status). Разрешённость перехода и роль участника проверяются при применении.",
    kind: "mutation",
    inputSchema: { type: "object", properties: { projectId: { type: "string" }, taskId: { type: "string" }, statusId: { type: "string" } }, required: ["projectId", "taskId", "statusId"] },
    capability: tenantCapability(canReadProjects)
  },
  {
    name: "update_task",
    title: "Изменить задачу",
    description: "Изменить поля задачи (название/описание/приоритет/срок) — PATCH /api/workspace/tasks/:id. Требует право редактирования задач (или роль постановщика).",
    kind: "mutation",
    inputSchema: { type: "object", properties: { taskId: { type: "string" }, fields: { type: "object", description: "Изменяемые поля" } }, required: ["taskId", "fields"] },
    capability: tenantCapability(canEditTasks)
  },
  {
    name: "create_task",
    title: "Создать задачу",
    description: "Создать задачу (в проекте или входящую). POST /api/workspace[/projects/:id]/tasks.",
    kind: "mutation",
    inputSchema: { type: "object", properties: { projectId: { type: "string", description: "Опционально — проект" }, title: { type: "string" }, description: { type: "string" } }, required: ["title"] },
    capability: tenantCapability(canCreateTasks)
  },
  {
    name: "comment_task",
    title: "Прокомментировать задачу",
    description: "Добавить комментарий/активность к задаче. POST /api/workspace/tasks/:id/comments.",
    kind: "mutation",
    inputSchema: { type: "object", properties: { taskId: { type: "string" }, body: { type: "string" } }, required: ["taskId", "body"] },
    capability: tenantCapability(canReadProjects)
  },
  {
    name: "apply_resource_resolution",
    title: "Применить план разрешения перегрузки",
    description: "Применить выбранный сценарий разрешения перегрузки (governed apply: валидация + version-lock + audit). Требует право применения сценариев; рискованные требуют обоснования.",
    kind: "mutation",
    inputSchema: { type: "object", properties: { projectId: { type: "string" }, scenarioId: { type: "string" }, clientPlanVersion: { type: "number" }, acceptedRiskReason: { type: "string" } }, required: ["projectId", "scenarioId", "clientPlanVersion"] },
    capability: tenantCapability(canApplyPlanningScenarios)
  },
  {
    name: "apply_plan_commands",
    title: "Применить изменения плана",
    description: "Применить набор planning-команд (переназначение/перепланирование/принятие риска) через governed apply. Право проверяется per-команда при применении.",
    kind: "mutation",
    inputSchema: { type: "object", properties: { projectId: { type: "string" }, commands: { type: "array", items: { type: "object" } }, clientPlanVersion: { type: "number" } }, required: ["projectId", "commands", "clientPlanVersion"] },
    capability: tenantCapability(canManageProjectPlan)
  }
];

export type AgentToolAvailability = {
  name: string;
  title: string;
  description: string;
  kind: AgentToolKind;
  allowed: boolean;
  reason: string;
};

/** Набор инструментов с разметкой доступности под права актора. */
export function listToolAvailability(actor: TenantUser, profile: AccessProfile): AgentToolAvailability[] {
  return AGENT_TOOLS.map((tool) => {
    const decision = tool.capability({ actor, profile });
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      kind: tool.kind,
      allowed: decision.allowed,
      reason: decision.reason
    };
  });
}

/** Только разрешённые актору инструменты (для подачи в LLM — slice 2). */
export function allowedToolsForActor(actor: TenantUser, profile: AccessProfile): AgentTool[] {
  return AGENT_TOOLS.filter((tool) => tool.capability({ actor, profile }).allowed);
}

export function findAgentTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((tool) => tool.name === name);
}
