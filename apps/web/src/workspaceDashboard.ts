import type { AuditEvent, WorkspaceUser } from "./api";

export type AuditPreviewRow = {
  id: string;
  actorName: string;
  actionLabel: string;
  createdAtLabel: string;
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
  "profile.updated": "Профиль обновлен",
  "profile.theme.updated": "Оформление обновлено"
};

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
      actionLabel: auditActionLabels[event.actionType] ?? event.actionType,
      createdAtLabel: auditDateFormatter.format(new Date(event.createdAt))
    }));
}
