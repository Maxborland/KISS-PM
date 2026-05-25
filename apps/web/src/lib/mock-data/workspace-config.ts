import type { CustomFieldDefinition, ProjectTemplate, TaskStatus } from "@/lib/api-types";

import { MOCK_TENANT_ID } from "./users";

export const MOCK_PROJECT_TEMPLATES = [
  {
    id: "tpl-crm",
    tenantId: MOCK_TENANT_ID,
    systemKey: "crm_implementation",
    tenantLabel: "Шаблон · Внедрение CRM",
    description: "Discovery, настройка, миграция, обучение и контроль запуска.",
    status: "active",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  },
  {
    id: "tpl-audit",
    tenantId: MOCK_TENANT_ID,
    systemKey: "process_audit",
    tenantLabel: "Шаблон · Аудит процессов",
    description: "Интервью, карта текущего процесса, риски и roadmap.",
    status: "active",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  }
] satisfies ProjectTemplate[];

export const MOCK_CUSTOM_FIELDS = [
  {
    id: "cf-opportunity-source",
    tenantId: MOCK_TENANT_ID,
    systemKey: "opportunity_source",
    tenantLabel: "Источник сделки",
    targetEntity: "opportunity",
    fieldType: "select",
    required: false,
    status: "active",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  },
  {
    id: "cf-project-risk",
    tenantId: MOCK_TENANT_ID,
    systemKey: "project_risk_level",
    tenantLabel: "Риск проекта",
    targetEntity: "project",
    fieldType: "select",
    required: true,
    status: "active",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  }
] satisfies CustomFieldDefinition[];

export const MOCK_TASK_STATUSES = [
  {
    id: "status-new",
    tenantId: MOCK_TENANT_ID,
    name: "Новая",
    category: "new",
    sortOrder: 10,
    status: "active",
    isSystem: true,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  },
  {
    id: "status-progress",
    tenantId: MOCK_TENANT_ID,
    name: "В работе",
    category: "in_progress",
    sortOrder: 20,
    status: "active",
    isSystem: true,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  },
  {
    id: "status-review",
    tenantId: MOCK_TENANT_ID,
    name: "На приемке",
    category: "review",
    sortOrder: 30,
    status: "active",
    isSystem: true,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  },
  {
    id: "status-done",
    tenantId: MOCK_TENANT_ID,
    name: "Готово",
    category: "done",
    sortOrder: 40,
    status: "active",
    isSystem: true,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z"
  }
] satisfies TaskStatus[];

export function projectTemplateName(templateId: string | null | undefined): string {
  return MOCK_PROJECT_TEMPLATES.find((template) => template.id === templateId)?.tenantLabel ?? "Не указан";
}

export function taskStatusName(statusId: string | null | undefined): string {
  return MOCK_TASK_STATUSES.find((status) => status.id === statusId)?.name ?? "Без статуса";
}
