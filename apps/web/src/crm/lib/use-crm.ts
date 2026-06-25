"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CrmApiError, createCrmClient, type Client, type Contact, type CrmActivity, type CrmActivityEntityType, type CrmStatus, type DealStage, type FeasibilityAssessment, type Opportunity, type OpportunityCreateInput, type OpportunityUpdateInput, type Pipeline, type Product, type ProjectActivationInput, type ProjectRecord, type ProjectType, type StageTransition } from "./crm-client";
import { createMockCrmFetch } from "./mock-crm-backend";

// forbidden — отдельный статус загрузки: при CrmApiError.status===403 surface рендерит
// SurfaceState forbidden (а не error). В моке 403 теоретичен, но проводка нужна для боевого API.
export type CrmLoadStatus = "loading" | "ready" | "error" | "forbidden";
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
export type CrmMutationResult = { ok: true } | { ok: false; code?: string; message: string };
// Результат мутации, ВОЗВРАЩАЮЩЕЙ данные для UI (feasibility-оценка, проект, лента активностей).
export type CrmDataResult<T> = { ok: true; data: T } | { ok: false; code?: string; message: string };

/**
 * Работает через настоящий createCrmClient. Транспорт — contract-mock
 * (createMockCrmFetch), отдельный на каждый монтаж (изолированная сессия).
 * Переключение на боевой API = смена apiOrigin + удаление fetchImpl.
 *
 * В отличие от usePlanning: CRM без planVersion → нет conflict-ветки;
 * мутации возвращают затронутую сущность, локальный кэш точечно обновляем.
 */
export function useCrm() {
  const fetchRef = useRef<typeof fetch | null>(null);
  if (fetchRef.current === null) fetchRef.current = createMockCrmFetch();
  const clientRef = useRef<ReturnType<typeof createCrmClient> | null>(null);
  if (clientRef.current === null) clientRef.current = createCrmClient({ apiOrigin: "", fetchImpl: fetchRef.current });
  const client = clientRef.current;

  const [data, setData] = useState<CrmData | null>(null);
  const [status, setStatus] = useState<CrmLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
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
      setData({ opportunities: opps.opportunities, dealStages: stages.dealStages, clients: clients.clients, contacts: contacts.contacts, products: products.products, projectTypes: ptypes.projectTypes, pipelines: pipelines.pipelines, stageTransitions, projects });
      setStatus("ready");
      setError(null);
    } catch (e) {
      // 403 → forbidden (нет прав на раздел), иначе — обычная ошибка загрузки.
      if (e instanceof CrmApiError && e.status === 403) {
        setStatus("forbidden");
        setError(e.code);
        return;
      }
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  // обёртка мутации: ошибки CrmApiError → {ok:false, code, message}
  const guard = useCallback(async (fn: () => Promise<void>): Promise<CrmMutationResult> => {
    try {
      await fn();
      return { ok: true };
    } catch (e) {
      if (e instanceof CrmApiError) return { ok: false, code: e.code, message: e.code };
      return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
    }
  }, []);

  // как guard, но возвращает данные мутации для UI (feasibility-оценка, проект, активность).
  const guardData = useCallback(async <T,>(fn: () => Promise<T>): Promise<CrmDataResult<T>> => {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (e) {
      if (e instanceof CrmApiError) return { ok: false, code: e.code, message: e.code };
      return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
    }
  }, []);

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
  // Полное обновление сделки (через guard — данные UI не нужны, обновляем кэш).
  const updateOpportunity = useCallback((id: string, input: OpportunityUpdateInput) => guard(async () => { const r = await client.updateOpportunity(id, input); patchOpp(r.opportunity); }), [client, guard]);
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
