"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CommsApiError,
  createCommsClient,
  type ActionItemInput,
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
  type EntityType,
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

/* ============================================================
   Узкие хуки блока «Коммуникации» (зеркало use-crm, но раздельные хуки
   из-за entity-scoped модели). Каждый хук работает через настоящий
   createCommsClient поверх contract-mock (createMockCommsFetch).
   Переключение на боевой API = смена apiOrigin + удаление fetchImpl.

   Чат + каналы реализованы полностью (их мок готов). Звонки/митинги/
   уведомления типобезопасны (методы клиента есть), но их мок появится у
   следующего агента — рантайм-тестов на них в этом слайсе нет.
   ============================================================ */

export type CommsLoadStatus = "loading" | "ready" | "error";
export type CommsMutationResult = { ok: true } | { ok: false; code?: string; message: string };
// Результат мутации, ВОЗВРАЩАЮЩЕЙ данные для UI (например, join-token, action-item).
export type CommsDataResult<T> = { ok: true; data: T } | { ok: false; code?: string; message: string };

// Общий клиент/транспорт: один createMockCommsFetch на монтаж (изолированная сессия).
function useCommsClient() {
  const fetchRef = useRef<typeof fetch | null>(null);
  if (fetchRef.current === null) fetchRef.current = createMockCommsFetch();
  const clientRef = useRef<ReturnType<typeof createCommsClient> | null>(null);
  if (clientRef.current === null) clientRef.current = createCommsClient({ apiOrigin: "", fetchImpl: fetchRef.current });
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
  const [data, setData] = useState<ConversationData | null>(null);
  const [status, setStatus] = useState<CommsLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Загрузка сообщений выбранной беседы.
  const loadMessages = useCallback(
    async (conversationId: string) => {
      const res = await client.listMessages(conversationId);
      setData((d) => (d ? { ...d, selectedConversationId: conversationId, messages: res.messages, nextCursor: res.nextCursor } : d));
    },
    [client]
  );

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { conversations } = await client.listConversations(entityType, entityId);
      const first = conversations[0] ?? null;
      let messages: Message[] = [];
      let nextCursor: string | null = null;
      if (first) {
        const res = await client.listMessages(first.id);
        messages = res.messages;
        nextCursor = res.nextCursor;
      }
      setData({ conversations, selectedConversationId: first?.id ?? null, messages, nextCursor });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client, entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return { client, data, status, error, reload: load, selectConversation, reloadMessages, postMessage, editMessage, deleteMessage, addReaction, removeReaction, pinMessage, markRead };
}

/* ============================================================
   КАНАЛЫ: useChannels() — список + мутации.
   ============================================================ */
export function useChannels() {
  const client = useCommsClient();
  const { guard } = useGuard();
  const [data, setData] = useState<{ channels: Channel[] } | null>(null);
  const [status, setStatus] = useState<CommsLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { channels } = await client.listChannels();
      setData({ channels });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

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
  const [data, setData] = useState<ChannelDetail | null>(null);
  const [status, setStatus] = useState<CommsLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [detail, conv] = await Promise.all([client.getChannel(channelId), client.getChannelConversation(channelId)]);
      setData({ channel: detail.channel, members: detail.members, conversation: conv.conversation });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client, channelId]);

  useEffect(() => {
    void load();
  }, [load]);

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
  const [data, setData] = useState<{ callRooms: CallRoom[] } | null>(null);
  const [status, setStatus] = useState<CommsLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { callRooms } = await client.listCallRooms(entityType, entityId);
      setData({ callRooms });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client, entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

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
  const [data, setData] = useState<CallRoomDetail | null>(null);
  const [status, setStatus] = useState<CommsLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await client.getCallRoom(roomId);
      setData({ callRoom: res.callRoom, events: res.events, recordings: res.recordings });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

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
  const [data, setData] = useState<{ meetings: Meeting[] } | null>(null);
  const [status, setStatus] = useState<CommsLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { meetings } = await client.listMeetings(entityType, entityId);
      setData({ meetings });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client, entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return { client, data, status, error, reload: load, createMeeting, patchMeeting, addNote, addExternalLink, addActionItem };
}

/* ============================================================
   УВЕДОМЛЕНИЯ: useNotifications(status?) + useNotificationPreferences().
   Лента уведомлений работает (сид-уведомление есть); markRead/preferences
   используют методы клиента (мок для read/preferences — у следующего агента).
   ============================================================ */
export function useNotifications(filterStatus?: "unread" | "read") {
  const client = useCommsClient();
  const { guard } = useGuard();
  const [data, setData] = useState<{ notifications: UserNotification[] } | null>(null);
  const [status, setStatus] = useState<CommsLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { notifications } = await client.listNotifications(filterStatus ? { status: filterStatus } : undefined);
      setData({ notifications });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback((notificationId: string) => guard(async () => { await client.markNotificationRead(notificationId); await load(); }), [client, guard, load]);

  return { client, data, status, error, reload: load, markRead };
}

export function useNotificationPreferences() {
  const client = useCommsClient();
  const { guard } = useGuard();
  const [data, setData] = useState<{ preferences: NotificationPreference[] } | null>(null);
  const [status, setStatus] = useState<CommsLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { preferences } = await client.getNotificationPreferences();
      setData({ preferences });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePreferences = useCallback(
    (preferences: PreferenceInput[]) => guard(async () => { const r = await client.putNotificationPreferences(preferences); setData({ preferences: r.preferences }); }),
    [client, guard]
  );

  return { client, data, status, error, reload: load, savePreferences };
}
