/* ============================================================
   CRM API client — тонкий типизированный клиент над REST-ручками
   /api/workspace/{clients,contacts,products,deal-stages,opportunities,...}.
   Зеркало createPlanningApiClient (planning-client): тот же приём с
   инъекцией fetchImpl, теми же заголовками и credentials. Переключение
   на боевой API = передать реальный apiOrigin и убрать fetchImpl-мок.

   ВАЖНО: CRM — плоский REST-CRUD, БЕЗ optimistic-concurrency (нет
   planVersion/clientPlanVersion и 409 plan_version_conflict, в отличие
   от планирования). Каждая мутация возвращает затронутую сущность.
   ============================================================ */

/* Реэкспорт доменных типов оценки реализуемости (feasibility) — единый источник правды.
   UI и мок используют ЭТИ типы, чтобы виджет реализуемости был контракт-верен. */
export type {
  OpportunityFeasibilityAssessment,
  OpportunityFeasibilityStatus,
  OpportunityFeasibilityBlocker,
  OpportunityFeasibilityWarning,
  OpportunityFeasibilityRow
} from "@kiss-pm/domain";
import type {
  OpportunityFeasibilityAssessment,
  OpportunityFeasibilityStatus,
  OpportunityFeasibilityBlocker,
  OpportunityFeasibilityWarning,
  OpportunityFeasibilityRow
} from "@kiss-pm/domain";

/* Сериализованная оценка реализуемости (даты доменом не передаются — assessment чисто числовой,
   поэтому serialized-форма совпадает с доменной). Алиасы для удобства UI/стори. */
export type FeasibilityAssessment = OpportunityFeasibilityAssessment;
export type FeasibilityStatus = OpportunityFeasibilityStatus;
export type FeasibilityRow = OpportunityFeasibilityRow;
export type FeasibilityBlocker = OpportunityFeasibilityBlocker;
export type FeasibilityWarning = OpportunityFeasibilityWarning;

import { createRequestJson, DomainApiError, type DomainClientOptions } from "../../lib/domain-client";

export type CrmApiClientOptions = DomainClientOptions;

// Общий класс ошибки транспорта; алиас сохраняет прежнее имя для instanceof-проверок.
export { DomainApiError as CrmApiError };

/* ---- View-типы (форма боевых записей; даты пересекают провод как ISO-строки) ---- */
export type CrmStatus = "active" | "archived";

export type Client = { id: string; tenantId: string; name: string; description: string | null; status: CrmStatus; createdAt: string; updatedAt: string };
export type Contact = { id: string; tenantId: string; clientId: string; name: string; email: string | null; phone: string | null; telegram: string | null; role: string | null; status: CrmStatus; createdAt: string; updatedAt: string };
export type Product = { id: string; tenantId: string; name: string; sku: string | null; type: "service" | "goods"; unit: string; price: number; description: string | null; status: CrmStatus; createdAt: string; updatedAt: string };
// Мультиворонки: стадия получает воронку (pipelineId), к которой принадлежит (null — legacy-стадия без воронки).
export type DealStage = { id: string; tenantId: string; pipelineId: string | null; name: string; sortOrder: number; status: CrmStatus; createdAt: string; updatedAt: string };
export type ProjectType = { id: string; tenantId: string; name: string; description: string | null; status: CrmStatus; createdAt: string; updatedAt: string };
// Справочник пользователей рабочей области (владелец/автор/исполнитель). Боевой GET /api/workspace/users
// отдаёт TenantUser (id + name достаточно для CRM-отображения); positionId/positionName опциональны
// (присутствуют в contract-mock, на боевом могут отсутствовать). Зеркало WorkspaceUser.
export type CrmUser = { id: string; name: string; positionId?: string | null; positionName?: string | null };

// Мультиворонки: воронка (набор стадий со своими правилами переходов).
export type Pipeline = { id: string; tenantId: string; name: string; description: string | null; isDefault: boolean; sortOrder: number; status: CrmStatus; createdAt: string; updatedAt: string };
// Мультиворонки: правило перехода между двумя стадиями ОДНОЙ воронки (гвард опционален).
export type StageTransition = { id: string; tenantId: string; pipelineId: string; fromStageId: string; toStageId: string; requireFeasibilityOk: boolean; minProbability: number | null; guardNote: string | null; createdAt: string; updatedAt: string };

export type PositionDemand = { positionId: string; requiredHours: number };
export type OpportunityStatus = "new" | "feasibility" | "ready_to_activate" | "won_closed" | "lost_rejected";
export type Opportunity = {
  id: string; tenantId: string;
  clientId: string | null; primaryContactId: string | null; ownerUserId: string | null; projectTypeId: string | null; stageId: string | null; pipelineId: string | null;
  clientName: string; contactName: string; title: string; projectType: string; description: string | null;
  plannedStart: string; plannedFinish: string;
  contractValue: number; plannedHourlyRate: number; plannedHours: number; probability: number;
  status: OpportunityStatus; templateId: string | null;
  feasibilityStatus: string | null; feasibilityResult: Record<string, unknown> | null; feasibilityCheckedAt: string | null;
  createdAt: string; updatedAt: string;
  demand: PositionDemand[]; customFieldValues: Record<string, string>;
};

export type ProjectRecord = {
  id: string; tenantId: string; sourceType: "opportunity" | "workspace_inbox" | "manual"; sourceOpportunityId: string | null;
  clientId: string | null; projectTypeId: string | null; title: string; clientName: string; status: string;
  plannedStart: string; plannedFinish: string; contractValue: number; plannedHours: number; templateId: string | null;
  createdAt: string; activatedAt: string | null; closedAt: string | null; demand: PositionDemand[];
};

export type OpportunityCreateInput = {
  clientId: string; primaryContactId: string; projectTypeId: string; stageId: string;
  title: string; description?: string | null;
  plannedStart: string; plannedFinish: string;
  contractValue: number; plannedHourlyRate: number; probability: number;
  demand: PositionDemand[];
  ownerUserId?: string | null;
};

// Форма ПОЛНОГО обновления сделки (PATCH /:id — full-replace, как боевой parseOpportunityUpdateBody).
// Статус/воронка/feasibility — server-managed; templateId/customFieldValues обязаны сохраняться клиентом.
export type OpportunityUpdateInput = OpportunityCreateInput & {
  templateId: string | null;
  customFieldValues: Record<string, string>;
};

// Тело активации проекта из сделки (POST /:id/activate). Оба поля опциональны.
export type ProjectActivationInput = { id?: string; acceptedRiskReason?: string | null };

// Сущность CRM-активности (сериализованная: даты — ISO-строки). Зеркало CrmActivityRecord боевого API.
export type CrmActivityType = "comment" | "task" | "file";
export type CrmActivityEntityType = "opportunity" | "client" | "contact" | "product";
export type CrmActivity = {
  id: string; tenantId: string;
  entityType: CrmActivityEntityType; entityId: string;
  type: CrmActivityType;
  title: string | null; body: string | null;
  status: "todo" | "done" | null;
  dueDate: string | null; assigneeUserId: string | null; authorUserId: string;
  fileUrl: string | null; fileSizeBytes: number | null; mimeType: string | null;
  createdAt: string; updatedAt: string;
};
// Ответ GET .../activity: лента активностей + (в моке пустые/false) системные и attachment-секции.
export type CrmActivityFeed = {
  activities: CrmActivity[];
  attachmentItems: unknown[];
  systemEvents: unknown[];
  canReadRawAudit: boolean;
  auditEvents: unknown[] | null;
};

export function createCrmClient(options: CrmApiClientOptions) {
  const requestJson = createRequestJson(options);

  const enc = encodeURIComponent;
  return {
    // справочники
    listClients() { return requestJson<{ clients: Client[] }>("/api/workspace/clients"); },
    createClient(input: { name: string; description?: string | null; status?: CrmStatus }) { return requestJson<{ client: Client }>("/api/workspace/clients", { method: "POST", body: JSON.stringify(input) }); },
    updateClient(clientId: string, input: Partial<{ name: string; description: string | null; status: CrmStatus }>) { return requestJson<{ client: Client }>(`/api/workspace/clients/${enc(clientId)}`, { method: "PATCH", body: JSON.stringify(input) }); },
    listContacts() { return requestJson<{ contacts: Contact[] }>("/api/workspace/contacts"); },
    createContact(input: { clientId: string; name: string; email?: string | null; phone?: string | null; telegram?: string | null; role?: string | null; status?: CrmStatus }) { return requestJson<{ contact: Contact }>("/api/workspace/contacts", { method: "POST", body: JSON.stringify(input) }); },
    updateContact(contactId: string, input: Record<string, unknown>) { return requestJson<{ contact: Contact }>(`/api/workspace/contacts/${enc(contactId)}`, { method: "PATCH", body: JSON.stringify(input) }); },
    listProducts() { return requestJson<{ products: Product[] }>("/api/workspace/products"); },
    createProduct(input: { name: string; type?: "service" | "goods"; unit: string; price: number; sku?: string | null; description?: string | null; status?: CrmStatus }) { return requestJson<{ product: Product }>("/api/workspace/products", { method: "POST", body: JSON.stringify(input) }); },
    updateProduct(productId: string, input: Record<string, unknown>) { return requestJson<{ product: Product }>(`/api/workspace/products/${enc(productId)}`, { method: "PATCH", body: JSON.stringify(input) }); },
    listDealStages() { return requestJson<{ dealStages: DealStage[] }>("/api/workspace/deal-stages"); },
    listProjectTypes() { return requestJson<{ projectTypes: ProjectType[] }>("/api/workspace/project-types"); },
    // Справочник пользователей — резолв владельца/автора/исполнителя сделки (отображение аватара/имени).
    listUsers() { return requestJson<{ users: CrmUser[] }>("/api/workspace/users"); },

    // сделки (opportunities)
    listOpportunities() { return requestJson<{ opportunities: Opportunity[] }>("/api/workspace/opportunities"); },
    getOpportunity(id: string) { return requestJson<{ opportunity: Opportunity }>(`/api/workspace/opportunities/${enc(id)}`); },
    createOpportunity(input: OpportunityCreateInput) { return requestJson<{ opportunity: Opportunity }>("/api/workspace/opportunities", { method: "POST", body: JSON.stringify(input) }); },
    moveOpportunityStage(id: string, stageId: string) { return requestJson<{ opportunity: Opportunity }>(`/api/workspace/opportunities/${enc(id)}/stage`, { method: "PATCH", body: JSON.stringify({ stageId }) }); },
    finalizeOpportunity(id: string, status: "won_closed" | "lost_rejected", reason: string) { return requestJson<{ opportunity: Opportunity }>(`/api/workspace/opportunities/${enc(id)}/finalize`, { method: "PATCH", body: JSON.stringify({ status, reason }) }); },

    // мультиворонки (pipelines + stage-transitions + cross-pipeline move)
    listPipelines() { return requestJson<{ pipelines: Pipeline[] }>("/api/workspace/pipelines"); },
    createPipeline(input: { name: string; sortOrder: number; description?: string | null; isDefault?: boolean; status?: CrmStatus }) { return requestJson<{ pipeline: Pipeline }>("/api/workspace/pipelines", { method: "POST", body: JSON.stringify(input) }); },
    // Стадия сделки (POST /deal-stages): нужна бутстрапу первой воронки — воронка без стадий неюзабельна.
    createDealStage(input: { name: string; sortOrder: number; pipelineId?: string | null; status?: CrmStatus }) { return requestJson<{ dealStage: DealStage }>("/api/workspace/deal-stages", { method: "POST", body: JSON.stringify(input) }); },
    updatePipeline(pipelineId: string, input: { name: string; sortOrder: number; description?: string | null; isDefault?: boolean; status?: CrmStatus }) { return requestJson<{ pipeline: Pipeline }>(`/api/workspace/pipelines/${enc(pipelineId)}`, { method: "PATCH", body: JSON.stringify(input) }); },
    listStageTransitions(pipelineId: string) { return requestJson<{ stageTransitions: StageTransition[] }>(`/api/workspace/pipelines/${enc(pipelineId)}/stage-transitions`); },
    createStageTransition(pipelineId: string, input: { fromStageId: string; toStageId: string; requireFeasibilityOk?: boolean; minProbability?: number | null; guardNote?: string | null }) { return requestJson<{ stageTransition: StageTransition }>(`/api/workspace/pipelines/${enc(pipelineId)}/stage-transitions`, { method: "POST", body: JSON.stringify(input) }); },
    deleteStageTransition(pipelineId: string, transitionId: string) { return requestJson<{ status: "ok" }>(`/api/workspace/pipelines/${enc(pipelineId)}/stage-transitions/${enc(transitionId)}`, { method: "DELETE" }); },
    moveOpportunityPipeline(opportunityId: string, input: { pipelineId: string; stageId: string }) { return requestJson<{ opportunity: Opportunity }>(`/api/workspace/opportunities/${enc(opportunityId)}/pipeline`, { method: "PATCH", body: JSON.stringify(input) }); },

    // Карточка сделки: полное обновление (full-replace, как боевой parseOpportunityUpdateBody).
    updateOpportunity(id: string, input: OpportunityUpdateInput) { return requestJson<{ opportunity: Opportunity }>(`/api/workspace/opportunities/${enc(id)}`, { method: "PATCH", body: JSON.stringify(input) }); },
    // Проверка реализуемости: пересчёт оценки + запись в сделку (status/feasibility*). Тело не шлём.
    checkFeasibility(id: string) { return requestJson<{ opportunity: Opportunity; assessment: FeasibilityAssessment }>(`/api/workspace/opportunities/${enc(id)}/feasibility`, { method: "POST" }); },
    // Активация: создаёт проект из сделки, сделку переводит в won_closed. input опционален.
    activate(id: string, input?: ProjectActivationInput) { return requestJson<{ project: ProjectRecord }>(`/api/workspace/opportunities/${enc(id)}/activate`, { method: "POST", body: JSON.stringify(input ?? {}) }); },
    // Активные проекты (только status==="active"), сортировка activatedAt desc → createdAt desc → id desc.
    listProjects() { return requestJson<{ projects: ProjectRecord[] }>("/api/workspace/projects"); },

    // CRM-активности (лента + создание comment/task/file + смена статуса задачи).
    listActivities(entityType: CrmActivityEntityType, entityId: string) { return requestJson<CrmActivityFeed>(`/api/workspace/crm/${enc(entityType)}/${enc(entityId)}/activity`); },
    createComment(entityType: CrmActivityEntityType, entityId: string, body: string) { return requestJson<{ activity: CrmActivity }>(`/api/workspace/crm/${enc(entityType)}/${enc(entityId)}/comments`, { method: "POST", body: JSON.stringify({ body }) }); },
    createTask(entityType: CrmActivityEntityType, entityId: string, input: { title: string; body?: string | null; dueDate?: string | null; assigneeUserId?: string | null }) { return requestJson<{ activity: CrmActivity }>(`/api/workspace/crm/${enc(entityType)}/${enc(entityId)}/tasks`, { method: "POST", body: JSON.stringify(input) }); },
    createFile(entityType: CrmActivityEntityType, entityId: string, input: { title: string; fileUrl: string; body?: string | null; mimeType?: string | null; fileSizeBytes?: number | null }) { return requestJson<{ activity: CrmActivity }>(`/api/workspace/crm/${enc(entityType)}/${enc(entityId)}/files`, { method: "POST", body: JSON.stringify(input) }); },
    updateTaskStatus(entityType: CrmActivityEntityType, entityId: string, activityId: string, status: "todo" | "done") { return requestJson<{ activity: CrmActivity }>(`/api/workspace/crm/${enc(entityType)}/${enc(entityId)}/tasks/${enc(activityId)}`, { method: "PATCH", body: JSON.stringify({ status }) }); }
  };
}

export type CrmClient = ReturnType<typeof createCrmClient>;
