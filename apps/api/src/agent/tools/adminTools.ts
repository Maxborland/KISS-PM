import {
  canManageAccessProfiles,
  canManagePositions,
  canManageTaskStatuses,
  canManageTenantUsers,
  canReadAccessProfiles,
  canReadOrgStructure,
  canReadPositions,
  canReadTenantUsers
} from "@kiss-pm/access-control";

import { reTool, type AgentTool } from "../toolKit";

const fields = (hint: string) => ({ fields: { type: "object", description: hint } });
const passFields = (i: Record<string, unknown>) => (i.fields && typeof i.fields === "object" ? i.fields : {});

/**
 * Админ/оргструктура — тонкие обёртки над governed-роутами пользователей/ролей/позиций/
 * статусов задач. Гейтнуты соответствующими canX; исполняются generic-редиспатчем.
 * Деструктивные/массовые операции (PUT org-structure целиком) сознательно не подключены —
 * слишком велик риск затирания при сборке из частичного входа.
 */
export const ADMIN_TOOLS: AgentTool[] = [
  // ---- Пользователи ----
  reTool({ name: "list_workspace_users", title: "Сотрудники", description: "Список сотрудников тенанта (только чтение).", kind: "analyze", canX: canReadTenantUsers, method: "GET", path: () => "/api/workspace/users" }),
  reTool({ name: "create_workspace_user", title: "Создать сотрудника", description: "Создать сотрудника. fields: id, email, name, accessProfileId (обяз.), positionId, status.", kind: "mutation", canX: canManageTenantUsers, method: "POST", path: () => "/api/workspace/users", properties: fields("поля сотрудника (id, email, name, accessProfileId обязательны)"), required: ["fields"], body: passFields }),
  reTool({ name: "update_workspace_user", title: "Изменить сотрудника", description: "Изменить сотрудника по userId. fields: email, name, status, accessProfileId, positionId. Себя деактивировать/менять себе роль нельзя.", kind: "mutation", canX: canManageTenantUsers, method: "PATCH", path: (i) => `/api/workspace/users/${i.userId}`, properties: { userId: { type: "string" }, ...fields("изменяемые поля сотрудника") }, required: ["userId", "fields"], body: passFields }),

  // ---- Роли (access profiles) ----
  reTool({ name: "list_access_roles", title: "Роли доступа", description: "Список ролей доступа (только чтение).", kind: "analyze", canX: canReadAccessProfiles, method: "GET", path: () => "/api/workspace/access-roles" }),
  reTool({ name: "read_permission_catalog", title: "Каталог прав", description: "Полный каталог прав, доступных для назначения ролям (только чтение).", kind: "analyze", canX: canReadAccessProfiles, method: "GET", path: () => "/api/workspace/permission-catalog" }),
  reTool({ name: "create_access_role", title: "Создать роль", description: "Создать роль доступа. fields: id, name, permissions[] (обяз.).", kind: "mutation", canX: canManageAccessProfiles, method: "POST", path: () => "/api/tenant/current/access-profiles", properties: fields("поля роли (id, name, permissions обязательны)"), required: ["fields"], body: passFields }),
  reTool({ name: "update_access_role", title: "Изменить роль", description: "Изменить роль по roleId. fields: name, permissions[].", kind: "mutation", canX: canManageAccessProfiles, method: "PATCH", path: (i) => `/api/workspace/access-roles/${i.roleId}`, properties: { roleId: { type: "string" }, ...fields("изменяемые поля роли (name, permissions)") }, required: ["roleId", "fields"], body: (i) => ({ ...(passFields(i) as object), id: i.roleId }) }),

  // ---- Позиции ----
  reTool({ name: "list_positions", title: "Должности", description: "Список должностей/позиций (только чтение).", kind: "analyze", canX: canReadPositions, method: "GET", path: () => "/api/workspace/positions" }),
  reTool({ name: "create_position", title: "Создать должность", description: "Создать должность. fields: id, name (обяз.).", kind: "mutation", canX: canManagePositions, method: "POST", path: () => "/api/workspace/positions", properties: fields("поля должности (id, name обязательны)"), required: ["fields"], body: passFields }),
  reTool({ name: "update_position", title: "Изменить должность", description: "Изменить должность по positionId. fields: name.", kind: "mutation", canX: canManagePositions, method: "PATCH", path: (i) => `/api/workspace/positions/${i.positionId}`, properties: { positionId: { type: "string" }, ...fields("изменяемые поля должности") }, required: ["positionId", "fields"], body: (i) => ({ ...(passFields(i) as object), id: i.positionId }) }),

  // ---- Оргструктура (только чтение — запись через целостный PUT, не дробим) ----
  reTool({ name: "read_org_structure", title: "Оргструктура", description: "Прочитать организационную структуру (функциональную и проектную).", kind: "analyze", canX: canReadOrgStructure, method: "GET", path: () => "/api/tenant/current/org-structure" }),

  // ---- Статусы задач ----
  // Чтения статусов здесь НЕТ сознательно: справочник читает ручной инструмент
  // list_task_statuses из toolRegistry (гейт canReadProjects, кастомный исполнитель).
  // Вторая декларация с тем же именем давала бы ДВА tool-определения с одинаковым
  // function.name в одном запросе к LLM — и Anthropic, и OpenAI отвечают на это 400,
  // то есть агент падал бы у каждого, кому выданы оба права (ревью F1).
  // Уникальность имён теперь держит assertUniqueToolNames в toolRegistry.
  reTool({ name: "create_task_status", title: "Создать статус задачи", description: "Создать статус задачи. fields: id, name, category и др.", kind: "mutation", canX: canManageTaskStatuses, method: "POST", path: () => "/api/workspace/task-statuses", properties: fields("поля статуса задачи"), required: ["fields"], body: passFields })
];
