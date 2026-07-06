"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckSquare, Link2, Plus, Send, StickyNote, Users } from "lucide-react";
import { toast } from "sonner";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { FormDialog } from "@/components/domain/form-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { CommsFrame } from "@/communications/ui/comms-frame";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { useCommsUsers, useMeetingDetail, useMeetings, type CommsUsersDir } from "@/communications/lib/use-comms";
import { WithCommsEntityScope, type ResolvedCommsScope } from "@/communications/lib/entity-scope";
import { avatarColor, commsErr, initials, relTime } from "@/communications/lib/comms-bits";
import type {
  ActionItemInput,
  EntityType,
  Meeting,
  MeetingActionItem,
  MeetingActionItemStatus,
  MeetingCreateInput,
  MeetingExternalLink,
  MeetingExternalLinkProvider,
  MeetingNote,
  MeetingParticipant,
  MeetingParticipantRole,
  MeetingStatus
} from "@/communications/lib/comms-client";

/* ============================================================
   Поверхность «Встречи» (Communications/Meetings).
   Функциональна через useMeetings(scope): список митингов
   слева + детальная панель справа (повестка, участники, ноты-лента,
   внешние ссылки, action-items). Честность: in-memory, realtime-доставка —
   в приложении; здесь обновление по действию. Эталон стиля — deals-surface.

   ВАЖНО (несоответствие API, отражено в плашке): GET-ручки ДЕТАЛИ митинга
   (участники/ноты/ссылки/action-items) в этом слайсе НЕТ — мок отдаёт только
   список митингов + write-мутации. Поэтому детальная панель показывает
   засеянное содержимое (демо-снимок) + ОПТИМИСТИЧНО добавленные за сессию
   записи (мутация вернула ok). В приложении детали подтянутся с сервера.
   ============================================================ */

const STATUS: Record<MeetingStatus, { label: string; variant: "info" | "success" | "danger" }> = {
  scheduled: { label: "Запланирована", variant: "info" },
  completed: { label: "Завершена", variant: "success" },
  cancelled: { label: "Отменена", variant: "danger" }
};
const ROLE_LABEL: Record<MeetingParticipantRole, string> = { organizer: "Организатор", required: "Обязателен", optional: "Опционально" };
const RESPONSE: Record<MeetingParticipant["response"], { label: string; variant: "success" | "danger" | "warning" }> = {
  accepted: { label: "Принял", variant: "success" },
  declined: { label: "Отклонил", variant: "danger" },
  pending: { label: "Ожидает", variant: "warning" }
};
const PROVIDER_LABEL: Record<MeetingExternalLinkProvider, string> = {
  zoom: "Zoom",
  teams: "Teams",
  google_meet: "Google Meet",
  manual_link: "Ссылка",
  other: "Другое"
};
const PROVIDERS: MeetingExternalLinkProvider[] = ["zoom", "teams", "google_meet", "manual_link", "other"];

// Локальные UI-классы (зеркало deals-surface): select/label единым стилем.
const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

// Диапазон времени митинга: «25 июн, 13:00 — 14:00» + относительно (relTime начала).
function meetingWhen(m: Meeting): string {
  const start = new Date(m.scheduledStart);
  const finish = new Date(m.scheduledFinish);
  const date = start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const t = (d: Date) => d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${t(start)} — ${t(finish)}`;
}

// Для input type="datetime-local": ISO → 'YYYY-MM-DDTHH:mm' в локальном поясе.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// datetime-local (локальное) → ISO для контракта.
const fromLocalInput = (local: string): string => (local ? new Date(local).toISOString() : "");

// Деталь митинга для панели (зеркало composite GET /api/workspace/meetings/:id).
type MeetingDetail = { participants: MeetingParticipant[]; notes: MeetingNote[]; links: MeetingExternalLink[]; actionItems: MeetingActionItem[] };
const emptyDetail = (): MeetingDetail => ({ participants: [], notes: [], links: [], actionItems: [] });

// Scope сущности резолвится из реальных проектов воркспейса (WithCommsEntityScope);
// явные entityType/entityId пропсы (встраивание, тесты) отключают резолв.
export function MeetingsSurface({ entityType, entityId }: { entityType?: EntityType; entityId?: string } = {}) {
  return (
    <WithCommsEntityScope activeTab="Встречи" {...(entityType ? { explicitEntityType: entityType } : {})} {...(entityId ? { explicitEntityId: entityId } : {})}>
      {(scope) => <MeetingsSurfaceScoped scope={scope} />}
    </WithCommsEntityScope>
  );
}

function MeetingsSurfaceScoped({ scope }: { scope: ResolvedCommsScope }) {
  const { entityType, entityId } = scope;
  const { data, status, error, reload, createMeeting, patchMeeting, addNote, addExternalLink, addActionItem, patchActionItem } = useMeetings(entityType, entityId);
  // Справочник людей тенанта (участники/ответственные/имена): mock=COMMS_USERS, live=GET /api/workspace/users.
  const users = useCommsUsers();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meetings = useMemo(() => {
    if (!data) return [];
    return [...data.meetings].sort((a, b) => Date.parse(b.scheduledStart) - Date.parse(a.scheduledStart));
  }, [data]);

  const selected = useMemo<Meeting | null>(() => {
    if (meetings.length === 0) return null;
    return meetings.find((m) => m.id === selectedId) ?? meetings[0] ?? null;
  }, [meetings, selectedId]);
  // Деталь выбранного митинга — реальный composite GET /meetings/:id (рефетч при смене/после мутаций).
  const meetingDetail = useMeetingDetail(selected?.id ?? null);

  // Верхнеуровневый статус поверхности: forbidden (403) / error / loading.
  // ВНУТРЕННИЙ EmptyState «Встреч пока нет» (data есть, список пуст) — НЕ top-level: остаётся в ready.
  const surfaceStatus = surfaceStatusOf(status, Boolean(data));
  if (surfaceStatus !== "ready") {
    return (
      <CommsFrame activeTab="Встречи" subtitle={`Встречи · ${scope.title}`}>
        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={commsErr}
          loadingLabel="Загрузка встреч…"
          forbidden={{ title: "Нет доступа к встречам", description: "У вас нет прав на просмотр встреч этой сущности." }}
        >
          <span />
        </SurfaceState>
      </CommsFrame>
    );
  }

  // Деталь из GET /meetings/:id (externalLinks → links для панели); пусто, пока грузится/нет выбора.
  const dd = meetingDetail.data;
  const selectedDetail: MeetingDetail = dd
    ? { participants: dd.participants, notes: dd.notes, links: dd.externalLinks, actionItems: dd.actionItems }
    : emptyDetail();

  async function doPatchStatus(meetingId: string, next: MeetingStatus) {
    setBusy(true);
    const res = await patchMeeting(meetingId, { status: next });
    setBusy(false);
    if (res.ok) toast.success(`Статус: «${STATUS[next].label}»`);
    else toast.error(`Отклонено: ${commsErr(res.code, res.message)}`);
  }

  async function doAddNote(meetingId: string, body: string) {
    setBusy(true);
    const res = await addNote(meetingId, body);
    setBusy(false);
    if (res.ok) { await meetingDetail.reload(); toast.success("Заметка добавлена"); }
    else toast.error(`Отклонено: ${commsErr(res.code, res.message)}`);
    return res.ok;
  }

  async function doAddLink(meetingId: string, input: { provider: MeetingExternalLinkProvider; url: string; title: string }) {
    setBusy(true);
    const res = await addExternalLink(meetingId, input);
    setBusy(false);
    if (res.ok) { await meetingDetail.reload(); toast.success("Ссылка добавлена"); }
    else toast.error(`Отклонено: ${commsErr(res.code, res.message)}`);
    return res.ok;
  }

  async function doAddAction(meetingId: string, input: ActionItemInput) {
    setBusy(true);
    const res = await addActionItem(meetingId, input);
    setBusy(false);
    if (res.ok) { await meetingDetail.reload(); toast.success("Задача по итогам добавлена"); }
    else toast.error(`Отклонено: ${commsErr(res.code, res.message)}`);
    return res.ok;
  }

  async function doPatchAction(meetingId: string, actionItemId: string, next: MeetingActionItemStatus) {
    setBusy(true);
    const res = await patchActionItem(meetingId, actionItemId, next);
    if (res.ok) await meetingDetail.reload();
    setBusy(false);
    if (res.ok) toast.success("Статус задачи обновлён");
    else toast.error(`Отклонено: ${commsErr(res.code, res.message)}`);
  }

  return (
    <CommsFrame
      activeTab="Встречи"
      subtitle={`Встречи · ${scope.title}`}
      actions={<>{scope.picker}<CreateMeetingDialog busy={busy} setBusy={setBusy} create={createMeeting} users={users} entityType={entityType} entityId={entityId} /></>}
    >
      <div className="flex flex-col gap-3">
        {/* Честный баннер «Прототип» — только в Storybook/демо (prototypeNotesEnabled). */}
        {prototypeNotesEnabled ? (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
            <span>
              Реальный контракт: /api/workspace/meetings (GET список + GET деталь, POST создать, PATCH статус, POST .../notes, .../external-links, .../action-items). Данные in-memory; realtime-доставка появится в приложении — здесь обновление по действию.
              {" "}Детали митинга — из GET /meetings/:id; статус action-item меняется селектом (PATCH). Приватные URL отклоняются 400.
            </span>
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* СЛЕВА: список митингов */}
          <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-2 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-2 px-1 pt-1">
              <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Встречи</h2>
              <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{meetings.length}</span>
            </div>
            {meetings.length === 0 ? (
              <EmptyState title="Встреч пока нет" description="Создайте первую встречу кнопкой «Встреча»." />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {meetings.map((m) => {
                  const active = selected?.id === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(m.id)}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors",
                          active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--accent-muted)]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--text-strong)]">{m.title}</span>
                          <Chip variant={STATUS[m.status].variant}>{STATUS[m.status].label}</Chip>
                        </div>
                        <span className="flex items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--muted)]">
                          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                          {meetingWhen(m)}
                          <span className="text-[var(--muted-soft)]">· {relTime(m.scheduledStart)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* СПРАВА: детальная панель */}
          {selected ? (
            <MeetingDetailPanel
              key={selected.id}
              meeting={selected}
              detail={selectedDetail}
              users={users}
              busy={busy}
              onPatchStatus={(s) => void doPatchStatus(selected.id, s)}
              onAddNote={(b) => doAddNote(selected.id, b)}
              onAddLink={(i) => doAddLink(selected.id, i)}
              onAddAction={(i) => doAddAction(selected.id, i)}
              onPatchAction={(id, s) => void doPatchAction(selected.id, id, s)}
            />
          ) : (
            <section className="grid place-items-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--muted)] shadow-[var(--shadow-card)]">
              Выберите встречу слева
            </section>
          )}
        </div>
      </div>
    </CommsFrame>
  );
}

/* ============================================================
   Детальная панель выбранного митинга.
   ============================================================ */
function MeetingDetailPanel({
  meeting,
  detail,
  users,
  busy,
  onPatchStatus,
  onAddNote,
  onAddLink,
  onAddAction,
  onPatchAction
}: {
  meeting: Meeting;
  detail: MeetingDetail;
  users: CommsUsersDir;
  busy: boolean;
  onPatchStatus: (status: MeetingStatus) => void;
  onAddNote: (body: string) => Promise<boolean>;
  onAddLink: (input: { provider: MeetingExternalLinkProvider; url: string; title: string }) => Promise<boolean>;
  onAddAction: (input: ActionItemInput) => Promise<boolean>;
  onPatchAction: (actionItemId: string, status: MeetingActionItemStatus) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      {/* шапка митинга */}
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">{meeting.title}</h2>
          <p className="flex items-center gap-1.5 truncate text-[length:var(--text-xs)] text-[var(--muted)]">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            {meetingWhen(meeting)}
            {/* Технический id встречи — dev-подсказка, только в Storybook/демо (G5-11). */}
            {prototypeNotesEnabled ? <> · <span className="v4-mono">{meeting.id}</span></> : null}
          </p>
        </div>
        <Chip variant={STATUS[meeting.status].variant}>{STATUS[meeting.status].label}</Chip>
        <label className={labelCls}>
          Статус
          <select value={meeting.status} disabled={busy} onChange={(e) => onPatchStatus(e.target.value as MeetingStatus)} className={cn(selCls, "w-[160px]")} title="Изменить статус встречи">
            <option value="scheduled">Запланирована</option>
            <option value="completed">Завершена</option>
            <option value="cancelled">Отменена</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {/* Повестка + участники */}
        <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
          <h3 className="mb-2 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Повестка</h3>
          {meeting.agenda.trim() ? (
            <p className="whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--text)]">{meeting.agenda}</p>
          ) : (
            <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Повестка не указана.</p>
          )}

          <h3 className="mt-4 mb-2 flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
            <Users className="size-4" aria-hidden /> Участники
            <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{detail.participants.length}</span>
          </h3>
          {detail.participants.length === 0 ? (
            <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Участников пока нет.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detail.participants.map((p) => {
                const name = users.name(p.userId);
                return (
                  <li key={p.userId} className="flex items-center gap-2">
                    <BemAvatar initials={initials(name)} color={avatarColor(p.userId)} size="sm" title={name} />
                    <span className="mr-auto text-[length:var(--text-sm)] text-[var(--text)]">{name}</span>
                    <Chip variant={p.role === "organizer" ? "violet" : "info"}>{ROLE_LABEL[p.role]}</Chip>
                    <Chip variant={RESPONSE[p.response].variant}>{RESPONSE[p.response].label}</Chip>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Внешние ссылки */}
        <ExternalLinksCard links={detail.links} busy={busy} onAdd={onAddLink} />

        {/* Ноты-лента */}
        <NotesCard notes={detail.notes} busy={busy} onAdd={onAddNote} users={users} />

        {/* Action-items */}
        <ActionItemsCard items={detail.actionItems} busy={busy} onAdd={onAddAction} onPatchStatus={onPatchAction} users={users} />
      </div>
    </section>
  );
}

/* ---- Ноты-лента + добавить ноту ---- */
function NotesCard({ notes, busy, onAdd, users }: { notes: MeetingNote[]; busy: boolean; onAdd: (body: string) => Promise<boolean>; users: CommsUsersDir }) {
  const [body, setBody] = useState("");
  const submit = async () => {
    if (!body.trim()) return;
    const ok = await onAdd(body.trim());
    if (ok) setBody("");
  };
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
      <h3 className="mb-3 flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
        <StickyNote className="size-4" aria-hidden /> Заметки
        <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{notes.length}</span>
      </h3>
      <div className="mb-3 flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-2.5">
        <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Добавить заметку к встрече…" />
        <div className="flex justify-end">
          <Button variant="default" size="sm" disabled={busy || !body.trim()} onClick={() => void submit()}><Send className="size-3.5" aria-hidden />Добавить</Button>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Пока нет заметок.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {notes.map((n) => {
            const author = users.name(n.authorUserId);
            return (
              <li key={n.id} className="flex gap-2.5">
                <BemAvatar initials={initials(author)} color={avatarColor(n.authorUserId)} size="sm" title={author} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{author}</strong>
                    <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{relTime(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--text)]">{n.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---- Внешние ссылки + добавить (приватные URL отбраковываются 400 → commsErr) ---- */
function ExternalLinksCard({ links, busy, onAdd }: { links: MeetingExternalLink[]; busy: boolean; onAdd: (input: { provider: MeetingExternalLinkProvider; url: string; title: string }) => Promise<boolean> }) {
  const [provider, setProvider] = useState<MeetingExternalLinkProvider>("zoom");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const valid = Boolean(url.trim() && title.trim());
  const submit = async () => {
    if (!valid) return;
    const ok = await onAdd({ provider, url: url.trim(), title: title.trim() });
    if (ok) { setUrl(""); setTitle(""); }
  };
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
      <h3 className="mb-3 flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
        <Link2 className="size-4" aria-hidden /> Внешние ссылки
        <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{links.length}</span>
      </h3>
      {links.length === 0 ? (
        <p className="mb-3 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Ссылок пока нет.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-2.5 py-1.5">
              <Chip variant="violet">{PROVIDER_LABEL[l.provider]}</Chip>
              <a href={l.url} target="_blank" rel="noreferrer" className="truncate text-[length:var(--text-sm)] text-[var(--accent-text)] underline-offset-2 hover:underline" title={l.url}>{l.title}</a>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <label className={labelCls}>Провайдер
            <select value={provider} onChange={(e) => setProvider(e.target.value as MeetingExternalLinkProvider)} className={selCls}>
              {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
            </select>
          </label>
          <label className={labelCls}>Название<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Комната встречи" /></label>
        </div>
        <label className={labelCls}>URL<Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://zoom.us/j/…" /></label>
        <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Ссылки на приватные адреса (localhost, внутренняя сеть) отклоняются сервером.</p>
        <div className="flex justify-end">
          <Button variant="default" size="sm" disabled={busy || !valid} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Добавить</Button>
        </div>
      </div>
    </section>
  );
}

/* ---- Action-items (чек-список, status ВСЕГДА open — мутации статуса НЕТ) ---- */
function ActionItemsCard({ items, busy, onAdd, onPatchStatus, users }: { items: MeetingActionItem[]; busy: boolean; onAdd: (input: ActionItemInput) => Promise<boolean>; onPatchStatus: (actionItemId: string, status: MeetingActionItemStatus) => void; users: CommsUsersDir }) {
  const [title, setTitle] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Ответственный по умолчанию — первый из справочника (подставляем, когда список загрузился).
  useEffect(() => {
    if (!ownerUserId && users.list[0]) setOwnerUserId(users.list[0].id);
  }, [users.list, ownerUserId]);
  const valid = Boolean(title.trim() && ownerUserId);
  const submit = async () => {
    if (!valid) return;
    const ok = await onAdd({ title: title.trim(), ownerUserId, dueDate: dueDate || null });
    if (ok) { setTitle(""); setDueDate(""); }
  };
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
      <h3 className="mb-1 flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
        <CheckSquare className="size-4" aria-hidden /> Задачи по итогам
        <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{items.length}</span>
      </h3>
      <p className="mb-3 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Создаются со статусом «Открыта»; статус можно изменить селектом.</p>
      {items.length === 0 ? (
        <p className="mb-3 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Задач по итогам встречи пока нет.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {items.map((it) => {
            const owner = users.name(it.ownerUserId);
            return (
              <li key={it.id} className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[length:var(--text-sm)] text-[var(--text)]", it.status !== "open" && "text-[var(--muted)] line-through")}>{it.title}</p>
                  <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
                    {owner}
                    {it.dueDate ? ` · срок ${it.dueDate}` : ""}
                  </p>
                </div>
                <select value={it.status} disabled={busy} onChange={(e) => onPatchStatus(it.id, e.target.value as MeetingActionItemStatus)} className={cn(selCls, "h-8 w-[116px]")} title="Изменить статус задачи">
                  <option value="open">Открыта</option>
                  <option value="done">Готово</option>
                  <option value="cancelled">Отменена</option>
                </select>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-2.5">
        <label className={labelCls}>Задача<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать…" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className={labelCls}>Ответственный
            <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={selCls}>
              {users.list.length === 0 ? <option value="" disabled>Загрузка…</option> : null}
              {users.list.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className={labelCls}>Срок<Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        </div>
        <div className="flex justify-end">
          <Button variant="default" size="sm" disabled={busy || !valid} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Добавить</Button>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Диалог создания встречи: title, agenda, start/finish (datetime-local),
   участники — мультивыбор userId + role (Switch на каждого).
   ============================================================ */
function CreateMeetingDialog({
  busy,
  setBusy,
  create,
  users,
  entityType,
  entityId
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  create: ReturnType<typeof useMeetings>["createMeeting"];
  users: CommsUsersDir;
  entityType: EntityType;
  entityId: string;
}) {
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  // Дефолтные времена (от «сейчас», локальные).
  const [start, setStart] = useState(() => toLocalInput(new Date(Date.now() + 86_400_000).toISOString()));
  const [finish, setFinish] = useState(() => toLocalInput(new Date(Date.now() + 86_400_000 + 3_600_000).toISOString()));
  // Мультивыбор участников: userId → role (или отсутствует = не выбран).
  const [picked, setPicked] = useState<Record<string, MeetingParticipantRole>>({});

  const toggle = (userId: string, on: boolean) =>
    setPicked((p) => {
      const next = { ...p };
      if (on) next[userId] = next[userId] ?? "required";
      else delete next[userId];
      return next;
    });
  const setRole = (userId: string, role: MeetingParticipantRole) => setPicked((p) => ({ ...p, [userId]: role }));

  const schedOk = Boolean(start && finish && new Date(finish).getTime() > new Date(start).getTime());
  const valid = Boolean(title.trim()) && schedOk;

  const reset = () => { setTitle(""); setAgenda(""); setPicked({}); };

  return (
    <FormDialog
      title="Новая встреча"
      trigger={<Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Встреча</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy}
      successToast="Встреча создана"
      onClose={reset}
      // Ошибка остаётся В модалке — по месту действия.
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        const participants = Object.entries(picked).map(([userId, role]) => ({ userId, role }));
        // exactOptionalPropertyTypes: опускаем agenda/participants, а не шлём undefined.
        const input: MeetingCreateInput = {
          entityType,
          entityId,
          title: title.trim(),
          scheduledStart: fromLocalInput(start),
          scheduledFinish: fromLocalInput(finish)
        };
        if (agenda.trim()) input.agenda = agenda.trim();
        if (participants.length) input.participants = participants;
        const res = await create(input);
        setBusy(false);
        return res.ok ? null : `Отклонено: ${commsErr(res.code, res.message)}`;
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={`col-span-2 ${labelCls}`}>Название<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kickoff релиза" /></label>
        <label className={`col-span-2 ${labelCls}`}>Повестка<Textarea rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Цели, распределение задач, риски…" /></label>
        <label className={labelCls}>Начало<Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className={labelCls}>Окончание<Input type="datetime-local" value={finish} onChange={(e) => setFinish(e.target.value)} aria-invalid={!schedOk} /></label>
      </div>
      {!schedOk ? <p className="text-[length:var(--text-xs)] text-[var(--danger-text)]">Окончание должно быть позже начала.</p> : null}

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-2.5">
        <div className="mb-2 text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">Участники</div>
        <ul className="flex flex-col gap-2">
          {users.list.length === 0 ? <li className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Загрузка участников…</li> : null}
          {users.list.map((u) => {
            const on = u.id in picked;
            return (
              <li key={u.id} className="flex items-center gap-2">
                <Switch checked={on} onCheckedChange={(v) => toggle(u.id, v)} />
                <BemAvatar initials={initials(u.name)} color={avatarColor(u.id)} size="sm" title={u.name} />
                <span className="mr-auto text-[length:var(--text-sm)] text-[var(--text)]">{u.name}</span>
                <select value={picked[u.id] ?? "required"} disabled={!on} onChange={(e) => setRole(u.id, e.target.value as MeetingParticipantRole)} className={cn(selCls, "w-[150px]")}>
                  <option value="required">Обязателен</option>
                  <option value="optional">Опционально</option>
                </select>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Организатором становится текущий пользователь; выбранным участникам придёт приглашение на встречу.</p>
      </div>
    </FormDialog>
  );
}
