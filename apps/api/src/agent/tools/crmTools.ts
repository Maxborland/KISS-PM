import {
  canManageClients,
  canManageContacts,
  canManageCrmPipelineRules,
  canManageCrmPipelines,
  canManageOpportunities,
  canManageProducts,
  canReadClients,
  canReadContacts,
  canReadCrmPipelines,
  canReadOpportunities,
  canReadProducts
} from "@kiss-pm/access-control";

import { reTool, type AgentTool } from "../toolKit";

// Объект «поля» — LLM заполняет их по описанию, governed-роут валидирует.
const fields = (hint: string) => ({ fields: { type: "object", description: hint } });
const passFields = (i: Record<string, unknown>) => (i.fields && typeof i.fields === "object" ? i.fields : {});
const withId = (idKey: string) => (i: Record<string, unknown>) => ({ ...(passFields(i) as object), id: i[idKey] });

/**
 * CRM-инструменты агента — тонкие обёртки над существующими governed CRM-роутами
 * (clients/contacts/products/opportunities/pipelines/activity). Каждый гейтнут реальным canX,
 * исполняется generic-редиспатчем (см. agentRoutes). Бизнес-логика не дублируется.
 */
export const CRM_TOOLS: AgentTool[] = [
  // ---- Клиенты ----
  reTool({ name: "list_crm_clients", title: "Клиенты", description: "Список клиентов тенанта (только чтение).", kind: "analyze", canX: canReadClients, method: "GET", path: () => "/api/workspace/clients" }),
  reTool({ name: "create_crm_client", title: "Создать клиента", description: "Создать клиента. fields: name (обяз.), а также email, phone, website, address, status — по необходимости.", kind: "mutation", canX: canManageClients, method: "POST", path: () => "/api/workspace/clients", properties: fields("поля клиента"), required: ["fields"], body: passFields }),
  reTool({ name: "update_crm_client", title: "Изменить клиента", description: "Изменить клиента по clientId. fields — изменяемые поля (name/email/phone/website/address/status).", kind: "mutation", canX: canManageClients, method: "PATCH", path: (i) => `/api/workspace/clients/${i.clientId}`, properties: { clientId: { type: "string" }, ...fields("изменяемые поля клиента") }, required: ["clientId", "fields"], body: withId("clientId") }),

  // ---- Контакты ----
  reTool({ name: "list_crm_contacts", title: "Контакты", description: "Список контактов (только чтение).", kind: "analyze", canX: canReadContacts, method: "GET", path: () => "/api/workspace/contacts" }),
  reTool({ name: "create_crm_contact", title: "Создать контакт", description: "Создать контакт. fields: clientId (обяз.), firstName, lastName, email, phone.", kind: "mutation", canX: canManageContacts, method: "POST", path: () => "/api/workspace/contacts", properties: fields("поля контакта (clientId обязателен)"), required: ["fields"], body: passFields }),
  reTool({ name: "update_crm_contact", title: "Изменить контакт", description: "Изменить контакт по contactId. fields — изменяемые поля (clientId, firstName, lastName, email, phone).", kind: "mutation", canX: canManageContacts, method: "PATCH", path: (i) => `/api/workspace/contacts/${i.contactId}`, properties: { contactId: { type: "string" }, ...fields("изменяемые поля контакта") }, required: ["contactId", "fields"], body: withId("contactId") }),

  // ---- Продукты ----
  reTool({ name: "list_crm_products", title: "Продукты", description: "Список продуктов/услуг (только чтение).", kind: "analyze", canX: canReadProducts, method: "GET", path: () => "/api/workspace/products" }),
  reTool({ name: "create_crm_product", title: "Создать продукт", description: "Создать продукт/услугу. fields: name (обяз.) и др.", kind: "mutation", canX: canManageProducts, method: "POST", path: () => "/api/workspace/products", properties: fields("поля продукта"), required: ["fields"], body: passFields }),
  reTool({ name: "update_crm_product", title: "Изменить продукт", description: "Изменить продукт по productId. fields — изменяемые поля.", kind: "mutation", canX: canManageProducts, method: "PATCH", path: (i) => `/api/workspace/products/${i.productId}`, properties: { productId: { type: "string" }, ...fields("изменяемые поля продукта") }, required: ["productId", "fields"], body: withId("productId") }),

  // ---- Сделки (opportunities) ----
  reTool({ name: "list_crm_opportunities", title: "Сделки", description: "Список сделок (только чтение).", kind: "analyze", canX: canReadOpportunities, method: "GET", path: () => "/api/workspace/opportunities" }),
  reTool({ name: "read_crm_opportunity", title: "Открыть сделку", description: "Прочитать сделку по opportunityId (только чтение).", kind: "analyze", canX: canReadOpportunities, method: "GET", path: (i) => `/api/workspace/opportunities/${i.opportunityId}`, properties: { opportunityId: { type: "string" } }, required: ["opportunityId"] }),
  reTool({ name: "create_crm_opportunity", title: "Создать сделку", description: "Создать сделку. fields: title (обяз.), description, pipelineId, stageId, value, probability и др.", kind: "mutation", canX: canManageOpportunities, method: "POST", path: () => "/api/workspace/opportunities", properties: fields("поля сделки"), required: ["fields"], body: passFields }),
  reTool({ name: "update_crm_opportunity", title: "Изменить сделку", description: "Изменить сделку по opportunityId. fields — изменяемые поля (title/description/value/probability).", kind: "mutation", canX: canManageOpportunities, method: "PATCH", path: (i) => `/api/workspace/opportunities/${i.opportunityId}`, properties: { opportunityId: { type: "string" }, ...fields("изменяемые поля сделки") }, required: ["opportunityId", "fields"], body: passFields }),
  reTool({ name: "change_opportunity_stage", title: "Сменить стадию сделки", description: "Перевести сделку на другую стадию воронки. stageId — целевая стадия.", kind: "mutation", canX: canManageOpportunities, method: "PATCH", path: (i) => `/api/workspace/opportunities/${i.opportunityId}/stage`, properties: { opportunityId: { type: "string" }, stageId: { type: "string" } }, required: ["opportunityId", "stageId"], body: (i) => ({ stageId: i.stageId }) }),

  // ---- Активность на CRM-сущности (комментарий / задача) ----
  reTool({ name: "comment_crm_entity", title: "Комментарий к CRM-сущности", description: "Добавить комментарий к сущности CRM. entityType: client|contact|opportunity|product; entityId — id; body — текст.", kind: "mutation", canX: canReadOpportunities, method: "POST", path: (i) => `/api/workspace/crm/${i.entityType}/${i.entityId}/comments`, properties: { entityType: { type: "string" }, entityId: { type: "string" }, body: { type: "string" } }, required: ["entityType", "entityId", "body"], body: (i) => ({ body: i.body }) }),

  // ---- Воронки CRM (админка) ----
  reTool({ name: "list_crm_pipelines", title: "Воронки CRM", description: "Список воронок CRM (только чтение).", kind: "analyze", canX: canReadCrmPipelines, method: "GET", path: () => "/api/workspace/crm/pipelines" }),
  reTool({ name: "create_crm_pipeline", title: "Создать воронку CRM", description: "Создать воронку CRM. fields: name (обяз.) и др.", kind: "mutation", canX: canManageCrmPipelines, method: "POST", path: () => "/api/workspace/crm/pipelines", properties: fields("поля воронки"), required: ["fields"], body: passFields }),
  reTool({ name: "create_crm_pipeline_rule", title: "Правило перехода воронки", description: "Создать правило перехода между стадиями воронки. fields: fromStageId, toStageId (обяз.) и условия.", kind: "mutation", canX: canManageCrmPipelineRules, method: "POST", path: (i) => `/api/workspace/crm/pipelines/${i.pipelineId}/transition-rules`, properties: { pipelineId: { type: "string" }, ...fields("поля правила (fromStageId, toStageId обязательны)") }, required: ["pipelineId", "fields"], body: passFields })
];
