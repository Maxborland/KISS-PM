import type { AccessProfile, PolicyDecision } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

/**
 * Базовые типы инструментов агента + фабрика тонких обёрток. Вынесено из toolRegistry в
 * отдельный модуль, чтобы доменные файлы инструментов (tools/*.ts) могли импортировать reTool,
 * НЕ создавая циклической зависимости с реестром (toolRegistry импортирует доменные массивы).
 */
export type AgentToolKind = "analyze" | "mutation";

export type AgentToolCapabilityInput = { actor: TenantUser; profile: AccessProfile };
export type AgentToolCapability = (input: AgentToolCapabilityInput) => PolicyDecision;

// Декларативная привязка инструмента к существующему governed-роуту. Generic-исполнитель в
// agentRoutes переотправляет (app.request) method+path(+body) — без новой бизнес-логики.
export type AgentToolBinding = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: (input: Record<string, unknown>) => string;
  body?: (input: Record<string, unknown>) => unknown;
};

export type AgentTool = {
  name: string;
  title: string;
  description: string;
  kind: AgentToolKind;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  capability: AgentToolCapability;
  binding?: AgentToolBinding; // если задан — инструмент исполняется generic-редиспатчем
};

export type TenantCanX = (input: { actor: TenantUser; profile: AccessProfile; targetTenantId: string }) => PolicyDecision;

// Грубый capability из тенант-scoped canX (targetTenantId = тенант актора).
// Объявление функции (а не const) — хойстится, нет TDZ при вызове из reTool на инициализации
// доменных массивов инструментов.
export function tenantCapability(canX: TenantCanX): AgentToolCapability {
  return ({ actor, profile }) => canX({ actor, profile, targetTenantId: actor.tenantId });
}

// Фабрика тонкого инструмента-обёртки над governed-роутом: метаданные + canX-гейт + binding.
export function reTool(spec: {
  name: string;
  title: string;
  description: string;
  kind: AgentToolKind;
  canX: TenantCanX;
  method: AgentToolBinding["method"];
  path: AgentToolBinding["path"];
  properties?: Record<string, unknown>;
  required?: string[];
  body?: AgentToolBinding["body"];
}): AgentTool {
  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    kind: spec.kind,
    inputSchema: { type: "object", properties: spec.properties ?? {}, ...(spec.required ? { required: spec.required } : {}) },
    capability: tenantCapability(spec.canX),
    binding: { method: spec.method, path: spec.path, ...(spec.body ? { body: spec.body } : {}) }
  };
}
