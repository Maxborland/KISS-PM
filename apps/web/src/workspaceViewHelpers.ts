import type { CustomFieldDefinition, ProjectTemplate } from "./api";

export const rolePermissionOptions = [
  { value: "tenant.users.read", label: "Читать пользователей" },
  { value: "tenant.users.manage", label: "Управлять пользователями" },
  { value: "tenant.access_profiles.read", label: "Читать роли доступа" },
  { value: "tenant.access_profiles.manage", label: "Управлять ролями доступа" },
  { value: "tenant.positions.read", label: "Читать должности" },
  { value: "tenant.positions.manage", label: "Управлять должностями" },
  { value: "tenant.audit_events.read", label: "Читать аудит" },
  { value: "tenant.workspace_config.read", label: "Читать настройки рабочего пространства" },
  { value: "tenant.workspace_config.manage", label: "Управлять настройками рабочего пространства" },
  { value: "tenant.clients.read", label: "Читать клиентов" },
  { value: "tenant.clients.manage", label: "Управлять клиентами" },
  { value: "tenant.contacts.read", label: "Читать контакты" },
  { value: "tenant.contacts.manage", label: "Управлять контактами" },
  { value: "tenant.products.read", label: "Читать товары и услуги" },
  { value: "tenant.products.manage", label: "Управлять товарами и услугами" },
  { value: "tenant.project_types.read", label: "Читать типы проектов" },
  { value: "tenant.project_types.manage", label: "Управлять типами проектов" },
  { value: "tenant.deal_stages.read", label: "Читать этапы сделок" },
  { value: "tenant.deal_stages.manage", label: "Управлять этапами сделок" },
  { value: "tenant.opportunities.read", label: "Читать сделки" },
  { value: "tenant.opportunities.manage", label: "Управлять сделками" },
  { value: "tenant.projects.read", label: "Читать проекты" },
  { value: "tenant.projects.manage", label: "Управлять проектами" },
  { value: "tenant.project_activation.manage", label: "Активировать проекты" },
  { value: "tenant.resource_feasibility.read", label: "Проверять ресурсную реализуемость" },
  { value: "profile.read", label: "Читать профиль" },
  { value: "profile.update", label: "Обновлять профиль" },
  { value: "workspace.theme.manage", label: "Управлять темой" }
] as const;

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
  year: "numeric"
});

export function filterCustomFields(
  fields: readonly CustomFieldDefinition[],
  query: string
): CustomFieldDefinition[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...fields];

  return fields.filter((field) =>
    [
      field.systemKey,
      field.tenantLabel,
      field.fieldType,
      field.status,
      field.required ? "обязательное" : "необязательное"
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

export function filterProjectTemplates(
  templates: readonly ProjectTemplate[],
  query: string
): ProjectTemplate[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...templates];

  return templates.filter((template) =>
    [template.systemKey, template.tenantLabel, template.description, template.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

export function getFieldTypeLabel(fieldType: CustomFieldDefinition["fieldType"]): string {
  const labels = {
    text: "Текст",
    number: "Число",
    date: "Дата",
    select: "Список"
  } satisfies Record<CustomFieldDefinition["fieldType"], string>;

  return labels[fieldType];
}

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}
