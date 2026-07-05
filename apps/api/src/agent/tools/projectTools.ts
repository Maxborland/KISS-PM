import { canManageOpportunities, canManageProjectActivation, canReadOpportunities, canReadProjects } from "@kiss-pm/access-control";

import { reTool, type AgentTool } from "../toolKit";

const fields = (hint: string) => ({ fields: { type: "object", description: hint } });
const passFields = (i: Record<string, unknown>) => (i.fields && typeof i.fields === "object" ? i.fields : {});

/**
 * Жизненный цикл проектов — список проектов и переходы воронки сделки → активация проекта.
 * Тонкие обёртки над governed-роутами projectIntake; гейтнуты canX; generic-редиспатч.
 */
export const PROJECT_TOOLS: AgentTool[] = [
  reTool({ name: "list_projects", title: "Проекты", description: "Список активных проектов тенанта (только чтение).", kind: "analyze", canX: canReadProjects, method: "GET", path: () => "/api/workspace/projects" }),
  reTool({ name: "check_opportunity_feasibility", title: "Проверить осуществимость сделки", description: "Оценить ресурсную осуществимость сделки перед активацией (только чтение/расчёт).", kind: "analyze", canX: canReadOpportunities, method: "POST", path: (i) => `/api/workspace/opportunities/${i.opportunityId}/feasibility`, properties: { opportunityId: { type: "string" } }, required: ["opportunityId"], body: () => ({}) }),
  reTool({ name: "finalize_opportunity", title: "Финализировать сделку", description: "Завершить сделку. finalAction — итоговое действие (например won/lost — см. контракт).", kind: "mutation", canX: canManageOpportunities, method: "PATCH", path: (i) => `/api/workspace/opportunities/${i.opportunityId}/finalize`, properties: { opportunityId: { type: "string" }, finalAction: { type: "string" } }, required: ["opportunityId", "finalAction"], body: (i) => ({ finalAction: i.finalAction }) }),
  reTool({ name: "activate_project_from_opportunity", title: "Активировать проект из сделки", description: "Развернуть проект из выигранной сделки. fields — параметры активации (название, даты, ресурсы — см. контракт).", kind: "mutation", canX: canManageProjectActivation, method: "POST", path: (i) => `/api/workspace/opportunities/${i.opportunityId}/activate`, properties: { opportunityId: { type: "string" }, ...fields("параметры активации проекта") }, required: ["opportunityId", "fields"], body: passFields })
];
