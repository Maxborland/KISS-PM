"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  AtSign,
  Link2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Send,
  Smile,
  Trash2,
  TriangleAlert,
  X
} from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SurfaceState } from "@/components/domain/surface-state";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { deriveProjectMeta, PROJECT_FALLBACK, planningErr } from "@/delivery/lib/project-chrome";
import { MOCK_PROJECT_ID } from "@/delivery/lib/mock-planning-backend";
import { usePlanning } from "@/delivery/lib/use-planning";
import { useConversation } from "@/communications/lib/use-comms";
import { avatarColor, commsErr, initials, relTime, userName } from "@/communications/lib/comms-bits";
import type { Message } from "@/communications/lib/comms-client";
import { demoAction } from "@/views/lib/demo";

const MIN_PER_DAY = 480; // 8 рабочих часов = «день» длительности (зеркало мока)

// Базовая шапка проекта: имя/код/статус; planVersion/finish/deadline/variance
// перезапишет deriveProjectMeta из живого read-model (не хардкод старого PROJECT-литерала
// с фиксированным finish «14.06.2026»). Берём PROJECT_FALLBACK как нейтральную базу.
const PROJECT_BASE: ProjectMeta = PROJECT_FALLBACK;

// «Я» прототипа в коммуникациях = u-anna (зеркало CURRENT_ACTOR_ID мока comms).
const ME = "u-anna";

// Табы героя-панели. Реальными данными подкреплён только «Чат» (контракт communications);
// остальные — честные заглушки «появится в рабочем приложении».
const TABS = ["Чат", "Файлы", "Встречи", "Аудит"] as const;
type Tab = (typeof TABS)[number];

/* ---- Проекции read-model (форма из mock-planning-backend.buildReadModel) ---- */
type AuthoredTask = {
  id: string;
  wbsCode: string;
  title: string;
  statusId: string;
  plannedStart: string;
  plannedFinish: string;
  durationMinutes: number | null;
  workMinutes: number;
  percentComplete: number;
  calendarId: string | null;
  customFields?: { kind?: string; resLabel?: string };
};
type CalcTask = { id: string; calculatedStart: string; calculatedFinish: string; totalSlackMinutes: number | null; isCritical: boolean };
type Dependency = { id: string; predecessorTaskId: string; successorTaskId: string; type: string; lagMinutes: number };

const STATUS_RU: Record<string, { label: string; cls: string }> = {
  todo: { label: "К выполнению", cls: "bg-[var(--panel-strong)] text-[var(--muted-strong)]" },
  in_progress: { label: "В работе", cls: "bg-[var(--accent-soft)] text-[var(--accent)]" },
  done: { label: "Завершено", cls: "bg-[var(--success-soft)] text-[var(--success-text)]" }
};
// Подписи типов связей (predecessor→successor) из контракта зависимостей.
const DEP_TYPE_RU: Record<string, string> = { FS: "ОН", SS: "НН", FF: "ОО", SF: "НО" };

const ddmmyyyy = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
};
// Длительность/резерв в днях из минут контракта (480 мин = 1 день).
const minToDays = (min: number | null): number | null => (min == null ? null : Math.round((min / MIN_PER_DAY) * 10) / 10);

export function TaskInspector() {
  const { readModel, status, error, reload } = usePlanning(MOCK_PROJECT_ID);

  // Выбираем КОНКРЕТНУЮ задачу из read-model: первый лист (есть длительность, не веха)
  // с предшественником — у такой задачи осмысленны и «Зависимости», и критпуть.
  // Если зависимостей нет ни у кого — берём первый лист. Только из реальных данных.
  const picked = useMemo(() => {
    if (!readModel) return null;
    const tasks = (readModel.authored as unknown as { tasks: AuthoredTask[] }).tasks;
    const deps = (readModel.authored as unknown as { dependencies: Dependency[] }).dependencies;
    const cp = readModel.calculatedPlan as unknown as { tasks: CalcTask[] };
    const calcById = new Map(cp.tasks.map((c) => [c.id, c]));
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const leaves = tasks.filter((t) => t.durationMinutes != null && t.customFields?.kind !== "milestone");
    const withPred = leaves.find((t) => deps.some((d) => d.successorTaskId === t.id));
    const task = withPred ?? leaves[0] ?? null;
    if (!task) return null;
    const calc = calcById.get(task.id) ?? null;
    // предшественники выбранной задачи → строки «Зависимости» (wbs/тип/название предка)
    const predecessors = deps
      .filter((d) => d.successorTaskId === task.id)
      .map((d) => {
        const pred = byId.get(d.predecessorTaskId);
        return {
          id: d.id,
          wbs: pred?.wbsCode ?? d.predecessorTaskId,
          type: DEP_TYPE_RU[d.type] ?? d.type,
          name: pred?.title ?? "—",
          lagDays: minToDays(d.lagMinutes) ?? 0
        };
      });
    return { task, calc, predecessors };
  }, [readModel]);

  // Верхнеуровневое состояние через <SurfaceState>: loading/forbidden/error/empty.
  // Frame-обёртку сохраняем всегда; шапку до загрузки берём из PROJECT_FALLBACK.
  if (status !== "ready" || !readModel || !picked) {
    const surfaceStatus =
      status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : status === "ready" ? "empty" : "error";
    return (
      <DeliveryFrame project={PROJECT_FALLBACK} activeTab="График">
        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={planningErr}
          loadingLabel="Загрузка задачи…"
          empty={{ title: "Нет задач в плане", description: "Read-model проекта не содержит задач для инспектора." }}
        >
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const { task, calc, predecessors } = picked;
  const project = deriveProjectMeta(readModel, PROJECT_BASE);
  const st = STATUS_RU[task.statusId] ?? { label: task.statusId, cls: "bg-[var(--panel-strong)] text-[var(--muted-strong)]" };
  const slackDays = minToDays(calc?.totalSlackMinutes ?? null);
  const isCritical = Boolean(calc?.isCritical);

  // «Свойства» — только поля, которые реально отдаёт read-model (без выдумок).
  const facts: { label: string; value: ReactNode; mono?: boolean }[] = [
    { label: "Начало", value: ddmmyyyy(calc?.calculatedStart ?? task.plannedStart), mono: true },
    { label: "Финиш", value: ddmmyyyy(calc?.calculatedFinish ?? task.plannedFinish), mono: true },
    { label: "Длительность", value: `${minToDays(task.durationMinutes) ?? "—"} дн`, mono: true },
    { label: "Работа", value: `${Math.round(task.workMinutes / 60)} ч`, mono: true },
    { label: "Исполнитель", value: task.customFields?.resLabel || "—" },
    { label: "Календарь", value: task.calendarId ?? "—" },
    ...(slackDays != null ? [{ label: "Резерв", value: `${slackDays} дн`, mono: true }] : [])
  ];

  return (
    <DeliveryFrame project={project} activeTab="График">
      {/* Sub-header: реальные wbs/title/план-версия + флаг критпути из read-model */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          className="v4-row flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-[length:var(--text-sm)] font-medium text-[var(--accent)]"
          {...demoAction("навигация на График")}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          График
        </button>
        <h2 className="font-[family-name:var(--font-display)] text-[19px] font-extrabold tracking-[-0.02em] text-[var(--text-strong)]">{task.title}</h2>
        <span className="v4-mono text-[length:var(--text-sm)] text-[var(--muted)]">WBS {task.wbsCode} · {project.planVersion}</span>
        {isCritical ? (
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--danger-soft)] px-2 py-0.5 text-[length:var(--text-sm)] font-medium text-[var(--danger-text)]">
            <TriangleAlert className="size-3" aria-hidden /> На критическом пути
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="secondary" size="sm" {...demoAction("открытие в Gantt")}>Открыть в Gantt</Button>
          <Button variant="destructive-soft" size="sm" {...demoAction("удаление задачи")}>Удалить</Button>
        </div>
      </div>

      {/* Баннер честности: какие контракты реально подключены */}
      <PrototypeBanner />

      <div className="v4-split mt-3">
        {/* MAIN = ЧАТ задачи (герой) на контракте communications */}
        <div className="flex h-[640px] min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <TaskHero taskId={task.id} taskTitle={task.title} />
        </div>

        {/* ASIDE = свойства/факты/зависимости из planning read-model (вторично) */}
        <aside className="v4-split__aside flex flex-col gap-3">
          <FactsCard title="Свойства">
            <dl className="flex flex-col">
              <div className="flex items-center justify-between gap-3 py-1.5">
                <dt className="text-[length:var(--text-sm)] text-[var(--muted-strong)]">Статус</dt>
                <dd>
                  <span className={cn("inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-[length:var(--text-sm)] font-medium", st.cls)}>{st.label}</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] py-1.5">
                <dt className="text-[length:var(--text-sm)] text-[var(--muted-strong)]">Прогресс</dt>
                <dd><ProgressMini value={task.percentComplete} critical={isCritical} /></dd>
              </div>
              {facts.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] py-1.5">
                  <dt className="shrink-0 text-[length:var(--text-sm)] text-[var(--muted-strong)]">{f.label}</dt>
                  <dd className={cn("min-w-0 truncate text-right text-[length:var(--text-md)] text-[var(--text-strong)]", f.mono && "v4-num")}>{f.value}</dd>
                </div>
              ))}
            </dl>
          </FactsCard>

          <FactsCard title="Зависимости">
            {predecessors.length ? (
              <ul className="flex flex-col gap-1.5">
                {predecessors.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-[length:var(--text-sm)]">
                    <Link2 className="size-3.5 shrink-0 text-[var(--muted-soft)]" aria-hidden />
                    <span className="v4-mono text-[var(--muted)]">{d.wbs}</span>
                    <span className="rounded-[var(--radius-xs)] bg-[var(--panel-strong)] px-1.5 text-[10px] font-semibold text-[var(--muted-strong)]" title={`Тип связи · лаг ${d.lagDays} дн`}>{d.type}</span>
                    <span className="truncate text-[var(--text)]">{d.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Предшественников нет.</p>
            )}
          </FactsCard>
        </aside>
      </div>
    </DeliveryFrame>
  );
}

// Честный баннер «Прототип»: реальные контракты + in-memory + переключение на боевой.
function PrototypeBanner() {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
      <span>
        Реальные контракты: свойства/зависимости — GET planning read-model; чат — GET/POST conversations/messages (entity «task»). Данные in-memory; переключение на боевой API = смена apiOrigin, без изменения UI.
      </span>
    </div>
  );
}

/* ---- Карточка факта ---- */
function FactsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <h3 className="border-b border-[var(--border-subtle)] px-3.5 py-2.5 text-[length:var(--text-xs)] font-bold uppercase tracking-[0.05em] text-[var(--muted-soft)]">{title}</h3>
      <div className="px-3.5 py-2.5">{children}</div>
    </section>
  );
}

function ProgressMini({ value, critical }: { value: number; critical?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--panel-strong)]">
        <span className={cn("block h-full rounded-full", critical ? "bg-[var(--critical-stripe)]" : "bg-[var(--success)]")} style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      <span className="v4-num text-[length:var(--text-sm)] text-[var(--muted-strong)]">{value}%</span>
    </span>
  );
}

/* ============================================================
   Герой-панель: табы + лента ЧАТА задачи на контракте communications.
   Отдельный компонент, чтобы useConversation монтировался со СТАБИЛЬНЫМ
   entityId выбранной задачи (хук-порядок не зависит от загрузки плана).
   ============================================================ */
function TaskHero({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const [tab, setTab] = useState<Tab>("Чат");
  // entityType="task": мок лениво создаёт default-беседу для (task, taskId) на GET —
  // лента может стартовать пустой, это честно («начните обсуждение задачи»).
  const conv = useConversation("task", taskId);
  const { data, status, error, reload } = conv;

  // Беседа задачи — единственная default-беседа сущности (ensureConversation на GET).
  const conversation = data?.conversations.find((c) => c.id === data.selectedConversationId) ?? null;
  const cid = conversation?.id ?? null;

  // Верхнеуровневый статус ленты: forbidden(403)/error/loading/ready.
  const feedStatus =
    status === "forbidden" ? "forbidden" : status === "error" || !data ? (status === "loading" ? "loading" : "error") : "ready";

  return (
    <>
      {/* Табы героя */}
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn("relative px-3 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors", active ? "text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text)]")}
            >
              {t}
              {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" /> : null}
            </button>
          );
        })}
      </div>

      {tab === "Чат" ? (
        <SurfaceState
          status={feedStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={commsErr}
          loadingLabel="Загрузка обсуждения…"
          height="100%"
          forbidden={{ title: "Нет доступа к обсуждению", description: "У вас нет прав на просмотр коммуникаций этой задачи." }}
        >
          {data && cid ? (
            <ChatPane key={cid} conv={conv} conversationId={cid} title={taskTitle} messages={data.messages} />
          ) : (
            <div className="grid flex-1 place-items-center px-4">
              <EmptyState title="Сообщений пока нет" description="Начните обсуждение задачи — отправьте первое сообщение." />
            </div>
          )}
        </SurfaceState>
      ) : (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <div className="text-[length:var(--text-md)] font-semibold text-[var(--text-strong)]">Раздел «{tab}»</div>
            <div className="mt-1 text-[length:var(--text-sm)] text-[var(--muted)]">Появится в рабочем приложении</div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---- Лента + композер беседы задачи (зеркало chat-surface) ---- */
function ChatPane({
  conv,
  conversationId,
  title,
  messages
}: {
  conv: ReturnType<typeof useConversation>;
  conversationId: string;
  title: string;
  messages: Message[];
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const cid = conversationId;

  // Хронологический порядок (мок отдаёт обратную курсорную пагинацию).
  const ordered = useMemo(() => [...messages].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)), [messages]);
  const pinned = useMemo(() => ordered.filter((m) => m.pinnedAt && !m.archivedAt), [ordered]);

  // Автопрокрутка вниз при изменении набора сообщений.
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [ordered.length, cid]);

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

  // Тоггл реакции по своему userId (контракт реакций поддержан мок-бэкендом).
  const toggleReaction = (m: Message, emoji: string) => {
    const mine = m.reactions.find((r) => r.userId === ME && r.emoji === emoji && !r.archivedAt);
    if (mine) void run(() => conv.removeReaction(cid, m.id, mine.id));
    else void run(() => conv.addReaction(cid, m.id, emoji));
  };

  return (
    <>
      {/* Шапка беседы */}
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <div className="mr-auto min-w-0">
          <h3 className="truncate text-[length:var(--text-sm)] font-bold text-[var(--text-strong)]">Обсуждение · {title}</h3>
          <p className="truncate text-[10px] text-[var(--muted-soft)]">{ordered.length} сообщ. · entity task</p>
        </div>
      </header>

      {/* Pinned-баннер */}
      {pinned.length ? (
        <div className="flex flex-col gap-1 border-b border-[var(--border)] bg-[var(--panel-subtle)] px-4 py-2">
          {pinned.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-[length:var(--text-xs)]">
              <Pin className="size-3 shrink-0 text-[var(--accent)]" aria-hidden />
              <span className="font-semibold text-[var(--muted-strong)]">{userName(m.authorUserId)}:</span>
              <span className="truncate text-[var(--muted)]">{m.body || "—"}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Лента */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          {ordered.length === 0 ? (
            <EmptyState title="Сообщений пока нет" description="Начните обсуждение задачи — отправьте первое сообщение." />
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

      {/* Композер: «Отправить» → реальный postMessage; вложения/упоминания/эмодзи — честно demoAction */}
      <Composer busy={busy} onSend={(body) => void run(() => conv.postMessage(cid, { body }))} />

      {notice ? <div key={notice} className="anim-rise-in-fast border-t border-[var(--border)] px-4 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </>
  );
}

// Бабл сообщения: аватар + автор + relTime + тело + реакции + hover-меню (как в chat-surface).
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

          {/* Hover-меню сообщения (реакции/правка/закрепить/удалить — все на реальном контракте) */}
          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <ReactionPicker busy={busy} onPick={onToggleReaction} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={busy} title="Действия с сообщением"><MoreHorizontal className="size-3.5" aria-hidden /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1">
                {mine ? <MenuItem icon={<Pencil className="size-3.5" aria-hidden />} label="Изменить" onClick={() => { setDraft(m.body); setEditing(true); }} disabled={busy} /> : null}
                <MenuItem icon={<Pin className="size-3.5" aria-hidden />} label="Закрепить" onClick={onPin} disabled={busy} />
                <MenuItem icon={<Trash2 className="size-3.5" aria-hidden />} label="Удалить" onClick={onDelete} disabled={busy} danger />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {editing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <Textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[60px]" autoFocus />
            <div className="flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="size-3.5" aria-hidden />Отмена</Button>
              <Button variant="default" size="sm" disabled={busy || !draft.trim() || draft.trim() === m.body} onClick={() => { onEdit(draft.trim()); setEditing(false); }}>Сохранить</Button>
            </div>
          </div>
        ) : (
          m.body ? <p className="mt-0.5 whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--text)]">{m.body}</p> : null
        )}

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

type GroupedReaction = { emoji: string; count: number; mine: boolean };
function groupReactions(reactions: Message["reactions"]): GroupedReaction[] {
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

const QUICK_EMOJI = ["👍", "🎉", "❤️", "🔥", "👀", "✅"];
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

// Композер: textarea + «Отправить» (реальный postMessage). Вложения/упоминания/эмодзи —
// честные demoAction/disabled: мок этих возможностей не поддерживает, не имитируем.
function Composer({ busy, onSend }: { busy: boolean; onSend: (body: string) => void }) {
  const [body, setBody] = useState("");
  const canSend = body.trim().length > 0;

  const submit = () => {
    if (!canSend || busy) return;
    onSend(body.trim());
    setBody("");
  };

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--panel-subtle)] p-2.5">
      <div className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--panel)]">
        <Textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Написать сообщение…  (Enter — отправить, Shift+Enter — перенос)"
          className="w-full resize-none border-0 bg-transparent px-3 py-2 text-[length:var(--text-md)] text-[var(--text)] outline-none focus-visible:ring-0 placeholder:text-[var(--muted-soft)]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex items-center gap-1 border-t border-[var(--border-subtle)] px-2 py-1.5">
          <button type="button" className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-50" {...demoAction("вложения")}><Paperclip className="size-4" aria-hidden /></button>
          <button type="button" className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-50" {...demoAction("упоминания")}><AtSign className="size-4" aria-hidden /></button>
          <button type="button" className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-50" {...demoAction("эмодзи в композере")}><Smile className="size-4" aria-hidden /></button>
          <Button variant="default" size="sm" className="ml-auto" disabled={busy || !canSend} onClick={submit}>
            <Send className="size-3.5" aria-hidden />
            Отправить
          </Button>
        </div>
      </div>
    </div>
  );
}
