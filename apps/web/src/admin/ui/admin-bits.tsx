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
  email_domain_not_allowed: "Домен email не входит в список разрешённых (политики безопасности)",
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

/* ---- Человеческие подписи прав доступа (G6-09) ----
   Код права: tenant.<ресурс>.<действие> (плюс пара спец-кодов профиля/темы).
   Неизвестный код показывается как есть. */
const PERMISSION_RESOURCE: Record<string, string> = {
  projects: "Проекты",
  project_plan: "План проекта",
  project_resources: "Ресурсы проекта",
  project_baselines: "Базовые планы проекта",
  project_activation: "Активация проектов",
  project_types: "Типы проектов",
  planning_scenarios: "Сценарии планирования",
  opportunities: "Сделки",
  clients: "Клиенты",
  contacts: "Контакты",
  products: "Продукты",
  users: "Пользователи",
  positions: "Должности",
  org_structure: "Оргструктура",
  access_profiles: "Роли доступа",
  audit_events: "Журнал аудита",
  communications: "Коммуникации",
  workspace_config: "Настройки рабочей области",
  absences: "Отсутствия",
  background_jobs: "Фоновые задачи",
  control_signals: "Сигналы контроля",
  control_surfaces: "Панели контроля",
  corrective_actions: "Корректирующие действия",
  management_actions: "Управленческие действия",
  crm_pipelines: "Воронки CRM",
  crm_pipeline_rules: "Правила воронок",
  crm_pipeline_automations: "Автоматизации воронок",
  deal_stages: "Стадии сделок",
  retrospectives: "Ретроспективы",
  tasks: "Задачи",
  task_statuses: "Статусы задач",
  template_improvements: "Улучшения шаблонов",
  resource_feasibility: "Осуществимость",
  production_calendar: "Производственный календарь",
  kpi_definitions: "KPI"
};
const PERMISSION_ACTION: Record<string, string> = {
  read: "просмотр",
  manage: "управление",
  create: "создание",
  edit: "правка",
  delete: "удаление",
  publish: "публикация",
  apply: "применение",
  preview: "предпросмотр",
  execute: "выполнение",
  update: "правка"
};
// Спец-коды вне схемы tenant.<ресурс>.<действие>.
const PERMISSION_SPECIAL: Record<string, { resourceLabel: string; actionLabel: string }> = {
  "profile.read": { resourceLabel: "Профиль", actionLabel: "просмотр" },
  "profile.update": { resourceLabel: "Профиль", actionLabel: "правка" },
  "workspace.theme.manage": { resourceLabel: "Профиль", actionLabel: "тема оформления" }
};

/** Разбор кода права: ресурс + действие по-русски; null — код неизвестен (показывать как есть). */
export function permissionParts(code: string): { resourceLabel: string; actionLabel: string } | null {
  const special = PERMISSION_SPECIAL[code];
  if (special) return special;
  const segments = code.split(".");
  if (segments.length !== 3 || segments[0] !== "tenant") return null;
  const resourceLabel = PERMISSION_RESOURCE[segments[1]!];
  const actionLabel = PERMISSION_ACTION[segments[2]!];
  return resourceLabel && actionLabel ? { resourceLabel, actionLabel } : null;
}

/** Человеческая подпись права: «Проекты: просмотр». Неизвестный код — как есть. */
export function permissionLabel(code: string): string {
  const parts = permissionParts(code);
  return parts ? `${parts.resourceLabel}: ${parts.actionLabel}` : code;
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
// Префикс-правила для неизвестных хвостов (G6-06): хотя бы группа события по-русски.
const AUDIT_ACTION_PREFIX: Array<[string, string]> = [
  ["workspace.user.", "Пользователь"],
  ["tenant.access_profile.", "Роль"],
  ["access_role.", "Роль"],
  ["workspace.security_policy.", "Политика безопасности"],
  ["communications.", "Коммуникации"],
  ["control_surface.", "Панель контроля"]
];
export const auditActionLabel = (actionType: string): string => {
  const exact = AUDIT_ACTION_LABEL[actionType];
  if (exact) return exact;
  const prefix = AUDIT_ACTION_PREFIX.find(([p]) => actionType.startsWith(p));
  if (prefix) return `${prefix[1]} — ${actionType.slice(prefix[0].length)}`;
  return actionType;
};
