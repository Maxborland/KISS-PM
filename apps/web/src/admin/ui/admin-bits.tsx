import { Chip } from "@/components/ui/chip";
import type { UserStatus } from "@/admin/lib/admin-client";

/**
 * Общие крошки поверхностей администрирования: RU-маппер кодов ошибок (зеркало crmErr)
 * и чип статуса пользователя. Коды зеркалят мок-бэкенд (mock-admin-backend) и боевой API
 * (accessRoleRoutes / workspaceUserRoutes).
 */
const ERR: Record<string, string> = {
  // конфликты (409)
  user_email_taken: "Email уже занят другим пользователем",
  user_id_taken: "Идентификатор пользователя уже занят",
  access_role_id_taken: "Идентификатор роли уже занят",
  access_role_name_taken: "Роль с таким названием уже существует",
  access_role_assigned: "Роль назначена пользователям — сначала переназначьте их",
  // self-гварды (400)
  self_access_change_forbidden: "Нельзя деактивировать себя или сменить себе роль",
  self_access_role_update_forbidden: "Нельзя править собственную роль",
  self_access_role_delete_forbidden: "Нельзя удалить собственную роль",
  self_user_delete_forbidden: "Нельзя удалить себя",
  // резолвы (400)
  invalid_access_role: "Выберите роль доступа",
  invalid_position: "Выберите существующую позицию",
  invalid_position_id: "Некорректная позиция",
  // валидация полей (400)
  invalid_user_email: "Некорректный email",
  invalid_user_name: "Укажите имя",
  invalid_user_password: "Пароль — не короче 8 символов",
  invalid_user_status: "Некорректный статус",
  invalid_user_id: "Некорректный идентификатор пользователя",
  invalid_access_profile_id: "Идентификатор роли: a-z, 0-9, _-, длина 3…120",
  invalid_access_profile_name: "Укажите название роли",
  invalid_permissions: "Некорректный набор прав",
  // политика безопасности (400)
  security_policy_invalid: "Некорректные данные политики безопасности",
  security_policy_session_timeout_invalid: "Тайм-аут сессии — целое число от 1 до 8760 часов",
  security_policy_domain_allowlist_invalid: "Список доменов: только строки",
  // not-found (404)
  user_not_found: "Пользователь не найден",
  access_role_not_found: "Роль не найдена",
  // авторизация (401/403) — BUG-ADM-01/SHELL-06: раньше утекали сырым кодом
  session_required: "Требуется вход в систему",
  permission_missing: "Недостаточно прав для этого действия",
  forbidden: "Доступ запрещён"
};
export const adminErr = (code?: string, fallback?: string) => (code && ERR[code]) || fallback || "Не удалось выполнить действие";

export function UserStatusChip({ status }: { status: UserStatus }) {
  return status === "active" ? (
    <Chip variant="success">Активен</Chip>
  ) : (
    <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-xs)] font-medium text-[var(--muted-soft)]">Неактивен</span>
  );
}

// Результат события аудита (зеркало v2 auditResultLabel: status → RU).
export const auditResultLabel = (status?: string): "Успешно" | "Ошибка" | "Отклонено правами" | "Записано в журнал" =>
  status === "succeeded" || status === "success" ? "Успешно"
  : status === "failed" || status === "error" ? "Ошибка"
  : status === "denied" ? "Отклонено правами"
  : "Записано в журнал";

export function AuditResultChip({ status }: { status?: string | undefined }) {
  const label = auditResultLabel(status);
  if (label === "Успешно") return <Chip variant="success">{label}</Chip>;
  if (label === "Ошибка") return <Chip variant="danger">{label}</Chip>;
  if (label === "Отклонено правами") return <Chip variant="warning">{label}</Chip>;
  return <Chip variant="info">{label}</Chip>;
}

// Человекочитаемая метка action-типа аудита. Известные группы → RU; иначе — сам код (mono).
const AUDIT_ACTION_LABEL: Record<string, string> = {
  "workspace.security_policy.updated": "Политика безопасности обновлена",
  // BUG-ADM-05: API эмитит tenant.access_profile.*, а не access_role.* — старые ключи никогда не совпадали.
  "tenant.access_profile.created": "Роль создана",
  "tenant.access_profile.updated": "Роль изменена",
  "tenant.access_profile.deleted": "Роль удалена",
  // алиасы на старые коды (на случай исторических записей аудита)
  "access_role.created": "Роль создана",
  "access_role.update": "Роль изменена",
  "access_role.deleted": "Роль удалена",
  "workspace.user.created": "Пользователь создан",
  "workspace.user.updated": "Пользователь изменён",
  "workspace.user.deactivated": "Пользователь деактивирован",
  "control_surface.published": "Контрол-поверхность опубликована",
  "control_surface.publish_blocked": "Публикация поверхности заблокирована",
  "control_surface.rolled_back": "Откат контрол-поверхности",
  "workspace.custom_field.created": "Кастом-поле создано",
  "workspace.custom_field.updated": "Кастом-поле изменено",
  "workspace.project_template.created": "Шаблон проекта создан",
  "workspace.project_template.updated": "Шаблон проекта изменён",
  "notification.preference_updated": "Настройки уведомлений обновлены"
};
export const auditActionLabel = (actionType: string): string => AUDIT_ACTION_LABEL[actionType] ?? actionType;
