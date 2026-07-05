"use client";

import { useEffect, useMemo, useState } from "react";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { SurfaceState } from "@/components/domain/surface-state";
import { StatTile } from "@/delivery/ui/bento";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { cn } from "@/lib/cn";
import { useProjectDetail, useProjects, useWorkspaceUsers } from "@/workspace/lib/use-workspace";
import { MOCK_PROJECT_ID } from "@/workspace/lib/mock-workspace-backend";
import type { ProjectRecord, TaskRecord, TaskStatusCategory } from "@/workspace/lib/workspace-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

/* ============================================================
   Карточка проекта (Workspace/Project Card) — внутренний экран рабочей
   области: шапка проекта + его задачи + сводка по реальному {project,tasks}.

   ЧЕСТНОСТЬ:
   - Баннер «Прототип»: боевой контракт GET /api/workspace/projects (выбор
     проекта) + GET /api/workspace/projects/:id ({project, tasks}); транспорт —
     contract-mock, переключение на боевой = apiOrigin; данные in-memory.
   - Состояния — ТОЛЬКО через SurfaceState (loading/error/forbidden/ready),
     коды ошибок маппит локальный wsErr.
   - Селектор проекта переключает РЕАЛЬНЫЙ запрос getProjectDetail(:id).
   - Сводка справа выводится ИЗ {project, tasks} (демэнд проекта, деньги, часы,
     прогресс) — никаких планировочных KPI не выдумываем (usePlanning не зовём).
   ============================================================ */

const AV: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
const initials = (name: string) => {
  const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
};

const money = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`
    : `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс ₽`;
const hours = (v: number) => `${Math.round(v).toLocaleString("ru-RU")} ч`;
const ddmmyyyy = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
};

// RU-маппер кодов проекта/задач (боевые коды projectWorkRoutes) — для SurfaceState.errorFormat.
const ERR_RU: Record<string, string> = {
  permission_missing: "Недостаточно прав для просмотра этого раздела",
  invalid_project_id: "Некорректный идентификатор проекта",
  project_not_found: "Проект не найден или неактивен",
  load_failed: "Не удалось загрузить данные",
  request_failed: "Запрос не выполнен"
};
const wsErr = (code?: string) => (code && ERR_RU[code]) || code || "Неизвестная ошибка";

// Статус проекта → tone чипа (проект «active» — основной кейс мока).
const PROJECT_STATUS_LABEL: Record<string, string> = { active: "В работе", closed: "Закрыт", draft: "Черновик" };
const projectStatusTone = (status: string): "info" | "success" | "warning" =>
  status === "closed" ? "success" : status === "draft" ? "warning" : "info";

// Категория системного статуса задачи → подпись + tone чипа (persistence.TaskStatusCategory).
const STATUS_LABEL: Record<TaskStatusCategory, string> = {
  new: "Новая",
  waiting: "Ожидание",
  in_progress: "В работе",
  review: "На проверке",
  done: "Готово"
};
const STATUS_TONE: Record<TaskStatusCategory, "info" | "success" | "warning" | "violet"> = {
  new: "info",
  waiting: "warning",
  in_progress: "violet",
  review: "warning",
  done: "success"
};

export function ProjectDetailSurface({ initialProjectId }: { initialProjectId?: string } = {}) {
  // Выбор проекта — реальный список активных (GET /api/workspace/projects), старт = MOCK_PROJECT_ID.
  const projectsList = useProjects();
  const [selectedId, setSelectedId] = useState<string>(initialProjectId ?? MOCK_PROJECT_ID);
  // Запрошенный по URL проект обязан существовать: молчаливая подмена первым проектом (G3-02)
  // выглядела как запрошенная карточка. Автопереключение на первый проект — только для
  // встраивания без initialProjectId (stories, mock-fidelity со стартом MOCK_PROJECT_ID).
  const requestedMissing = Boolean(
    initialProjectId &&
      selectedId === initialProjectId &&
      projectsList.data &&
      !projectsList.data.projects.some((p) => p.id === initialProjectId)
  );
  useEffect(() => {
    if (initialProjectId) return;
    const projects = projectsList.data?.projects ?? [];
    if (projects.length && !projects.some((p) => p.id === selectedId)) setSelectedId(projects[0]!.id);
  }, [initialProjectId, projectsList.data, selectedId]);
  // Карточка проекта + его задачи (GET /api/workspace/projects/:id) — реальный запрос на смену selectedId.
  const { data, status, error, reload } = useProjectDetail(selectedId);

  // Статус поверхности: data → ready; иначе loading; error-код project_not_found → можно трактовать как «нет доступа»,
  // но контракт отдаёт 404 (а не 403) — показываем как error с человекочитаемым текстом. forbidden зарезервирован
  // под боевой 403, которого мок не моделирует.
  const surfaceStatus = requestedMissing ? "empty" : status === "loading" ? "loading" : status === "error" ? "error" : data ? "ready" : "loading";

  return (
    <WorkspaceShell activeNav="Проекты">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <ProtoBanner />

        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Карточка проекта</h1>
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Параметры проекта, задачи команды и сводка по объёму</p>
          </div>
          <ProjectSwitcher
            projects={projectsList.data?.projects ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={wsErr}
          loadingLabel="Загружаем карточку проекта…"
          empty={{
            title: "Проект не найден",
            description: "Проекта с таким адресом нет: возможно, он закрыт/архивирован или ссылка устарела. Выберите проект из списка выше."
          }}
        >
          {data ? <ProjectContent project={data.project} tasks={data.tasks} /> : <span />}
        </SurfaceState>
      </main>
    </WorkspaceShell>
  );
}

// Баннер честности «Прототип» (зеркало profile/deals-surface).
function ProtoBanner() {
  if (!prototypeNotesEnabled) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--text-strong)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">
        Прототип
      </span>
      <span>
        Боевой контракт: GET /api/workspace/projects (список активных) + GET /api/workspace/projects/:id (проект и его
        задачи). Транспорт — contract-mock; переключение на боевой = apiOrigin. Данные in-memory.
      </span>
    </div>
  );
}

// Селектор проекта: переключает реальный getProjectDetail(:id). Список — активные проекты рабочей области.
function ProjectSwitcher({
  projects,
  selectedId,
  onSelect
}: {
  projects: ProjectRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">
      Проект:
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="h-9 max-w-[280px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        {/* selectedId всегда присутствует опцией — даже если список ещё грузится. */}
        {projects.length === 0 ? <option value={selectedId}>{selectedId}</option> : null}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  );
}

// Контент карточки: шапка проекта + грид (задачи слева, сводка справа). Всё из {project, tasks}.
function ProjectContent({ project, tasks }: { project: ProjectRecord; tasks: TaskRecord[] }) {
  return (
    <div className="flex flex-col gap-3">
      <ProjectHeader project={project} taskCount={tasks.length} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProjectTasks tasks={tasks} />
        <ProjectSummary project={project} tasks={tasks} />
      </div>
    </div>
  );
}

// Шапка проекта: название, клиент, статус-Chip, срок, сумма, план.часы.
function ProjectHeader({ project, taskCount }: { project: ProjectRecord; taskCount: number }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Chip variant={projectStatusTone(project.status)}>{PROJECT_STATUS_LABEL[project.status] ?? project.status}</Chip>
            {prototypeNotesEnabled ? <span className="v4-mono text-[length:var(--text-xs)] text-[var(--muted-soft)]">{project.id}</span> : null}
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold leading-tight text-[var(--text-strong)]">
            {project.title}
          </h2>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">{project.clientName}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] pt-3 sm:grid-cols-4">
        <HeaderField label="Старт" value={ddmmyyyy(project.plannedStart)} mono />
        <HeaderField label="Срок" value={ddmmyyyy(project.plannedFinish)} mono />
        <HeaderField label="Сумма контракта" value={money(project.contractValue)} num />
        <HeaderField label="План. часы" value={hours(project.plannedHours)} num />
        <HeaderField label="Задач в проекте" value={`${taskCount}`} num />
      </dl>
    </section>
  );
}

function HeaderField({ label, value, mono, num }: { label: string; value: string; mono?: boolean; num?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.05em] text-[var(--muted-soft)]">{label}</dt>
      <dd className={cn("text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]", mono && "v4-mono", num && "v4-num")}>{value}</dd>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)]">
      <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// Таблица задач проекта: задача / статус-Chip / исполнитель / срок / прогресс.
function ProjectTasks({ tasks }: { tasks: TaskRecord[] }) {
  const usersDir = useWorkspaceUsers();
  // Фолбэк имени: под ограниченной ролью справочник людей отдаёт 403 — резолвер вернёт сырой id.
  // Показываем «Участник xxxx» вместо user-… (G8-08, G5-12).
  const userName = (id: string | null) => {
    if (!id) return "—";
    const n = usersDir.name(id);
    return n === id ? `Участник ${id.slice(-4)}` : n;
  };
  const userColor = (id: string | null): BemAvatarColor => {
    const i = id ? usersDir.indexOf(id) : -1;
    return i < 0 ? "c5" : AV[i % AV.length]!;
  };
  // Сортировка: незакрытые вперёд, затем по плановому финишу (ближайшие выше).
  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const ad = a.statusCategory === "done" ? 1 : 0;
        const bd = b.statusCategory === "done" ? 1 : 0;
        if (ad !== bd) return ad - bd;
        return a.plannedFinish.localeCompare(b.plannedFinish);
      }),
    [tasks]
  );

  if (sorted.length === 0) {
    return (
      <section className="grid min-h-[160px] place-items-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 text-[length:var(--text-sm)] text-[var(--muted)] shadow-[var(--shadow-card)]">
        У проекта пока нет задач.
      </section>
    );
  }

  return (
    <section className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <table className="w-full border-collapse text-[length:var(--text-sm)]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
            <th className="px-3 py-2 font-semibold">Задача</th>
            <th className="px-3 py-2 font-semibold">Статус</th>
            <th className="px-3 py-2 font-semibold">Исполнитель</th>
            <th className="px-3 py-2 font-semibold">Срок</th>
            <th className="w-40 px-3 py-2 font-semibold">Прогресс</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
              <td className="px-3 py-2">
                <div className="font-medium text-[var(--text-strong)]">{t.title}</div>
                {prototypeNotesEnabled || t.requiresAcceptance ? (
                  <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
                    {prototypeNotesEnabled ? t.id : null}
                    {t.requiresAcceptance ? `${prototypeNotesEnabled ? " · " : ""}требует приёмки` : ""}
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <Chip variant={STATUS_TONE[t.statusCategory]}>{t.statusName || STATUS_LABEL[t.statusCategory]}</Chip>
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <BemAvatar initials={initials(userName(t.ownerUserId))} color={userColor(t.ownerUserId)} size="sm" title={userName(t.ownerUserId)} />
                  <span className="text-[length:var(--text-xs)] text-[var(--muted)]">{userName(t.ownerUserId)}</span>
                </span>
              </td>
              <td className="v4-num px-3 py-2 text-[var(--muted-strong)]">{ddmmyyyy(t.plannedFinish)}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <ProgressBar value={t.progress} />
                  <span className="v4-num w-9 shrink-0 text-right text-[length:var(--text-xs)] text-[var(--muted)]">{t.progress}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type SummaryMode = "scope" | "demand";

// Сводка проекта (справа): объём/деньги/часы из {project, tasks}; демэнд по позициям — из project.demand.
// Только реальные агрегаты — без планировочных KPI.
function ProjectSummary({ project, tasks }: { project: ProjectRecord; tasks: TaskRecord[] }) {
  const [mode, setMode] = useState<SummaryMode>("scope");

  const agg = useMemo(() => {
    const plannedWork = tasks.reduce((s, t) => s + t.plannedWork, 0);
    const actualWork = tasks.reduce((s, t) => s + t.actualWork, 0);
    // Прогресс по объёму = взвешенный по plannedWork процент выполнения задач.
    const progress = plannedWork > 0 ? Math.round(tasks.reduce((s, t) => s + t.plannedWork * t.progress, 0) / plannedWork) : 0;
    const done = tasks.filter((t) => t.statusCategory === "done").length;
    const inProgress = tasks.filter((t) => t.statusCategory === "in_progress").length;
    const open = tasks.length - done;
    const demandHours = project.demand.reduce((s, d) => s + d.requiredHours, 0);
    return { plannedWork, actualWork, progress, done, inProgress, open, demandHours };
  }, [project.demand, tasks]);

  return (
    <aside className="flex flex-col gap-3">
      <Segmented
        name="project-summary-mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "scope", label: "Объём" },
          { value: "demand", label: "Спрос" }
        ]}
      />

      {mode === "scope" ? (
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Прогресс" value={`${agg.progress}%`} delta={`${agg.done} закрыто · ${agg.inProgress} в работе`} tone="success" />
          <StatTile label="Открыто задач" value={`${agg.open}`} delta={`из ${tasks.length}`} />
          <StatTile label="План. трудоёмкость" value={hours(agg.plannedWork)} delta="по задачам проекта" />
          <StatTile label="Факт. трудоёмкость" value={hours(agg.actualWork)} delta="списано часов" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Спрос по позициям</h3>
            <span className="v4-num text-[length:var(--text-xs)] text-[var(--muted-soft)]">{hours(agg.demandHours)}</span>
          </div>
          {project.demand.length === 0 ? (
            <p className="text-[length:var(--text-xs)] text-[var(--muted)]">Спрос по позициям не задан.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {project.demand.map((d) => {
                const share = agg.demandHours > 0 ? Math.round((d.requiredHours / agg.demandHours) * 100) : 0;
                return (
                  <li key={d.positionId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[length:var(--text-sm)] text-[var(--text)]">{d.positionId}</span>
                      <span className="v4-num text-[length:var(--text-xs)] text-[var(--muted-strong)]">{hours(d.requiredHours)} · {share}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-1 border-t border-[var(--border-subtle)] pt-2 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
            Спрос проекта — потребность в часах по позициям.
          </p>
        </div>
      )}
    </aside>
  );
}
