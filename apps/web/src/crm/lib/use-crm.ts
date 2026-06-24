"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CrmApiError, createCrmClient, type Client, type Contact, type DealStage, type Opportunity, type OpportunityCreateInput, type Product, type ProjectType } from "./crm-client";
import { createMockCrmFetch } from "./mock-crm-backend";

export type CrmLoadStatus = "loading" | "ready" | "error";
export type CrmData = {
  opportunities: Opportunity[];
  dealStages: DealStage[];
  clients: Client[];
  contacts: Contact[];
  products: Product[];
  projectTypes: ProjectType[];
};
export type CrmMutationResult = { ok: true } | { ok: false; code?: string; message: string };

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
      const [opps, stages, clients, contacts, products, ptypes] = await Promise.all([
        client.listOpportunities(),
        client.listDealStages(),
        client.listClients(),
        client.listContacts(),
        client.listProducts(),
        client.listProjectTypes()
      ]);
      setData({ opportunities: opps.opportunities, dealStages: stages.dealStages, clients: clients.clients, contacts: contacts.contacts, products: products.products, projectTypes: ptypes.projectTypes });
      setStatus("ready");
      setError(null);
    } catch (e) {
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

  const patchOpp = (o: Opportunity) => setData((d) => (d ? { ...d, opportunities: d.opportunities.map((x) => (x.id === o.id ? o : x)) } : d));

  const moveStage = useCallback((id: string, stageId: string) => guard(async () => { const r = await client.moveOpportunityStage(id, stageId); patchOpp(r.opportunity); }), [client, guard]);
  const finalize = useCallback((id: string, stt: "won_closed" | "lost_rejected", reason: string) => guard(async () => { const r = await client.finalizeOpportunity(id, stt, reason); patchOpp(r.opportunity); }), [client, guard]);
  const createOpportunity = useCallback((input: OpportunityCreateInput) => guard(async () => { const r = await client.createOpportunity(input); setData((d) => (d ? { ...d, opportunities: [r.opportunity, ...d.opportunities] } : d)); }), [client, guard]);
  const createClient = useCallback((input: { name: string; description?: string | null }) => guard(async () => { const r = await client.createClient(input); setData((d) => (d ? { ...d, clients: [r.client, ...d.clients] } : d)); }), [client, guard]);
  const updateClient = useCallback((id: string, input: Partial<{ name: string; description: string | null; status: "active" | "archived" }>) => guard(async () => { const r = await client.updateClient(id, input); setData((d) => (d ? { ...d, clients: d.clients.map((x) => (x.id === id ? r.client : x)) } : d)); }), [client, guard]);
  const createContact = useCallback((input: { clientId: string; name: string; email?: string | null; phone?: string | null; telegram?: string | null; role?: string | null }) => guard(async () => { const r = await client.createContact(input); setData((d) => (d ? { ...d, contacts: [r.contact, ...d.contacts] } : d)); }), [client, guard]);
  const updateContact = useCallback((id: string, input: Record<string, unknown>) => guard(async () => { const r = await client.updateContact(id, input); setData((d) => (d ? { ...d, contacts: d.contacts.map((x) => (x.id === id ? r.contact : x)) } : d)); }), [client, guard]);
  const createProduct = useCallback((input: { name: string; unit: string; price: number; type?: "service" | "goods"; sku?: string | null; description?: string | null }) => guard(async () => { const r = await client.createProduct(input); setData((d) => (d ? { ...d, products: [r.product, ...d.products] } : d)); }), [client, guard]);
  const updateProduct = useCallback((id: string, input: Record<string, unknown>) => guard(async () => { const r = await client.updateProduct(id, input); setData((d) => (d ? { ...d, products: d.products.map((x) => (x.id === id ? r.product : x)) } : d)); }), [client, guard]);

  return { client, data, status, error, reload: load, moveStage, finalize, createOpportunity, createClient, updateClient, createContact, updateContact, createProduct, updateProduct };
}
