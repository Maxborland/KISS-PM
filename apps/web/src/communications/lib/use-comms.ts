"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  CommsApiError,
  createCommsClient,
  type ActionItemInput,
  type CommsUser,
  type MeetingActionItemStatus,
  type CallEvent,
  type CallParticipantStateValue,
  type CallRecording,
  type CallRoom,
  type CallRoomCreateInput,
  type CallSession,
  type Channel,
  type ChannelCreateInput,
  type ChannelMember,
  type ChannelPatchInput,
  type CommunicationChannelRole,
  type CommunicationChannelType,
  type Conversation,
  type DirectConversation,
  type EntityType,
  type PresenceStatus,
  type Meeting,
  type MeetingCreateInput,
  type MeetingExternalLinkProvider,
  type MeetingPatchInput,
  type Message,
  type MessageMetadataInput,
  type NotificationPreference,
  type PostMessageInput,
  type PreferenceInput,
  type UserNotification,
  type VideoJoinContract
} from "./comms-client";
import { createMockCommsFetch } from "./mock-comms-backend";
import { useCommsRuntime } from "./comms-runtime";

/* ============================================================
   Узкие хуки блока «Коммуникации» (зеркало use-crm, но раздельные хуки
   из-за entity-scoped модели). Каждый хук работает через настоящий
   createCommsClient поверх contract-mock (createMockCommsFetch).
   Переключение на боевой API = смена apiOrigin + удаление fetchImpl.

   Чат + каналы реализованы полностью (их мок готов). Звонки/митинги/
   уведомления типобезопасны (методы клиента есть), но их мок появится у
   следующего агента — рантайм-тестов на них в этом слайсе нет.
   ============================================================ */

// forbidden — РЕАЛЬНОЕ состояние: при 403 (permission_missing) от боевого RBAC.
// На текущем contract-mock RBAC-стаб (canReadEntity/…) отдаёт true, поэтому 403
// на сид-данных не активируется; ветка проведена честно и сработает на боевом API
// (apiOrigin) или при ужесточении стаба — поверхностям менять ничего не нужно.
export type CommsLoadStatus = "loading" | "ready" | "error" | "forbidden";
export type CommsMutationResult = { ok: true } | { ok: false; code?: string; message: string };
// Результат мутации, ВОЗВРАЩАЮЩЕЙ данные для UI (например, join-token, action-item).
export type CommsDataResult<T> = { ok: true; data: T } | { ok: false; code?: string; message: string };

/* ============================================================
   Общий load-state хелпер для 7 хуков блока «Коммуникации».
   Инкапсулирует data/status/error + загрузку с разводкой 403→forbidden,
   чтобы не дублировать try/catch и проводку forbidden в каждом хуке.
   ============================================================ */
export type CommsLoadState<T> = {
  data: T | null;
  status: CommsLoadStatus;
  error: string | null;
  setData: Dispatch<SetStateAction<T | null>>;
  reload: () => Promise<void>;
};

function useCommsLoad<T>(fetcher: () => Promise<T>): CommsLoadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<CommsLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const next = await fetcher();
      setData(next);
      setStatus("ready");
      setError(null);
    } catch (e) {
      // 403 (permission_missing) → forbidden; прочие ошибки → error. error хранит код.
      if (e instanceof CommsApiError && e.status === 403) {
        setStatus("forbidden");
        setError(e.code);
        return;
      }
      setStatus("error");
      setError(e instanceof CommsApiError ? e.code : e instanceof Error ? e.message : "load_failed");
    }
  }, [fetcher]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, status, error, setData, reload };
}

// Общий клиент/транспорт. Два режима транспорта (см. CommsRuntimeProvider):
//  • mock  — ОДИН createMockCommsFetch на весь модуль (общий in-memory стор). Раньше каждый
//    хук строил свой стор → канал/комната, созданные родительским useChannels()/useCallRooms(),
//    не были видны детальным useChannel()/useCallRoom() (getChannel(newId) → channel_not_found):
//    create-then-open ломался. Поэтому все хуки делят ОДИН мок-клиент.
//  • live — боевой createCommsClient без fetchImpl: fetch на /api/workspace/* (next.config-прокси
//    в Hono), credentials:"include" → cookie-сессия. Один общий live-клиент (стора нет — состояние
//    на сервере), та же причина «один клиент»: согласованность между списком и деталью.
// Singletons держим на уровне модуля, чтобы все хуки одного режима делили клиент. Режим фиксируется
// провайдером на монтаж (live не меняется в рамках дерева), поэтому выбор один раз в ref безопасен.
let sharedMockClient: ReturnType<typeof createCommsClient> | null = null;
let sharedLiveClient: ReturnType<typeof createCommsClient> | null = null;
function getSharedMockClient(): ReturnType<typeof createCommsClient> {
  if (sharedMockClient === null) sharedMockClient = createCommsClient({ apiOrigin: "", fetchImpl: createMockCommsFetch() });
  return sharedMockClient;
}
function getSharedLiveClient(): ReturnType<typeof createCommsClient> {
  if (sharedLiveClient === null) sharedLiveClient = createCommsClient({ apiOrigin: "" });
  return sharedLiveClient;
}

function useCommsClient() {
  const { live } = useCommsRuntime();
  const clientRef = useRef<ReturnType<typeof createCommsClient> | null>(null);
  if (clientRef.current === null) clientRef.current = live ? getSharedLiveClient() : getSharedMockClient();
  return clientRef.current;
}

// Обёртка мутации: CommsApiError → {ok:false, code, message}.
function useGuard() {
  const guard = useCallback(async (fn: () => Promise<void>): Promise<CommsMutationResult> => {
    try {
      await fn();
      return { ok: true };
    } catch (e) {
      if (e instanceof CommsApiError) return { ok: false, code: e.code, message: e.code };
      return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
    }
  }, []);
  // как guard, но возвращает данные мутации для UI.
  const guardData = useCallback(async <T,>(fn: () => Promise<T>): Promise<CommsDataResult<T>> => {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (e) {
      if (e instanceof CommsApiError) return { ok: false, code: e.code, message: e.code };
      return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
    }
  }, []);
  return { guard, guardData };
}

/* ============================================================
   ЧАТ: useConversation(entityType, entityId)
   Беседы сущности + сообщения ВЫБРАННОЙ беседы + мутации.
   ============================================================ */
export type ConversationData = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  messages: Message[];
  nextCursor: string | null;
};

export function useConversation(entityType: EntityType, entityId: string) {
  const client = useCommsClient();
  const { guard, guardData } = useGuard();

  // fetcher для общего load-state: беседы сущности + сообщения первой беседы.
  const fetcher = useCallback(async (): Promise<ConversationData> => {
    const { conversations } = await client.listConversations(entityType, entityId);
    const first = conversations[0] ?? null;
    let messages: Message[] = [];
    let nextCursor: string | null = null;
    if (first) {
      const res = await client.listMessages(first.id);
      messages = res.messages;
      nextCursor = res.nextCursor;
    }
    return { conversations, selectedConversationId: first?.id ?? null, messages, nextCursor };
  }, [client, entityType, entityId]);
  const { data, status, error, setData, reload: load } = useCommsLoad(fetcher);

  // Загрузка сообщений выбранной беседы.
  const loadMessages = useCallback(
    async (conversationId: string) => {
      const res = await client.listMessages(conversationId);
      setData((d) => (d ? { ...d, selectedConversationId: conversationId, messages: res.messages, nextCursor: res.nextCursor } : d));
    },
    [client, setData]
  );

  const selectConversation = useCallback((conversationId: string) => guard(async () => { await loadMessages(conversationId); }), [guard, loadMessages]);
  const reloadMessages = useCallback(() => guard(async () => { const id = data?.selectedConversationId; if (id) await loadMessages(id); }), [guard, loadMessages, data?.selectedConversationId]);

  const postMessage = useCallback(
    (conversationId: string, input: PostMessageInput) => guard(async () => { await client.postMessage(conversationId, input); await loadMessages(conversationId); }),
    [client, guard, loadMessages]
  );
  const editMessage = useCallback(
    (conversationId: string, messageId: string, input: { body: string; metadata?: MessageMetadataInput }) =>
      guard(async () => { await client.editMessage(conversationId, messageId, input); await loadMessages(conversationId); }),
    [client, guard, loadMessages]
  );
  const deleteMessage = useCallback(
    (conversationId: string, messageId: string) => guard(async () => { await client.deleteMessage(conversationId, messageId); await loadMessages(conversationId); }),
    [client, guard, loadMessages]
  );
  const addReaction = useCallback(
    (conversationId: string, messageId: string, emoji: string) => guard(async () => { await client.addReaction(conversationId, messageId, emoji); await loadMessages(conversationId); }),
    [client, guard, loadMessages]
  );
  const removeReaction = useCallback(
    (conversationId: string, messageId: string, reactionId: string) => guard(async () => { await client.removeReaction(conversationId, messageId, reactionId); await loadMessages(conversationId); }),
    [client, guard, loadMessages]
  );
  const pinMessage = useCallback(
    (conversationId: string, messageId: string) => guard(async () => { await client.pinMessage(conversationId, messageId); await loadMessages(conversationId); }),
    [client, guard, loadMessages]
  );
  const unpinMessage = useCallback(
    (conversationId: string, messageId: string) => guard(async () => { await client.unpinMessage(conversationId, messageId); await loadMessages(conversationId); }),
    [client, guard, loadMessages]
  );
  const markRead = useCallback(
    (conversationId: string) => guard(async () => {
      await client.markRead(conversationId);
      // Обнуляем unreadCount в локальном кэше беседы (readState может отсутствовать).
      setData((d) =>
        d
          ? {
              ...d,
              conversations: d.conversations.map((c) =>
                c.id === conversationId && c.readState ? { ...c, readState: { ...c.readState, unreadCount: 0 } } : c
              )
            }
          : d
      );
    }),
    [client, guard]
  );

  return { client, data, status, error, reload: load, selectConversation, reloadMessages, postMessage, editMessage, deleteMessage, addReaction, removeReaction, pinMessage, unpinMessage, markRead };
}

/* ============================================================
   КАНАЛЫ: useChannels() — список + мутации.
   ============================================================ */
export function useChannels() {
  const client = useCommsClient();
  const { guard } = useGuard();

  const fetcher = useCallback(async (): Promise<{ channels: Channel[] }> => {
    const { channels } = await client.listChannels();
    return { channels };
  }, [client]);
  const { data, status, error, setData, reload: load } = useCommsLoad(fetcher);

  const createChannel = useCallback(
    (input: ChannelCreateInput) => guard(async () => { const r = await client.createChannel(input); setData((d) => (d ? { ...d, channels: [...d.channels, r.channel] } : d)); }),
    [client, guard]
  );

  return { client, data, status, error, reload: load, createChannel };
}

/* ============================================================
   КАНАЛ: useChannel(channelId) — канал + участники + беседа + мутации.
   ============================================================ */
export type ChannelDetail = { channel: Channel; members: ChannelMember[]; conversation: Conversation | null };

export function useChannel(channelId: string) {
  const client = useCommsClient();
  const { guard } = useGuard();

  const fetcher = useCallback(async (): Promise<ChannelDetail> => {
    const [detail, conv] = await Promise.all([client.getChannel(channelId), client.getChannelConversation(channelId)]);
    return { channel: detail.channel, members: detail.members, conversation: conv.conversation };
  }, [client, channelId]);
  const { data, status, error, setData, reload: load } = useCommsLoad(fetcher);

  const patchChannel = useCallback(
    (input: ChannelPatchInput) => guard(async () => { const r = await client.patchChannel(channelId, input); setData((d) => (d ? { ...d, channel: r.channel } : d)); }),
    [client, guard, channelId]
  );
  const addMember = useCallback(
    (input: { userId: string; role?: CommunicationChannelRole }) => guard(async () => { await client.addChannelMember(channelId, input); await load(); }),
    [client, guard, channelId, load]
  );
  const removeMember = useCallback(
    (userId: string) => guard(async () => { await client.removeChannelMember(channelId, userId); await load(); }),
    [client, guard, channelId, load]
  );

  return { client, data, status, error, reload: load, patchChannel, addMember, removeMember };
}

/* ============================================================
   ЗВОНКИ: useCallRooms(entityType, entityId) + useCallRoom(roomId).
   Мок появится у следующего агента — здесь только типобезопасные хуки.
   ============================================================ */
export function useCallRooms(entityType: EntityType, entityId: string) {
  const client = useCommsClient();
  const { guard } = useGuard();

  const fetcher = useCallback(async (): Promise<{ callRooms: CallRoom[] }> => {
    const { callRooms } = await client.listCallRooms(entityType, entityId);
    return { callRooms };
  }, [client, entityType, entityId]);
  const { data, status, error, setData, reload: load } = useCommsLoad(fetcher);

  const createRoom = useCallback(
    (input: CallRoomCreateInput) => guard(async () => { const r = await client.createCallRoom(input); setData((d) => (d ? { ...d, callRooms: [r.callRoom, ...d.callRooms] } : d)); }),
    [client, guard]
  );

  return { client, data, status, error, reload: load, createRoom };
}

export type CallRoomDetail = { callRoom: CallRoom; events: CallEvent[]; recordings: CallRecording[] };

export function useCallRoom(roomId: string) {
  const client = useCommsClient();
  const { guard, guardData } = useGuard();

  const fetcher = useCallback(async (): Promise<CallRoomDetail> => {
    const res = await client.getCallRoom(roomId);
    return { callRoom: res.callRoom, events: res.events, recordings: res.recordings };
  }, [client, roomId]);
  const { data, status, error, reload: load } = useCommsLoad(fetcher);

  const startSession = useCallback((): Promise<CommsDataResult<CallSession>> => guardData(async () => { const r = await client.startSession(roomId); await load(); return r.session; }), [client, guardData, roomId, load]);
  const joinToken = useCallback((sessionId: string): Promise<CommsDataResult<VideoJoinContract>> => guardData(async () => { const r = await client.joinToken(roomId, sessionId); return r.join; }), [client, guardData, roomId]);
  const participantState = useCallback(
    (sessionId: string, input: { state: CallParticipantStateValue; userId?: string }) => guard(async () => { await client.participantState(roomId, sessionId, input); await load(); }),
    [client, guard, roomId, load]
  );
  const endSession = useCallback((sessionId: string) => guard(async () => { await client.endSession(roomId, sessionId); await load(); }), [client, guard, roomId, load]);
  const addRecording = useCallback(
    (input: { attachmentId: string; title?: string; sessionId?: string | null }) => guard(async () => { await client.addRecording(roomId, input); await load(); }),
    [client, guard, roomId, load]
  );

  return { client, data, status, error, reload: load, startSession, joinToken, participantState, endSession, addRecording };
}

/* ============================================================
   МИТИНГИ: useMeetings(entityType, entityId) + мутации.
   Мок появится у следующего агента.
   ============================================================ */
export function useMeetings(entityType: EntityType, entityId: string) {
  const client = useCommsClient();
  const { guard } = useGuard();

  const fetcher = useCallback(async (): Promise<{ meetings: Meeting[] }> => {
    const { meetings } = await client.listMeetings(entityType, entityId);
    return { meetings };
  }, [client, entityType, entityId]);
  const { data, status, error, setData, reload: load } = useCommsLoad(fetcher);

  const createMeeting = useCallback(
    (input: MeetingCreateInput) => guard(async () => { const r = await client.createMeeting(input); setData((d) => (d ? { ...d, meetings: [r.meeting, ...d.meetings] } : d)); }),
    [client, guard]
  );
  const patchMeeting = useCallback(
    (meetingId: string, input: MeetingPatchInput) => guard(async () => { const r = await client.patchMeeting(meetingId, input); setData((d) => (d ? { ...d, meetings: d.meetings.map((m) => (m.id === meetingId ? r.meeting : m)) } : d)); }),
    [client, guard]
  );
  const addNote = useCallback((meetingId: string, noteBody: string) => guard(async () => { await client.addNote(meetingId, noteBody); }), [client, guard]);
  const addExternalLink = useCallback(
    (meetingId: string, input: { provider: MeetingExternalLinkProvider; url: string; title: string }) => guard(async () => { await client.addExternalLink(meetingId, input); }),
    [client, guard]
  );
  const addActionItem = useCallback((meetingId: string, input: ActionItemInput) => guard(async () => { await client.addActionItem(meetingId, input); }), [client, guard]);
  const patchActionItem = useCallback((meetingId: string, actionItemId: string, status: MeetingActionItemStatus) => guard(async () => { await client.patchActionItem(meetingId, actionItemId, status); }), [client, guard]);

  return { client, data, status, error, reload: load, createMeeting, patchMeeting, addNote, addExternalLink, addActionItem, patchActionItem };
}

// Детали выбранной встречи (участники/ноты/задачи/ссылки) из GET /api/workspace/meetings/:id.
// Рефетч при смене meetingId; reload() — после мутаций. null id → пусто (без запроса).
export function useMeetingDetail(meetingId: string | null) {
  const client = useCommsClient();
  const fetcher = useCallback(
    () => (meetingId ? client.getMeeting(meetingId) : Promise.resolve(null)),
    [client, meetingId]
  );
  return useCommsLoad(fetcher);
}

/* ============================================================
   УВЕДОМЛЕНИЯ: useNotifications(status?) + useNotificationPreferences().
   Лента уведомлений работает (сид-уведомление есть); markRead/preferences
   используют методы клиента (мок для read/preferences — у следующего агента).
   ============================================================ */
// Счётчики непрочитанного для бейджей comms-frame/топбара (GET /api/workspace/unread-summary).
export function useUnreadSummary() {
  const client = useCommsClient();
  const fetcher = useCallback(() => client.getUnreadSummary(), [client]);
  return useCommsLoad(fetcher);
}

/* ============================================================
   usePresence — присутствие пользователей (P4.3).
   Начальный снимок = GET /api/workspace/presence; live-переходы применяются
   через apply() (вызывается из useWorkspaceRealtime onPresence). status(id)
   удобный геттер (неизвестный → offline).
   ============================================================ */
export function usePresence() {
  const client = useCommsClient();
  const [map, setMap] = useState<Record<string, PresenceStatus>>({});

  useEffect(() => {
    let active = true;
    void client.getPresence().then((r) => { if (active) setMap(r.presence); }).catch(() => { if (active) setMap({}); });
    return () => { active = false; };
  }, [client]);

  const apply = useCallback((userId: string, status: PresenceStatus) => {
    setMap((current) => ({ ...current, [userId]: status }));
  }, []);
  const status = useCallback((userId: string | null): PresenceStatus => (userId ? map[userId] ?? "offline" : "offline"), [map]);

  return { map, apply, status };
}

/* ============================================================
   useDirectMessages — DM-список текущего пользователя (P4.2).
   list = GET /conversations/direct; open(userId) = POST /conversations/direct
   (create-or-get) → возвращает id DM для выбора в чате.
   ============================================================ */
export function useDirectMessages() {
  const client = useCommsClient();
  const fetcher = useCallback(
    async (): Promise<{ conversations: DirectConversation[] }> => client.listDirectConversations(),
    [client]
  );
  const { data, status, error, reload } = useCommsLoad(fetcher);

  const open = useCallback(
    async (userId: string): Promise<string | null> => {
      try {
        const result = await client.createDirectConversation(userId);
        await reload();
        return result.conversation.id;
      } catch {
        return null;
      }
    },
    [client, reload]
  );

  return { data, status, error, reload, open };
}

export function useNotifications(filterStatus?: "unread" | "read") {
  const client = useCommsClient();
  const { guard } = useGuard();

  const fetcher = useCallback(async (): Promise<{ notifications: UserNotification[] }> => {
    const { notifications } = await client.listNotifications(filterStatus ? { status: filterStatus } : undefined);
    return { notifications };
  }, [client, filterStatus]);
  const { data, status, error, reload: load } = useCommsLoad(fetcher);

  const markRead = useCallback((notificationId: string) => guard(async () => { await client.markNotificationRead(notificationId); await load(); }), [client, guard, load]);

  return { client, data, status, error, reload: load, markRead };
}

export function useNotificationPreferences() {
  const client = useCommsClient();
  const { guard } = useGuard();

  const fetcher = useCallback(async (): Promise<{ preferences: NotificationPreference[] }> => {
    const { preferences } = await client.getNotificationPreferences();
    return { preferences };
  }, [client]);
  const { data, status, error, setData, reload: load } = useCommsLoad(fetcher);

  const savePreferences = useCallback(
    (preferences: PreferenceInput[]) => guard(async () => { const r = await client.putNotificationPreferences(preferences); setData({ preferences: r.preferences }); }),
    [client, guard]
  );

  return { client, data, status, error, reload: load, savePreferences };
}

/* ============================================================
   СПРАВОЧНИК ПОЛЬЗОВАТЕЛЕЙ: useCommsUsers().
   mock = COMMS_USERS (мок отдаёт сид по тому же пути), live = GET /api/workspace/users.
   Возвращает { list, byId, name } — зеркало useWorkspaceUsers. name() резолвит id→имя
   с честным фолбэком на сам id (как comms-bits.userName), чтобы неизвестные боевые id
   деградировали мягко. Список — для выбора участника канала/встречи/ответственного.
   ============================================================ */
export function useCommsUsers() {
  const client = useCommsClient();
  const [list, setList] = useState<CommsUser[]>([]);
  useEffect(() => {
    let active = true;
    void client.listUsers().then((r) => { if (active) setList(r.users); }).catch(() => { if (active) setList([]); });
    return () => { active = false; };
  }, [client]);
  return useMemo(() => {
    const byId = new Map(list.map((u) => [u.id, u]));
    return { list, byId, name: (id: string | null): string => (id ? byId.get(id)?.name ?? id : "—") };
  }, [list]);
}
export type CommsUsersDir = ReturnType<typeof useCommsUsers>;
