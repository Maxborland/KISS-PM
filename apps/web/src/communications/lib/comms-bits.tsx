import type { ReactNode } from "react";
import { AtSign, CalendarClock, ListTodo, Phone, ShieldAlert } from "lucide-react";

import type { BemAvatarColor } from "@/components/domain/bem-avatar";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import type { CallRoomStatus, CommunicationChannelRole, EntityType, NotificationType } from "./comms-client";

/* ============================================================
   Общие крошки поверхностей «Коммуникации» (зеркало crm-bits):
   RU-маппинг кодов ошибок, относительное время, справочник пользователей,
   мелкие UI-чипы. Используется всеми поверхностями блока.
   ============================================================ */

/* ---- RU-маппинг кодов ошибок (собрано из §2 спеки: chat/channels/calls/meetings/notifications) ---- */
const ERR: Record<string, string> = {
  // сессия / общие
  session_required: "Требуется вход в систему",
  permission_missing: "Недостаточно прав",
  not_found: "Не найдено",
  invalid_json: "Некорректный запрос",
  invalid_content_length: "Некорректный размер запроса",
  payload_too_large: "Запрос слишком большой",
  unsupported_media_type: "Неподдерживаемый формат запроса",
  // collaboration entity
  collaboration_entity_type_invalid: "Неизвестный тип сущности",
  collaboration_entity_id_invalid: "Некорректный идентификатор сущности",
  collaboration_entity_not_found: "Сущность не найдена",
  collaboration_not_configured: "Возможность недоступна",
  communications_not_configured: "Возможность недоступна",
  communications_entity_not_found: "Сущность не найдена",
  // беседы / сообщения
  conversation_id_invalid: "Некорректный идентификатор беседы",
  conversation_not_found: "Беседа не найдена",
  conversation_cursor_invalid: "Некорректный курсор",
  conversation_title_required: "Укажите название",
  conversation_title_invalid: "Некорректное название",
  message_not_found: "Сообщение не найдено",
  message_body_required: "Введите текст сообщения",
  message_body_invalid: "Некорректный текст сообщения",
  message_reaction_emoji_invalid: "Некорректная реакция",
  reaction_id_invalid: "Некорректный идентификатор реакции",
  reaction_not_found: "Реакция не найдена",
  sticker_asset_id_invalid: "Некорректный стикер",
  sticker_asset_not_found: "Стикер не найден",
  // каналы
  communication_channel_type_invalid: "Неизвестный тип канала",
  communication_channel_type_not_creatable: "Этот канал нельзя создать",
  communication_channel_id_invalid: "Некорректный идентификатор канала",
  communication_channel_not_found: "Канал не найден",
  communication_channel_description_invalid: "Некорректное описание",
  communication_channel_role_invalid: "Некорректная роль",
  communication_channel_scope_required: "Укажите область канала",
  communication_channel_scope_type_invalid: "Некорректная область канала",
  communication_channel_scope_not_found: "Область канала не найдена",
  communication_channel_patch_empty: "Нет изменений",
  channel_member_not_found: "Участник не найден",
  tenant_user_id_invalid: "Некорректный пользователь",
  tenant_user_not_found: "Пользователь не найден",
  // звонки
  call_room_id_invalid: "Некорректный идентификатор комнаты",
  call_room_not_found: "Комната звонка не найдена",
  call_title_required: "Укажите название звонка",
  call_title_invalid: "Некорректное название звонка",
  call_media_kind_invalid: "Некорректный тип медиа",
  call_room_provider_invalid: "Некорректный провайдер",
  call_room_provider_room_conflict: "Комната с таким идентификатором уже существует",
  call_room_already_active: "Звонок уже активен",
  call_session_id_invalid: "Некорректная сессия",
  call_session_not_found: "Сессия не найдена",
  call_session_not_active: "Сессия не активна",
  call_participant_state_invalid: "Некорректное состояние участника",
  participant_user_id_invalid: "Некорректный пользователь",
  participant_user_not_found: "Участник не найден",
  call_recording_attachment_invalid: "Некорректное вложение записи",
  attachment_id_invalid: "Некорректное вложение",
  meeting_id_invalid: "Некорректный идентификатор встречи",
  provider_room_id_invalid: "Некорректный идентификатор комнаты провайдера",
  video_provider_disabled: "Видеосвязь отключена",
  video_provider_misconfigured: "Видеопровайдер настроен неверно",
  // митинги
  meeting_not_found: "Встреча не найдена",
  meeting_title_required: "Укажите название встречи",
  meeting_title_invalid: "Некорректное название встречи",
  meeting_agenda_invalid: "Некорректная повестка",
  meeting_start_invalid: "Некорректное время начала",
  meeting_finish_invalid: "Некорректное время окончания",
  meeting_schedule_invalid: "Окончание должно быть позже начала",
  meeting_status_invalid: "Некорректный статус встречи",
  meeting_participants_too_many: "Слишком много участников",
  meeting_participant_user_id_invalid: "Некорректный участник",
  meeting_external_link_provider_invalid: "Некорректный провайдер ссылки",
  meeting_note_body_required: "Введите текст заметки",
  meeting_note_body_invalid: "Некорректный текст заметки",
  meeting_action_owner_invalid: "Некорректный ответственный",
  meeting_action_due_date_invalid: "Некорректный срок",
  meeting_action_target_required: "Укажите объект действия",
  meeting_action_target_type_invalid: "Некорректный тип объекта",
  meeting_action_target_id_invalid: "Некорректный идентификатор объекта",
  external_url_required: "Укажите ссылку",
  external_url_invalid: "Некорректная ссылка",
  external_url_too_long: "Ссылка слишком длинная",
  external_url_private_host: "Ссылка на приватный адрес запрещена",
  external_title_required: "Укажите название ссылки",
  external_title_invalid: "Некорректное название ссылки",
  // уведомления
  notification_status_invalid: "Некорректный фильтр",
  notification_id_invalid: "Некорректный идентификатор уведомления",
  notification_not_found: "Уведомление не найдено",
  notification_preferences_invalid: "Некорректные настройки",
  notification_preferences_too_many: "Слишком много настроек",
  notification_channel_invalid: "Некорректный канал доставки",
  notification_type_invalid: "Некорректный тип уведомления",
  digest_frequency_invalid: "Некорректная частота дайджеста"
};
export const commsErr = (code?: string, fallback?: string) => (code && ERR[code]) || fallback || code || "Ошибка";

/* ---- Относительное время на русском (relTime): «только что», «5 мин назад», «вчера», дата. ---- */
export function relTime(iso: string, now: Date = new Date()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = now.getTime() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return "только что";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} ${plural(min, "мин", "мин", "мин")} назад`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ${plural(hr, "час", "часа", "часов")} назад`;
  const day = Math.round(hr / 24);
  if (day === 1) return "вчера";
  if (day < 7) return `${day} ${plural(day, "день", "дня", "дней")} назад`;
  return new Date(then).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// Русская плюрализация (1 час / 2 часа / 5 часов).
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/* ---- Справочник пользователей (как CRM_USERS): id → имя, инициалы, цвет аватара ---- */
export const COMMS_USERS: { id: string; name: string }[] = [
  { id: "u-anna", name: "Анна П." },
  { id: "u-ivan", name: "Иван И." },
  { id: "u-sergey", name: "Сергей П." },
  { id: "u-maria", name: "Мария К." }
];
const userById = new Map(COMMS_USERS.map((u) => [u.id, u]));
const AV: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];

export const userName = (id: string | null): string => (id ? userById.get(id)?.name ?? id : "—");
export const initials = (name: string): string => {
  const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
};
export const avatarColor = (id: string | null): BemAvatarColor => {
  const i = COMMS_USERS.findIndex((u) => u.id === id);
  return i < 0 ? "c5" : AV[i % AV.length]!;
};

/* ---- Мелкие UI-крошки ---- */

// Точка непрочитанного (для списка бесед/каналов).
export function UnreadDot({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[length:var(--text-xs)] font-semibold leading-none text-white",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Индикатор присутствия (P4.3): зелёный=online, янтарь=away, серый=offline.
const PRESENCE_STYLE: Record<"online" | "away" | "offline", { color: string; label: string }> = {
  online: { color: "var(--success)", label: "В сети" },
  away: { color: "var(--warning, #d97706)", label: "Недавно был(а)" },
  offline: { color: "var(--muted-soft)", label: "Не в сети" }
};
export function PresenceDot({ status, className }: { status: "online" | "away" | "offline"; className?: string }) {
  const style = PRESENCE_STYLE[status];
  return (
    <span
      title={style.label}
      aria-label={style.label}
      className={cn("inline-block size-2 shrink-0 rounded-full ring-2 ring-[var(--panel)]", className)}
      style={{ backgroundColor: style.color }}
    />
  );
}

const ROLE_LABEL: Record<CommunicationChannelRole, string> = { owner: "Владелец", moderator: "Модератор", member: "Участник" };
// Чип роли участника канала.
export function RoleChip({ role }: { role: CommunicationChannelRole }) {
  const variant = role === "owner" ? "violet" : role === "moderator" ? "info" : undefined;
  return <Chip variant={variant}>{ROLE_LABEL[role]}</Chip>;
}

const CALL_STATUS: Record<CallRoomStatus, { label: string; variant: "info" | "success" | "warning" | "danger" | "violet" | undefined }> = {
  scheduled: { label: "Запланирован", variant: "info" },
  open: { label: "Открыт", variant: "info" },
  active: { label: "Идёт", variant: "success" },
  ended: { label: "Завершён", variant: undefined },
  cancelled: { label: "Отменён", variant: "danger" }
};
// Чип статуса комнаты звонка.
export function CallStatusChip({ status }: { status: CallRoomStatus }) {
  const s = CALL_STATUS[status];
  return <Chip variant={s.variant}>{s.label}</Chip>;
}

const ENTITY_LABEL: Record<EntityType, string> = {
  project: "Проект",
  task: "Задача",
  opportunity: "Сделка",
  client: "Клиент",
  contact: "Контакт",
  product: "Продукт",
  communication_channel: "Канал"
};
// Бейдж типа сущности, к которой привязана коллаборация.
export function EntityBadge({ entityType }: { entityType: EntityType }) {
  return <Chip>{ENTITY_LABEL[entityType]}</Chip>;
}

const NOTIF_ICON: Record<NotificationType, ReactNode> = {
  mention: <AtSign className="size-4" aria-hidden />,
  assignment_changed: <ListTodo className="size-4" aria-hidden />,
  deadline_risk: <ShieldAlert className="size-4" aria-hidden />,
  control_signal: <ShieldAlert className="size-4" aria-hidden />,
  meeting_invite: <CalendarClock className="size-4" aria-hidden />,
  meeting_action_item: <ListTodo className="size-4" aria-hidden />
};
// Иконка типа уведомления (для ленты).
export function NotifTypeIcon({ type }: { type: NotificationType }) {
  return <span className="text-[var(--muted)]">{NOTIF_ICON[type] ?? <Phone className="size-4" aria-hidden />}</span>;
}
