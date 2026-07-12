"use client";

import Link from "next/link";
import { Fragment, type ClipboardEvent as ReactClipboardEvent, type ComponentProps, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, ChevronDown, ChevronRight, ClipboardPaste, Columns3, Filter, GitBranch, GripVertical, IndentDecrease, IndentIncrease, Layers, Plus, TriangleAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, deriveProjectMeta, planningErr, useProjectBase } from "@/delivery/lib/project-chrome";
import { createClientId } from "@/delivery/lib/client-id";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { dayToIso, isoToDay, MOCK_PROJECT_ID, RESOURCES } from "@/delivery/lib/planning-demo-data";
import { currentPlanDate, deriveScheduleTimeline, formatWeekLabel } from "@/delivery/lib/date-origin";
import { usePlanning, type ApplyResult } from "@/delivery/lib/use-planning";
import { usePlanningRuntime } from "@/delivery/lib/planning-runtime";
import { usePointerDrag } from "@/delivery/lib/use-pointer-drag";
import { useResourceDirectory } from "@/delivery/lib/use-resource-directory";
import { hasPermission } from "@/lib/permissions";
import { useSessionUser } from "@/shell/use-session-user";
import { DateEditor, DependencyEditor, DEP_RU, LinkLagEditor, ResourceEditor, RowMenu, TaskModal, type TaskModalSubmitResult, type TaskModalValues } from "@/delivery/schedule/schedule-editors";
import { createPlanningCommand } from "@kiss-pm/domain";
import type { DependencyType, PlanAssignmentRole, PlanningCommand, TaskType } from "@kiss-pm/domain";
import { buildCompensatingCommandBatch, type PlanningReadModel } from "@kiss-pm/planning-client";
import { mapRows, type Kind, type Mode, type Pred, type Row } from "@/delivery/schedule/schedule-rows";
import { buildFinishDateFillCommands, buildPasteCommands, createTaskTsvId, getScheduleNavigationTarget, parseTaskTsv, resolveFinishFillDrag, shouldRunScheduleUndo } from "@/delivery/schedule/schedule-productivity";
import { buildMilestoneCommands } from "@/delivery/schedule/schedule-milestone";
import { ScheduleSavedViews, type ScheduleSavedViewPayload, type ScheduleZoom } from "@/delivery/schedule/schedule-saved-views";
import {
  resolveScheduleWorkingTime,
  scheduleFinishDateForDuration,
  scheduleWorkingDateOnOrAfter,
  scheduleWorkingMinutesThroughDate,
  type ScheduleCalendarSource
} from "@/delivery/schedule/schedule-working-time";
import { TaskPeek, type TaskPeekRecord } from "@/workspace/task-peek/task-peek";

const genId = createClientId;
const PLAN_MANAGE_PERMISSION = "tenant.project_plan.manage";
const RESOURCE_MANAGE_PERMISSION = "tenant.project_resources.manage";
const SCHEDULE_NAVIGATION_GUARD_STATE_KEY = "__kissPmScheduleNavigationGuard";

export function canManageScheduleControls({ live, permissions }: { live: boolean; permissions: readonly string[] }): boolean {
  return !live || hasPermission(permissions, PLAN_MANAGE_PERMISSION);
}

export function canManageScheduleResourceControls({ live, permissions }: { live: boolean; permissions: readonly string[] }): boolean {
  return !live || hasPermission(permissions, RESOURCE_MANAGE_PERMISSION);
}

function ScheduleRowMenu({ canManagePlan, children, ...props }: ComponentProps<typeof RowMenu> & { canManagePlan: boolean }) {
  return canManagePlan ? <RowMenu {...props}>{children}</RowMenu> : <>{children}</>;
}

type EditField = "name" | "dur" | "work" | "pct"; // редактируемые ячейки сетки (для Tab-навигации)
type ScheduleAssignmentRef = {
  id: string;
  taskId: string;
  resourceId: string;
  role?: PlanAssignmentRole;
  unitsPermille?: number;
};

function rowDurationMinutes(row: Row): number {
  return row.durationMinutes ??
    Math.round(row.durDays * row.workingMinutesPerDay);
}

function scaledWorkMinutes(row: Row, durationMinutes: number): number {
  const previousDurationMinutes = rowDurationMinutes(row);
  return previousDurationMinutes > 0
    ? Math.max(0, Math.round(durationMinutes * row.workH * 60 / previousDurationMinutes))
    : Math.max(0, durationMinutes);
}

export function resolveScheduleTiming(
  source: ScheduleCalendarSource,
  calendarId: string | null | undefined,
  startIso: string | null,
  durationDays: number
): { durationMinutes: number; finishIso: string | null; workingMinutesPerDay: number } {
  const workingTime = resolveScheduleWorkingTime(source, calendarId);
  const durationMinutes = Math.max(
    0,
    Math.round(durationDays * workingTime.workingMinutesPerDay)
  );
  return {
    durationMinutes,
    finishIso: startIso
      ? scheduleFinishDateForDuration(startIso, durationMinutes, workingTime)
      : null,
    workingMinutesPerDay: workingTime.workingMinutesPerDay
  };
}

export type ScheduleWorkModelRef = { taskType: TaskType; effortDriven: boolean };

/**
 * Существующая семантика work model задачи. Правки длительности/дат/труда НЕ должны
 * молча переписывать taskType/effortDriven (иначе редактирование метаданных превращало
 * fixed_units/fixed_work задачу в fixed_duration — семантика планирования терялась).
 * Fallback fixed_duration/false — только для legacy-строк без задачи в read-model.
 */
export function resolveTaskWorkModel(
  tasks: ReadonlyArray<{ id: string; taskType: TaskType; effortDriven: boolean }>,
  taskId: string
): ScheduleWorkModelRef {
  const task = tasks.find((candidate) => candidate.id === taskId);
  return { taskType: task?.taskType ?? "fixed_duration", effortDriven: task?.effortDriven ?? false };
}

export function buildScheduleWorkCommand(
  row: Row,
  durationDays: number,
  workHours: number,
  workModel: ScheduleWorkModelRef = { taskType: "fixed_duration", effortDriven: false }
): PlanningCommand {
  return createPlanningCommand({
    type: "task.update_work_model",
    payload: {
      taskId: row.id,
      taskType: workModel.taskType,
      effortDriven: workModel.effortDriven,
      durationMinutes: Math.max(0, Math.round(durationDays * row.workingMinutesPerDay)),
      workMinutes: Math.max(0, Math.round(workHours * 60))
    }
  });
}

export function buildScheduleDependencyCommand(input: {
  id: string;
  predecessorTaskId: string;
  successor: Row;
  type: DependencyType;
  lagDays: number;
}): PlanningCommand {
  return createPlanningCommand({
    type: "dependency.upsert",
    payload: {
      id: input.id,
      predecessorTaskId: input.predecessorTaskId,
      successorTaskId: input.successor.id,
      dependencyType: input.type,
      lagMinutes: Math.round(input.lagDays * input.successor.workingMinutesPerDay)
    }
  });
}

export function buildScheduleRangeCommands(input: {
  source: ScheduleCalendarSource;
  row: Row;
  startIso: string;
  finishIso: string;
  assignment?: ScheduleAssignmentRef;
  /** Семантика задачи (resolveTaskWorkModel) — без неё legacy fixed_duration. */
  workModel?: ScheduleWorkModelRef;
}): PlanningCommand[] | null {
  const workingTime = resolveScheduleWorkingTime(
    input.source,
    input.row.effectiveCalendarId
  );
  const startIso = scheduleWorkingDateOnOrAfter(input.startIso, workingTime);
  const finishIso = scheduleWorkingDateOnOrAfter(input.finishIso, workingTime);
  const durationMinutes = scheduleWorkingMinutesThroughDate(
    startIso,
    finishIso,
    workingTime
  );
  if (durationMinutes <= 0) return null;

  const workMinutes = scaledWorkMinutes(input.row, durationMinutes);
  const commands: PlanningCommand[] = [
    createPlanningCommand({
      type: "task.update_schedule",
      payload: { taskId: input.row.id, plannedStart: startIso, plannedFinish: finishIso }
    }),
    createPlanningCommand({
      type: "task.update_work_model",
      payload: {
        taskId: input.row.id,
        taskType: input.workModel?.taskType ?? "fixed_duration",
        effortDriven: input.workModel?.effortDriven ?? false,
        durationMinutes,
        workMinutes
      }
    })
  ];
  if (input.assignment) {
    commands.push(createPlanningCommand({
      type: "assignment.upsert",
      payload: {
        id: input.assignment.id,
        taskId: input.row.id,
        resourceId: input.assignment.resourceId,
        role: input.assignment.role ?? "executor",
        unitsPermille: input.assignment.unitsPermille ?? 1000,
        workMinutes
      }
    }));
  }
  return commands;
}

export function buildScheduleMoveCommand(
  source: ScheduleCalendarSource,
  row: Row,
  requestedStartIso: string
): PlanningCommand {
  const workingTime = resolveScheduleWorkingTime(source, row.effectiveCalendarId);
  const plannedStart = scheduleWorkingDateOnOrAfter(requestedStartIso, workingTime);
  const plannedFinish = scheduleFinishDateForDuration(
    plannedStart,
    rowDurationMinutes(row),
    workingTime
  );
  return createPlanningCommand({
    type: "task.update_schedule",
    payload: { taskId: row.id, plannedStart, plannedFinish }
  });
}

export function scheduleUnitsPercent(row: Row): number {
  const durationMinutes = rowDurationMinutes(row);
  return durationMinutes > 0
    ? Math.round(row.workH * 60 / durationMinutes * 100)
    : 100;
}

// Оптимистичный патч read-model: применяем правку локально мгновенно (до ответа бэка).
// summary-rollup пересчитает mapRows; полный каскад/критпуть вернёт бэк.
export function optimisticPatch(rm: PlanningReadModel, command: PlanningCommand): PlanningReadModel {
  const cmd = command as { type: string; payload: Record<string, unknown> };
  // optimisticPatch мутирует ЧАСТИЧНУЮ копию (только трогаемые поля) — авторитетную полную форму
  // вернёт бэк, поэтому здесь узкие локальные типы, а не полный PlanTask/CalculatedTask.
  type PatchTask = { id: string; parentTaskId: string | null; wbsCode: string; title: string; schedulingMode: Mode; durationMinutes: number | null; workMinutes: number; percentComplete: number; calendarId?: string | null; customFields?: Record<string, unknown> };
  type PatchCalc = { id: string; calculatedStart: string; calculatedFinish: string; totalSlackMinutes: number | null; isCritical: boolean };
  const authored = rm.authored as unknown as { tasks: PatchTask[] };
  const calcPlan = rm.calculatedPlan as unknown as { tasks: PatchCalc[] };
  const tasks = authored.tasks.map((t) => ({ ...t }));
  const calc = calcPlan.tasks.map((c) => ({ ...c }));
  const id = cmd.payload.taskId as string;
  const T = tasks.find((t) => t.id === id);
  const C = calc.find((c) => c.id === id);
  switch (cmd.type) {
    case "task.update_work_model":
      if (T) { if (cmd.payload.durationMinutes != null) T.durationMinutes = cmd.payload.durationMinutes as number; if (typeof cmd.payload.workMinutes === "number") T.workMinutes = cmd.payload.workMinutes; }
      if (T && C?.calculatedStart && T.durationMinutes != null) {
        const workingTime = resolveScheduleWorkingTime(rm, T.calendarId);
        C.calculatedFinish = scheduleFinishDateForDuration(
          C.calculatedStart,
          T.durationMinutes,
          workingTime
        );
      }
      break;
    case "task.update_progress":
      if (T) T.percentComplete = cmd.payload.percentComplete as number;
      break;
    case "task.update_identity":
      if (T) T.title = String(cmd.payload.title);
      break;
    case "task.update_schedule": {
      const ps = cmd.payload.plannedStart as string | null;
      const pf = cmd.payload.plannedFinish as string | null;
      if (C && ps) C.calculatedStart = ps;
      if (C && pf) C.calculatedFinish = pf;
      break;
    }
    case "assignment.upsert": {
      const rid = String(cmd.payload.resourceId);
      const name = RESOURCES.find((resource) => resource.id === rid)?.name ?? rid;
      if (T) T.customFields = { ...(T.customFields ?? {}), resLabel: name };
      break;
    }
    case "task.create": {
      // Инлайн-создание: вставляем новую задачу сразу (мгновенный отклик).
      // wbsCode — плейсхолдер «…»; авторитетную нумерацию вернёт бэк (mock task.create).
      const p = cmd.payload;
      const newId = String(p.id);
      const workingTime = resolveScheduleWorkingTime(rm, null);
      tasks.push({
        id: newId,
        parentTaskId: (p.parentTaskId as string | null) ?? null,
        wbsCode: "…",
        title: String(p.title ?? "Новая задача"),
        schedulingMode: "auto",
        durationMinutes: typeof p.durationMinutes === "number"
          ? p.durationMinutes
          : 5 * workingTime.workingMinutesPerDay,
        workMinutes: typeof p.workMinutes === "number"
          ? p.workMinutes
          : 5 * workingTime.workingMinutesPerDay,
        percentComplete: 0,
        calendarId: rm.project.calendarId,
        customFields: {}
      });
      calc.push({ id: newId, calculatedStart: "", calculatedFinish: "", totalSlackMinutes: null, isCritical: false });
      break;
    }
    default:
      return rm;
  }
  return { ...rm, authored: { ...(rm.authored as Record<string, unknown>), tasks }, calculatedPlan: { ...(rm.calculatedPlan as Record<string, unknown>), tasks: calc } } as unknown as PlanningReadModel;
}

const PROJECT: ProjectMeta = {
  name: "Производственный портал · Релиз 2",
  code: "ПР",
  status: "В работе",
  statusTone: "info",
  planVersion: "v17",
  deadline: "12.07.2026",
  finish: "14.06.2026",
  variance: { label: "+2 дня к базовому плану B2", tone: "warning" }
};

const ROW_H = 36;
const HEADER_H = 36;

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

const ZOOM_DAY_W = { day: 36, week: 20, month: 8 } as const;
type Zoom = ScheduleZoom;
type DragMode = "move" | "resize" | "resizeLeft" | "progress";
type DragState = { id: string; mode: DragMode; startX: number; origStart: number; origDur: number; origWorkH: number; origPct: number; deltaDays: number; curPct: number };
type ColDrag = { index: number; startX: number; origW: number };
type LinkDrag = { fromId: string; fromEdge: "start" | "finish"; fromX: number; fromY: number; curX: number; curY: number };

const COLS: Array<{ key: string; label: string; align?: string; w: number }> = [
  { key: "id", label: "#", align: "num", w: 52 },
  { key: "mode", label: "Реж", w: 64 },
  { key: "wbs", label: "WBS", w: 44 },
  { key: "name", label: "Название", w: 196 },
  { key: "dur", label: "Длит", align: "num", w: 52 },
  { key: "work", label: "Труд", align: "num", w: 56 },
  { key: "pct", label: "%", align: "num", w: 44 },
  { key: "start", label: "Начало", w: 90 },
  { key: "finish", label: "Окончание", w: 90 },
  { key: "res", label: "Ресурсы", w: 120 },
  { key: "pred", label: "Предш.", w: 104 }
];
const DEFAULT_COLW = COLS.map((c) => c.w);

function ModeChip({ mode }: { mode: Mode }) {
  return (
    <span className={cn("inline-flex items-center rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.03em]", mode === "auto" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--warning-soft)] text-[var(--warning-text)]")} title={mode === "auto" ? "Авто — планирует движок" : "Ручной — даты заданы вручную"}>
      {mode === "auto" ? "Авто" : "Ручной"}
    </span>
  );
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const numInput = "w-full rounded-[var(--radius-xs)] border border-[var(--accent)] bg-[var(--panel)] px-1 text-right text-[length:var(--text-sm)] tabular-nums outline-none";
const cellBtn = "block w-full cursor-pointer truncate rounded-[var(--radius-xs)] px-1 text-left hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]";

function taskPeekRecordFromScheduleRow(row: Row, projectId: string, projectName: string): TaskPeekRecord {
  return {
    id: row.id,
    title: row.name,
    project: { id: projectId, name: projectName },
    ...(row.startIso ? { plannedStart: row.startIso } : {}),
    ...(row.finishIso ? { plannedFinish: row.finishIso } : {}),
    durationWorkingDays: row.durDays,
    plannedWork: row.workH,
    progress: row.pct
  };
}

export function ProjectSchedule({ projectId = MOCK_PROJECT_ID }: { projectId?: string }) {
  const { live } = usePlanningRuntime();
  const sessionUser = useSessionUser();
  const permissions = sessionUser?.permissions ?? [];
  const canManagePlan = canManageScheduleControls({ live, permissions });
  const canManageResources = canManageScheduleResourceControls({ live, permissions });
  const { readModel, setReadModel, status, error, reload, apply, applyBatch } = usePlanning(projectId);
  const projectBase = useProjectBase(projectId, PROJECT);
  const resourceDirectory = useResourceDirectory();
  const planningResources = resourceDirectory.list;
  const resourceOverride = live && planningResources.length === 0
    ? undefined
    : planningResources;
  const resourceOverrideProps = resourceOverride
    ? { resources: resourceOverride }
    : {};
  const resName = useMemo(() => {
    const names = new Map(planningResources.map((resource) => [resource.id, resource.name]));
    return (id: string) => names.get(id) ?? `Участник ${id.slice(-4)}`;
  }, [planningResources]);
  const [zoom, setZoom] = useState<Zoom>("week");
  const [sel, setSel] = useState<string | null>("t-3.2.1");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [edit, setEdit] = useState<{ id: string; field: EditField } | null>(null);
  const [draft, setDraft] = useState("");
  // Excel-подобная инлайн-строка создания внизу WBS: имя → Enter создаёт + очищает для следующей.
  const [newTask, setNewTask] = useState("");
  // Позиционированная инлайн-строка создания (из ПКМ-меню): рендерится после строки afterId.
  // parentId — родитель создаваемой задачи (null=верхний уровень; r.id=подзадача r; r.parentId=рядом с r).
  const [inlineNew, setInlineNew] = useState<{ parentId: string | null; afterId: string; draft: string } | null>(null);
  const inlineRef = useRef<HTMLInputElement | null>(null);
  // При Tab-навигации moveEdit уже коммитит текущую ячейку; подавляем повторный коммит из onBlur.
  const skipBlurRef = useRef(false);
  const editableClickTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (editableClickTimerRef.current !== null) window.clearTimeout(editableClickTimerRef.current);
  }, []);
  const [flash, setFlash] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  // инлайн-валидация строк создания задачи (мин. 3 символа) — у поля, не в toast
  const [createError, setCreateError] = useState<{ scope: "bottom" | "inline"; msg: string } | null>(null);
  // подтверждение архивации задачи (необратимое действие) — из ПКМ-меню строки
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [errors, setErrors] = useState<Map<string, string[]>>(() => new Map());
  const [batchMode, setBatchMode] = useState(false);
  const [staged, setStaged] = useState<PlanningCommand[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [pasteIssue, setPasteIssue] = useState<string | null>(null);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillDate, setFillDate] = useState("");
  const [fillMode, setFillMode] = useState<"same" | "series">("series");
  const [fillDragRange, setFillDragRange] = useState<Set<string>>(() => new Set());
  // asgId — id текущего назначения редактируемой задачи: reuse в submitTaskModal, чтобы upsert
  // обновлял его (а не плодил второе назначение, удваивая нагрузку — реальный редьюсер upsert-ит по id).
  const [taskModal, setTaskModal] = useState<{ mode: "create" | "edit"; parentId: string | null; taskId?: string; asgId?: string; initial: TaskModalValues } | null>(null);
  const [colW, setColW] = useState<number[]>(() => [...DEFAULT_COLW]);
  const savedViewPayload = useMemo<ScheduleSavedViewPayload>(() => ({
    version: 1,
    zoom,
    columnWidths: [...colW],
    collapsedTaskIds: [...collapsed]
  }), [collapsed, colW, zoom]);

  function applySavedView(payload: ScheduleSavedViewPayload) {
    setZoom(payload.zoom);
    setColW([...payload.columnWidths]);
    setCollapsed(new Set(payload.collapsedTaskIds));
  }

  const mapped = useMemo(() => (readModel ? mapRows(readModel, resName) : null), [readModel, resName]);
  const parsedPaste = useMemo(() => parseTaskTsv(pasteDraft, readModel ?? {}), [pasteDraft, readModel]);
  const dayW = ZOOM_DAY_W[zoom];
  const lastCommitRef = useRef<{ commands: PlanningCommand[]; before: PlanningReadModel; afterVersion: number } | null>(null);
  const batchBaseRef = useRef<PlanningReadModel | null>(null);
  const operationRef = useRef(false);
  const navigationGuardRestoringRef = useRef(false);
  const navigationGuardBypassAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const lastAppliedPasteRef = useRef<string | null>(null);
  const quickCreateRef = useRef<HTMLInputElement | null>(null);
  const rowElementsRef = useRef<Map<string, HTMLTableRowElement>>(new Map()).current;
  const fillDragTargetRef = useRef<string | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const taskPeekTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  // Актуальный read-model для window-обработчиков drag/resize (без устаревшего замыкания эффекта):
  // нужен, чтобы в момент отпускания резолвить текущее назначение задачи и синхронить его труд.
  const readModelRef = useRef(readModel);
  readModelRef.current = readModel;
  // Актуальные геометрия строк и ширина дня для window-обработчика перетягивания связи:
  // жест usePointerDrag переподписывается лишь при старте/финише, поэтому без рефов up() резолвил
  // бы край цели по устаревшим mapped/dayW (async-обновление read-model или смена зума в процессе
  // жеста → неверный тип связи).
  const mappedRef = useRef(mapped);
  mappedRef.current = mapped;
  const dayWRef = useRef(dayW);
  dayWRef.current = dayW;
  const timelineOriginDayRef = useRef(0);

  function toTimelineX(day: number): number {
    return (day - timelineOriginDayRef.current) * dayWRef.current;
  }

  // drag/resize баров: общий window-жест (usePointerDrag: зеркало-реф + слушатели + очистка)
  const barDrag = usePointerDrag<DragState>({
    onMove: (e, cur, set) => {
      if (cur.mode === "progress") {
        const rect = ganttRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(100, Math.round(((x - toTimelineX(cur.origStart)) / Math.max(1, cur.origDur * dayW)) * 100)));
        if (pct !== cur.curPct) set({ ...cur, curPct: pct });
        return;
      }
      const nd = Math.round((e.clientX - cur.startX) / dayW);
      if (nd !== cur.deltaDays) set({ ...cur, deltaDays: nd });
    },
    onUp: (_e, cur) => {
      if (cur.mode === "progress") {
        if (cur.curPct !== cur.origPct) void applyCmd(createPlanningCommand({ type: "task.update_progress", payload: { taskId: cur.id, percentComplete: cur.curPct } }));
        return;
      }
      if (cur.deltaDays === 0) return;
      const source = readModelRef.current;
      const row = mappedRef.current?.rows.find((candidate) => candidate.id === cur.id);
      if (!source || !row) return;
      const assignment = source.authored.assignments.find(
        (candidate) => candidate.taskId === cur.id
      );
      const projectStartDay = isoToDay(source.project.plannedStart);
      if (cur.mode === "move") {
        const ns = Math.max(projectStartDay, cur.origStart + cur.deltaDays);
        if (ns === cur.origStart) return;
        void applyCmd(buildScheduleMoveCommand(source, row, dayToIso(ns)));
      } else if (cur.mode === "resizeLeft") {
        // Тяга левого края меняет старт И длительность → шлём update_schedule + update_work_model
        // + синк назначения (как editFinish). Иначе WBS покажет новые часы, а Ресурсы/Сценарии —
        // старую нагрузку (она считается из assignment.workMinutes).
        const ns = Math.max(projectStartDay, cur.origStart + cur.deltaDays);
        const nf = cur.origStart + cur.origDur;
        const nd = nf - ns;
        if (ns === cur.origStart) return;
        if (nd >= 1) {
          const commands = buildScheduleRangeCommands({
            source,
            row,
            startIso: dayToIso(ns),
            finishIso: dayToIso(nf),
            workModel: resolveTaskWorkModel(source.authored.tasks, cur.id),
            ...(assignment ? { assignment } : {})
          });
          if (commands) void runBatch(commands);
        }
      } else {
        const nd = Math.max(1, cur.origDur + cur.deltaDays);
        if (nd === cur.origDur) return;
        const commands = buildScheduleRangeCommands({
          source,
          row,
          startIso: row.startIso,
          finishIso: dayToIso(cur.origStart + nd),
          workModel: resolveTaskWorkModel(source.authored.tasks, cur.id),
          ...(assignment ? { assignment } : {})
        });
        if (commands) void runBatch(commands);
      }
    }
  });
  const drag = barDrag.state;

  // resize колонок: тот же общий жест; ширина мутирует live в onMove,
  // поэтому отмена (Escape/pointercancel) откатывает к исходной ширине.
  const colResize = usePointerDrag<ColDrag>({
    onMove: (e, cur) => {
      const w = Math.max(36, Math.round(cur.origW + (e.clientX - cur.startX)));
      setColW((prev) => { const n = [...prev]; n[cur.index] = w; return n; });
    },
    onUp: () => {},
    onCancel: (cur) => {
      setColW((prev) => { const n = [...prev]; n[cur.index] = cur.origW; return n; });
    }
  });

  // перетягивание связи между барами (создание зависимости): тот же общий жест
  const linkDrag = usePointerDrag<LinkDrag>({
    onMove: (e, cur, set) => {
      const rect = ganttRef.current?.getBoundingClientRect();
      if (!rect) return;
      set({ ...cur, curX: e.clientX - rect.left, curY: e.clientY - rect.top - HEADER_H });
    },
    onUp: (e, cur) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const target = el?.closest("[data-task-id]") as HTMLElement | null;
      const targetId = target?.dataset.taskId;
      if (!targetId || targetId === cur.fromId) return;
      // тип связи = из какого края тянули → в какой край цели (по позиции курсора)
      const tr = mappedRef.current?.rows.find((x) => x.id === targetId);
      if (!tr || tr.kind === "summary") return;
      const rect = ganttRef.current?.getBoundingClientRect();
      let toEdge: "start" | "finish" = "start";
      if (tr && rect) { const x = e.clientX - rect.left; const mid = toTimelineX(tr.dayStart) + (tr.dayDur / 2) * dayWRef.current; toEdge = x < mid ? "start" : "finish"; }
      const type = cur.fromEdge === "finish" ? (toEdge === "start" ? "FS" : "FF") : toEdge === "start" ? "SS" : "SF";
      if (tr.predList.some((pred) => pred.predId === cur.fromId && pred.type === type)) return;
      void applyCmd(createPlanningCommand({ type: "dependency.upsert", payload: { id: genId("dep"), predecessorTaskId: cur.fromId, successorTaskId: targetId, dependencyType: type, lagMinutes: 0 } }));
    }
  });
  const link = linkDrag.state;

  // Фокус на позиционированную инлайн-строку (из ПКМ): autoFocus перехватывает Radix
  // ContextMenu (возврат фокуса на строку при закрытии), поэтому фокусируем с задержкой.
  useEffect(() => {
    if (!inlineNew) return;
    const t = window.setTimeout(() => inlineRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inlineNew?.afterId, inlineNew?.parentId]);

  function beginOperation(): boolean {
    if (operationRef.current) {
      toast.error("Дождитесь завершения текущей операции");
      return false;
    }
    operationRef.current = true;
    setBusy(true);
    return true;
  }
  function endOperation() {
    operationRef.current = false;
    setBusy(false);
  }

  function consumeNavigationSentinel(afterConsume?: () => void) {
    const state = window.history.state;
    if (!state || typeof state !== "object" || state[SCHEDULE_NAVIGATION_GUARD_STATE_KEY] !== `schedule:${projectId}`) {
      afterConsume?.();
      return;
    }
    navigationGuardRestoringRef.current = true;
    window.addEventListener("popstate", () => {
      navigationGuardRestoringRef.current = false;
      afterConsume?.();
    }, { once: true });
    window.history.back();
  }

  async function applyStaged() {
    if (!canManagePlan || staged.length === 0 || !beginOperation()) return;
    const commands = staged;
    const beforeApply = batchBaseRef.current;
    let result: ApplyResult;
    try { result = await applyBatch(commands); } finally { endOperation(); }

    if (!result.ok && result.message === "preview_cancelled") return;

    consumeNavigationSentinel();
    setStaged([]);
    batchBaseRef.current = null;
    if (result.ok) {
      lastCommitRef.current = beforeApply ? { commands, before: beforeApply, afterVersion: result.planVersion } : null;
      setCanUndo(beforeApply != null && buildCompensatingCommandBatch(commands, beforeApply).length > 0);
      setErrors(new Map());
      setFlash(new Set(result.changed));
      toast.success(`Пакет применён: коммит v${result.planVersion} · затронуто задач: ${result.changed.length}`);
      window.setTimeout(() => setFlash(new Set()), 1700);
      return;
    }

    const nextErrors = new Map<string, string[]>();
    (result.issues ?? []).forEach((issue) => {
      const key = issue.entityId ?? "__plan__";
      nextErrors.set(key, [...(nextErrors.get(key) ?? []), issue.message]);
    });
    setErrors(nextErrors);
    toast.error(result.conflict
      ? "Конфликт версий плана — пакет сброшен, данные перезагружены"
      : `Пакет отклонён и сброшен: ${result.issues?.[0]?.message ?? result.message}`);
    await reload();
  }

  function resetStagedReadModel() {
    const base = batchBaseRef.current;
    batchBaseRef.current = null;
    setStaged([]);
    setErrors(new Map());
    if (base) setReadModel(base);
  }
  function discardStaged() {
    consumeNavigationSentinel();
    resetStagedReadModel();
    toast.success("Пакет сброшен");
    void reload();
  }
  function toggleBatchMode() {
    if (batchMode && staged.length > 0) {
      toast.error("Сначала примените или сбросьте накопленный пакет");
      return;
    }
    setBatchMode((current) => !current);
  }
  useEffect(() => {
    if (staged.length === 0) return;

    const guardId = `schedule:${projectId}`;
    const currentState = window.history.state;
    if (!currentState || typeof currentState !== "object" || currentState[SCHEDULE_NAVIGATION_GUARD_STATE_KEY] !== guardId) {
      const nextState = currentState && typeof currentState === "object"
        ? { ...currentState, [SCHEDULE_NAVIGATION_GUARD_STATE_KEY]: guardId }
        : { [SCHEDULE_NAVIGATION_GUARD_STATE_KEY]: guardId };
      window.history.pushState(nextState, "", window.location.href);
    }

    const confirmDiscard = () => {
      if (!window.confirm("Есть неприменённые изменения графика. Покинуть страницу и сбросить пакет?")) return false;
      resetStagedReadModel();
      return true;
    };
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardAnchorNavigation = (event: globalThis.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || (anchor.target && anchor.target !== "_self")) return;
      if (navigationGuardBypassAnchorRef.current === anchor) {
        navigationGuardBypassAnchorRef.current = null;
        return;
      }
      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin || nextUrl.href === window.location.href) return;
      if (!confirmDiscard()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      navigationGuardBypassAnchorRef.current = anchor;
      consumeNavigationSentinel(() => anchor.click());
    };
    const guardHistoryTraversal = () => {
      if (navigationGuardRestoringRef.current) {
        navigationGuardRestoringRef.current = false;
        return;
      }
      if (!confirmDiscard()) {
        navigationGuardRestoringRef.current = true;
        window.history.go(1);
        return;
      }
      navigationGuardRestoringRef.current = true;
      window.setTimeout(() => window.history.back(), 0);
    };

    document.addEventListener("click", guardAnchorNavigation, true);
    window.addEventListener("beforeunload", preventUnload);
    window.addEventListener("popstate", guardHistoryTraversal);
    return () => {
      document.removeEventListener("click", guardAnchorNavigation, true);
      window.removeEventListener("beforeunload", preventUnload);
      window.removeEventListener("popstate", guardHistoryTraversal);
    };
  }, [projectId, staged.length]);
  const containsResourceMutation = (commands: PlanningCommand[]) => commands.some((command) =>
    command.type === "assignment.upsert"
    || command.type === "assignment.delete"
    || command.type === "assignment.allocations.replace"
    || command.type === "resource.reserve"
  );

  async function undo() {
    if (!canManagePlan) return;
    const lastCommit = lastCommitRef.current;
    if (!lastCommit || !canUndo) { toast.error("Нет применённого действия для отката"); return; }
    if (readModel?.planVersion !== lastCommit.afterVersion) {
      lastCommitRef.current = null;
      setCanUndo(false);
      toast.error("План уже изменён. Откат отменён, данные перезагружены");
      await reload();
      return;
    }
    const inverses = buildCompensatingCommandBatch(lastCommit.commands, lastCommit.before);
    if (inverses.length === 0) { toast.error("Откат недоступен для этой операции (создание/перенос/назначение)"); return; }
    if (containsResourceMutation(inverses) && !canManageResources) {
      toast.error("Для отката назначения нужно право управления ресурсами");
      return;
    }
    if (!beginOperation()) return;
    let result: ApplyResult;
    try { result = await applyBatch(inverses); } finally { endOperation(); }

    if (!result.ok && result.message === "preview_cancelled") return;

    if (result.ok) {
      lastCommitRef.current = null;
      setCanUndo(false);
      setErrors(new Map());
      setFlash(new Set(result.changed));
      toast.success(`Откат применён — компенсирующий коммит v${result.planVersion}`);
      window.setTimeout(() => setFlash(new Set()), 1700);
      return;
    }

    if (result.conflict) {
      lastCommitRef.current = null;
      setCanUndo(false);
      await reload();
    }
    toast.error(result.conflict
      ? "Конфликт версий — откат недоступен, данные перезагружены"
      : `Откат отклонён: ${result.issues?.[0]?.message ?? result.message}`);
  }

  async function mutateCommands(commands: PlanningCommand[], options?: { idempotencyKey?: string }): Promise<ApplyResult | null> {
    if (!canManagePlan || commands.length === 0) return null;
    if (containsResourceMutation(commands) && !canManageResources) {
      toast.error("Для изменения назначения нужно право управления ресурсами");
      return null;
    }

    if (batchMode) {
      if (!batchBaseRef.current) batchBaseRef.current = readModel;
      setStaged((current) => [...current, ...commands]);
      if (readModel) {
        const optimistic = commands.reduce(optimisticPatch, readModel);
        if (optimistic !== readModel) setReadModel(optimistic);
      }
      return null;
    }

    if (!beginOperation()) return null;
    const before = readModel;
    if (before) {
      const optimistic = commands.reduce(optimisticPatch, before);
      if (optimistic !== before) setReadModel(optimistic);
    }

    let result: ApplyResult;
    try {
      result = commands.length === 1 && !options?.idempotencyKey
        ? await apply(commands[0]!)
        : await applyBatch(commands, options);
    } finally {
      endOperation();
    }

    if (result.ok) {
      lastCommitRef.current = before ? { commands, before, afterVersion: result.planVersion } : null;
      setCanUndo(before != null && buildCompensatingCommandBatch(commands, before).length > 0);
      setErrors(new Map());
      setFlash(new Set(result.changed));
      toast.success(`Коммит v${result.planVersion} применён · затронуто задач: ${result.changed.length}`);
      window.setTimeout(() => setFlash(new Set()), 1700);
    } else if (result.conflict) {
      toast.error("Конфликт версий плана — перезагружено");
    } else {
      if (before) setReadModel(before);
      if (result.message !== "preview_cancelled") {
        const nextErrors = new Map<string, string[]>();
        (result.issues ?? []).forEach((issue) => {
          const key = issue.entityId ?? "__plan__";
          nextErrors.set(key, [...(nextErrors.get(key) ?? []), issue.message]);
        });
        setErrors(nextErrors);
        toast.error(`Отклонено: ${result.issues?.[0]?.message ?? result.message}`);
      }
    }
    return result;
  }

  function applyCmd(command: PlanningCommand): Promise<ApplyResult | null> {
    return mutateCommands([command]);
  }

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error);
  // готовый контент — только при наличии mapped+readModel. Frame-обёртку сохраняем.
  // ВНИМАНИЕ: инлайн валидационный блок ошибок задач (errors map) — это НЕ состояние
  // загрузки поверхности, его НЕ трогаем.
  if (status !== "ready" || !mapped || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={{ ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code }} projectId={projectId} activeTab="График">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка плана…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const scheduleReadModel = readModel;
  const projectMeta = deriveProjectMeta(readModel, projectBase);
  const { rows, deadlineDay, projectFinishDay } = mapped;
  const timeline = deriveScheduleTimeline({
    projectStartIso: readModel.project.plannedStart,
    projectFinishDay,
    rowStartDays: rows.map((r) => r.dayStart),
    rowFinishDays: rows.map((r) => r.dayStart + r.dayDur),
    deadlineDay,
    todayIso: currentPlanDate()
  });
  const totalDays = timeline.totalDays;
  const weeks = totalDays / 7;
  const timelineW = totalDays * dayW;
  const weekW = 7 * dayW;
  timelineOriginDayRef.current = timeline.originDay;

  const allRowsById = new Map(rows.map((r) => [r.id, r] as const));
  const isHidden = (row: Row) => {
    let parentId = row.parentId;
    while (parentId) {
      if (collapsed.has(parentId)) return true;
      parentId = allRowsById.get(parentId)?.parentId ?? null;
    }
    return false;
  };
  const visibleRows = rows.filter((r) => !isHidden(r));
  const hasChildren = (row: Row) => row.hasChildren || rows.some((r) => r.parentId === row.id);
  const toggle = (id: string) => setCollapsed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // связи
  const indexById = new Map(visibleRows.map((r, i) => [r.id, i] as const));
  const rowById = new Map(visibleRows.map((r) => [r.id, r] as const));
  const links: Array<{ key: string; points: string; head: string; accent: boolean; depId: string; predId: string; succId: string; type: string; lagDays: number; mx: number; my: number }> = [];
  visibleRows.forEach((succ) => {
    for (const p of succ.predList) {
      const pred = rowById.get(p.predId);
      const si = indexById.get(p.predId);
      const di = indexById.get(succ.id);
      if (!pred || si == null || di == null) continue;
      const sFromRight = p.type === "FS" || p.type === "FF";
      const dToRight = p.type === "FF" || p.type === "SF";
      const sx = toTimelineX(sFromRight ? pred.dayStart + pred.dayDur : pred.dayStart);
      const dx = toTimelineX(dToRight ? succ.dayStart + succ.dayDur : succ.dayStart);
      const sy = si * ROW_H + ROW_H / 2;
      const dy = di * ROW_H + ROW_H / 2;
      const ex = sx + (sFromRight ? 10 : -10);
      const dDir = dToRight ? -1 : 1;
      const points = `${sx},${sy} ${ex},${sy} ${ex},${dy} ${dx},${dy}`;
      const head = dDir > 0 ? `${dx},${dy} ${dx - 5},${dy - 3} ${dx - 5},${dy + 3}` : `${dx},${dy} ${dx + 5},${dy - 3} ${dx + 5},${dy + 3}`;
      // Ключ по depId (уникален на связь): между одной парой задач допустимо несколько связей
      // (напр. FS + SS через drag-to-link), pred->succ давал бы дубль-ключ React и правку не той связи.
      links.push({ key: p.depId, points, head, accent: sel != null && (succ.id === sel || pred.id === sel), depId: p.depId, predId: p.predId, succId: succ.id, type: p.type, lagDays: p.lagDays, mx: ex, my: (sy + dy) / 2 });
    }
  });
  links.sort((a, b) => (a.accent ? 1 : 0) - (b.accent ? 1 : 0));
  const ganttH = visibleRows.length * ROW_H;
  const selected = rows.find((r) => r.id === sel) ?? null;

  const openTaskPeek = (id: string) => {
    setSel(id);
    taskPeekTriggerRefs.current.get(id)?.click();
  };
  const openRow = openTaskPeek;
  const cancelEditableClick = () => {
    if (editableClickTimerRef.current !== null) window.clearTimeout(editableClickTimerRef.current);
    editableClickTimerRef.current = null;
  };
  const selectEditableCell = (event: ReactMouseEvent, row: Row) => {
    stop(event);
    cancelEditableClick();
    if (event.detail > 1) return;
    editableClickTimerRef.current = window.setTimeout(() => {
      openRow(row.id);
      editableClickTimerRef.current = null;
    }, 180);
  };

  // --- команды ---
  // Текущее назначение задачи из read-model (по taskId): нужен его id, чтобы upsert
  // обновлял существующее назначение, а не плодил второе (реальный редьюсер upsert-ит строго по id).
  type AsgRM = { id: string; taskId: string; resourceId: string; role?: PlanAssignmentRole; unitsPermille?: number; workMinutes?: number | null };
  const authoredAsgs = readModel.authored.assignments;
  const currentAsg = (taskId: string): AsgRM | undefined => authoredAsgs.find((x) => x.taskId === taskId);
  const workCmd = (row: Row, durationDays: number, workHours: number): PlanningCommand =>
    buildScheduleWorkCommand(row, durationDays, workHours, resolveTaskWorkModel(readModel.authored.tasks, row.id));
  // Правка труда/длительности должна синхронизировать ТРУД назначения: загрузка ресурса
  // считается из assignment.workMinutes, иначе WBS покажет новые часы, а Ресурсы/Сценарии —
  // старую нагрузку. Шлём task.update_work_model + assignment.upsert (по id текущего назначения).
  const workEdit = (r: Row, durDays: number, workH: number) => {
    const wm = Math.max(0, Math.round(workH * 60));
    const cmds: PlanningCommand[] = [workCmd(r, durDays, workH)];
    const asg = currentAsg(r.id);
    if (asg) cmds.push(createPlanningCommand({ type: "assignment.upsert", payload: { id: asg.id, taskId: r.id, resourceId: asg.resourceId, role: asg.role ?? "executor", unitsPermille: asg.unitsPermille ?? 1000, workMinutes: wm } }));
    void runBatch(cmds);
  };
  const editDuration = (r: Row, days: number) => {
    const durationMinutes = Math.max(0, Math.round(days * r.workingMinutesPerDay));
    workEdit(r, days, scaledWorkMinutes(r, durationMinutes) / 60);
  };
  const editWork = (r: Row, workH: number) => workEdit(r, r.durDays, workH);
  const editName = (r: Row, title: string) => void applyCmd(createPlanningCommand({ type: "task.update_identity", payload: { taskId: r.id, title } }));
  const editPct = (r: Row, pct: number) => void applyCmd(createPlanningCommand({ type: "task.update_progress", payload: { taskId: r.id, percentComplete: Math.max(0, Math.min(100, pct)) } }));
  const editDate = (r: Row, iso: string) =>
    void applyCmd(buildScheduleMoveCommand(readModel, r, iso));
  // Перенос окончания = изменение длительности: помимо update_schedule (авторские даты)
  // шлём update_work_model с новой длительностью + синхроним труд назначения, иначе на живом
  // read-model длина бара (она идёт от durationMinutes движка) осталась бы прежней.
  const editFinish = (r: Row, iso: string) => {
    const startIso = r.startIso || dayToIso(r.dayStart);
    const asg = currentAsg(r.id);
    const commands = buildScheduleRangeCommands({
      source: readModel,
      row: r,
      startIso,
      finishIso: iso,
      workModel: resolveTaskWorkModel(readModel.authored.tasks, r.id),
      ...(asg ? { assignment: asg } : {})
    });
    if (commands) void runBatch(commands);
  };
  // Переназначение ресурса: переиспользуем id текущего назначения (если есть), иначе genId —
  // реальный редьюсер upsert-ит строго по payload.id, новый id добавил бы второе назначение.
  const assignRes = (taskId: string, resourceId: string) => { const asg = currentAsg(taskId); void applyCmd(createPlanningCommand({ type: "assignment.upsert", payload: { id: asg?.id ?? genId("a"), taskId, resourceId, role: asg?.role ?? "executor", unitsPermille: asg?.unitsPermille ?? 1000, workMinutes: null } })); };
  const depAdd = (succId: string, predId: string, type: string, lagDays: number) => {
    const successor = rows.find((row) => row.id === succId);
    if (successor) void applyCmd(buildScheduleDependencyCommand({
      id: genId("dep"),
      predecessorTaskId: predId,
      successor,
      type: type as DependencyType,
      lagDays
    }));
  };
  const depRemove = (depId: string) => void applyCmd(createPlanningCommand({ type: "dependency.delete", payload: { dependencyId: depId } }));
  const depUpsert = (depId: string, predId: string, succId: string, type: string, lagDays: number) => {
    const successor = rows.find((row) => row.id === succId);
    if (successor) void applyCmd(buildScheduleDependencyCommand({
      id: depId,
      predecessorTaskId: predId,
      successor,
      type: type as DependencyType,
      lagDays
    }));
  };
  const makeMilestone = (r: Row) => {
    const assignments = authoredAsgs
      .filter((assignment) => assignment.taskId === r.id)
      .map((assignment) => ({ id: assignment.id }));
    void runBatch(buildMilestoneCommands({ taskId: r.id, assignments }));
  };

  const deleteTask = (r: Row) => {
    // Удаление summary: реальный редьюсер сносит только саму задачу и оставляет детей сиротами.
    // Шлём явный пакет удаления всего поддерева (summary + потомки по wbs), а не один delete.
    if (r.kind === "summary") {
      const subtree = rows.filter((x) => {
        if (x.id === r.id) return true;
        let parentId = x.parentId;
        while (parentId) {
          if (parentId === r.id) return true;
          parentId = allRowsById.get(parentId)?.parentId ?? null;
        }
        return false;
      });
      // снизу вверх (сначала листья), чтобы не удалять родителя раньше детей
      const ordered = subtree.slice().sort((a, b) => b.level - a.level);
      void runBatch(ordered.map((x) => createPlanningCommand({ type: "task.delete_or_archive", payload: { taskId: x.id, mode: "delete" } })));
      return;
    }
    void applyCmd(createPlanningCommand({ type: "task.delete_or_archive", payload: { taskId: r.id, mode: "delete" } }));
  };
  // sortOrder = целевой индекс среди детей нового родителя (реальный редьюсер вставляет по нему;
  // 0 всегда ставил бы строку перед всеми сиблингами). Мок sortOrder игнорирует — паритет сохраняется.
  const moveCmd = (taskId: string, parentTaskId: string | null, sortOrder: number): PlanningCommand => createPlanningCommand({ type: "task.move_wbs", payload: { taskId, parentTaskId, sortOrder } });
  const childrenOf = (parentId: string | null) => rows.filter((x) => x.parentId === parentId);
  const prevSibling = (r: Row): Row | null => { const sibs = childrenOf(r.parentId); const i = sibs.findIndex((x) => x.id === r.id); return i > 0 ? sibs[i - 1]! : null; };
  const canIndent = (r: Row) => prevSibling(r) !== null;
  const canOutdent = (r: Row) => r.parentId !== null;
  // indent: новый родитель — предыдущий сиблинг; индекс = в конец его текущих детей.
  const indent = (r: Row) => { const ps = prevSibling(r); if (ps) void applyCmd(moveCmd(r.id, ps.id, childrenOf(ps.id).length)); };
  // outdent: новый родитель — родитель текущего родителя; индекс = позиция бывшего родителя
  // среди своих сиблингов + 1 (встаёт сразу после него, а не перед всеми).
  const outdent = (r: Row) => {
    if (!r.parentId) return;
    const parent = rows.find((x) => x.id === r.parentId);
    const grandId = parent ? parent.parentId : null;
    const grandKids = childrenOf(grandId);
    const at = parent ? grandKids.findIndex((x) => x.id === parent.id) + 1 : grandKids.length;
    void applyCmd(moveCmd(r.id, grandId, Math.max(0, at)));
  };

  function runBatch(commands: PlanningCommand[], idempotencyKey?: string): Promise<ApplyResult | null> {
    return mutateCommands(commands, idempotencyKey ? { idempotencyKey } : undefined);
  }

  const projectWorkingTime = resolveScheduleWorkingTime(scheduleReadModel, null);
  const defaultDurationDays = 5;
  const defaultWorkHours = defaultDurationDays *
    projectWorkingTime.workingMinutesPerDay / 60;
  const openCreate = (parentId: string | null) => setTaskModal({
    mode: "create",
    parentId,
    initial: {
      title: "",
      assigneeId: "",
      startIso: "",
      durDays: defaultDurationDays,
      workH: defaultWorkHours,
      pct: 0
    }
  });
  const openEdit = (r: Row) => {
    if (r.kind === "summary") { openRow(r.id); return; }
    const asg = currentAsg(r.id);
    setTaskModal({ mode: "edit", parentId: r.parentId, taskId: r.id, ...(asg ? { asgId: asg.id } : {}), initial: { title: r.name, assigneeId: asg?.resourceId ?? "", startIso: r.startIso, durDays: r.durDays, workH: r.workH, pct: r.pct } });
  };
  async function submitTaskModal(values: TaskModalValues): Promise<TaskModalSubmitResult> {
    const modal = taskModal;
    if (!modal) return { accepted: false };
    const changesAssignedWork = modal.mode === "edit"
      && modal.asgId
      && !canManageResources
      && (values.durDays !== modal.initial.durDays || values.workH !== modal.initial.workH);
    if (changesAssignedWork) {
      toast.error("Труд назначенной задачи меняет загрузку ресурса. Нужно право управления ресурсами");
      return { accepted: false };
    }

    const commands: PlanningCommand[] = [];
    const editedRow = modal.taskId
      ? rows.find((row) => row.id === modal.taskId)
      : undefined;
    const timing = resolveScheduleTiming(
      scheduleReadModel,
      editedRow?.effectiveCalendarId,
      values.startIso || null,
      values.durDays
    );
    if (modal.mode === "create") {
      const taskId = genId("t");
      commands.push(createPlanningCommand({ type: "task.create", payload: { id: taskId, projectId, parentTaskId: modal.parentId, title: values.title, statusId: "todo", plannedStart: values.startIso || null, plannedFinish: timing.finishIso, durationMinutes: timing.durationMinutes, workMinutes: Math.round(values.workH * 60), assignments: [] } }));
      if (canManageResources && values.assigneeId) commands.push(createPlanningCommand({ type: "assignment.upsert", payload: { id: genId("a"), taskId, resourceId: values.assigneeId, role: "executor", unitsPermille: 1000, workMinutes: values.workH * 60 } }));
      if (values.pct > 0) commands.push(createPlanningCommand({ type: "task.update_progress", payload: { taskId, percentComplete: values.pct } }));
    } else if (modal.taskId) {
      const taskId = modal.taskId;
      commands.push(createPlanningCommand({ type: "task.update_identity", payload: { taskId, title: values.title } }));
      const workModel = resolveTaskWorkModel(readModel?.authored.tasks ?? [], taskId);
      commands.push(createPlanningCommand({ type: "task.update_work_model", payload: { taskId, taskType: workModel.taskType, effortDriven: workModel.effortDriven, durationMinutes: timing.durationMinutes, workMinutes: Math.round(values.workH * 60) } }));
      if (values.startIso) commands.push(createPlanningCommand({ type: "task.update_schedule", payload: { taskId, plannedStart: values.startIso, plannedFinish: timing.finishIso } }));
      commands.push(createPlanningCommand({ type: "task.update_progress", payload: { taskId, percentComplete: values.pct } }));
      if (canManageResources && values.assigneeId) {
        commands.push(createPlanningCommand({ type: "assignment.upsert", payload: { id: modal.asgId ?? genId("a"), taskId, resourceId: values.assigneeId, role: "executor", unitsPermille: 1000, workMinutes: values.workH * 60 } }));
      } else if (canManageResources && modal.asgId) {
        commands.push(createPlanningCommand({ type: "assignment.delete", payload: { assignmentId: modal.asgId } }));
      }
    }
    const result = await runBatch(commands);
    return { accepted: batchMode || result?.ok === true };
  }
  // Инлайн-создание задачи (Excel-подобный быстрый ввод): из нижней строки WBS,
  // из ПКМ-меню (задача рядом / подзадача), либо по Tab (подзадача предыдущей).
  // Только название; даты/ресурс/связи/длительность правятся в ячейках после создания.
  // Дефолты как в openCreate (5 дн / 40 ч, авто-планирование). Идёт через applyCmd →
  // task.create-команда (оптимистично + откат при reject), контракт уже боевой.
  // Возвращает true, если задача отправлена на создание (для очистки/закрытия строки).
  function createInline(title: string, parentId: string | null = null, scope: "bottom" | "inline" = "bottom"): boolean {
    if (operationRef.current) return false;
    const t = title.trim();
    if (t.length < 3) { setCreateError({ scope, msg: "Название задачи: минимум 3 символа" }); return false; } // домен: title 3–160
    setCreateError(null);
    const timing = resolveScheduleTiming(
      scheduleReadModel,
      null,
      null,
      defaultDurationDays
    );
    void applyCmd(createPlanningCommand({
      type: "task.create",
      payload: {
        id: genId("t"),
        projectId,
        parentTaskId: parentId,
        title: t,
        statusId: "todo",
        plannedStart: null,
        plannedFinish: null,
        durationMinutes: timing.durationMinutes,
        workMinutes: timing.durationMinutes,
        assignments: []
      }
    }));
    return true;
  }

  // Уровень вложенности создаваемой задачи (для отступа инлайн-строки): parent.level + 1.
  const levelOf = (parentId: string | null) => { if (!parentId) return 0; const pr = rows.find((x) => x.id === parentId); return pr ? pr.level + 1 : 0; };

  // Общая инлайн-ячейка ввода имени новой задачи (нижняя строка + позиционированная из ПКМ).
  // Enter — создать; Tab — создать подзадачей (на уровень глубже); Esc — отмена.
  const newTaskCell = (o: { value: string; onChange: (v: string) => void; onEnter: () => void; onTab: () => void; onEsc: () => void; level: number; autoFocus?: boolean; inputRef?: RefObject<HTMLInputElement | null>; placeholder: string; error?: string | null }) => (
    <span className="name-cell" style={{ paddingLeft: o.level * 14 }}>
      <span className="w-3.5 shrink-0" />
      <input
        {...(o.autoFocus ? { autoFocus: true } : {})}
        {...(o.inputRef ? { ref: o.inputRef } : {})}
        value={o.value}
        onClick={stop}
        aria-invalid={o.error ? true : undefined}
        onChange={(e) => o.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); o.onEnter(); }
          else if (e.key === "Tab") { e.preventDefault(); o.onTab(); }
          else if (e.key === "Escape") o.onEsc();
        }}
        placeholder={o.placeholder}
        aria-label="Создать задачу (Enter; Tab — подзадачей)"
        className="w-full rounded-[var(--radius-xs)] border border-transparent bg-transparent px-1 text-[length:var(--text-sm)] text-[var(--text)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--accent)]"
      />
      {o.error ? <span role="alert" className="shrink-0 px-1 text-[length:var(--text-2xs)] text-[var(--danger-text)]">{o.error}</span> : null}
    </span>
  );

  function commitInline(r: Row) {
    const f = edit?.field;
    setEdit(null);
    if (!f) return;
    if (r.kind !== "task" && f !== "name") return;
    const n = Number(draft);
    if (f === "name") { if (draft.trim() && draft !== r.name) editName(r, draft.trim()); return; }
    if (Number.isNaN(n)) return;
    if (f === "dur") { if (n > 0 && n !== r.durDays) editDuration(r, n); else if (n <= 0) setErrors((prev) => new Map(prev).set(r.id, ["Длительность задачи должна быть больше 0 (для вехи — пункт меню «Сделать вехой»)"])); }
    else if (f === "work" && n >= 0 && n !== r.workH) editWork(r, n);
    else if (f === "pct" && n !== r.pct) editPct(r, n);
  }
  const beginEdit = (r: Row, field: EditField, cur: string | number) => { setEdit({ id: r.id, field }); setDraft(String(cur)); };

  // Excel-навигация по редактируемым ячейкам существующих строк.
  // Поля строки: name всегда; dur/work/pct — только у task (summary/milestone их пропускают).
  const editableFields = (r: Row): EditField[] => (r.kind === "task" ? ["name", "dur", "work", "pct"] : ["name"]);
  const cellValue = (r: Row, f: EditField): string | number => (f === "name" ? r.name : f === "dur" ? r.durDays : f === "work" ? r.workH : r.pct);
  // Tab/Shift+Tab: коммит текущей ячейки + переход к следующей/предыдущей редактируемой
  // (с переносом на соседнюю строку; нередактируемые ячейки пропускаются).
  function moveEdit(r: Row, field: EditField, dir: 1 | -1) {
    skipBlurRef.current = true; // moveEdit сам коммитит — гасим повторный onBlur старого инпута
    commitInline(r);
    const rowIdx = visibleRows.findIndex((x) => x.id === r.id);
    if (rowIdx < 0) return;
    const fields = editableFields(r);
    const ni = fields.indexOf(field) + dir;
    if (ni >= 0 && ni < fields.length) { const nf = fields[ni]!; beginEdit(r, nf, cellValue(r, nf)); return; }
    for (let ri = rowIdx + dir; ri >= 0 && ri < visibleRows.length; ri += dir) {
      const nr = visibleRows[ri]!;
      const nf = editableFields(nr);
      if (nf.length) { const f2 = dir > 0 ? nf[0]! : nf[nf.length - 1]!; beginEdit(nr, f2, cellValue(nr, f2)); return; }
    }
  }
  // Общий обработчик клавиш ячейки: Enter — коммит; Esc — отмена; Tab/Shift+Tab — навигация.
  const cellKeyDown = (e: ReactKeyboardEvent, r: Row, field: EditField) => {
    if (e.key === "Enter") { e.preventDefault(); commitInline(r); }
    else if (e.key === "Escape") { e.preventDefault(); setEdit(null); }
    else if (e.key === "Tab") { e.preventDefault(); moveEdit(r, field, e.shiftKey ? -1 : 1); }
  };
  // Коммит по потере фокуса (клик мимо), но НЕ при Tab-навигации (там коммит уже сделан).
  const cellBlur = (r: Row) => { if (skipBlurRef.current) { skipBlurRef.current = false; return; } commitInline(r); };

  const fillTaskRows = visibleRows.filter((row) => row.kind === "task");
  const selectedFillRows = fillTaskRows.filter((row) => selectedTaskIds.has(row.id));
  const fillPreview = fillDate
      ? buildFinishDateFillCommands({
        firstFinishIso: fillDate,
        mode: fillMode,
        rows: selectedFillRows.map((row) => ({
          id: row.id,
          startIso: row.startIso,
          durationDays: row.durDays,
          ...(row.durationMinutes != null
            ? { durationMinutes: row.durationMinutes }
            : {}),
          workHours: row.workH,
          calendarId: row.effectiveCalendarId
        })),
        assignments: authoredAsgs,
        calendarSource: scheduleReadModel
      })
    : null;

  const isEditableTarget = (target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    return Boolean(element?.closest("input, textarea, select, button, a, [contenteditable='true'], [role='button'], [role='dialog'], [role='menu'], [role='listbox']"));
  };
  const focusScheduleRow = (id: string) => {
    setSel(id);
    window.requestAnimationFrame(() => rowElementsRef.get(id)?.focus());
  };
  const toggleTaskSelection = (id: string) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllTaskSelection = () => {
    setSelectedTaskIds((current) => current.size === fillTaskRows.length
      ? new Set()
      : new Set(fillTaskRows.map((row) => row.id)));
  };  const startFinishFillDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    source: Row
  ) => {
    if (!canManagePlan || source.kind !== "task" || !source.finishIso) return;
    event.preventDefault();
    event.stopPropagation();
    const gesturePointerId = event.pointerId; // жест привязан к указателю (мультитач игнорируется)
    const rowIds = fillTaskRows.map((row) => row.id);
    fillDragTargetRef.current = source.id;

    const updateTarget = (clientX: number, clientY: number) => {
      const targetId = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-schedule-row-id]")
        ?.dataset.scheduleRowId;
      if (!targetId) return;
      fillDragTargetRef.current = targetId;
      const resolved = resolveFinishFillDrag({
        rowIds,
        sourceId: source.id,
        targetId,
        sourceFinishIso: source.finishIso
      });
      setFillDragRange(new Set(resolved?.targetIds ?? []));
    };
    const moveDrag = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== gesturePointerId) return;
      updateTarget(pointerEvent.clientX, pointerEvent.clientY);
    };
    const teardown = () => {
      window.removeEventListener("pointermove", moveDrag);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("keydown", escapeDrag, true);
    };
    const cancelDrag = (pointerEvent?: PointerEvent) => {
      if (pointerEvent && pointerEvent.pointerId !== gesturePointerId) return;
      teardown();
      setFillDragRange(new Set());
      fillDragTargetRef.current = null;
    };
    // Escape отменяет жест, не закрывая попутно диалоги/меню.
    const escapeDrag = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      cancelDrag();
    };
    const stopDrag = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== gesturePointerId) return;
      teardown();
      updateTarget(pointerEvent.clientX, pointerEvent.clientY);
      const targetId = fillDragTargetRef.current;
      const resolved = targetId
        ? resolveFinishFillDrag({
            rowIds,
            sourceId: source.id,
            targetId,
            sourceFinishIso: source.finishIso
          })
        : null;
      setFillDragRange(new Set());
      fillDragTargetRef.current = null;
      if (!resolved) return;
      setSelectedTaskIds(new Set(resolved.targetIds));
      setFillMode("series");
      setFillDate(resolved.firstFinishIso);
      setFillOpen(true);
    };

    window.addEventListener("pointermove", moveDrag);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("keydown", escapeDrag, true);
  };

  const updatePasteDraft = (value: string) => {
    setPasteDraft(value);
    const parsed = parseTaskTsv(value, readModel ?? {});
    setPasteIssue(parsed.ok && parsed.fingerprint === lastAppliedPasteRef.current ? "Этот TSV уже применён в текущей сессии" : null);
  };
  const openPastePreview = (value = "") => {
    updatePasteDraft(value);
    setPasteOpen(true);
  };
  const handleWorkspacePaste = (event: ReactClipboardEvent<HTMLElement>) => {
    if (!canManagePlan || isEditableTarget(event.target)) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    event.preventDefault();
    openPastePreview(text);
  };
  const applyPastedTasks = async () => {
    if (!parsedPaste.ok || pasteIssue) return;
    if (parsedPaste.fingerprint === lastAppliedPasteRef.current) {
      setPasteIssue("Этот TSV уже применён в текущей сессии");
      return;
    }
    const commands = buildPasteCommands({
      projectId,
      rows: parsedPaste.rows,
      createId: (index) => createTaskTsvId(projectId, parsedPaste.fingerprint, index)
    });
    const fingerprint = parsedPaste.fingerprint;
    setPasteOpen(false);
    const result = await runBatch(commands, "schedule-tsv-" + fingerprint);
    if (result?.ok) {
      lastAppliedPasteRef.current = fingerprint;
      setPasteDraft("");
      setPasteIssue(null);
      return;
    }
    setPasteOpen(true);
    if (result?.conflict) setPasteIssue("Версия плана изменилась. Данные перезагружены, проверьте импорт ещё раз");
  };
  const applyDateFill = async () => {
    if (!fillPreview?.ok) return;
    setFillOpen(false);
    const result = await runBatch(fillPreview.commands);
    if (result?.ok) {
      setSelectedTaskIds(new Set());
      return;
    }
    setFillOpen(true);
  };
  const handleWorkspaceKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const editableTarget = isEditableTarget(event.target);
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z") {
      if (!canManagePlan || editableTarget) return;
      event.preventDefault();
      const lastCommit = lastCommitRef.current;
      const allowed = shouldRunScheduleUndo({
        canManage: canManagePlan,
        busy: busy || operationRef.current,
        canUndo,
        currentVersion: readModel.planVersion,
        afterVersion: lastCommit?.afterVersion ?? null,
        editableTarget
      });
      if (allowed || (lastCommit && readModel.planVersion !== lastCommit.afterVersion)) void undo();
      else if (busy || operationRef.current) toast.error("Дождитесь завершения текущей операции");
      else toast.error("Нет применённого действия для отката");
      return;
    }
    if (editableTarget) return;
    if (event.key === "Insert" && canManagePlan) {
      event.preventDefault();
      quickCreateRef.current?.focus();
      return;
    }
    const focusedRowId = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-schedule-row-id]")?.dataset.scheduleRowId ?? null : null;
    const currentRowId = focusedRowId ?? sel;
    if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const targetId = getScheduleNavigationTarget(visibleRows.map((row) => row.id), currentRowId, event.key as "ArrowUp" | "ArrowDown" | "Home" | "End");
      if (targetId) focusScheduleRow(targetId);
      return;
    }
    const current = visibleRows.find((row) => row.id === currentRowId);
    if ((event.key === "F2" || event.key === "Enter") && canManagePlan && current) {
      event.preventDefault();
      beginEdit(current, "name", current.name);
    } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && current?.kind === "summary" && hasChildren(current)) {
      event.preventDefault();
      const shouldCollapse = event.key === "ArrowLeft";
      if (collapsed.has(current.id) !== shouldCollapse) toggle(current.id);
    }
  };

  const isDescendantOf = (row: Row, parentId: string) => {
    let current = row.parentId;
    while (current) {
      if (current === parentId) return true;
      current = allRowsById.get(current)?.parentId ?? null;
    }
    return false;
  };
  function depOptions(r: Row) {
    const banned = new Set([r.id, ...r.predList.map((p) => p.predId)]);
    return rows.filter((t) => t.id !== r.id && !isDescendantOf(t, r.id) && !banned.has(t.id) && t.kind !== "summary").map((t) => ({ id: t.id, label: `${t.wbs} ${t.name}` }));
  }
  const predRows = (r: Row) => r.predList.map((p) => ({ depId: p.depId, predId: p.predId, predLabel: rowById.get(p.predId)?.wbs ?? rows.find((x) => x.id === p.predId)?.wbs ?? "?", type: p.type, lagDays: p.lagDays }));

  // --- drag/resize/link --- (begin получает событие: жест привязан к pointerId,
  // активация после порога, Escape/pointercancel — отмена без команд)
  const startDrag = (e: ReactPointerEvent, r: Row, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    if (r.kind !== "task") return;
    barDrag.begin(e, { id: r.id, mode, startX: e.clientX, origStart: r.dayStart, origDur: r.dayDur, origWorkH: r.workH, origPct: r.pct, deltaDays: 0, curPct: r.pct });
  };
  const startColResize = (e: ReactPointerEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    colResize.begin(e, { index, startX: e.clientX, origW: colW[index] ?? 80 });
  };
  const startLink = (e: ReactPointerEvent, r: Row, edge: "start" | "finish") => {
    e.stopPropagation();
    e.preventDefault();
    const fromX = toTimelineX(edge === "finish" ? r.dayStart + r.dayDur : r.dayStart);
    const fromY = (indexById.get(r.id) ?? 0) * ROW_H + ROW_H / 2;
    linkDrag.begin(e, { fromId: r.id, fromEdge: edge, fromX, fromY, curX: fromX, curY: fromY });
  };

  return (
    <DeliveryFrame project={projectMeta} projectId={projectId} activeTab="График">
      <div
        data-testid="schedule-productivity-workspace"
        tabIndex={0}
        onKeyDown={handleWorkspaceKeyDown}
        onPaste={handleWorkspacePaste}
        aria-label="График проекта. Insert создаёт задачу, стрелки перемещают по строкам"
        className="outline-none"
      >
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {canManagePlan ? (
          <>
            <Button variant="default" size="sm" onClick={() => openCreate(null)} disabled={busy}><Plus className="size-3.5" aria-hidden />Задача</Button>
            <Button variant="secondary" size="sm" onClick={() => selected && openCreate(selected.id)} disabled={busy || !selected}><Plus className="size-3.5" aria-hidden />Подзадача</Button>
            <span className="mx-1 h-5 w-px bg-[var(--border)]" />
            <Button variant="ghost" size="sm" onClick={() => selected && outdent(selected)} disabled={busy || !selected || (selected ? !canOutdent(selected) : true)} title="На уровень выше"><IndentDecrease className="size-3.5" aria-hidden /></Button>
            <Button variant="ghost" size="sm" onClick={() => selected && indent(selected)} disabled={busy || !selected || (selected ? !canIndent(selected) : true)} title="На уровень глубже"><IndentIncrease className="size-3.5" aria-hidden /></Button>
            <span className="mx-1 h-5 w-px bg-[var(--border)]" />
            <Button variant={batchMode ? "default" : "ghost"} size="sm" onClick={toggleBatchMode} aria-pressed={batchMode} title="Режим пакета: копить правки и применить одним коммитом"><GitBranch className="size-3.5" aria-hidden />Пакет{staged.length ? ` · ${staged.length}` : ""}</Button>
            <Button variant="ghost" size="sm" onClick={() => void undo()} disabled={busy || !canUndo} title="Откатить последний коммит (компенсирующий коммит)"><Undo2 className="size-3.5" aria-hidden />Откат</Button>
            <span className="mx-1 h-5 w-px bg-[var(--border)]" />
            <Button variant="ghost" size="sm" onClick={() => openPastePreview()} disabled={busy} title="Вставить задачи из TSV через предпросмотр"><ClipboardPaste className="size-3.5" aria-hidden />Вставить TSV</Button>
            <Button variant="ghost" size="sm" onClick={() => setFillOpen(true)} disabled={busy || selectedFillRows.length === 0} title="Заполнить даты окончания выбранных задач"><CalendarRange className="size-3.5" aria-hidden />Заполнить даты{selectedFillRows.length ? ` · ${selectedFillRows.length}` : ""}</Button>
          </>
        ) : null}
        <Button asChild variant="ghost" size="sm"><Link href={`/projects/${projectId}/baseline`}>Baseline</Link></Button>
        <ScheduleSavedViews projectId={projectId} canManage={canManagePlan} current={savedViewPayload} onApply={applySavedView} />
        <div className="ml-auto flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-0.5">
          {(["day", "week", "month"] as Zoom[]).map((z) => (
            <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)} className={cn("rounded-[var(--radius-sm)] px-2.5 py-1 text-[length:var(--text-sm)] font-medium transition-colors", zoom === z ? "bg-[var(--panel-strong)] text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text)]")}>
              {z === "day" ? "День" : z === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>
      </div>

      {prototypeNotesEnabled && canManagePlan ? (
        <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          Реальный контракт planning · каждая правка = коммит preview→apply через @kiss-pm/planning-client. Данные in-memory, не сохраняются. Нижняя строка — создать задачу (Enter) · 2× клик — правка ячейки · ПКМ — меню · границы колонок — ширина · бар: тяни тело (сдвиг), края (длительность), точку справа — связь.
        </div>
      ) : null}

      {errors.size > 0 ? (
        <div data-testid="schedule-validation-errors" className="mb-2 flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--danger-text)]">
          {[...errors].flatMap(([tid, messages]) => {
            const er = rows.find((x) => x.id === tid);
            return messages.map((msg, index) => (
              <div key={`${tid}:${index}`} className="flex items-start gap-1.5">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span><span className="font-semibold">{er ? `${er.wbs} ${er.name}` : "План"}</span> — {msg}</span>
              </div>
            ));
          })}
        </div>
      ) : null}

      <div className="relative">
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <div className="inline-flex min-w-full align-top">
            <div className="sticky left-0 z-20 shrink-0 border-r border-[var(--border-strong)] bg-[var(--panel)]">
              <table className="msgrid">
                <colgroup>
                  {colW.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {COLS.map((c, i) => (
                      <th key={c.key} className={cn(c.align, "relative")}>
                        {c.key === "id" && canManagePlan ? (
                          <input type="checkbox" aria-label="Выбрать все задачи для заполнения дат" checked={fillTaskRows.length > 0 && selectedFillRows.length === fillTaskRows.length} onChange={toggleAllTaskSelection} />
                        ) : (
                          c.label
                        )}
                        {i < COLS.length - 1 ? (
                          <span
                            className="absolute -right-[3px] top-0 z-10 h-full w-[6px] touch-none cursor-col-resize hover:bg-[var(--accent)]"
                            onPointerDown={(e) => startColResize(e, i)}
                            title="Перетащите — изменить ширину колонки"
                          />
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLS.length} className="h-[var(--row-h)] px-4 text-center text-[length:var(--text-sm)] text-[var(--muted)]">
                        В плане пока нет задач
                      </td>
                    </tr>
                  ) : null}
                  {visibleRows.map((r, i) => (
                    <Fragment key={r.id}>
                    <ScheduleRowMenu
                      canManagePlan={canManagePlan}
                      isLeaf={r.kind !== "summary"}
                      canIndent={canIndent(r)}
                      canOutdent={canOutdent(r)}
                      canMakeMilestone={r.kind === "task"}
                      onOpen={() => openTaskPeek(r.id)}
                      onEdit={() => openEdit(r)}
                      onAddSub={() => setInlineNew({ parentId: r.id, afterId: r.id, draft: "" })}
                      onAddBelow={() => setInlineNew({ parentId: r.parentId, afterId: r.id, draft: "" })}
                      onIndent={() => indent(r)}
                      onOutdent={() => outdent(r)}
                      onMakeMilestone={() => makeMilestone(r)}
                      onDelete={() => setConfirmDelete(r)}
                    >
                      <tr
                        ref={(node) => { if (node) rowElementsRef.set(r.id, node); else rowElementsRef.delete(r.id); }}
                        data-schedule-row-id={r.id}
                        tabIndex={sel === r.id ? 0 : -1}
                        aria-selected={sel === r.id}
                        onFocus={() => setSel(r.id)}
                        onClick={(event) => { event.currentTarget.focus(); openRow(r.id); }}
                        className={cn(r.kind === "summary" && "is-summary", sel === r.id && "is-selected", flash.has(r.id) && "bg-[var(--success-soft)]", errors.has(r.id) && "bg-[var(--danger-soft)]", fillDragRange.has(r.id) && "bg-[var(--accent-soft)]")}
                      >
                        <td className="num muted text-[length:var(--text-xs)]">
                          <span className="flex items-center justify-center gap-1">
                            {canManagePlan && r.kind === "task" ? <input type="checkbox" aria-label={`Выбрать ${r.name} для заполнения дат`} checked={selectedTaskIds.has(r.id)} onClick={stop} onChange={() => toggleTaskSelection(r.id)} /> : null}
                            <span>{i + 1}</span>
                          </span>
                        </td>
                        <td>{r.kind === "milestone" ? <span className="text-[var(--muted-soft)]">—</span> : <ModeChip mode={r.mode} />}</td>
                        <td className="mono muted text-[length:var(--text-xs)]">{r.wbs}</td>
                        <td title={r.name} onClick={canManagePlan ? (e) => selectEditableCell(e, r) : undefined} onDoubleClick={canManagePlan ? (e) => { stop(e); cancelEditableClick(); beginEdit(r, "name", r.name); } : undefined}>
                          <span className="name-cell" style={{ paddingLeft: r.level * 14 }}>
                            {r.kind === "summary" && hasChildren(r) ? (
                              <button type="button" onClick={(e) => { stop(e); toggle(r.id); }} className="grid size-3.5 shrink-0 place-items-center rounded-[var(--radius-xs)] text-[var(--muted)] transition-colors hover:bg-[var(--panel-strong)] hover:text-[var(--text)]" aria-label={collapsed.has(r.id) ? "Развернуть группу" : "Свернуть группу"}>
                                {collapsed.has(r.id) ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
                              </button>
                            ) : <span className="w-3.5 shrink-0" />}
                            {r.critical ? <span className="size-1.5 shrink-0 rounded-full bg-[var(--critical-stripe)]" title="На критическом пути" /> : null}
                            {r.warning ? <span className="inline-flex shrink-0" title={r.warnMsg ?? "Предупреждение планировщика"}><TriangleAlert className="size-3 text-[var(--warning)]" aria-hidden /></span> : null}
                            {canManagePlan && edit?.id === r.id && edit.field === "name" ? (
                              <input autoFocus value={draft} onClick={stop} onChange={(e) => setDraft(e.target.value)} onBlur={() => cellBlur(r)} onKeyDown={(e) => cellKeyDown(e, r, "name")} className="w-full rounded-[var(--radius-xs)] border border-[var(--accent)] bg-[var(--panel)] px-1 text-[length:var(--text-sm)] outline-none" />
                            ) : (
                              <>
                                <span className={cn("min-w-0 flex-1 truncate", r.kind === "summary" ? "font-bold text-[var(--text-strong)]" : "font-medium text-[var(--text)]")}>{r.name}</span>
                                <TaskPeek task={taskPeekRecordFromScheduleRow(r, projectId, projectMeta.name)}>
                                  <button
                                    ref={(node) => {
                                      if (node) taskPeekTriggerRefs.current.set(r.id, node);
                                      else taskPeekTriggerRefs.current.delete(r.id);
                                    }}
                                    type="button"
                                    onClick={(e) => { stop(e); setSel(r.id); }}
                                    className="grid size-4 shrink-0 place-items-center rounded-[var(--radius-xs)] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
                                    aria-label={`Открыть задачу «${r.name}»`}
                                    title="Открыть задачу"
                                  >
                                    <ChevronRight className="size-3.5" aria-hidden />
                                  </button>
                                </TaskPeek>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="num muted" onClick={canManagePlan ? (e) => selectEditableCell(e, r) : undefined} onDoubleClick={canManagePlan ? (e) => { if (r.kind === "task") { stop(e); cancelEditableClick(); beginEdit(r, "dur", r.durDays); } } : undefined}>
                          {canManagePlan && edit?.id === r.id && edit.field === "dur" ? <input autoFocus type="number" value={draft} onClick={stop} onChange={(e) => setDraft(e.target.value)} onBlur={() => cellBlur(r)} onKeyDown={(e) => cellKeyDown(e, r, "dur")} className={numInput} /> : r.kind === "milestone" ? "0 дн" : `${r.durDays} дн`}
                        </td>
                        <td className="num muted" onClick={canManagePlan ? (e) => selectEditableCell(e, r) : undefined} onDoubleClick={canManagePlan ? (e) => { if (r.kind === "task") { stop(e); cancelEditableClick(); beginEdit(r, "work", r.workH); } } : undefined}>
                          {canManagePlan && edit?.id === r.id && edit.field === "work" ? <input autoFocus type="number" value={draft} onClick={stop} onChange={(e) => setDraft(e.target.value)} onBlur={() => cellBlur(r)} onKeyDown={(e) => cellKeyDown(e, r, "work")} className={numInput} /> : r.kind === "milestone" ? "—" : `${r.workH} ч`}
                        </td>
                        <td className="num" onClick={canManagePlan ? (e) => selectEditableCell(e, r) : undefined} onDoubleClick={canManagePlan ? (e) => { if (r.kind === "task") { stop(e); cancelEditableClick(); beginEdit(r, "pct", r.pct); } } : undefined}>
                          {canManagePlan && edit?.id === r.id && edit.field === "pct" ? <input autoFocus type="number" value={draft} onClick={stop} onChange={(e) => setDraft(e.target.value)} onBlur={() => cellBlur(r)} onKeyDown={(e) => cellKeyDown(e, r, "pct")} className={numInput} /> : `${r.pct}%`}
                        </td>
                        <td className="mono muted">
                          {canManagePlan && (r.kind === "milestone" || r.kind === "task") ? <DateEditor valueIso={r.startIso} onPick={(iso) => editDate(r, iso)}><button type="button" onClick={stop} className={cellBtn}>{fmtDate(r.startIso)}</button></DateEditor> : fmtDate(r.startIso)}
                        </td>
                        <td className="mono muted">
                          <span className="flex items-center gap-0.5">
                            {canManagePlan && r.kind === "task" ? (
                              <>
                                <DateEditor title="Окончание задачи" valueIso={r.finishIso} onPick={(iso) => editFinish(r, iso)}>
                                  <button type="button" onClick={stop} className={cellBtn}>{fmtDate(r.finishIso)}</button>
                                </DateEditor>
                                <button
                                  type="button"
                                  aria-label={"Протянуть дату окончания от " + r.name}
                                  title="Потяните вниз — последовательное заполнение дат"
                                  className="grid size-5 shrink-0 cursor-ns-resize place-items-center rounded-[var(--radius-xs)] text-[var(--muted-soft)] hover:bg-[var(--panel-strong)] hover:text-[var(--accent)]"
                                  onClick={stop}
                                  onPointerDown={(event) => startFinishFillDrag(event, r)}
                                >
                                  <GripVertical className="size-3" aria-hidden />
                                </button>
                              </>
                            ) : fmtDate(r.finishIso)}
                          </span>
                        </td>
                        <td className="text-[var(--muted-strong)]">
                          {canManagePlan && canManageResources && r.kind === "task" ? <ResourceEditor {...resourceOverrideProps} onPick={(rid) => assignRes(r.id, rid)}><button type="button" onClick={stop} className={cellBtn}>{r.res}</button></ResourceEditor> : <span className="text-[var(--muted-soft)]">{r.res}</span>}
                        </td>
                        <td className="mono text-[length:var(--text-xs)] text-[var(--muted)]">
                          {canManagePlan && r.kind !== "summary" ? <DependencyEditor preds={predRows(r)} options={depOptions(r)} onAdd={(p, t, l) => depAdd(r.id, p, t, l)} onRemove={depRemove}><button type="button" onClick={stop} className={cellBtn}>{r.predDisplay}</button></DependencyEditor> : r.predDisplay || "—"}
                        </td>
                      </tr>
                    </ScheduleRowMenu>
                    {canManagePlan && inlineNew && inlineNew.afterId === r.id ? (
                      <tr className="msgrid-newrow">
                        <td className="num muted text-[length:var(--text-xs)]" aria-hidden>+</td>
                        <td />
                        <td className="mono muted text-[length:var(--text-xs)]" aria-hidden>·</td>
                        <td colSpan={COLS.length - 3}>
                          {newTaskCell({
                            value: inlineNew.draft,
                            onChange: (v) => { setCreateError(null); setInlineNew((s) => (s ? { ...s, draft: v } : s)); },
                            onEnter: () => { if (createInline(inlineNew.draft, inlineNew.parentId, "inline")) setInlineNew((s) => (s ? { ...s, draft: "" } : s)); },
                            onTab: () => { if (createInline(inlineNew.draft, inlineNew.afterId, "inline")) setInlineNew((s) => (s ? { ...s, draft: "" } : s)); },
                            onEsc: () => { setCreateError(null); setInlineNew(null); },
                            level: levelOf(inlineNew.parentId),
                            autoFocus: true,
                            inputRef: inlineRef,
                            placeholder: inlineNew.parentId === r.id ? "Подзадача — Enter (Esc — отмена)" : "Задача рядом — Enter (Tab — подзадачей)",
                            error: createError?.scope === "inline" ? createError.msg : null
                          })}
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  ))}
                  {/* Excel-подобная строка создания: имя → Enter создаёт задачу и очищает для следующей. */}
                  {canManagePlan ? (
                    <tr className="msgrid-newrow">
                      <td className="num muted text-[length:var(--text-xs)]" aria-hidden>+</td>
                      <td />
                      <td />
                      <td colSpan={COLS.length - 3}>
                        {newTaskCell({
                          value: newTask,
                          inputRef: quickCreateRef,
                          onChange: (v) => { setCreateError(null); setNewTask(v); },
                          onEnter: () => { if (createInline(newTask)) setNewTask(""); },
                          onTab: () => { const last = visibleRows[visibleRows.length - 1]; if (createInline(newTask, last ? last.id : null)) setNewTask(""); },
                          onEsc: () => { setCreateError(null); setNewTask(""); },
                          level: 0,
                          placeholder: "Новая задача — Enter (Tab — подзадачей)",
                          error: createError?.scope === "bottom" ? createError.msg : null
                        })}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Gantt pane */}
            <div ref={ganttRef} className="relative min-w-0 flex-1" style={{ width: timelineW }}>
              <div className="sticky top-0 z-10 flex h-9 border-b border-[var(--border-strong)] bg-[var(--panel-subtle)]">
                {Array.from({ length: weeks }, (_, i) => <span key={i} className="v4-num shrink-0 border-r border-[var(--border-subtle)] px-2 text-[length:var(--text-xs)] leading-9 text-[var(--muted)]" style={{ width: weekW }}>{formatWeekLabel(i, timeline.originDay)}</span>)}
              </div>
              <span className="pointer-events-none absolute bottom-0 top-9 z-[1] w-px bg-[var(--accent)]" style={{ left: timeline.todayOffsetDays * dayW }} title="Сегодня" />
              {deadlineDay !== null && <span className="pointer-events-none absolute bottom-0 top-9 z-[1] w-px border-l border-dashed border-[var(--danger)]" style={{ left: toTimelineX(deadlineDay) }} title="Дедлайн" />}
              {visibleRows.map((r) => {
                const dragging = drag?.id === r.id;
                const dMove = dragging && drag.mode === "move" ? drag.deltaDays : 0;
                const dLeft = dragging && drag.mode === "resizeLeft" ? drag.deltaDays : 0;
                const dRight = dragging && drag.mode === "resize" ? drag.deltaDays : 0;
                const left = toTimelineX(r.dayStart + dMove + dLeft);
                const width = Math.max((r.dayDur + dRight - dLeft) * dayW, 6);
                const barRight = left + width;
                const fillPct = dragging && drag.mode === "progress" ? drag.curPct : r.pct;
                return (
                  <div key={r.id} data-task-id={r.id} onClick={() => setSel(r.id)} className={cn("group relative h-[var(--row-h)] cursor-pointer border-b border-[var(--border-subtle)] last:border-0", errors.has(r.id) ? "bg-[var(--danger-soft)]" : sel === r.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--panel-subtle)]")} style={{ backgroundImage: sel === r.id || errors.has(r.id) ? undefined : `repeating-linear-gradient(to right, transparent, transparent ${weekW - 1}px, var(--border-subtle) ${weekW - 1}px, var(--border-subtle) ${weekW}px)` }}>
                    {r.kind === "milestone" ? (
                      <>
                        {r.baseDay != null ? <span className="gantt-baseline-milestone absolute bottom-1 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] border border-[var(--border-strong)] bg-[var(--panel-strong)]" style={{ left: toTimelineX(r.baseDay) }} title={readModel.baselineComparison?.label ?? "Базовый план"} /> : null}
                        <span className="gantt-milestone absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-[var(--text-strong)]" style={{ left }} title={`Веха · ${fmtDate(r.finishIso)}`} />
                      </>
                    ) : r.kind === "summary" ? (
                      <span className="absolute top-1/2 -translate-y-1/2 rounded-[3px] bg-[var(--text-strong)]" style={{ left, width, height: 8 }} title={`${r.name} · ${r.pct}%`} />
                    ) : (
                      <>
                        {r.baseDay != null && r.baseDur != null ? <span className="absolute rounded-[3px] border border-[var(--border-strong)] bg-[var(--panel-strong)]" style={{ left: toTimelineX(r.baseDay), width: Math.max(r.baseDur * dayW, 6), height: 6, bottom: 5 }} title={readModel.baselineComparison?.label ?? "Базовый план"} /> : null}
                        <span
                          className={cn("gantt-bar absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-[5px] shadow-[var(--shadow-card)]", canManagePlan ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-default", r.critical && "gantt-bar--crit", dragging && "opacity-90 outline-dashed outline-2 outline-offset-1 outline-[var(--accent)]", flash.has(r.id) && "ring-2 ring-[var(--success)]")}
                          style={{ left, width, height: 18 }}
                          title={canManagePlan ? `${r.name} · ${fillPct}% · тело — сдвиг, края — длительность` : `${r.name} · ${fillPct}%`}
                          onPointerDown={canManagePlan ? (e) => startDrag(e, r, "move") : undefined}
                        >
                          <span className={cn("gantt-bar-fill h-full", r.critical && "gantt-bar-fill--crit")} style={{ width: `${fillPct}%` }} />
                          {canManagePlan ? <>
                            <span className="absolute top-0 z-[3] h-full w-1 -translate-x-1/2 touch-none cursor-ew-resize bg-[var(--accent)] opacity-0 group-hover:opacity-100" style={{ left: `clamp(2px, ${fillPct}%, calc(100% - 2px))` }} onPointerDown={(e) => startDrag(e, r, "progress")} title="Тяните — % выполнения" />
                            <span className="absolute left-0 top-0 h-full w-1.5 touch-none cursor-ew-resize bg-black/10 opacity-0 group-hover:opacity-100" onPointerDown={(e) => startDrag(e, r, "resizeLeft")} title="Потяните — сдвинуть начало" />
                            <span className="absolute right-0 top-0 h-full w-1.5 touch-none cursor-ew-resize bg-black/10 opacity-0 group-hover:opacity-100" onPointerDown={(e) => startDrag(e, r, "resize")} title="Потяните — изменить длительность" />
                          </> : null}
                        </span>
                        {canManagePlan ? <>
                          <span className="absolute top-1/2 z-[2] size-2.5 -translate-y-1/2 touch-none cursor-crosshair rounded-full border-2 border-[var(--panel)] bg-[var(--muted-soft)] opacity-0 shadow-[var(--shadow-card)] transition-opacity group-hover:opacity-100" style={{ left: left - 12 }} onPointerDown={(e) => startLink(e, r, "start")} title="Тяните от начала → связь НН/НО" />
                          <span className="absolute top-1/2 z-[2] size-2.5 -translate-y-1/2 touch-none cursor-crosshair rounded-full border-2 border-[var(--panel)] bg-[var(--accent)] opacity-0 shadow-[var(--shadow-card)] transition-opacity group-hover:opacity-100" style={{ left: barRight + 8 }} onPointerDown={(e) => startLink(e, r, "finish")} title="Тяните от конца → связь ОН/ОО" />
                        </> : null}
                      </>
                    )}
                  </div>
                );
              })}
              {links.length > 0 || link ? (
                <svg className="pointer-events-none absolute left-0 z-[3]" style={{ top: HEADER_H, width: timelineW, height: ganttH }} aria-hidden>
                  {links.map((l) => (
                    <g key={l.key}>
                      <polyline points={l.points} fill="none" stroke={l.accent ? "var(--accent)" : "var(--muted-soft)"} strokeWidth={l.accent ? 1.75 : 1.25} strokeLinejoin="round" />
                      <polygon points={l.head} fill={l.accent ? "var(--accent)" : "var(--muted-soft)"} />
                    </g>
                  ))}
                  {link ? (
                    <g>
                      <line x1={link.fromX} y1={link.fromY} x2={link.curX} y2={link.curY} stroke="var(--accent)" strokeWidth={1.75} strokeDasharray="4 3" />
                      <circle cx={link.curX} cy={link.curY} r={3.5} fill="var(--accent)" />
                    </g>
                  ) : null}
                </svg>
              ) : null}
              {/* бейджи лага на связях выбранной задачи — клик редактирует тип/лаг/удаляет */}
              {canManagePlan ? links.filter((l) => l.accent).map((l) => (
                <LinkLagEditor key={`badge-${l.key}`} type={l.type} lagDays={l.lagDays} onSave={(t, lag) => depUpsert(l.depId, l.predId, l.succId, t, lag)} onDelete={() => depRemove(l.depId)}>
                  <button type="button" onClick={stop} className="pointer-events-auto absolute z-[30] inline-flex min-h-5 min-w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--panel)] px-1 text-[length:var(--text-2xs)] font-semibold leading-tight text-[var(--accent)] shadow-[var(--shadow-card)] hover:bg-[var(--accent-soft)]" style={{ left: l.mx, top: HEADER_H + l.my }} title="Изменить связь (тип/лаг)">
                    {DEP_RU[l.type]}{l.lagDays ? `${l.lagDays > 0 ? "+" : ""}${l.lagDays}` : ""}
                  </button>
                </LinkLagEditor>
              )) : null}
            </div>
          </div>
        </div>

      </div>

      {canManagePlan && staged.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2.5 shadow-[var(--shadow-raise)]">
          <span className="inline-flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]"><GitBranch className="size-4 text-[var(--accent)]" aria-hidden />Пакет правок</span>
          <span className="text-[length:var(--text-sm)] text-[var(--muted-strong)]">накоплено: <span className="font-semibold">{staged.length}</span> · применятся одним коммитом</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={discardStaged} disabled={busy}>Сбросить</Button>
            <Button variant="default" size="sm" onClick={() => void applyStaged()} disabled={busy}>Применить пакетом</Button>
          </div>
        </div>
      ) : null}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[length:var(--text-sm)] text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-[3px] bg-[var(--success)]" /> Задача</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-[3px] bg-[var(--critical-stripe)]" /> Критический путь</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-[3px] bg-[var(--text-strong)]" /> Суммарная задача</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rotate-45 rounded-[2px] bg-[var(--text-strong)]" /> Веха</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-[3px] border border-[var(--border-strong)] bg-[var(--panel-strong)]" /> {readModel.baselineComparison?.label ?? "Базовый план"}</span>
        <span className="flex items-center gap-1.5"><svg width="22" height="8" aria-hidden><polyline points="1,4 14,4" fill="none" stroke="var(--muted-soft)" strokeWidth="1.25" /><polygon points="21,4 15,1.5 15,6.5" fill="var(--muted-soft)" /></svg> Связь</span>
        {canManagePlan ? <span className="ml-auto text-[length:var(--text-xs)] text-[var(--muted-soft)]">2× клик — правка · ПКМ — меню · тяни бар — сдвиг/длительность · движок считает даты/критпуть</span> : null}
      </div>

      {canManagePlan && taskModal ? <TaskModal open mode={taskModal.mode} initial={taskModal.initial} {...resourceOverrideProps} canAssign={canManageResources} workingMinutesPerDay={projectWorkingTime.workingMinutesPerDay} onOpenChange={(o) => { if (!o) setTaskModal(null); }} onSubmit={submitTaskModal} /> : null}

      {/* Подтверждение необратимого удаления (G3-06): вызов из ПКМ-меню, поэтому контролируемый диалог, а не asChild-триггер */}
      {canManagePlan && confirmDelete ? (
        <Dialog open onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
          <DialogContent className="max-w-[440px]">
            <DialogHeader>
              <DialogTitle>{`Удалить задачу «${confirmDelete.name}»?`}</DialogTitle>
              <DialogDescription>
                Задача будет безвозвратно удалена из плана.
                {confirmDelete.kind === "summary" ? " Вместе с суммарной задачей будут также удалены все её подзадачи." : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
              <Button variant="destructive" disabled={busy} onClick={() => { const r = confirmDelete; setConfirmDelete(null); deleteTask(r); }}>Удалить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {canManagePlan ? (
        <Dialog open={pasteOpen} onOpenChange={(open) => { setPasteOpen(open); if (!open) setPasteIssue(null); }}>
          <DialogContent className="max-w-[720px]">
            <DialogHeader>
              <DialogTitle>Импорт задач из TSV</DialogTitle>
              <DialogDescription>Колонки: название, начало, окончание, длительность в днях, труд в часах, прогресс. Пустые последние колонки допустимы.</DialogDescription>
            </DialogHeader>
            <label className="grid gap-1 text-[length:var(--text-sm)] text-[var(--muted-strong)]">
              TSV
              <textarea
                autoFocus
                rows={7}
                value={pasteDraft}
                onChange={(event) => updatePasteDraft(event.target.value)}
                aria-invalid={!parsedPaste.ok || pasteIssue ? true : undefined}
                className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 font-mono text-[length:var(--text-xs)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            {pasteIssue ? <p role="alert" className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{pasteIssue}</p> : null}
            {parsedPaste.ok ? (
              <div className="min-h-0">
                <p className="mb-1 text-[length:var(--text-sm)] text-[var(--muted-strong)]">Будет создано задач: <strong>{parsedPaste.rows.length}</strong>. Все команды применятся атомарно.</p>
                <div className="max-h-52 overflow-auto border-y border-[var(--border)]">
                  <table className="w-full text-left text-[length:var(--text-xs)]">
                    <thead className="text-[var(--muted)]"><tr><th className="px-2 py-1">Название</th><th className="px-2 py-1">Начало</th><th className="px-2 py-1">Окончание</th><th className="px-2 py-1 text-right">Дни</th><th className="px-2 py-1 text-right">Часы</th><th className="px-2 py-1 text-right">%</th></tr></thead>
                    <tbody>{parsedPaste.rows.slice(0, 20).map((row, index) => <tr key={`${row.title}-${index}`} className="border-t border-[var(--border-subtle)]"><td className="px-2 py-1">{row.title}</td><td className="px-2 py-1 font-mono">{row.startIso ?? ""}</td><td className="px-2 py-1 font-mono">{row.finishIso ?? ""}</td><td className="px-2 py-1 text-right">{row.durationDays}</td><td className="px-2 py-1 text-right">{row.workHours}</td><td className="px-2 py-1 text-right">{row.percentComplete}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            ) : (
              <ul role="alert" className="max-h-36 overflow-auto text-[length:var(--text-sm)] text-[var(--danger-text)]">
                {parsedPaste.errors.slice(0, 8).map((error, index) => <li key={`${error.row}-${error.column}-${index}`}>Строка {error.row}, {error.message}</li>)}
              </ul>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setPasteOpen(false)}>Отмена</Button>
              <Button variant="default" disabled={busy || !parsedPaste.ok || Boolean(pasteIssue)} onClick={() => void applyPastedTasks()}>Проверить и применить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {canManagePlan ? (
        <Dialog open={fillOpen} onOpenChange={setFillOpen}>
          <DialogContent className="max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Заполнение дат окончания</DialogTitle>
              <DialogDescription>Выбрано задач: {selectedFillRows.length}. Изменения уйдут одним атомарным пакетом.</DialogDescription>
            </DialogHeader>
            <label className="grid gap-1 text-[length:var(--text-sm)] text-[var(--muted-strong)]">
              Первая дата окончания
              <input type="date" value={fillDate} onChange={(event) => setFillDate(event.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[var(--text)] outline-none focus:border-[var(--accent)]" />
            </label>
            <fieldset className="flex gap-3 text-[length:var(--text-sm)] text-[var(--text)]">
              <legend className="sr-only">Режим заполнения</legend>
              <label className="flex items-center gap-1.5"><input type="radio" name="fill-mode" checked={fillMode === "series"} onChange={() => setFillMode("series")} />Последовательно, шаг 1 день</label>
              <label className="flex items-center gap-1.5"><input type="radio" name="fill-mode" checked={fillMode === "same"} onChange={() => setFillMode("same")} />Одинаковая дата</label>
            </fieldset>
            {fillPreview?.ok ? (
              <div className="max-h-56 overflow-auto border-y border-[var(--border)] text-[length:var(--text-sm)]">
                {fillPreview.preview.map((item) => { const row = rows.find((candidate) => candidate.id === item.taskId); return <div key={item.taskId} className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-2 py-1 first:border-0"><span className="min-w-0 flex-1 truncate">{row?.wbs} {row?.name}</span><span className="font-mono text-[var(--muted-strong)]">{item.finishIso}</span><span className="w-14 text-right text-[var(--muted)]">{item.durationDays} дн</span></div>; })}
              </div>
            ) : fillPreview ? (
              <ul role="alert" className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fillPreview.errors.map((error) => { const row = rows.find((candidate) => candidate.id === error.taskId); return <li key={error.taskId}>{row?.name ?? error.taskId}: {error.message}</li>; })}</ul>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFillOpen(false)}>Отмена</Button>
              <Button variant="default" disabled={busy || !fillPreview?.ok} onClick={() => void applyDateFill()}>Проверить и применить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      </div>
    </DeliveryFrame>
  );
}
