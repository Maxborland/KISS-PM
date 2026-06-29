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

import { assessOpportunityFeasibility, calculatePlannedHours, evaluatePipelineChange, evaluateStageTransition, type OpportunityFeasibilityAssessment } from "@kiss-pm/domain";

import type { Client, Contact, CrmActivity, CrmActivityEntityType, DealStage, Opportunity, Pipeline, PositionDemand, Product, ProjectRecord, ProjectType, StageTransition } from "./crm-client";

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

/* Позиции (должности) с числом активных исполнителей — справочник для оценки реализуемости.
   id совпадают с positionId в demand сидовых сделок. Боевой эквивалент: listPositions × активные users.
   activeUsers подобраны так, чтобы демо давало РАЗНЫЕ статусы (ok/warning/conflict) — см. сид сделок ниже. */
export type CrmPosition = { id: string; name: string; activeUsers: number };
export const POSITIONS: CrmPosition[] = [
  { id: "backend", name: "Backend", activeUsers: 6 },
  { id: "frontend", name: "Frontend", activeUsers: 4 },
  { id: "analyst", name: "Аналитик", activeUsers: 3 }
];

// Домен принимает Date; мок хранит даты как ISO 'YYYY-MM-DD'. Конвертация в UTC-полночь.
const toDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

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
  pipelines: Pipeline[];
  stageTransitions: StageTransition[];
  projects: ProjectRecord[]; // активированные проекты (источник listProjects + activeProjectReservations)
  activities: CrmActivity[]; // CRM-активности (даты уже в ISO — сериализованная форма)
};

function seed(): Store {
  const t = "2026-01-12T09:00:00.000Z";
  const client = (id: string, name: string): Client => ({ id, tenantId: TENANT, name, description: null, status: "active", createdAt: t, updatedAt: t });
  const contact = (id: string, clientId: string, name: string, email: string, role: string): Contact => ({ id, tenantId: TENANT, clientId, name, email, phone: null, telegram: null, role, status: "active", createdAt: t, updatedAt: t });
  const product = (id: string, name: string, type: "service" | "goods", unit: string, price: number): Product => ({ id, tenantId: TENANT, name, sku: null, type, unit, price, description: null, status: "active", createdAt: t, updatedAt: t });
  // Мультиворонки: каждая стадия принадлежит воронке (pipelineId).
  const stage = (id: string, pipelineId: string, name: string, sortOrder: number): DealStage => ({ id, tenantId: TENANT, pipelineId, name, sortOrder, status: "active", createdAt: t, updatedAt: t });
  const ptype = (id: string, name: string): ProjectType => ({ id, tenantId: TENANT, name, description: null, status: "active", createdAt: t, updatedAt: t });
  const pipeline = (id: string, name: string, sortOrder: number, isDefault: boolean): Pipeline => ({ id, tenantId: TENANT, name, description: null, isDefault, sortOrder, status: "active", createdAt: t, updatedAt: t });
  const transition = (id: string, pipelineId: string, fromStageId: string, toStageId: string, guard?: { requireFeasibilityOk?: boolean; minProbability?: number | null; guardNote?: string | null }): StageTransition => ({ id, tenantId: TENANT, pipelineId, fromStageId, toStageId, requireFeasibilityOk: guard?.requireFeasibilityOk ?? false, minProbability: guard?.minProbability ?? null, guardNote: guard?.guardNote ?? null, createdAt: t, updatedAt: t });

  // Основная воронка (pipeline-main) — существующие 5 стадий; партнёрская (pipeline-partner) — 3 новые.
  const pipelines = [
    pipeline("pipeline-main", "Основная воронка", 1, true),
    pipeline("pipeline-partner", "Партнёрская воронка", 2, false)
  ];
  const dealStages = [
    stage("stage-lead", "pipeline-main", "Лид", 1),
    stage("stage-qual", "pipeline-main", "Квалификация", 2),
    stage("stage-proposal", "pipeline-main", "КП", 3),
    stage("stage-contract", "pipeline-main", "Договор", 4),
    stage("stage-won", "pipeline-main", "Закрыто", 5),
    stage("stage-partner-lead", "pipeline-partner", "Партнёрский лид", 1),
    stage("stage-partner-poc", "pipeline-partner", "Пилот (PoC)", 2),
    stage("stage-partner-won", "pipeline-partner", "Партнёрская сделка закрыта", 3)
  ];
  // Переходы: основная — линейная цепочка, переход contract→won под гвардом
  // (feasibility=ok И вероятность ≥ 50%); партнёрская — линейная без гвардов.
  const stageTransitions = [
    transition("st-main-lead-qual", "pipeline-main", "stage-lead", "stage-qual"),
    transition("st-main-qual-proposal", "pipeline-main", "stage-qual", "stage-proposal"),
    transition("st-main-proposal-contract", "pipeline-main", "stage-proposal", "stage-contract"),
    transition("st-main-contract-won", "pipeline-main", "stage-contract", "stage-won", { requireFeasibilityOk: true, minProbability: 50, guardNote: "Требуется feasibility=ok и вероятность ≥ 50%" }),
    transition("st-partner-lead-poc", "pipeline-partner", "stage-partner-lead", "stage-partner-poc"),
    transition("st-partner-poc-won", "pipeline-partner", "stage-partner-poc", "stage-partner-won")
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
    feasibilityStatus?: string | null;
  }): Opportunity => {
    const c = clients.find((x) => x.id === o.clientId)!;
    const ct = contacts.find((x) => x.id === o.contactId)!;
    // Мультиворонки: воронку сделки выводим из её стадии (server-managed поле).
    const st = dealStages.find((x) => x.id === o.stageId)!;
    return {
      id: o.id, tenantId: TENANT,
      clientId: o.clientId, primaryContactId: o.contactId, ownerUserId: o.ownerUserId, projectTypeId: "pt-impl", stageId: o.stageId, pipelineId: st.pipelineId,
      clientName: c.name, contactName: ct.name, title: o.title, projectType: "Внедрение", description: null,
      plannedStart: o.start, plannedFinish: o.finish,
      contractValue: o.contractValue, plannedHourlyRate: o.rate, plannedHours: Math.floor(o.contractValue / o.rate), probability: o.probability,
      status: o.status, templateId: null, feasibilityStatus: o.feasibilityStatus ?? null, feasibilityResult: null, feasibilityCheckedAt: null,
      createdAt: t, updatedAt: t, demand: [{ positionId: o.positionId, requiredHours: o.hours }], customFieldValues: {}
    };
  };
  const opportunities = [
    // На стадии «Договор» с feasibility=null (≠ok) и prob 80 — гвард contract→won отклоняет по реализуемости (422 condition_feasibility).
    opp({ id: "opp-2207", clientId: "client-romashka", contactId: "ctc-romashka", ownerUserId: "u-anna", stageId: "stage-contract", title: "Производственный портал · Релиз 2", contractValue: 4_800_000, rate: 4000, probability: 80, status: "ready_to_activate", start: "2026-03-02", finish: "2026-07-12", positionId: "backend", hours: 1100 }),
    // На стадии «Договор» с feasibility=ok и prob 75 — гвард contract→won РАЗРЕШАЕТ переход.
    opp({ id: "opp-gamma-contract", clientId: "client-gamma", contactId: "ctc-gamma", ownerUserId: "u-anna", stageId: "stage-contract", title: "Платформа лояльности · Договор", contractValue: 2_800_000, rate: 4000, probability: 75, status: "ready_to_activate", start: "2026-03-10", finish: "2026-08-20", positionId: "backend", hours: 700, feasibilityStatus: "ok" }),
    // На стадии «Договор» с feasibility=ok, но prob 40 (<50) — гвард contract→won отклоняет по вероятности (422 condition_probability).
    opp({ id: "opp-sever-contract-lowprob", clientId: "client-sever", contactId: "ctc-sever", ownerUserId: "u-ivan", stageId: "stage-contract", title: "ERP-миграция · Договор (низкая вероятность)", contractValue: 2_000_000, rate: 4000, probability: 40, status: "ready_to_activate", start: "2026-04-05", finish: "2026-09-05", positionId: "backend", hours: 500, feasibilityStatus: "ok" }),
    opp({ id: "opp-sever-erp", clientId: "client-sever", contactId: "ctc-sever", ownerUserId: "u-ivan", stageId: "stage-proposal", title: "Интеграция ERP", contractValue: 2_400_000, rate: 3800, probability: 55, status: "feasibility", start: "2026-04-01", finish: "2026-08-15", positionId: "backend", hours: 600 }),
    opp({ id: "opp-gamma-mvp", clientId: "client-gamma", contactId: "ctc-gamma", ownerUserId: "u-sergey", stageId: "stage-qual", title: "Мобильное приложение · MVP", contractValue: 1_600_000, rate: 3500, probability: 40, status: "new", start: "2026-05-04", finish: "2026-09-01", positionId: "frontend", hours: 420 }),
    opp({ id: "opp-delta-audit", clientId: "client-delta", contactId: "ctc-delta", ownerUserId: "u-ivan", stageId: "stage-lead", title: "Аудит и роадмап", contractValue: 650_000, rate: 5000, probability: 25, status: "new", start: "2026-03-16", finish: "2026-05-01", positionId: "analyst", hours: 120 }),
    opp({ id: "opp-romashka-support", clientId: "client-romashka", contactId: "ctc-romashka", ownerUserId: "u-anna", stageId: "stage-lead", title: "Поддержка портала · год", contractValue: 2_160_000, rate: 3000, probability: 30, status: "new", start: "2026-07-13", finish: "2027-07-12", positionId: "backend", hours: 700 }),
    // Сделка с ПРЕДЗАПОЛНЕННЫМ feasibilityResult (status "warning") — чтобы виджет реализуемости
    // рендерился в UI без клика. Сам assessment досидируется ниже через домен (контракт-верно).
    opp({ id: "opp-gamma-bi", clientId: "client-gamma", contactId: "ctc-gamma", ownerUserId: "u-sergey", stageId: "stage-proposal", title: "BI-витрина продаж", contractValue: 1_950_000, rate: 4200, probability: 60, status: "ready_to_activate", start: "2026-04-20", finish: "2026-07-30", positionId: "backend", hours: 460, feasibilityStatus: "warning" }),
    opp({ id: "opp-sever-portal", clientId: "client-sever", contactId: "ctc-sever", ownerUserId: "u-ivan", stageId: "stage-won", title: "Портал самообслуживания", contractValue: 3_300_000, rate: 4000, probability: 100, status: "won_closed", start: "2026-01-15", finish: "2026-04-30", positionId: "frontend", hours: 800 }),
    // Партнёрская воронка: сделка на её первой стадии — для демо back-compat-переходов и кросс-пайплайн.
    opp({ id: "opp-partner-acme", clientId: "client-delta", contactId: "ctc-delta", ownerUserId: "u-sergey", stageId: "stage-partner-lead", title: "Партнёрская интеграция · ACME", contractValue: 1_200_000, rate: 4000, probability: 35, status: "new", start: "2026-05-01", finish: "2026-08-01", positionId: "backend", hours: 300 }),
    // Демо-сделка с гарантированным feasibility=conflict: required(900) > plannedHours(200) →
    // блокер demand_exceeds_planned_hours. Нужна для демо активации с риском (risk_acceptance_required).
    opp({ id: "opp-conflict-demo", clientId: "client-delta", contactId: "ctc-delta", ownerUserId: "u-ivan", stageId: "stage-proposal", title: "Срочный аврал · перегруз спроса", contractValue: 1_000_000, rate: 5000, probability: 50, status: "new", start: "2026-06-01", finish: "2026-10-30", positionId: "backend", hours: 900 })
  ];

  // Активные проекты: пусто на старте (listProjects вернёт [] до первой активации).
  const projects: ProjectRecord[] = [];

  // Досидируем предзаполненной доменной оценкой ВСЕ сделки, у которых в сиде выставлен
  // feasibilityStatus — чтобы feasibilityStatus и feasibilityResult писались ВМЕСТЕ (как боевой
  // updateOpportunityFeasibility: оба поля атомарно). Иначе виджет реализуемости и кнопка
  // активации в карточке расходятся (status есть, result null — состояние, недостижимое на боевом API).
  for (const id of ["opp-gamma-bi", "opp-gamma-contract", "opp-sever-contract-lowprob"]) {
    const o = opportunities.find((x) => x.id === id)!;
    const a = assessFeasibility(o, POSITIONS, projects);
    o.feasibilityStatus = a.status;
    o.feasibilityResult = serializeAssessment(a);
    o.feasibilityCheckedAt = t;
  }

  // CRM-активности для opp-2207 (2 comment, 1 task todo, 1 file) — лента карточки не пустая в демо.
  const act = (n: number, over: Partial<CrmActivity>): CrmActivity => ({
    id: `crm-activity-${n}`, tenantId: TENANT, entityType: "opportunity", entityId: "opp-2207",
    type: "comment", title: null, body: null, status: null, dueDate: null, assigneeUserId: null,
    authorUserId: "u-anna", fileUrl: null, fileSizeBytes: null, mimeType: null, createdAt: t, updatedAt: t, ...over
  });
  const activities: CrmActivity[] = [
    act(1, { type: "comment", body: "Клиент подтвердил бюджет, готовим договор.", authorUserId: "u-anna", createdAt: "2026-01-12T09:10:00.000Z", updatedAt: "2026-01-12T09:10:00.000Z" }),
    act(2, { type: "comment", body: "Согласовали состав команды на релиз 2.", authorUserId: "u-sergey", createdAt: "2026-01-12T10:30:00.000Z", updatedAt: "2026-01-12T10:30:00.000Z" }),
    act(3, { type: "task", title: "Подготовить смету по релизу 2", body: "Уточнить часы backend и сроки.", status: "todo", dueDate: "2026-02-01T00:00:00.000Z", assigneeUserId: "u-ivan", authorUserId: "u-anna", createdAt: "2026-01-12T11:00:00.000Z", updatedAt: "2026-01-12T11:00:00.000Z" }),
    act(4, { type: "file", title: "Договор (черновик).pdf", fileUrl: "https://files.example.com/opp-2207/contract-draft.pdf", mimeType: "application/pdf", fileSizeBytes: 482_311, authorUserId: "u-anna", createdAt: "2026-01-12T12:00:00.000Z", updatedAt: "2026-01-12T12:00:00.000Z" })
  ];

  return { clients, contacts, products, dealStages, projectTypes, opportunities, pipelines, stageTransitions, projects, activities };
}

/* ---- Реализуемость (feasibility): тонкая обёртка над доменом ---- */
// Активные проекты → плоский список резерваций (даты ISO→Date). Боевой эквивалент в feasibilityAssessment.ts.
const activeReservations = (projects: ProjectRecord[]) =>
  projects
    .filter((p) => p.status === "active")
    .flatMap((p) => p.demand.map((line) => ({
      projectId: p.id, positionId: line.positionId, requiredHours: line.requiredHours,
      plannedStart: toDate(p.plannedStart), plannedFinish: toDate(p.plannedFinish)
    })));

// Оценка реализуемости сделки через домен (НЕ дублируем логику). Даты конвертируем ISO→Date(UTC).
function assessFeasibility(o: Opportunity, positions: CrmPosition[], projects: ProjectRecord[]): OpportunityFeasibilityAssessment {
  return assessOpportunityFeasibility({
    opportunity: { id: o.id, plannedStart: toDate(o.plannedStart), plannedFinish: toDate(o.plannedFinish), contractValue: o.contractValue, plannedHourlyRate: o.plannedHourlyRate },
    demand: o.demand,
    positions,
    activeProjectReservations: activeReservations(projects)
  });
}

// Сериализация оценки в plain-object (зеркало serializeFeasibilityAssessment боевого checkFeasibilityCommand).
function serializeAssessment(a: OpportunityFeasibilityAssessment): Record<string, unknown> {
  return {
    opportunityId: a.opportunityId, plannedHours: a.plannedHours, totalRequiredHours: a.totalRequiredHours,
    workingDays: a.workingDays, status: a.status, blockers: [...a.blockers], warnings: [...a.warnings],
    rows: a.rows.map((r) => ({ ...r }))
  };
}

/* ---- Транспорт: fetchImpl, совместимый с createCrmClient ---- */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (error: string, status: number) => json({ error }, status);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isFinal = (o: Opportunity) => o.status === "won_closed" || o.status === "lost_rejected";
const MAX_DESCRIPTION = 1_000;
// Управляющие символы для multiline-текста (как боевой isSafeMultilineText): 0x00–0x08, 0x0B, 0x0C,
// 0x0E–0x1F, 0x7F. Допускаются tab(0x09), LF(0x0A), CR(0x0D). Без литералов в исходнике — по кодам.
const hasControlChar = (v: string): boolean => {
  for (let i = 0; i < v.length; i += 1) {
    const c = v.charCodeAt(i);
    if ((c <= 0x08) || c === 0x0b || c === 0x0c || (c >= 0x0e && c <= 0x1f) || c === 0x7f) return true;
  }
  return false;
};
// текст описания/guardNote: длина ≤ max, без управляющих символов (как боевой isSafeMultilineText)
const safeMultiline = (v: string, max = MAX_DESCRIPTION) => v.length <= max && !hasControlChar(v);
// undefined → дефолт false; boolean → как есть; иное → null (ошибка тела), как боевой parseOptionalBoolean
const optBool = (v: unknown): boolean | null => (v === undefined ? false : typeof v === "boolean" ? v : null);
// single-line текст: длина ≤ max, без управляющих символов (включая tab/LF/CR), как боевой isSafeSingleLineText
const hasControlSingleLine = (v: string): boolean => {
  for (let i = 0; i < v.length; i += 1) {
    const c = v.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
};
const safeSingleLine = (v: string, max: number) => v.length <= max && !hasControlSingleLine(v);
// Приватные/loopback/link-local хосты (зеркало parseExternalReferenceUrl.isBlockedHost): мок отвергает их, как боевой.
const isBlockedHost = (host: string): boolean => {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (h === "::1" || h === "::") return true;
  if (/^f[cd][0-9a-f]*:/.test(h)) return true; // ULA fc00::/7
  if (/^fe[89ab][0-9a-f]*:/.test(h)) return true; // link-local fe80::/10
  if (h.startsWith("::ffff:")) return isBlockedHost(h.slice(7)); // mapped IPv4
  return false;
};
// http/https URL ≤ max (зеркало parseExternalReferenceUrl): схема http(s), без user:pass, не приватный хост.
const isHttpUrl = (v: string, max = 1_200): boolean => {
  if (v.length === 0 || v.length > max) return false;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    if (isBlockedHost(u.hostname)) return false;
    return true;
  } catch { return false; }
};

type PipelineParse = { ok: true; name: string; description: string | null; isDefault: boolean; sortOrder: number; status: "active" | "archived" } | { ok: false; error: string };
// Мультиворонки: тело воронки (create/full-replace). Зеркало parsePipelineBody (crmParsers): порядок и коды.
function parsePipelineBody(body: Record<string, unknown>): PipelineParse {
  const name = str(body.name);
  const description = body.description == null ? null : str(body.description) || null;
  const sortOrder = body.sortOrder;
  const isDefault = optBool(body.isDefault);
  const status = body.status === undefined ? "active" : body.status;
  if (!name || name.length > 160) return { ok: false, error: "invalid_pipeline_name" };
  if (description !== null && !safeMultiline(description)) return { ok: false, error: "invalid_description" };
  if (!posInt(sortOrder)) return { ok: false, error: "invalid_pipeline_sort_order" };
  if (isDefault === null) return { ok: false, error: "invalid_body" };
  if (status !== "active" && status !== "archived") return { ok: false, error: "invalid_status" };
  return { ok: true, name, description, isDefault, sortOrder: sortOrder as number, status };
}

type StageTransitionParse = { ok: true; fromStageId: string; toStageId: string; requireFeasibilityOk: boolean; minProbability: number | null; guardNote: string | null } | { ok: false; error: string };
// Мультиворонки: тело правила перехода. Зеркало parseStageTransitionBody (crmParsers): порядок и коды.
function parseStageTransitionBody(body: Record<string, unknown>): StageTransitionParse {
  const fromStageId = str(body.fromStageId);
  const toStageId = str(body.toStageId);
  const requireFeasibilityOk = optBool(body.requireFeasibilityOk);
  const guardNote = body.guardNote == null ? null : str(body.guardNote) || null;
  if (!ID_RE.test(fromStageId)) return { ok: false, error: "invalid_deal_stage_id" };
  if (!ID_RE.test(toStageId)) return { ok: false, error: "invalid_deal_stage_id" };
  if (fromStageId === toStageId) return { ok: false, error: "invalid_transition_stages" };
  if (requireFeasibilityOk === null) return { ok: false, error: "invalid_body" };
  // minProbability: опционально; если задано — целое 0..100.
  let minProbability: number | null = null;
  if (body.minProbability !== undefined && body.minProbability !== null) {
    const mp = body.minProbability;
    if (typeof mp !== "number" || !Number.isInteger(mp) || mp < 0 || mp > 100) return { ok: false, error: "invalid_min_probability" };
    minProbability = mp;
  }
  if (guardNote !== null && !safeMultiline(guardNote)) return { ok: false, error: "invalid_description" };
  return { ok: true, fromStageId, toStageId, requireFeasibilityOk, minProbability, guardNote };
}

type OppUpdateParse =
  | { ok: true; clientId: string; primaryContactId: string; projectTypeId: string; stageId: string; title: string; description: string | null; plannedStart: string; plannedFinish: string; contractValue: number; plannedHourlyRate: number; probability: number; ownerProvided: boolean; ownerUserId: string | null; templateId: string | null; demand: PositionDemand[] }
  | { ok: false; error: string };
// Тело PATCH /opportunities/:id — full-replace (зеркало parseOpportunityUpdateBody): порядок и коды как create + templateId.
function parseOpportunityUpdateBody(body: Record<string, unknown>): OppUpdateParse {
  // Порядок проверок полей — как боевой parseOpportunityFields: client → contact → owner →
  // projectType → stage → title → description → templateId → dates → value → rate → probability → demand.
  const clientId = str(body.clientId), primaryContactId = str(body.primaryContactId), projectTypeId = str(body.projectTypeId), stageId = str(body.stageId), title = str(body.title);
  if (!ID_RE.test(clientId)) return { ok: false, error: "invalid_client_id" };
  if (!ID_RE.test(primaryContactId)) return { ok: false, error: "invalid_primary_contact_id" };
  const ownerProvided = body.ownerUserId != null; // absent/null → fallback в хендлере (existing→actor)
  const ownerUserId = ownerProvided ? str(body.ownerUserId) : null;
  if (ownerProvided && !ID_RE.test(ownerUserId!)) return { ok: false, error: "invalid_owner_user_id" };
  if (!ID_RE.test(projectTypeId)) return { ok: false, error: "invalid_project_type_id" };
  if (!ID_RE.test(stageId)) return { ok: false, error: "invalid_deal_stage_id" };
  if (!title || !safeSingleLine(title, 160)) return { ok: false, error: "invalid_opportunity_title" };
  const description = body.description == null ? null : str(body.description) || null; // опц multiline ≤1000, ''→null
  if (description !== null && !safeMultiline(description)) return { ok: false, error: "invalid_description" };
  const templateProvided = body.templateId != null;
  const templateId = templateProvided ? str(body.templateId) : null;
  if (templateProvided && !ID_RE.test(templateId!)) return { ok: false, error: "invalid_template_id" };
  const plannedStart = str(body.plannedStart), plannedFinish = str(body.plannedFinish);
  if (!DATE_RE.test(plannedStart) || !DATE_RE.test(plannedFinish) || plannedFinish < plannedStart || dayDiff(plannedStart, plannedFinish) > MAX_HORIZON_DAYS) return { ok: false, error: "invalid_planned_dates" };
  const contractValue = body.contractValue, plannedHourlyRate = body.plannedHourlyRate, probability = body.probability;
  if (!posInt(contractValue)) return { ok: false, error: "invalid_contract_value" };
  if (!posInt(plannedHourlyRate)) return { ok: false, error: "invalid_planned_hourly_rate" };
  if (typeof probability !== "number" || !Number.isInteger(probability) || probability < 0 || probability > 100) return { ok: false, error: "invalid_probability" };
  const demandRaw = Array.isArray(body.demand) ? (body.demand as Array<{ positionId?: unknown; requiredHours?: unknown }>) : [];
  if (demandRaw.length < 1 || demandRaw.length > 12) return { ok: false, error: "invalid_demand" };
  const seenPos = new Set<string>();
  const demand: PositionDemand[] = [];
  for (const d of demandRaw) {
    const positionId = str(d.positionId);
    if (!ID_RE.test(positionId)) return { ok: false, error: "invalid_demand_position" };
    if (!posInt(d.requiredHours, MAX_DEMAND_HOURS)) return { ok: false, error: "invalid_demand_hours" };
    if (seenPos.has(positionId)) return { ok: false, error: "duplicate_demand_position" };
    seenPos.add(positionId);
    demand.push({ positionId, requiredHours: d.requiredHours as number });
  }
  return { ok: true, clientId, primaryContactId, projectTypeId, stageId, title, description, plannedStart, plannedFinish, contractValue, plannedHourlyRate, probability, ownerProvided, ownerUserId, templateId, demand };
}

export function createMockCrmFetch(): typeof fetch {
  const db = seed();

  // Резолв CRM-сущности для activity-ручек (вернуть запись + lock-флаг). isLocked=true ТОЛЬКО для
  // opportunity в финальном статусе; client/contact/product всегда unlocked (как боевой resolveCrmEntity).
  const resolveCrmEntity = (entityType: CrmActivityEntityType, entityId: string): { isLocked: boolean } | null => {
    if (entityType === "opportunity") { const o = db.opportunities.find((x) => x.id === entityId); return o ? { isLocked: isFinal(o) } : null; }
    if (entityType === "client") { const c = db.clients.find((x) => x.id === entityId); return c ? { isLocked: false } : null; }
    if (entityType === "contact") { const c = db.contacts.find((x) => x.id === entityId); return c ? { isLocked: false } : null; }
    const p = db.products.find((x) => x.id === entityId); return p ? { isLocked: false } : null;
  };
  // Формат-код id сущности по типу (зеркало parseCrmEntityRouteParams).
  const entityIdErr = (entityType: CrmActivityEntityType): string =>
    entityType === "opportunity" ? "invalid_opportunity_id" : entityType === "client" ? "invalid_client_id" : entityType === "contact" ? "invalid_contact_id" : "invalid_product_id";

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]!;
    let body: Record<string, unknown> = {};
    // Тип присланного тела — для invalid_body (как боевые isObjectBody/typeof-гварды парсеров):
    // CRM-активности отвергают массив И примитив; opportunity-update — только примитив (массив идёт к field-кодам).
    let bodyArray = false, bodyPrimitive = false;
    if (init?.body) { try { const p: unknown = JSON.parse(String(init.body)); if (p && typeof p === "object" && !Array.isArray(p)) body = p as Record<string, unknown>; else if (Array.isArray(p)) bodyArray = true; else bodyPrimitive = true; } catch { return err("invalid_json", 400); } }

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
      // боевой PATCH — full-replace (parseClientBody поверх всего тела): name обязателен
      const name = str(body.name);
      if (!name || name.length > 160) return err("invalid_client_name", 400);
      c.name = name;
      c.description = body.description == null ? null : str(body.description) || null;
      c.status = body.status === "archived" ? "archived" : "active";
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
      // full-replace (parseContactBody): clientId + name обязательны; активный клиент — только при СМЕНЕ клиента
      const clientId = str(body.clientId);
      const name = str(body.name);
      if (!ID_RE.test(clientId)) return err("invalid_client_id", 400);
      if (!name || name.length > 160) return err("invalid_contact_name", 400);
      const email = body.email == null ? null : str(body.email).toLowerCase() || null;
      if (email && (email.length > 254 || !EMAIL_RE.test(email))) return err("invalid_contact_email", 400);
      if (clientId !== c.clientId) { const client = db.clients.find((x) => x.id === clientId); if (!client || client.status !== "active") return err("client_not_found", 404); }
      c.clientId = clientId; c.name = name; c.email = email;
      c.phone = body.phone == null ? null : str(body.phone) || null;
      c.telegram = body.telegram == null ? null : str(body.telegram) || null;
      c.role = body.role == null ? null : str(body.role) || null;
      c.status = body.status === "archived" ? "archived" : "active";
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
      // full-replace (parseProductBody): name/unit/price обязательны
      const name = str(body.name); const unit = str(body.unit); const price = body.price;
      if (!name || name.length > 160) return err("invalid_product_name", 400);
      if (!unit || unit.length > 40) return err("invalid_product_unit", 400);
      if (!posInt(price)) return err("invalid_product_price", 400);
      p.name = name; p.unit = unit; p.price = price;
      p.type = body.type === "goods" ? "goods" : "service";
      p.sku = body.sku == null ? null : str(body.sku) || null;
      p.description = body.description == null ? null : str(body.description) || null;
      p.status = body.status === "archived" ? "archived" : "active";
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
      if (ownerProvided && !CRM_USERS.some((u) => u.id === ownerUserId)) return err("owner_user_not_found", 404); // owner после contact (как боевой resolveOpportunityLinks)
      const ptype = db.projectTypes.find((x) => x.id === projectTypeId);
      if (!ptype || ptype.status !== "active") return err("project_type_not_found", 404);
      const stage = db.dealStages.find((x) => x.id === stageId);
      if (!stage || stage.status !== "active") return err("deal_stage_not_found", 404);
      const o: Opportunity = {
        id: genId("opp"), tenantId: TENANT,
        clientId, primaryContactId: contactId, ownerUserId, projectTypeId, stageId, pipelineId: stage.pipelineId, // мультиворонки: воронка из целевой стадии
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
      if (isFinal(o)) return err("opportunity_stage_locked", 409); // финал лочится ДО доменной проверки (как сейчас)
      const stage = db.dealStages.find((x) => x.id === stageId);
      if (!stage || stage.status !== "active") return err("deal_stage_not_found", 404);
      // Мультиворонки: проверка правил перехода ВНУТРИ воронки сделки. Исходную воронку берём
      // из ТЕКУЩЕЙ стадии сделки; её stage_transitions передаём в домен evaluateStageTransition.
      // Back-compat: нет стадии/воронки/правил → разрешено (домен возвращает allowed).
      const currentStage = o.stageId ? db.dealStages.find((x) => x.id === o.stageId) : undefined;
      const sourcePipelineId = currentStage?.pipelineId ?? null;
      const transitions = sourcePipelineId ? db.stageTransitions.filter((tr) => tr.pipelineId === sourcePipelineId) : [];
      const decision = evaluateStageTransition({
        opportunity: { finalized: false, stageId: o.stageId, pipelineId: sourcePipelineId, probability: o.probability, feasibilityStatus: o.feasibilityStatus },
        targetStage: { id: stage.id, pipelineId: stage.pipelineId },
        transitions: transitions.map((tr) => ({ fromStageId: tr.fromStageId, toStageId: tr.toStageId, requireFeasibilityOk: tr.requireFeasibilityOk, minProbability: tr.minProbability }))
      });
      if (!decision.allowed) {
        // Условия перехода (вероятность/реализуемость) → 422; запрет/кросс-воронка/финал → 409.
        const status = decision.reason === "condition_probability" || decision.reason === "condition_feasibility" ? 422 : 409;
        return err(decision.reason, status);
      }
      o.stageId = stageId; o.pipelineId = stage.pipelineId; o.updatedAt = nowIso(); // синхронизируем воронку с целевой стадией
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
    /* ---- мультиворонки: pipelines ---- */
    if (path === "/api/workspace/pipelines" && method === "GET") return json({ pipelines: [...db.pipelines].sort((a, b) => a.sortOrder - b.sortOrder) });
    if (path === "/api/workspace/pipelines" && method === "POST") {
      const parsed = parsePipelineBody(body);
      if (!parsed.ok) return err(parsed.error, 400);
      const p: Pipeline = { id: genId("pipeline"), tenantId: TENANT, name: parsed.name, description: parsed.description, isDefault: parsed.isDefault, sortOrder: parsed.sortOrder, status: parsed.status, createdAt: nowIso(), updatedAt: nowIso() };
      db.pipelines.push(p);
      return json({ pipeline: p }, 201);
    }
    const pipelinePatch = method === "PATCH" ? path.match(/^\/api\/workspace\/pipelines\/([^/]+)$/) : null;
    if (pipelinePatch) {
      const pipelineId = decodeURIComponent(pipelinePatch[1]!);
      if (!ID_RE.test(pipelineId)) return err("invalid_pipeline_id", 400); // формат параметра до резолва
      const p = db.pipelines.find((x) => x.id === pipelineId);
      if (!p) return err("pipeline_not_found", 404);
      const parsed = parsePipelineBody(body); // full-replace (name/sortOrder обязательны)
      if (!parsed.ok) return err(parsed.error, 400);
      p.name = parsed.name; p.description = parsed.description; p.isDefault = parsed.isDefault; p.sortOrder = parsed.sortOrder; p.status = parsed.status; p.updatedAt = nowIso();
      return json({ pipeline: p });
    }

    /* ---- мультиворонки: stage-transitions ---- */
    const stTrList = method === "GET" ? path.match(/^\/api\/workspace\/pipelines\/([^/]+)\/stage-transitions$/) : null;
    if (stTrList) {
      const pipelineId = decodeURIComponent(stTrList[1]!);
      if (!ID_RE.test(pipelineId)) return err("invalid_pipeline_id", 400);
      if (!db.pipelines.some((x) => x.id === pipelineId)) return err("pipeline_not_found", 404);
      return json({ stageTransitions: db.stageTransitions.filter((tr) => tr.pipelineId === pipelineId) });
    }
    const stTrCreate = method === "POST" ? path.match(/^\/api\/workspace\/pipelines\/([^/]+)\/stage-transitions$/) : null;
    if (stTrCreate) {
      const pipelineId = decodeURIComponent(stTrCreate[1]!);
      if (!ID_RE.test(pipelineId)) return err("invalid_pipeline_id", 400); // параметр
      if (!db.pipelines.some((x) => x.id === pipelineId)) return err("pipeline_not_found", 404);
      const parsed = parseStageTransitionBody(body);
      if (!parsed.ok) return err(parsed.error, 400);
      // Обе стадии должны существовать и принадлежать этой воронке.
      const fromStage = db.dealStages.find((x) => x.id === parsed.fromStageId);
      if (!fromStage) return err("deal_stage_not_found", 404);
      if (fromStage.pipelineId !== pipelineId) return err("stage_not_in_pipeline", 400);
      const toStage = db.dealStages.find((x) => x.id === parsed.toStageId);
      if (!toStage) return err("deal_stage_not_found", 404);
      if (toStage.pipelineId !== pipelineId) return err("stage_not_in_pipeline", 400);
      // Дубль пары (from,to) в воронке → 409.
      if (db.stageTransitions.some((tr) => tr.pipelineId === pipelineId && tr.fromStageId === parsed.fromStageId && tr.toStageId === parsed.toStageId)) {
        return err("stage_transition_conflict", 409);
      }
      const tr: StageTransition = { id: genId("stage-transition"), tenantId: TENANT, pipelineId, fromStageId: parsed.fromStageId, toStageId: parsed.toStageId, requireFeasibilityOk: parsed.requireFeasibilityOk, minProbability: parsed.minProbability, guardNote: parsed.guardNote, createdAt: nowIso(), updatedAt: nowIso() };
      db.stageTransitions.push(tr);
      return json({ stageTransition: tr }, 201);
    }
    const stTrDelete = method === "DELETE" ? path.match(/^\/api\/workspace\/pipelines\/([^/]+)\/stage-transitions\/([^/]+)$/) : null;
    if (stTrDelete) {
      const pipelineId = decodeURIComponent(stTrDelete[1]!);
      const transitionId = decodeURIComponent(stTrDelete[2]!);
      if (!ID_RE.test(pipelineId)) return err("invalid_pipeline_id", 400);
      if (!ID_RE.test(transitionId)) return err("invalid_transition_id", 400);
      // Правило должно существовать И принадлежать указанной воронке.
      const idx = db.stageTransitions.findIndex((tr) => tr.id === transitionId && tr.pipelineId === pipelineId);
      if (idx < 0) return err("stage_transition_not_found", 404);
      db.stageTransitions.splice(idx, 1);
      return json({ status: "ok" }); // OkResponse-контракт { status: "ok" } (как боевой API)
    }

    /* ---- мультиворонки: кросс-пайплайн перенос сделки ---- */
    const oppPipeline = method === "PATCH" ? path.match(/^\/api\/workspace\/opportunities\/([^/]+)\/pipeline$/) : null;
    if (oppPipeline) {
      const opportunityId = decodeURIComponent(oppPipeline[1]!);
      if (!ID_RE.test(opportunityId)) return err("invalid_opportunity_id", 400); // параметр
      // Тело: pipelineId + stageId (формат-валидация до резолва).
      const pipelineId = str(body.pipelineId), stageId = str(body.stageId);
      if (!ID_RE.test(pipelineId)) return err("invalid_pipeline_id", 400);
      if (!ID_RE.test(stageId)) return err("invalid_deal_stage_id", 400);
      const o = db.opportunities.find((x) => x.id === opportunityId);
      if (!o) return err("opportunity_not_found", 404);
      const pipeline = db.pipelines.find((x) => x.id === pipelineId);
      if (!pipeline) return err("pipeline_not_found", 404);
      const stage = db.dealStages.find((x) => x.id === stageId);
      if (!stage) return err("deal_stage_not_found", 404);
      // Тот же пайплайн — это не «перенос в воронку» (зеркало боевого changeOpportunityPipelineCommand).
      if (pipeline.id === o.pipelineId) return err("cross_pipeline_move", 409);
      const decision = evaluatePipelineChange({
        opportunity: { finalized: isFinal(o) },
        targetPipeline: { id: pipeline.id, status: pipeline.status },
        targetStage: { pipelineId: stage.pipelineId, status: stage.status }
      });
      if (!decision.allowed) return err(decision.reason, 409);
      o.stageId = stage.id; o.pipelineId = pipeline.id; o.updatedAt = nowIso();
      return json({ opportunity: o });
    }

    /* ---- Карточка сделки: PATCH /opportunities/:id (full-replace) ---- */
    const oppUpdate = method === "PATCH" ? path.match(/^\/api\/workspace\/opportunities\/([^/]+)$/) : null;
    if (oppUpdate) {
      const opportunityId = decodeURIComponent(oppUpdate[1]!);
      if (!ID_RE.test(opportunityId)) return err("invalid_opportunity_id", 400); // 1) формат :id
      if (bodyPrimitive) return err("invalid_body", 400); // тело-примитив → invalid_body (как боевой parseOpportunityUpdateBody guard; массив идёт к field-кодам)
      const parsed = parseOpportunityUpdateBody(body); // 2) тело (порядок кодов как create)
      if (!parsed.ok) return err(parsed.error, 400);
      const o = db.opportunities.find((x) => x.id === opportunityId);
      if (!o) return err("opportunity_not_found", 404); // 3) сделка
      if (isFinal(o)) return err("opportunity_update_locked", 409); // 4) финал заблокирован для правок
      // 5) резолв связей: client → contact → owner → project_type → deal_stage (как боевой resolveOpportunityLinks).
      const client = db.clients.find((x) => x.id === parsed.clientId);
      if (!client || client.status !== "active") return err("client_not_found", 404);
      const contact = db.contacts.find((x) => x.id === parsed.primaryContactId);
      if (!contact || contact.status !== "active" || contact.clientId !== client.id) return err("contact_not_found", 404);
      // ownerUserId: absent/null → existing → CURRENT_ACTOR_ID (fallback); если задан — валидируем 404 (после contact).
      const ownerUserId = parsed.ownerProvided ? parsed.ownerUserId! : o.ownerUserId ?? CURRENT_ACTOR_ID;
      // итоговый владелец валидируется ВСЕГДА (как боевой resolveOpportunityLinks: проверка при любом truthy ownerUserId).
      if (!CRM_USERS.some((u) => u.id === ownerUserId)) return err("owner_user_not_found", 404);
      const ptype = db.projectTypes.find((x) => x.id === parsed.projectTypeId);
      if (!ptype || ptype.status !== "active") return err("project_type_not_found", 404);
      const stage = db.dealStages.find((x) => x.id === parsed.stageId);
      if (!stage || stage.status !== "active") return err("deal_stage_not_found", 404);
      // Полное сохранение ЗЕРКАЛИТ прод (updateOpportunityCommand + repo.updateOpportunity):
      // при смене стадии применяем guard перехода воронки (как /stage), pipelineId выводим из целевой
      // стадии, feasibility сбрасываем. Иначе мок «разрешал» бы guarded-переход, который прод отклоняет.
      if (parsed.stageId !== o.stageId) {
        const currentStage = o.stageId ? db.dealStages.find((x) => x.id === o.stageId) : undefined;
        const sourcePipelineId = currentStage?.pipelineId ?? null;
        const transitions = sourcePipelineId ? db.stageTransitions.filter((tr) => tr.pipelineId === sourcePipelineId) : [];
        const decision = evaluateStageTransition({
          opportunity: { finalized: false, stageId: o.stageId, pipelineId: sourcePipelineId, probability: o.probability, feasibilityStatus: o.feasibilityStatus },
          targetStage: { id: stage.id, pipelineId: stage.pipelineId },
          transitions: transitions.map((tr) => ({ fromStageId: tr.fromStageId, toStageId: tr.toStageId, requireFeasibilityOk: tr.requireFeasibilityOk, minProbability: tr.minProbability }))
        });
        if (!decision.allowed) {
          const status = decision.reason === "condition_probability" || decision.reason === "condition_feasibility" ? 422 : 409;
          return err(decision.reason, status);
        }
      }
      // server-managed: статус СОХРАНЯЕТСЯ; pipelineId выводится из целевой стадии; feasibility сбрасывается;
      // plannedHours пересчитывается доменом; customFieldValues всегда {} (вход сознательно игнорируем).
      o.clientId = parsed.clientId; o.primaryContactId = parsed.primaryContactId; o.projectTypeId = parsed.projectTypeId;
      o.stageId = parsed.stageId; o.pipelineId = stage.pipelineId; o.ownerUserId = ownerUserId; o.title = parsed.title; o.description = parsed.description;
      o.clientName = client.name; o.contactName = contact.name; o.projectType = ptype.name;
      o.plannedStart = parsed.plannedStart; o.plannedFinish = parsed.plannedFinish;
      o.contractValue = parsed.contractValue; o.plannedHourlyRate = parsed.plannedHourlyRate;
      o.plannedHours = calculatePlannedHours(parsed.contractValue, parsed.plannedHourlyRate);
      o.probability = parsed.probability; o.templateId = parsed.templateId; o.customFieldValues = {};
      o.feasibilityStatus = null; o.feasibilityResult = null; o.feasibilityCheckedAt = null;
      o.updatedAt = nowIso();
      return json({ opportunity: o });
    }

    /* ---- Карточка сделки: POST /opportunities/:id/feasibility ---- */
    const oppFeasibility = method === "POST" ? path.match(/^\/api\/workspace\/opportunities\/([^/]+)\/feasibility$/) : null;
    if (oppFeasibility) {
      const opportunityId = decodeURIComponent(oppFeasibility[1]!);
      if (!ID_RE.test(opportunityId)) return err("invalid_opportunity_id", 400); // 1) формат :id
      const o = db.opportunities.find((x) => x.id === opportunityId);
      if (!o) return err("opportunity_not_found", 404); // 2) сделка
      if (isFinal(o)) return err("opportunity_not_feasible", 409); // 3) финал
      // 4) собираем оценку через домен; 5) пишем результат в сделку + переводим статус.
      const assessment = assessFeasibility(o, POSITIONS, db.projects);
      o.feasibilityStatus = assessment.status;
      o.feasibilityResult = serializeAssessment(assessment);
      o.feasibilityCheckedAt = nowIso();
      o.status = assessment.status === "ok" || assessment.status === "warning" ? "ready_to_activate" : "feasibility";
      o.updatedAt = nowIso();
      return json({ opportunity: o, assessment }); // 6) 200
    }

    /* ---- Карточка сделки: POST /opportunities/:id/activate ---- */
    const oppActivate = method === "POST" ? path.match(/^\/api\/workspace\/opportunities\/([^/]+)\/activate$/) : null;
    if (oppActivate) {
      const opportunityId = decodeURIComponent(oppActivate[1]!);
      if (!ID_RE.test(opportunityId)) return err("invalid_opportunity_id", 400); // 1) формат :id
      // 2) тело: invalid_project_id → invalid_risk_reason.
      const idProvided = body.id != null;
      const projectId = idProvided ? str(body.id) : null;
      if (idProvided && !ID_RE.test(projectId!)) return err("invalid_project_id", 400);
      const riskProvided = body.acceptedRiskReason != null;
      const riskRaw = riskProvided ? str(body.acceptedRiskReason) : "";
      if (riskProvided && riskRaw !== "" && !safeMultiline(riskRaw, 500)) return err("invalid_risk_reason", 400);
      const acceptedRiskReason = riskRaw === "" ? null : riskRaw; // ''→null (как боевой)
      const o = db.opportunities.find((x) => x.id === opportunityId);
      if (!o) return err("opportunity_not_found", 404); // 3) сделка
      if (isFinal(o)) return err("opportunity_not_activatable", 409); // 4) финал (ловит повторную активацию)
      if (o.feasibilityStatus == null) return err("feasibility_required", 400); // 5) нужна оценка
      // 6) пересчитываем оценку тем же доменом и решаем по статусу.
      const assessment = assessFeasibility(o, POSITIONS, db.projects);
      if (assessment.status === "blocked") return err("opportunity_not_activatable", 409);
      if (assessment.status === "conflict" && !acceptedRiskReason) return err("risk_acceptance_required", 409);
      // 7) создаём проект (копии из сделки), 8) сделку → won_closed, 9) 201.
      const project: ProjectRecord = {
        id: projectId ?? genId("project"), tenantId: TENANT,
        sourceType: "opportunity", sourceOpportunityId: o.id,
        clientId: o.clientId, projectTypeId: o.projectTypeId, title: o.title, clientName: o.clientName,
        status: "active", plannedStart: o.plannedStart, plannedFinish: o.plannedFinish,
        contractValue: o.contractValue, plannedHours: o.plannedHours, templateId: o.templateId,
        createdAt: nowIso(), activatedAt: nowIso(), closedAt: null, demand: o.demand.map((d) => ({ ...d }))
      };
      db.projects.unshift(project);
      o.status = "won_closed"; o.updatedAt = nowIso();
      return json({ project }, 201);
    }

    /* ---- Карточка сделки: GET /projects (только активные) ---- */
    if (path === "/api/workspace/projects" && method === "GET") {
      const projects = [...db.projects]
        .filter((p) => p.status === "active")
        .sort((a, b) => (b.activatedAt ?? "").localeCompare(a.activatedAt ?? "") || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return json({ projects });
    }

    /* ---- CRM-активности: GET /crm/:entityType/:entityId/activity ---- */
    const crmActivityList = method === "GET" ? path.match(/^\/api\/workspace\/crm\/([^/]+)\/([^/]+)\/activity$/) : null;
    if (crmActivityList) {
      const entityType = decodeURIComponent(crmActivityList[1]!) as CrmActivityEntityType;
      if (entityType !== "opportunity" && entityType !== "client" && entityType !== "contact" && entityType !== "product") return err("crm_entity_type_invalid", 400);
      const entityId = decodeURIComponent(crmActivityList[2]!);
      if (!ID_RE.test(entityId)) return err(entityIdErr(entityType), 400);
      if (!resolveCrmEntity(entityType, entityId)) return err("crm_entity_not_found", 404);
      const activities = db.activities
        .filter((a) => a.entityType === entityType && a.entityId === entityId)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt) || y.id.localeCompare(x.id));
      return json({ activities, attachmentItems: [], systemEvents: [], canReadRawAudit: false, auditEvents: null });
    }

    /* ---- CRM-активности: POST comments / tasks / files ---- */
    const crmActivityCreate = method === "POST" ? path.match(/^\/api\/workspace\/crm\/([^/]+)\/([^/]+)\/(comments|tasks|files)$/) : null;
    if (crmActivityCreate) {
      const entityType = decodeURIComponent(crmActivityCreate[1]!) as CrmActivityEntityType;
      if (entityType !== "opportunity" && entityType !== "client" && entityType !== "contact" && entityType !== "product") return err("crm_entity_type_invalid", 400);
      const entityId = decodeURIComponent(crmActivityCreate[2]!);
      if (!ID_RE.test(entityId)) return err(entityIdErr(entityType), 400);
      const kind = crmActivityCreate[3]!;
      const entity = resolveCrmEntity(entityType, entityId);
      if (!entity) return err("crm_entity_not_found", 404);
      if (entity.isLocked) return err("crm_activity_locked", 409);
      if (bodyArray || bodyPrimitive) return err("invalid_body", 400); // тело-не-объект → invalid_body (боевой isObjectBody)
      const base = { id: `crm-activity-${genId("u")}`, tenantId: TENANT, entityType, entityId, authorUserId: CURRENT_ACTOR_ID, createdAt: nowIso(), updatedAt: nowIso() };
      if (kind === "comments") {
        const text = typeof body.body === "string" ? body.body.trim() : "";
        if (!text || text.length > 4000 || !safeMultiline(text, 4000)) return err("comment_body_required", 400);
        const activity: CrmActivity = { ...base, type: "comment", title: null, body: text, status: null, dueDate: null, assigneeUserId: null, fileUrl: null, fileSizeBytes: null, mimeType: null };
        db.activities.unshift(activity);
        return json({ activity }, 201);
      }
      if (kind === "tasks") {
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (!title || !safeSingleLine(title, 180)) return err("task_title_required", 400);
        const tb = str(body.body); const taskBody = tb === "" ? null : tb; // whitespace-only → null (боевой parseOptionalString)
        if (taskBody !== null && (taskBody.length > 4000 || !safeMultiline(taskBody, 4000))) return err("task_body_invalid", 400);
        let dueDate: string | null = null;
        // боевой parseOptionalDate(UTC) + serializeCrmActivity(.toISOString()) → полная ISO-датавремя UTC-полночь.
        if (body.dueDate != null && body.dueDate !== "") { const d = str(body.dueDate); if (!DATE_RE.test(d)) return err("task_due_date_invalid", 400); dueDate = new Date(`${d}T00:00:00Z`).toISOString(); }
        let assigneeUserId: string | null = null;
        if (body.assigneeUserId != null && body.assigneeUserId !== "") {
          const a = str(body.assigneeUserId);
          if (!/^[a-z0-9][a-z0-9_-]{2,119}$/.test(a) || !CRM_USERS.some((u) => u.id === a)) return err("task_assignee_invalid", 400);
          assigneeUserId = a;
        }
        const activity: CrmActivity = { ...base, type: "task", title, body: taskBody, status: "todo", dueDate, assigneeUserId, fileUrl: null, fileSizeBytes: null, mimeType: null };
        db.activities.unshift(activity);
        return json({ activity }, 201);
      }
      // files
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || !safeSingleLine(title, 240)) return err("file_title_required", 400);
      if (body.fileUrl == null || str(body.fileUrl) === "") return err("file_url_required", 400);
      const fileUrl = str(body.fileUrl);
      if (!isHttpUrl(fileUrl, 1200)) return err("file_url_invalid", 400);
      const fb = str(body.body); const fileBody = fb === "" ? null : fb; // whitespace-only → null
      if (fileBody !== null && (fileBody.length > 4000 || !safeMultiline(fileBody, 4000))) return err("file_description_invalid", 400);
      let mimeType: string | null = null;
      if (body.mimeType != null) { const m = str(body.mimeType); if (m === "") { mimeType = null; } else if (!safeSingleLine(m, 160)) return err("file_mime_type_invalid", 400); else mimeType = m; } // whitespace-only → null
      let fileSizeBytes: number | null = null;
      if (body.fileSizeBytes != null && body.fileSizeBytes !== "") {
        const n = body.fileSizeBytes;
        if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return err("file_size_invalid", 400);
        fileSizeBytes = n;
      }
      const activity: CrmActivity = { ...base, type: "file", title, body: fileBody, status: null, dueDate: null, assigneeUserId: null, fileUrl, fileSizeBytes, mimeType };
      db.activities.unshift(activity);
      return json({ activity }, 201);
    }

    /* ---- CRM-активности: PATCH /crm/:entityType/:entityId/tasks/:activityId ---- */
    const crmTaskPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/crm\/([^/]+)\/([^/]+)\/tasks\/([^/]+)$/) : null;
    if (crmTaskPatch) {
      const entityType = decodeURIComponent(crmTaskPatch[1]!) as CrmActivityEntityType;
      if (entityType !== "opportunity" && entityType !== "client" && entityType !== "contact" && entityType !== "product") return err("crm_entity_type_invalid", 400);
      const entityId = decodeURIComponent(crmTaskPatch[2]!);
      if (!ID_RE.test(entityId)) return err(entityIdErr(entityType), 400);
      const activityId = decodeURIComponent(crmTaskPatch[3]!);
      if (!ID_RE.test(activityId)) return err("invalid_crm_activity_id", 400);
      const entity = resolveCrmEntity(entityType, entityId);
      if (!entity) return err("crm_entity_not_found", 404);
      if (entity.isLocked) return err("crm_activity_locked", 409);
      if (bodyArray || bodyPrimitive) return err("invalid_body", 400); // тело-не-объект → invalid_body (боевой isObjectBody)
      if (body.status !== "todo" && body.status !== "done") return err("task_status_invalid", 400);
      const activity = db.activities.find((a) => a.id === activityId && a.entityType === entityType && a.entityId === entityId && a.type === "task");
      if (!activity) return err("crm_task_not_found", 404);
      activity.status = body.status; activity.updatedAt = nowIso(); // идемпотентно
      return json({ activity });
    }

    return err("not_found", 404);
  };

  return mockFetch;
}
