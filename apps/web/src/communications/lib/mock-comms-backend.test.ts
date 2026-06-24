import { describe, it, expect } from "vitest";

import { CommsApiError, createCommsClient } from "./comms-client";
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

  it("неизвестная ручка (звонки/митинги) падает в общий 404 fallback", async () => {
    const c = client();
    await expect(c.listCallRooms("project", "proj-portal")).rejects.toBeInstanceOf(CommsApiError);
    await expect(c.listCallRooms("project", "proj-portal")).rejects.toMatchObject({ status: 404, code: "not_found" });
  });
});
