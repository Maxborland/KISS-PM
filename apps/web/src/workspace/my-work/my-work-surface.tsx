"use client";

import { useMemo, useState } from "react";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { SurfaceState } from "@/components/domain/surface-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { cn } from "@/lib/cn";
import { useMyWork } from "@/workspace/lib/use-workspace";
import { TASK_STATUSES, WORKSPACE_USERS } from "@/workspace/lib/mock-workspace-backend";
import type { TaskPriority, TaskRecord, TaskStatusCategory } from "@/workspace/lib/workspace-client";

/* ============================================================
   Мои задачи (authenticated) — домашний экран рабочей области текущего
   пользователя (исполнитель = CURRENT_USER_ID). Каркас: WorkspaceShell
   (левая навигация + топбар), activeNav="Мои задачи".

   ЧЕСТНОСТЬ:
   - Баннер «Прототип»: боевые ручки GET /api/workspace/my-work +
     PATCH /api/workspace/projects/:id/tasks/:taskId/status; транспорт —
     contract-mock, переключение на боевой = apiOrigin; данные in-memory.
   - Канбан DnD и select в списке шлют РЕАЛЬНУЮ мутацию в мок
     (updateTaskStatus), а не demoAction-заглушку. Матрица переходов реальна:
     запрещённый переход возвращает 409 и показывается отклонением (notice).
   - Реордер внутри колонки боевым контрактом НЕ покрыт → не реализуем
     (статус задаётся только колонкой/селектом).
   ============================================================ */

// Инициалы из имени (по образцу deals-surface): первые буквы 1-2 слов.
const initials = (name: string) => {
  const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
};

// Детерминированный цвет аватара по id пользователя (стабилен между рендерами).
const AV: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
const userById = new Map(WORKSPACE_USERS.map((u) => [u.id, u]));
const userName = (id: string) => userById.get(id)?.name ?? id;
const userColor = (id: string): BemAvatarColor => {
  const i = WORKSPACE_USERS.findIndex((u) => u.id === id);
  return i < 0 ? "c5" : AV[i % AV.length]!;
};

// RU-маппер кодов ошибок смены статуса (локальный, зеркало ruErr из deals-surface).
// Коды зеркалят projectWorkRoutes/taskLifecycleCommands боевого API.
const ERR_RU: Record<string, string> = {
  task_status_transition_not_allowed: "Переход между этими статусами не разрешён",
  task_status_not_found: "Целевой статус не найден или неактивен",
  task_acceptance_required: "Требуется приёмка — нет права завершить задачу",
  task_not_found: "Задача не найдена",
  project_not_found: "Проект не найден или неактивен",
  invalid_task_status: "Недопустимый статус задачи",
  invalid_project_id: "Некорректный идентификатор проекта",
  invalid_task_id: "Некорректный идентификатор задачи"
};
const myWorkErr = (code?: string) => (code && ERR_RU[code]) || code || "Не удалось загрузить мои задачи";

// Приоритет: подпись + вариант чипа (Chip не имеет «neutral», low → info).
const PRIORITY_LABEL: Record<TaskPriority, string> = { low: "Низкий", normal: "Обычный", high: "Высокий", critical: "Критичный" };
const PRIORITY_CHIP: Record<TaskPriority, "info" | "warning" | "danger" | "violet"> = {
  low: "info",
  normal: "info",
  high: "warning",
  critical: "danger"
};

// Срок: ISO-дата → ru-формат + относительная подпись (по образцу relTime из соседних доменов).
const REL = new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" });
const dayMs = 24 * 60 * 60 * 1000;
function dueLabel(iso: string): { date: string; rel: string; overdue: boolean } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / dayMs);
  return { date, rel: REL.format(diff, "day"), overdue: diff < 0 };
}

type Mode = "kanban" | "list";

export function MyWorkSurface() {
  const { data, status, error, reload, updateTaskStatus } = useMyWork();
  const [mode, setMode] = useState<Mode>("kanban");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatusId, setOverStatusId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Статус поверхности: есть данные → ready; нет данных и ошибка → error; иначе loading.
  // (Пустой набор задач показываем как empty через SurfaceState.)
  const tasks = data?.tasks ?? null;
  const surfaceStatus = tasks ? (tasks.length === 0 ? "empty" : "ready") : status === "error" ? "error" : "loading";

  // Колонки канбана по системным статусам (TASK_STATUSES, упорядочены sortOrder).
  // Группировка по statusCategory задачи (status === statusCategory), как в боевом TaskRecord.
  const columns = useMemo(() => {
    const sorted = [...TASK_STATUSES].sort((a, b) => a.sortOrder - b.sortOrder);
    const byCategory = new Map<TaskStatusCategory, TaskRecord[]>();
    for (const s of sorted) byCategory.set(s.category, []);
    for (const t of tasks ?? []) byCategory.get(t.statusCategory)?.push(t);
    return sorted.map((s) => ({ status: s, items: byCategory.get(s.category) ?? [] }));
  }, [tasks]);

  // Применить смену статуса (общий путь для DnD и select). Отклонение перехода — честный notice.
  async function applyStatus(taskId: string, targetStatusId: string) {
    const target = TASK_STATUSES.find((s) => s.id === targetStatusId);
    setBusyTaskId(taskId);
    setNotice(null);
    const res = await updateTaskStatus(taskId, targetStatusId);
    setBusyTaskId(null);
    if (res.ok) setNotice(`Статус изменён на «${target?.name ?? targetStatusId}»`);
    else setNotice(`Отклонено: ${myWorkErr(res.code ?? undefined)}`);
  }

  // Drop карточки в колонку: меняем статус, только если он отличается.
  const dropOn = (statusId: string) => {
    const id = dragId;
    setDragId(null);
    setOverStatusId(null);
    if (!id) return;
    const task = (tasks ?? []).find((t) => t.id === id);
    if (task && task.statusId !== statusId) void applyStatus(id, statusId);
  };

  return (
    <WorkspaceShell activeNav="Мои задачи">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <ProtoBanner />

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Мои задачи</h1>
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Задачи, где вы исполнитель — по всем активным проектам</p>
          </div>
          <Segmented
            name="my-work-mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "kanban", label: "Канбан" },
              { value: "list", label: "Список" }
            ]}
          />
        </div>

        <div className="mb-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
          {mode === "kanban"
            ? "Перетащите карточку в колонку статуса — переход проверяется матрицей (запрет → отклонение)."
            : "Смена статуса через select — те же правила переходов, что и в канбане."}
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={myWorkErr}
          loadingLabel="Загрузка моих задач…"
          empty={{ title: "Задач пока нет", description: "Вам не назначено ни одной задачи в активных проектах." }}
        >
          {tasks ? (
            mode === "kanban" ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {columns.map(({ status: s, items }) => (
                  <div
                    key={s.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (overStatusId !== s.id) setOverStatusId(s.id);
                    }}
                    onDrop={() => dropOn(s.id)}
                    className={cn(
                      "flex w-[268px] shrink-0 flex-col rounded-[var(--radius-card)] border bg-[var(--panel-subtle)]",
                      overStatusId === s.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                      <span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{s.name}</span>
                      <span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[10px] font-semibold text-[var(--muted-strong)]">{items.length}</span>
                    </div>
                    <div className="flex min-h-[120px] flex-col gap-2 p-2">
                      {items.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          busy={busyTaskId === t.id}
                          dragging={dragId === t.id}
                          onDragStart={() => setDragId(t.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverStatusId(null);
                          }}
                        />
                      ))}
                      {items.length === 0 ? (
                        <div className="grid flex-1 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] py-4 text-[10px] text-[var(--muted-soft)]">
                          перетащите сюда
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
                <table className="w-full border-collapse text-[length:var(--text-sm)]">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                      <th className="px-3 py-2 font-semibold">Задача</th>
                      <th className="px-3 py-2 font-semibold">Проект</th>
                      <th className="px-3 py-2 font-semibold">Приоритет</th>
                      <th className="px-3 py-2 font-semibold">Статус</th>
                      <th className="px-3 py-2 text-right font-semibold">Прогресс</th>
                      <th className="px-3 py-2 font-semibold">Срок</th>
                      <th className="px-3 py-2 font-semibold">Исполнитель</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => {
                      const due = dueLabel(t.plannedFinish);
                      return (
                        <tr key={t.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                          <td className="px-3 py-2">
                            <div className="font-medium text-[var(--text-strong)]">{t.title}</div>
                            <div className="v4-mono text-[10px] text-[var(--muted-soft)]">{t.id}</div>
                          </td>
                          <td className="px-3 py-2 text-[var(--muted-strong)]">{t.projectId}</td>
                          <td className="px-3 py-2">
                            <Chip variant={PRIORITY_CHIP[t.priority]}>{PRIORITY_LABEL[t.priority]}</Chip>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={t.statusId}
                              disabled={busyTaskId === t.id}
                              onChange={(e) => void applyStatus(t.id, e.target.value)}
                              className="h-7 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-1.5 text-[length:var(--text-xs)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
                            >
                              {TASK_STATUSES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="v4-num text-[var(--muted-strong)]">{t.progress}%</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn("v4-num text-[length:var(--text-xs)]", due.overdue ? "text-[var(--danger-text)]" : "text-[var(--muted-strong)]")}>{due.date}</span>
                            <span className="ml-1.5 text-[10px] text-[var(--muted-soft)]">{due.rel}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1.5">
                              <BemAvatar initials={initials(userName(t.ownerUserId))} color={userColor(t.ownerUserId)} size="sm" title={userName(t.ownerUserId)} />
                              <span className="text-[length:var(--text-xs)] text-[var(--muted)]">{userName(t.ownerUserId)}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <span />
          )}
        </SurfaceState>

        {notice ? <div key={notice} className="anim-rise-in-fast mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
      </main>
    </WorkspaceShell>
  );
}

// Баннер честности «Прототип» (зеркало profile/deals).
function ProtoBanner() {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--text-strong)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">
        Прототип
      </span>
      <span>
        Боевой контракт: GET /api/workspace/my-work + PATCH /api/workspace/projects/:id/tasks/:taskId/status (тело {"{statusId}"}). Канбан-DnD и select шлют
        реальную смену статуса; матрица переходов реальна (запрет → 409). Транспорт — contract-mock, переключение на боевой = apiOrigin. Данные in-memory.
      </span>
    </div>
  );
}

// Карточка задачи канбана (draggable). Реордер внутри колонки боевым контрактом не покрыт — не реализуем.
function TaskCard({
  task,
  busy,
  dragging,
  onDragStart,
  onDragEnd
}: {
  task: TaskRecord;
  busy: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const due = dueLabel(task.plannedFinish);
  return (
    <article
      draggable={!busy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-2.5 shadow-[var(--shadow-card)]",
        busy ? "opacity-60" : "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <Chip variant={PRIORITY_CHIP[task.priority]}>{PRIORITY_LABEL[task.priority]}</Chip>
        <BemAvatar initials={initials(userName(task.ownerUserId))} color={userColor(task.ownerUserId)} size="sm" title={userName(task.ownerUserId)} />
      </div>
      <h3 className="text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--text-strong)]">{task.title}</h3>
      <p className="truncate text-[length:var(--text-xs)] text-[var(--muted)]">{task.projectId}</p>

      {/* Прогресс задачи (progress 0…100). */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel-strong)]">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }} />
        </div>
        <span className="v4-num text-[10px] text-[var(--muted-soft)]">{task.progress}%</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className={cn("v4-num text-[10px]", due.overdue ? "text-[var(--danger-text)]" : "text-[var(--muted-soft)]")}>{due.date}</span>
        <span className="text-[10px] text-[var(--muted-soft)]">{due.rel}</span>
      </div>
    </article>
  );
}
