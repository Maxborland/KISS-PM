/* ============================================================
   Contract-grounded mock backend для CRM (Storybook).

   ЧЕСТНОСТЬ: in-memory мок, реализующий реальный REST-контракт
   /api/workspace/{clients,contacts,products,deal-stages,project-types,
   opportunities}. Компонент работает через настоящий createCrmClient
   (с fetchImpl), поэтому переключение на боевой API = смена apiOrigin.

   CRM — плоский CRUD без optimistic-concurrency (нет planVersion), поэтому
   это набор list/get/upsert/transition-хендлеров над in-memory массивами,
   а НЕ движок. Валидация и коды ошибок зеркалят apps/api (crmParsers /
   projectIntakeParsers): контакт только к активному клиенту, резолв связей
   сделки, lock финальных статусов, и т.д.
   ============================================================ */

import type { Client, Contact, DealStage, Opportunity, PositionDemand, Product, ProjectType } from "./crm-client";

const TENANT = "tenant-alpha";
const ID_RE = /^[a-z][a-z0-9-]{2,80}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INT = 2_147_483_647; // maxPostgresInteger (боевой parsePositiveInteger)
const MAX_DEMAND_HOURS = 100_000;
const MAX_HORIZON_DAYS = 730;
const CURRENT_ACTOR_ID = "u-anna"; // в проде владелец по умолчанию = actor сессии; в моке — фиксированный «текущий пользователь»
const posInt = (v: unknown, max = MAX_INT): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= max;
const dayDiff = (a: string, b: string) => Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/* Пользователи рабочей области — справочные данные для отображения владельца сделки
   (на боевом — /api/workspace/users; здесь экспортируем, как RESOURCES в планировании). */
export type CrmUser = { id: string; name: string; positionId: string; positionName: string };
export const CRM_USERS: CrmUser[] = [
  { id: "u-anna", name: "Анна П.", positionId: "pm", positionName: "Менеджер проектов" },
  { id: "u-ivan", name: "Иван И.", positionId: "sales", positionName: "Менеджер по продажам" },
  { id: "u-sergey", name: "Сергей П.", positionId: "lead", positionName: "Тимлид" }
];

const nowIso = () => new Date().toISOString();
let SEQ = 0;
const genId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(SEQ += 1).toString(36)}`;

type Store = {
  clients: Client[];
  contacts: Contact[];
  products: Product[];
  dealStages: DealStage[];
  projectTypes: ProjectType[];
  opportunities: Opportunity[];
};

function seed(): Store {
  const t = "2026-01-12T09:00:00.000Z";
  const client = (id: string, name: string): Client => ({ id, tenantId: TENANT, name, description: null, status: "active", createdAt: t, updatedAt: t });
  const contact = (id: string, clientId: string, name: string, email: string, role: string): Contact => ({ id, tenantId: TENANT, clientId, name, email, phone: null, telegram: null, role, status: "active", createdAt: t, updatedAt: t });
  const product = (id: string, name: string, type: "service" | "goods", unit: string, price: number): Product => ({ id, tenantId: TENANT, name, sku: null, type, unit, price, description: null, status: "active", createdAt: t, updatedAt: t });
  const stage = (id: string, name: string, sortOrder: number): DealStage => ({ id, tenantId: TENANT, name, sortOrder, status: "active", createdAt: t, updatedAt: t });
  const ptype = (id: string, name: string): ProjectType => ({ id, tenantId: TENANT, name, description: null, status: "active", createdAt: t, updatedAt: t });

  const dealStages = [
    stage("stage-lead", "Лид", 1),
    stage("stage-qual", "Квалификация", 2),
    stage("stage-proposal", "КП", 3),
    stage("stage-contract", "Договор", 4),
    stage("stage-won", "Закрыто", 5)
  ];
  const clients = [
    client("client-romashka", "ООО «Ромашка»"),
    client("client-sever", "АО «Север»"),
    client("client-gamma", "Гамма Системс"),
    client("client-delta", "Дельта Ритейл")
  ];
  const contacts = [
    contact("ctc-romashka", "client-romashka", "Петрова Анна", "anna@romashka.ru", "Директор по ИТ"),
    contact("ctc-sever", "client-sever", "Иванов Олег", "oleg@sever.ru", "Руководитель проекта"),
    contact("ctc-gamma", "client-gamma", "Сидорова Мария", "maria@gamma.io", "CTO"),
    contact("ctc-delta", "client-delta", "Кузнецов Дмитрий", "dk@delta.shop", "Операционный директор")
  ];
  const products = [
    product("prd-portal", "Внедрение портала", "service", "проект", 4_800_000),
    product("prd-support", "Техническая поддержка", "service", "месяц", 180_000),
    product("prd-license", "Лицензия платформы", "goods", "шт", 95_000),
    product("prd-audit", "Аудит процессов", "service", "проект", 650_000)
  ];
  const projectTypes = [ptype("pt-impl", "Внедрение"), ptype("pt-support", "Сопровождение")];

  const opp = (o: {
    id: string; clientId: string; contactId: string; ownerUserId: string; stageId: string; title: string;
    contractValue: number; rate: number; probability: number; status: Opportunity["status"]; start: string; finish: string; positionId: string; hours: number;
  }): Opportunity => {
    const c = clients.find((x) => x.id === o.clientId)!;
    const ct = contacts.find((x) => x.id === o.contactId)!;
    return {
      id: o.id, tenantId: TENANT,
      clientId: o.clientId, primaryContactId: o.contactId, ownerUserId: o.ownerUserId, projectTypeId: "pt-impl", stageId: o.stageId,
      clientName: c.name, contactName: ct.name, title: o.title, projectType: "Внедрение", description: null,
      plannedStart: o.start, plannedFinish: o.finish,
      contractValue: o.contractValue, plannedHourlyRate: o.rate, plannedHours: Math.floor(o.contractValue / o.rate), probability: o.probability,
      status: o.status, templateId: null, feasibilityStatus: null, feasibilityResult: null, feasibilityCheckedAt: null,
      createdAt: t, updatedAt: t, demand: [{ positionId: o.positionId, requiredHours: o.hours }], customFieldValues: {}
    };
  };
  const opportunities = [
    opp({ id: "opp-2207", clientId: "client-romashka", contactId: "ctc-romashka", ownerUserId: "u-anna", stageId: "stage-contract", title: "Производственный портал · Релиз 2", contractValue: 4_800_000, rate: 4000, probability: 80, status: "ready_to_activate", start: "2026-03-02", finish: "2026-07-12", positionId: "backend", hours: 1100 }),
    opp({ id: "opp-sever-erp", clientId: "client-sever", contactId: "ctc-sever", ownerUserId: "u-ivan", stageId: "stage-proposal", title: "Интеграция ERP", contractValue: 2_400_000, rate: 3800, probability: 55, status: "feasibility", start: "2026-04-01", finish: "2026-08-15", positionId: "backend", hours: 600 }),
    opp({ id: "opp-gamma-mvp", clientId: "client-gamma", contactId: "ctc-gamma", ownerUserId: "u-sergey", stageId: "stage-qual", title: "Мобильное приложение · MVP", contractValue: 1_600_000, rate: 3500, probability: 40, status: "new", start: "2026-05-04", finish: "2026-09-01", positionId: "frontend", hours: 420 }),
    opp({ id: "opp-delta-audit", clientId: "client-delta", contactId: "ctc-delta", ownerUserId: "u-ivan", stageId: "stage-lead", title: "Аудит и роадмап", contractValue: 650_000, rate: 5000, probability: 25, status: "new", start: "2026-03-16", finish: "2026-05-01", positionId: "analyst", hours: 120 }),
    opp({ id: "opp-romashka-support", clientId: "client-romashka", contactId: "ctc-romashka", ownerUserId: "u-anna", stageId: "stage-lead", title: "Поддержка портала · год", contractValue: 2_160_000, rate: 3000, probability: 30, status: "new", start: "2026-07-13", finish: "2027-07-12", positionId: "backend", hours: 700 }),
    opp({ id: "opp-gamma-bi", clientId: "client-gamma", contactId: "ctc-gamma", ownerUserId: "u-sergey", stageId: "stage-proposal", title: "BI-витрина продаж", contractValue: 1_950_000, rate: 4200, probability: 60, status: "new", start: "2026-04-20", finish: "2026-07-30", positionId: "backend", hours: 460 }),
    opp({ id: "opp-sever-portal", clientId: "client-sever", contactId: "ctc-sever", ownerUserId: "u-ivan", stageId: "stage-won", title: "Портал самообслуживания", contractValue: 3_300_000, rate: 4000, probability: 100, status: "won_closed", start: "2026-01-15", finish: "2026-04-30", positionId: "frontend", hours: 800 })
  ];

  return { clients, contacts, products, dealStages, projectTypes, opportunities };
}

/* ---- Транспорт: fetchImpl, совместимый с createCrmClient ---- */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (error: string, status: number) => json({ error }, status);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isFinal = (o: Opportunity) => o.status === "won_closed" || o.status === "lost_rejected";

export function createMockCrmFetch(): typeof fetch {
  const db = seed();

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]!;
    let body: Record<string, unknown> = {};
    if (init?.body) { try { const p: unknown = JSON.parse(String(init.body)); if (p && typeof p === "object" && !Array.isArray(p)) body = p as Record<string, unknown>; } catch { return err("invalid_json", 400); } }

    /* ---- справочники: deal-stages, project-types (read-only сид) ---- */
    if (method === "GET" && path === "/api/workspace/deal-stages") return json({ dealStages: [...db.dealStages].sort((a, b) => a.sortOrder - b.sortOrder) });
    if (method === "GET" && path === "/api/workspace/project-types") return json({ projectTypes: db.projectTypes });

    /* ---- clients ---- */
    if (path === "/api/workspace/clients" && method === "GET") return json({ clients: db.clients });
    if (path === "/api/workspace/clients" && method === "POST") {
      const name = str(body.name);
      if (!name || name.length > 160) return err("invalid_client_name", 400);
      const c: Client = { id: genId("client"), tenantId: TENANT, name, description: body.description == null ? null : str(body.description) || null, status: body.status === "archived" ? "archived" : "active", createdAt: nowIso(), updatedAt: nowIso() };
      db.clients.unshift(c);
      return json({ client: c }, 201);
    }
    const clientPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/clients\/([^/]+)$/) : null;
    if (clientPatch) {
      const c = db.clients.find((x) => x.id === decodeURIComponent(clientPatch[1]!));
      if (!c) return err("client_not_found", 404);
      if (typeof body.name === "string") { if (!str(body.name) || str(body.name).length > 160) return err("invalid_client_name", 400); c.name = str(body.name); }
      if ("description" in body) c.description = body.description == null ? null : str(body.description) || null;
      if (body.status === "active" || body.status === "archived") c.status = body.status;
      c.updatedAt = nowIso();
      return json({ client: c });
    }

    /* ---- contacts ---- */
    if (path === "/api/workspace/contacts" && method === "GET") return json({ contacts: db.contacts });
    if (path === "/api/workspace/contacts" && method === "POST") {
      const clientId = str(body.clientId);
      const name = str(body.name);
      if (!ID_RE.test(clientId)) return err("invalid_client_id", 400);
      if (!name || name.length > 160) return err("invalid_contact_name", 400);
      const email = body.email == null ? null : str(body.email).toLowerCase() || null;
      if (email && (email.length > 254 || !EMAIL_RE.test(email))) return err("invalid_contact_email", 400); // как боевой: lowercase + emailPattern
      const client = db.clients.find((x) => x.id === clientId);
      if (!client || client.status !== "active") return err("client_not_found", 404); // контакт только к АКТИВНОМУ клиенту
      const c: Contact = { id: genId("ctc"), tenantId: TENANT, clientId, name, email, phone: body.phone == null ? null : str(body.phone) || null, telegram: body.telegram == null ? null : str(body.telegram) || null, role: body.role == null ? null : str(body.role) || null, status: "active", createdAt: nowIso(), updatedAt: nowIso() };
      db.contacts.unshift(c);
      return json({ contact: c }, 201);
    }
    const contactPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/contacts\/([^/]+)$/) : null;
    if (contactPatch) {
      const c = db.contacts.find((x) => x.id === decodeURIComponent(contactPatch[1]!));
      if (!c) return err("contact_not_found", 404);
      if (typeof body.clientId === "string" && str(body.clientId) !== c.clientId) {
        const client = db.clients.find((x) => x.id === str(body.clientId));
        if (!client || client.status !== "active") return err("client_not_found", 404);
        c.clientId = str(body.clientId);
      }
      if ("email" in body) { const em = body.email == null ? null : str(body.email).toLowerCase() || null; if (em && (em.length > 254 || !EMAIL_RE.test(em))) return err("invalid_contact_email", 400); c.email = em; }
      for (const k of ["name", "phone", "telegram", "role"] as const) if (k in body) (c[k] as string | null) = body[k] == null ? null : str(body[k]) || (k === "name" ? c.name : null);
      if (body.status === "active" || body.status === "archived") c.status = body.status;
      c.updatedAt = nowIso();
      return json({ contact: c });
    }

    /* ---- products ---- */
    if (path === "/api/workspace/products" && method === "GET") return json({ products: db.products });
    if (path === "/api/workspace/products" && method === "POST") {
      const name = str(body.name);
      const unit = str(body.unit);
      const price = body.price;
      if (!name || name.length > 160) return err("invalid_product_name", 400);
      if (!unit || unit.length > 40) return err("invalid_product_unit", 400);
      if (!posInt(price)) return err("invalid_product_price", 400);
      const p: Product = { id: genId("prd"), tenantId: TENANT, name, sku: body.sku == null ? null : str(body.sku) || null, type: body.type === "goods" ? "goods" : "service", unit, price, description: body.description == null ? null : str(body.description) || null, status: "active", createdAt: nowIso(), updatedAt: nowIso() };
      db.products.unshift(p);
      return json({ product: p }, 201);
    }
    const productPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/products\/([^/]+)$/) : null;
    if (productPatch) {
      const p = db.products.find((x) => x.id === decodeURIComponent(productPatch[1]!));
      if (!p) return err("product_not_found", 404);
      if (typeof body.name === "string") { if (!str(body.name)) return err("invalid_product_name", 400); p.name = str(body.name); }
      if (typeof body.price === "number") { if (!posInt(body.price)) return err("invalid_product_price", 400); p.price = body.price; }
      if (body.type === "service" || body.type === "goods") p.type = body.type;
      if (typeof body.unit === "string" && str(body.unit)) p.unit = str(body.unit);
      if ("sku" in body) p.sku = body.sku == null ? null : str(body.sku) || null;
      if (body.status === "active" || body.status === "archived") p.status = body.status;
      p.updatedAt = nowIso();
      return json({ product: p });
    }

    /* ---- opportunities (сделки) ---- */
    if (path === "/api/workspace/opportunities" && method === "GET") return json({ opportunities: db.opportunities });
    if (path === "/api/workspace/opportunities" && method === "POST") {
      const clientId = str(body.clientId), contactId = str(body.primaryContactId), projectTypeId = str(body.projectTypeId), stageId = str(body.stageId), title = str(body.title);
      // формат-валидация (как parseOpportunityFields): сперва 400 invalid_*, и только потом резолв 404
      if (!ID_RE.test(clientId)) return err("invalid_client_id", 400);
      if (!ID_RE.test(contactId)) return err("invalid_primary_contact_id", 400);
      if (!ID_RE.test(projectTypeId)) return err("invalid_project_type_id", 400);
      if (!ID_RE.test(stageId)) return err("invalid_deal_stage_id", 400);
      if (!title || title.length > 160) return err("invalid_opportunity_title", 400);
      const start = str(body.plannedStart), finish = str(body.plannedFinish);
      if (!DATE_RE.test(start) || !DATE_RE.test(finish) || finish < start || dayDiff(start, finish) > MAX_HORIZON_DAYS) return err("invalid_planned_dates", 400);
      const contractValue = body.contractValue, rate = body.plannedHourlyRate, probability = body.probability;
      if (!posInt(contractValue)) return err("invalid_contract_value", 400);
      if (!posInt(rate)) return err("invalid_planned_hourly_rate", 400);
      if (typeof probability !== "number" || !Number.isInteger(probability) || probability < 0 || probability > 100) return err("invalid_probability", 400);
      const ownerProvided = body.ownerUserId != null;
      const ownerUserId = ownerProvided ? str(body.ownerUserId) : CURRENT_ACTOR_ID;
      if (ownerProvided && !ID_RE.test(ownerUserId)) return err("invalid_owner_user_id", 400);
      // demand: 1..12 строк, positionId по формату, часы 1..100000, без дублей (как parseDemand)
      const demandRaw = Array.isArray(body.demand) ? (body.demand as Array<{ positionId?: unknown; requiredHours?: unknown }>) : [];
      if (demandRaw.length < 1 || demandRaw.length > 12) return err("invalid_demand", 400);
      const seenPos = new Set<string>();
      const demand: PositionDemand[] = [];
      for (const d of demandRaw) {
        const positionId = str(d.positionId);
        if (!ID_RE.test(positionId)) return err("invalid_demand_position", 400);
        if (!posInt(d.requiredHours, MAX_DEMAND_HOURS)) return err("invalid_demand_hours", 400);
        if (seenPos.has(positionId)) return err("duplicate_demand_position", 400);
        seenPos.add(positionId);
        demand.push({ positionId, requiredHours: d.requiredHours as number });
      }
      // резолв связей — 404 (как боевой resolveOpportunityLinks), включая владельца
      const client = db.clients.find((x) => x.id === clientId);
      if (!client || client.status !== "active") return err("client_not_found", 404);
      const contact = db.contacts.find((x) => x.id === contactId);
      if (!contact || contact.status !== "active" || contact.clientId !== client.id) return err("contact_not_found", 404);
      const ptype = db.projectTypes.find((x) => x.id === projectTypeId);
      if (!ptype || ptype.status !== "active") return err("project_type_not_found", 404);
      const stage = db.dealStages.find((x) => x.id === stageId);
      if (!stage || stage.status !== "active") return err("deal_stage_not_found", 404);
      if (ownerProvided && !CRM_USERS.some((u) => u.id === ownerUserId)) return err("owner_user_not_found", 404);
      const o: Opportunity = {
        id: genId("opp"), tenantId: TENANT,
        clientId, primaryContactId: contactId, ownerUserId, projectTypeId, stageId,
        clientName: client.name, contactName: contact.name, title, projectType: ptype.name, description: body.description == null ? null : str(body.description) || null,
        plannedStart: start, plannedFinish: finish,
        contractValue, plannedHourlyRate: rate, plannedHours: Math.floor(contractValue / rate), probability,
        status: "new", templateId: null, feasibilityStatus: null, feasibilityResult: null, feasibilityCheckedAt: null,
        createdAt: nowIso(), updatedAt: nowIso(),
        demand, customFieldValues: {}
      };
      db.opportunities.unshift(o);
      return json({ opportunity: o }, 201);
    }
    const oppGet = method === "GET" ? path.match(/^\/api\/workspace\/opportunities\/([^/]+)$/) : null;
    if (oppGet) {
      const o = db.opportunities.find((x) => x.id === decodeURIComponent(oppGet[1]!));
      return o ? json({ opportunity: o }) : err("opportunity_not_found", 404);
    }
    const oppStage = method === "PATCH" ? path.match(/^\/api\/workspace\/opportunities\/([^/]+)\/stage$/) : null;
    if (oppStage) {
      const stageId = str(body.stageId);
      if (!ID_RE.test(stageId)) return err("invalid_deal_stage_id", 400); // формат до резолва (как parseDealStageChangeBody)
      const o = db.opportunities.find((x) => x.id === decodeURIComponent(oppStage[1]!));
      if (!o) return err("opportunity_not_found", 404);
      if (isFinal(o)) return err("opportunity_stage_locked", 409);
      const stage = db.dealStages.find((x) => x.id === stageId);
      if (!stage || stage.status !== "active") return err("deal_stage_not_found", 404);
      o.stageId = stageId; o.updatedAt = nowIso();
      return json({ opportunity: o });
    }
    const oppFinalize = method === "PATCH" ? path.match(/^\/api\/workspace\/opportunities\/([^/]+)\/finalize$/) : null;
    if (oppFinalize) {
      const o = db.opportunities.find((x) => x.id === decodeURIComponent(oppFinalize[1]!));
      if (!o) return err("opportunity_not_found", 404);
      if (isFinal(o)) return err("opportunity_final_action_locked", 409);
      if (body.status !== "won_closed" && body.status !== "lost_rejected") return err("invalid_opportunity_final_status", 400);
      if (!str(body.reason)) return err("invalid_opportunity_final_reason", 400);
      o.status = body.status; o.updatedAt = nowIso();
      return json({ opportunity: o });
    }
    // PATCH /opportunities/:id (полное обновление) намеренно НЕ реализован здесь: боевой контракт —
    // full-replace через parseOpportunityUpdateBody (резолв связей + ре-денормализация имён + пересчёт
    // plannedHours от value И rate). Реализуем вместе с поверхностью «Карточка сделки», чтобы не
    // вводить частичный merge, расходящийся с боем. До тех пор такой PATCH отдаёт not_found.

    return err("not_found", 404);
  };

  return mockFetch;
}
