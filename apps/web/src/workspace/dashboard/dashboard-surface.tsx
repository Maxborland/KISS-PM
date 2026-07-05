"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { SurfaceState } from "@/components/domain/surface-state";
import { Bento, BentoCard, StatTile } from "@/delivery/ui/bento";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { cn } from "@/lib/cn";
import { useCrm } from "@/crm/lib/use-crm";
import { useMyWork, useProjects } from "@/workspace/lib/use-workspace";
import type { TaskRecord, TaskStatusCategory } from "@/workspace/lib/workspace-client";
import type { Opportunity } from "@/crm/lib/crm-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

/* ============================================================
   Workspace/Дашборд — персональный home, СОБРАННЫЙ КЛИЕНТСКОЙ
   АГРЕГАЦИЕЙ реальных контрактов (заменяет статический
   views/blocks/dashboard-bento.tsx). Честность: tenant-широкого
   агрегата НЕТ ни у одной ручки, поэтому считаем на клиенте из того,
   что реально отдают per-surface контракты:
   - Мои задачи      → useMyWork()  (GET /api/workspace/my-work)
   - Активные проекты → useProjects() (GET /api/workspace/projects)
   - Сделки          → useCrm()      (GET CRM read-model)
   Чего контракт НЕ даёт (митинги «на сегодня», фокус-график,
   tenant-сигналы) — честный плейсхолдер, не фейковые числа.
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

export function DashboardSurface() {
  const myWork = useMyWork();
  const projects = useProjects();
  const crm = useCrm();

  // Повиджетная деградация (G8-06): один недоступный источник (403/ошибка) не
  // убивает весь дашборд — его секция показывает «нет доступа», остальные живут.
  // Целиком forbidden/error — только когда ВСЕ три источника недоступны.
  const sources = [myWork, projects, crm];
  const settled = sources.every((s) => Boolean(s.data) || s.status === "error" || s.status === "forbidden");
  const allForbidden = sources.every((s) => s.status === "forbidden");
  const allFailed = sources.every((s) => !s.data && (s.status === "error" || s.status === "forbidden"));
  const surfaceStatus = !settled ? "loading" : allForbidden ? "forbidden" : allFailed ? "error" : "ready";
  const errorCode = myWork.error ?? projects.error ?? crm.error ?? null;

  return (
    <WorkspaceShell activeNav="Дашборд">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <ProtoBanner />
        <div className="mb-3">
          <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Дашборд</h1>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Персональная сводка: задачи, проекты и сделки рабочей области</p>
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={errorCode}
          onRetry={() => {
            void myWork.reload();
            void projects.reload();
            void crm.reload();
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
              opportunities={crm.data?.opportunities ?? null}
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

function DashboardContent({
  tasks,
  projects,
  opportunities
}: {
  tasks: TaskRecord[] | null;
  projects: { count: number; hours: number } | null;
  opportunities: Opportunity[] | null;
}) {
  // Агрегаты по моим задачам (null = раздел недоступен роли).
  const tasksByStatus = useMemo(() => {
    const m = new Map<TaskStatusCategory, number>();
    for (const t of tasks ?? []) m.set(t.statusCategory, (m.get(t.statusCategory) ?? 0) + 1);
    return m;
  }, [tasks]);
  const activeTasks = (tasks ?? []).filter((t) => t.statusCategory !== "done");
  const upcoming = useMemo(
    () => [...activeTasks].sort((a, b) => a.plannedFinish.localeCompare(b.plannedFinish)).slice(0, 6),
    [activeTasks]
  );

  // Агрегаты по сделкам (null = раздел недоступен роли).
  const openOpps = (opportunities ?? []).filter((o) => OPP_OPEN.includes(o.status));
  const openValue = openOpps.reduce((s, o) => s + o.contractValue, 0);
  const wonCount = (opportunities ?? []).filter((o) => o.status === "won_closed").length;
  const oppsByStatus = useMemo(() => {
    const order: Opportunity["status"][] = ["new", "feasibility", "ready_to_activate", "won_closed", "lost_rejected"];
    return order
      .map((s) => ({ status: s, count: (opportunities ?? []).filter((o) => o.status === s).length }))
      .filter((r) => r.count > 0);
  }, [opportunities]);

  return (
    <div className="flex flex-col gap-3">
      {/* KPI-плитки — реальные агрегаты; недоступный роли источник → «—» */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Мои задачи" value={tasks ? tasks.length : "—"} delta={tasks ? `${tasksByStatus.get("in_progress") ?? 0} в работе` : "нет доступа"} tone="default" />
        <StatTile label="Открытые сделки" value={opportunities ? openOpps.length : "—"} delta={opportunities ? money(openValue) : "нет доступа"} tone="default" />
        <StatTile label="Активные проекты" value={projects ? projects.count : "—"} delta={projects ? `${projects.hours.toLocaleString("ru-RU")} ч плана` : "нет доступа"} tone="default" />
        <StatTile label="Сделки выиграны" value={opportunities ? wonCount : "—"} delta={!opportunities ? "нет доступа" : wonCount > 0 ? "закрыты в плюс" : "пока нет"} tone={opportunities && wonCount > 0 ? "success" : "default"} />
      </div>

      <Bento>
        {/* Ближайшие задачи — реальные my-work, сортировка по плановому финишу */}
        <BentoCard title="Ближайшие задачи" subtitle="Мои незавершённые задачи по плановому финишу" span={7} flush>
          {tasks === null ? (
            <NoAccessNote what="Задачи" />
          ) : upcoming.length === 0 ? (
            <p className="px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">Незавершённых задач нет — всё закрыто.</p>
          ) : (
            <ul className="flex flex-col">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-2.5 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{t.title}</span>
                    <span className="block truncate text-[length:var(--text-xs)] text-[var(--muted-soft)]">{t.statusName} · прогресс {t.progress}%</span>
                  </span>
                  <Chip variant={TASK_STATUS_TONE[t.statusCategory]}>{TASK_STATUS_LABEL[t.statusCategory]}</Chip>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[length:var(--text-xs)] text-[var(--muted)]">
                    <CalendarClock className="size-3.5" aria-hidden />
                    <span className="v4-num">{fmtDate(t.plannedFinish)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </BentoCard>

        {/* Воронка сделок — реальное распределение по статусам */}
        <BentoCard title="Сделки по статусам" subtitle="Распределение возможностей CRM" span={5}>
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

        {/* Честный плейсхолдер: митинги/сигналы — нет tenant-агрегата у контракта */}
        <BentoCard title="Митинги и сигналы" subtitle="Сводка дня" span={12}>
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-3 text-[length:var(--text-sm)] text-[var(--muted-soft)]">
            Митинги «на сегодня», фокус-график и tenant-сигналы появятся после агрегирующего контракта —
            у отдельных ручек (митинги привязаны к сущности; сигналы — к проекту) tenant-широкой сводки пока нет.
            Здесь честный плейсхолдер вместо фейковых чисел.
          </div>
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
        Клиентская агрегация реальных контрактов: GET /api/workspace/my-work + /projects + CRM read-model. Tenant-широкого
        агрегата у ручек нет — считаем на клиенте; чего контракт не даёт (митинги/сигналы) — честный плейсхолдер.
        Переключение на боевой = apiOrigin; данные in-memory.
      </span>
    </div>
  );
}
