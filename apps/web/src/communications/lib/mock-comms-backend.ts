/* ============================================================
   Contract-grounded mock backend для блока «Коммуникации» (Storybook).

   ЧЕСТНОСТЬ: in-memory мок, реализующий реальный REST-контракт
   /api/workspace/{conversations,communication-channels}. Компонент
   работает через настоящий createCommsClient (с fetchImpl), поэтому
   переключение на боевой API = смена apiOrigin.

   Этот мок реализует ЧАТ (ручки 1-9), КАНАЛЫ (10-16), ЗВОНКИ (17-25),
   МИТИНГИ (26-31) и УВЕДОМЛЕНИЯ (32-35) — полный контракт блока.

   Валидация и коды ошибок зеркалят apps/api (collaborationRoutes.ts /
   communicationUpgradeRoutes.ts) через домен-парсеры из @kiss-pm/domain
   (parseMessageBody, parseConversationTitle, parseCollaborationId и т.д.) —
   коды НЕ выдумываются, контракт {ok,error} → err(error,400).

   УПРОЩЕНИЯ (см. §8 спеки):
   - Нет realtime/WebSocket: «живость» = ре-фетч после мутаций.
   - RBAC упрощён: actor=u-anna имеет read+manage на demo-сущность и на
     каналах, где owner. 403-ветки зеркалят коды, но на demo-данных не
     активируются (нет реального access-control).
   - Стикер-upload вне скоупа: только сид-ассеты (POST со stickerAssetId).
   - body-size коды (413/415/invalid_content_length) приблизительны/опущены;
     invalid_json ловим через try/catch (как mock-crm-backend).
   - unreadCount фиксирован в сиде и обнуляется read-state; инкремент при
     новом сообщении опускаем (TODO, см. §8 п.3).
   ============================================================ */

import {
  extractMentionedUserIds,
  parseCallMediaKind,
  parseCallParticipantState,
  parseCallRoomProvider,
  parseCallTitle,
  parseCollaborationEntityType,
  parseCollaborationId,
  parseCommunicationChannelDescription,
  parseCommunicationChannelRole,
  parseCommunicationChannelType,
  parseConversationTitle,
  parseDigestFrequency,
  parseMeetingActionTargetType,
  parseMeetingAgenda,
  parseMeetingExternalLinkProvider,
  parseMeetingNoteBody,
  parseMeetingStatus,
  parseMeetingTitle,
  parseMessageBody,
  parseMessageReactionEmoji,
  parseNotificationChannel,
  parseNotificationType,
  parseProviderRoomId
} from "@kiss-pm/domain";

import type {
  CallEvent,
  CallParticipantState,
  CallRecording,
  CallRoom,
  CallSession,
  Channel,
  ChannelMember,
  Conversation,
  ConversationReadState,
  Meeting,
  MeetingActionItem,
  MeetingExternalLink,
  MeetingNote,
  MeetingParticipant,
  Message,
  MessageMention,
  MessageSticker,
  NotificationPreference,
  Reaction,
  UserNotification
} from "./comms-client";

const TENANT = "tenant-alpha";
const CURRENT_ACTOR_ID = "u-anna"; // в проде actor сессии; в моке — фиксированный «текущий пользователь»

/* Сконфигурированный видео-провайдер деплоя (зеркало KISS_PM_VIDEO_PROVIDER).
   join-token для room.provider===этому значению отдаёт ссылку; иначе — честный
   отказ 409 video_provider_misconfigured. provider="disabled" → 501 (не наш случай). */
const MOCK_VIDEO_PROVIDER = "jitsi";
// Базовый URL для join-ссылок manual/jitsi (joinUrl = base + '/' + providerRoomId).
const VIDEO_BASE_URL = "https://meet.kiss-pm.example";

/* Пользователи рабочей области — справочные данные для @mentions, участников, реакций.
   Экспортируется (как CRM_USERS) для UI и сидов поверхностей. */
export type CommsUser = { id: string; name: string };
export const COMMS_USERS: CommsUser[] = [
  { id: "u-anna", name: "Анна П." },
  { id: "u-ivan", name: "Иван И." },
  { id: "u-sergey", name: "Сергей П." },
  { id: "u-maria", name: "Мария К." }
];

/* Demo-сущность (entity-scoped): стабильный проект proj-portal — «корень» для chat/calls/meetings.
   actor=u-anna имеет read+manage. RBAC-стаб ниже опирается на этот id. */
export const DEMO_ENTITY = { entityType: "project" as const, entityId: "proj-portal" };

const nowIso = () => new Date().toISOString();
let SEQ = 0;
const genId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(SEQ += 1).toString(36)}`;

/* Стикер-ассет (в моке используется только id+emoji+title): сид без upload-роутов. */
type StickerAsset = { id: string; emoji: string; title: string };

type Store = {
  conversations: Conversation[];
  messages: Message[]; // храним вместе с reactions/stickers (подтягиваются при выдаче)
  reactions: Reaction[];
  stickers: MessageSticker[]; // ключ messageId+stickerAssetId
  mentions: MessageMention[];
  readStates: ConversationReadState[];
  stickerAssets: StickerAsset[];
  channels: Channel[]; // serialized-форма (canManage пересчитываем при выдаче)
  channelMembers: ChannelMember[];
  notifications: UserNotification[]; // mention-уведомления (сид + порождённые POST message)
  notificationPreferences: NotificationPreference[]; // настройки уведомлений (UPSERT, raw без дат)
  // ЗВОНКИ. CallRoom храним в ДОМЕННОЙ форме (id/providerRoomId/archivedAt) — сериализатор омитит при выдаче.
  callRooms: CallRoomRecord[];
  callSessions: CallSession[];
  callEvents: CallEvent[];
  callRecordings: CallRecording[];
  callParticipantStates: CallParticipantStateRecord[]; // ключ room+session+user
  // МИТИНГИ.
  meetings: Meeting[];
  meetingParticipants: MeetingParticipant[];
  meetingNotes: MeetingNote[];
  meetingExternalLinks: MeetingExternalLink[];
  meetingActionItems: MeetingActionItem[];
};

/* Доменная запись CallRoom (с полями, которые сериализатор омитит: id/providerRoomId/archivedAt). */
type CallRoomRecord = {
  id: string;
  tenantId: string;
  entityType: CallRoom["entityType"];
  entityId: string;
  meetingId: string | null;
  title: string;
  mediaKind: CallRoom["mediaKind"];
  provider: CallRoom["provider"];
  providerRoomId: string;
  status: CallRoom["status"];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

/* Доменная запись состояния участника (с tenantId, который сериализатор омитит). */
type CallParticipantStateRecord = CallParticipantState & { tenantId: string };

/* ---- RBAC-стаб (упрощён): actor=u-anna read+manage на demo-сущности и где owner ---- */
// read на сущность беседы: всегда true в демо (actor имеет доступ к demo-entity и каналам-членствам).
// 403-ветки зеркалят коды в комментариях, но не активируются на сид-данных (см. §8 п.5).
const canReadEntity = (_entityType: string, _entityId: string): boolean => true;
const canManageEntity = (_entityType: string, _entityId: string): boolean => true;

/* Доступ к каналу (зеркало resolveCommunicationChannelAccess, упрощён):
   read = workspace_general ИЛИ членство ИЛИ manage; manage = canManageCommunications(=true для actor)
   ИЛИ роль actor в канале owner/moderator. В демо actor — owner созданных каналов и сидового custom. */
const channelCanManage = (channelId: string, channelType: string, members: ChannelMember[]): boolean => {
  // Боевой resolveCommunicationChannelAccess НЕ исключает workspace_general из manage:
  // canManage = canManageCommunications(=true для actor) ИЛИ роль owner/moderator. Для всех типов одинаково.
  const m = members.find((x) => x.channelId === channelId && x.userId === CURRENT_ACTOR_ID && x.archivedAt === null);
  // canManageCommunications в моке = true для actor → manage на всех каналах (упрощение демо RBAC).
  return true || m?.role === "owner" || m?.role === "moderator";
};
const channelCanRead = (_channelId: string, _channelType: string): boolean => true; // demo: actor читает все каналы

function seed(): Store {
  const t = "2026-01-12T09:00:00.000Z";

  const stickerAssets: StickerAsset[] = [
    { id: "sticker-thumbsup", emoji: "👍", title: "Палец вверх" },
    { id: "sticker-party", emoji: "🎉", title: "Праздник" }
  ];

  /* --- Беседа demo-сущности proj-portal + ~6 сообщений --- */
  const conversation: Conversation = {
    id: "conversation-portal",
    tenantId: TENANT,
    entityType: "project",
    entityId: "proj-portal",
    conversationType: "default",
    title: "Производственный портал",
    createdByUserId: "u-anna",
    createdAt: t,
    archivedAt: null
  };

  const msg = (id: string, authorUserId: string, body: string, createdAt: string, over: Partial<Message> = {}): Message => ({
    id,
    tenantId: TENANT,
    conversationId: "conversation-portal",
    authorUserId,
    body,
    metadata: {},
    createdAt,
    editedAt: null,
    archivedAt: null,
    pinnedAt: null,
    pinnedByUserId: null,
    reactions: [],
    stickers: [],
    ...over
  });

  // Сообщения по возрастанию времени; обратная курсорная пагинация отдаёт их в обратном порядке.
  const messages: Message[] = [
    msg("message-1", "u-anna", "Запускаем релиз 2 портала. Собираемся в этом чате.", "2026-01-12T09:05:00.000Z", {
      pinnedAt: "2026-01-12T09:06:00.000Z",
      pinnedByUserId: "u-anna"
    }),
    msg("message-2", "u-sergey", "Готов взять backend. Сроки реальные.", "2026-01-12T09:10:00.000Z"),
    msg("message-3", "u-anna", "Отлично. @u-ivan подключайся по интеграциям, нужна твоя оценка.", "2026-01-12T09:15:00.000Z"),
    msg("message-4", "u-ivan", "Принял, оценю до пятницы.", "2026-01-12T09:20:00.000Z"),
    msg("message-5", "u-maria", "Дизайн макетов готов на 80%.", "2026-01-12T09:25:00.000Z"),
    // archived-сообщение для демо soft-delete
    msg("message-6", "u-sergey", "Старое сообщение (удалено).", "2026-01-12T09:30:00.000Z", { archivedAt: "2026-01-12T09:31:00.000Z" })
  ];

  // Стикер на сообщении message-2 (сид-ассет thumbsup).
  const stickers: MessageSticker[] = [
    { tenantId: TENANT, messageId: "message-2", stickerAssetId: "sticker-thumbsup", createdByUserId: "u-sergey", createdAt: "2026-01-12T09:10:00.000Z" }
  ];
  messages.find((m) => m.id === "message-2")!.stickers = stickers.filter((s) => s.messageId === "message-2");

  // Реакции на message-1 (👍 от u-ivan, 🎉 от u-sergey).
  const reactions: Reaction[] = [
    { id: "reaction-1", tenantId: TENANT, messageId: "message-1", userId: "u-ivan", emoji: "👍", createdAt: "2026-01-12T09:07:00.000Z", archivedAt: null },
    { id: "reaction-2", tenantId: TENANT, messageId: "message-1", userId: "u-sergey", emoji: "🎉", createdAt: "2026-01-12T09:08:00.000Z", archivedAt: null }
  ];
  messages.find((m) => m.id === "message-1")!.reactions = reactions.filter((r) => r.messageId === "message-1");

  // Упоминание из message-3 (@u-ivan).
  const mentions: MessageMention[] = [
    { tenantId: TENANT, messageId: "message-3", mentionedUserId: "u-ivan", createdAt: "2026-01-12T09:15:00.000Z" }
  ];

  // readState: на беседе portal у actor unreadCount=2 (демо-бейдж непрочитанного).
  const readStates: ConversationReadState[] = [
    {
      tenantId: TENANT,
      conversationId: "conversation-portal",
      userId: CURRENT_ACTOR_ID,
      lastReadMessageId: "message-4",
      lastReadAt: "2026-01-12T09:21:00.000Z",
      unreadCount: 2
    }
  ];

  /* --- Каналы: workspace_general (ensure при GET), team, project_general, custom --- */
  const channel = (over: Partial<Channel> & Pick<Channel, "id" | "channelType" | "title">): Channel => ({
    description: "",
    scopeEntityType: null,
    scopeEntityId: null,
    canManage: true,
    createdByUserId: "u-anna",
    createdAt: t,
    updatedAt: t,
    archivedAt: null,
    ...over
  });
  const channels: Channel[] = [
    // Системный канал «Общий» (workspace_general) сидится в каждый стор, чтобы GET /:id и
    // /:id/conversation находили его даже в изолированном сторе детали (useChannel — отдельный
    // монтаж). ensureWorkspaceGeneralChannel остаётся как no-op-страховка. id/поля идентичны ensure.
    channel({ id: "channel-workspace-general", channelType: "workspace_general", title: "Общий", description: "Общий канал рабочей области" }),
    channel({ id: "channel-team", channelType: "team", title: "Команда портала", description: "Рабочая группа релиза 2", scopeEntityType: "org_unit", scopeEntityId: "org-portal" }),
    channel({ id: "channel-project", channelType: "project_general", title: "Проект: Портал", description: "Общий канал проекта", scopeEntityType: "project", scopeEntityId: "proj-portal" }),
    channel({ id: "channel-coffee", channelType: "custom", title: "Случайный кофе", description: "Неформальное общение" })
  ];

  // Members: actor=owner на каждом канале + по 1-2 участника.
  const member = (channelId: string, userId: string, role: ChannelMember["role"]): ChannelMember => ({
    tenantId: TENANT,
    channelId,
    userId,
    role,
    createdByUserId: "u-anna",
    createdAt: t,
    archivedAt: null
  });
  const channelMembers: ChannelMember[] = [
    member("channel-team", "u-anna", "owner"),
    member("channel-team", "u-sergey", "member"),
    member("channel-team", "u-ivan", "member"),
    member("channel-project", "u-anna", "owner"),
    member("channel-project", "u-maria", "member"),
    member("channel-coffee", "u-anna", "owner"),
    member("channel-coffee", "u-sergey", "member")
  ];

  /* --- ЗВОНКИ (для demo-сущности proj-portal): open / active+сессия / ended --- */
  const callRoom = (over: Partial<CallRoomRecord> & Pick<CallRoomRecord, "id" | "title" | "providerRoomId" | "status">): CallRoomRecord => ({
    tenantId: TENANT,
    entityType: "project",
    entityId: "proj-portal",
    meetingId: null,
    mediaKind: "video",
    provider: "jitsi",
    createdByUserId: "u-anna",
    createdAt: t,
    updatedAt: t,
    archivedAt: null,
    ...over
  });
  const callRooms: CallRoomRecord[] = [
    callRoom({ id: "call-room-standup", title: "Дейли стендап", providerRoomId: "portal-standup", status: "open" }),
    callRoom({ id: "call-room-live", title: "Живой созвон", providerRoomId: "portal-live", status: "active" }),
    callRoom({ id: "call-room-ended", title: "Завершённый звонок", providerRoomId: "portal-ended", status: "ended", updatedAt: "2026-01-12T10:30:00.000Z" })
  ];

  // Активная сессия для call-room-live (для демо join-token/participant-state/end).
  const callSessions: CallSession[] = [
    {
      id: "call-session-live",
      roomId: "call-room-live",
      providerSessionId: null,
      status: "active",
      startedByUserId: "u-anna",
      startedAt: "2026-01-12T10:00:00.000Z",
      endedByUserId: null,
      endedAt: null,
      failureReason: null
    }
  ];

  // Участники активной сессии (Анна joined, Сергей joining).
  const callParticipantStates: CallParticipantStateRecord[] = [
    { tenantId: TENANT, roomId: "call-room-live", sessionId: "call-session-live", userId: "u-anna", state: "joined", joinedAt: "2026-01-12T10:00:05.000Z", leftAt: null, lastSeenAt: "2026-01-12T10:05:00.000Z" },
    { tenantId: TENANT, roomId: "call-room-live", sessionId: "call-session-live", userId: "u-sergey", state: "joining", joinedAt: null, leftAt: null, lastSeenAt: "2026-01-12T10:00:10.000Z" }
  ];

  // События: room_created на каждую комнату + session_started для live.
  const callEvents: CallEvent[] = [
    { id: "call-event-standup-created", roomId: "call-room-standup", sessionId: null, eventType: "room_created", actorUserId: "u-anna", payload: { provider: "jitsi", mediaKind: "video" }, createdAt: t },
    { id: "call-event-live-created", roomId: "call-room-live", sessionId: null, eventType: "room_created", actorUserId: "u-anna", payload: { provider: "jitsi", mediaKind: "video" }, createdAt: t },
    { id: "call-event-live-started", roomId: "call-room-live", sessionId: "call-session-live", eventType: "session_started", actorUserId: "u-anna", payload: { provider: "jitsi" }, createdAt: "2026-01-12T10:00:00.000Z" },
    { id: "call-event-ended-created", roomId: "call-room-ended", sessionId: null, eventType: "room_created", actorUserId: "u-anna", payload: { provider: "jitsi", mediaKind: "video" }, createdAt: t },
    { id: "call-event-ended-stopped", roomId: "call-room-ended", sessionId: null, eventType: "session_ended", actorUserId: "u-anna", payload: { endedByUserId: "u-anna" }, createdAt: "2026-01-12T10:30:00.000Z" }
  ];

  const callRecordings: CallRecording[] = [];

  /* --- МИТИНГИ (для proj-portal): scheduled (будущий) + completed --- */
  const meetings: Meeting[] = [
    {
      id: "meeting-kickoff",
      tenantId: TENANT,
      entityType: "project",
      entityId: "proj-portal",
      title: "Kickoff релиза 2",
      agenda: "Цели релиза, распределение задач, риски.",
      scheduledStart: "2026-06-25T10:00:00.000Z",
      scheduledFinish: "2026-06-25T11:00:00.000Z",
      status: "scheduled",
      createdByUserId: "u-anna",
      createdAt: t,
      archivedAt: null
    },
    {
      id: "meeting-retro",
      tenantId: TENANT,
      entityType: "project",
      entityId: "proj-portal",
      title: "Ретро спринта 1",
      agenda: "Что прошло хорошо, что улучшить.",
      scheduledStart: "2026-01-10T10:00:00.000Z",
      scheduledFinish: "2026-01-10T11:00:00.000Z",
      status: "completed",
      createdByUserId: "u-anna",
      createdAt: t,
      archivedAt: null
    }
  ];

  // Участники kickoff: организатор Анна (accepted) + Иван/Сергей (pending).
  const meetingParticipants: MeetingParticipant[] = [
    { tenantId: TENANT, meetingId: "meeting-kickoff", userId: "u-anna", role: "organizer", response: "accepted", createdAt: t },
    { tenantId: TENANT, meetingId: "meeting-kickoff", userId: "u-ivan", role: "required", response: "pending", createdAt: t },
    { tenantId: TENANT, meetingId: "meeting-kickoff", userId: "u-sergey", role: "optional", response: "pending", createdAt: t },
    { tenantId: TENANT, meetingId: "meeting-retro", userId: "u-anna", role: "organizer", response: "accepted", createdAt: t }
  ];

  const meetingExternalLinks: MeetingExternalLink[] = [
    {
      id: "meeting-link-kickoff-zoom",
      tenantId: TENANT,
      meetingId: "meeting-kickoff",
      provider: "zoom",
      url: "https://zoom.us/j/123456789",
      title: "Zoom-комната kickoff",
      createdByUserId: "u-anna",
      createdAt: t,
      archivedAt: null
    }
  ];

  const meetingNotes: MeetingNote[] = [
    { id: "meeting-note-kickoff-1", tenantId: TENANT, meetingId: "meeting-kickoff", authorUserId: "u-anna", body: "Подготовить список задач до встречи.", createdAt: t, editedAt: null, archivedAt: null },
    { id: "meeting-note-kickoff-2", tenantId: TENANT, meetingId: "meeting-kickoff", authorUserId: "u-sergey", body: "Уточнить зависимости по бэкенду.", createdAt: t, editedAt: null, archivedAt: null }
  ];

  const meetingActionItems: MeetingActionItem[] = [
    {
      id: "meeting-action-kickoff-1",
      tenantId: TENANT,
      meetingId: "meeting-kickoff",
      title: "Составить дорожную карту релиза",
      ownerUserId: "u-ivan",
      dueDate: "2026-06-30",
      targetEntityType: "project",
      targetEntityId: "proj-portal",
      status: "open",
      createdByUserId: "u-anna",
      createdAt: t,
      archivedAt: null
    }
  ];

  /* --- Уведомления для actor u-anna (+ сидовое mention для u-ivan): точные RU-title --- */
  const notifications: UserNotification[] = [
    {
      id: "notification-mention-seed",
      tenantId: TENANT,
      userId: "u-ivan",
      notificationType: "mention",
      sourceEntityType: "project",
      sourceEntityId: "proj-portal",
      title: "Вас упомянули",
      body: "Отлично. @u-ivan подключайся по интеграциям, нужна твоя оценка.",
      route: "/projects/proj-portal",
      createdAt: "2026-01-12T09:15:00.000Z",
      readAt: null,
      archivedAt: null
    },
    {
      id: "notification-meeting-invite-seed",
      tenantId: TENANT,
      userId: "u-anna",
      notificationType: "meeting_invite",
      sourceEntityType: "project",
      sourceEntityId: "proj-portal",
      title: "Новая встреча",
      body: "Kickoff релиза 2",
      route: "/projects/proj-portal",
      createdAt: "2026-01-12T09:40:00.000Z",
      readAt: null,
      archivedAt: null
    },
    {
      id: "notification-action-item-seed",
      tenantId: TENANT,
      userId: "u-anna",
      notificationType: "meeting_action_item",
      sourceEntityType: "project",
      sourceEntityId: "proj-portal",
      title: "Action item после встречи",
      body: "Составить дорожную карту релиза",
      route: "/projects/proj-portal",
      createdAt: "2026-01-12T09:45:00.000Z",
      readAt: "2026-01-12T09:50:00.000Z",
      archivedAt: null
    },
    {
      id: "notification-mention-anna-seed",
      tenantId: TENANT,
      userId: "u-anna",
      notificationType: "mention",
      sourceEntityType: "project",
      sourceEntityId: "proj-portal",
      title: "Вас упомянули",
      body: "@u-anna посмотри, пожалуйста, оценку по интеграциям.",
      route: "/projects/proj-portal",
      createdAt: "2026-01-12T10:00:00.000Z",
      readAt: null,
      archivedAt: null
    }
  ];

  /* --- Настройки уведомлений actor u-anna (raw, без дат; для непустой формы) --- */
  const notificationPreferences: NotificationPreference[] = [
    { tenantId: TENANT, userId: CURRENT_ACTOR_ID, channel: "in_app", notificationType: "mention", enabled: true, digestFrequency: "none" },
    { tenantId: TENANT, userId: CURRENT_ACTOR_ID, channel: "in_app", notificationType: "meeting_invite", enabled: true, digestFrequency: "none" },
    { tenantId: TENANT, userId: CURRENT_ACTOR_ID, channel: "email", notificationType: "deadline_risk", enabled: true, digestFrequency: "weekly" },
    { tenantId: TENANT, userId: CURRENT_ACTOR_ID, channel: "digest", notificationType: "assignment_changed", enabled: false, digestFrequency: "daily" }
  ];

  return {
    conversations: [conversation],
    messages,
    reactions,
    stickers,
    mentions,
    readStates,
    stickerAssets,
    channels,
    channelMembers,
    notifications,
    notificationPreferences,
    callRooms,
    callSessions,
    callEvents,
    callRecordings,
    callParticipantStates,
    meetings,
    meetingParticipants,
    meetingNotes,
    meetingExternalLinks,
    meetingActionItems
  };
}

/* Порядковое (ordinal) сравнение строк — зеркало SQL asc/desc по text-колонке (без локали, в отличие от localeCompare). */
const byOrdinal = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);

/* ---- Транспорт: fetchImpl, совместимый с createCommsClient ---- */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (error: string, status: number) => json({ error }, status);

// Маршрут уведомления по типу сущности (зеркало routeForEntity боевого API).
// Боевой подставляет СЫРОЙ entityId без encodeURIComponent (collaborationRoutes.ts:1215-1223).
const routeForEntity = (entityType: string, entityId: string): string => {
  switch (entityType) {
    case "project":
      return `/projects/${entityId}`;
    case "task":
      return `/tasks/${entityId}`;
    case "opportunity":
      return `/crm/opportunities/${entityId}`;
    case "client":
      return `/clients/${entityId}`;
    case "contact":
      return `/contacts/${entityId}`;
    case "product":
      return `/products/${entityId}`;
    default:
      return `/communication-channels/${entityId}`;
  }
};

// Обрезка тела уведомления (зеркало trimNotificationBody: >180 → 177+'...').
const trimNotificationBody = (body: string): string => (body.length > 180 ? `${body.slice(0, 177)}...` : body);

// Парсинг limit для сообщений (def 50, cap 100, мусор → fallback 50).
const parseMessagesLimit = (raw: string | null): number => {
  if (raw === null || raw === "") return 50;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 50;
  return Math.min(n, 100);
};

// Универсальный clamp-limit: def, cap, мусор → def.
const parseClampLimit = (raw: string | null, def: number, cap: number): number => {
  if (raw === null || raw === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return def;
  return Math.min(n, cap);
};

/* ---- SSRF-валидатор внешних ссылок митинга (зеркало parseExternalReferenceUrl, дубль из mock-crm-backend) ---- */
// Боевой attachmentValidation.ts: maxUrlLength=1200, maxDisplayNameLength=180.
const maxExternalUrlLength = 1200;
const maxExternalTitleLength = 180;
// Приватные/loopback/link-local хосты — отвергаются как боевым SSRF-guard.
const isBlockedHost = (host: string): boolean => {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
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
// Валидация URL внешней ссылки: required → too_long → invalid (схема/creds) → private_host.
const parseExternalUrl = (value: unknown): { ok: true; value: string } | { ok: false; error: string } => {
  if (typeof value !== "string" || value.trim() === "") return { ok: false, error: "external_url_required" };
  const v = value.trim();
  if (v.length > maxExternalUrlLength) return { ok: false, error: "external_url_too_long" };
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return { ok: false, error: "external_url_invalid" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "external_url_invalid" };
  if (u.username || u.password) return { ok: false, error: "external_url_invalid" };
  if (isBlockedHost(u.hostname)) return { ok: false, error: "external_url_private_host" };
  // Боевой возвращает НОРМАЛИЗОВАННЫЙ url.toString() (хост в нижнем регистре, trailing '/', нормализация пути).
  return { ok: true, value: u.toString() };
};
// Заголовок ссылки (зеркало parseReferenceTitle): required → invalid (control-chars по СЫРОМУ значению) → trim+collapse → slice 180.
// controlCharacterPattern боевого = /[\u0000-\u001f\u007f]/ — отвергает ЛЮБОЙ управляющий символ, включая \t \n \r и DEL (0x7f).
const parseExternalTitle = (value: unknown): { ok: true; value: string } | { ok: false; error: string } => {
  if (typeof value !== "string") return { ok: false, error: "external_title_required" };
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value)) return { ok: false, error: "external_title_invalid" };
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (collapsed === "") return { ok: false, error: "external_title_required" };
  return { ok: true, value: collapsed.slice(0, maxExternalTitleLength) };
};

// dueDate action-item: ТОЛЬКО формат YYYY-MM-DD (зеркало боевого parseOptionalDate — без календарной валидации).
const isValidDueDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

// Типы сущности, на которые action-item дефолтит target (= meetingActionTargetTypes боевого: isMeetingActionTargetType).
const DEFAULT_TARGET_ENTITY_TYPES = new Set(["task", "corrective_action", "project", "opportunity"]);

// Допустимые entityType для metadata.links (зеркало parseMessageLinkEntityType, collaborationRoutes.ts:1171-1184).
const MESSAGE_LINK_ENTITY_TYPES = new Set(["project", "task", "opportunity", "kpi_signal", "corrective_action", "control_action"]);

/* parseMessageMetadata: зеркало collaborationRoutes.ts:1148-1169.
   links: Array, slice ≤20, оставить только записи с валидным entityType ∈ allowed и валидным entityId;
   attachmentIds: Array, slice ≤20, оставить только валидные collaboration-id; невалидные молча отбрасываются. */
const parseMessageMetadata = (value: unknown): Record<string, unknown> => {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const links = Array.isArray(record.links)
    ? record.links.slice(0, 20).flatMap((link) => {
        const linkRecord = link && typeof link === "object" && !Array.isArray(link) ? (link as Record<string, unknown>) : {};
        const typeOk = typeof linkRecord.entityType === "string" && MESSAGE_LINK_ENTITY_TYPES.has(linkRecord.entityType);
        const idParsed = parseCollaborationId(linkRecord.entityId, "link_entity_id_invalid");
        if (!typeOk || !idParsed.ok) return [];
        return [{ entityType: linkRecord.entityType, entityId: idParsed.value }];
      })
    : [];
  const attachmentIds = Array.isArray(record.attachmentIds)
    ? record.attachmentIds.slice(0, 20).flatMap((attachmentId) => {
        const parsed = parseCollaborationId(attachmentId, "attachment_id_invalid");
        return parsed.ok ? [parsed.value] : [];
      })
    : [];
  return {
    ...(links.length ? { links } : {}),
    ...(attachmentIds.length ? { attachmentIds } : {})
  };
};

export function createMockCommsFetch(): typeof fetch {
  const db = seed();

  /* --- ensureConversation: гарантирует ≥1 default-беседу для сущности (id conversation-{uuid}). --- */
  const ensureConversation = (entityType: string, entityId: string, title: string): Conversation => {
    let conv = db.conversations.find((c) => c.entityType === entityType && c.entityId === entityId && c.conversationType === "default" && c.archivedAt === null);
    if (!conv) {
      conv = {
        id: genId("conversation"),
        tenantId: TENANT,
        entityType: entityType as Conversation["entityType"],
        entityId,
        conversationType: "default",
        title,
        createdByUserId: CURRENT_ACTOR_ID,
        createdAt: nowIso(),
        archivedAt: null
      };
      db.conversations.push(conv);
    }
    return conv;
  };

  /* --- P4.2 DM (mock): членство в замыкании; сид одного DM u-anna↔u-ivan с сообщением. --- */
  const directMembers = new Map<string, string[]>();
  const dmConversation = (id: string, createdByUserId: string): Conversation => ({
    id,
    tenantId: TENANT,
    entityType: "direct" as Conversation["entityType"],
    entityId: id,
    conversationType: "direct" as Conversation["conversationType"],
    title: "",
    createdByUserId,
    createdAt: nowIso(),
    archivedAt: null
  });
  const seedDmId = "dm-u-anna--u-ivan";
  db.conversations.push(dmConversation(seedDmId, "u-ivan"));
  directMembers.set(seedDmId, ["u-anna", "u-ivan"]);
  db.messages.push({
    id: "message-dm-1", tenantId: TENANT, conversationId: seedDmId, authorUserId: "u-ivan",
    body: "Привет! Можем обсудить интеграцию здесь, в личке?", metadata: {},
    createdAt: "2026-01-13T08:00:00.000Z", editedAt: null, archivedAt: null, pinnedAt: null, pinnedByUserId: null,
    reactions: [], stickers: []
  });
  db.readStates.push({ tenantId: TENANT, conversationId: seedDmId, userId: CURRENT_ACTOR_ID, lastReadMessageId: null, lastReadAt: null, unreadCount: 1 });

  // create-or-get DM с targetId (actor = CURRENT_ACTOR_ID); детерминированный id по паре.
  const ensureDirectConversation = (targetId: string): Conversation => {
    const pair = [CURRENT_ACTOR_ID, targetId].sort();
    const id = `dm-${pair.join("--")}`;
    let conv = db.conversations.find((c) => c.id === id);
    if (!conv) {
      conv = dmConversation(id, CURRENT_ACTOR_ID);
      db.conversations.push(conv);
    }
    directMembers.set(id, pair);
    return conv;
  };

  /* --- ensureWorkspaceGeneralChannel: всегда присутствует в списке каналов. --- */
  const ensureWorkspaceGeneralChannel = (): Channel => {
    let ch = db.channels.find((c) => c.channelType === "workspace_general");
    if (!ch) {
      ch = {
        id: "channel-workspace-general",
        channelType: "workspace_general",
        title: "Общий",
        description: "Общий канал рабочей области",
        scopeEntityType: null,
        scopeEntityId: null,
        canManage: true, // боевой serializeChannel пересчитает; workspace_general управляем actor'ом
        createdByUserId: CURRENT_ACTOR_ID,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        archivedAt: null
      };
      // Порядок задаёт сортировка в GET (route 10); push для чистоты.
      db.channels.push(ch);
    }
    return ch;
  };

  // readState беседы для actor (или null).
  const getReadState = (conversationId: string): ConversationReadState | null =>
    db.readStates.find((r) => r.conversationId === conversationId && r.userId === CURRENT_ACTOR_ID) ?? null;

  // Сообщение в составе беседы (с подтянутыми reactions/stickers по messageId).
  const withExtras = (m: Message): Message => ({
    ...m,
    reactions: db.reactions.filter((r) => r.messageId === m.id && r.archivedAt === null),
    stickers: db.stickers.filter((s) => s.messageId === m.id)
  });

  // Сериализация канала с пересчётом canManage.
  const serializeChannel = (ch: Channel): Channel => ({ ...ch, canManage: channelCanManage(ch.id, ch.channelType, db.channelMembers) });

  // Резолв беседы для actor: 400 conversation_id_invalid → 404 conversation_not_found → read-доступ.
  // Возвращает беседу или код ошибки со статусом.
  const resolveConversation = (rawId: string): { ok: true; conversation: Conversation } | { ok: false; error: string; status: number } => {
    const idParsed = parseCollaborationId(decodeURIComponent(rawId), "conversation_id_invalid");
    if (!idParsed.ok) return { ok: false, error: idParsed.error, status: 400 };
    // Боевой findConversation фильтрует isNull(archivedAt) → архивная беседа = 404.
    const conv = db.conversations.find((c) => c.id === idParsed.value && c.archivedAt === null);
    if (!conv) return { ok: false, error: "conversation_not_found", status: 404 };
    // сущность беседы существует (в моке demo-сущности/каналы всегда есть) и читаема actor'ом.
    if (!canReadEntity(conv.entityType, conv.entityId)) return { ok: false, error: "permission_missing", status: 403 };
    return { ok: true, conversation: conv };
  };

  /* ---- ЗВОНКИ: сериализаторы (ПЕРЕИМЕНОВЫВАЮТ/ОМИТЯТ поля, см. §4) ---- */
  // CallRoom: id→roomId, ОМИТ tenantId/providerRoomId/archivedAt.
  const serializeCallRoom = (r: CallRoomRecord): CallRoom => ({
    roomId: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    meetingId: r.meetingId,
    title: r.title,
    mediaKind: r.mediaKind,
    provider: r.provider,
    status: r.status,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  });
  // CallParticipantState: ОМИТ tenantId.
  const serializeParticipantState = (p: CallParticipantStateRecord): CallParticipantState => ({
    roomId: p.roomId,
    sessionId: p.sessionId,
    userId: p.userId,
    state: p.state,
    joinedAt: p.joinedAt,
    leftAt: p.leftAt,
    lastSeenAt: p.lastSeenAt
  });

  // Резолв комнаты звонка: 400 call_room_id_invalid → 404 call_room_not_found → read-доступ (в демо true).
  const resolveCallRoom = (rawId: string): { ok: true; room: CallRoomRecord } | { ok: false; error: string; status: number } => {
    const idParsed = parseCollaborationId(decodeURIComponent(rawId), "call_room_id_invalid");
    if (!idParsed.ok) return { ok: false, error: idParsed.error, status: 400 };
    const room = db.callRooms.find((r) => r.id === idParsed.value && r.archivedAt === null);
    if (!room) return { ok: false, error: "call_room_not_found", status: 404 };
    if (!canReadEntity(room.entityType, room.entityId)) return { ok: false, error: "permission_missing", status: 403 };
    return { ok: true, room };
  };

  // Резолв комнаты + сессии: room → 400 call_session_id_invalid → 404 call_session_not_found (incl. roomId mismatch).
  const resolveCallRoomAndSession = (
    rawRoomId: string,
    rawSessionId: string
  ): { ok: true; room: CallRoomRecord; session: CallSession } | { ok: false; error: string; status: number } => {
    const roomResolved = resolveCallRoom(rawRoomId);
    if (!roomResolved.ok) return roomResolved;
    const sidParsed = parseCollaborationId(decodeURIComponent(rawSessionId), "call_session_id_invalid");
    if (!sidParsed.ok) return { ok: false, error: sidParsed.error, status: 400 };
    const session = db.callSessions.find((s) => s.id === sidParsed.value && s.roomId === roomResolved.room.id);
    if (!session) return { ok: false, error: "call_session_not_found", status: 404 };
    return { ok: true, room: roomResolved.room, session };
  };

  // Запись CallEvent в store (server-managed id/createdAt/actor).
  const pushCallEvent = (
    roomId: string,
    sessionId: string | null,
    eventType: CallEvent["eventType"],
    payload: Record<string, unknown>
  ): CallEvent => {
    const event: CallEvent = { id: genId("call-event"), roomId, sessionId, eventType, actorUserId: CURRENT_ACTOR_ID, payload, createdAt: nowIso() };
    db.callEvents.push(event);
    return event;
  };

  /* ---- МИТИНГИ: резолв митинга для actor (400 → 404 → read) ---- */
  const resolveMeeting = (rawId: string): { ok: true; meeting: Meeting } | { ok: false; error: string; status: number } => {
    const idParsed = parseCollaborationId(decodeURIComponent(rawId), "meeting_id_invalid");
    if (!idParsed.ok) return { ok: false, error: idParsed.error, status: 400 };
    const meeting = db.meetings.find((m) => m.id === idParsed.value && m.archivedAt === null);
    if (!meeting) return { ok: false, error: "meeting_not_found", status: 404 };
    if (!canReadEntity(meeting.entityType, meeting.entityId)) return { ok: false, error: "permission_missing", status: 403 };
    return { ok: true, meeting };
  };

  // Порождение уведомления (server-managed id/createdAt). Body обрезаем как боевой (mention-логика).
  const pushNotification = (over: Omit<UserNotification, "id" | "tenantId" | "createdAt" | "readAt" | "archivedAt">): void => {
    db.notifications.push({
      id: genId("notification"),
      tenantId: TENANT,
      createdAt: nowIso(),
      readAt: null,
      archivedAt: null,
      ...over
    });
  };

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const fullPath = url.replace(/^https?:\/\/[^/]+/, "");
    const path = fullPath.split("?")[0]!;
    const query = new URLSearchParams(fullPath.includes("?") ? fullPath.slice(fullPath.indexOf("?") + 1) : "");

    /* Тело читаем ЛЕНИВО в правильной точке порядка каждого write-обработчика — как боевой readLimitedJsonBody.
       Боевые роуты вызывают resolve/manage ДО чтения тела, поэтому invalid_json не должен опережать
       conversation_not_found(404)/permission_missing(403). parseBody вызывается каждым хендлером в нужной позиции:
       для большинства — ПОСЛЕ resolve беседы/канала; для pin — ПОСЛЕ manage; для create-роутов (тело ДО access)
       — в начале обработчика, как в боевом. invalid_json ловим через try/catch (body-size коды опускаем — см. шапку). */
    const parseBody = (): { ok: true; body: Record<string, unknown> } | { ok: false } => {
      if (!init?.body) return { ok: true, body: {} };
      try {
        const p: unknown = JSON.parse(String(init.body));
        if (p && typeof p === "object" && !Array.isArray(p)) return { ok: true, body: p as Record<string, unknown> };
        return { ok: true, body: {} };
      } catch {
        return { ok: false };
      }
    };

    /* ============================================================
       ЧАТ (1-9)
       ============================================================ */

    /* 1b) GET /conversations/direct — DM текущего пользователя (P4.2): membership + memberUserIds + readState. */
    if (method === "GET" && path === "/api/workspace/conversations/direct") {
      const result = db.conversations
        .filter((c) => (c.conversationType as string) === "direct" && (directMembers.get(c.id) ?? []).includes(CURRENT_ACTOR_ID))
        .map((c) => {
          const members = directMembers.get(c.id) ?? [];
          return {
            ...c,
            memberUserIds: members,
            counterpartUserIds: members.filter((id) => id !== CURRENT_ACTOR_ID),
            readState: db.readStates.find((r) => r.conversationId === c.id && r.userId === CURRENT_ACTOR_ID) ?? null
          };
        });
      return json({ conversations: result });
    }

    /* 1c) POST /conversations/direct {userId} — открыть/получить DM (create-or-get; self/unknown коды зеркалят бэк). */
    if (method === "POST" && path === "/api/workspace/conversations/direct") {
      const parsed = parseBody();
      if (!parsed.ok) return err("invalid_json", 400);
      const targetId = typeof parsed.body.userId === "string" ? parsed.body.userId.trim() : "";
      if (!targetId) return err("direct_user_id_invalid", 400);
      if (targetId === CURRENT_ACTOR_ID) return err("direct_self_forbidden", 400);
      if (!COMMS_USERS.some((u) => u.id === targetId)) return err("direct_user_not_found", 404);
      const conv = ensureDirectConversation(targetId);
      const members = directMembers.get(conv.id) ?? [];
      return json({ conversation: conv, memberUserIds: members, counterpartUserIds: members.filter((id) => id !== CURRENT_ACTOR_ID) }, 201);
    }

    /* 1d) GET /presence — снимок присутствия (P4.3). Мок: статика (SSE-сервера нет). */
    if (method === "GET" && path === "/api/workspace/presence") {
      return json({
        presence: {
          "u-anna": "online",
          "u-ivan": "online",
          "u-sergey": "away",
          "u-maria": "offline"
        }
      });
    }

    /* 1) GET /conversations?entityType&entityId — беседы сущности (+readState, ensure default). */
    if (method === "GET" && path === "/api/workspace/conversations") {
      const typeParsed = parseCollaborationEntityType(query.get("entityType"));
      if (!typeParsed.ok) return err(typeParsed.error, 400); // collaboration_entity_type_invalid
      const idParsed = parseCollaborationId(query.get("entityId") ?? "", "collaboration_entity_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      // 404 collaboration_entity_not_found / 403 read — в демо не активируются (RBAC-стаб, см. шапку).
      if (!canReadEntity(typeParsed.value, idParsed.value)) return err("permission_missing", 403);
      // Побочка: ensure default-беседа.
      ensureConversation(typeParsed.value, idParsed.value, "Обсуждение");
      // Боевой listConversationsByEntity: isNull(archivedAt) + orderBy(asc(conversationType), asc(createdAt)).
      const conversations = db.conversations
        .filter((c) => c.entityType === typeParsed.value && c.entityId === idParsed.value && c.archivedAt === null)
        .sort((a, b) => a.conversationType.localeCompare(b.conversationType) || a.createdAt.localeCompare(b.createdAt))
        .map((c) => ({ ...c, readState: getReadState(c.id) }));
      return json({ conversations });
    }

    /* 2) GET /conversations/:id/messages?limit&cursor — сообщения (обратная курсорная пагинация). */
    const msgList = method === "GET" ? path.match(/^\/api\/workspace\/conversations\/([^/]+)\/messages$/) : null;
    if (msgList) {
      const resolved = resolveConversation(msgList[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      const limit = parseMessagesLimit(query.get("limit"));
      const cursorRaw = query.get("cursor");
      let cursorId: string | null = null;
      if (cursorRaw !== null && cursorRaw !== "") {
        const cParsed = parseCollaborationId(cursorRaw, "conversation_cursor_invalid");
        if (!cParsed.ok) return err(cParsed.error, 400);
        cursorId = cParsed.value;
      }
      // Боевой listDiscussionMessages: keyset-пагинация по НЕархивным (isNull(archivedAt)) сообщениям.
      // Сообщения беседы (НЕархивные) по времени asc(createdAt), asc(id).
      const nonArchived = db.messages
        .filter((m) => m.conversationId === resolved.conversation.id && m.archivedAt === null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      // Cursor ищется ТОЛЬКО среди НЕархивных; если задан и не найден → пустая страница (collaborationRepository.ts:591).
      let slice = nonArchived;
      if (cursorId) {
        const idx = nonArchived.findIndex((m) => m.id === cursorId);
        if (idx < 0) return json({ messages: [], nextCursor: null });
        slice = nonArchived.slice(0, idx); // строго ДО cursor (исключительно)
      }
      // Обратная пагинация: берём ХВОСТ (самые свежие), массив возвращаем по возрастанию.
      const page = slice.slice(Math.max(0, slice.length - limit));
      const messages = page.map(withExtras);
      const nextCursor = messages[0]?.id ?? null; // первый (самый старый) элемент страницы
      return json({ messages, nextCursor });
    }

    /* 3) POST /conversations/:id/messages — создать (body|sticker обязателен; @mention→notification). */
    const msgCreate = method === "POST" ? path.match(/^\/api\/workspace\/conversations\/([^/]+)\/messages$/) : null;
    if (msgCreate) {
      const resolved = resolveConversation(msgCreate[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      const parsedBody = parseBody(); // тело читаем ПОСЛЕ resolve (как боевой readLimitedJsonBody)
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      // stickerAssetId (опц.): формат → существование. Пустая строка '' = отсутствие (parseOptionalCollaborationId).
      let stickerAsset: StickerAsset | null = null;
      if (body.stickerAssetId != null && body.stickerAssetId !== "") {
        const sParsed = parseCollaborationId(body.stickerAssetId, "sticker_asset_id_invalid");
        if (!sParsed.ok) return err(sParsed.error, 400);
        stickerAsset = db.stickerAssets.find((s) => s.id === sParsed.value) ?? null;
        if (!stickerAsset) return err("sticker_asset_not_found", 404);
      }
      // body ?? stickerAsset.emoji: при стикере тело необязательно (emoji подставляется).
      const bodyParsed = parseMessageBody(body.body ?? stickerAsset?.emoji);
      if (!bodyParsed.ok) return err(bodyParsed.error, 400); // message_body_required / message_body_invalid

      const id = genId("message");
      const created: Message = {
        id,
        tenantId: TENANT,
        conversationId: resolved.conversation.id,
        authorUserId: CURRENT_ACTOR_ID,
        body: bodyParsed.value,
        metadata: parseMessageMetadata(body.metadata), // зеркало parseMessageMetadata: валидные links/attachmentIds эхом
        createdAt: nowIso(),
        editedAt: null,
        archivedAt: null,
        pinnedAt: null,
        pinnedByUserId: null,
        reactions: [],
        stickers: []
      };
      db.messages.push(created);
      // Стикер привязывается только при создании сообщения.
      if (stickerAsset) {
        const st: MessageSticker = { tenantId: TENANT, messageId: id, stickerAssetId: stickerAsset.id, createdByUserId: CURRENT_ACTOR_ID, createdAt: created.createdAt };
        db.stickers.push(st);
      }
      // Побочка: @mention → MessageMention (replace) + UserNotification(type=mention) каждому ≠ actor и из тенанта.
      const mentioned = extractMentionedUserIds(bodyParsed.value)
        .filter((uid) => uid !== CURRENT_ACTOR_ID && COMMS_USERS.some((u) => u.id === uid));
      db.mentions = db.mentions.filter((m) => m.messageId !== id); // replace-семантика
      const mentions: MessageMention[] = [];
      for (const uid of mentioned) {
        const mention: MessageMention = { tenantId: TENANT, messageId: id, mentionedUserId: uid, createdAt: created.createdAt };
        db.mentions.push(mention);
        mentions.push(mention);
        db.notifications.push({
          id: genId("notification"),
          tenantId: TENANT,
          userId: uid,
          notificationType: "mention",
          sourceEntityType: resolved.conversation.entityType,
          sourceEntityId: resolved.conversation.entityId,
          title: "Вас упомянули",
          body: trimNotificationBody(bodyParsed.value),
          route: routeForEntity(resolved.conversation.entityType, resolved.conversation.entityId),
          createdAt: created.createdAt,
          readAt: null,
          archivedAt: null
        });
      }
      return json({ message: withExtras(created), mentions }, 201);
    }

    /* 4-5) PATCH / DELETE /conversations/:id/messages/:msgId */
    const msgItem = path.match(/^\/api\/workspace\/conversations\/([^/]+)\/messages\/([^/]+)$/);
    if (msgItem && (method === "PATCH" || method === "DELETE")) {
      const resolved = resolveConversation(msgItem[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      const messageId = decodeURIComponent(msgItem[2]!);
      const message = db.messages.find((m) => m.id === messageId && m.conversationId === resolved.conversation.id);
      if (!message) return err("message_not_found", 404);
      // Редактировать/удалять: автор ИЛИ manage. 403-ветка зеркалит manageDecision.reason (в демо actor — manage).
      const isAuthor = message.authorUserId === CURRENT_ACTOR_ID;
      if (!isAuthor && !canManageEntity(resolved.conversation.entityType, resolved.conversation.entityId)) {
        return err("permission_missing", 403);
      }
      if (method === "PATCH") {
        // 4) edit: тело ПОСЛЕ resolve+RBAC (как боевой readLimitedJsonBody внутри транзакции).
        const parsedBody = parseBody();
        if (!parsedBody.ok) return err("invalid_json", 400);
        const body = parsedBody.body;
        const bodyParsed = parseMessageBody(body.body);
        if (!bodyParsed.ok) return err(bodyParsed.error, 400);
        // Архив-гард: боевой updateDiscussionMessage фильтрует isNull(archivedAt) → undefined → 404 (ПОСЛЕ RBAC).
        if (message.archivedAt !== null) return err("message_not_found", 404);
        message.body = bodyParsed.value;
        message.editedAt = nowIso();
        if (body.metadata !== undefined) message.metadata = parseMessageMetadata(body.metadata);
        return json({ message });
      }
      // 5) delete: soft-delete (archivedAt). Архив-гард: повторное удаление архивного → 404 (ПОСЛЕ RBAC).
      if (message.archivedAt !== null) return err("message_not_found", 404);
      message.archivedAt = nowIso();
      return json({ message });
    }

    /* 6) POST /conversations/:id/messages/:msgId/reactions — поставить (только НЕархивное). */
    const reactAdd = method === "POST" ? path.match(/^\/api\/workspace\/conversations\/([^/]+)\/messages\/([^/]+)\/reactions$/) : null;
    if (reactAdd) {
      const resolved = resolveConversation(reactAdd[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      const messageId = decodeURIComponent(reactAdd[2]!);
      const message = db.messages.find((m) => m.id === messageId && m.conversationId === resolved.conversation.id);
      // POST reactions: archived-сообщение → 404 (в отличие от DELETE).
      if (!message || message.archivedAt !== null) return err("message_not_found", 404);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const emojiParsed = parseMessageReactionEmoji(body.emoji);
      if (!emojiParsed.ok) return err(emojiParsed.error, 400);
      // upsert по userId+emoji.
      let reaction = db.reactions.find((r) => r.messageId === messageId && r.userId === CURRENT_ACTOR_ID && r.emoji === emojiParsed.value && r.archivedAt === null);
      if (!reaction) {
        reaction = { id: genId("reaction"), tenantId: TENANT, messageId, userId: CURRENT_ACTOR_ID, emoji: emojiParsed.value, createdAt: nowIso(), archivedAt: null };
        db.reactions.push(reaction);
      }
      return json({ reaction }, 201);
    }

    /* 7) DELETE /conversations/:id/messages/:msgId/reactions/:rid — снять свою (archived msg допускается). */
    const reactDel = method === "DELETE" ? path.match(/^\/api\/workspace\/conversations\/([^/]+)\/messages\/([^/]+)\/reactions\/([^/]+)$/) : null;
    if (reactDel) {
      const resolved = resolveConversation(reactDel[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      const messageId = decodeURIComponent(reactDel[2]!);
      const message = db.messages.find((m) => m.id === messageId && m.conversationId === resolved.conversation.id);
      if (!message) return err("message_not_found", 404);
      const ridParsed = parseCollaborationId(decodeURIComponent(reactDel[3]!), "reaction_id_invalid");
      if (!ridParsed.ok) return err(ridParsed.error, 400);
      // Снять только СВОЮ (скоуп userId); чужая/несуществующая → reaction_not_found.
      const reaction = db.reactions.find((r) => r.id === ridParsed.value && r.messageId === messageId && r.userId === CURRENT_ACTOR_ID && r.archivedAt === null);
      if (!reaction) return err("reaction_not_found", 404);
      reaction.archivedAt = nowIso();
      return json({ reaction });
    }

    /* 8) POST /conversations/:id/messages/:msgId/pin — закрепить (manage ДО поиска; unpin нет). */
    const pin = method === "POST" ? path.match(/^\/api\/workspace\/conversations\/([^/]+)\/messages\/([^/]+)\/pin$/) : null;
    if (pin) {
      const resolved = resolveConversation(pin[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      // manage проверяется ДО поиска сообщения (в демо actor — manage; 403 зеркалится в коде).
      if (!canManageEntity(resolved.conversation.entityType, resolved.conversation.entityId)) return err("permission_missing", 403);
      const messageId = decodeURIComponent(pin[2]!);
      const message = db.messages.find((m) => m.id === messageId && m.conversationId === resolved.conversation.id);
      if (!message) return err("message_not_found", 404);
      // Архив-гард: боевой pinDiscussionMessage фильтрует isNull(archivedAt) → undefined → 404 (ПОСЛЕ manage+find).
      if (message.archivedAt !== null) return err("message_not_found", 404);
      message.pinnedAt = nowIso();
      message.pinnedByUserId = CURRENT_ACTOR_ID;
      return json({ message });
    }

    /* 8b) DELETE /conversations/:id/messages/:msgId/pin — снять закрепление (COMM-06). */
    const unpin = method === "DELETE" ? path.match(/^\/api\/workspace\/conversations\/([^/]+)\/messages\/([^/]+)\/pin$/) : null;
    if (unpin) {
      const resolved = resolveConversation(unpin[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      if (!canManageEntity(resolved.conversation.entityType, resolved.conversation.entityId)) return err("permission_missing", 403);
      const messageId = decodeURIComponent(unpin[2]!);
      const message = db.messages.find((m) => m.id === messageId && m.conversationId === resolved.conversation.id);
      if (!message) return err("message_not_found", 404);
      if (message.archivedAt !== null) return err("message_not_found", 404);
      message.pinnedAt = null;
      message.pinnedByUserId = null;
      return json({ message });
    }

    /* 9) POST /conversations/:id/read-state — отметить прочитанным (unreadCount=0). */
    const readState = method === "POST" ? path.match(/^\/api\/workspace\/conversations\/([^/]+)\/read-state$/) : null;
    if (readState) {
      const resolved = resolveConversation(readState[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      // Самое свежее НЕархивное сообщение → lastReadMessageId (боевой markConversationRead:
      // isNull(archivedAt) + desc(createdAt),desc(id) limit 1 ≡ asc-сорт + .at(-1)).
      const last = db.messages
        .filter((m) => m.conversationId === resolved.conversation.id && m.archivedAt === null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .at(-1);
      let rs = db.readStates.find((r) => r.conversationId === resolved.conversation.id && r.userId === CURRENT_ACTOR_ID);
      if (!rs) {
        rs = { tenantId: TENANT, conversationId: resolved.conversation.id, userId: CURRENT_ACTOR_ID, lastReadMessageId: null, lastReadAt: null, unreadCount: 0 };
        db.readStates.push(rs);
      }
      rs.unreadCount = 0;
      rs.lastReadMessageId = last?.id ?? null;
      rs.lastReadAt = nowIso();
      return json({ readState: rs });
    }

    /* ============================================================
       КАНАЛЫ (10-16)
       ============================================================ */

    /* 10) GET /communication-channels?type — список (workspace_general всегда есть). */
    if (method === "GET" && path === "/api/workspace/communication-channels") {
      ensureWorkspaceGeneralChannel(); // побочка
      const typeRaw = query.get("type");
      if (typeRaw !== null && typeRaw !== "") {
        const typeParsed = parseCommunicationChannelType(typeRaw);
        if (!typeParsed.ok) return err(typeParsed.error, 400); // communication_channel_type_invalid
      }
      // Боевой listCommunicationChannels: orderBy(asc(channelType), asc(createdAt)) — ordinal-сравнение по text-колонкам.
      const channels = db.channels
        .filter((c) => c.archivedAt === null)
        .filter((c) => (typeRaw && typeRaw !== "" ? c.channelType === typeRaw : true))
        .filter((c) => channelCanRead(c.id, c.channelType)) // per-channel read (в демо все читаемы)
        .sort((a, b) => byOrdinal(a.channelType, b.channelType) || byOrdinal(a.createdAt, b.createdAt))
        .map(serializeChannel);
      return json({ channels });
    }

    /* 11) POST /communication-channels — создать (workspace_general не создаётся; создатель→owner). */
    if (method === "POST" && path === "/api/workspace/communication-channels") {
      // 403 permission_missing (canManageCommunications) — в демо actor имеет право (стаб).
      // Тело ДО access (боевой parseChannelCreateBody): type → not_creatable → title → description → scope.
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const typeParsed = parseCommunicationChannelType(body.channelType);
      if (!typeParsed.ok) return err(typeParsed.error, 400);
      if (typeParsed.value === "workspace_general") return err("communication_channel_type_not_creatable", 400);
      const titleParsed = parseConversationTitle(body.title); // reuse: channel title ≤180
      if (!titleParsed.ok) return err(titleParsed.error, 400); // conversation_title_required / _invalid
      const descParsed = parseCommunicationChannelDescription(body.description);
      if (!descParsed.ok) return err(descParsed.error, 400);
      // Scope: team→org_unit, project_general→project (+проверка существования), custom→опц (project|org_unit).
      // Боевой parseChannelCreateBody НЕ валидирует формат scopeEntityId (String(record.scopeEntityId)) — берём сырое.
      const scopeTypeRaw = body.scopeEntityType;
      const scopeIdRaw = body.scopeEntityId;
      let scopeEntityType: "project" | "org_unit" | null = null;
      let scopeEntityId: string | null = null;
      if (typeParsed.value === "team" || typeParsed.value === "project_general") {
        if (scopeTypeRaw == null || scopeIdRaw == null || scopeIdRaw === "") return err("communication_channel_scope_required", 400);
        const expected = typeParsed.value === "team" ? "org_unit" : "project";
        if (scopeTypeRaw !== expected) return err("communication_channel_scope_type_invalid", 400);
        scopeEntityType = expected;
        scopeEntityId = String(scopeIdRaw);
        // project_general: проект должен существовать в тенанте (в моке известна только demo-сущность proj-portal).
        if (typeParsed.value === "project_general" && scopeEntityId !== DEMO_ENTITY.entityId) {
          return err("communication_channel_scope_not_found", 404);
        }
      } else if (scopeTypeRaw != null) {
        // custom: если scopeEntityType задан, должен быть project|org_unit.
        if (scopeTypeRaw !== "project" && scopeTypeRaw !== "org_unit") return err("communication_channel_scope_type_invalid", 400);
        scopeEntityType = scopeTypeRaw;
        if (scopeIdRaw != null && scopeIdRaw !== "") {
          scopeEntityId = String(scopeIdRaw);
        }
      }
      const id = genId("channel");
      const ch: Channel = {
        id,
        channelType: typeParsed.value,
        title: titleParsed.value,
        description: descParsed.value,
        scopeEntityType,
        scopeEntityId,
        canManage: true,
        createdByUserId: CURRENT_ACTOR_ID,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        archivedAt: null
      };
      db.channels.push(ch);
      // Создатель → owner-member авто.
      db.channelMembers.push({ tenantId: TENANT, channelId: id, userId: CURRENT_ACTOR_ID, role: "owner", createdByUserId: CURRENT_ACTOR_ID, createdAt: nowIso(), archivedAt: null });
      return json({ channel: serializeChannel(ch) }, 201);
    }

    /* 12) GET /communication-channels/:id — канал + участники. */
    const chGet = method === "GET" ? path.match(/^\/api\/workspace\/communication-channels\/([^/]+)$/) : null;
    if (chGet) {
      const idParsed = parseCollaborationId(decodeURIComponent(chGet[1]!), "communication_channel_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      const ch = db.channels.find((c) => c.id === idParsed.value && c.archivedAt === null);
      if (!ch) return err("communication_channel_not_found", 404);
      if (!channelCanRead(ch.id, ch.channelType)) return err("permission_missing", 403);
      const members = db.channelMembers.filter((m) => m.channelId === ch.id && m.archivedAt === null);
      return json({ channel: serializeChannel(ch), members });
    }

    /* 13) PATCH /communication-channels/:id — редактировать (title?/description?, ≥1). */
    const chPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/communication-channels\/([^/]+)$/) : null;
    if (chPatch) {
      const idParsed = parseCollaborationId(decodeURIComponent(chPatch[1]!), "communication_channel_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      const ch = db.channels.find((c) => c.id === idParsed.value && c.archivedAt === null);
      if (!ch) return err("communication_channel_not_found", 404);
      if (!channelCanManage(ch.id, ch.channelType, db.channelMembers)) return err("permission_missing", 403);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const hasTitle = body.title !== undefined;
      const hasDesc = body.description !== undefined;
      if (!hasTitle && !hasDesc) return err("communication_channel_patch_empty", 400);
      if (hasTitle) {
        const titleParsed = parseConversationTitle(body.title);
        if (!titleParsed.ok) return err(titleParsed.error, 400);
        ch.title = titleParsed.value;
      }
      if (hasDesc) {
        const descParsed = parseCommunicationChannelDescription(body.description);
        if (!descParsed.ok) return err(descParsed.error, 400);
        ch.description = descParsed.value;
      }
      ch.updatedAt = nowIso();
      return json({ channel: serializeChannel(ch) });
    }

    /* 13b) DELETE /communication-channels/:id — архив канала (workspace_general неприкасаем). */
    const chArchive = method === "DELETE" ? path.match(/^\/api\/workspace\/communication-channels\/([^/]+)$/) : null;
    if (chArchive) {
      const idParsed = parseCollaborationId(decodeURIComponent(chArchive[1]!), "communication_channel_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      const ch = db.channels.find((c) => c.id === idParsed.value && c.archivedAt === null);
      if (!ch) return err("communication_channel_not_found", 404);
      if (!channelCanManage(ch.id, ch.channelType, db.channelMembers)) return err("permission_missing", 403);
      if (ch.channelType === "workspace_general") return err("workspace_general_channel_immutable", 400);
      ch.archivedAt = nowIso();
      ch.updatedAt = nowIso();
      return json({ channel: serializeChannel(ch) });
    }

    /* 14) GET /communication-channels/:id/conversation — беседа канала (ensure). */
    const chConv = method === "GET" ? path.match(/^\/api\/workspace\/communication-channels\/([^/]+)\/conversation$/) : null;
    if (chConv) {
      const idParsed = parseCollaborationId(decodeURIComponent(chConv[1]!), "communication_channel_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      const ch = db.channels.find((c) => c.id === idParsed.value && c.archivedAt === null);
      if (!ch) return err("communication_channel_not_found", 404);
      if (!channelCanRead(ch.id, ch.channelType)) return err("permission_missing", 403);
      // Побочка: ensureConversation entityType=communication_channel, entityId=channelId.
      const conv = ensureConversation("communication_channel", ch.id, ch.title);
      return json({ channel: serializeChannel(ch), conversation: { ...conv, readState: getReadState(conv.id) } });
    }

    /* 15) POST /communication-channels/:id/members — добавить (upsert). */
    const memAdd = method === "POST" ? path.match(/^\/api\/workspace\/communication-channels\/([^/]+)\/members$/) : null;
    if (memAdd) {
      const idParsed = parseCollaborationId(decodeURIComponent(memAdd[1]!), "communication_channel_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      const ch = db.channels.find((c) => c.id === idParsed.value && c.archivedAt === null);
      if (!ch) return err("communication_channel_not_found", 404);
      if (!channelCanManage(ch.id, ch.channelType, db.channelMembers)) return err("permission_missing", 403);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const userParsed = parseCollaborationId(body.userId, "tenant_user_id_invalid");
      if (!userParsed.ok) return err(userParsed.error, 400);
      let role: ChannelMember["role"] = "member";
      if (body.role != null) {
        const roleParsed = parseCommunicationChannelRole(body.role);
        if (!roleParsed.ok) return err(roleParsed.error, 400);
        role = roleParsed.value;
      }
      if (!COMMS_USERS.some((u) => u.id === userParsed.value)) return err("tenant_user_not_found", 404);
      // upsert (add-or-restore): если участник есть — обновляем роль и снимаем archivedAt.
      let member = db.channelMembers.find((m) => m.channelId === ch.id && m.userId === userParsed.value);
      if (member) {
        member.role = role;
        member.archivedAt = null;
      } else {
        member = { tenantId: TENANT, channelId: ch.id, userId: userParsed.value, role, createdByUserId: CURRENT_ACTOR_ID, createdAt: nowIso(), archivedAt: null };
        db.channelMembers.push(member);
      }
      return json({ member }, 201);
    }

    /* 16) DELETE /communication-channels/:id/members/:userId — удалить (soft-archive). */
    const memDel = method === "DELETE" ? path.match(/^\/api\/workspace\/communication-channels\/([^/]+)\/members\/([^/]+)$/) : null;
    if (memDel) {
      const idParsed = parseCollaborationId(decodeURIComponent(memDel[1]!), "communication_channel_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      const ch = db.channels.find((c) => c.id === idParsed.value && c.archivedAt === null);
      if (!ch) return err("communication_channel_not_found", 404);
      if (!channelCanManage(ch.id, ch.channelType, db.channelMembers)) return err("permission_missing", 403);
      const userParsed = parseCollaborationId(decodeURIComponent(memDel[2]!), "tenant_user_id_invalid");
      if (!userParsed.ok) return err(userParsed.error, 400);
      const member = db.channelMembers.find((m) => m.channelId === ch.id && m.userId === userParsed.value && m.archivedAt === null);
      if (!member) return err("channel_member_not_found", 404);
      member.archivedAt = nowIso();
      return json({ member });
    }

    /* ============================================================
       ЗВОНКИ (17-25) — честно без WebRTC: только метаданные/события.
       ============================================================ */

    /* 17) GET /call-rooms?entityType&entityId — комнаты сущности. */
    if (method === "GET" && path === "/api/workspace/call-rooms") {
      const typeParsed = parseCollaborationEntityType(query.get("entityType"));
      if (!typeParsed.ok) return err(typeParsed.error, 400);
      const idParsed = parseCollaborationId(query.get("entityId") ?? "", "collaboration_entity_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      // 404 communications_entity_not_found / 403 — в демо не активируются (RBAC-стаб).
      if (!canReadEntity(typeParsed.value, idParsed.value)) return err("permission_missing", 403);
      // Боевой listCallRoomsByEntity: orderBy(desc(createdAt), desc(id)) — сортируем ДО serialize (он омитит createdAt/id).
      const callRooms = db.callRooms
        .filter((r) => r.entityType === typeParsed.value && r.entityId === idParsed.value && r.archivedAt === null)
        .sort((a, b) => byOrdinal(b.createdAt, a.createdAt) || byOrdinal(b.id, a.id))
        .map(serializeCallRoom);
      return json({ callRooms });
    }

    /* 18) POST /call-rooms — создать комнату (status forced 'open'; событие room_created). */
    if (method === "POST" && path === "/api/workspace/call-rooms") {
      // Тело ДО access (боевой читает тело до резолва entity). Порядок: entity → title → mediaKind → provider → meetingId → providerRoomId → access → conflict.
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const typeParsed = parseCollaborationEntityType(body.entityType);
      if (!typeParsed.ok) return err(typeParsed.error, 400);
      const entityIdParsed = parseCollaborationId(body.entityId, "collaboration_entity_id_invalid");
      if (!entityIdParsed.ok) return err(entityIdParsed.error, 400);
      const titleParsed = parseCallTitle(body.title);
      if (!titleParsed.ok) return err(titleParsed.error, 400);
      let mediaKind: CallRoom["mediaKind"] = "video"; // дефолт
      if (body.mediaKind != null) {
        const mkParsed = parseCallMediaKind(body.mediaKind);
        if (!mkParsed.ok) return err(mkParsed.error, 400);
        mediaKind = mkParsed.value;
      }
      const providerParsed = parseCallRoomProvider(body.provider);
      if (!providerParsed.ok) return err(providerParsed.error, 400);
      let meetingId: string | null = null;
      if (body.meetingId != null) {
        const midParsed = parseCollaborationId(body.meetingId, "meeting_id_invalid");
        if (!midParsed.ok) return err(midParsed.error, 400);
        meetingId = midParsed.value;
      }
      const id = genId("call-room");
      let providerRoomId = id; // дефолт = roomId, если не задан
      if (body.providerRoomId != null) {
        const prParsed = parseProviderRoomId(body.providerRoomId);
        if (!prParsed.ok) return err(prParsed.error, 400);
        providerRoomId = prParsed.value;
      }
      // 403 manage — в демо actor имеет право (стаб).
      if (!canManageEntity(typeParsed.value, entityIdParsed.value)) return err("permission_missing", 403);
      // 409 conflict: уникальность providerRoomId per tenant.
      if (db.callRooms.some((r) => r.providerRoomId === providerRoomId)) return err("call_room_provider_room_conflict", 409);
      const created: CallRoomRecord = {
        id,
        tenantId: TENANT,
        entityType: typeParsed.value,
        entityId: entityIdParsed.value,
        meetingId,
        title: titleParsed.value,
        mediaKind,
        provider: providerParsed.value,
        providerRoomId,
        status: "open", // forced
        createdByUserId: CURRENT_ACTOR_ID,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        archivedAt: null
      };
      db.callRooms.push(created);
      const event = pushCallEvent(id, null, "room_created", { provider: created.provider, mediaKind: created.mediaKind });
      return json({ callRoom: serializeCallRoom(created), event }, 201);
    }

    /* 19) GET /call-rooms/:roomId — комната + последние 50 событий + записи + capabilities. */
    const callRoomGet = method === "GET" ? path.match(/^\/api\/workspace\/call-rooms\/([^/]+)$/) : null;
    if (callRoomGet) {
      const resolved = resolveCallRoom(callRoomGet[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      const events = db.callEvents
        .filter((e) => e.roomId === resolved.room.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, 50);
      const recordings = db.callRecordings.filter((r) => r.roomId === resolved.room.id);
      // capabilities зеркалят боевой контракт: провайдер мока = MOCK_VIDEO_PROVIDER,
      // egress в моке отсутствует, RBAC-стаб отдаёт manage=true.
      return json({
        callRoom: serializeCallRoom(resolved.room),
        events,
        recordings,
        capabilities: { videoProviderKind: MOCK_VIDEO_PROVIDER, egressEnabled: false, canManage: true }
      });
    }

    /* 20) POST /call-rooms/:roomId/sessions/start — старт сессии (room→active; 409 already_active). */
    const sessStart = method === "POST" ? path.match(/^\/api\/workspace\/call-rooms\/([^/]+)\/sessions\/start$/) : null;
    if (sessStart) {
      const resolved = resolveCallRoom(sessStart[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      if (!canManageEntity(resolved.room.entityType, resolved.room.entityId)) return err("permission_missing", 403);
      // 409: комната уже active (один активный сеанс на комнату).
      if (resolved.room.status === "active") return err("call_room_already_active", 409);
      const session: CallSession = {
        id: genId("call-session"),
        roomId: resolved.room.id,
        providerSessionId: null,
        status: "active",
        startedByUserId: CURRENT_ACTOR_ID,
        startedAt: nowIso(),
        endedByUserId: null,
        endedAt: null,
        failureReason: null
      };
      db.callSessions.push(session);
      resolved.room.status = "active";
      resolved.room.updatedAt = nowIso();
      const event = pushCallEvent(resolved.room.id, session.id, "session_started", { provider: resolved.room.provider });
      return json({ callRoom: serializeCallRoom(resolved.room), session, event }, 201);
    }

    /* 21) POST /call-rooms/:roomId/sessions/:sid/join-token — join-token (READ-доступ). */
    const joinToken = method === "POST" ? path.match(/^\/api\/workspace\/call-rooms\/([^/]+)\/sessions\/([^/]+)\/join-token$/) : null;
    if (joinToken) {
      const resolved = resolveCallRoomAndSession(joinToken[1]!, joinToken[2]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      // READ only (не manage). Порядок: session active → provider disabled → provider mismatch.
      if (resolved.session.status !== "active") return err("call_session_not_active", 409);
      // В моке provider никогда не 'disabled' (MOCK_VIDEO_PROVIDER=jitsi) — ветка зеркалится для контракта.
      // (если бы был disabled → 501 video_provider_disabled.)
      // room.provider должен совпадать с конфигом деплоя; иначе 409.
      if (resolved.room.provider !== MOCK_VIDEO_PROVIDER) return err("video_provider_misconfigured", 409);
      // manual/jitsi: token=null, expiresAt=null, joinUrl = base + '/' + providerRoomId.
      const join = {
        provider: resolved.room.provider,
        joinUrl: `${VIDEO_BASE_URL}/${encodeURIComponent(resolved.room.providerRoomId)}`,
        token: null,
        expiresAt: null
      };
      const event = pushCallEvent(resolved.room.id, resolved.session.id, "join_token_issued", { provider: resolved.room.provider, expiresAt: null });
      return json({ join, event });
    }

    /* 22) POST /call-rooms/:roomId/sessions/:sid/participant-state — состояние участника (свой=read, чужой=manage). */
    const partState = method === "POST" ? path.match(/^\/api\/workspace\/call-rooms\/([^/]+)\/sessions\/([^/]+)\/participant-state$/) : null;
    if (partState) {
      const resolved = resolveCallRoomAndSession(partState[1]!, partState[2]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      // Порядок: state → userId → non-self manage → session active → user existence.
      const stateParsed = parseCallParticipantState(body.state);
      if (!stateParsed.ok) return err(stateParsed.error, 400);
      let userId = CURRENT_ACTOR_ID;
      if (body.userId != null) {
        const uidParsed = parseCollaborationId(body.userId, "participant_user_id_invalid");
        if (!uidParsed.ok) return err(uidParsed.error, 400);
        userId = uidParsed.value;
      }
      const isSelf = userId === CURRENT_ACTOR_ID;
      if (!isSelf && !canManageEntity(resolved.room.entityType, resolved.room.entityId)) return err("permission_missing", 403);
      if (resolved.session.status !== "active") return err("call_session_not_active", 409);
      if (!isSelf && !COMMS_USERS.some((u) => u.id === userId)) return err("participant_user_not_found", 404);
      // upsert состояния (ключ room+session+user). Таймстампы server-managed.
      const now = nowIso();
      let ps = db.callParticipantStates.find((p) => p.roomId === resolved.room.id && p.sessionId === resolved.session.id && p.userId === userId);
      if (!ps) {
        ps = { tenantId: TENANT, roomId: resolved.room.id, sessionId: resolved.session.id, userId, state: stateParsed.value, joinedAt: null, leftAt: null, lastSeenAt: now };
        db.callParticipantStates.push(ps);
      }
      ps.state = stateParsed.value;
      ps.lastSeenAt = now;
      if (stateParsed.value === "joined" && ps.joinedAt === null) ps.joinedAt = now;
      // Боевой upsertCallParticipantState задаёт leftAt БЕЗУСЛОВНО: left/removed → now; иначе null (сброс при возврате).
      ps.leftAt = stateParsed.value === "left" || stateParsed.value === "removed" ? now : null;
      // Маппинг события по состоянию.
      const eventType: CallEvent["eventType"] =
        stateParsed.value === "invited"
          ? "participant_invited"
          : stateParsed.value === "joining"
            ? "participant_joining"
            : stateParsed.value === "joined"
              ? "participant_joined"
              : "participant_left"; // left | removed
      const event = pushCallEvent(resolved.room.id, resolved.session.id, eventType, { userId, state: stateParsed.value });
      return json({ participantState: serializeParticipantState(ps), event });
    }

    /* 23) POST /call-rooms/:roomId/sessions/:sid/end — завершить сессию (room→ended; single-use). */
    const sessEnd = method === "POST" ? path.match(/^\/api\/workspace\/call-rooms\/([^/]+)\/sessions\/([^/]+)\/end$/) : null;
    if (sessEnd) {
      const resolved = resolveCallRoomAndSession(sessEnd[1]!, sessEnd[2]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      if (!canManageEntity(resolved.room.entityType, resolved.room.entityId)) return err("permission_missing", 403);
      // 409: повторное завершение (сессия не active).
      if (resolved.session.status !== "active") return err("call_session_not_active", 409);
      const now = nowIso();
      resolved.session.status = "ended";
      resolved.session.endedByUserId = CURRENT_ACTOR_ID;
      resolved.session.endedAt = now;
      resolved.room.status = "ended"; // single-use: комната уходит в ended, не возвращается в open
      resolved.room.updatedAt = now;
      const event = pushCallEvent(resolved.room.id, resolved.session.id, "session_ended", { endedByUserId: CURRENT_ACTOR_ID });
      return json({ callRoom: serializeCallRoom(resolved.room), session: resolved.session, event });
    }

    /* 24) POST /call-rooms/:roomId/recordings — прикрепить запись (manage ДО body). */
    const recAttach = method === "POST" ? path.match(/^\/api\/workspace\/call-rooms\/([^/]+)\/recordings$/) : null;
    if (recAttach) {
      const resolved = resolveCallRoom(recAttach[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      // manage ДО разбора тела.
      if (!canManageEntity(resolved.room.entityType, resolved.room.entityId)) return err("permission_missing", 403);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      // Порядок: attachmentId → title → sessionId → (session existence).
      const attParsed = parseCollaborationId(body.attachmentId, "attachment_id_invalid");
      if (!attParsed.ok) return err(attParsed.error, 400);
      let title = "Recording"; // дефолт
      if (body.title != null) {
        const titleParsed = parseCallTitle(body.title);
        if (!titleParsed.ok) return err(titleParsed.error, 400);
        title = titleParsed.value;
      }
      let sessionId: string | null = null;
      if (body.sessionId != null) {
        const sidParsed = parseCollaborationId(body.sessionId, "call_session_id_invalid");
        if (!sidParsed.ok) return err(sidParsed.error, 400);
        const session = db.callSessions.find((s) => s.id === sidParsed.value && s.roomId === resolved.room.id);
        if (!session) return err("call_session_not_found", 404);
        sessionId = session.id;
      }
      // attachment existence/match → в моке упрощено (нет attachment-стора); считаем ссылку валидной.
      const recording: CallRecording = {
        id: genId("call-recording"),
        roomId: resolved.room.id,
        sessionId,
        attachmentId: attParsed.value,
        title,
        createdByUserId: CURRENT_ACTOR_ID,
        createdAt: nowIso()
      };
      db.callRecordings.push(recording);
      const event = pushCallEvent(resolved.room.id, sessionId, "recording_attached", { recordingId: recording.id, attachmentId: recording.attachmentId });
      return json({ event, recording }, 201);
    }

    /* 25) GET /call-rooms/:roomId/events?limit — лента событий (limit def 50, clamp 1..100). */
    const callEvents = method === "GET" ? path.match(/^\/api\/workspace\/call-rooms\/([^/]+)\/events$/) : null;
    if (callEvents) {
      const resolved = resolveCallRoom(callEvents[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      const limit = parseClampLimit(query.get("limit"), 50, 100);
      const events = db.callEvents
        .filter((e) => e.roomId === resolved.room.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, limit);
      return json({ events });
    }

    /* ============================================================
       МИТИНГИ (26-31)
       ============================================================ */

    /* 26) GET /meetings?entityType&entityId — митинги сущности (только Meeting-строки). */
    if (method === "GET" && path === "/api/workspace/meetings") {
      const typeParsed = parseCollaborationEntityType(query.get("entityType"));
      if (!typeParsed.ok) return err(typeParsed.error, 400);
      const idParsed = parseCollaborationId(query.get("entityId") ?? "", "collaboration_entity_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      if (!canReadEntity(typeParsed.value, idParsed.value)) return err("permission_missing", 403);
      // Боевой listMeetingsByEntity: orderBy(asc(scheduledStart), asc(id)).
      const meetings = db.meetings
        .filter((m) => m.entityType === typeParsed.value && m.entityId === idParsed.value && m.archivedAt === null)
        .sort((a, b) => byOrdinal(a.scheduledStart, b.scheduledStart) || byOrdinal(a.id, b.id));
      return json({ meetings });
    }

    /* 26c) GET /unread-summary — счётчики непрочитанного (демо: unread notifications + сумма read-state). */
    if (method === "GET" && path === "/api/workspace/unread-summary") {
      const notifications = db.notifications.filter((n) => n.userId === CURRENT_ACTOR_ID && n.readAt === null && n.archivedAt === null).length;
      const conversations = db.readStates.filter((r) => r.userId === CURRENT_ACTOR_ID).reduce((sum, r) => sum + r.unreadCount, 0);
      return json({ notifications, conversations });
    }

    /* 26b) GET /meetings/:id — composite деталь (зеркало боевого GET meeting detail). */
    const meetingDetailMatch = method === "GET" ? path.match(/^\/api\/workspace\/meetings\/([^/]+)$/) : null;
    if (meetingDetailMatch) {
      const idParsed = parseCollaborationId(decodeURIComponent(meetingDetailMatch[1]!), "meeting_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      const meeting = db.meetings.find((m) => m.id === idParsed.value && m.archivedAt === null);
      if (!meeting) return err("meeting_not_found", 404);
      if (!canReadEntity(meeting.entityType, meeting.entityId)) return err("permission_missing", 403);
      return json({
        meeting,
        participants: db.meetingParticipants.filter((p) => p.meetingId === meeting.id),
        notes: db.meetingNotes.filter((n) => n.meetingId === meeting.id && n.archivedAt === null),
        actionItems: db.meetingActionItems.filter((a) => a.meetingId === meeting.id && a.archivedAt === null),
        externalLinks: db.meetingExternalLinks.filter((l) => l.meetingId === meeting.id && l.archivedAt === null)
      });
    }

    /* 27) POST /meetings — создать (тело+участники ДО access; организатор авто; meeting_invite побочка). */
    if (method === "POST" && path === "/api/workspace/meetings") {
      // Тело ДО access (боевой). Порядок: entity → title → agenda → start → finish → schedule → participants → tenant_user → access.
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const typeParsed = parseCollaborationEntityType(body.entityType);
      if (!typeParsed.ok) return err(typeParsed.error, 400);
      const entityIdParsed = parseCollaborationId(body.entityId, "collaboration_entity_id_invalid");
      if (!entityIdParsed.ok) return err(entityIdParsed.error, 400);
      const titleParsed = parseMeetingTitle(body.title);
      if (!titleParsed.ok) return err(titleParsed.error, 400);
      const agendaParsed = parseMeetingAgenda(body.agenda);
      if (!agendaParsed.ok) return err(agendaParsed.error, 400);
      // start/finish: любая Date-парсибельная строка; finish > start.
      const startRaw = body.scheduledStart;
      if (typeof startRaw !== "string" || Number.isNaN(Date.parse(startRaw))) return err("meeting_start_invalid", 400);
      const finishRaw = body.scheduledFinish;
      if (typeof finishRaw !== "string" || Number.isNaN(Date.parse(finishRaw))) return err("meeting_finish_invalid", 400);
      if (Date.parse(finishRaw) <= Date.parse(startRaw)) return err("meeting_schedule_invalid", 400);
      // participants: массив ≤50; role default 'required'; дедуп; response 'pending'.
      const rawParticipants = Array.isArray(body.participants) ? (body.participants as unknown[]) : [];
      if (rawParticipants.length > 50) return err("meeting_participants_too_many", 400);
      const parsedParticipants: { userId: string; role: MeetingParticipant["role"] }[] = [];
      for (const raw of rawParticipants) {
        const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const uidParsed = parseCollaborationId(obj.userId, "meeting_participant_user_id_invalid");
        if (!uidParsed.ok) return err(uidParsed.error, 400);
        let role: MeetingParticipant["role"] = "required";
        if (obj.role === "organizer" || obj.role === "required" || obj.role === "optional") role = obj.role;
        if (!parsedParticipants.some((p) => p.userId === uidParsed.value)) parsedParticipants.push({ userId: uidParsed.value, role });
      }
      // tenant_user existence (400, до access).
      for (const p of parsedParticipants) {
        if (!COMMS_USERS.some((u) => u.id === p.userId)) return err("tenant_user_not_found", 400);
      }
      // access (manage) — после тела.
      if (!canManageEntity(typeParsed.value, entityIdParsed.value)) return err("permission_missing", 403);
      const meetingId = genId("meeting");
      const createdAt = nowIso();
      const meeting: Meeting = {
        id: meetingId,
        tenantId: TENANT,
        entityType: typeParsed.value,
        entityId: entityIdParsed.value,
        title: titleParsed.value,
        agenda: agendaParsed.value,
        scheduledStart: new Date(startRaw).toISOString(),
        scheduledFinish: new Date(finishRaw).toISOString(),
        status: "scheduled", // forced
        createdByUserId: CURRENT_ACTOR_ID,
        createdAt,
        archivedAt: null
      };
      db.meetings.push(meeting);
      // Участники: организатор (actor) авто accepted; остальные pending. ensureOrganizer.
      const participants: MeetingParticipant[] = [];
      const organizer: MeetingParticipant = { tenantId: TENANT, meetingId, userId: CURRENT_ACTOR_ID, role: "organizer", response: "accepted", createdAt };
      participants.push(organizer);
      for (const p of parsedParticipants) {
        if (p.userId === CURRENT_ACTOR_ID) continue; // actor уже как организатор
        participants.push({ tenantId: TENANT, meetingId, userId: p.userId, role: p.role, response: "pending", createdAt });
      }
      db.meetingParticipants.push(...participants);
      // Побочка: meeting_invite каждому ≠ actor.
      for (const p of participants) {
        if (p.userId === CURRENT_ACTOR_ID) continue;
        pushNotification({
          userId: p.userId,
          notificationType: "meeting_invite",
          sourceEntityType: meeting.entityType,
          sourceEntityId: meeting.entityId,
          title: "Новая встреча",
          body: meeting.title,
          route: routeForEntity(meeting.entityType, meeting.entityId)
        });
      }
      return json({ meeting, participants }, 201);
    }

    /* 28) PATCH /meetings/:id — partial update (id→not_found→read→manage→fields→schedule→status). */
    const meetingPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/meetings\/([^/]+)$/) : null;
    if (meetingPatch) {
      const resolved = resolveMeeting(meetingPatch[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      if (!canManageEntity(resolved.meeting.entityType, resolved.meeting.entityId)) return err("permission_missing", 403);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const m = resolved.meeting;
      // Поля partial: missing → keep current. Порядок title → agenda → start → finish → schedule → status.
      let nextTitle = m.title;
      if (body.title !== undefined) {
        const tp = parseMeetingTitle(body.title);
        if (!tp.ok) return err(tp.error, 400);
        nextTitle = tp.value;
      }
      let nextAgenda = m.agenda;
      if (body.agenda !== undefined) {
        const ap = parseMeetingAgenda(body.agenda);
        if (!ap.ok) return err(ap.error, 400);
        nextAgenda = ap.value;
      }
      let nextStart = m.scheduledStart;
      if (body.scheduledStart !== undefined) {
        if (typeof body.scheduledStart !== "string" || Number.isNaN(Date.parse(body.scheduledStart))) return err("meeting_start_invalid", 400);
        nextStart = new Date(body.scheduledStart).toISOString();
      }
      let nextFinish = m.scheduledFinish;
      if (body.scheduledFinish !== undefined) {
        if (typeof body.scheduledFinish !== "string" || Number.isNaN(Date.parse(body.scheduledFinish))) return err("meeting_finish_invalid", 400);
        nextFinish = new Date(body.scheduledFinish).toISOString();
      }
      // schedule: итоговый finish > start (даже если задано только одно поле).
      if (Date.parse(nextFinish) <= Date.parse(nextStart)) return err("meeting_schedule_invalid", 400);
      let nextStatus = m.status;
      if (body.status !== undefined) {
        const sp = parseMeetingStatus(body.status);
        if (!sp.ok) return err(sp.error, 400);
        nextStatus = sp.value;
      }
      m.title = nextTitle;
      m.agenda = nextAgenda;
      m.scheduledStart = nextStart;
      m.scheduledFinish = nextFinish;
      m.status = nextStatus;
      return json({ meeting: m });
    }

    /* 29) POST /meetings/:id/external-links — внешняя ссылка (manage → provider → url SSRF → title). */
    const extLink = method === "POST" ? path.match(/^\/api\/workspace\/meetings\/([^/]+)\/external-links$/) : null;
    if (extLink) {
      const resolved = resolveMeeting(extLink[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      if (!canManageEntity(resolved.meeting.entityType, resolved.meeting.entityId)) return err("permission_missing", 403);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const providerParsed = parseMeetingExternalLinkProvider(body.provider);
      if (!providerParsed.ok) return err(providerParsed.error, 400);
      const urlParsed = parseExternalUrl(body.url);
      if (!urlParsed.ok) return err(urlParsed.error, 400);
      const titleParsed = parseExternalTitle(body.title);
      if (!titleParsed.ok) return err(titleParsed.error, 400);
      const link: MeetingExternalLink = {
        id: genId("meeting-link"),
        tenantId: TENANT,
        meetingId: resolved.meeting.id,
        provider: providerParsed.value,
        url: urlParsed.value,
        title: titleParsed.value,
        createdByUserId: CURRENT_ACTOR_ID,
        createdAt: nowIso(),
        archivedAt: null
      };
      db.meetingExternalLinks.push(link);
      return json({ externalLink: link }, 201);
    }

    /* 30) POST /meetings/:id/notes — заметка (участник ИЛИ manage ДО body). */
    const meetingNote = method === "POST" ? path.match(/^\/api\/workspace\/meetings\/([^/]+)\/notes$/) : null;
    if (meetingNote) {
      const resolved = resolveMeeting(meetingNote[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      // Авторизация ДО body: участник ИЛИ manage.
      const isParticipant = db.meetingParticipants.some((p) => p.meetingId === resolved.meeting.id && p.userId === CURRENT_ACTOR_ID);
      if (!isParticipant && !canManageEntity(resolved.meeting.entityType, resolved.meeting.entityId)) return err("permission_missing", 403);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const bodyParsed = parseMeetingNoteBody(body.body);
      if (!bodyParsed.ok) return err(bodyParsed.error, 400);
      const note: MeetingNote = {
        id: genId("meeting-note"),
        tenantId: TENANT,
        meetingId: resolved.meeting.id,
        authorUserId: CURRENT_ACTOR_ID,
        body: bodyParsed.value,
        createdAt: nowIso(),
        editedAt: null,
        archivedAt: null
      };
      db.meetingNotes.push(note);
      return json({ note }, 201);
    }

    /* 31b) PATCH /meetings/:id/action-items/:itemId — статус (manage; open/done/cancelled). */
    const actionItemPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/meetings\/([^/]+)\/action-items\/([^/]+)$/) : null;
    if (actionItemPatch) {
      const resolved = resolveMeeting(actionItemPatch[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      if (!canManageEntity(resolved.meeting.entityType, resolved.meeting.entityId)) return err("permission_missing", 403);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const nextStatus = parsedBody.body.status;
      if (nextStatus !== "open" && nextStatus !== "done" && nextStatus !== "cancelled") return err("meeting_action_item_status_invalid", 400);
      const item = db.meetingActionItems.find((a) => a.id === decodeURIComponent(actionItemPatch[2]!) && a.meetingId === resolved.meeting.id && a.archivedAt === null);
      if (!item) return err("meeting_action_item_not_found", 404);
      item.status = nextStatus;
      return json({ actionItem: item });
    }

    /* 31) POST /meetings/:id/action-items — action-item (manage → title → owner → dueDate → target; status forced 'open'). */
    const actionItem = method === "POST" ? path.match(/^\/api\/workspace\/meetings\/([^/]+)\/action-items$/) : null;
    if (actionItem) {
      const resolved = resolveMeeting(actionItem[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      if (!canManageEntity(resolved.meeting.entityType, resolved.meeting.entityId)) return err("permission_missing", 403);
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      // title (reuse parseConversationTitle) → owner → dueDate → target → tenant_user.
      const titleParsed = parseConversationTitle(body.title);
      if (!titleParsed.ok) return err(titleParsed.error, 400);
      const ownerParsed = parseCollaborationId(body.ownerUserId, "meeting_action_owner_invalid");
      if (!ownerParsed.ok) return err(ownerParsed.error, 400);
      let dueDate: string | null = null;
      if (body.dueDate != null && body.dueDate !== "") {
        if (typeof body.dueDate !== "string" || !isValidDueDate(body.dueDate)) return err("meeting_action_due_date_invalid", 400);
        dueDate = body.dueDate;
      }
      // target (зеркало parseMeetingActionItemBody): наличие по `!== undefined` (null/'' = ПЕРЕДАНО).
      // required-предикат и парс — 1:1 с боевым: undefined-поле дефолтит, переданное (incl null/'') парсится.
      const canDefault = DEFAULT_TARGET_ENTITY_TYPES.has(resolved.meeting.entityType);
      const hasType = body.targetEntityType !== undefined;
      const hasId = body.targetEntityId !== undefined;
      if ((!canDefault || hasType !== hasId) && (!hasType || !hasId)) return err("meeting_action_target_required", 400);
      let targetEntityType: MeetingActionItem["targetEntityType"];
      if (!hasType) {
        targetEntityType = (canDefault ? resolved.meeting.entityType : "project") as MeetingActionItem["targetEntityType"];
      } else {
        const ttParsed = parseMeetingActionTargetType(body.targetEntityType);
        if (!ttParsed.ok) return err(ttParsed.error, 400);
        targetEntityType = ttParsed.value;
      }
      let targetEntityId: string;
      if (!hasId) {
        targetEntityId = resolved.meeting.entityId;
      } else {
        const tidParsed = parseCollaborationId(body.targetEntityId, "meeting_action_target_id_invalid");
        if (!tidParsed.ok) return err(tidParsed.error, 400);
        targetEntityId = tidParsed.value;
      }
      // tenant_user existence для owner.
      if (!COMMS_USERS.some((u) => u.id === ownerParsed.value)) return err("tenant_user_not_found", 400);
      const item: MeetingActionItem = {
        id: genId("meeting-action"),
        tenantId: TENANT,
        meetingId: resolved.meeting.id,
        title: titleParsed.value,
        ownerUserId: ownerParsed.value,
        dueDate,
        targetEntityType,
        targetEntityId,
        status: "open", // forced
        createdByUserId: CURRENT_ACTOR_ID,
        createdAt: nowIso(),
        archivedAt: null
      };
      db.meetingActionItems.push(item);
      // Побочка: meeting_action_item owner ≠ actor.
      if (item.ownerUserId !== CURRENT_ACTOR_ID) {
        pushNotification({
          userId: item.ownerUserId,
          notificationType: "meeting_action_item",
          sourceEntityType: resolved.meeting.entityType,
          sourceEntityId: resolved.meeting.entityId,
          title: "Action item после встречи",
          body: item.title,
          route: routeForEntity(resolved.meeting.entityType, resolved.meeting.entityId)
        });
      }
      return json({ actionItem: item }, 201);
    }

    /* ============================================================
       УВЕДОМЛЕНИЯ (32-35) — self-scoped лента + read + preferences.
       ============================================================ */

    /* 32) GET /notifications?status&limit — лента актора (self-scoped, archivedAt всегда null). */
    if (method === "GET" && path === "/api/workspace/notifications") {
      const statusRaw = query.get("status");
      if (statusRaw !== null && statusRaw !== "" && statusRaw !== "unread" && statusRaw !== "read") {
        return err("notification_status_invalid", 400);
      }
      // limit: def 20, cap 100, мусор → 20.
      const limit = parseClampLimit(query.get("limit"), 20, 100);
      // Self-scoped: только уведомления актора (боевой DB-фильтр userId=actor.id, согласовано с routes 33/34).
      // Сорт createdAt DESC, id DESC. archivedAt всегда null (DB-фильтр isNull).
      const notifications = db.notifications
        .filter((n) => n.userId === CURRENT_ACTOR_ID)
        .filter((n) => n.archivedAt === null)
        .filter((n) => (statusRaw === "unread" ? n.readAt === null : statusRaw === "read" ? n.readAt !== null : true))
        .sort((a, b) => byOrdinal(b.createdAt, a.createdAt) || byOrdinal(b.id, a.id))
        .slice(0, limit);
      return json({ notifications });
    }

    /* 33) POST /notifications/:id/read — отметить прочитанным (НЕ идемпотентен; чужое/нет/архив → 404). */
    const notifRead = method === "POST" ? path.match(/^\/api\/workspace\/notifications\/([^/]+)\/read$/) : null;
    if (notifRead) {
      const idParsed = parseCollaborationId(decodeURIComponent(notifRead[1]!), "notification_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      // Все «не найдено / чужое / архив» → один 404 (нет 403/501). Self-scope: только uведомления актора.
      const notification = db.notifications.find((n) => n.id === idParsed.value && n.userId === CURRENT_ACTOR_ID && n.archivedAt === null);
      if (!notification) return err("notification_not_found", 404);
      // НЕ идемпотентен: readAt=now каждый раз (перезаписывает).
      notification.readAt = nowIso();
      return json({ notification });
    }

    /* 34) GET /notification-preferences — настройки актора (raw без дат; сорт channel ASC, type ASC). */
    if (method === "GET" && path === "/api/workspace/notification-preferences") {
      const preferences = db.notificationPreferences
        .filter((p) => p.userId === CURRENT_ACTOR_ID)
        .slice()
        .sort((a, b) => a.channel.localeCompare(b.channel) || a.notificationType.localeCompare(b.notificationType));
      return json({ preferences });
    }

    /* 35) PUT /notification-preferences — UPSERT ([]→ранний выход []; ≤100; полный re-list). */
    if (method === "PUT" && path === "/api/workspace/notification-preferences") {
      const parsedBody = parseBody();
      if (!parsedBody.ok) return err("invalid_json", 400);
      const body = parsedBody.body;
      const rawPrefs = body.preferences;
      if (!Array.isArray(rawPrefs)) return err("notification_preferences_invalid", 400);
      if (rawPrefs.length > 100) return err("notification_preferences_too_many", 400);
      // [] → ранний выход []: НЕ трогаем стор, возвращаем пустой массив.
      if (rawPrefs.length === 0) return json({ preferences: [] });
      // Парсим все ДО записи (порядок: channel → type → digest).
      const parsed: NotificationPreference[] = [];
      for (const raw of rawPrefs as unknown[]) {
        const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const channelParsed = parseNotificationChannel(obj.channel);
        if (!channelParsed.ok) return err(channelParsed.error, 400);
        const typeParsed = parseNotificationType(obj.notificationType);
        if (!typeParsed.ok) return err(typeParsed.error, 400);
        // enabled: только литерал false → false; всё остальное (включая отсутствие/null) → true.
        const enabled = obj.enabled !== false;
        // digestFrequency: дефолт 'none' при отсутствии/null.
        let digestFrequency: NotificationPreference["digestFrequency"] = "none";
        if (obj.digestFrequency != null) {
          const dfParsed = parseDigestFrequency(obj.digestFrequency);
          if (!dfParsed.ok) return err(dfParsed.error, 400);
          digestFrequency = dfParsed.value;
        }
        parsed.push({ tenantId: TENANT, userId: CURRENT_ACTOR_ID, channel: channelParsed.value, notificationType: typeParsed.value, enabled, digestFrequency });
      }
      // UPSERT по ключу channel+type (не replace-all): непереданные пары остаются.
      for (const p of parsed) {
        const existing = db.notificationPreferences.find(
          (x) => x.userId === CURRENT_ACTOR_ID && x.channel === p.channel && x.notificationType === p.notificationType
        );
        if (existing) {
          existing.enabled = p.enabled;
          existing.digestFrequency = p.digestFrequency;
        } else {
          db.notificationPreferences.push(p);
        }
      }
      // Ответ — ПОЛНЫЙ re-list (сорт channel ASC, type ASC).
      const preferences = db.notificationPreferences
        .filter((p) => p.userId === CURRENT_ACTOR_ID)
        .slice()
        .sort((a, b) => a.channel.localeCompare(b.channel) || a.notificationType.localeCompare(b.notificationType));
      return json({ preferences });
    }

    /* 36) GET /users — справочник пользователей рабочей области (боевой эквивалент — тот же путь
       /api/workspace/users). Мок отдаёт сид COMMS_USERS, чтобы stories видели тех же 4 людей. */
    if (method === "GET" && path === "/api/workspace/users") {
      return json({ users: COMMS_USERS });
    }

    /* 37) GET /projects — scope для entity-привязанных поверхностей (чат/звонки/встречи).
       Мок отдаёт единственный демо-проект DEMO_ENTITY, чтобы stories работали как раньше. */
    if (method === "GET" && path === "/api/workspace/projects") {
      return json({ projects: [{ id: DEMO_ENTITY.entityId, title: "Производственный портал" }] });
    }

    /* 38) GET /sticker-packs — паки со стикерами (боевой контракт communicationUpgradeRoutes:
       serializeStickerPack + вложенные serializeStickerAsset). Мок оборачивает сид-ассеты
       в один пак; downloadUrl пуст — бинарного стора у мока нет, UI честно рендерит emoji. */
    if (method === "GET" && path === "/api/workspace/sticker-packs") {
      return json({
        stickerPacks: [
          {
            id: "sticker-pack-seed",
            title: "Базовый набор",
            description: null,
            source: "upload",
            status: "ready",
            createdByUserId: CURRENT_ACTOR_ID,
            createdAt: "2026-01-10T00:00:00.000Z",
            archivedAt: null,
            stickers: db.stickerAssets.map((sticker) => ({
              id: sticker.id,
              packId: "sticker-pack-seed",
              downloadUrl: "",
              emoji: sticker.emoji,
              title: sticker.title,
              tags: [],
              mimeType: "image/png",
              width: 0,
              height: 0,
              sizeBytes: 0,
              status: "ready",
              createdAt: "2026-01-10T00:00:00.000Z",
              archivedAt: null
            }))
          }
        ]
      });
    }

    /* Общий 404 fallback (неизвестная ручка). */
    return err("not_found", 404);
  };

  return mockFetch;
}
