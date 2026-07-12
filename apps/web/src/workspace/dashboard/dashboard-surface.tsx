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

const OPP_OPEN: Opportunity["status"][] = ["new", "feasibility", "ready_to_activate"];
const OPP_STATUS_LABEL: Record<Opportunity["status"], string> = {
  new: "Новые",
  feasibility: "Проверка",
  ready_to_activate: "Готовы",
  won_closed: "Выиграны",
  lost_rejected: "Проиграны"
};

const fmtDate = (iso: string) => {
  // ISO → дд.мм.гггг без зависимости от локали рантайма.
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso.slice(0, 10);
};

// Локальный день в ISO (YYYY-MM-DD) со сдвигом на deltaDays — для сравнения дат сигналов.
const localIsoDay = (deltaDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Порог «сделка без движения»: открыта и не обновлялась N дней. Порог показан в подписи сигнала. */
const STALE_DEAL_DAYS = 14;
/** Горизонт «дедлайн близко» для задач, дней. */
const DUE_SOON_DAYS = 7;
/** Максимум строк НА ГРУППУ сигналов (просроченные задачи/сделки, дедлайны, застой):
 *  одна шумная группа не вытесняет остальные; остаток — честной строкой «и ещё N». */
const MAX_ROWS_PER_GROUP = 4;

type AttentionSignal = {
  key: string;
  chip: string;
  tone: "danger" | "warning";
  title: string;
  detail: string;
  href: string;
  ariaLabel: string;
};

// Сигналы «требует внимания» из РЕАЛЬНЫХ данных доступных источников.
// null-источник (нет прав) просто не даёт сигналов — об этом честная пометка в блоке.
// Внутри группы — сортировка по срочности (старейший срок первым), потом cap на группу.
function buildAttentionSignals(
  tasks: TaskRecord[] | null,
  opportunities: Opportunity[] | null
): { shown: AttentionSignal[]; restCount: number } {
  const today = localIsoDay();
  const soon = localIsoDay(DUE_SOON_DAYS);
  const staleBefore = localIsoDay(-STALE_DEAL_DAYS);
  const byFinish = <T extends { plannedFinish: string }>(list: T[]) =>
    [...list].sort((a, b) => a.plannedFinish.localeCompare(b.plannedFinish));

  const activeTasks = (tasks ?? []).filter((t) => t.statusCategory !== "done");
  const overdueTasks = byFinish(activeTasks.filter((t) => t.plannedFinish.slice(0, 10) < today));
  const dueSoonTasks = byFinish(
    activeTasks.filter((t) => {
      const f = t.plannedFinish.slice(0, 10);
      return f >= today && f <= soon;
    })
  );

  const openOpps = (opportunities ?? []).filter((o) => OPP_OPEN.includes(o.status));
  const overdueOpps = byFinish(openOpps.filter((o) => o.plannedFinish.slice(0, 10) < today));
  const staleOpps = openOpps
    .filter((o) => o.plannedFinish.slice(0, 10) >= today && o.updatedAt.slice(0, 10) <= staleBefore)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  const taskSignal = (t: TaskRecord, chip: string, tone: "danger" | "warning"): AttentionSignal => ({
    key: `task-${chip}-${t.id}`,
    chip,
    tone,
    title: t.title,
    detail: `${t.statusName} · финиш ${fmtDate(t.plannedFinish)}`,
    href: `/my-work?task=${encodeURIComponent(t.id)}`,
    ariaLabel: `Открыть задачу «${t.title}» в Моих задачах`
  });
  const oppSignal = (o: Opportunity, chip: string, tone: "danger" | "warning", detail: string): AttentionSignal => ({
    key: `deal-${chip}-${o.id}`,
    chip,
    tone,
    title: o.title,
    detail,
    href: `/crm/deals?deal=${encodeURIComponent(o.id)}`,
    ariaLabel: `Открыть сделку «${o.title}» в CRM`
  });

  const groups: AttentionSignal[][] = [
    overdueTasks.map((t) => taskSignal(t, "Задача просрочена", "danger")),
    overdueOpps.map((o) =>
      oppSignal(o, "Сделка просрочена", "danger", `${OPP_STATUS_LABEL[o.status]} · финиш ${fmtDate(o.plannedFinish)}`)
    ),
    dueSoonTasks.map((t) => taskSignal(t, `Дедлайн ≤ ${DUE_SOON_DAYS} дн.`, "warning")),
    staleOpps.map((o) =>
      oppSignal(o, `Без движения ${STALE_DEAL_DAYS}+ дн.`, "warning", `${OPP_STATUS_LABEL[o.status]} · обновлена ${fmtDate(o.updatedAt)}`)
    )
  ];
  const shown = groups.flatMap((g) => g.slice(0, MAX_ROWS_PER_GROUP));
  const restCount = groups.reduce((s, g) => s + Math.max(0, g.length - MAX_ROWS_PER_GROUP), 0);
  return { shown, restCount };
}

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
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Сначала сигналы, затем сводка — каждое число ведёт к источнику</p>
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
              tasks={myWork.data?.tasks ?? null}
              projects={projects.data ? { count: projects.data.projects.length, hours: projects.data.projects.reduce((s, p) => s + p.plannedHours, 0) } : null}
              opportunities={opportunities.data}
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

function AttentionCard({ tasks, opportunities }: { tasks: TaskRecord[] | null; opportunities: Opportunity[] | null }) {
  const { shown, restCount } = useMemo(() => buildAttentionSignals(tasks, opportunities), [tasks, opportunities]);
  // Честность по правам: недоступный источник не даёт сигналов — говорим об этом явно.
  const unavailable = [tasks === null ? "задачам" : null, opportunities === null ? "сделкам" : null].filter(
    (v): v is string => v !== null
  );

  return (
    <BentoCard
      title="Требует внимания"
      subtitle="Просроченное, приближающиеся дедлайны и сделки без движения — из ваших задач и CRM"
      span={12}
      flush
    >
      {shown.length === 0 ? (
        <p className="px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">
          Сигналов нет: просроченных задач и застрявших сделок не найдено.
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
      {restCount > 0 || unavailable.length > 0 ? (
        <p className="border-t border-[var(--border-subtle)] px-4 py-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
          {restCount > 0 ? `И ещё ${restCount} — полные списки в «Мои задачи» и «Сделки». ` : ""}
          {unavailable.length > 0 ? `Сигналы по ${unavailable.join(" и ")} не рассчитываются: раздел недоступен вашей роли.` : ""}
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
  tasks: TaskRecord[] | null;
  projects: { count: number; hours: number } | null;
  opportunities: Opportunity[] | null;
}) {
  const activeTasks = (tasks ?? []).filter((t) => t.statusCategory !== "done");
  const today = localIsoDay();
  const overdueCount = activeTasks.filter((t) => t.plannedFinish.slice(0, 10) < today).length;
  const inProgressCount = activeTasks.filter((t) => t.statusCategory === "in_progress").length;
  const upcoming = useMemo(
    () => [...activeTasks].sort((a, b) => a.plannedFinish.localeCompare(b.plannedFinish)).slice(0, 6),
    [activeTasks]
  );

  // Агрегаты по сделкам (null = раздел недоступен роли).
  const openOpps = (opportunities ?? []).filter((o) => OPP_OPEN.includes(o.status));
  const openValue = openOpps.reduce((s, o) => s + o.contractValue, 0);
  const oppsByStatus = useMemo(() => {
    const order: Opportunity["status"][] = ["new", "feasibility", "ready_to_activate", "won_closed", "lost_rejected"];
    return order
      .map((s) => ({ status: s, count: (opportunities ?? []).filter((o) => o.status === s).length }))
      .filter((r) => r.count > 0);
  }, [opportunities]);

  return (
    <div className="flex flex-col gap-3">
      {/* Summary-first: реальные сигналы наверху, до любых агрегатов. */}
      <Bento>
        <AttentionCard tasks={tasks} opportunities={opportunities} />
      </Bento>

      {/* KPI-плитки — реальные агрегаты, каждая ведёт к источнику; недоступный роли источник → «—» без ссылки */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Мои задачи"
          value={tasks ? tasks.length : "—"}
          delta={!tasks ? "нет доступа" : overdueCount > 0 ? `${overdueCount} просрочено` : `${inProgressCount} в работе`}
          tone={tasks && overdueCount > 0 ? "danger" : "default"}
          {...(tasks ? { href: "/my-work" } : {})}
        />
        <StatTile
          label="Открытые сделки"
          value={opportunities ? openOpps.length : "—"}
          delta={opportunities ? money(openValue) : "нет доступа"}
          tone="default"
          {...(opportunities ? { href: "/crm/deals" } : {})}
        />
        <StatTile
          label="Активные проекты"
          value={projects ? projects.count : "—"}
          delta={projects ? `${projects.hours.toLocaleString("ru-RU")} ч плана` : "нет доступа"}
          tone="default"
          {...(projects ? { href: "/projects" } : {})}
        />
      </div>

      <Bento>
        {/* Ближайшие задачи — реальные my-work; строка — drill-down в /my-work?task= */}
        <BentoCard
          title="Ближайшие задачи"
          subtitle="Мои незавершённые задачи по плановому финишу"
          actions={tasks !== null ? <CardAllLink href="/my-work">Все задачи</CardAllLink> : undefined}
          span={7}
          flush
        >
          {tasks === null ? (
            <NoAccessNote what="Задачи" />
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
          actions={opportunities !== null ? <CardAllLink href="/crm/deals">Все сделки</CardAllLink> : undefined}
          span={5}
        >
          {opportunities === null ? (
            <NoAccessNote what="Сделки" />
          ) : oppsByStatus.length === 0 ? (
            <p className="py-4 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">Сделок пока нет.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {oppsByStatus.map((r) => {
                const pct = Math.round((r.count / (opportunities?.length || 1)) * 100);
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
