"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { SurfaceState } from "@/components/domain/surface-state";
import { Bento, BentoCard, StatTile } from "@/delivery/ui/bento";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { cn } from "@/lib/cn";
import { useOpportunities } from "@/crm/lib/use-crm";
import { useMyWork, useProjects } from "@/workspace/lib/use-workspace";
import type { TaskRecord, TaskStatusCategory } from "@/workspace/lib/workspace-client";
import type { Opportunity } from "@/crm/lib/crm-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { OPP_OPEN, OPP_STATUS_LABEL, buildAttentionSignals, fmtDate, localIsoDay } from "./attention-signals";

/* ============================================================
   Workspace/Дашборд — summary-first сводка на КЛИЕНТСКОЙ АГРЕГАЦИИ
   реальных контрактов (tenant-широкого агрегата нет ни у одной ручки):
   - Мои задачи      → useMyWork()          (GET /api/workspace/my-work)
   - Активные проекты → useProjects()        (GET /api/workspace/projects)
   - Сделки          → useOpportunities()   (GET /api/workspace/opportunities)

   Каждый источник — ровно один запрос под одним правом: полный useCrm()
   (8+ ручек, каждая под своим правом) здесь сознательно не используется —
   403 на products/contacts гасил бы сигналы по сделкам целиком, а
   /api/workspace/projects грузился бы дважды.

   Грамматика (PR9): сверху — «Требует внимания» (реальные сигналы:
   просроченные задачи/сделки, приближающиеся дедлайны, сделки без
   движения), каждый сигнал и каждое число — drill-down к причине
   (/my-work?task=, /crm/deals?deal=, /projects). Сигналы, для которых
   нет данных в API (митинги, перегрузка ресурсов, pending-предложения
   агента), НЕ выдумываются и не показываются. Декоративные блоки
   («Встречи и сигналы»-плейсхолдер, плитка «Сделки выиграны» без
   действия) удалены сознательно.
   Переключение на боевой = apiOrigin; данные in-memory.
   ============================================================ */

// RU-маппинг кодов загрузки (как myWorkErr/crmErr в соседних surface).
const ERR_RU: Record<string, string> = {
  permission_missing: "Недостаточно прав для просмотра этого раздела",
  load_failed: "Не удалось загрузить данные",
  request_failed: "Ошибка запроса к серверу",
  not_found: "Данные не найдены"
};
const dashboardErr = (code?: string) => (code && ERR_RU[code]) || code || "Не удалось собрать сводку";

const money = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`
    : `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс ₽`;

const TASK_STATUS_LABEL: Record<TaskStatusCategory, string> = {
  new: "Новые",
  waiting: "Ожидание",
  in_progress: "В работе",
  review: "На проверке",
  done: "Готово"
};
const TASK_STATUS_TONE: Record<TaskStatusCategory, "info" | "violet" | "warning" | "success" | undefined> = {
  new: undefined,
  waiting: "warning",
  in_progress: "info",
  review: "violet",
  done: "success"
};

/** Per-source вид для контента: после settled источник либо ready (данные есть),
 *  либо forbidden (403 — честная копия про роль), либо error (500/сеть — «Не
 *  удалось загрузить» + повтор ИМЕННО этого источника). Раньше оба провала
 *  схлопывались в data=null, и при 500 показывалась копия про роль. */
type SourceView<T> = {
  data: T | null;
  status: "ready" | "forbidden" | "error";
  reload: () => Promise<void>;
};

const srcStatus = (s: { data: unknown; status: string }): SourceView<never>["status"] =>
  s.data ? "ready" : s.status === "forbidden" ? "forbidden" : "error";

export function DashboardSurface() {
  const myWork = useMyWork();
  const projects = useProjects();
  const opportunities = useOpportunities();

  // Повиджетная деградация (G8-06): один недоступный источник (403/ошибка) не
  // убивает весь дашборд — его секция показывает «нет доступа», остальные живут.
  // Целиком forbidden/error — только когда ВСЕ три источника недоступны.
  const sources = [myWork, projects, opportunities];
  const settled = sources.every((s) => Boolean(s.data) || s.status === "error" || s.status === "forbidden");
  const allForbidden = sources.every((s) => s.status === "forbidden");
  const allFailed = sources.every((s) => !s.data && (s.status === "error" || s.status === "forbidden"));
  const surfaceStatus = !settled ? "loading" : allForbidden ? "forbidden" : allFailed ? "error" : "ready";
  const errorCode = myWork.error ?? projects.error ?? opportunities.error ?? null;

  return (
    <WorkspaceShell activeNav="Дашборд">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <ProtoBanner />
        <div className="mb-3">
          <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Дашборд</h1>
          {/* «каждая карточка», не «каждое число»: счётчики воронки по статусам — честный текст,
              URL-фильтра по статусу у /crm/deals нет, обещать drill-down каждой цифре — оверклейм. */}
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Сначала сигналы, затем сводка — каждая карточка ведёт к источнику</p>
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={errorCode}
          onRetry={() => {
            void myWork.reload();
            void projects.reload();
            void opportunities.reload();
          }}
          loadingLabel="Собираем сводку…"
          errorTitle="Не удалось собрать сводку"
          errorFormat={dashboardErr}
          forbidden={{
            title: "Дашборд недоступен вашей роли",
            description: "Нет прав ни на один из разделов сводки (задачи, проекты, CRM). Доступные вам разделы — в меню слева; за расширением прав обратитесь к администратору."
          }}
        >
          {settled && !allFailed ? (
            <DashboardContent
              tasks={{ data: myWork.data?.tasks ?? null, status: srcStatus(myWork), reload: myWork.reload }}
              projects={{
                data: projects.data
                  ? { count: projects.data.projects.length, hours: projects.data.projects.reduce((s, p) => s + p.plannedHours, 0) }
                  : null,
                status: srcStatus(projects),
                reload: projects.reload
              }}
              opportunities={{ data: opportunities.data, status: srcStatus(opportunities), reload: opportunities.reload }}
            />
          ) : (
            <span />
          )}
        </SurfaceState>
      </main>
    </WorkspaceShell>
  );
}

// Секция, недоступная роли: компактная честная пометка вместо падения всей сводки.
function NoAccessNote({ what }: { what: string }) {
  return (
    <p className="px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">
      {what} недоступны вашей роли.
    </p>
  );
}

// Инлайн-повтор конкретного источника (ошибка 500/сети — НЕ вопрос прав).
function RetryInline({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <button
      type="button"
      onClick={() => void onRetry()}
      className="rounded-[var(--radius-sm)] font-medium text-[var(--accent)] underline-offset-2 outline-none hover:underline focus-visible:shadow-[var(--ring-focus)]"
    >
      Повторить
    </button>
  );
}

// Секция, которую не удалось загрузить (500/сеть): честная ошибка + повтор
// именно этого источника — а не копия «недоступны вашей роли».
function LoadErrorNote({ what, onRetry }: { what: string; onRetry: () => Promise<void> }) {
  return (
    <p className="px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">
      Не удалось загрузить {what}. <RetryInline onRetry={onRetry} />
    </p>
  );
}

// Общий стиль строки-ссылки в списках сводки: hover-подсветка + видимый фокус.
const rowLinkCls =
  "flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-2.5 outline-none last:border-0 hover:bg-[var(--panel-subtle)] focus-visible:shadow-[var(--ring-focus)]";

// Ссылка «весь раздел» в шапке карточки.
function CardAllLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-[var(--radius-sm)] text-[length:var(--text-sm)] font-medium text-[var(--accent)] underline-offset-2 outline-none hover:underline focus-visible:shadow-[var(--ring-focus)]"
    >
      {children}
    </Link>
  );
}

function AttentionCard({
  tasks,
  opportunities
}: {
  tasks: SourceView<TaskRecord[]>;
  opportunities: SourceView<Opportunity[]>;
}) {
  const { shown, restCount } = useMemo(
    () => buildAttentionSignals(tasks.data, opportunities.data),
    [tasks.data, opportunities.data]
  );
  // Честность по статусу источника: forbidden (нет прав) и error (не загрузилось) —
  // разные состояния с разной копией; повтор — у конкретного упавшего источника.
  const forbidden = [
    tasks.status === "forbidden" ? "задачам" : null,
    opportunities.status === "forbidden" ? "сделкам" : null
  ].filter((v): v is string => v !== null);
  const errored = [
    tasks.status === "error" ? { what: "задачи", reload: tasks.reload } : null,
    opportunities.status === "error" ? { what: "сделки", reload: opportunities.reload } : null
  ].filter((v): v is { what: string; reload: () => Promise<void> } => v !== null);
  // «И ещё N» называет только ДОСТУПНЫЕ разделы (переполнение возможно лишь от
  // источника с данными) — и ведёт в них ссылками, а не голым текстом.
  const restLinks = [
    tasks.data !== null ? { label: "Мои задачи", href: "/my-work" } : null,
    opportunities.data !== null ? { label: "Сделки", href: "/crm/deals" } : null
  ].filter((v): v is { label: string; href: string } => v !== null);
  // «Всё чисто» честно только когда ОБА источника реально рассчитаны: при
  // недоступном разделе пустой список — не доказательство отсутствия сигналов.
  const evaluated = [
    tasks.data !== null ? "задачам" : null,
    opportunities.data !== null ? "сделкам" : null
  ].filter((v): v is string => v !== null);
  const emptyCopy =
    evaluated.length === 2
      ? "Сигналов нет: просроченных задач и застрявших сделок не найдено."
      : evaluated.length === 1
        ? `Сигналов по ${evaluated[0]} нет.`
        : "Сигналы не рассчитаны.";

  return (
    <BentoCard
      title="Требует внимания"
      subtitle="Просроченное, приближающиеся дедлайны и сделки без движения — из ваших задач и CRM"
      span={12}
      flush
      headingLevel={2}
    >
      {shown.length === 0 ? (
        <p className="px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">
          {emptyCopy}
        </p>
      ) : (
        <ul className="flex flex-col" aria-label="Сигналы, требующие внимания">
          {shown.map((s) => (
            <li key={s.key}>
              <Link href={s.href} aria-label={s.ariaLabel} className={rowLinkCls}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{s.title}</span>
                  <span className="block truncate text-[length:var(--text-xs)] text-[var(--muted-soft)]">{s.detail}</span>
                </span>
                <Chip variant={s.tone}>{s.chip}</Chip>
                <span className="hidden shrink-0 text-[length:var(--text-xs)] text-[var(--muted)] sm:inline">открыть →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {restCount > 0 || forbidden.length > 0 || errored.length > 0 ? (
        <p className="border-t border-[var(--border-subtle)] px-4 py-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
          {restCount > 0 && restLinks.length > 0 ? (
            <>
              И ещё {restCount} — полные списки в{" "}
              {restLinks.map((l, i) => (
                <span key={l.href}>
                  {i > 0 ? " и " : ""}
                  <Link
                    href={l.href}
                    className="rounded-[var(--radius-sm)] font-medium text-[var(--accent)] underline-offset-2 outline-none hover:underline focus-visible:shadow-[var(--ring-focus)]"
                  >
                    «{l.label}»
                  </Link>
                </span>
              ))}
              .{" "}
            </>
          ) : null}
          {forbidden.length > 0 ? `Сигналы по ${forbidden.join(" и ")} не рассчитываются: раздел недоступен вашей роли. ` : ""}
          {errored.map((e) => (
            <span key={e.what}>
              Не удалось загрузить {e.what} — сигналы по ним не рассчитаны. <RetryInline onRetry={e.reload} />{" "}
            </span>
          ))}
        </p>
      ) : null}
    </BentoCard>
  );
}

function DashboardContent({
  tasks,
  projects,
  opportunities
}: {
  tasks: SourceView<TaskRecord[]>;
  projects: SourceView<{ count: number; hours: number }>;
  opportunities: SourceView<Opportunity[]>;
}) {
  // Фильтр — внутри useMemo с зависимостью [tasks.data]: раньше activeTasks строился
  // заново на каждый рендер, и мемоизация upcoming по [activeTasks] была фиктивной.
  const { activeTasks, upcoming } = useMemo(() => {
    const active = (tasks.data ?? []).filter((t) => t.statusCategory !== "done");
    return {
      activeTasks: active,
      upcoming: [...active].sort((a, b) => a.plannedFinish.localeCompare(b.plannedFinish)).slice(0, 6)
    };
  }, [tasks.data]);
  const today = localIsoDay();
  const overdueCount = activeTasks.filter((t) => t.plannedFinish.slice(0, 10) < today).length;
  const inProgressCount = activeTasks.filter((t) => t.statusCategory === "in_progress").length;

  // Агрегаты по сделкам (data=null: раздел недоступен роли либо не загрузился).
  const openOpps = (opportunities.data ?? []).filter((o) => OPP_OPEN.includes(o.status));
  const openValue = openOpps.reduce((s, o) => s + o.contractValue, 0);
  const oppsByStatus = useMemo(() => {
    const order: Opportunity["status"][] = ["new", "feasibility", "ready_to_activate", "won_closed", "lost_rejected"];
    return order
      .map((s) => ({ status: s, count: (opportunities.data ?? []).filter((o) => o.status === s).length }))
      .filter((r) => r.count > 0);
  }, [opportunities.data]);

  // Подпись KPI-плитки для недоступного источника: роль — только при forbidden.
  const failDelta = (s: SourceView<unknown>) => (s.status === "forbidden" ? "нет доступа" : "не удалось загрузить");

  return (
    <div className="flex flex-col gap-3">
      {/* Summary-first: реальные сигналы наверху, до любых агрегатов. */}
      <Bento>
        <AttentionCard tasks={tasks} opportunities={opportunities} />
      </Bento>

      {/* KPI-плитки — реальные агрегаты, каждая ведёт к источнику; недоступный источник → «—» без ссылки
          («нет доступа» при forbidden, «не удалось загрузить» при ошибке) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Мои задачи"
          value={tasks.data ? tasks.data.length : "—"}
          delta={!tasks.data ? failDelta(tasks) : overdueCount > 0 ? `${overdueCount} просрочено` : `${inProgressCount} в работе`}
          tone={tasks.data && overdueCount > 0 ? "danger" : "default"}
          {...(tasks.data ? { href: "/my-work" } : {})}
        />
        <StatTile
          label="Открытые сделки"
          value={opportunities.data ? openOpps.length : "—"}
          delta={opportunities.data ? money(openValue) : failDelta(opportunities)}
          tone="default"
          {...(opportunities.data ? { href: "/crm/deals" } : {})}
        />
        <StatTile
          label="Активные проекты"
          value={projects.data ? projects.data.count : "—"}
          delta={projects.data ? `${projects.data.hours.toLocaleString("ru-RU")} ч плана` : failDelta(projects)}
          tone="default"
          {...(projects.data ? { href: "/projects" } : {})}
        />
      </div>
      {/* У проектов нет собственной карточки ниже — повтор упавшего источника живёт под плитками. */}
      {projects.status === "error" ? (
        <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">
          Не удалось загрузить проекты — счётчик не рассчитан. <RetryInline onRetry={projects.reload} />
        </p>
      ) : null}

      <Bento>
        {/* Ближайшие задачи — реальные my-work; строка — drill-down в /my-work?task= */}
        <BentoCard
          title="Ближайшие задачи"
          subtitle="Мои незавершённые задачи по плановому финишу"
          actions={tasks.data !== null ? <CardAllLink href="/my-work">Все задачи</CardAllLink> : undefined}
          span={7}
          flush
          headingLevel={2}
        >
          {tasks.status === "forbidden" ? (
            <NoAccessNote what="Задачи" />
          ) : tasks.status === "error" ? (
            <LoadErrorNote what="задачи" onRetry={tasks.reload} />
          ) : upcoming.length === 0 ? (
            <p className="px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">Незавершённых задач нет — всё закрыто.</p>
          ) : (
            <ul className="flex flex-col">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/my-work?task=${encodeURIComponent(t.id)}`}
                    aria-label={`Открыть задачу «${t.title}» в Моих задачах`}
                    className={rowLinkCls}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{t.title}</span>
                      <span className="block truncate text-[length:var(--text-xs)] text-[var(--muted-soft)]">{t.statusName} · прогресс {t.progress}%</span>
                    </span>
                    <Chip variant={TASK_STATUS_TONE[t.statusCategory]}>{TASK_STATUS_LABEL[t.statusCategory]}</Chip>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[length:var(--text-xs)] text-[var(--muted)]">
                      <CalendarClock className="size-3.5" aria-hidden />
                      <span className="v4-num">{fmtDate(t.plannedFinish)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </BentoCard>

        {/* Воронка сделок — реальное распределение по статусам; drill-down — «Все сделки» */}
        <BentoCard
          title="Сделки по статусам"
          subtitle="Распределение возможностей CRM"
          actions={opportunities.data !== null ? <CardAllLink href="/crm/deals">Все сделки</CardAllLink> : undefined}
          span={5}
          headingLevel={2}
        >
          {opportunities.status === "forbidden" ? (
            <NoAccessNote what="Сделки" />
          ) : opportunities.status === "error" ? (
            <LoadErrorNote what="сделки" onRetry={opportunities.reload} />
          ) : oppsByStatus.length === 0 ? (
            <p className="py-4 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">Сделок пока нет.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {oppsByStatus.map((r) => {
                const pct = Math.round((r.count / (opportunities.data?.length || 1)) * 100);
                return (
                  <li key={r.status} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[length:var(--text-sm)] text-[var(--muted-strong)]">{OPP_STATUS_LABEL[r.status]}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-strong)]">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          r.status === "won_closed" ? "bg-[var(--success)]" : r.status === "lost_rejected" ? "bg-[var(--danger)]" : "bg-[var(--accent)]"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="v4-num w-6 shrink-0 text-right text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{r.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </BentoCard>
      </Bento>
    </div>
  );
}

function ProtoBanner() {
  if (!prototypeNotesEnabled) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--text-strong)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
      <span>
        Клиентская агрегация реальных контрактов: GET /api/workspace/my-work + /projects + /opportunities. Tenant-широкого
        агрегата у ручек нет — сигналы «Требует внимания» и KPI считаются на клиенте из этих трёх источников; сигналов без
        данных в API (митинги, перегрузка ресурсов) здесь нет сознательно. Переключение на боевой = apiOrigin; данные in-memory.
      </span>
    </div>
  );
}
