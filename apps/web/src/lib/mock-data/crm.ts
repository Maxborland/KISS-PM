import type {
  Client,
  Contact,
  DealStage,
  Product,
  ProjectType
} from "@/lib/api-types";

import { MOCK_TENANT_ID } from "./users";

export const MOCK_CLIENTS = [
  {
    id: "cli-romashka",
    tenantId: MOCK_TENANT_ID,
    name: "ООО «Ромашка»",
    description: "Крупный клиент: операционная трансформация и внедрение CRM.",
    status: "active",
    createdAt: "2026-01-11T09:00:00.000Z",
    updatedAt: "2026-05-20T12:30:00.000Z"
  },
  {
    id: "cli-techno",
    tenantId: MOCK_TENANT_ID,
    name: "АО «Техно»",
    description: "Mid-market клиент с несколькими аналитическими инициативами.",
    status: "active",
    createdAt: "2026-02-01T09:00:00.000Z",
    updatedAt: "2026-05-18T10:15:00.000Z"
  },
  {
    id: "cli-acme",
    tenantId: MOCK_TENANT_ID,
    name: "ACME Studio",
    description: "SMB клиент, запрос на аудит процессов продаж.",
    status: "active",
    createdAt: "2026-03-03T09:00:00.000Z",
    updatedAt: "2026-05-17T14:00:00.000Z"
  }
] satisfies Client[];

export const MOCK_CONTACTS = [
  {
    id: "ctc-ivanov",
    tenantId: MOCK_TENANT_ID,
    clientId: "cli-romashka",
    name: "Алексей Иванов",
    email: "ai@romashka.ru",
    phone: "+7 495 100-10-10",
    telegram: "@alexey_romashka",
    role: "CFO",
    status: "active",
    createdAt: "2026-01-12T09:00:00.000Z",
    updatedAt: "2026-05-19T09:00:00.000Z"
  },
  {
    id: "ctc-petrova",
    tenantId: MOCK_TENANT_ID,
    clientId: "cli-techno",
    name: "Мария Петрова",
    email: "mp@tehno.ru",
    phone: "+7 495 200-20-20",
    telegram: "@maria_ops",
    role: "Operations",
    status: "active",
    createdAt: "2026-02-03T09:00:00.000Z",
    updatedAt: "2026-05-16T12:00:00.000Z"
  },
  {
    id: "ctc-kim",
    tenantId: MOCK_TENANT_ID,
    clientId: "cli-acme",
    name: "Анна Ким",
    email: "anna@acme.studio",
    phone: null,
    telegram: "@anna_acme",
    role: "CEO",
    status: "active",
    createdAt: "2026-03-04T09:00:00.000Z",
    updatedAt: "2026-05-12T12:00:00.000Z"
  }
] satisfies Contact[];

export const MOCK_PRODUCTS = [
  {
    id: "prd-crm",
    tenantId: MOCK_TENANT_ID,
    name: "Внедрение CRM",
    sku: "PRD-CRM-01",
    type: "service",
    unit: "проект",
    price: 890000,
    description: "Discovery, настройка CRM, миграция данных и обучение команды.",
    status: "active",
    createdAt: "2026-01-10T09:00:00.000Z",
    updatedAt: "2026-05-10T09:00:00.000Z"
  },
  {
    id: "prd-audit",
    tenantId: MOCK_TENANT_ID,
    name: "Аудит и стратегия",
    sku: "PRD-AUD-01",
    type: "service",
    unit: "пакет",
    price: 240000,
    description: "Аудит процессов, карта рисков, roadmap улучшений.",
    status: "active",
    createdAt: "2026-01-10T09:00:00.000Z",
    updatedAt: "2026-05-10T09:00:00.000Z"
  },
  {
    id: "prd-kpi",
    tenantId: MOCK_TENANT_ID,
    name: "DataHub KPI",
    sku: "PRD-KPI-01",
    type: "service",
    unit: "проект",
    price: 1200000,
    description: "Единый слой KPI, витрины и контрольные сигналы.",
    status: "active",
    createdAt: "2026-01-10T09:00:00.000Z",
    updatedAt: "2026-05-10T09:00:00.000Z"
  }
] satisfies Product[];

export const MOCK_PROJECT_TYPES = [
  {
    id: "ptype-crm",
    tenantId: MOCK_TENANT_ID,
    name: "CRM внедрение",
    description: "Проекты внедрения и доработки CRM.",
    status: "active",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  },
  {
    id: "ptype-analytics",
    tenantId: MOCK_TENANT_ID,
    name: "Аналитика и KPI",
    description: "BI, KPI и управленческий контроль.",
    status: "active",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  },
  {
    id: "ptype-audit",
    tenantId: MOCK_TENANT_ID,
    name: "Аудит процессов",
    description: "Диагностика и roadmap без внедрения.",
    status: "active",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  }
] satisfies ProjectType[];

export const MOCK_DEAL_STAGES = [
  { id: "lead", tenantId: MOCK_TENANT_ID, name: "Лид", sortOrder: 10, status: "active", createdAt: "2026-01-01T09:00:00.000Z", updatedAt: "2026-05-01T09:00:00.000Z" },
  { id: "qual", tenantId: MOCK_TENANT_ID, name: "Квалификация", sortOrder: 20, status: "active", createdAt: "2026-01-01T09:00:00.000Z", updatedAt: "2026-05-01T09:00:00.000Z" },
  { id: "proposal", tenantId: MOCK_TENANT_ID, name: "КП", sortOrder: 30, status: "active", createdAt: "2026-01-01T09:00:00.000Z", updatedAt: "2026-05-01T09:00:00.000Z" },
  { id: "deal", tenantId: MOCK_TENANT_ID, name: "Договор", sortOrder: 40, status: "active", createdAt: "2026-01-01T09:00:00.000Z", updatedAt: "2026-05-01T09:00:00.000Z" },
  { id: "won", tenantId: MOCK_TENANT_ID, name: "Закрыто", sortOrder: 50, status: "active", createdAt: "2026-01-01T09:00:00.000Z", updatedAt: "2026-05-01T09:00:00.000Z" }
] satisfies DealStage[];

export function clientName(clientId: string | null | undefined): string {
  return MOCK_CLIENTS.find((client) => client.id === clientId)?.name ?? "Не указан";
}

export function contactName(contactId: string | null | undefined): string {
  return MOCK_CONTACTS.find((contact) => contact.id === contactId)?.name ?? "Не указан";
}

export function projectTypeName(projectTypeId: string | null | undefined): string {
  return MOCK_PROJECT_TYPES.find((type) => type.id === projectTypeId)?.name ?? "Не указан";
}

export function dealStageName(stageId: string | null | undefined): string {
  return MOCK_DEAL_STAGES.find((stage) => stage.id === stageId)?.name ?? "Без стадии";
}
