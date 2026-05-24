import type { AuditEvent, WorkspaceUser } from "./api";

export type AuditPreviewRow = {
  id: string;
  actorName: string;
  actionLabel: string;
  createdAtLabel: string;
};

export type AuditChangeSummary = {
  detail: string;
  title: string;
};

const auditActionLabels: Record<string, string> = {
  "tenant.access_profile.created": "Роль доступа создана",
  "tenant.access_profile.updated": "Роль доступа обновлена",
  "tenant.access_profile.deleted": "Роль доступа удалена",
  "workspace.user.created": "Пользователь создан",
  "workspace.user.updated": "Пользователь обновлен",
  "workspace.user.deleted": "Пользователь удален",
  "workspace.position.created": "Должность создана",
  "workspace.position.updated": "Должность обновлена",
  "workspace.position.deleted": "Должность удалена",
  "workspace.custom_field.created": "Пользовательское поле создано",
  "workspace.custom_field.updated": "Пользовательское поле обновлено",
  "workspace.project_template.created": "Шаблон проекта создан",
  "workspace.project_template.updated": "Шаблон проекта обновлен",
  "client.created": "Клиент создан",
  "client.updated": "Клиент обновлен",
  "contact.created": "Контакт создан",
  "contact.updated": "Контакт обновлен",
  "project_type.created": "Тип проекта создан",
  "project_type.updated": "Тип проекта обновлен",
  "deal_stage.created": "Этап сделки создан",
  "deal_stage.updated": "Этап сделки обновлен",
  "opportunity.created": "Сделка создана",
  "opportunity.stage_updated": "Этап сделки изменен",
  "opportunity.won_closed": "Сделка закрыта как выигранная",
  "opportunity.lost_rejected": "Сделка отклонена",
  "opportunity.feasibility_checked": "Ресурсная проверка сделки выполнена",
  "opportunity.comment.created": "Комментарий по сделке создан",
  "opportunity.task.created": "Задача по сделке создана",
  "opportunity.task.completed": "Задача по сделке выполнена",
  "opportunity.task.reopened": "Задача по сделке переоткрыта",
  "project.activated": "Проект активирован",
  "planning.command_denied": "Planning команда отклонена",
  "planning.command_conflict": "Конфликт версии planning",
  "planning.task.created": "Planning задача создана",
  "planning.task.updated": "Planning задача обновлена",
  "planning.task.status_changed": "Planning статус задачи изменен",
  "planning.task.deleted": "Planning задача удалена",
  "planning.task.archived": "Planning задача архивирована",
  "planning.dependency.upserted": "Planning связь создана",
  "planning.dependency.deleted": "Planning связь удалена",
  "planning.assignment.upserted": "Planning назначение создано",
  "planning.assignment.deleted": "Planning назначение удалено",
  "planning.baseline.captured": "Baseline зафиксирован",
  "planning.calendar_exception.upserted": "Исключение календаря создано",
  "planning.constraint.updated": "Planning ограничение обновлено",
  "planning.resource_reserved": "Ресурс зарезервирован",
  "planning.overload_risk_accepted": "Риск перегруза принят",
  "planning.scenario.previewed": "Planning сценарии построены",
  "planning.scenario_denied": "Planning сценарий отклонен",
  "planning.scenario.applied": "Planning сценарий применен",
  "task.created": "Задача создана",
  "task.status_changed": "Статус задачи изменен",
  "profile.updated": "Профиль обновлен",
  "profile.theme.updated": "Оформление обновлено"
};

const auditStateLabels: Record<string, string> = {
  description: "Описание",
  fieldType: "Тип",
  required: "Обязательное",
  status: "Статус",
  systemKey: "Системный ключ",
  tenantLabel: "Название"
};

const trackedStateKeys = [
  "tenantLabel",
  "systemKey",
  "fieldType",
  "required",
  "status",
  "description",
  "name",
  "title",
  "stageId"
];

const auditDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
  year: "numeric"
});

export function buildAuditPreviewRows(
  auditEvents: readonly AuditEvent[],
  users: readonly WorkspaceUser[],
  limit = 6
): AuditPreviewRow[] {
  const usersById = new Map(users.map((user) => [user.id, user.name]));

  return [...auditEvents]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      actorName: usersById.get(event.actorUserId) ?? `Пользователь ${event.actorUserId}`,
      actionLabel: getAuditActionLabel(event.actionType),
      createdAtLabel: auditDateFormatter.format(new Date(event.createdAt))
    }));
}

export function getAuditActionLabel(actionType: string): string {
  return auditActionLabels[actionType] ?? actionType;
}

export function buildAuditChangeSummary(event: AuditEvent): AuditChangeSummary {
  const beforeState = event.beforeState ?? null;
  const afterState = event.afterState ?? null;

  if (!beforeState && afterState) {
    return {
      title: "Создано",
      detail: summarizeState(afterState)
    };
  }

  if (beforeState && !afterState) {
    return {
      title: "Удалено",
      detail: summarizeState(beforeState)
    };
  }

  if (!beforeState || !afterState) {
    return {
      title: "Без снимка",
      detail: "Состояние до/после не передано"
    };
  }

  const changes = trackedStateKeys
    .filter((key) => beforeState[key] !== afterState[key])
    .map(
      (key) =>
        `${auditStateLabels[key] ?? key}: ${formatStateValue(beforeState[key])} -> ${formatStateValue(afterState[key])}`
    );

  if (changes.length === 0) {
    return {
      title: "Без изменений",
      detail: "Снимки до/после совпадают"
    };
  }

  return {
    title: `${changes.length} ${getChangeWord(changes.length)}`,
    detail: changes.slice(0, 3).join("; ")
  };
}

function summarizeState(state: Record<string, unknown>): string {
  const tenantLabel = formatStateValue(state.tenantLabel);
  const systemKey = formatStateValue(state.systemKey);
  const status = formatStateValue(state.status);
  return `${tenantLabel} / ${systemKey} / ${status}`;
}

function formatStateValue(value: unknown): string {
  if (value === true) return "да";
  if (value === false) return "нет";
  if (value === null || value === undefined || value === "") return "не задано";
  return String(value);
}

function getChangeWord(count: number): string {
  if (count === 1) return "изменение";
  if (count > 1 && count < 5) return "изменения";
  return "изменений";
}
