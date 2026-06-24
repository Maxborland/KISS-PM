import { describe, it, expect } from "vitest";

import { createCommsClient } from "./comms-client";
import { createMockCommsFetch } from "./mock-comms-backend";

function client() {
  return createCommsClient({ apiOrigin: "", fetchImpl: createMockCommsFetch() });
}

describe("contract-mock Comms backend — чат", () => {
  it("GET /conversations: ensure default-беседы + readState с unreadCount", async () => {
    const c = client();
    const { conversations } = await c.listConversations("project", "proj-portal");
    expect(conversations.length).toBeGreaterThanOrEqual(1);
    const portal = conversations.find((x) => x.id === "conversation-portal");
    expect(portal).toBeTruthy();
    expect(portal?.readState?.unreadCount).toBe(2);
  });

  it("GET /conversations для НОВОЙ сущности лениво создаёт default-беседу", async () => {
    const c = client();
    const { conversations } = await c.listConversations("task", "task-xyz");
    expect(conversations.length).toBe(1);
    expect(conversations[0]?.conversationType).toBe("default");
    expect(conversations[0]?.entityId).toBe("task-xyz");
  });

  it("GET /conversations: неизвестный тип сущности → 400 collaboration_entity_type_invalid", async () => {
    const c = client();
    await expect(c.listConversations("widget" as never, "x")).rejects.toMatchObject({ status: 400, code: "collaboration_entity_type_invalid" });
  });

  it("GET messages: обратная курсорная пагинация (nextCursor = первый элемент), reactions/stickers подтянуты", async () => {
    const c = client();
    const { messages, nextCursor } = await c.listMessages("conversation-portal");
    expect(messages.length).toBeGreaterThanOrEqual(6);
    // nextCursor = id первого (самого старого в странице) сообщения.
    expect(nextCursor).toBe(messages[0]?.id);
    const pinned = messages.find((m) => m.id === "message-1");
    expect(pinned?.reactions.length).toBe(2); // 👍 + 🎉
    const withSticker = messages.find((m) => m.id === "message-2");
    expect(withSticker?.stickers.length).toBe(1);
  });

  it("GET messages: limit ограничивает страницу, курсор отдаёт более старые", async () => {
    const c = client();
    const page1 = await c.listMessages("conversation-portal", { limit: 2 });
    expect(page1.messages.length).toBe(2);
    const page2 = await c.listMessages("conversation-portal", { limit: 2, cursor: page1.nextCursor! });
    expect(page2.messages.length).toBeGreaterThanOrEqual(1);
    // Страницы не пересекаются по id (cursor — верхняя граница исключительно).
    const ids1 = new Set(page1.messages.map((m) => m.id));
    expect(page2.messages.every((m) => !ids1.has(m.id))).toBe(true);
  });

  it("GET messages: некорректный :id → 400 conversation_id_invalid", async () => {
    const c = client();
    await expect(c.listMessages("bad/id")).rejects.toMatchObject({ status: 400, code: "conversation_id_invalid" });
  });

  it("GET messages: несуществующая беседа → 404 conversation_not_found", async () => {
    const c = client();
    await expect(c.listMessages("conversation-zzz")).rejects.toMatchObject({ status: 404, code: "conversation_not_found" });
  });

  it("POST message: текст обязателен → 400 message_body_required при пустом теле", async () => {
    const c = client();
    await expect(c.postMessage("conversation-portal", {})).rejects.toMatchObject({ status: 400, code: "message_body_required" });
  });

  it("POST message: @mention порождает уведомление mention", async () => {
    const c = client();
    await c.postMessage("conversation-portal", { body: "Привет @u-sergey, нужна помощь" });
    const { notifications } = await c.listNotifications();
    const mention = notifications.find((n) => n.userId === "u-sergey" && n.notificationType === "mention");
    expect(mention).toBeTruthy();
    expect(mention?.title).toBe("Вас упомянули");
  });

  it("POST message со стикером: тело необязательно (emoji подставляется); неизвестный стикер → 404", async () => {
    const c = client();
    const ok = await c.postMessage("conversation-portal", { stickerAssetId: "sticker-party" });
    expect(ok.message.body).toBe("🎉");
    expect(ok.message.stickers.length).toBe(1);
    await expect(c.postMessage("conversation-portal", { stickerAssetId: "sticker-zzz" })).rejects.toMatchObject({ status: 404, code: "sticker_asset_not_found" });
  });

  it("PATCH message: автор редактирует (editedAt проставляется)", async () => {
    const c = client();
    // message-1 — автор u-anna (=actor).
    const { message } = await c.editMessage("conversation-portal", "message-1", { body: "Обновлённый текст" });
    expect(message.body).toBe("Обновлённый текст");
    expect(message.editedAt).not.toBeNull();
  });

  it("DELETE message: soft-delete (archivedAt проставляется)", async () => {
    const c = client();
    const { message } = await c.deleteMessage("conversation-portal", "message-1");
    expect(message.archivedAt).not.toBeNull();
  });

  it("PATCH/DELETE message: несуществующее сообщение → 404 message_not_found", async () => {
    const c = client();
    await expect(c.editMessage("conversation-portal", "message-zzz", { body: "x" })).rejects.toMatchObject({ status: 404, code: "message_not_found" });
    await expect(c.deleteMessage("conversation-portal", "message-zzz")).rejects.toMatchObject({ status: 404, code: "message_not_found" });
  });

  it("POST reaction: добавляет (upsert), невалидный emoji → 400, на archived-сообщение → 404", async () => {
    const c = client();
    const { reaction } = await c.addReaction("conversation-portal", "message-2", "🔥");
    expect(reaction.emoji).toBe("🔥");
    // upsert: повтор той же реакции не плодит дубль (тот же id).
    const again = await c.addReaction("conversation-portal", "message-2", "🔥");
    expect(again.reaction.id).toBe(reaction.id);
    await expect(c.addReaction("conversation-portal", "message-2", "не эмодзи")).rejects.toMatchObject({ status: 400, code: "message_reaction_emoji_invalid" });
    // message-6 заархивировано в сиде → POST reaction → 404.
    await expect(c.addReaction("conversation-portal", "message-6", "👍")).rejects.toMatchObject({ status: 404, code: "message_not_found" });
  });

  it("DELETE reaction: снимает свою (own-scope); чужая → 404 reaction_not_found", async () => {
    const c = client();
    const { reaction } = await c.addReaction("conversation-portal", "message-2", "🚀");
    const removed = await c.removeReaction("conversation-portal", "message-2", reaction.id);
    expect(removed.reaction.archivedAt).not.toBeNull();
    // reaction-1 принадлежит u-ivan (не actor) → снять нельзя.
    await expect(c.removeReaction("conversation-portal", "message-1", "reaction-1")).rejects.toMatchObject({ status: 404, code: "reaction_not_found" });
  });

  it("POST pin: закрепляет сообщение (manage)", async () => {
    const c = client();
    const { message } = await c.pinMessage("conversation-portal", "message-2");
    expect(message.pinnedAt).not.toBeNull();
    expect(message.pinnedByUserId).toBe("u-anna");
  });

  it("POST read-state: обнуляет unreadCount и проставляет lastRead*", async () => {
    const c = client();
    const before = (await c.listConversations("project", "proj-portal")).conversations.find((x) => x.id === "conversation-portal");
    expect(before?.readState?.unreadCount).toBe(2);
    const { readState } = await c.markRead("conversation-portal");
    expect(readState.unreadCount).toBe(0);
    expect(readState.lastReadMessageId).not.toBeNull();
    const after = (await c.listConversations("project", "proj-portal")).conversations.find((x) => x.id === "conversation-portal");
    expect(after?.readState?.unreadCount).toBe(0);
  });
});

describe("contract-mock Comms backend — каналы", () => {
  it("GET channels: workspace_general всегда присутствует + сидовые каналы", async () => {
    const c = client();
    const { channels } = await c.listChannels();
    expect(channels.some((x) => x.channelType === "workspace_general")).toBe(true);
    expect(channels.find((x) => x.id === "channel-team")?.title).toBe("Команда портала");
    expect(channels.find((x) => x.id === "channel-project")?.channelType).toBe("project_general");
  });

  it("GET channels?type: фильтр по типу; невалидный тип → 400", async () => {
    const c = client();
    const { channels } = await c.listChannels({ type: "custom" });
    expect(channels.every((x) => x.channelType === "custom")).toBe(true);
    await expect(c.listChannels({ type: "bogus" as never })).rejects.toMatchObject({ status: 400, code: "communication_channel_type_invalid" });
  });

  it("POST channel: создаёт custom-канал (создатель → owner)", async () => {
    const c = client();
    const { channel } = await c.createChannel({ channelType: "custom", title: "Новый канал" });
    expect(channel.channelType).toBe("custom");
    expect(channel.canManage).toBe(true);
    const detail = await c.getChannel(channel.id);
    expect(detail.members.find((m) => m.userId === "u-anna")?.role).toBe("owner");
  });

  it("POST channel: workspace_general не создаётся → 400 communication_channel_type_not_creatable", async () => {
    const c = client();
    await expect(c.createChannel({ channelType: "workspace_general" as never, title: "X" })).rejects.toMatchObject({ status: 400, code: "communication_channel_type_not_creatable" });
  });

  it("POST channel: пустой title → 400 conversation_title_required", async () => {
    const c = client();
    await expect(c.createChannel({ channelType: "custom", title: "" })).rejects.toMatchObject({ status: 400, code: "conversation_title_required" });
  });

  it("POST channel: team требует scope org_unit → scope_required / scope_type_invalid", async () => {
    const c = client();
    await expect(c.createChannel({ channelType: "team", title: "Команда" })).rejects.toMatchObject({ status: 400, code: "communication_channel_scope_required" });
    await expect(c.createChannel({ channelType: "team", title: "Команда", scopeEntityType: "project", scopeEntityId: "org-x" })).rejects.toMatchObject({ status: 400, code: "communication_channel_scope_type_invalid" });
    const ok = await c.createChannel({ channelType: "team", title: "Команда", scopeEntityType: "org_unit", scopeEntityId: "org-x" });
    expect(ok.channel.scopeEntityType).toBe("org_unit");
  });

  it("POST channel: project_general с несуществующим проектом → 404 communication_channel_scope_not_found", async () => {
    const c = client();
    await expect(
      c.createChannel({ channelType: "project_general", title: "Проект X", scopeEntityType: "project", scopeEntityId: "proj-zzz" })
    ).rejects.toMatchObject({ status: 404, code: "communication_channel_scope_not_found" });
    const ok = await c.createChannel({ channelType: "project_general", title: "Портал", scopeEntityType: "project", scopeEntityId: "proj-portal" });
    expect(ok.channel.scopeEntityId).toBe("proj-portal");
  });

  it("GET channel/:id: канал + участники; некорректный id → 400; неизвестный → 404", async () => {
    const c = client();
    const detail = await c.getChannel("channel-team");
    expect(detail.channel.id).toBe("channel-team");
    expect(detail.members.length).toBeGreaterThanOrEqual(2);
    await expect(c.getChannel("bad/id")).rejects.toMatchObject({ status: 400, code: "communication_channel_id_invalid" });
    await expect(c.getChannel("channel-zzz")).rejects.toMatchObject({ status: 404, code: "communication_channel_not_found" });
  });

  it("PATCH channel: редактирует title/description; пустой patch → 400 communication_channel_patch_empty", async () => {
    const c = client();
    const { channel } = await c.patchChannel("channel-team", { title: "Команда (обновл.)" });
    expect(channel.title).toBe("Команда (обновл.)");
    await expect(c.patchChannel("channel-team", {})).rejects.toMatchObject({ status: 400, code: "communication_channel_patch_empty" });
  });

  it("members add/remove: upsert участника и soft-archive; неизвестный пользователь → 404", async () => {
    const c = client();
    const { member } = await c.addChannelMember("channel-team", { userId: "u-maria", role: "moderator" });
    expect(member.role).toBe("moderator");
    await expect(c.addChannelMember("channel-team", { userId: "u-ghost" })).rejects.toMatchObject({ status: 404, code: "tenant_user_not_found" });
    const removed = await c.removeChannelMember("channel-team", "u-maria");
    expect(removed.member.archivedAt).not.toBeNull();
    // повторное удаление уже архивного → 404 channel_member_not_found.
    await expect(c.removeChannelMember("channel-team", "u-maria")).rejects.toMatchObject({ status: 404, code: "channel_member_not_found" });
  });

  it("GET channel/:id/conversation: лениво создаёт беседу канала (entityType=communication_channel)", async () => {
    const c = client();
    const { channel, conversation } = await c.getChannelConversation("channel-coffee");
    expect(channel.id).toBe("channel-coffee");
    expect(conversation.entityType).toBe("communication_channel");
    expect(conversation.entityId).toBe("channel-coffee");
    expect(conversation.conversationType).toBe("default");
  });

  it("совсем неизвестная ручка падает в общий 404 fallback", async () => {
    const c = client();
    // несуществующий путь (через прямой fetch, минуя клиент) → 404 not_found.
    const fetchImpl = createMockCommsFetch();
    const res = await fetchImpl("/api/workspace/does-not-exist");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });
});

describe("contract-mock Comms backend — звонки", () => {
  it("GET /call-rooms: комнаты сущности (сидовые open/active/ended; serializer roomId)", async () => {
    const c = client();
    const { callRooms } = await c.listCallRooms("project", "proj-portal");
    expect(callRooms.length).toBe(3);
    const standup = callRooms.find((r) => r.roomId === "call-room-standup");
    expect(standup?.status).toBe("open");
    // serializer: roomId присутствует, providerRoomId/tenantId/archivedAt омичены.
    expect(standup).not.toHaveProperty("id");
    expect(standup).not.toHaveProperty("providerRoomId");
    expect(callRooms.find((r) => r.roomId === "call-room-live")?.status).toBe("active");
  });

  it("POST /call-rooms: status forced 'open' + событие room_created", async () => {
    const c = client();
    const { callRoom, event } = await c.createCallRoom({ entityType: "project", entityId: "proj-portal", title: "Новый звонок", provider: "jitsi" });
    expect(callRoom.status).toBe("open");
    expect(callRoom.mediaKind).toBe("video"); // дефолт
    expect(event.eventType).toBe("room_created");
  });

  it("POST /call-rooms: конфликт providerRoomId → 409 call_room_provider_room_conflict", async () => {
    const c = client();
    await expect(
      c.createCallRoom({ entityType: "project", entityId: "proj-portal", title: "Дубль", provider: "jitsi", providerRoomId: "portal-standup" })
    ).rejects.toMatchObject({ status: 409, code: "call_room_provider_room_conflict" });
  });

  it("POST /call-rooms: невалидный provider → 400 call_room_provider_invalid", async () => {
    const c = client();
    await expect(
      c.createCallRoom({ entityType: "project", entityId: "proj-portal", title: "X", provider: "zoom" as never })
    ).rejects.toMatchObject({ status: 400, code: "call_room_provider_invalid" });
  });

  it("GET /call-rooms/:id: комната + события + записи; неизвестная → 404", async () => {
    const c = client();
    const detail = await c.getCallRoom("call-room-live");
    expect(detail.callRoom.roomId).toBe("call-room-live");
    expect(detail.events.length).toBeGreaterThanOrEqual(2); // created + started
    expect(Array.isArray(detail.recordings)).toBe(true);
    await expect(c.getCallRoom("call-room-zzz")).rejects.toMatchObject({ status: 404, code: "call_room_not_found" });
  });

  it("POST sessions/start: повторный старт active-комнаты → 409 call_room_already_active", async () => {
    const c = client();
    // call-room-live уже active в сиде.
    await expect(c.startSession("call-room-live")).rejects.toMatchObject({ status: 409, code: "call_room_already_active" });
    // call-room-standup открыта → старт ок.
    const started = await c.startSession("call-room-standup");
    expect(started.session.status).toBe("active");
    expect(started.callRoom.status).toBe("active");
    expect(started.event.eventType).toBe("session_started");
  });

  it("POST join-token: jitsi → token=null + joinUrl; provider mismatch → 409 video_provider_misconfigured", async () => {
    const c = client();
    const { join, event } = await c.joinToken("call-room-live", "call-session-live");
    expect(join.provider).toBe("jitsi");
    expect(join.token).toBeNull();
    expect(join.expiresAt).toBeNull();
    expect(join.joinUrl).toContain("portal-live");
    expect(event.eventType).toBe("join_token_issued");
    // livekit-комната при MOCK_VIDEO_PROVIDER=jitsi → 409.
    const lk = await c.createCallRoom({ entityType: "project", entityId: "proj-portal", title: "LK", provider: "livekit" });
    const lkSession = await c.startSession(lk.callRoom.roomId);
    await expect(c.joinToken(lk.callRoom.roomId, lkSession.session.id)).rejects.toMatchObject({ status: 409, code: "video_provider_misconfigured" });
  });

  it("POST participant-state: свой ok; невалидный state → 400", async () => {
    const c = client();
    const { participantState, event } = await c.participantState("call-room-live", "call-session-live", { state: "joined" });
    expect(participantState.state).toBe("joined");
    expect(participantState.userId).toBe("u-anna");
    expect(event.eventType).toBe("participant_joined");
    await expect(
      c.participantState("call-room-live", "call-session-live", { state: "dancing" as never })
    ).rejects.toMatchObject({ status: 400, code: "call_participant_state_invalid" });
  });

  it("POST sessions/end: завершает; повтор → 409 call_session_not_active", async () => {
    const c = client();
    const ended = await c.endSession("call-room-live", "call-session-live");
    expect(ended.session.status).toBe("ended");
    expect(ended.callRoom.status).toBe("ended");
    expect(ended.event.eventType).toBe("session_ended");
    await expect(c.endSession("call-room-live", "call-session-live")).rejects.toMatchObject({ status: 409, code: "call_session_not_active" });
  });

  it("POST recordings: прикрепляет запись + событие recording_attached", async () => {
    const c = client();
    const { recording, event } = await c.addRecording("call-room-live", { attachmentId: "att-1", title: "Запись созвона" });
    expect(recording.attachmentId).toBe("att-1");
    expect(recording.title).toBe("Запись созвона");
    expect(event.eventType).toBe("recording_attached");
    // запись видна в детали комнаты.
    const detail = await c.getCallRoom("call-room-live");
    expect(detail.recordings.some((r) => r.id === recording.id)).toBe(true);
  });

  it("GET /call-rooms/:id/events?limit: лента событий, limit ограничивает", async () => {
    const c = client();
    const { events } = await c.listCallEvents("call-room-live", { limit: 1 });
    expect(events.length).toBe(1);
    const all = await c.listCallEvents("call-room-live");
    expect(all.events.length).toBeGreaterThanOrEqual(2);
  });
});

describe("contract-mock Comms backend — митинги", () => {
  it("GET /meetings: митинги сущности (scheduled + completed)", async () => {
    const c = client();
    const { meetings } = await c.listMeetings("project", "proj-portal");
    expect(meetings.length).toBe(2);
    expect(meetings.find((m) => m.id === "meeting-kickoff")?.status).toBe("scheduled");
    expect(meetings.find((m) => m.id === "meeting-retro")?.status).toBe("completed");
  });

  it("POST /meetings: создаёт (organizer accepted) + побочка meeting_invite каждому ≠ actor", async () => {
    const c = client();
    const { meeting, participants } = await c.createMeeting({
      entityType: "project",
      entityId: "proj-portal",
      title: "Планёрка",
      agenda: "Повестка",
      scheduledStart: "2026-07-01T10:00:00.000Z",
      scheduledFinish: "2026-07-01T11:00:00.000Z",
      participants: [{ userId: "u-ivan" }, { userId: "u-sergey", role: "optional" }]
    });
    expect(meeting.status).toBe("scheduled");
    const organizer = participants.find((p) => p.userId === "u-anna");
    expect(organizer?.role).toBe("organizer");
    expect(organizer?.response).toBe("accepted");
    expect(participants.find((p) => p.userId === "u-ivan")?.response).toBe("pending");
    // meeting_invite порождён для u-ivan/u-sergey.
    const { notifications } = await c.listNotifications();
    expect(notifications.some((n) => n.userId === "u-ivan" && n.notificationType === "meeting_invite" && n.title === "Новая встреча")).toBe(true);
  });

  it("POST /meetings: finish ≤ start → 400 meeting_schedule_invalid", async () => {
    const c = client();
    await expect(
      c.createMeeting({ entityType: "project", entityId: "proj-portal", title: "X", scheduledStart: "2026-07-01T11:00:00.000Z", scheduledFinish: "2026-07-01T10:00:00.000Z" })
    ).rejects.toMatchObject({ status: 400, code: "meeting_schedule_invalid" });
  });

  it("POST /meetings: >50 участников → 400 meeting_participants_too_many", async () => {
    const c = client();
    const many = Array.from({ length: 51 }, (_, i) => ({ userId: `u-${i}` }));
    await expect(
      c.createMeeting({ entityType: "project", entityId: "proj-portal", title: "X", scheduledStart: "2026-07-01T10:00:00.000Z", scheduledFinish: "2026-07-01T11:00:00.000Z", participants: many })
    ).rejects.toMatchObject({ status: 400, code: "meeting_participants_too_many" });
  });

  it("PATCH /meetings/:id: обновляет status; невалидный status → 400", async () => {
    const c = client();
    const { meeting } = await c.patchMeeting("meeting-kickoff", { status: "completed" });
    expect(meeting.status).toBe("completed");
    await expect(c.patchMeeting("meeting-kickoff", { status: "bogus" as never })).rejects.toMatchObject({ status: 400, code: "meeting_status_invalid" });
  });

  it("POST external-link: приватный хост → 400 external_url_private_host; ок для публичного", async () => {
    const c = client();
    await expect(
      c.addExternalLink("meeting-kickoff", { provider: "zoom", url: "http://127.0.0.1/internal", title: "Внутр." })
    ).rejects.toMatchObject({ status: 400, code: "external_url_private_host" });
    const { externalLink } = await c.addExternalLink("meeting-kickoff", { provider: "teams", url: "https://teams.microsoft.com/l/meetup/abc", title: "Teams" });
    expect(externalLink.provider).toBe("teams");
  });

  it("POST note: участник может добавить (ДО body); невалидное тело → 400", async () => {
    const c = client();
    // actor u-anna — организатор kickoff (участник).
    const { note } = await c.addNote("meeting-kickoff", "Новая заметка");
    expect(note.body).toBe("Новая заметка");
    await expect(c.addNote("meeting-kickoff", "")).rejects.toMatchObject({ status: 400, code: "meeting_note_body_required" });
  });

  it("POST action-item: target дефолтит на entity (project) + status forced 'open'", async () => {
    const c = client();
    const { actionItem } = await c.addActionItem("meeting-kickoff", { title: "Задача без target", ownerUserId: "u-sergey" });
    expect(actionItem.status).toBe("open");
    expect(actionItem.targetEntityType).toBe("project");
    expect(actionItem.targetEntityId).toBe("proj-portal");
    // owner ≠ actor → meeting_action_item уведомление.
    const { notifications } = await c.listNotifications();
    expect(notifications.some((n) => n.userId === "u-sergey" && n.notificationType === "meeting_action_item")).toBe(true);
  });

  it("POST action-item: невалидный dueDate → 400 meeting_action_due_date_invalid", async () => {
    const c = client();
    await expect(
      c.addActionItem("meeting-kickoff", { title: "X", ownerUserId: "u-anna", dueDate: "2026-13-40" })
    ).rejects.toMatchObject({ status: 400, code: "meeting_action_due_date_invalid" });
  });
});

describe("contract-mock Comms backend — уведомления", () => {
  it("GET /notifications: status-фильтр (unread/read) + limit", async () => {
    const c = client();
    const all = await c.listNotifications();
    expect(all.notifications.length).toBeGreaterThanOrEqual(4);
    const unread = await c.listNotifications({ status: "unread" });
    expect(unread.notifications.every((n) => n.readAt === null)).toBe(true);
    const read = await c.listNotifications({ status: "read" });
    expect(read.notifications.every((n) => n.readAt !== null)).toBe(true);
    const limited = await c.listNotifications({ limit: 1 });
    expect(limited.notifications.length).toBe(1);
    // сорт createdAt DESC: archivedAt всегда null.
    expect(all.notifications.every((n) => n.archivedAt === null)).toBe(true);
  });

  it("GET /notifications: невалидный status → 400 notification_status_invalid", async () => {
    const c = client();
    await expect(c.listNotifications({ status: "archived" as never })).rejects.toMatchObject({ status: 400, code: "notification_status_invalid" });
  });

  it("POST :id/read: проставляет readAt; чужое/нет → 404 notification_not_found", async () => {
    const c = client();
    // notification-meeting-invite-seed принадлежит u-anna (actor).
    const { notification } = await c.markNotificationRead("notification-meeting-invite-seed");
    expect(notification.readAt).not.toBeNull();
    // сид-mention принадлежит u-ivan → для actor невидим → 404.
    await expect(c.markNotificationRead("notification-mention-seed")).rejects.toMatchObject({ status: 404, code: "notification_not_found" });
    await expect(c.markNotificationRead("notification-zzz")).rejects.toMatchObject({ status: 404, code: "notification_not_found" });
  });

  it("GET preferences: сидовые настройки (сорт channel ASC, type ASC, raw без дат)", async () => {
    const c = client();
    const { preferences } = await c.getNotificationPreferences();
    expect(preferences.length).toBe(4);
    // сорт channel ASC: digest < email < in_app.
    expect(preferences[0]?.channel).toBe("digest");
    expect(preferences.every((p) => !("createdAt" in p))).toBe(true);
  });

  it("PUT preferences: UPSERT (не replace-all) + полный re-list; [] → ранний выход []", async () => {
    const c = client();
    // [] не трогает стор.
    const empty = await c.putNotificationPreferences([]);
    expect(empty.preferences).toEqual([]);
    const stillThere = await c.getNotificationPreferences();
    expect(stillThere.preferences.length).toBe(4);
    // upsert одной существующей пары (in_app/mention) + новой пары.
    const { preferences } = await c.putNotificationPreferences([
      { channel: "in_app", notificationType: "mention", enabled: false },
      { channel: "email", notificationType: "control_signal", digestFrequency: "daily" }
    ]);
    // полный re-list: старые пары не удалены (UPSERT).
    expect(preferences.length).toBe(5);
    expect(preferences.find((p) => p.channel === "in_app" && p.notificationType === "mention")?.enabled).toBe(false);
    expect(preferences.find((p) => p.channel === "email" && p.notificationType === "control_signal")?.digestFrequency).toBe("daily");
  });

  it("PUT preferences: >100 → too_many; невалидный channel/type/digest → 400", async () => {
    const c = client();
    const many = Array.from({ length: 101 }, () => ({ channel: "in_app" as const, notificationType: "mention" as const }));
    await expect(c.putNotificationPreferences(many)).rejects.toMatchObject({ status: 400, code: "notification_preferences_too_many" });
    await expect(c.putNotificationPreferences([{ channel: "sms" as never, notificationType: "mention" }])).rejects.toMatchObject({ status: 400, code: "notification_channel_invalid" });
    await expect(c.putNotificationPreferences([{ channel: "in_app", notificationType: "boom" as never }])).rejects.toMatchObject({ status: 400, code: "notification_type_invalid" });
    await expect(
      c.putNotificationPreferences([{ channel: "in_app", notificationType: "mention", digestFrequency: "hourly" as never }])
    ).rejects.toMatchObject({ status: 400, code: "digest_frequency_invalid" });
  });
});
