"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { hasPermission } from "@/lib/permissions";
import { useSessionUser } from "@/shell/use-session-user";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, deriveProjectMeta, planningErr, useProjectBase } from "@/delivery/lib/project-chrome";
import { MIN_PER_DAY, MOCK_PROJECT_ID } from "@/delivery/lib/planning-demo-data";
import { usePlanning, type ApplyResult } from "@/delivery/lib/use-planning";
import { isCalendarWorkingWeekday, resolveProjectCalendar } from "@/delivery/lib/project-calendar";
import { useResourceDirectory } from "@/delivery/lib/use-resource-directory";
import { AddAssigneeDialog, distribute, presetWeights, ROLES, roleLabel } from "@/delivery/assignments/assignments-editors";
import { createClientId } from "@/delivery/lib/client-id";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { createPlanningCommand } from "@kiss-pm/domain";
import type { PlanAssignmentRole, PlanningCommand } from "@kiss-pm/domain";

type Gran = "day" | "week";
// AsgRaw — локальная VIEW-модель строки назначения: role сужен до string под нужды редактора ролей,
// а workMinutes нормализован к числу (в домене PlanAssignment.workMinutes может быть null). Маппится из PlanAssignment.
type AsgRaw = { id: string; taskId: string; resourceId: string; role: string; unitsPermille: number; workMinutes: number };

const PROJECT: ProjectMeta = { name: "Производственный портал · Релиз 2", code: "ПР", status: "В работе", statusTone: "info", planVersion: "v17", deadline: "12.07.2026", finish: "14.06.2026", variance: { label: "+2 дня к базовому плану B2", tone: "warning" } };
const MONTHS_CAP = ["", "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const DOW = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const COL_W: Record<Gran, number> = { day: 30, week: 44 };
const ROW_H = 34;
const HEADER_H = 40;
const LEFT_W = 360;
const ASSIGNMENTS_MANAGE_PERMISSION = "tenant.project_resources.manage";
const WORKING = new Set(["executor", "co_executor"]); // только эти роли создают нагрузку и учитываются в труде
// «прицел» (как в матрице ресурсов): тонирующий inset-shadow строки/столбца под курсором
const CROSS = "shadow-[inset_0_0_0_9999px_color-mix(in_oklab,var(--accent)_14%,transparent)]";
const CROSS_SOFT = "shadow-[inset_0_0_0_9999px_color-mix(in_oklab,var(--accent)_8%,transparent)]";
const CROSS_FOCAL = "shadow-[inset_0_0_0_9999px_color-mix(in_oklab,var(--accent)_26%,transparent)]";
// выходной столбец — заметный серый. ПОЛУПРОЗРАЧНЫЙ (…, transparent): композитится поверх фона
// строки, поэтому на выбранной (accent-soft) строке не закрашивает подсветку серым (без «полос»).
// На белом фоне (panel=#fff) визуально идентичен непрозрачному muted-soft 18%.
const WEEKEND_BG = "color-mix(in oklab, var(--muted-soft) 18%, transparent)";
export const formatAssignmentHours = (min: number) => (Math.round((min / 60) * 10) / 10).toLocaleString("ru-RU");
export const assignmentHoursInputValue = (min: number) => Math.round((min / 60) * 100) / 100;
export function parseAssignmentHours(value: string): number | null {
  if (value.trim() === "") return null;
  const hours = Number(value);
  return Number.isFinite(hours) ? Math.max(0, Math.round(hours * 60)) : null;
}
export function parseAssignmentUnits(value: string): number | null {
  if (value.trim() === "") return null;
  const percent = Number(value);
  return Number.isFinite(percent) ? Math.max(10, Math.round(percent) * 10) : null;
}
const h1 = formatAssignmentHours;
// Источник дат таймлайна — read-model (project.plannedStart), а не хардкод mock-бэка: «переключение на live = смена apiOrigin».
// Чистые помощники относительно произвольного начала (baseMs); внутри компонента биндятся на origin плана.
const dayToIsoAt = (baseMs: number, day: number) => new Date(baseMs + day * 86_400_000).toISOString().slice(0, 10);
const isoToDayAt = (baseMs: number, iso: string) => Math.round((Date.parse(iso + "T00:00:00Z") - baseMs) / 86_400_000);

const nid = createClientId;

type AsgMeta = { asg: AsgRaw; days: number[]; resolved: Map<number, number>; explicit: Map<number, number>; hasExplicit: boolean };

export function ProjectAssignments({ projectId = MOCK_PROJECT_ID }: { projectId?: string }) {
  const { readModel, status, error, reload, apply } = usePlanning(projectId);
  const projectBase = useProjectBase(projectId, PROJECT);
  const resDir = useResourceDirectory();
  const sessionUser = useSessionUser();
  const canManageAssignments = hasPermission(sessionUser?.permissions ?? [], ASSIGNMENTS_MANAGE_PERMISSION);
  // Фолбэк имени: под ограниченной ролью справочник людей может отдать 403 — резолвер вернёт сырой id.
  // Показываем «Участник xxxx» вместо user-/r-идентификатора (G8-08).
  const resName = (id: string) => { const n = resDir.name(id); return n === id ? `Участник ${id.slice(-4)}` : n; };
  const [gran, setGran] = useState<Gran>("day");
  const [monthOffset, setMonthOffset] = useState(0);
  const [sel, setSel] = useState<string | null>(null); // assignmentId
  const [busy, setBusy] = useState(false);
  const [curveErr, setCurveErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Map<number, number> | null>(null); // ручная кривая: day → минуты
  const [hover, setHover] = useState<{ key: string; col: number } | null>(null); // прицел: строка (key) + столбец (col=period.key)

  // origin таймлайна = плановый старт проекта из read-model (на live меняется автоматически)
  const baseMs = useMemo(() => {
    const start = readModel?.project.plannedStart;
    return typeof start === "string" ? Date.parse(start + "T00:00:00Z") : Date.UTC(2026, 2, 2);
  }, [readModel]);
  const dayToIso = (day: number) => dayToIsoAt(baseMs, day);
  const isoToDay = (iso: string) => isoToDayAt(baseMs, iso);

  const model = useMemo(() => {
    if (!readModel) return null;
    const authored = readModel.authored;
    const calc = readModel.calculatedPlan.tasks;
    const calcById = new Map(calc.map((c) => [c.id, c]));
    const leafTasks = authored.tasks.filter((t) => t.durationMinutes != null);
    // маппинг доменных PlanAssignment → view-модель AsgRaw (нормализуем workMinutes к числу)
    const assignments: AsgRaw[] = authored.assignments.map((a) => ({ id: a.id, taskId: a.taskId, resourceId: a.resourceId, role: a.role, unitsPermille: a.unitsPermille, workMinutes: a.workMinutes ?? 0 }));
    const asgByTask = new Map<string, AsgRaw[]>();
    for (const a of assignments) { const arr = asgByTask.get(a.taskId) ?? []; arr.push(a); asgByTask.set(a.taskId, arr); }
    const allocByAsg = new Map<string, Map<number, number>>();
    for (const al of authored.assignmentAllocations) { let m = allocByAsg.get(al.assignmentId); if (!m) { m = new Map(); allocByAsg.set(al.assignmentId, m); } m.set(isoToDayAt(baseMs, al.date), (m.get(isoToDayAt(baseMs, al.date)) ?? 0) + al.workMinutes); }

    const resolvedByAsg = new Map<string, Map<number, number>>();
    for (const bucket of readModel.resourceLoad?.buckets ?? []) {
      if (bucket.granularity !== "day") continue;
      const day = isoToDayAt(baseMs, bucket.date);
      for (const contribution of bucket.assignmentContributions ?? []) {
        let distribution = resolvedByAsg.get(contribution.assignmentId);
        if (!distribution) {
          distribution = new Map();
          resolvedByAsg.set(contribution.assignmentId, distribution);
        }
        distribution.set(day, (distribution.get(day) ?? 0) + contribution.workMinutes);
      }
    }

    // Исключения задают фактическую доступность дня. Пресеты исключают только дни с нулевой ёмкостью.
    const cal = resolveProjectCalendar({ project: readModel.project, calendars: readModel.calendars });
    const full = cal?.workingMinutesPerDay ?? MIN_PER_DAY;
    const exns = (readModel.calendarExceptions ?? []).filter((x) => cal !== null && x.calendarId === cal.id);
    const workingMinutesFor = (resourceId: string, day: number) => {
      if (!cal) return 0;
      const date = dayToIsoAt(baseMs, day);
      let minutes = isCalendarWorkingWeekday(cal, new Date(baseMs + day * 86_400_000).getUTCDay()) ? full : 0;
      for (const exception of exns) if (exception.date === date && exception.resourceId === null) minutes = exception.workingMinutes;
      for (const exception of exns) if (exception.date === date && exception.resourceId === resourceId) minutes = exception.workingMinutes;
      return Math.max(0, minutes);
    };

    const metaByAsg = new Map<string, AsgMeta>();
    for (const a of assignments) {
      const c = calcById.get(a.taskId);
      // calculatedStart/Finish в домене nullable — при отсутствии дат падаем в 0 (мок всегда считает листья)
      const es = c?.calculatedStart ? isoToDayAt(baseMs, c.calculatedStart) : 0;
      const ef = c?.calculatedFinish ? isoToDayAt(baseMs, c.calculatedFinish) : es;
      const days: number[] = [];
      for (let d = es; d <= Math.max(ef, es); d++) if (workingMinutesFor(a.resourceId, d) > 0) days.push(d);
      const explicit = allocByAsg.get(a.id) ?? new Map<number, number>();
      const resolved = WORKING.has(a.role) ? resolvedByAsg.get(a.id) ?? new Map<number, number>() : new Map<number, number>();
      metaByAsg.set(a.id, { asg: a, days, resolved, explicit, hasExplicit: explicit.size > 0 });
    }
    // диапазон дней для окна
    const minDay = 0;
    let maxDay = readModel.project.plannedFinish ? Math.max(0, isoToDayAt(baseMs, readModel.project.plannedFinish)) : 34;
    for (const m of metaByAsg.values()) {
      for (const d of [...m.days, ...m.explicit.keys(), ...m.resolved.keys()]) maxDay = Math.max(maxDay, d);
    }
    return { leafTasks, asgByTask, metaByAsg, calcById, minDay, maxDay, hasProjectCalendar: cal !== null };
  }, [readModel, baseMs]);

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error);
  // готовый контент — только при наличии model+readModel. Frame-обёртку сохраняем.
  if (status !== "ready" || !model || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={{ ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code }} projectId={projectId} activeTab="Назначения">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка назначений…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const projectMeta = deriveProjectMeta(readModel, projectBase);
  const colW = COL_W[gran];
  // эффективный прицел: под курсором (hover), либо строка выбранного назначения при открытом инспекторе
  const crosshair = hover ?? (sel ? { key: `a:${sel}`, col: -1 } : null);

  // окно по месяцу
  const monthsList = [...new Set(Array.from({ length: model.maxDay - model.minDay + 1 }, (_, i) => dayToIso(model.minDay + i).slice(0, 7)))].sort();
  const focusMonth = monthsList[Math.max(0, Math.min(monthOffset, monthsList.length - 1))] ?? "";
  const monthLabel = focusMonth ? `${MONTHS_CAP[Number(focusMonth.slice(5, 7))]} ${focusMonth.slice(0, 4)}` : "";
  const inWindow = (day: number) => dayToIso(day).slice(0, 7) === focusMonth;
  // периоды (колонки): дни месяца окна, либо недели (понедельники), покрывающие окно
  const windowDays: number[] = [];
  for (let d = model.minDay; d <= model.maxDay; d++) if (inWindow(d)) windowDays.push(d);
  const periods: Array<{ key: number; days: number[]; top: string; sub: string; weekend: boolean }> = [];
  if (gran === "day") {
    for (const d of windowDays) { const dt = new Date(baseMs + d * 86_400_000); const wd = dt.getUTCDay(); periods.push({ key: d, days: [d], top: String(dt.getUTCDate()).padStart(2, "0"), sub: DOW[wd] ?? "", weekend: wd === 0 || wd === 6 }); }
  } else {
    const seen = new Set<number>();
    for (const d of windowDays) { const wd = new Date(baseMs + d * 86_400_000).getUTCDay(); const monday = d - (wd === 0 ? 6 : wd - 1); if (seen.has(monday)) continue; seen.add(monday); const dt = new Date(baseMs + monday * 86_400_000); periods.push({ key: monday, days: [0, 1, 2, 3, 4].map((k) => monday + k), top: String(dt.getUTCDate()).padStart(2, "0"), sub: MONTHS_CAP[dt.getUTCMonth() + 1] ?? "", weekend: false }); }
  }

  const minutesOn = (m: AsgMeta, day: number) => m.resolved.get(day) ?? 0;
  const cellMin = (m: AsgMeta, p: { days: number[] }) => p.days.reduce((s, d) => s + minutesOn(m, d), 0);

  async function applyCmd(command: PlanningCommand, okMsg: string): Promise<ApplyResult> {
    setBusy(true); setCurveErr(null);
    const res = await apply(command);
    setBusy(false);
    if (res.ok) toast.success(`${okMsg} · коммит v${res.planVersion}`);
    else toast.error(res.conflict ? "Конфликт версий — перезагружено" : `Отклонено: ${res.issues?.[0]?.message ?? res.message}`);
    return res;
  }

  const selMeta = sel ? model.metaByAsg.get(sel) ?? null : null;
  const selTask = selMeta ? model.leafTasks.find((t) => t.id === selMeta.asg.taskId) ?? null : null;

  const upsert = (asg: AsgRaw, patch: Partial<Pick<AsgRaw, "resourceId" | "role" | "unitsPermille" | "workMinutes">>) =>
    applyCmd(createPlanningCommand({ type: "assignment.upsert", payload: { id: asg.id, taskId: asg.taskId, resourceId: patch.resourceId ?? asg.resourceId, role: (patch.role ?? asg.role) as PlanAssignmentRole, unitsPermille: patch.unitsPermille ?? asg.unitsPermille, workMinutes: patch.workMinutes ?? asg.workMinutes } }), "Назначение обновлено").then(() => setDraft(null));

  const removeAsg = (asg: AsgRaw) => { setSel(null); void applyCmd(createPlanningCommand({ type: "assignment.delete", payload: { assignmentId: asg.id } }), "Исполнитель снят"); };

  const addAssignee = (taskId: string, resourceId: string, role: string) => {
    const t = model.leafTasks.find((x) => x.id === taskId);
    const used = (model.asgByTask.get(taskId) ?? []).filter((a) => WORKING.has(a.role)).reduce((s, a) => s + a.workMinutes, 0);
    // новый исполнитель забирает НЕразложенный остаток труда задачи (без дублирования)
    const work = WORKING.has(role) ? Math.max(0, (t?.workMinutes ?? 0) - used) : 0;
    void applyCmd(createPlanningCommand({ type: "assignment.upsert", payload: { id: nid("a"), taskId, resourceId, role: role as PlanAssignmentRole, unitsPermille: 1000, workMinutes: work } }), "Исполнитель добавлен");
  };

  // отправка кривой (assignment.allocations.replace) — оптимистично; сумма валидируется бэком
  async function applyCurve(m: AsgMeta, minutesByDay: Map<number, number>) {
    const allocations = [...minutesByDay.entries()].filter(([, mm]) => mm > 0).sort((a, b) => a[0] - b[0]).map(([day, mm]) => ({ date: dayToIso(day), workMinutes: mm }));
    const res = await applyCmd(createPlanningCommand({ type: "assignment.allocations.replace", payload: { assignmentId: m.asg.id, allocations } }), "Кривая распределения применена");
    if (res.ok || res.conflict) { setDraft(null); setCurveErr(null); } // успех или перезагрузка после конфликта — берём данные из модели
    else setCurveErr(res.issues?.[0]?.message ?? `Сумма распределения должна равняться ${h1(m.asg.workMinutes)} ч`);
  }
  const applyPreset = (m: AsgMeta, kind: "even" | "front" | "back") => {
    const mins = distribute(m.asg.workMinutes, presetWeights(m.days.length, kind));
    void applyCurve(m, new Map(m.days.map((d, i) => [d, mins[i] ?? 0])));
  };
  const resetCurve = (m: AsgMeta) => { void applyCmd(createPlanningCommand({ type: "assignment.allocations.replace", payload: { assignmentId: m.asg.id, allocations: [] } }), "Кривая сброшена к равномерной").then(() => setDraft(null)); };

  // дни для редактора кривой = рабочие дни расписания ∪ дни уже заданной кривой (на случай сдвига расписания)
  const editDaysOf = (m: AsgMeta): number[] => [...new Set([...m.days, ...m.explicit.keys()])].sort((x, y) => x - y);
  // черновик ручной правки кривой (минуты по дням) выбранного назначения; старт сбалансирован (сумма = труд)
  const curDraft = (m: AsgMeta): Map<number, number> => {
    if (draft) return draft;
    if (m.hasExplicit) return new Map(editDaysOf(m).map((d) => [d, m.explicit.get(d) ?? 0]));
    const mins = distribute(m.asg.workMinutes, presetWeights(m.days.length, "even"));
    return new Map(m.days.map((d, i) => [d, mins[i] ?? 0]));
  };
  const draftSum = selMeta ? [...curDraft(selMeta).values()].reduce((s, v) => s + v, 0) : 0;

  // труд назначений считаем только по рабочим ролям (исполнитель/соисполнитель)
  const sumAsgWork = (taskId: string) => (model.asgByTask.get(taskId) ?? []).filter((a) => WORKING.has(a.role)).reduce((s, a) => s + a.workMinutes, 0);

  return (
    <DeliveryFrame project={projectMeta} projectId={projectId} activeTab="Назначения">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <div className="text-[length:var(--text-sm)] text-[var(--muted)]">Задача → исполнители с дневной кривой распределения. Клик по исполнителю — {canManageAssignments ? "инспектор и редактор кривой" : "инспектор назначения"}.</div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-0.5 py-0.5">
            <button type="button" onClick={() => setMonthOffset((o) => Math.max(0, o - 1))} disabled={monthOffset <= 0} className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-40" aria-label="Предыдущий месяц"><ChevronLeft className="size-4" aria-hidden /></button>
            <span data-testid="assignments-month-label" className="min-w-[92px] text-center text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{monthLabel}</span>
            <button type="button" onClick={() => setMonthOffset((o) => Math.min(monthsList.length - 1, o + 1))} disabled={monthOffset >= monthsList.length - 1} className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-40" aria-label="Следующий месяц"><ChevronRight className="size-4" aria-hidden /></button>
          </div>
          <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-0.5">
            {(["day", "week"] as Gran[]).map((g) => (
              <button key={g} type="button" onClick={() => setGran(g)} className={cn("rounded-[var(--radius-sm)] px-2.5 py-1 text-[length:var(--text-sm)] font-medium transition-colors", gran === g ? "bg-[var(--panel-strong)] text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text)]")}>{g === "day" ? "День" : "Неделя"}</button>
            ))}
          </div>
        </div>
      </div>

      {prototypeNotesEnabled && canManageAssignments ? (
        <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          Реальный контракт: assignment.upsert / assignment.allocations.replace (сумма кривой = трудоёмкости) / assignment.delete. Кривая по дням редактируема; пресеты дают сбалансированную раскладку. Данные in-memory.
        </div>
      ) : null}
      {!model.hasProjectCalendar ? (
        <div role="status" className="mb-2 rounded-[var(--radius-md)] border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--warning-text)]">
          Календарь проекта не настроен. Дневное распределение трудозатрат недоступно.
        </div>
      ) : null}

      <div className="relative" data-testid="assignments-grid">
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <div className="flex min-w-full align-top" onMouseLeave={() => setHover(null)}>
            {/* sticky-left: задачи и исполнители */}
            <div className="sticky left-0 z-20 shrink-0 border-r border-[var(--border-strong)] bg-[var(--panel)]">
              <div className="flex items-center gap-2 border-b border-[var(--border-strong)] bg-[var(--panel-subtle)] px-3 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]" style={{ height: HEADER_H, width: LEFT_W }}>
                <span className="flex-1">Задача · исполнитель</span><span className="w-[120px] text-right">Роль · units · труд</span>
              </div>
              {model.leafTasks.map((t) => {
                const asgs = model.asgByTask.get(t.id) ?? [];
                return (
                  <div key={t.id}>
                    <div onMouseEnter={() => setHover({ key: `t:${t.id}`, col: -1 })} className={cn("flex items-center gap-1.5 border-b border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--panel-strong)_35%,var(--panel))] px-2", crosshair?.key === `t:${t.id}` && CROSS_SOFT)} style={{ height: ROW_H, width: LEFT_W }}>
                      <span className="mono shrink-0 text-[length:var(--text-xs)] text-[var(--muted)]">{t.wbsCode}</span>
                      <span className="min-w-0 flex-1 truncate text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{t.title}</span>
                      <span className="shrink-0 text-[length:var(--text-xs)] text-[var(--muted)]" title={`Труд задачи ${h1(t.workMinutes)} ч · сумма назначений ${h1(sumAsgWork(t.id))} ч`}>{h1(sumAsgWork(t.id))}/{h1(t.workMinutes)} ч</span>
                      {canManageAssignments ? (
                        <AddAssigneeDialog taskTitle={t.title} excludeIds={asgs.map((a) => a.resourceId)} resources={resDir.list} onSubmit={(rid, role) => addAssignee(t.id, rid, role)}>
                          <button type="button" className="grid size-5 shrink-0 place-items-center rounded text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--accent)]" title="Добавить исполнителя" disabled={busy}><Plus className="size-3.5" aria-hidden /></button>
                        </AddAssigneeDialog>
                      ) : null}
                    </div>
                    {asgs.length === 0 ? (
                      <div className="flex items-center border-b border-[var(--border-subtle)] px-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]" style={{ height: ROW_H, width: LEFT_W, paddingLeft: 28 }}>нет исполнителей</div>
                    ) : asgs.map((a) => {
                      const r = resDir.of(a.resourceId);
                      const m = model.metaByAsg.get(a.id)!;
                      const isSel = sel === a.id;
                      return (
                        <button key={a.id} type="button" data-testid={`assignment-row-${a.id}`} onMouseEnter={() => setHover({ key: `a:${a.id}`, col: -1 })} onClick={() => { setSel(a.id); setDraft(null); }} className={cn("flex w-full items-center gap-1.5 border-b border-[var(--border-subtle)] px-2 text-left outline-none hover:bg-[var(--panel-subtle)]", isSel ? "bg-[var(--accent-soft)]" : crosshair?.key === `a:${a.id}` && CROSS_SOFT)} style={{ height: ROW_H, width: LEFT_W, paddingLeft: 24 }}>
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--panel-strong)] text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{r?.name.slice(0, 1)}</span>
                        <span className="min-w-0 flex-1 truncate text-[length:var(--text-sm)] text-[var(--text)]">{r?.name}{m.hasExplicit ? <span className="ml-1 text-[length:var(--text-2xs)] text-[var(--accent)]">кривая</span> : null}</span>
                        <span className="w-[120px] shrink-0 truncate text-right text-[length:var(--text-xs)] text-[var(--muted)]">{roleLabel(a.role)} · {Math.round(a.unitsPermille / 10)}% · {h1(a.workMinutes)} ч</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* scrolling: периоды */}
            <div className="relative min-w-0 flex-1">
              <div className="flex border-b border-[var(--border-strong)] bg-[var(--panel-subtle)]" style={{ height: HEADER_H }}>
                {periods.map((p) => { const inCol = crosshair?.col === p.key; return <span key={p.key} className={cn("flex flex-col items-center justify-center border-r border-[var(--border-subtle)] text-[length:var(--text-xs)] leading-none", inCol && CROSS)} style={{ flex: `1 0 ${colW}px`, minWidth: colW, ...(p.weekend ? { background: WEEKEND_BG } : {}) }}><span className={cn("font-semibold", inCol ? "text-[var(--accent)]" : "text-[var(--muted-strong)]")}>{p.top}</span><span className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{p.sub}</span></span>; })}
              </div>
              {model.leafTasks.map((t) => {
                const asgs = model.asgByTask.get(t.id) ?? [];
                const metas = asgs.map((a) => model.metaByAsg.get(a.id)!);
                return (
                  <div key={t.id}>
                    <div onMouseEnter={() => setHover((h) => ({ key: `t:${t.id}`, col: h?.col ?? -1 }))} className="flex border-b border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--panel-strong)_22%,var(--panel))]" style={{ height: ROW_H }}>
                      {periods.map((p) => { const tot = metas.reduce((s, m) => s + cellMin(m, p), 0); const inCross = crosshair?.col === p.key || crosshair?.key === `t:${t.id}`; const isFocal = crosshair?.col === p.key && crosshair?.key === `t:${t.id}`; return <span key={p.key} onMouseEnter={() => setHover({ key: `t:${t.id}`, col: p.key })} className={cn("flex shrink-0 items-center justify-center border-r border-[var(--border-subtle)] text-[length:var(--text-2xs)] font-semibold tabular-nums text-[var(--muted-strong)]", isFocal ? CROSS_FOCAL : inCross ? CROSS : "")} style={{ flex: `1 0 ${colW}px`, minWidth: colW, ...(p.weekend ? { background: WEEKEND_BG } : {}) }}>{tot > 0 ? h1(tot) : ""}</span>; })}
                    </div>
                    {asgs.length === 0 ? <div className="border-b border-[var(--border-subtle)]" style={{ height: ROW_H }} /> : metas.map((m) => (
                      <div key={m.asg.id} onMouseEnter={() => setHover((h) => ({ key: `a:${m.asg.id}`, col: h?.col ?? -1 }))} className={cn("flex border-b border-[var(--border-subtle)]", sel === m.asg.id && "bg-[var(--accent-soft)]")} style={{ height: ROW_H }}>
                        {periods.map((p) => {
                          const mm = cellMin(m, p);
                          const hrs = mm / 60;
                          const intensity = Math.min(1, hrs / (p.days.length * 8));
                          const inCross = crosshair?.col === p.key || crosshair?.key === `a:${m.asg.id}`;
                          const isFocal = crosshair?.col === p.key && crosshair?.key === `a:${m.asg.id}`;
                          const bg = mm > 0 ? `color-mix(in oklab, var(--accent) ${Math.round(14 + intensity * 46)}%, var(--panel))` : p.weekend ? WEEKEND_BG : "transparent";
                          return <span key={p.key} onMouseEnter={() => setHover({ key: `a:${m.asg.id}`, col: p.key })} className={cn("flex shrink-0 items-center justify-center border-r border-[var(--border-subtle)] text-[length:var(--text-2xs)] tabular-nums", isFocal ? CROSS_FOCAL : inCross ? CROSS : "")} style={{ flex: `1 0 ${colW}px`, minWidth: colW, background: bg, color: intensity > 0.6 ? "#fff" : "var(--text)" }} title={mm > 0 ? `${resName(m.asg.resourceId)} · ${h1(mm)} ч` : ""}>{mm > 0 ? h1(mm) : ""}</span>;
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* инспектор назначения */}
        {selMeta && selTask ? (
          <aside data-testid="assignment-inspector" className="absolute right-0 top-0 z-30 flex h-full w-[380px] flex-col border-l border-[var(--border-strong)] bg-[var(--panel)] shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <div className="mono text-[length:var(--text-xs)] text-[var(--muted)]">{selTask.wbsCode} · {selTask.title}</div>
                <h3 className="truncate text-[length:var(--text-base)] font-bold text-[var(--text-strong)]">{resName(selMeta.asg.resourceId)}</h3>
              </div>
              <button type="button" onClick={() => { setSel(null); setDraft(null); }} className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)]" aria-label="Закрыть"><X className="size-4" aria-hidden /></button>
            </div>
            <div className="flex-1 overflow-auto px-4 py-3 text-[length:var(--text-sm)]">
              {canManageAssignments ? (
                <>
              {/* атрибуты назначения */}
              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-2 block"><span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Ресурс</span>
                  <select data-testid="assignment-resource-select" value={selMeta.asg.resourceId} onChange={(e) => void upsert(selMeta.asg, { resourceId: e.target.value })} disabled={busy} className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]">
                    {resDir.list.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.positionName}</option>)}
                  </select>
                </label>
                <label className="block"><span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Роль</span>
                  <select data-testid="assignment-role-select" value={selMeta.asg.role} onChange={(e) => void upsert(selMeta.asg, { role: e.target.value })} disabled={busy} className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]">
                    {ROLES.map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
                  </select>
                </label>
                <label className="block"><span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Единицы %</span>
                  <input data-testid="assignment-units-input" key={`u-${selMeta.asg.id}-${selMeta.asg.unitsPermille}`} type="number" defaultValue={Math.round(selMeta.asg.unitsPermille / 10)} onBlur={(e) => { const unitsPermille = parseAssignmentUnits(e.target.value); if (unitsPermille === null) { e.currentTarget.value = String(Math.round(selMeta.asg.unitsPermille / 10)); return; } if (unitsPermille !== selMeta.asg.unitsPermille) void upsert(selMeta.asg, { unitsPermille }); }} disabled={busy} className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-right tabular-nums outline-none focus:border-[var(--accent)]" />
                </label>
                <label className="col-span-2 block"><span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Трудозатраты, ч</span>
                  <input data-testid="assignment-work-input" key={`w-${selMeta.asg.id}-${selMeta.asg.workMinutes}`} type="number" defaultValue={assignmentHoursInputValue(selMeta.asg.workMinutes)} step={0.5} onBlur={(e) => { const minutes = parseAssignmentHours(e.target.value); if (minutes === null) { e.currentTarget.value = String(assignmentHoursInputValue(selMeta.asg.workMinutes)); return; } if (minutes !== selMeta.asg.workMinutes) void upsert(selMeta.asg, { workMinutes: minutes }); }} disabled={busy} className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-right tabular-nums outline-none focus:border-[var(--accent)]" />
                  <span className="mt-0.5 block text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Изменение труда/единиц сбрасывает кривую к равномерной.</span>
                </label>
              </div>

              {/* кривая распределения */}
              <div className="mt-4 mb-1.5 flex items-center justify-between">
                <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Кривая распределения</span>
                <span className={cn("text-[length:var(--text-xs)] tabular-nums", draftSum === selMeta.asg.workMinutes ? "text-[var(--success-text)]" : "text-[var(--danger)]")}>{h1(draftSum)} / {h1(selMeta.asg.workMinutes)} ч</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                <Button variant="secondary" size="sm" disabled={busy || selMeta.days.length === 0} onClick={() => applyPreset(selMeta, "even")}>Равномерно</Button>
                <Button variant="secondary" size="sm" disabled={busy || selMeta.days.length === 0} onClick={() => applyPreset(selMeta, "front")}>К началу</Button>
                <Button variant="secondary" size="sm" disabled={busy || selMeta.days.length === 0} onClick={() => applyPreset(selMeta, "back")}>К концу</Button>
                {selMeta.hasExplicit ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => resetCurve(selMeta)}>Сбросить</Button> : null}
              </div>
              {curveErr ? <div className="mb-2 rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--danger-soft)] px-2 py-1 text-[length:var(--text-xs)] text-[var(--danger-text)]">{curveErr}</div> : null}
              <div className="max-h-[240px] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                {editDaysOf(selMeta).length === 0 ? <div className="px-2 py-3 text-center text-[length:var(--text-xs)] text-[var(--muted)]">Нет рабочих дней в расписании задачи.</div> : editDaysOf(selMeta).map((d) => {
                  const dt = new Date(baseMs + d * 86_400_000);
                  const cur = curDraft(selMeta).get(d) ?? 0;
                  return (
                    <label key={d} className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-2 py-1 last:border-b-0">
                      <span className="mono w-[78px] shrink-0 text-[length:var(--text-xs)] text-[var(--muted)]">{String(dt.getUTCDate()).padStart(2, "0")}.{String(dt.getUTCMonth() + 1).padStart(2, "0")} {DOW[dt.getUTCDay()]}</span>
                      <input data-testid={`curve-day-${dayToIso(d)}`} type="number" value={Math.round((cur / 60) * 10) / 10} step={0.5} min={0} onChange={(e) => { const map = new Map(curDraft(selMeta)); map.set(d, Math.max(0, Math.round(Number(e.target.value) * 60))); setDraft(map); }} className="h-7 flex-1 rounded border border-[var(--border)] bg-[var(--panel)] px-1 text-right tabular-nums outline-none focus:border-[var(--accent)]" />
                      <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">ч</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <Button variant="default" size="sm" disabled={busy || selMeta.days.length === 0} onClick={() => applyCurve(selMeta, curDraft(selMeta))}>Применить кривую</Button>
                {draft ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setDraft(null); setCurveErr(null); }}>Отмена</Button> : null}
              </div>
              <p className="mt-2 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Сумма по дням должна равняться трудоёмкости назначения — иначе изменения будут отклонены.</p>

              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <ConfirmDialog
                  title={`Снять исполнителя «${resName(selMeta.asg.resourceId)}»?`}
                  description="Назначение и его кривая распределения будут удалены."
                  confirmLabel="Снять"
                  onConfirm={() => removeAsg(selMeta.asg)}
                >
                  <Button variant="ghost" size="sm" disabled={busy} className="text-[var(--danger-text)] hover:bg-[var(--danger-soft)]"><Trash2 className="size-3.5" aria-hidden />Снять исполнителя</Button>
                </ConfirmDialog>
              </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Ресурс</span>
                      <div className="text-[var(--text)]">{resName(selMeta.asg.resourceId)}</div>
                    </div>
                    <div>
                      <span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Роль</span>
                      <div className="text-[var(--text)]">{roleLabel(selMeta.asg.role)}</div>
                    </div>
                    <div>
                      <span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Единицы</span>
                      <div className="tabular-nums text-[var(--text)]">{Math.round(selMeta.asg.unitsPermille / 10)}%</div>
                    </div>
                    <div className="col-span-2">
                      <span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Трудозатраты</span>
                      <div className="tabular-nums text-[var(--text)]">{h1(selMeta.asg.workMinutes)} ч</div>
                    </div>
                  </div>

                  <div className="mt-4 mb-1.5 flex items-center justify-between">
                    <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Кривая распределения</span>
                    <span className="text-[length:var(--text-xs)] tabular-nums text-[var(--muted-strong)]">{h1(draftSum)} / {h1(selMeta.asg.workMinutes)} ч</span>
                  </div>
                  <div className="max-h-[240px] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                    {editDaysOf(selMeta).length === 0 ? <div className="px-2 py-3 text-center text-[length:var(--text-xs)] text-[var(--muted)]">Нет рабочих дней в расписании задачи.</div> : editDaysOf(selMeta).map((d) => {
                      const dt = new Date(baseMs + d * 86_400_000);
                      const cur = curDraft(selMeta).get(d) ?? 0;
                      return (
                        <div key={d} className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-2 py-1 last:border-b-0">
                          <span className="mono w-[78px] shrink-0 text-[length:var(--text-xs)] text-[var(--muted)]">{String(dt.getUTCDate()).padStart(2, "0")}.{String(dt.getUTCMonth() + 1).padStart(2, "0")} {DOW[dt.getUTCDay()]}</span>
                          <span className="flex-1 text-right tabular-nums text-[var(--text)]">{Math.round((cur / 60) * 10) / 10}</span>
                          <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">ч</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </aside>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
        {canManageAssignments ? <span className="inline-flex items-center gap-1"><UserPlus className="size-3.5" aria-hidden />+ на строке задачи — добавить исполнителя</span> : null}
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded" style={{ background: WEEKEND_BG }} /> выходной</span>
        <span>Число в ячейке — часы за период · «кривая» у имени — задана явная дневная раскладка · наведение — прицел</span>
      </div>
    </DeliveryFrame>
  );
}
