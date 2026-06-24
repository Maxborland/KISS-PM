"use client";

import { useEffect, useMemo, useState } from "react";
import { Hash, Loader2, Lock, Plus, Save, Send, ShieldCheck, UserMinus, UserPlus } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { CommsFrame } from "@/communications/ui/comms-frame";
import { useChannel, useChannels } from "@/communications/lib/use-comms";
import { avatarColor, commsErr, COMMS_USERS, initials, relTime, RoleChip, userName } from "@/communications/lib/comms-bits";
import type {
  Channel,
  ChannelMember,
  CommunicationChannelRole,
  CommunicationChannelType,
  Conversation,
  Message
} from "@/communications/lib/comms-client";

/* ============================================================
   Поверхность «Каналы» блока «Коммуникации».
   СЛЕВА — список каналов (бейдж типа, название, affordance управления).
   СПРАВА — детальная панель выбранного канала: инфо + участники + беседа.
   Функциональна через useChannels()/useChannel() поверх contract-mock
   (createCommsClient + createMockCommsFetch); переключение на боевой API =
   смена apiOrigin + удаление fetchImpl. Данные in-memory, без realtime.
   ============================================================ */

// RU-метки типов канала (workspace_general — системный; создаётся team|project_general|custom).
const CHANNEL_TYPE_LABEL: Record<CommunicationChannelType, string> = {
  workspace_general: "Общий",
  team: "Команда",
  project_general: "Проект",
  custom: "Произвольный"
};
// Тон бейджа типа канала.
const CHANNEL_TYPE_VARIANT: Record<CommunicationChannelType, "info" | "success" | "warning" | "danger" | "violet" | undefined> = {
  workspace_general: undefined,
  team: "info",
  project_general: "violet",
  custom: "warning"
};
// Типы, создаваемые через UI (workspace_general — системный, не создаётся).
const CREATABLE_TYPES: { value: "team" | "project_general" | "custom"; label: string }[] = [
  { value: "team", label: "Команда" },
  { value: "project_general", label: "Проект" },
  { value: "custom", label: "Произвольный" }
];
const ROLE_OPTIONS: { value: CommunicationChannelRole; label: string }[] = [
  { value: "member", label: "Участник" },
  { value: "moderator", label: "Модератор" },
  { value: "owner", label: "Владелец" }
];

// Демо-проект для scope канала project_general (единственный известный моку проект).
const DEMO_PROJECT_ID = "proj-portal";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

// Бейдж типа канала.
function ChannelTypeChip({ type }: { type: CommunicationChannelType }) {
  return <Chip variant={CHANNEL_TYPE_VARIANT[type]}>{CHANNEL_TYPE_LABEL[type]}</Chip>;
}

export function ChannelsSurface() {
  const { data, status, error, reload, createChannel } = useChannels();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Каналы по типу: системный workspace_general — первым, затем остальные.
  const channels = useMemo(() => {
    if (!data) return [] as Channel[];
    return [...data.channels].sort((a, b) => {
      if (a.channelType === "workspace_general") return -1;
      if (b.channelType === "workspace_general") return 1;
      return a.title.localeCompare(b.title, "ru");
    });
  }, [data]);

  // Выбранный канал: явный выбор → первый в списке.
  const selected = useMemo<Channel | null>(() => channels.find((c) => c.id === selectedId) ?? channels[0] ?? null, [channels, selectedId]);

  if (status === "loading" && !data) {
    return (
      <CommsFrame activeTab="Каналы">
        <div className="flex h-[420px] items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Загрузка каналов…
        </div>
      </CommsFrame>
    );
  }
  if (status === "error" || !data) {
    return (
      <CommsFrame activeTab="Каналы">
        <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]">
          <span>Не удалось загрузить: {commsErr(error ?? undefined)}</span>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>Повторить</Button>
        </div>
      </CommsFrame>
    );
  }

  async function doCreate(input: Parameters<typeof createChannel>[0]) {
    setBusy(true);
    setNotice(null);
    const res = await createChannel(input);
    setBusy(false);
    if (res.ok) setNotice(`Канал «${input.title}» создан`);
    else setNotice(`Отклонено: ${commsErr(res.ok ? undefined : res.code, res.ok ? undefined : res.message)}`);
    return res;
  }

  return (
    <CommsFrame
      activeTab="Каналы"
      subtitle="Каналы рабочей области и проектов"
      actions={<CreateChannelDialog busy={busy} onCreate={doCreate} />}
    >
      {/* Честный баннер «Прототип» */}
      <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        <span>
          Реальный контракт: /api/workspace/communication-channels (список/создание/правка, участники) и /:id/conversation (лента канала).
          Канал «Общий» — системный (workspace_general), не создаётся и не управляется. Данные in-memory; realtime-доставка появится в приложении —
          здесь обновление по действию.
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* СЛЕВА: список каналов */}
        <aside className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-2 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2 px-1.5 pt-1 pb-1.5">
            <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Каналы</h2>
            <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[10px] font-semibold text-[var(--muted-strong)]">{channels.length}</span>
          </div>
          {channels.map((ch) => {
            const active = selected?.id === ch.id;
            const system = ch.channelType === "workspace_general";
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedId(ch.id)}
                className={cn(
                  "flex flex-col gap-1 rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-transparent hover:border-[var(--border)] hover:bg-[var(--panel-subtle)]"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Hash className="size-3.5 shrink-0 text-[var(--muted-soft)]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{ch.title}</span>
                  {system ? (
                    <Lock className="size-3 shrink-0 text-[var(--muted-soft)]" aria-hidden />
                  ) : ch.canManage ? (
                    <ShieldCheck className="size-3 shrink-0 text-[var(--accent-text)]" aria-hidden />
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <ChannelTypeChip type={ch.channelType} />
                </div>
              </button>
            );
          })}
        </aside>

        {/* СПРАВА: детальная панель */}
        {selected ? (
          <ChannelDetail key={selected.id} channelId={selected.id} fallback={selected} />
        ) : (
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-card)]">
            <EmptyState title="Нет каналов" description="Создайте первый канал кнопкой «Канал»." />
          </div>
        )}
      </div>

      {notice ? <div className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </CommsFrame>
  );
}

/* ============================================================
   Детальная панель канала (useChannel): инфо + участники + беседа.
   fallback — запись из листинга на время загрузки детали (без мерцания).
   ============================================================ */
function ChannelDetail({ channelId, fallback }: { channelId: string; fallback: Channel }) {
  const { client, data, status, error, reload, patchChannel, addMember, removeMember } = useChannel(channelId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const channel = data?.channel ?? fallback;
  const members = data?.members ?? [];
  const system = channel.channelType === "workspace_general";
  const canManage = channel.canManage && !system;

  if (status === "error" && !data) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]">
        <span>Не удалось загрузить канал: {commsErr(error ?? undefined)}</span>
        <Button variant="secondary" size="sm" onClick={() => void reload()}>Повторить</Button>
      </div>
    );
  }

  async function doRemove(userId: string) {
    setBusy(true);
    setNotice(null);
    const res = await removeMember(userId);
    setBusy(false);
    if (res.ok) setNotice(`Участник ${userName(userId)} удалён`);
    else setNotice(`Отклонено: ${commsErr(res.ok ? undefined : res.code, res.ok ? undefined : res.message)}`);
  }

  async function doAdd(userId: string, role: CommunicationChannelRole) {
    setBusy(true);
    setNotice(null);
    const res = await addMember({ userId, role });
    setBusy(false);
    if (res.ok) setNotice(`Участник ${userName(userId)} добавлен`);
    else setNotice(`Отклонено: ${commsErr(res.ok ? undefined : res.code, res.ok ? undefined : res.message)}`);
    return res;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Шапка канала */}
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--panel-strong)] text-[var(--muted-strong)]">
            <Hash className="size-5" aria-hidden />
          </span>
          <div className="mr-auto min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">{channel.title}</h2>
              <ChannelTypeChip type={channel.channelType} />
              {system ? (
                <span className="inline-flex items-center gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]"><Lock className="size-3" aria-hidden />системный</span>
              ) : canManage ? (
                <span className="inline-flex items-center gap-1 text-[length:var(--text-xs)] text-[var(--accent-text)]"><ShieldCheck className="size-3" aria-hidden />управление</span>
              ) : null}
            </div>
            <p className="truncate text-[length:var(--text-xs)] text-[var(--muted)]">
              <span className="v4-mono">{channel.id}</span>
              {channel.scopeEntityId ? ` · область: ${channel.scopeEntityType} / ${channel.scopeEntityId}` : null}
            </p>
            {channel.description ? <p className="mt-1 text-[length:var(--text-sm)] text-[var(--muted-strong)]">{channel.description}</p> : null}
          </div>
          {canManage ? <EditChannelDialog channel={channel} busy={busy} onSave={async (input) => {
            setBusy(true);
            setNotice(null);
            const res = await patchChannel(input);
            setBusy(false);
            if (res.ok) setNotice("Канал обновлён");
            else setNotice(`Отклонено: ${commsErr(res.ok ? undefined : res.code, res.ok ? undefined : res.message)}`);
            return res;
          }} /> : null}
        </div>
        {status === "loading" && !data ? (
          <div className="mt-3 flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--muted)]"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Загрузка канала…</div>
        ) : null}
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Беседа канала (read-only лента + композер); client из useChannel — тот же стор. */}
        <ChannelConversation client={client} channelId={channelId} conversation={data?.conversation ?? null} loading={status === "loading" && !data} />

        {/* Участники */}
        <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Участники</h3>
            <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[10px] font-semibold text-[var(--muted-strong)]">{members.length}</span>
          </div>
          {system ? (
            <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Системный канал «Общий» доступен всей рабочей области — список участников не управляется.</p>
          ) : members.length === 0 ? (
            <p className="py-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Участников пока нет.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {members.map((m) => (
                <MemberRow key={m.userId} member={m} canManage={canManage} busy={busy} onRemove={() => void doRemove(m.userId)} />
              ))}
            </ul>
          )}

          {canManage ? (
            <>
              <Separator />
              <AddMemberForm members={members} busy={busy} onAdd={doAdd} />
            </>
          ) : null}
        </section>
      </div>

      {notice ? <div className="text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </div>
  );
}

// Строка участника канала.
function MemberRow({ member, canManage, busy, onRemove }: { member: ChannelMember; canManage: boolean; busy: boolean; onRemove: () => void }) {
  const name = userName(member.userId);
  return (
    <li className="flex items-center gap-2.5">
      <BemAvatar initials={initials(name)} color={avatarColor(member.userId)} size="sm" title={name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{name}</div>
        <div className="v4-mono text-[10px] text-[var(--muted-soft)]">{member.userId}</div>
      </div>
      <RoleChip role={member.role} />
      {canManage && member.role !== "owner" ? (
        <Button variant="ghost" size="icon-sm" disabled={busy} onClick={onRemove} title="Удалить участника">
          <UserMinus className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </li>
  );
}

// Форма добавления участника (select userId + role) → addMember.
function AddMemberForm({
  members,
  busy,
  onAdd
}: {
  members: ChannelMember[];
  busy: boolean;
  onAdd: (userId: string, role: CommunicationChannelRole) => Promise<{ ok: boolean }>;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<CommunicationChannelRole>("member");
  // Пользователи, ещё не состоящие в канале (active membership).
  const candidates = COMMS_USERS.filter((u) => !members.some((m) => m.userId === u.id));
  const valid = Boolean(userId) && candidates.some((u) => u.id === userId);

  const submit = async () => {
    if (!valid) return;
    const res = await onAdd(userId, role);
    if (res.ok) {
      setUserId("");
      setRole("member");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">Добавить участника</div>
      {candidates.length === 0 ? (
        <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Все пользователи уже в канале.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${labelCls} min-w-[150px] flex-1`}>Пользователь
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selCls}>
              <option value="" disabled>Выберите…</option>
              {candidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className={`${labelCls} min-w-[120px]`}>Роль
            <select value={role} onChange={(e) => setRole(e.target.value as CommunicationChannelRole)} className={selCls}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <Button variant="default" size="sm" disabled={!valid || busy} onClick={() => void submit()}>
            <UserPlus className="size-3.5" aria-hidden />Добавить
          </Button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Встроенная компактная лента беседы канала (channel.conversation).
   Грузим последние сообщения read-only + простой композер через тот же
   контракт (client.listMessages/postMessage). Не импортируем chat-surface.
   ============================================================ */
function ChannelConversation({
  client,
  channelId,
  conversation,
  loading
}: {
  client: ReturnType<typeof useChannel>["client"];
  channelId: string;
  conversation: Conversation | null;
  loading: boolean;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationId = conversation?.id ?? null;

  // Грузим последние сообщения беседы канала при смене беседы.
  useEffect(() => {
    if (!conversationId) {
      setMessages(null);
      return;
    }
    let alive = true;
    setError(null);
    client
      .listMessages(conversationId, { limit: 20 })
      .then((r) => { if (alive) setMessages(r.messages); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "load_failed"); });
    return () => { alive = false; };
  }, [client, conversationId]);

  const send = async () => {
    if (!conversationId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await client.postMessage(conversationId, { body: draft.trim() });
      const r = await client.listMessages(conversationId, { limit: 20 });
      setMessages(r.messages);
      setDraft("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "request_failed");
    } finally {
      setBusy(false);
    }
  };

  // Видимые сообщения: без архивных (soft-deleted), по возрастанию времени.
  const visible = (messages ?? []).filter((m) => m.archivedAt === null);

  return (
    <section className="flex min-h-[280px] flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Лента канала</h3>
        <span className="text-[10px] text-[var(--muted-soft)]">GET /communication-channels/{channelId}/conversation</span>
      </div>

      <div className="flex max-h-[360px] min-h-[160px] flex-1 flex-col gap-3 overflow-auto p-4">
        {loading || messages === null ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-[length:var(--text-xs)] text-[var(--muted)]"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Загрузка ленты…</div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center text-[length:var(--text-xs)] text-[var(--danger-text)]">{commsErr(error)}</div>
        ) : visible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[length:var(--text-xs)] text-[var(--muted-soft)]">Сообщений пока нет — начните беседу канала.</div>
        ) : (
          visible.map((m) => {
            const name = userName(m.authorUserId);
            return (
              <div key={m.id} className="flex gap-2.5">
                <BemAvatar initials={initials(name)} color={avatarColor(m.authorUserId)} size="sm" title={name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{name}</strong>
                    <span className="text-[10px] text-[var(--muted-soft)]">{relTime(m.createdAt)}</span>
                    {m.editedAt ? <span className="text-[10px] text-[var(--muted-soft)]">(изменено)</span> : null}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--text)]">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <div className="flex items-end gap-2">
          <Textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy || !conversationId}
            placeholder={conversationId ? "Написать в канал…" : "Беседа недоступна"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button variant="default" size="sm" disabled={busy || !conversationId || !draft.trim()} onClick={() => void send()}>
            <Send className="size-3.5" aria-hidden />Отправить
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Диалог создания канала.
   channelType ∈ {team, project_general, custom}; workspace_general НЕ создаётся.
   project_general → scopeEntityType="project" + scopeEntityId (demo proj-portal).
   ============================================================ */
function CreateChannelDialog({
  busy,
  onCreate
}: {
  busy: boolean;
  onCreate: (input: { channelType: "team" | "project_general" | "custom"; title: string; description?: string | null; scopeEntityType?: "project" | "org_unit" | null; scopeEntityId?: string | null }) => Promise<{ ok: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [channelType, setChannelType] = useState<"team" | "project_general" | "custom">("team");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scopeEntityId, setScopeEntityId] = useState(DEMO_PROJECT_ID);

  // team → требует org_unit-scope; project_general → project-scope (демо proj-portal).
  const needsScope = channelType === "team" || channelType === "project_general";
  const valid = title.trim().length > 0 && (!needsScope || scopeEntityId.trim().length > 0);

  const submit = async () => {
    if (!valid) return;
    const input =
      channelType === "team"
        ? { channelType, title: title.trim(), description: description.trim() || null, scopeEntityType: "org_unit" as const, scopeEntityId: scopeEntityId.trim() }
        : channelType === "project_general"
          ? { channelType, title: title.trim(), description: description.trim() || null, scopeEntityType: "project" as const, scopeEntityId: scopeEntityId.trim() }
          : { channelType, title: title.trim(), description: description.trim() || null };
    const res = await onCreate(input);
    if (res.ok) {
      setOpen(false);
      setTitle("");
      setDescription("");
      setChannelType("team");
      setScopeEntityId(DEMO_PROJECT_ID);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Канал</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[520px]">
        <DialogHeader><DialogTitle>Новый канал</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <label className={labelCls}>Тип канала
            <select
              value={channelType}
              onChange={(e) => setChannelType(e.target.value as "team" | "project_general" | "custom")}
              className={selCls}
            >
              {CREATABLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className={labelCls}>Название<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Команда портала" /></label>
          <label className={labelCls}>Описание<Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Для чего этот канал…" /></label>
          {channelType === "project_general" ? (
            <label className={labelCls}>Проект (область)
              <select value={scopeEntityId} onChange={(e) => setScopeEntityId(e.target.value)} className={selCls}>
                <option value={DEMO_PROJECT_ID}>Производственный портал ({DEMO_PROJECT_ID})</option>
              </select>
              <span className="text-[10px] text-[var(--muted-soft)]">project_general → scopeEntityType=&quot;project&quot;; в демо известен только {DEMO_PROJECT_ID}.</span>
            </label>
          ) : channelType === "team" ? (
            <label className={labelCls}>Подразделение (область)
              <Input value={scopeEntityId} onChange={(e) => setScopeEntityId(e.target.value)} placeholder="org-portal" />
              <span className="text-[10px] text-[var(--muted-soft)]">team → scopeEntityType=&quot;org_unit&quot;.</span>
            </label>
          ) : null}
        </div>
        <p className="text-[10px] text-[var(--muted-soft)]">
          POST /communication-channels — создатель становится владельцем (owner). Канал «Общий» (workspace_general) создать нельзя.
          Тип и область канала после создания не редактируются (только название/описание).
        </p>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Диалог правки канала (только title/description; manage). */
function EditChannelDialog({
  channel,
  busy,
  onSave
}: {
  channel: Channel;
  busy: boolean;
  onSave: (input: { title?: string; description?: string }) => Promise<{ ok: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(channel.title);
  const [description, setDescription] = useState(channel.description);

  // Сброс формы при открытии (актуальные значения канала).
  useEffect(() => {
    if (open) {
      setTitle(channel.title);
      setDescription(channel.description);
    }
  }, [open, channel.title, channel.description]);

  const dirty = title.trim() !== channel.title || description !== channel.description;
  const valid = title.trim().length > 0 && dirty;

  const submit = async () => {
    if (!valid) return;
    // Шлём только изменённые поля (PATCH требует ≥1 поле).
    const input: { title?: string; description?: string } = {};
    if (title.trim() !== channel.title) input.title = title.trim();
    if (description !== channel.description) input.description = description;
    const res = await onSave(input);
    if (res.ok) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm"><Save className="size-3.5" aria-hidden />Изменить</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[520px]">
        <DialogHeader><DialogTitle>Изменить канал</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <label className={labelCls}>Название<Input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className={labelCls}>Описание<Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Для чего этот канал…" /></label>
        </div>
        <p className="text-[10px] text-[var(--muted-soft)]">PATCH /communication-channels/:id — меняются только название и описание; тип и область не редактируемы.</p>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Save className="size-3.5" aria-hidden />Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
