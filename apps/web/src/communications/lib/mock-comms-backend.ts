/* ============================================================
   Contract-grounded mock backend для блока «Коммуникации» (Storybook).

   ЧЕСТНОСТЬ: in-memory мок, реализующий реальный REST-контракт
   /api/workspace/{conversations,communication-channels}. Компонент
   работает через настоящий createCommsClient (с fetchImpl), поэтому
   переключение на боевой API = смена apiOrigin.

   Этот слайс реализует ЧАТ (ручки 1-9) и КАНАЛЫ (10-16). Звонки/митинги/
   уведомления (кроме сид-уведомлений) НЕ реализованы — падают в общий
   404 fallback (досидит следующий агент). Сидовое mention-уведомление
   кладётся в store, чтобы лента уведомлений была непустой.

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
  parseCollaborationEntityType,
  parseCollaborationId,
  parseCommunicationChannelDescription,
  parseCommunicationChannelRole,
  parseCommunicationChannelType,
  parseConversationTitle,
  parseMessageBody,
  parseMessageReactionEmoji
} from "@kiss-pm/domain";

import type {
  Channel,
  ChannelMember,
  Conversation,
  ConversationReadState,
  Message,
  MessageMention,
  MessageSticker,
  Reaction,
  UserNotification
} from "./comms-client";

const TENANT = "tenant-alpha";
const CURRENT_ACTOR_ID = "u-anna"; // в проде actor сессии; в моке — фиксированный «текущий пользователь»

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
};

/* ---- RBAC-стаб (упрощён): actor=u-anna read+manage на demo-сущности и где owner ---- */
// read на сущность беседы: всегда true в демо (actor имеет доступ к demo-entity и каналам-членствам).
// 403-ветки зеркалят коды в комментариях, но не активируются на сид-данных (см. §8 п.5).
const canReadEntity = (_entityType: string, _entityId: string): boolean => true;
const canManageEntity = (_entityType: string, _entityId: string): boolean => true;

/* Доступ к каналу (зеркало resolveCommunicationChannelAccess, упрощён):
   read = workspace_general ИЛИ членство ИЛИ manage; manage = canManageCommunications(=true для actor)
   ИЛИ роль actor в канале owner/moderator. В демо actor — owner созданных каналов и сидового custom. */
const channelCanManage = (channelId: string, channelType: string, members: ChannelMember[]): boolean => {
  if (channelType === "workspace_general") return false; // системный канал не управляется
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

  /* --- Уведомления: сидовое mention от message-3 (точная RU-строка title) --- */
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
    }
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
    notifications
  };
}

/* ---- Транспорт: fetchImpl, совместимый с createCommsClient ---- */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (error: string, status: number) => json({ error }, status);

// Маршрут уведомления по типу сущности (зеркало routeForEntity боевого API).
const routeForEntity = (entityType: string, entityId: string): string => {
  const enc = encodeURIComponent(entityId);
  switch (entityType) {
    case "project":
      return `/projects/${enc}`;
    case "task":
      return `/tasks/${enc}`;
    case "opportunity":
      return `/crm/opportunities/${enc}`;
    case "client":
      return `/clients/${enc}`;
    case "contact":
      return `/contacts/${enc}`;
    case "product":
      return `/products/${enc}`;
    default:
      return `/communication-channels/${enc}`;
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
        canManage: false,
        createdByUserId: CURRENT_ACTOR_ID,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        archivedAt: null
      };
      db.channels.unshift(ch);
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
    const conv = db.conversations.find((c) => c.id === idParsed.value);
    if (!conv) return { ok: false, error: "conversation_not_found", status: 404 };
    // сущность беседы существует (в моке demo-сущности/каналы всегда есть) и читаема actor'ом.
    if (!canReadEntity(conv.entityType, conv.entityId)) return { ok: false, error: "permission_missing", status: 403 };
    return { ok: true, conversation: conv };
  };

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const fullPath = url.replace(/^https?:\/\/[^/]+/, "");
    const path = fullPath.split("?")[0]!;
    const query = new URLSearchParams(fullPath.includes("?") ? fullPath.slice(fullPath.indexOf("?") + 1) : "");

    // Тело: invalid_json ловим через try/catch (как mock-crm-backend; body-size коды опускаем — см. шапку).
    let body: Record<string, unknown> = {};
    if (init?.body) {
      try {
        const p: unknown = JSON.parse(String(init.body));
        if (p && typeof p === "object" && !Array.isArray(p)) body = p as Record<string, unknown>;
      } catch {
        return err("invalid_json", 400);
      }
    }

    /* ============================================================
       ЧАТ (1-9)
       ============================================================ */

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
      const conversations = db.conversations
        .filter((c) => c.entityType === typeParsed.value && c.entityId === idParsed.value)
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
      // Все сообщения беседы по времени (включая archived — soft-delete не исчезает).
      const all = db.messages.filter((m) => m.conversationId === resolved.conversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      // Обратная пагинация: берём ХВОСТ (самые свежие). cursor (если есть) — верхняя граница (исключительно): сообщения СТРОГО до него.
      let slice = all;
      if (cursorId) {
        const idx = all.findIndex((m) => m.id === cursorId);
        slice = idx >= 0 ? all.slice(0, idx) : all;
      }
      const page = slice.slice(Math.max(0, slice.length - limit));
      const messages = page.map(withExtras);
      const nextCursor = messages[0]?.id ?? null; // первый элемент страницы (обратная пагинация)
      return json({ messages, nextCursor });
    }

    /* 3) POST /conversations/:id/messages — создать (body|sticker обязателен; @mention→notification). */
    const msgCreate = method === "POST" ? path.match(/^\/api\/workspace\/conversations\/([^/]+)\/messages$/) : null;
    if (msgCreate) {
      const resolved = resolveConversation(msgCreate[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      // stickerAssetId (опц.): формат → существование.
      let stickerAsset: StickerAsset | null = null;
      if (body.stickerAssetId != null) {
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
        metadata: {}, // metadata.links/attachmentIds: невалидные молча отбрасываются — в моке упрощено до {}
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
        // 4) edit: body обязателен.
        const bodyParsed = parseMessageBody(body.body);
        if (!bodyParsed.ok) return err(bodyParsed.error, 400);
        message.body = bodyParsed.value;
        message.editedAt = nowIso();
        return json({ message });
      }
      // 5) delete: soft-delete (archivedAt).
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
      message.pinnedAt = nowIso();
      message.pinnedByUserId = CURRENT_ACTOR_ID;
      return json({ message });
    }

    /* 9) POST /conversations/:id/read-state — отметить прочитанным (unreadCount=0). */
    const readState = method === "POST" ? path.match(/^\/api\/workspace\/conversations\/([^/]+)\/read-state$/) : null;
    if (readState) {
      const resolved = resolveConversation(readState[1]!);
      if (!resolved.ok) return err(resolved.error, resolved.status);
      // Самое свежее сообщение беседы → lastReadMessageId.
      const last = db.messages
        .filter((m) => m.conversationId === resolved.conversation.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
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
      const channels = db.channels
        .filter((c) => c.archivedAt === null)
        .filter((c) => (typeRaw && typeRaw !== "" ? c.channelType === typeRaw : true))
        .filter((c) => channelCanRead(c.id, c.channelType)) // per-channel read (в демо все читаемы)
        .map(serializeChannel);
      return json({ channels });
    }

    /* 11) POST /communication-channels — создать (workspace_general не создаётся; создатель→owner). */
    if (method === "POST" && path === "/api/workspace/communication-channels") {
      // 403 permission_missing (canManageCommunications) — в демо actor имеет право (стаб).
      // Тело: type → not_creatable → title → description → scope.
      const typeParsed = parseCommunicationChannelType(body.channelType);
      if (!typeParsed.ok) return err(typeParsed.error, 400);
      if (typeParsed.value === "workspace_general") return err("communication_channel_type_not_creatable", 400);
      const titleParsed = parseConversationTitle(body.title); // reuse: channel title ≤180
      if (!titleParsed.ok) return err(titleParsed.error, 400); // conversation_title_required / _invalid
      const descParsed = parseCommunicationChannelDescription(body.description);
      if (!descParsed.ok) return err(descParsed.error, 400);
      // Scope: team→org_unit, project_general→project (+проверка существования), custom→опц (project|org_unit).
      const scopeTypeRaw = body.scopeEntityType;
      const scopeIdRaw = body.scopeEntityId;
      let scopeEntityType: "project" | "org_unit" | null = null;
      let scopeEntityId: string | null = null;
      if (typeParsed.value === "team" || typeParsed.value === "project_general") {
        if (scopeTypeRaw == null || scopeIdRaw == null || scopeIdRaw === "") return err("communication_channel_scope_required", 400);
        const expected = typeParsed.value === "team" ? "org_unit" : "project";
        if (scopeTypeRaw !== expected) return err("communication_channel_scope_type_invalid", 400);
        const sidParsed = parseCollaborationId(scopeIdRaw, "communication_channel_scope_required");
        if (!sidParsed.ok) return err(sidParsed.error, 400);
        scopeEntityType = expected;
        scopeEntityId = sidParsed.value;
        // project_general: проект должен существовать в тенанте (в моке известна только demo-сущность proj-portal).
        if (typeParsed.value === "project_general" && scopeEntityId !== DEMO_ENTITY.entityId) {
          return err("communication_channel_scope_not_found", 404);
        }
      } else if (scopeTypeRaw != null) {
        // custom: если scopeEntityType задан, должен быть project|org_unit.
        if (scopeTypeRaw !== "project" && scopeTypeRaw !== "org_unit") return err("communication_channel_scope_type_invalid", 400);
        scopeEntityType = scopeTypeRaw;
        if (scopeIdRaw != null && scopeIdRaw !== "") {
          const sidParsed = parseCollaborationId(scopeIdRaw, "communication_channel_scope_required");
          if (!sidParsed.ok) return err(sidParsed.error, 400);
          scopeEntityId = sidParsed.value;
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
      const ch = db.channels.find((c) => c.id === idParsed.value);
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
      const ch = db.channels.find((c) => c.id === idParsed.value);
      if (!ch) return err("communication_channel_not_found", 404);
      if (!channelCanManage(ch.id, ch.channelType, db.channelMembers)) return err("permission_missing", 403);
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

    /* 14) GET /communication-channels/:id/conversation — беседа канала (ensure). */
    const chConv = method === "GET" ? path.match(/^\/api\/workspace\/communication-channels\/([^/]+)\/conversation$/) : null;
    if (chConv) {
      const idParsed = parseCollaborationId(decodeURIComponent(chConv[1]!), "communication_channel_id_invalid");
      if (!idParsed.ok) return err(idParsed.error, 400);
      const ch = db.channels.find((c) => c.id === idParsed.value);
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
      const ch = db.channels.find((c) => c.id === idParsed.value);
      if (!ch) return err("communication_channel_not_found", 404);
      if (!channelCanManage(ch.id, ch.channelType, db.channelMembers)) return err("permission_missing", 403);
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
      const ch = db.channels.find((c) => c.id === idParsed.value);
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
       УВЕДОМЛЕНИЯ — read-only лента (исключение «сид-уведомлений», §E спеки).
       Реализована ТОЛЬКО GET /notifications, чтобы сид-mention и порождённые
       POST message уведомления были видны в ленте. Остальные ручки уведомлений
       (read/preferences) и звонки/митинги — у следующего агента (404 fallback).
       ============================================================ */
    /* 32) GET /notifications?status&limit — лента актора (self-scoped, archivedAt всегда null). */
    if (method === "GET" && path === "/api/workspace/notifications") {
      const statusRaw = query.get("status");
      if (statusRaw !== null && statusRaw !== "" && statusRaw !== "unread" && statusRaw !== "read") {
        return err("notification_status_invalid", 400);
      }
      // limit: def 20, cap 100, мусор → 20.
      const limitRaw = query.get("limit");
      let limit = 20;
      if (limitRaw !== null && limitRaw !== "") {
        const n = Number(limitRaw);
        if (Number.isInteger(n) && n >= 1) limit = Math.min(n, 100);
      }
      // Self-scoped: уведомления актора. В демо лента собирается для actor; сид-mention адресован u-ivan,
      // поэтому показываем уведомления всех известных пользователей (упрощение: один «текущий» просмотр).
      // Сорт createdAt DESC, id DESC. archivedAt всегда null (DB-фильтр isNull).
      let notifications = db.notifications
        .filter((n) => n.archivedAt === null)
        .filter((n) => (statusRaw === "unread" ? n.readAt === null : statusRaw === "read" ? n.readAt !== null : true))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      notifications = notifications.slice(0, limit);
      return json({ notifications });
    }

    /* ============================================================
       Звонки / митинги / уведомления (read/preferences) — НЕ реализованы
       в этом слайсе. Падают в общий 404 fallback (досидит следующий агент).
       ============================================================ */
    return err("not_found", 404);
  };

  return mockFetch;
}
