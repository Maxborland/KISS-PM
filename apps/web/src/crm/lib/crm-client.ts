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

export type CrmApiClientOptions = { apiOrigin: string; fetchImpl?: typeof fetch; credentials?: RequestCredentials };

export class CrmApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: Record<string, unknown>;
  constructor(status: number, code: string, body: Record<string, unknown>) {
    super(code);
    this.name = "CrmApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/* ---- View-типы (форма боевых записей; даты пересекают провод как ISO-строки) ---- */
export type CrmStatus = "active" | "archived";

export type Client = { id: string; tenantId: string; name: string; description: string | null; status: CrmStatus; createdAt: string; updatedAt: string };
export type Contact = { id: string; tenantId: string; clientId: string; name: string; email: string | null; phone: string | null; telegram: string | null; role: string | null; status: CrmStatus; createdAt: string; updatedAt: string };
export type Product = { id: string; tenantId: string; name: string; sku: string | null; type: "service" | "goods"; unit: string; price: number; description: string | null; status: CrmStatus; createdAt: string; updatedAt: string };
export type DealStage = { id: string; tenantId: string; name: string; sortOrder: number; status: CrmStatus; createdAt: string; updatedAt: string };
export type ProjectType = { id: string; tenantId: string; name: string; description: string | null; status: CrmStatus; createdAt: string; updatedAt: string };

export type PositionDemand = { positionId: string; requiredHours: number };
export type OpportunityStatus = "new" | "feasibility" | "ready_to_activate" | "won_closed" | "lost_rejected";
export type Opportunity = {
  id: string; tenantId: string;
  clientId: string | null; primaryContactId: string | null; ownerUserId: string | null; projectTypeId: string | null; stageId: string | null;
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

export function createCrmClient(options: CrmApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = options.credentials ?? "include";

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${options.apiOrigin}${path}`, {
      ...init,
      credentials,
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", ...(init?.headers ?? {}) }
    });
    const rawText = await response.text();
    let body: Record<string, unknown> = {};
    if (rawText.length > 0) {
      try {
        const parsed: unknown = JSON.parse(rawText);
        body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { error: "invalid_json_response" };
      } catch {
        body = { error: "invalid_json_response" };
      }
    }
    if (!response.ok) {
      throw new CrmApiError(response.status, typeof body.error === "string" ? body.error : "request_failed", body);
    }
    return body as T;
  }

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

    // сделки (opportunities)
    listOpportunities() { return requestJson<{ opportunities: Opportunity[] }>("/api/workspace/opportunities"); },
    getOpportunity(id: string) { return requestJson<{ opportunity: Opportunity }>(`/api/workspace/opportunities/${enc(id)}`); },
    createOpportunity(input: OpportunityCreateInput) { return requestJson<{ opportunity: Opportunity }>("/api/workspace/opportunities", { method: "POST", body: JSON.stringify(input) }); },
    moveOpportunityStage(id: string, stageId: string) { return requestJson<{ opportunity: Opportunity }>(`/api/workspace/opportunities/${enc(id)}/stage`, { method: "PATCH", body: JSON.stringify({ stageId }) }); },
    finalizeOpportunity(id: string, status: "won_closed" | "lost_rejected", reason: string) { return requestJson<{ opportunity: Opportunity }>(`/api/workspace/opportunities/${enc(id)}/finalize`, { method: "PATCH", body: JSON.stringify({ status, reason }) }); }
    // Отложено до поверхности «Карточка сделки»: updateOpportunity (PATCH /:id — full-replace, как
    // боевой parseOpportunityUpdateBody), checkFeasibility (POST /:id/feasibility), activate
    // (POST /:id/activate → ProjectRecord), listProjects (GET /projects). Тип ProjectRecord и поля
    // feasibility* в Opportunity объявлены под них.
  };
}

export type CrmClient = ReturnType<typeof createCrmClient>;
