"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCheck, MoreHorizontal, Pencil, Pin, Send, Smile, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { CommsFrame } from "@/communications/ui/comms-frame";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { useCommsUsers, useConversation, useDirectMessages, usePresence, type CommsUsersDir } from "@/communications/lib/use-comms";
import { useWorkspaceRealtime } from "@/communications/lib/use-realtime";
import { useCommsRuntime } from "@/communications/lib/comms-runtime";
import { useCommsEntityScope, type CommsScopeState } from "@/communications/lib/entity-scope";
import { avatarColor, commsErr, initials, PresenceDot, relTime, UnreadDot } from "@/communications/lib/comms-bits";
import type { Conversation, DirectConversation, EntityType, Message, PresenceStatus, Reaction } from "@/communications/lib/comms-client";

/* ============================================================
   Поверхность ЧАТ блока «Коммуникации».
   Двухпанель: слева — беседы проекта-scope (WithCommsEntityScope),
   справа — лента сообщений выбранной беседы + композер.
   Работает на useConversation (createCommsClient поверх in-memory мока).
   ============================================================ */

// Текущий пользователь: live → id из сессии (/api/auth/me), иначе прототипный u-anna (mock).
// Через контекст — чтобы вложенные ChatPane/MessageBubble определяли «свои» реакции/авторство
// по РЕАЛЬНОМУ пользователю, а не по захардкоженному актору.
const SelfUserContext = createContext<string>("u-anna");
function useSelfUserId(live: boolean): string {
  const [id, setId] = useState("u-anna");
  useEffect(() => {
    if (!live) return;
    let active = true;
    void fetch("/api/auth/me", { credentials: "include", headers: { "x-kiss-pm-action": "same-origin" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: { id?: unknown } } | null) => { if (active && typeof d?.user?.id === "string") setId(d.user.id); })
      .catch(() => {});
    return () => { active = false; };
  }, [live]);
  return id;
}

// Сид-стикеры (StickerAsset не отдаётся клиентом отдельным методом — берём из сид-набора).
const STICKERS: { id: string; emoji: string; title: string }[] = [
  { id: "sticker-thumbsup", emoji: "👍", title: "Палец вверх" },
  { id: "sticker-party", emoji: "🎉", title: "Праздник" }
];
const stickerEmoji = (id: string): string => STICKERS.find((s) => s.id === id)?.emoji ?? "🏷️";

// Быстрые реакции для попапа под сообщением.
const QUICK_EMOJI = ["👍", "🎉", "❤️", "🔥", "👀", "✅"];

// Scope сущности резолвится из реальных проектов воркспейса (WithCommsEntityScope);
// явные entityType/entityId пропсы (встраивание, тесты) отключают резолв.
export function ChatSurface({ entityType, entityId }: { entityType?: EntityType; entityId?: string } = {}) {
  // Ревью PR #224: DM — НЕ проектная ось. Проектный scope не гейтит чат целиком:
  // без прав на проекты / без проектов личные сообщения остаются доступными,
  // состояние scope показывает только левая проектная секция.
  const scopeState = useCommsEntityScope({
    ...(entityType ? { explicitEntityType: entityType } : {}),
    ...(entityId ? { explicitEntityId: entityId } : {})
  });
  return <ChatSurfaceScoped scopeState={scopeState} />;
}

function ChatSurfaceScoped({ scopeState }: { scopeState: CommsScopeState }) {
  const scope = scopeState.scope;
  // Без scope useConversation работает в DM-only режиме (пустой entityId → без сети).
  const conv = useConversation(scope?.entityType ?? "project", scope?.entityId ?? "");
  const { data, status, error, reload, selectConversation } = conv;
  // Справочник людей тенанта (имена авторов): mock=COMMS_USERS, live=GET /api/workspace/users.
  const users = useCommsUsers();
  // P4.2 DM: список личных бесед текущего пользователя (отдельная ось от бесед сущности).
  const dm = useDirectMessages();
  // P4.3 presence: статусы пользователей (initial GET + live presence.changed).
  const presence = usePresence();
  // Текущий пользователь из сессии (live) — для «своих» реакций/авторства.
  const { live } = useCommsRuntime();
  const me = useSelfUserId(live);

  // P4.1/P4.3 realtime: в live-режиме сообщение/присутствие прилетают push'ем (SSE).
  // onMessage → перечитываем ленту; onPresence → обновляем карту присутствия. В mock — no-op.
  useWorkspaceRealtime({
    conversationId: data?.selectedConversationId ?? null,
    onMessage: () => { void conv.reloadMessages(); },
    onPresence: (event) => presence.apply(event.userId, event.status)
  });

  // Верхнеуровневый статус поверхности: forbidden (403) / error / loading / ready.
  // (ВЛОЖЕННЫЙ EmptyState «Нет бесед» — НЕ top-level: остаётся внутри ready-разметки.)
  const surfaceStatus = surfaceStatusOf(status, Boolean(data));
  // selected ищем и среди бесед сущности, и среди DM (DM адаптируем к Conversation: title = имя собеседника).
  const selectedDm = dm.data?.conversations.find((c) => c.id === data?.selectedConversationId) ?? null;
  const selected: Conversation | null =
    data?.conversations.find((c) => c.id === data?.selectedConversationId) ??
    (selectedDm ? adaptDmToConversation(selectedDm, users) : null);

  return (
    <SelfUserContext.Provider value={me}>
    <CommsFrame activeTab="Чат" subtitle={`Беседы · ${scope?.title ?? "Личные сообщения"}`} {...(scope?.picker ? { actions: scope.picker } : {})}>
      <div className="flex flex-col gap-3">
        {!live ? <PrototypeBanner /> : null}
        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={commsErr}
          loadingLabel="Загрузка чата…"
          forbidden={{ title: "Нет доступа к беседам", description: "У вас нет прав на просмотр коммуникаций этой сущности." }}
        >
          {data ? (
            <div className="grid min-h-0 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col gap-3">
                {scope ? (
                  <ConversationList
                    conversations={data.conversations}
                    selectedId={data.selectedConversationId}
                    onSelect={(id) => void selectConversation(id)}
                  />
                ) : (
                  <ProjectScopeStatePanel state={scopeState} />
                )}
                <DirectMessageList
                  dms={dm.data?.conversations ?? []}
                  users={users}
                  presenceOf={presence.status}
                  selectedId={data.selectedConversationId}
                  onSelect={(id) => void selectConversation(id)}
                  onOpen={async (userId) => {
                    const id = await dm.open(userId);
                    if (id) void selectConversation(id);
                  }}
                />
              </div>
              {selected ? (
                <ChatPane key={selected.id} conv={conv} conversation={selected} messages={data.messages} users={users} presenceOf={presence.status} />
              ) : (
                <div className="grid min-h-[480px] place-items-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)]">
                  {scope ? (
                    <EmptyState title="Нет бесед" description="У этой сущности пока нет бесед." />
                  ) : (
                    <EmptyState title="Личные сообщения" description="Выберите личную беседу слева или начните новую." />
                  )}
                </div>
              )}
            </div>
          ) : (
            <span />
          )}
        </SurfaceState>
      </div>
    </CommsFrame>
    </SelfUserContext.Provider>
  );
}

// Честный баннер «Прототип»: реальные ручки + in-memory + про realtime.
// Двойной замок: вызов гейтится !live, сам компонент — флагом (Storybook включает его в main.ts).
function PrototypeBanner() {
  if (!prototypeNotesEnabled) return null;
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
      <span>
        Реальный контракт: /api/workspace/conversations (беседы сущности + readState), .../messages (отправка, правка, удаление, реакции, закрепление), .../read-state (прочитано). Данные in-memory. Realtime-доставка появится в приложении; здесь лента обновляется по действию.
      </span>
    </div>
  );
}

// СЛЕВА (вместо списка бесед проекта, когда scope недоступен): состояние резолва
// проектов — DM-панель ниже живёт независимо от прав на проекты (ревью PR #224).
function ProjectScopeStatePanel({ state }: { state: CommsScopeState }) {
  const text =
    state.status === "loading"
      ? "Определяем проект…"
      : state.status === "forbidden"
        ? "Нет доступа к проектам: беседы проектов скрыты, личные сообщения доступны ниже."
        : state.status === "error"
          ? commsErr(state.error ?? undefined)
          : "Пока нет проектов. Как только появится проект, здесь откроются его беседы.";
  return (
    <aside className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">
        Беседы
      </div>
      <p className="px-3 py-3 text-[length:var(--text-xs)] text-[var(--muted)]">{text}</p>
      {state.status === "error" ? (
        <button
          type="button"
          onClick={() => void state.reload()}
          className="mx-3 mb-3 self-start rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-1 text-[length:var(--text-xs)] text-[var(--muted-strong)] hover:bg-[var(--panel-strong)]"
        >
          Повторить
        </button>
      ) : null}
    </aside>
  );
}

// СЛЕВА: список бесед сущности (title + UnreadDot по readState.unreadCount).
function ConversationList({
  conversations,
  selectedId,
  onSelect
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="flex min-h-[480px] flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">
        Беседы
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        {conversations.map((c) => {
          const active = c.id === selectedId;
          const unread = c.readState?.unreadCount ?? 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-transparent hover:border-[var(--border)] hover:bg-[var(--panel-subtle)]"
              )}
            >
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[length:var(--text-sm)] font-medium", active ? "text-[var(--accent-text)]" : "text-[var(--text-strong)]")}>
                  {c.title}
                </span>
                {c.archivedAt ? <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">в архиве</span> : null}
              </span>
              <UnreadDot count={unread} />
            </button>
          );
        })}
        {conversations.length === 0 ? (
          <p className="px-1 py-4 text-center text-[length:var(--text-xs)] text-[var(--muted-soft)]">Бесед пока нет.</p>
        ) : null}
      </div>
    </aside>
  );
}

// Имя собеседника(ов) DM (counterpartUserIds → имена).
function dmTitle(dmConv: DirectConversation, users: CommsUsersDir): string {
  const names = dmConv.counterpartUserIds.map((id) => users.name(id));
  return names.length > 0 ? names.join(", ") : "Личные сообщения";
}

// Адаптация DM к Conversation для ChatPane (title = имя собеседника; entityType/conversationType — cast).
function adaptDmToConversation(dmConv: DirectConversation, users: CommsUsersDir): Conversation {
  return {
    id: dmConv.id,
    tenantId: dmConv.tenantId,
    entityType: dmConv.entityType as Conversation["entityType"],
    entityId: dmConv.entityId,
    conversationType: dmConv.conversationType as Conversation["conversationType"],
    title: dmTitle(dmConv, users),
    createdByUserId: dmConv.createdByUserId,
    createdAt: dmConv.createdAt,
    archivedAt: dmConv.archivedAt,
    readState: dmConv.readState
  };
}

// СЛЕВА (ниже бесед сущности): личные сообщения (DM) + кнопка «новый DM».
function DirectMessageList({
  dms,
  users,
  presenceOf,
  selectedId,
  onSelect,
  onOpen
}: {
  dms: DirectConversation[];
  users: CommsUsersDir;
  presenceOf: (userId: string | null) => PresenceStatus;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (userId: string) => void;
}) {
  return (
    <aside className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Личные сообщения</span>
        <NewDirectPicker users={users} onOpen={onOpen} />
      </div>
      <div className="flex flex-col gap-1 p-2">
        {dms.map((c) => {
          const active = c.id === selectedId;
          const unread = c.readState?.unreadCount ?? 0;
          const name = dmTitle(c, users);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-transparent hover:border-[var(--border)] hover:bg-[var(--panel-subtle)]"
              )}
            >
              <span className="relative inline-flex shrink-0">
                <BemAvatar initials={initials(name)} color={avatarColor(c.counterpartUserIds[0] ?? c.id)} size="sm" title={name} />
                <PresenceDot status={presenceOf(c.counterpartUserIds[0] ?? null)} className="absolute -bottom-0.5 -right-0.5" />
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-[length:var(--text-sm)] font-medium", active ? "text-[var(--accent-text)]" : "text-[var(--text-strong)]")}>
                {name}
              </span>
              <UnreadDot count={unread} />
            </button>
          );
        })}
        {dms.length === 0 ? (
          <p className="px-1 py-4 text-center text-[length:var(--text-xs)] text-[var(--muted-soft)]">Личных бесед пока нет.</p>
        ) : null}
      </div>
    </aside>
  );
}

// Пикер «новый DM»: выбор пользователя → create-or-get DM.
function NewDirectPicker({ users, onOpen }: { users: CommsUsersDir; onOpen: (userId: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title="Новое личное сообщение">
          <Send className="size-3.5" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[220px] p-1">
        <div className="flex flex-col">
          {users.list.length === 0 ? (
            <p className="px-2 py-3 text-center text-[length:var(--text-xs)] text-[var(--muted-soft)]">Нет пользователей.</p>
          ) : (
            users.list.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => { onOpen(u.id); setOpen(false); }}
                className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-left text-[length:var(--text-sm)] text-[var(--text-strong)] hover:bg-[var(--panel-subtle)]"
              >
                <BemAvatar initials={initials(u.name)} color={avatarColor(u.id)} size="sm" />
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// СПРАВА: лента сообщений + pinned-баннер + композер.
function ChatPane({
  conv,
  conversation,
  messages,
  users,
  presenceOf
}: {
  conv: ReturnType<typeof useConversation>;
  conversation: Conversation;
  messages: Message[];
  users: CommsUsersDir;
  presenceOf: (userId: string | null) => PresenceStatus;
}) {
  const me = useContext(SelfUserContext);
  const [busy, setBusy] = useState(false);
  const cid = conversation.id;
  const unread = conversation.readState?.unreadCount ?? 0;

  // Лента в хронологическом порядке (мок отдаёт обратную курсорную пагинацию — переворачиваем).
  const ordered = useMemo(() => [...messages].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)), [messages]);
  const pinned = useMemo(() => ordered.filter((m) => m.pinnedAt && !m.archivedAt), [ordered]);

  // Автопрокрутка ленты вниз при смене набора сообщений.
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [ordered.length, cid]);

  // Авто-отметка «прочитано» при наличии непрочитанных (realtime в проде; здесь по входу в беседу).
  const readRef = useRef<string | null>(null);
  useEffect(() => {
    if (unread > 0 && readRef.current !== cid) {
      readRef.current = cid;
      void conv.markRead(cid);
    }
  }, [unread, cid, conv]);

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; code?: string; message: string }>, okMsg?: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      if (okMsg) toast.success(okMsg);
    } else {
      toast.error(`Отклонено: ${commsErr(res.code, res.message)}`);
    }
  };

  // Тоггл реакции по своему userId (ME): есть своя — снять, иначе — поставить.
  const toggleReaction = (m: Message, emoji: string) => {
    const mine = m.reactions.find((r) => r.userId === me && r.emoji === emoji && !r.archivedAt);
    if (mine) void run(() => conv.removeReaction(cid, m.id, mine.id));
    else void run(() => conv.addReaction(cid, m.id, emoji));
  };

  return (
    <section className="flex min-h-[480px] flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      {/* Шапка беседы */}
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-[length:var(--text-sm)] font-bold text-[var(--text-strong)]">{conversation.title}</h2>
          {/* Сырой entityId — dev-подсказка, только в Storybook/демо (рядом уже есть название беседы). */}
          <p className="truncate text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{ordered.length} сообщ.{prototypeNotesEnabled ? <> · {conversation.entityId}</> : null}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || unread === 0}
          onClick={() => void run(() => conv.markRead(cid), "Беседа отмечена прочитанной")}
          title={unread === 0 ? "Нет непрочитанных" : "Отметить прочитанной"}
        >
          <CheckCheck className="size-3.5" aria-hidden />
          Прочитать{unread > 0 ? ` (${unread})` : ""}
        </Button>
      </header>

      {/* Pinned-баннер */}
      {pinned.length ? (
        <div className="flex flex-col gap-1 border-b border-[var(--border)] bg-[var(--panel-subtle)] px-4 py-2">
          {pinned.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-[length:var(--text-xs)]">
              <Pin className="size-3 shrink-0 text-[var(--accent)]" aria-hidden />
              <span className="font-semibold text-[var(--muted-strong)]">{users.name(m.authorUserId)}:</span>
              <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{m.body || (m.stickers[0] ? stickerEmoji(m.stickers[0].stickerAssetId) : "—")}</span>
              {/* COMM-06: снять закрепление */}
              <button type="button" onClick={() => void run(() => conv.unpinMessage(cid, m.id), "Закрепление снято")} className="shrink-0 rounded-[var(--radius-sm)] p-0.5 text-[var(--muted-soft)] hover:bg-[var(--panel-strong)] hover:text-[var(--text-strong)]" title="Снять закрепление" aria-label="Снять закрепление"><X className="size-3" aria-hidden /></button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Лента */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          {ordered.length === 0 ? (
            <EmptyState title="Сообщений пока нет" description="Напишите первое сообщение в этой беседе." />
          ) : (
            ordered.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                users={users}
                presenceOf={presenceOf}
                busy={busy}
                onToggleReaction={(emoji) => toggleReaction(m, emoji)}
                onEdit={(body) => void run(() => conv.editMessage(cid, m.id, { body }), "Сообщение изменено")}
                onDelete={() => void run(() => conv.deleteMessage(cid, m.id), "Сообщение удалено")}
                onPin={() => void run(() => conv.pinMessage(cid, m.id), "Сообщение закреплено")}
              />
            ))
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Композер */}
      <Composer
        busy={busy}
        onSend={(body) => void run(() => conv.postMessage(cid, { body }))}
        onSticker={(stickerAssetId) => void run(() => conv.postMessage(cid, { stickerAssetId }))}
      />
    </section>
  );
}

// Бабл сообщения: аватар + автор + relTime + тело/стикер + реакции + hover-меню.
function MessageBubble({
  message,
  users,
  presenceOf,
  busy,
  onToggleReaction,
  onEdit,
  onDelete,
  onPin
}: {
  message: Message;
  users: CommsUsersDir;
  presenceOf: (userId: string | null) => PresenceStatus;
  busy: boolean;
  onToggleReaction: (emoji: string) => void;
  onEdit: (body: string) => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const me = useContext(SelfUserContext);
  const m = message;
  const mine = m.authorUserId === me;
  const archived = Boolean(m.archivedAt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);

  // Архивное (soft-deleted) сообщение — приглушённая плашка «сообщение удалено».
  if (archived) {
    return (
      <div className="flex gap-2.5 opacity-60">
        <BemAvatar initials={initials(users.name(m.authorUserId))} color={avatarColor(m.authorUserId)} size="sm" title={users.name(m.authorUserId)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <strong className="text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">{users.name(m.authorUserId)}</strong>
            <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{relTime(m.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-[length:var(--text-sm)] italic text-[var(--muted-soft)]">сообщение удалено</p>
        </div>
      </div>
    );
  }

  // Агрегируем реакции по emoji (счётчик + есть ли своя).
  const grouped = groupReactions(m.reactions, me);

  return (
    <div className="group flex gap-2.5">
      <span className="relative inline-flex shrink-0">
        <BemAvatar initials={initials(users.name(m.authorUserId))} color={avatarColor(m.authorUserId)} size="sm" title={users.name(m.authorUserId)} />
        <PresenceDot status={presenceOf(m.authorUserId)} className="absolute -bottom-0.5 -right-0.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <strong className="text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{users.name(m.authorUserId)}</strong>
          <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{relTime(m.createdAt)}</span>
          {m.editedAt ? <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">(изм.)</span> : null}
          {m.pinnedAt ? <Pin className="size-3 text-[var(--accent)]" aria-hidden /> : null}

          {/* Hover-меню сообщения */}
          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <ReactionPicker busy={busy} onPick={onToggleReaction} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={busy} title="Действия с сообщением"><MoreHorizontal className="size-3.5" aria-hidden /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1">
                {mine ? (
                  <MenuItem icon={<Pencil className="size-3.5" aria-hidden />} label="Изменить" onClick={() => { setDraft(m.body); setEditing(true); }} disabled={busy} />
                ) : null}
                <MenuItem icon={<Pin className="size-3.5" aria-hidden />} label="Закрепить" onClick={onPin} disabled={busy} />
                <MenuItem icon={<Trash2 className="size-3.5" aria-hidden />} label="Удалить" onClick={onDelete} disabled={busy} danger />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Тело / стикер / режим правки */}
        {editing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <Textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[60px]" autoFocus />
            <div className="flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="size-3.5" aria-hidden />Отмена</Button>
              <Button variant="default" size="sm" disabled={busy || !draft.trim() || draft.trim() === m.body} onClick={() => { onEdit(draft.trim()); setEditing(false); }}>Сохранить</Button>
            </div>
          </div>
        ) : (
          <>
            {m.body ? <p className="mt-0.5 whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--text)]">{m.body}</p> : null}
            {m.stickers.map((s) => (
              <div key={s.stickerAssetId} className="mt-0.5 text-[length:var(--text-28)] leading-none" title="Стикер">{stickerEmoji(s.stickerAssetId)}</div>
            ))}
          </>
        )}

        {/* Реакции-чипы (клик = toggle по своему userId) */}
        {grouped.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {grouped.map((g) => (
              <button
                key={g.emoji}
                type="button"
                disabled={busy}
                onClick={() => onToggleReaction(g.emoji)}
                title={g.mine ? "Снять реакцию" : "Поставить реакцию"}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[length:var(--text-xs)] transition-colors disabled:opacity-60",
                  g.mine
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--muted-strong)] hover:border-[var(--accent-muted)]"
                )}
              >
                <span>{g.emoji}</span>
                <span className="v4-num">{g.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Группировка реакций по emoji: счётчик + флаг «есть моя».
type GroupedReaction = { emoji: string; count: number; mine: boolean };
function groupReactions(reactions: Reaction[], me: string): GroupedReaction[] {
  const map = new Map<string, GroupedReaction>();
  for (const r of reactions) {
    if (r.archivedAt) continue;
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    g.count += 1;
    if (r.userId === me) g.mine = true;
    map.set(r.emoji, g);
  }
  return [...map.values()];
}

// Быстрый выбор эмодзи-реакции (попап-сетка).
function ReactionPicker({ busy, onPick }: { busy: boolean; onPick: (emoji: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={busy} title="Реакция"><Smile className="size-3.5" aria-hidden /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-1.5">
        <div className="flex gap-1">
          {QUICK_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              disabled={busy}
              onClick={() => onPick(e)}
              className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[length:var(--text-lg)] hover:bg-[var(--panel-strong)] disabled:opacity-60"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MenuItem({ icon, label, onClick, disabled, danger }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[length:var(--text-sm)] transition-colors disabled:opacity-50",
        danger ? "text-[var(--danger-text)] hover:bg-[var(--danger-soft)]" : "text-[var(--text)] hover:bg-[var(--panel-strong)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// Композер: textarea + «Отправить» (body) + кнопка-стикер (popover → postMessage stickerAssetId).
function Composer({
  busy,
  onSend,
  onSticker
}: {
  busy: boolean;
  onSend: (body: string) => void;
  onSticker: (stickerAssetId: string) => void;
}) {
  const [body, setBody] = useState("");
  const canSend = body.trim().length > 0;

  const submit = () => {
    if (!canSend || busy) return;
    onSend(body.trim());
    setBody("");
  };

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border)] p-3">
      <Textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Написать сообщение…  (Enter — отправить, Shift+Enter — перенос)"
        className="min-h-[56px]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" disabled={busy} title="Отправить стикер"><Smile className="size-3.5" aria-hidden />Стикер</Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-1.5">
            <div className="flex gap-1">
              {STICKERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSticker(s.id)}
                  title={s.title}
                  className="grid size-10 place-items-center rounded-[var(--radius-md)] text-[length:var(--text-h2)] hover:bg-[var(--panel-strong)] disabled:opacity-60"
                >
                  {s.emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Тело или стикер обязательны</span>
        <Button variant="default" size="sm" className="ml-auto" disabled={busy || !canSend} onClick={submit}>
          <Send className="size-3.5" aria-hidden />Отправить
        </Button>
      </div>
    </div>
  );
}
