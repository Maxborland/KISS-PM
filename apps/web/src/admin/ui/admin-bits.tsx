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
  // not-found (404)
  user_not_found: "Пользователь не найден",
  access_role_not_found: "Роль не найдена"
};
export const adminErr = (code?: string, fallback?: string) => (code && ERR[code]) || fallback || code || "Ошибка";

export function UserStatusChip({ status }: { status: UserStatus }) {
  return status === "active" ? (
    <Chip variant="success">Активен</Chip>
  ) : (
    <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-xs)] font-medium text-[var(--muted-soft)]">Неактивен</span>
  );
}
