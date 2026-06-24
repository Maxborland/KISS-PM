"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCheck, Loader2, MoreHorizontal, Pencil, Pin, Send, Smile, Trash2, X } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { CommsFrame } from "@/communications/ui/comms-frame";
import { useConversation } from "@/communications/lib/use-comms";
import { avatarColor, commsErr, initials, relTime, userName, UnreadDot } from "@/communications/lib/comms-bits";
import type { Conversation, Message, Reaction } from "@/communications/lib/comms-client";

/* ============================================================
   Поверхность ЧАТ блока «Коммуникации».
   Двухпанель: слева — беседы demo-сущности (project/proj-portal),
   справа — лента сообщений выбранной беседы + композер.
   Работает на useConversation (createCommsClient поверх in-memory мока).
   ============================================================ */

// «Текущий пользователь» прототипа = u-anna (зеркало CURRENT_ACTOR_ID в моке).
const ME = "u-anna";

// Demo-сущность (entity-scoped): беседы/звонки/митинги привязаны к проекту proj-portal.
const DEMO_ENTITY_TYPE = "project" as const;
const DEMO_ENTITY_ID = "proj-portal";

// Сид-стикеры (StickerAsset не отдаётся клиентом отдельным методом — берём из сид-набора).
const STICKERS: { id: string; emoji: string; title: string }[] = [
  { id: "sticker-thumbsup", emoji: "👍", title: "Палец вверх" },
  { id: "sticker-party", emoji: "🎉", title: "Праздник" }
];
const stickerEmoji = (id: string): string => STICKERS.find((s) => s.id === id)?.emoji ?? "🏷️";

// Быстрые реакции для попапа под сообщением.
const QUICK_EMOJI = ["👍", "🎉", "❤️", "🔥", "👀", "✅"];

export function ChatSurface() {
  const conv = useConversation(DEMO_ENTITY_TYPE, DEMO_ENTITY_ID);
  const { data, status, error, reload, selectConversation } = conv;

  if (status === "loading" && !data) {
    return (
      <CommsFrame activeTab="Чат">
        <div className="flex h-[420px] items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Загрузка чата…
        </div>
      </CommsFrame>
    );
  }
  if (status === "error" || !data) {
    return (
      <CommsFrame activeTab="Чат">
        <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]">
          <span>Не удалось загрузить: {error ?? "unknown"}</span>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>Повторить</Button>
        </div>
      </CommsFrame>
    );
  }

  const selected = data.conversations.find((c) => c.id === data.selectedConversationId) ?? null;

  return (
    <CommsFrame activeTab="Чат" subtitle="Беседы проекта · proj-portal">
      <div className="flex flex-col gap-3">
        <PrototypeBanner />
        <div className="grid min-h-0 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <ConversationList
            conversations={data.conversations}
            selectedId={data.selectedConversationId}
            onSelect={(id) => void selectConversation(id)}
          />
          {selected ? (
            <ChatPane key={selected.id} conv={conv} conversation={selected} messages={data.messages} />
          ) : (
            <div className="grid min-h-[480px] place-items-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)]">
              <EmptyState title="Нет бесед" description="У этой сущности пока нет бесед." />
            </div>
          )}
        </div>
      </div>
    </CommsFrame>
  );
}

// Честный баннер «Прототип»: реальные ручки + in-memory + про realtime.
function PrototypeBanner() {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
      <span>
        Реальный контракт: /api/workspace/conversations (беседы сущности + readState), .../messages (отправка, правка, удаление, реакции, закрепление), .../read-state (прочитано). Данные in-memory. Realtime-доставка появится в приложении; здесь лента обновляется по действию.
      </span>
    </div>
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
                {c.archivedAt ? <span className="text-[10px] text-[var(--muted-soft)]">в архиве</span> : null}
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

// СПРАВА: лента сообщений + pinned-баннер + композер.
function ChatPane({
  conv,
  conversation,
  messages
}: {
  conv: ReturnType<typeof useConversation>;
  conversation: Conversation;
  messages: Message[];
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
    setNotice(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      if (okMsg) setNotice(okMsg);
    } else {
      setNotice(`Отклонено: ${commsErr(res.code, res.message)}`);
    }
  };

  // Тоггл реакции по своему userId (ME): есть своя — снять, иначе — поставить.
  const toggleReaction = (m: Message, emoji: string) => {
    const mine = m.reactions.find((r) => r.userId === ME && r.emoji === emoji && !r.archivedAt);
    if (mine) void run(() => conv.removeReaction(cid, m.id, mine.id));
    else void run(() => conv.addReaction(cid, m.id, emoji));
  };

  return (
    <section className="flex min-h-[480px] flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      {/* Шапка беседы */}
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-[length:var(--text-sm)] font-bold text-[var(--text-strong)]">{conversation.title}</h2>
          <p className="truncate text-[10px] text-[var(--muted-soft)]">{ordered.length} сообщ. · proj-portal</p>
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
              <span className="font-semibold text-[var(--muted-strong)]">{userName(m.authorUserId)}:</span>
              <span className="truncate text-[var(--muted)]">{m.body || (m.stickers[0] ? stickerEmoji(m.stickers[0].stickerAssetId) : "—")}</span>
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

      {notice ? <div className="border-t border-[var(--border)] px-4 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </section>
  );
}

// Бабл сообщения: аватар + автор + relTime + тело/стикер + реакции + hover-меню.
function MessageBubble({
  message,
  busy,
  onToggleReaction,
  onEdit,
  onDelete,
  onPin
}: {
  message: Message;
  busy: boolean;
  onToggleReaction: (emoji: string) => void;
  onEdit: (body: string) => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const m = message;
  const mine = m.authorUserId === ME;
  const archived = Boolean(m.archivedAt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);

  // Архивное (soft-deleted) сообщение — приглушённая плашка «сообщение удалено».
  if (archived) {
    return (
      <div className="flex gap-2.5 opacity-60">
        <BemAvatar initials={initials(userName(m.authorUserId))} color={avatarColor(m.authorUserId)} size="sm" title={userName(m.authorUserId)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <strong className="text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">{userName(m.authorUserId)}</strong>
            <span className="text-[10px] text-[var(--muted-soft)]">{relTime(m.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-[length:var(--text-sm)] italic text-[var(--muted-soft)]">сообщение удалено</p>
        </div>
      </div>
    );
  }

  // Агрегируем реакции по emoji (счётчик + есть ли своя).
  const grouped = groupReactions(m.reactions);

  return (
    <div className="group flex gap-2.5">
      <BemAvatar initials={initials(userName(m.authorUserId))} color={avatarColor(m.authorUserId)} size="sm" title={userName(m.authorUserId)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <strong className="text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{userName(m.authorUserId)}</strong>
          <span className="text-[10px] text-[var(--muted-soft)]">{relTime(m.createdAt)}</span>
          {m.editedAt ? <span className="text-[10px] text-[var(--muted-soft)]">(изм.)</span> : null}
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
              <div key={s.stickerAssetId} className="mt-0.5 text-[28px] leading-none" title="Стикер">{stickerEmoji(s.stickerAssetId)}</div>
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
function groupReactions(reactions: Reaction[]): GroupedReaction[] {
  const map = new Map<string, GroupedReaction>();
  for (const r of reactions) {
    if (r.archivedAt) continue;
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    g.count += 1;
    if (r.userId === ME) g.mine = true;
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
              className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[16px] hover:bg-[var(--panel-strong)] disabled:opacity-60"
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
                  className="grid size-10 place-items-center rounded-[var(--radius-md)] text-[24px] hover:bg-[var(--panel-strong)] disabled:opacity-60"
                >
                  {s.emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="text-[10px] text-[var(--muted-soft)]">Тело или стикер обязательны</span>
        <Button variant="default" size="sm" className="ml-auto" disabled={busy || !canSend} onClick={submit}>
          <Send className="size-3.5" aria-hidden />Отправить
        </Button>
      </div>
    </div>
  );
}
