/* ============================================================
   Comms API client — тонкий типизированный клиент над REST-ручками
   /api/workspace/{conversations,communication-channels,call-rooms,
   meetings,notifications,notification-preferences}.

   Зеркало createCrmClient (crm-client): тот же приём с инъекцией
   fetchImpl, теми же заголовками и credentials. Переключение на боевой
   API = передать реальный apiOrigin и убрать fetchImpl-мок.

   ВАЖНО: блок «Коммуникации» — НЕ плоский CRUD. Модель entity-scoped
   (беседы/звонки/митинги привязаны к сущности entityType+entityId),
   беседы создаются ЛЕНИВО (ensureConversation внутри GET, нет POST
   /conversations), пагинация сообщений — обратная курсорная. RBAC
   двухуровневый (read/manage), но в моке упрощён (см. mock-comms-backend).
   ============================================================ */

/* Реэкспорт доменных union-типов коллаборации — единый источник правды.
   View-типы клиента строятся на ЭТИХ union'ах, чтобы контракт был верен. */
export type {
  CollaborationEntityType,
  ConversationType,
  CommunicationChannelType,
  CommunicationChannelRole,
  NotificationType,
  NotificationChannel,
  DigestFrequency,
  MeetingStatus,
  MeetingParticipantRole,
  MeetingParticipantResponse,
  MeetingExternalLinkProvider,
  MeetingActionItemStatus,
  MeetingActionTargetType,
  CallRoomProvider,
  CallMediaKind,
  CallRoomStatus,
  CallSessionStatus,
  CallParticipantStateValue,
  CallEventType
} from "@kiss-pm/domain";

import type {
  CollaborationEntityType,
  ConversationType,
  CommunicationChannelType,
  CommunicationChannelRole,
  NotificationType,
  NotificationChannel,
  DigestFrequency,
  MeetingStatus,
  MeetingParticipantRole,
  MeetingParticipantResponse,
  MeetingExternalLinkProvider,
  MeetingActionItemStatus,
  MeetingActionTargetType,
  CallRoomProvider,
  CallMediaKind,
  CallRoomStatus,
  CallSessionStatus,
  CallParticipantStateValue,
  CallEventType
} from "@kiss-pm/domain";

/* Алиас для удобства: тип сущности, к которой привязана коллаборация. */
export type EntityType = CollaborationEntityType;

/* Справочник пользователей рабочей области (GET /api/workspace/users).
   Боевой ответ — суперсет ({ tenantId, createdAt, … }); структурно совместим с { id, name }.
   Тот же эндпойнт, что и у блоков workspace/CRM — единый источник правды по людям тенанта. */
export type CommsUser = { id: string; name: string };

export type CommsApiClientOptions = { apiOrigin: string; fetchImpl?: typeof fetch; credentials?: RequestCredentials };

/* Зеркало CrmApiError: статус + код ошибки + сырое тело ответа. */
export class CommsApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: Record<string, unknown>;
  constructor(status: number, code: string, body: Record<string, unknown>) {
    super(code);
    this.name = "CommsApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/* ============================================================
   View-типы (форма боевых записей; даты пересекают провод как ISO-строки).
   Серриализаторы боевого API кое-где ПЕРЕИМЕНОВЫВАЮТ/ОМИТЯТ поля —
   это отражено в комментариях у соответствующих типов.
   ============================================================ */

/* ---- ЧАТ ---- */
export type ConversationReadState = {
  tenantId: string;
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  unreadCount: number;
};

export type Conversation = {
  id: string;
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  conversationType: ConversationType;
  title: string;
  createdByUserId: string;
  createdAt: string;
  archivedAt: string | null;
  // В листинге GET /conversations и в GET .../conversation каждой беседе подмешивается readState.
  readState?: ConversationReadState | null;
};

/* DM-беседа (P4.2): прямые сообщения по членству. entityType/conversationType —
   литералы "direct" (не зависят от domain-enum фронта). memberUserIds — участники
   (имена резолвятся через справочник пользователей). */
export type DirectConversationBase = {
  id: string;
  tenantId: string;
  entityType: "direct";
  entityId: string;
  conversationType: "direct";
  title: string;
  createdByUserId: string;
  createdAt: string;
  archivedAt: string | null;
};
export type DirectConversation = DirectConversationBase & {
  memberUserIds: string[];
  // Участники без текущего пользователя (для отображения «с кем» переписка).
  counterpartUserIds: string[];
  readState: ConversationReadState | null;
};

/* Присутствие (P4.3): online (есть открытое SSE), away (недавно отключился), offline. */
export type PresenceStatus = "online" | "away" | "offline";

export type Reaction = {
  id: string;
  tenantId: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  archivedAt: string | null;
};

// Стикер сообщения — без собственного id (ключ messageId+stickerAssetId).
export type MessageSticker = {
  tenantId: string;
  messageId: string;
  stickerAssetId: string;
  createdByUserId: string;
  createdAt: string;
};

export type Message = {
  id: string;
  tenantId: string;
  conversationId: string;
  authorUserId: string;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  editedAt: string | null;
  archivedAt: string | null;
  pinnedAt: string | null;
  pinnedByUserId: string | null;
  // В листинге сообщений / POST подтягиваются пачкой; в PATCH/DELETE/pin сериализатор их НЕ отдаёт.
  reactions: Reaction[];
  stickers: MessageSticker[];
};

export type MessageMention = {
  tenantId: string;
  messageId: string;
  mentionedUserId: string;
  createdAt: string;
};

/* ---- КАНАЛЫ ---- */
// Серриализованный канал ОМИТ tenantId и ДОБАВЛЯЕТ canManage (server-computed boolean).
export type Channel = {
  id: string;
  channelType: CommunicationChannelType;
  title: string;
  description: string;
  scopeEntityType: "project" | "org_unit" | null;
  scopeEntityId: string | null;
  canManage: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

// Участник канала — без собственного id (составной PK tenantId+channelId+userId).
export type ChannelMember = {
  tenantId: string;
  channelId: string;
  userId: string;
  role: CommunicationChannelRole;
  createdByUserId: string;
  createdAt: string;
  archivedAt: string | null;
};

/* ---- ЗВОНКИ ---- */
// Серриализатор звонка ПЕРЕИМЕНОВЫВАЕТ id→roomId и ОМИТ tenantId/providerRoomId/archivedAt.
export type CallRoom = {
  roomId: string; // === id записи
  entityType: EntityType;
  entityId: string;
  meetingId: string | null;
  title: string;
  mediaKind: CallMediaKind;
  provider: CallRoomProvider;
  status: CallRoomStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type CallSession = {
  id: string;
  roomId: string;
  providerSessionId: string | null;
  status: CallSessionStatus;
  startedByUserId: string;
  startedAt: string;
  endedByUserId: string | null;
  endedAt: string | null;
  failureReason: string | null;
};

export type CallParticipantState = {
  roomId: string;
  sessionId: string;
  userId: string;
  state: CallParticipantStateValue;
  joinedAt: string | null;
  leftAt: string | null;
  lastSeenAt: string;
};

export type CallEvent = {
  id: string;
  roomId: string;
  sessionId: string | null;
  eventType: CallEventType;
  actorUserId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type CallRecording = {
  id: string;
  roomId: string;
  sessionId: string | null;
  attachmentId: string;
  title: string;
  createdByUserId: string;
  createdAt: string;
};

// Контракт подключения к звонку (выдаётся join-token; реального WebRTC API не делает).
export type VideoJoinContract = {
  provider: CallRoomProvider;
  joinUrl: string;
  token: string | null;
  expiresAt: string | null;
};

/* ---- МИТИНГИ ---- */
export type Meeting = {
  id: string;
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  agenda: string;
  scheduledStart: string;
  scheduledFinish: string;
  status: MeetingStatus;
  createdByUserId: string;
  createdAt: string;
  archivedAt: string | null;
};

export type MeetingParticipant = {
  tenantId: string;
  meetingId: string;
  userId: string;
  role: MeetingParticipantRole;
  response: MeetingParticipantResponse;
  createdAt: string;
};

export type MeetingExternalLink = {
  id: string;
  tenantId: string;
  meetingId: string;
  provider: MeetingExternalLinkProvider;
  url: string;
  title: string;
  createdByUserId: string;
  createdAt: string;
  archivedAt: string | null;
};

export type MeetingNote = {
  id: string;
  tenantId: string;
  meetingId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  archivedAt: string | null;
};

export type MeetingActionItem = {
  id: string;
  tenantId: string;
  meetingId: string;
  title: string;
  ownerUserId: string;
  dueDate: string | null; // 'YYYY-MM-DD', НЕ ISO-datetime
  targetEntityType: MeetingActionTargetType;
  targetEntityId: string;
  status: MeetingActionItemStatus;
  createdByUserId: string;
  createdAt: string;
  archivedAt: string | null;
};

/* ---- УВЕДОМЛЕНИЯ ---- */
export type UserNotification = {
  id: string;
  tenantId: string;
  userId: string;
  notificationType: NotificationType;
  sourceEntityType: string; // свободная строка (источник может быть вне collaboration-сущностей)
  sourceEntityId: string;
  title: string;
  body: string;
  route: string;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
};

// raw, без Date-полей (не проходит через ISO-сериализатор).
export type NotificationPreference = {
  tenantId: string;
  userId: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  enabled: boolean;
  digestFrequency: DigestFrequency;
};

/* ---- Входные формы тел запросов ---- */
export type MessageMetadataInput = {
  links?: { entityType: string; entityId: string }[];
  attachmentIds?: string[];
};
export type PostMessageInput = { body?: string; stickerAssetId?: string; metadata?: MessageMetadataInput };
export type ChannelCreateInput = {
  channelType: "team" | "project_general" | "custom";
  title: string;
  description?: string | null;
  scopeEntityType?: "project" | "org_unit" | null;
  scopeEntityId?: string | null;
};
export type ChannelPatchInput = { title?: string; description?: string };
export type CallRoomCreateInput = {
  entityType: EntityType;
  entityId: string;
  title: string;
  provider: CallRoomProvider;
  mediaKind?: CallMediaKind;
  meetingId?: string | null;
  providerRoomId?: string | null;
};
export type MeetingCreateInput = {
  entityType: EntityType;
  entityId: string;
  title: string;
  agenda?: string;
  scheduledStart: string;
  scheduledFinish: string;
  participants?: { userId: string; role?: MeetingParticipantRole }[];
};
export type MeetingPatchInput = {
  title?: string;
  agenda?: string;
  scheduledStart?: string;
  scheduledFinish?: string;
  status?: MeetingStatus;
};
export type ActionItemInput = {
  title: string;
  ownerUserId: string;
  dueDate?: string | null;
  targetEntityType?: MeetingActionTargetType;
  targetEntityId?: string;
};
export type PreferenceInput = {
  channel: NotificationChannel;
  notificationType: NotificationType;
  enabled?: boolean;
  digestFrequency?: DigestFrequency;
};

export function createCommsClient(options: CommsApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = options.credentials ?? "include";

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${options.apiOrigin}${path}`, {
      ...init,
      credentials,
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", ...(init?.headers ?? {}) }
    });
    const rawText = await response.text();
    let body: Record<string, unknown> = {};
    if (rawText.length > 0) {
      try {
        const parsed: unknown = JSON.parse(rawText);
        body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { error: "invalid_json_response" };
      } catch {
        body = { error: "invalid_json_response" };
      }
    }
    if (!response.ok) {
      throw new CommsApiError(response.status, typeof body.error === "string" ? body.error : "request_failed", body);
    }
    return body as T;
  }

  const enc = encodeURIComponent;
  // Сборка query-строки из заданных параметров (через URLSearchParams), пустые опускаются.
  const qs = (params: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return {
    /* ===== ЧАТ (1-9) ===== */
    // 1) Беседы сущности (+ readState). Лениво гарантирует ≥1 default-беседу.
    listConversations(entityType: EntityType, entityId: string) {
      return requestJson<{ conversations: Conversation[] }>(`/api/workspace/conversations${qs({ entityType, entityId })}`);
    },
    // 1b) DM текущего пользователя (P4.2): беседы conversationType="direct" + memberUserIds + readState.
    listDirectConversations() {
      return requestJson<{ conversations: DirectConversation[] }>("/api/workspace/conversations/direct");
    },
    // 1c) Открыть/получить DM с пользователем (create-or-get по детерминированной паре).
    createDirectConversation(userId: string) {
      return requestJson<{ conversation: DirectConversationBase; memberUserIds: string[]; counterpartUserIds: string[] }>(
        "/api/workspace/conversations/direct",
        { method: "POST", body: JSON.stringify({ userId }) }
      );
    },
    // 1d) Снимок присутствия пользователей тенанта (P4.3): { userId: online|away|offline }.
    getPresence() {
      return requestJson<{ presence: Record<string, PresenceStatus> }>("/api/workspace/presence");
    },
    // 2) Сообщения беседы (обратная курсорная пагинация: nextCursor = первый элемент).
    listMessages(conversationId: string, params?: { limit?: number; cursor?: string }) {
      return requestJson<{ messages: Message[]; nextCursor: string | null }>(
        `/api/workspace/conversations/${enc(conversationId)}/messages${qs({ limit: params?.limit, cursor: params?.cursor })}`
      );
    },
    // 3) Создать сообщение (body ИЛИ stickerAssetId обязателен). Возвращает сообщение + порождённые упоминания.
    postMessage(conversationId: string, input: PostMessageInput) {
      return requestJson<{ message: Message; mentions: MessageMention[] }>(`/api/workspace/conversations/${enc(conversationId)}/messages`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    // 4) Редактировать сообщение (автор ИЛИ manage). Без reactions/stickers в ответе.
    editMessage(conversationId: string, messageId: string, input: { body: string; metadata?: MessageMetadataInput }) {
      return requestJson<{ message: Message }>(`/api/workspace/conversations/${enc(conversationId)}/messages/${enc(messageId)}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
    },
    // 5) Удалить сообщение (soft-delete: archivedAt). Автор ИЛИ manage.
    deleteMessage(conversationId: string, messageId: string) {
      return requestJson<{ message: Message }>(`/api/workspace/conversations/${enc(conversationId)}/messages/${enc(messageId)}`, {
        method: "DELETE"
      });
    },
    // 6) Поставить реакцию (upsert по userId+emoji). Только на НЕархивное сообщение.
    addReaction(conversationId: string, messageId: string, emoji: string) {
      return requestJson<{ reaction: Reaction }>(`/api/workspace/conversations/${enc(conversationId)}/messages/${enc(messageId)}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji })
      });
    },
    // 7) Снять реакцию (только свою; archive). Архивное сообщение допускается.
    removeReaction(conversationId: string, messageId: string, reactionId: string) {
      return requestJson<{ reaction: Reaction }>(
        `/api/workspace/conversations/${enc(conversationId)}/messages/${enc(messageId)}/reactions/${enc(reactionId)}`,
        { method: "DELETE" }
      );
    },
    // 8) Закрепить сообщение (manage проверяется ДО поиска сообщения; unpin-роута НЕТ).
    pinMessage(conversationId: string, messageId: string) {
      return requestJson<{ message: Message }>(`/api/workspace/conversations/${enc(conversationId)}/messages/${enc(messageId)}/pin`, {
        method: "POST"
      });
    },
    // 9) Отметить беседу прочитанной (unreadCount=0, lastRead*).
    markRead(conversationId: string) {
      return requestJson<{ readState: ConversationReadState }>(`/api/workspace/conversations/${enc(conversationId)}/read-state`, {
        method: "POST"
      });
    },

    /* ===== КАНАЛЫ (10-16) ===== */
    // 10) Список каналов (workspace_general всегда присутствует; фильтр по readDecision per-channel).
    listChannels(params?: { type?: CommunicationChannelType }) {
      return requestJson<{ channels: Channel[] }>(`/api/workspace/communication-channels${qs({ type: params?.type })}`);
    },
    // 11) Создать канал (workspace_general не создаётся). Создатель → owner-member авто.
    createChannel(input: ChannelCreateInput) {
      return requestJson<{ channel: Channel }>("/api/workspace/communication-channels", { method: "POST", body: JSON.stringify(input) });
    },
    // 12) Канал + участники.
    getChannel(channelId: string) {
      return requestJson<{ channel: Channel; members: ChannelMember[] }>(`/api/workspace/communication-channels/${enc(channelId)}`);
    },
    // 13) Редактировать канал (только title/description; ≥1 поле). channelType/scope не редактируемы.
    patchChannel(channelId: string, input: ChannelPatchInput) {
      return requestJson<{ channel: Channel }>(`/api/workspace/communication-channels/${enc(channelId)}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
    },
    // 14) Беседа канала (лениво ensure: entityType=communication_channel, entityId=channelId).
    getChannelConversation(channelId: string) {
      return requestJson<{ channel: Channel; conversation: Conversation }>(`/api/workspace/communication-channels/${enc(channelId)}/conversation`);
    },
    // 15) Добавить участника (upsert). role по умолчанию member.
    addChannelMember(channelId: string, input: { userId: string; role?: CommunicationChannelRole }) {
      return requestJson<{ member: ChannelMember }>(`/api/workspace/communication-channels/${enc(channelId)}/members`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    // 16) Удалить участника (soft-archive).
    removeChannelMember(channelId: string, userId: string) {
      return requestJson<{ member: ChannelMember }>(`/api/workspace/communication-channels/${enc(channelId)}/members/${enc(userId)}`, {
        method: "DELETE"
      });
    },

    /* ===== ЗВОНКИ (17-25) ===== */
    // 17) Комнаты звонков сущности.
    listCallRooms(entityType: EntityType, entityId: string) {
      return requestJson<{ callRooms: CallRoom[] }>(`/api/workspace/call-rooms${qs({ entityType, entityId })}`);
    },
    // 18) Создать комнату (status forced 'open'). Возвращает комнату + событие room_created.
    createCallRoom(input: CallRoomCreateInput) {
      return requestJson<{ callRoom: CallRoom; event: CallEvent }>("/api/workspace/call-rooms", { method: "POST", body: JSON.stringify(input) });
    },
    // 19) Комната + последние 50 событий + записи.
    getCallRoom(roomId: string) {
      return requestJson<{ callRoom: CallRoom; events: CallEvent[]; recordings: CallRecording[] }>(`/api/workspace/call-rooms/${enc(roomId)}`);
    },
    // 20) Стартовать сессию (room.status→active). Возвращает комнату + сессию + событие.
    startSession(roomId: string) {
      return requestJson<{ callRoom: CallRoom; session: CallSession; event: CallEvent }>(`/api/workspace/call-rooms/${enc(roomId)}/sessions/start`, {
        method: "POST"
      });
    },
    // 21) Получить join-token (READ-доступ). manual/jitsi: token=null; livekit: JWT.
    joinToken(roomId: string, sessionId: string) {
      return requestJson<{ join: VideoJoinContract; event: CallEvent }>(
        `/api/workspace/call-rooms/${enc(roomId)}/sessions/${enc(sessionId)}/join-token`,
        { method: "POST" }
      );
    },
    // 22) Обновить состояние участника (свой=read, чужой=manage).
    participantState(roomId: string, sessionId: string, input: { state: CallParticipantStateValue; userId?: string }) {
      return requestJson<{ participantState: CallParticipantState; event: CallEvent }>(
        `/api/workspace/call-rooms/${enc(roomId)}/sessions/${enc(sessionId)}/participant-state`,
        { method: "POST", body: JSON.stringify(input) }
      );
    },
    // 23) Завершить сессию (room.status→ended).
    endSession(roomId: string, sessionId: string) {
      return requestJson<{ callRoom: CallRoom; session: CallSession; event: CallEvent }>(
        `/api/workspace/call-rooms/${enc(roomId)}/sessions/${enc(sessionId)}/end`,
        { method: "POST" }
      );
    },
    // 24) Прикрепить запись (метаданная ссылка на attachment; lifecycle записи нет).
    addRecording(roomId: string, input: { attachmentId: string; title?: string; sessionId?: string | null }) {
      return requestJson<{ event: CallEvent; recording: CallRecording }>(`/api/workspace/call-rooms/${enc(roomId)}/recordings`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    // 25) Лента событий комнаты (limit def 50, clamp 1..100).
    listCallEvents(roomId: string, params?: { limit?: number }) {
      return requestJson<{ events: CallEvent[] }>(`/api/workspace/call-rooms/${enc(roomId)}/events${qs({ limit: params?.limit })}`);
    },

    /* ===== МИТИНГИ (26-31) ===== */
    // 26) Список митингов сущности (только Meeting-строки).
    listMeetings(entityType: EntityType, entityId: string) {
      return requestJson<{ meetings: Meeting[] }>(`/api/workspace/meetings${qs({ entityType, entityId })}`);
    },
    // GET деталь митинга (composite): участники/ноты/задачи/ссылки одним запросом.
    getMeeting(meetingId: string) {
      return requestJson<{
        meeting: Meeting;
        participants: MeetingParticipant[];
        notes: MeetingNote[];
        actionItems: MeetingActionItem[];
        externalLinks: MeetingExternalLink[];
      }>(`/api/workspace/meetings/${enc(meetingId)}`);
    },
    // 27) Создать митинг (organizer=actor авто accepted; meeting_invite каждому ≠ actor).
    createMeeting(input: MeetingCreateInput) {
      return requestJson<{ meeting: Meeting; participants: MeetingParticipant[] }>("/api/workspace/meetings", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    // 28) Обновить митинг (partial).
    patchMeeting(meetingId: string, input: MeetingPatchInput) {
      return requestJson<{ meeting: Meeting }>(`/api/workspace/meetings/${enc(meetingId)}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    // 29) Добавить внешнюю ссылку (zoom/teams/... + URL + title).
    addExternalLink(meetingId: string, input: { provider: MeetingExternalLinkProvider; url: string; title: string }) {
      return requestJson<{ externalLink: MeetingExternalLink }>(`/api/workspace/meetings/${enc(meetingId)}/external-links`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    // 30) Добавить заметку (участник ИЛИ manage).
    addNote(meetingId: string, body: string) {
      return requestJson<{ note: MeetingNote }>(`/api/workspace/meetings/${enc(meetingId)}/notes`, { method: "POST", body: JSON.stringify({ body }) });
    },
    // 31) Добавить action-item (status forced 'open'; meeting_action_item owner≠actor).
    addActionItem(meetingId: string, input: ActionItemInput) {
      return requestJson<{ actionItem: MeetingActionItem }>(`/api/workspace/meetings/${enc(meetingId)}/action-items`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    // Сменить статус action-item (open/done/cancelled).
    patchActionItem(meetingId: string, actionItemId: string, status: MeetingActionItemStatus) {
      return requestJson<{ actionItem: MeetingActionItem }>(`/api/workspace/meetings/${enc(meetingId)}/action-items/${enc(actionItemId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
    },

    /* ===== УВЕДОМЛЕНИЯ (32-35) ===== */
    // 32) Лента уведомлений (status: ''|unread|read; limit def 20, cap 100).
    listNotifications(params?: { status?: "unread" | "read"; limit?: number }) {
      return requestJson<{ notifications: UserNotification[] }>(`/api/workspace/notifications${qs({ status: params?.status, limit: params?.limit })}`);
    },
    // Счётчики непрочитанного для бейджей nav/comms (одним запросом).
    getUnreadSummary() {
      return requestJson<{ notifications: number; conversations: number }>("/api/workspace/unread-summary");
    },
    // 33) Отметить уведомление прочитанным (НЕ идемпотентно: readAt=now каждый раз).
    markNotificationRead(notificationId: string) {
      return requestJson<{ notification: UserNotification }>(`/api/workspace/notifications/${enc(notificationId)}/read`, { method: "POST" });
    },
    // 34) Получить настройки уведомлений (raw, без дат; дефолтов нет).
    getNotificationPreferences() {
      return requestJson<{ preferences: NotificationPreference[] }>("/api/workspace/notification-preferences");
    },
    // 35) Сохранить настройки (UPSERT; [] → ранний выход []). Возвращает полный re-list.
    putNotificationPreferences(preferences: PreferenceInput[]) {
      return requestJson<{ preferences: NotificationPreference[] }>("/api/workspace/notification-preferences", {
        method: "PUT",
        body: JSON.stringify({ preferences })
      });
    },

    /* ===== СПРАВОЧНИК ПОЛЬЗОВАТЕЛЕЙ ===== */
    // 36) Список пользователей тенанта (для @mentions, участников, ответственных, выбора участника канала).
    // Тот же боевой эндпойнт, что у workspace/CRM. В моке отдаётся COMMS_USERS.
    listUsers() {
      return requestJson<{ users: CommsUser[] }>("/api/workspace/users");
    }
  };
}

export type CommsClient = ReturnType<typeof createCommsClient>;
