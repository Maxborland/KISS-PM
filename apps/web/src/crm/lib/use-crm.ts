"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { guardData, guardMutation, type MutationDataResult, type MutationResult } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import { useResource, type LoadStatus } from "../../lib/use-resource";
import { CrmApiError, createCrmClient, type Client, type Contact, type CrmActivity, type CrmActivityEntityType, type CrmClient, type CrmStatus, type CrmUser, type DealStage, type FeasibilityAssessment, type Opportunity, type OpportunityCreateInput, type OpportunityUpdateInput, type Pipeline, type Product, type ProjectActivationInput, type ProjectRecord, type ProjectType, type StageTransition } from "./crm-client";
import { createMockCrmFetch } from "./mock-crm-backend";
import { useCrmRuntime } from "./crm-runtime";

// forbidden — отдельный статус загрузки: при CrmApiError.status===403 surface рендерит
// SurfaceState forbidden (а не error). В моке 403 теоретичен, но проводка нужна для боевого API.
// Общий LoadStatus ядра apps/web/src/lib/use-resource.ts (403→forbidden делает useResource).
export type CrmLoadStatus = LoadStatus;
export type CrmData = {
  opportunities: Opportunity[];
  dealStages: DealStage[];
  clients: Client[];
  contacts: Contact[];
  products: Product[];
  projectTypes: ProjectType[];
  pipelines: Pipeline[];
  stageTransitions: StageTransition[]; // плоский список переходов ВСЕХ воронок
  projects: ProjectRecord[]; // активные проекты (источник списка «Проекты» + активаций сделок)
};
export type CrmMutationResult = MutationResult;
// Результат мутации, ВОЗВРАЩАЮЩЕЙ данные для UI (feasibility-оценка, проект, лента активностей).
export type CrmDataResult<T> = MutationDataResult<T>;

/**
 * Работает через настоящий createCrmClient. Транспорт — contract-mock
 * (createMockCrmFetch), отдельный на каждый монтаж (изолированная сессия).
 * Переключение на боевой API = смена apiOrigin + удаление fetchImpl.
 *
 * В отличие от usePlanning: CRM без planVersion → нет conflict-ветки;
 * мутации возвращают затронутую сущность, локальный кэш точечно обновляем.
 */
/* Изолированный клиент на каждый монтаж: в mock-режиме — свой fetchImpl-мок (отдельная
   in-memory сессия), в live — createCrmClient без fetchImpl → боевой /api/* с cookie-сессией.
   Транспорт выбирается через CrmRuntime (provider = live, без провайдера = mock).
   Зеркало useWorkspaceClient/usePlanning. */
function useCrmClient(): CrmClient {
  const { live } = useCrmRuntime();
  return useDomainClient(live, createCrmClient, createMockCrmFetch);
}

export function useCrm() {
  const client = useCrmClient();

  // fetcher для общего load-state (useResource владеет data/status/error и 403→forbidden).
  const fetcher = useCallback(async (): Promise<CrmData> => {
    const [opps, stages, clients, contacts, products, ptypes, pipelines] = await Promise.all([
      client.listOpportunities(),
      client.listDealStages(),
      client.listClients(),
      client.listContacts(),
      client.listProducts(),
      client.listProjectTypes(),
      client.listPipelines()
    ]);
    // Проекты — НЕ в основном Promise.all: /api/workspace/projects независимо гейтится
    // canReadProjects и отдаёт 403. Пользователь с CRM-правами, но без projects.read не
    // должен ронять весь раздел — глотаем 403 → пустой список, прочие ошибки пробрасываем.
    const projects = await client
      .listProjects()
      .then((r) => r.projects)
      .catch((e) => (e instanceof CrmApiError && e.status === 403 ? [] : Promise.reject(e)));
    // Переходы — после получения воронок: грузим правила каждой и собираем плоский список.
    const transitionsByPipeline = await Promise.all(
      pipelines.pipelines.map((p) => client.listStageTransitions(p.id))
    );
    const stageTransitions = transitionsByPipeline.flatMap((r) => r.stageTransitions);
    return { opportunities: opps.opportunities, dealStages: stages.dealStages, clients: clients.clients, contacts: contacts.contacts, products: products.products, projectTypes: ptypes.projectTypes, pipelines: pipelines.pipelines, stageTransitions, projects };
  }, [client]);
  const { data, status, error, setData, reload: load } = useResource(fetcher);

  // обёртка мутации: ошибки CrmApiError → {ok:false, code, message}
  const guard = guardMutation;
  // guardData — общий хелпер ядра (как guard, но возвращает данные мутации для UI).

  const patchOpp = (o: Opportunity) => setData((d) => (d ? { ...d, opportunities: d.opportunities.map((x) => (x.id === o.id ? o : x)) } : d));

  const moveStage = useCallback((id: string, stageId: string) => guard(async () => { const r = await client.moveOpportunityStage(id, stageId); patchOpp(r.opportunity); }), [client, guard]);
  // Мультиворонки: перенос сделки в другую воронку на её стадию (cross-pipeline) — отказ всегда 409 reason (guard мапит CrmApiError.code).
  const movePipeline = useCallback((id: string, pipelineId: string, stageId: string) => guard(async () => { const r = await client.moveOpportunityPipeline(id, { pipelineId, stageId }); patchOpp(r.opportunity); }), [client, guard]);
  const createPipeline = useCallback((input: { name: string; sortOrder: number; description?: string | null; isDefault?: boolean; status?: CrmStatus }) => guard(async () => { const r = await client.createPipeline(input); setData((d) => (d ? { ...d, pipelines: [...d.pipelines, r.pipeline] } : d)); }), [client, guard]);
  const createStageTransition = useCallback((pipelineId: string, input: { fromStageId: string; toStageId: string; requireFeasibilityOk?: boolean; minProbability?: number | null; guardNote?: string | null }) => guard(async () => { const r = await client.createStageTransition(pipelineId, input); setData((d) => (d ? { ...d, stageTransitions: [...d.stageTransitions, r.stageTransition] } : d)); }), [client, guard]);
  const deleteStageTransition = useCallback((pipelineId: string, transitionId: string) => guard(async () => { await client.deleteStageTransition(pipelineId, transitionId); setData((d) => (d ? { ...d, stageTransitions: d.stageTransitions.filter((x) => x.id !== transitionId) } : d)); }), [client, guard]);
  const finalize = useCallback((id: string, stt: "won_closed" | "lost_rejected", reason: string) => guard(async () => { const r = await client.finalizeOpportunity(id, stt, reason); patchOpp(r.opportunity); }), [client, guard]);
  const createOpportunity = useCallback((input: OpportunityCreateInput) => guard(async () => { const r = await client.createOpportunity(input); setData((d) => (d ? { ...d, opportunities: [r.opportunity, ...d.opportunities] } : d)); }), [client, guard]);
  const createClient = useCallback((input: { name: string; description?: string | null }) => guard(async () => { const r = await client.createClient(input); setData((d) => (d ? { ...d, clients: [r.client, ...d.clients] } : d)); }), [client, guard]);
  const updateClient = useCallback((id: string, input: Partial<{ name: string; description: string | null; status: "active" | "archived" }>) => guard(async () => { const r = await client.updateClient(id, input); setData((d) => (d ? { ...d, clients: d.clients.map((x) => (x.id === id ? r.client : x)) } : d)); }), [client, guard]);
  const createContact = useCallback((input: { clientId: string; name: string; email?: string | null; phone?: string | null; telegram?: string | null; role?: string | null }) => guard(async () => { const r = await client.createContact(input); setData((d) => (d ? { ...d, contacts: [r.contact, ...d.contacts] } : d)); }), [client, guard]);
  const updateContact = useCallback((id: string, input: Record<string, unknown>) => guard(async () => { const r = await client.updateContact(id, input); setData((d) => (d ? { ...d, contacts: d.contacts.map((x) => (x.id === id ? r.contact : x)) } : d)); }), [client, guard]);
  const createProduct = useCallback((input: { name: string; unit: string; price: number; type?: "service" | "goods"; sku?: string | null; description?: string | null }) => guard(async () => { const r = await client.createProduct(input); setData((d) => (d ? { ...d, products: [r.product, ...d.products] } : d)); }), [client, guard]);
  const updateProduct = useCallback((id: string, input: Record<string, unknown>) => guard(async () => { const r = await client.updateProduct(id, input); setData((d) => (d ? { ...d, products: d.products.map((x) => (x.id === id ? r.product : x)) } : d)); }), [client, guard]);

  // ---- Карточка сделки ----
  // Полное обновление сделки возвращает каноническую серверную запись, чтобы форма
  // синхронизировалась с trim/rounding и не оставалась ложно dirty после успешного Save.
  const updateOpportunity = useCallback((id: string, input: OpportunityUpdateInput): Promise<CrmDataResult<Opportunity>> => guardData(async () => {
    const r = await client.updateOpportunity(id, input);
    patchOpp(r.opportunity);
    return r.opportunity;
  }), [client, guardData]);
  // Проверка реализуемости: возвращает оценку для UI + обновляет сделку в кэше (status/feasibility*).
  const checkFeasibility = useCallback((id: string): Promise<CrmDataResult<FeasibilityAssessment>> => guardData(async () => { const r = await client.checkFeasibility(id); patchOpp(r.opportunity); return r.assessment; }), [client, guardData]);
  // Активация: возвращает проект для UI + переводит сделку в won_closed + добавляет проект в кэш.
  const activate = useCallback((id: string, input?: ProjectActivationInput): Promise<CrmDataResult<ProjectRecord>> => guardData(async () => {
    const r = await client.activate(id, input);
    setData((d) => (d ? { ...d, projects: [r.project, ...d.projects], opportunities: d.opportunities.map((x) => (x.id === id ? { ...x, status: "won_closed" as const } : x)) } : d));
    return r.project;
  }), [client, guardData]);
  // Лента активностей сущности (для UI; кэш активностей в data не держим — они per-entity).
  const loadActivities = useCallback((entityType: CrmActivityEntityType, entityId: string): Promise<CrmDataResult<CrmActivity[]>> => guardData(async () => { const r = await client.listActivities(entityType, entityId); return r.activities; }), [client, guardData]);
  const createComment = useCallback((entityType: CrmActivityEntityType, entityId: string, body: string): Promise<CrmDataResult<CrmActivity>> => guardData(async () => { const r = await client.createComment(entityType, entityId, body); return r.activity; }), [client, guardData]);
  const createTask = useCallback((entityType: CrmActivityEntityType, entityId: string, input: { title: string; body?: string | null; dueDate?: string | null; assigneeUserId?: string | null }): Promise<CrmDataResult<CrmActivity>> => guardData(async () => { const r = await client.createTask(entityType, entityId, input); return r.activity; }), [client, guardData]);
  const createFile = useCallback((entityType: CrmActivityEntityType, entityId: string, input: { title: string; fileUrl: string; body?: string | null; mimeType?: string | null; fileSizeBytes?: number | null }): Promise<CrmDataResult<CrmActivity>> => guardData(async () => { const r = await client.createFile(entityType, entityId, input); return r.activity; }), [client, guardData]);
  const updateTaskStatus = useCallback((entityType: CrmActivityEntityType, entityId: string, activityId: string, status: "todo" | "done"): Promise<CrmDataResult<CrmActivity>> => guardData(async () => { const r = await client.updateTaskStatus(entityType, entityId, activityId, status); return r.activity; }), [client, guardData]);

  return { client, data, status, error, reload: load, moveStage, movePipeline, finalize, createOpportunity, createClient, updateClient, createContact, updateContact, createProduct, updateProduct, createPipeline, createStageTransition, deleteStageTransition, updateOpportunity, checkFeasibility, activate, loadActivities, createComment, createTask, createFile, updateTaskStatus };
}

// ---- useOpportunities: лёгкий срез CRM для сводок (дашборд) ----
// Один запрос GET /api/workspace/opportunities под ОДНИМ правом
// tenant.opportunities.read. Полный useCrm() тянет 8+ ручек, каждая под своим
// правом: 403 на products/contacts гасил бы сигналы по сделкам целиком.
export function useOpportunities() {
  const client = useCrmClient();
  const loader = useCallback(async () => (await client.listOpportunities()).opportunities, [client]);
  const { data, status, error, reload } = useResource(loader);
  return { data, status, error, reload };
}

// ---- useCrmUsers: справочник пользователей (владелец/автор/исполнитель). mock=CRM_USERS, live=GET /api/workspace/users ----
// Зеркало useWorkspaceUsers: useState+useEffect+useMemo, отдаёт { list, byId, name, indexOf }.
export type CrmUsersIndex = {
  list: CrmUser[];
  byId: Map<string, CrmUser>;
  name: (id: string | null) => string;
  indexOf: (id: string | null) => number;
};
export function useCrmUsers(): CrmUsersIndex {
  const client = useCrmClient();
  const [list, setList] = useState<CrmUser[]>([]);
  useEffect(() => {
    let active = true;
    void client.listUsers().then((r) => { if (active) setList(r.users); }).catch(() => { if (active) setList([]); });
    return () => { active = false; };
  }, [client]);
  return useMemo(() => {
    const byId = new Map(list.map((u) => [u.id, u]));
    return {
      list,
      byId,
      name: (id: string | null) => (id ? byId.get(id)?.name ?? id : "—"),
      indexOf: (id: string | null) => (id ? list.findIndex((u) => u.id === id) : -1)
    };
  }, [list]);
}
