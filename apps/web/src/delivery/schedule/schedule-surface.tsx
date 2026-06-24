"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Columns3, Filter, GitBranch, IndentDecrease, IndentIncrease, Layers, Plus, TriangleAlert, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, deriveProjectMeta, planningErr } from "@/delivery/lib/project-chrome";
import { demoAction } from "@/views/lib/demo";
import { dayToIso, isoToDay, MIN_PER_DAY, MOCK_PROJECT_ID, RESOURCES } from "@/delivery/lib/mock-planning-backend";
import { usePlanning } from "@/delivery/lib/use-planning";
import { DateEditor, DependencyEditor, DEP_RU, LinkLagEditor, ResourceEditor, RowMenu, TaskModal, type TaskModalValues } from "@/delivery/schedule/schedule-editors";
import type { PlanningCommand } from "@kiss-pm/domain";
import { buildCompensatingCommands, type PlanningReadModel } from "@kiss-pm/planning-client";

const HPD = 8; // часов в рабочем дне
let SEQ = 0;
const genId = (p: string) => `${p}-new-${++SEQ}`;

type Kind = "summary" | "task" | "milestone";
type Mode = "auto" | "manual";
type Pred = { depId: string; predId: string; type: string; lagDays: number };
type Row = {
  id: string;
  wbs: string;
  name: string;
  level: number;
  kind: Kind;
  mode: Mode;
  parentId: string | null;
  durDays: number;
  pct: number;
  startIso: string;
  finishIso: string;
  predDisplay: string;
  predList: Pred[];
  res: string;
  workH: number;
  slackDays: number | null;
  dayStart: number;
  dayDur: number;
  critical: boolean;
  warning: boolean;
  warnMsg?: string;
  baseDay?: number;
  baseDur?: number;
};

type RMTask = { id: string; parentTaskId: string | null; wbsCode: string; title: string; schedulingMode: Mode; durationMinutes: number | null; workMinutes: number; percentComplete: number; customFields?: { resLabel?: string; kind?: Kind } };
type RMCalc = { id: string; calculatedStart: string; calculatedFinish: string; totalSlackMinutes: number | null; isCritical: boolean };
type RMDep = { id: string; predecessorTaskId: string; successorTaskId: string; type: string; lagMinutes: number };
type RMBaseTask = { taskId: string; baselineStart: string | null; baselineFinish: string | null };

function mapRows(rm: PlanningReadModel): { rows: Row[]; deadlineDay: number; projectFinishDay: number } {
  const authored = rm.authored as unknown as { tasks: RMTask[]; dependencies: RMDep[] };
  const calc = (rm.calculatedPlan as unknown as { tasks: RMCalc[] }).tasks;
  const baseCmp = (rm.baselineComparison as unknown as { tasks: RMBaseTask[] }).tasks ?? [];
  const project = rm.project as unknown as { deadline: string | null; plannedFinish: string };
  const issues = (rm.validationIssues ?? []) as Array<{ severity: string; message?: string; entity: { type: string; id: string } | null }>;

  const calcById = new Map(calc.map((c) => [c.id, c]));
  const wbsById = new Map(authored.tasks.map((t) => [t.id, t.wbsCode]));
  const baseById = new Map(baseCmp.map((b) => [b.taskId, b]));
  const warned = issues.filter((i) => i.severity !== "info" && i.entity);
  const warnSet = new Set(warned.map((i) => i.entity!.id));
  const warnMsgById = new Map(warned.map((i) => [i.entity!.id, i.message ?? ""]));
  const predsBySucc = new Map<string, Pred[]>();
  for (const d of authored.dependencies) {
    const arr = predsBySucc.get(d.successorTaskId) ?? [];
    arr.push({ depId: d.id, predId: d.predecessorTaskId, type: d.type, lagDays: Math.round(d.lagMinutes / MIN_PER_DAY) });
    predsBySucc.set(d.successorTaskId, arr);
  }

  const rows: Row[] = authored.tasks.map((t) => {
    const c = calcById.get(t.id);
    const start = c?.calculatedStart ?? "";
    const finish = c?.calculatedFinish ?? "";
    const dayStart = start ? isoToDay(start) : 0;
    const dayDur = start && finish ? isoToDay(finish) - dayStart : 0;
    const cf = t.customFields ?? {};
    const kind: Kind = cf.kind === "summary" ? "summary" : t.durationMinutes === 0 ? "milestone" : "task";
    const predList = predsBySucc.get(t.id) ?? [];
    const predDisplay = predList.length
      ? predList.map((p) => `${wbsById.get(p.predId) ?? "?"} ${DEP_RU[p.type] ?? p.type}${p.lagDays ? ` +${p.lagDays}д` : ""}`).join(", ")
      : "—";
    const base = baseById.get(t.id);
    const baseDay = base?.baselineStart ? isoToDay(base.baselineStart) : undefined;
    const baseDur = base?.baselineStart && base?.baselineFinish ? isoToDay(base.baselineFinish) - isoToDay(base.baselineStart) : undefined;
    const wm = warnMsgById.get(t.id);
    return {
      id: t.id,
      wbs: t.wbsCode,
      name: t.title,
      level: t.wbsCode.split(".").length - 1,
      kind,
      mode: t.schedulingMode,
      parentId: t.parentTaskId,
      durDays: t.durationMinutes != null ? Math.round(t.durationMinutes / MIN_PER_DAY) : dayDur,
      pct: t.percentComplete,
      startIso: start,
      finishIso: finish,
      predDisplay,
      predList,
      res: cf.resLabel ?? "—",
      workH: Math.round(t.workMinutes / 60),
      slackDays: c?.totalSlackMinutes != null ? Math.round(c.totalSlackMinutes / MIN_PER_DAY) : null,
      dayStart,
      dayDur,
      critical: c?.isCritical ?? false,
      warning: warnSet.has(t.id),
      ...(wm ? { warnMsg: wm } : {}),
      ...(baseDay != null ? { baseDay } : {}),
      ...(baseDur != null ? { baseDur } : {})
    };
  });

  // полный rollup суммарных задач НА ФРОНТЕ: труд = Σ листьев, % — взвешенно по труду,
  // старт/финиш/длительность = span подзадач. По убыванию уровня — вложенные summary сворачиваются раньше.
  const summariesDesc = rows.filter((r) => r.kind === "summary").sort((a, b) => b.level - a.level);
  for (const s of summariesDesc) {
    const directKids = rows.filter((r) => r.level === s.level + 1 && r.wbs.startsWith(s.wbs + "."));
    if (directKids.length === 0) continue;
    const leaves = rows.filter((r) => r.kind !== "summary" && r.wbs.startsWith(s.wbs + "."));
    const work = leaves.reduce((a, k) => a + k.workH, 0);
    const minStart = Math.min(...directKids.map((k) => k.dayStart));
    const maxEnd = Math.max(...directKids.map((k) => k.dayStart + k.dayDur));
    s.workH = work;
    s.dayStart = minStart;
    s.dayDur = maxEnd - minStart;
    s.durDays = maxEnd - minStart;
    s.startIso = dayToIso(minStart);
    s.finishIso = dayToIso(maxEnd);
    s.pct = leaves.length === 0 ? 0 : work > 0 ? Math.round(leaves.reduce((a, k) => a + k.workH * k.pct, 0) / work) : Math.round(leaves.reduce((a, k) => a + k.pct, 0) / leaves.length);
  }

  return {
    rows,
    deadlineDay: project.deadline ? isoToDay(project.deadline) : 0,
    projectFinishDay: project.plannedFinish ? isoToDay(project.plannedFinish) : 0
  };
}

// Оптимистичный патч read-model: применяем правку локально мгновенно (до ответа бэка).
// summary-rollup пересчитает mapRows; полный каскад/критпуть вернёт бэк.
function optimisticPatch(rm: PlanningReadModel, command: PlanningCommand): PlanningReadModel {
  const cmd = command as { type: string; payload: Record<string, unknown> };
  const authored = rm.authored as unknown as { tasks: RMTask[] };
  const calcPlan = rm.calculatedPlan as unknown as { tasks: RMCalc[] };
  const tasks = authored.tasks.map((t) => ({ ...t }));
  const calc = calcPlan.tasks.map((c) => ({ ...c }));
  const id = cmd.payload.taskId as string;
  const T = tasks.find((t) => t.id === id);
  const C = calc.find((c) => c.id === id);
  switch (cmd.type) {
    case "task.update_work_model":
      if (T) { if (cmd.payload.durationMinutes != null) T.durationMinutes = cmd.payload.durationMinutes as number; if (typeof cmd.payload.workMinutes === "number") T.workMinutes = cmd.payload.workMinutes; }
      if (T && C && T.durationMinutes != null) C.calculatedFinish = dayToIso(isoToDay(C.calculatedStart) + T.durationMinutes / MIN_PER_DAY);
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
      if (T && ps && pf) {
        const oldDurDays = T.durationMinutes != null ? T.durationMinutes / MIN_PER_DAY : 0;
        const wpd = oldDurDays > 0 ? T.workMinutes / oldDurDays : MIN_PER_DAY;
        const newDurDays = isoToDay(pf) - isoToDay(ps);
        T.workMinutes = Math.round(newDurDays * wpd);
        T.durationMinutes = newDurDays * MIN_PER_DAY;
      }
      break;
    }
    case "assignment.upsert": {
      const rid = String(cmd.payload.resourceId);
      const name = RESOURCES.find((r) => r.id === rid)?.name ?? rid;
      if (T) T.customFields = { ...(T.customFields ?? {}), resLabel: name };
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
  variance: { label: "+2 дня к baseline B2", tone: "warning" }
};

const ROW_H = 36;
const HEADER_H = 36;
const TODAY_DAY = isoToDay("2026-04-28");
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const BASE_MS = Date.UTC(2026, 2, 2);

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
function unitsPct(durDays: number, workH: number): number {
  return durDays > 0 ? Math.round((workH / (durDays * HPD)) * 100) : 100;
}
function weekLabel(weekIndex: number): string {
  const day = weekIndex * 7;
  const d = new Date(BASE_MS + day * 86_400_000);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS[d.getUTCMonth()] ?? "";
  const prev = new Date(BASE_MS + (day - 7) * 86_400_000);
  const newMonth = weekIndex === 0 || prev.getUTCMonth() !== d.getUTCMonth();
  return newMonth ? `${mon[0]?.toUpperCase()}${mon.slice(1)} ${dd}` : dd;
}

const ZOOM_DAY_W = { day: 36, week: 20, month: 8 } as const;
type Zoom = keyof typeof ZOOM_DAY_W;
type DragMode = "move" | "resize" | "resizeLeft" | "progress";
type DragState = { id: string; mode: DragMode; startX: number; origStart: number; origDur: number; origWorkH: number; origPct: number; deltaDays: number; curPct: number };
type ColDrag = { index: number; startX: number; origW: number };
type LinkDrag = { fromId: string; fromEdge: "start" | "finish"; fromX: number; fromY: number; curX: number; curY: number };

const COLS: Array<{ key: string; label: string; align?: string; w: number }> = [
  { key: "id", label: "#", align: "num", w: 32 },
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
    <span className={cn("inline-flex items-center rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.03em]", mode === "auto" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--warning-soft)] text-[var(--warning-text)]")} title={mode === "auto" ? "Авто — планирует движок" : "Ручной — даты заданы вручную"}>
      {mode === "auto" ? "Авто" : "Ручной"}
    </span>
  );
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const numInput = "w-full rounded-[var(--radius-xs)] border border-[var(--accent)] bg-[var(--panel)] px-1 text-right text-[length:var(--text-sm)] tabular-nums outline-none";
const cellBtn = "block w-full cursor-pointer truncate rounded-[var(--radius-xs)] px-1 text-left hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]";

export function ProjectSchedule() {
  const { readModel, setReadModel, status, error, reload, apply, applyBatch } = usePlanning(MOCK_PROJECT_ID);
  const [zoom, setZoom] = useState<Zoom>("week");
  const [sel, setSel] = useState<string | null>("t-3.2.1");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [edit, setEdit] = useState<{ id: string; field: "name" | "dur" | "work" | "pct" | "units" } | null>(null);
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Map<string, string>>(() => new Map());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [staged, setStaged] = useState<PlanningCommand[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [taskModal, setTaskModal] = useState<{ mode: "create" | "edit"; parentId: string | null; taskId?: string; initial: TaskModalValues } | null>(null);
  const [colW, setColW] = useState<number[]>(() => [...DEFAULT_COLW]);
  const [colDrag, setColDrag] = useState<ColDrag | null>(null);
  const [link, setLink] = useState<LinkDrag | null>(null);

  const mapped = useMemo(() => (readModel ? mapRows(readModel) : null), [readModel]);
  const dayW = ZOOM_DAY_W[zoom];
  const dragRef = useRef<DragState | null>(null);
  const colDragRef = useRef<ColDrag | null>(null);
  const linkRef = useRef<{ fromId: string; fromEdge: "start" | "finish" } | null>(null);
  const lastCommitRef = useRef<{ commands: PlanningCommand[]; before: PlanningReadModel } | null>(null);
  const batchBaseRef = useRef<PlanningReadModel | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  // drag/resize баров: window-слушатели (надёжно, без устаревших замыканий)
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      if (cur.mode === "progress") {
        const rect = ganttRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(100, Math.round(((x - cur.origStart * dayW) / Math.max(1, cur.origDur * dayW)) * 100)));
        if (pct !== cur.curPct) { const u = { ...cur, curPct: pct }; dragRef.current = u; setDrag(u); }
        return;
      }
      const nd = Math.round((e.clientX - cur.startX) / dayW);
      if (nd !== cur.deltaDays) { const u = { ...cur, deltaDays: nd }; dragRef.current = u; setDrag(u); }
    };
    const up = () => {
      const cur = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!cur) return;
      if (cur.mode === "progress") {
        if (cur.curPct !== cur.origPct) void applyCmd({ type: "task.update_progress", payload: { taskId: cur.id, percentComplete: cur.curPct } } as PlanningCommand);
        return;
      }
      if (cur.deltaDays === 0) return;
      if (cur.mode === "move") {
        const ns = Math.max(0, cur.origStart + cur.deltaDays);
        void applyCmd({ type: "task.update_schedule", payload: { taskId: cur.id, plannedStart: dayToIso(ns), plannedFinish: dayToIso(ns + cur.origDur) } } as PlanningCommand);
      } else if (cur.mode === "resizeLeft") {
        const ns = Math.max(0, cur.origStart + cur.deltaDays);
        const nf = cur.origStart + cur.origDur;
        if (nf - ns >= 1) void applyCmd({ type: "task.update_schedule", payload: { taskId: cur.id, plannedStart: dayToIso(ns), plannedFinish: dayToIso(nf) } } as PlanningCommand);
      } else {
        const nd = Math.max(1, cur.origDur + cur.deltaDays);
        const u = cur.origDur > 0 ? cur.origWorkH / (cur.origDur * HPD) : 1;
        void applyCmd({ type: "task.update_work_model", payload: { taskId: cur.id, taskType: "fixed_duration", effortDriven: false, durationMinutes: nd * MIN_PER_DAY, workMinutes: Math.max(0, Math.round(nd * HPD * u * 60)) } } as PlanningCommand);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null, dayW]);

  // resize колонок
  useEffect(() => {
    if (!colDrag) return;
    const move = (e: PointerEvent) => {
      const cur = colDragRef.current;
      if (!cur) return;
      const w = Math.max(36, Math.round(cur.origW + (e.clientX - cur.startX)));
      setColW((prev) => { const n = [...prev]; n[cur.index] = w; return n; });
    };
    const up = () => { colDragRef.current = null; setColDrag(null); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [colDrag !== null]);

  // перетягивание связи между барами (создание зависимости)
  useEffect(() => {
    if (!link) return;
    const move = (e: PointerEvent) => {
      const rect = ganttRef.current?.getBoundingClientRect();
      if (!rect) return;
      setLink((cur) => (cur ? { ...cur, curX: e.clientX - rect.left, curY: e.clientY - rect.top - HEADER_H } : cur));
    };
    const up = (e: PointerEvent) => {
      const lk = linkRef.current;
      linkRef.current = null;
      setLink(null);
      if (!lk) return;
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const target = el?.closest("[data-task-id]") as HTMLElement | null;
      const targetId = target?.dataset.taskId;
      if (!targetId || targetId === lk.fromId) return;
      // тип связи = из какого края тянули → в какой край цели (по позиции курсора)
      const tr = mapped?.rows.find((x) => x.id === targetId);
      const rect = ganttRef.current?.getBoundingClientRect();
      let toEdge: "start" | "finish" = "start";
      if (tr && rect) { const x = e.clientX - rect.left; const mid = (tr.dayStart + tr.dayDur / 2) * dayW; toEdge = x < mid ? "start" : "finish"; }
      const type = lk.fromEdge === "finish" ? (toEdge === "start" ? "FS" : "FF") : toEdge === "start" ? "SS" : "SF";
      void applyCmd({ type: "dependency.upsert", payload: { id: genId("dep"), predecessorTaskId: lk.fromId, successorTaskId: targetId, dependencyType: type, lagMinutes: 0 } } as PlanningCommand);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link !== null]);

  async function applyStaged() {
    if (staged.length === 0) return;
    const cmds = staged;
    const base = batchBaseRef.current;
    setBusy(true);
    const res = await applyBatch(cmds);
    setBusy(false);
    setStaged([]);
    if (res.ok) {
      lastCommitRef.current = base ? { commands: cmds, before: base } : null;
      setCanUndo(base != null);
      setErrors(new Map());
      setFlash(new Set(res.changed));
      setNotice(`Пакет применён: коммит v${res.planVersion} · затронуто задач: ${res.changed.length}`);
      window.setTimeout(() => setFlash(new Set()), 1700);
    } else if (res.conflict) {
      setNotice("Конфликт версий плана — перезагружено");
    } else {
      const m = new Map<string, string>();
      (res.issues ?? []).forEach((i) => { if (i.entityId) m.set(i.entityId, i.message); });
      setErrors(m);
      setNotice(`Пакет отклонён: ${res.issues?.[0]?.message ?? res.message}`);
      await reload();
    }
  }
  function discardStaged() {
    setStaged([]);
    setErrors(new Map());
    setNotice("Пакет сброшен");
    void reload();
  }
  async function undo() {
    const lc = lastCommitRef.current;
    if (!lc) return;
    const inverses = lc.commands.slice().reverse().flatMap((c) => buildCompensatingCommands(c, lc.before));
    if (inverses.length === 0) { setNotice("Откат недоступен для этой операции (создание/перенос/назначение)"); return; }
    setBusy(true);
    const res = await applyBatch(inverses);
    setBusy(false);
    lastCommitRef.current = null;
    setCanUndo(false);
    if (res.ok) {
      setErrors(new Map());
      setFlash(new Set(res.changed));
      setNotice(`Откат применён — компенсирующий коммит v${res.planVersion}`);
      window.setTimeout(() => setFlash(new Set()), 1700);
    } else {
      setNotice(res.conflict ? "Конфликт версий — перезагружено" : `Откат отклонён: ${res.issues?.[0]?.message ?? res.message}`);
    }
  }

  async function applyCmd(command: PlanningCommand) {
    // режим пакета: копим правки + оптимистично показываем, применяем одним коммитом
    if (batchMode) {
      if (staged.length === 0) batchBaseRef.current = readModel;
      setStaged((s) => [...s, command]);
      if (readModel) { const opt = optimisticPatch(readModel, command); if (opt !== readModel) setReadModel(opt); }
      setNotice(null);
      return;
    }
    const prev = readModel;
    setNotice(null);
    // 1) оптимистично применяем на фронте — мгновенный отклик
    if (prev) { const opt = optimisticPatch(prev, command); if (opt !== prev) setReadModel(opt); }
    setBusy(true);
    // 2) бэк валидирует и пересчитывает авторитетно
    const res = await apply(command);
    setBusy(false);
    if (res.ok) {
      lastCommitRef.current = prev ? { commands: [command], before: prev } : null;
      setCanUndo(prev != null);
      setErrors(new Map());
      setFlash(new Set(res.changed));
      setNotice(`Коммит v${res.planVersion} применён · затронуто задач: ${res.changed.length}`);
      window.setTimeout(() => setFlash(new Set()), 1700);
    } else if (res.conflict) {
      setNotice("Конфликт версий плана — перезагружено");
    } else {
      // 3) бэк отклонил → откат оптимистики + подсветка где/как
      if (prev) setReadModel(prev);
      const m = new Map<string, string>();
      (res.issues ?? []).forEach((i) => { if (i.entityId) m.set(i.entityId, i.message); });
      setErrors(m);
      setNotice(`Отклонено бэком: ${res.issues?.[0]?.message ?? res.message}`);
    }
  }

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error);
  // готовый контент — только при наличии mapped+readModel. Frame-обёртку сохраняем.
  // ВНИМАНИЕ: инлайн валидационный блок ошибок задач (errors map) — это НЕ состояние
  // загрузки поверхности, его НЕ трогаем.
  if (status !== "ready" || !mapped || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={PROJECT_FALLBACK} activeTab="График">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка плана из read-model…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const projectMeta = deriveProjectMeta(readModel, PROJECT);
  const { rows, deadlineDay, projectFinishDay } = mapped;
  const totalDays = Math.max(7, Math.ceil((Math.max(projectFinishDay, deadlineDay, ...rows.map((r) => r.dayStart + r.dayDur)) + 6) / 7) * 7);
  const weeks = totalDays / 7;
  const timelineW = totalDays * dayW;
  const weekW = 7 * dayW;

  const isHidden = (wbs: string) => { for (const c of collapsed) if (wbs.startsWith(c + ".")) return true; return false; };
  const visibleRows = rows.filter((r) => !isHidden(r.wbs));
  const hasChildren = (wbs: string) => rows.some((r) => r.wbs.startsWith(wbs + "."));
  const toggle = (wbs: string) => setCollapsed((prev) => { const n = new Set(prev); if (n.has(wbs)) n.delete(wbs); else n.add(wbs); return n; });

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
      const sx = (sFromRight ? pred.dayStart + pred.dayDur : pred.dayStart) * dayW;
      const dx = (dToRight ? succ.dayStart + succ.dayDur : succ.dayStart) * dayW;
      const sy = si * ROW_H + ROW_H / 2;
      const dy = di * ROW_H + ROW_H / 2;
      const ex = sx + (sFromRight ? 10 : -10);
      const dDir = dToRight ? -1 : 1;
      const points = `${sx},${sy} ${ex},${sy} ${ex},${dy} ${dx},${dy}`;
      const head = dDir > 0 ? `${dx},${dy} ${dx - 5},${dy - 3} ${dx - 5},${dy + 3}` : `${dx},${dy} ${dx + 5},${dy - 3} ${dx + 5},${dy + 3}`;
      links.push({ key: `${pred.id}->${succ.id}`, points, head, accent: sel != null && (succ.id === sel || pred.id === sel), depId: p.depId, predId: p.predId, succId: succ.id, type: p.type, lagDays: p.lagDays, mx: ex, my: (sy + dy) / 2 });
    }
  });
  links.sort((a, b) => (a.accent ? 1 : 0) - (b.accent ? 1 : 0));
  const ganttH = visibleRows.length * ROW_H;
  const selected = rows.find((r) => r.id === sel) ?? null;

  const openRow = (id: string) => { setSel(id); setInspectorOpen(true); };

  // --- команды ---
  const workCmd = (taskId: string, durDays: number, workH: number): PlanningCommand =>
    ({ type: "task.update_work_model", payload: { taskId, taskType: "fixed_duration", effortDriven: false, durationMinutes: durDays * MIN_PER_DAY, workMinutes: Math.max(0, Math.round(workH * 60)) } }) as PlanningCommand;
  const editDuration = (r: Row, days: number) => { const u = r.durDays > 0 ? r.workH / (r.durDays * HPD) : 1; void applyCmd(workCmd(r.id, days, Math.round(days * HPD * u))); };
  const editWork = (r: Row, workH: number) => void applyCmd(workCmd(r.id, r.durDays, workH));
  const editUnits = (r: Row, pct: number) => void applyCmd(workCmd(r.id, r.durDays, Math.round(r.durDays * HPD * (pct / 100))));
  const editName = (r: Row, title: string) => void applyCmd({ type: "task.update_identity", payload: { taskId: r.id, title } } as PlanningCommand);
  const editPct = (r: Row, pct: number) => void applyCmd({ type: "task.update_progress", payload: { taskId: r.id, percentComplete: Math.max(0, Math.min(100, pct)) } } as PlanningCommand);
  const editDate = (r: Row, iso: string) => void applyCmd({ type: "task.update_schedule", payload: { taskId: r.id, plannedStart: iso, plannedFinish: dayToIso(isoToDay(iso) + r.dayDur) } } as PlanningCommand);
  const editFinish = (r: Row, iso: string) => { const startIso = r.startIso || dayToIso(r.dayStart); if (isoToDay(iso) > isoToDay(startIso)) void applyCmd({ type: "task.update_schedule", payload: { taskId: r.id, plannedStart: startIso, plannedFinish: iso } } as PlanningCommand); };
  const assignRes = (taskId: string, resourceId: string) => void applyCmd({ type: "assignment.upsert", payload: { id: genId("a"), taskId, resourceId, role: "executor", unitsPermille: 1000, workMinutes: null } } as PlanningCommand);
  const depAdd = (succId: string, predId: string, type: string, lagDays: number) => void applyCmd({ type: "dependency.upsert", payload: { id: genId("dep"), predecessorTaskId: predId, successorTaskId: succId, dependencyType: type, lagMinutes: lagDays * MIN_PER_DAY } } as PlanningCommand);
  const depRemove = (depId: string) => void applyCmd({ type: "dependency.delete", payload: { dependencyId: depId } } as PlanningCommand);
  const depUpsert = (depId: string, predId: string, succId: string, type: string, lagDays: number) => void applyCmd({ type: "dependency.upsert", payload: { id: depId, predecessorTaskId: predId, successorTaskId: succId, dependencyType: type, lagMinutes: lagDays * MIN_PER_DAY } } as PlanningCommand);
  const makeMilestone = (r: Row) => void applyCmd(workCmd(r.id, 0, 0));
  const deleteTask = (r: Row) => void applyCmd({ type: "task.delete_or_archive", payload: { taskId: r.id, mode: "delete" } } as PlanningCommand);
  const moveCmd = (taskId: string, parentTaskId: string | null): PlanningCommand => ({ type: "task.move_wbs", payload: { taskId, parentTaskId, sortOrder: 0 } }) as PlanningCommand;
  const prevSibling = (r: Row): Row | null => { const sibs = rows.filter((x) => x.parentId === r.parentId); const i = sibs.findIndex((x) => x.id === r.id); return i > 0 ? sibs[i - 1]! : null; };
  const canIndent = (r: Row) => prevSibling(r) !== null;
  const canOutdent = (r: Row) => r.parentId !== null;
  const indent = (r: Row) => { const ps = prevSibling(r); if (ps) void applyCmd(moveCmd(r.id, ps.id)); };
  const outdent = (r: Row) => { if (r.parentId) { const parent = rows.find((x) => x.id === r.parentId); void applyCmd(moveCmd(r.id, parent ? parent.parentId : null)); } };

  async function runBatch(cmds: PlanningCommand[]) {
    if (!cmds.length) return;
    const base = readModel;
    setBusy(true);
    const res = await applyBatch(cmds);
    setBusy(false);
    if (res.ok) {
      lastCommitRef.current = base ? { commands: cmds, before: base } : null;
      setCanUndo(base != null);
      setErrors(new Map());
      setFlash(new Set(res.changed));
      setNotice(`Коммит v${res.planVersion} применён · затронуто задач: ${res.changed.length}`);
      window.setTimeout(() => setFlash(new Set()), 1700);
    } else if (res.conflict) setNotice("Конфликт версий плана — перезагружено");
    else { const m = new Map<string, string>(); (res.issues ?? []).forEach((i) => { if (i.entityId) m.set(i.entityId, i.message); }); setErrors(m); setNotice(`Отклонено бэком: ${res.issues?.[0]?.message ?? res.message}`); }
  }
  const addFinish = (iso: string, dur: number) => dayToIso(isoToDay(iso) + dur);
  const openCreate = (parentId: string | null) => setTaskModal({ mode: "create", parentId, initial: { title: "", assigneeId: "", startIso: "", durDays: 5, workH: 40, pct: 0 } });
  const openEdit = (r: Row) => {
    const asgs = (readModel.authored as unknown as { assignments: Array<{ taskId: string; resourceId: string }> }).assignments;
    const asg = asgs.find((x) => x.taskId === r.id);
    setTaskModal({ mode: "edit", parentId: r.parentId, taskId: r.id, initial: { title: r.name, assigneeId: asg?.resourceId ?? "", startIso: r.startIso, durDays: r.durDays, workH: r.workH, pct: r.pct } });
  };
  function submitTaskModal(v: TaskModalValues) {
    const m = taskModal;
    setTaskModal(null);
    if (!m) return;
    const cmds: PlanningCommand[] = [];
    if (m.mode === "create") {
      const id = genId("t");
      cmds.push({ type: "task.create", payload: { id, projectId: MOCK_PROJECT_ID, parentTaskId: m.parentId, title: v.title, statusId: "todo", plannedStart: v.startIso || null, plannedFinish: v.startIso ? addFinish(v.startIso, v.durDays) : null, durationMinutes: v.durDays * MIN_PER_DAY, workMinutes: v.workH * 60, assignments: [] } } as PlanningCommand);
      if (v.startIso) cmds.push({ type: "task.update_schedule", payload: { taskId: id, plannedStart: v.startIso, plannedFinish: addFinish(v.startIso, v.durDays) } } as PlanningCommand);
      if (v.assigneeId) cmds.push({ type: "assignment.upsert", payload: { id: genId("a"), taskId: id, resourceId: v.assigneeId, role: "executor", unitsPermille: 1000, workMinutes: v.workH * 60 } } as PlanningCommand);
      if (v.pct > 0) cmds.push({ type: "task.update_progress", payload: { taskId: id, percentComplete: v.pct } } as PlanningCommand);
    } else if (m.taskId) {
      const id = m.taskId;
      cmds.push({ type: "task.update_identity", payload: { taskId: id, title: v.title } } as PlanningCommand);
      cmds.push({ type: "task.update_work_model", payload: { taskId: id, taskType: "fixed_duration", effortDriven: false, durationMinutes: v.durDays * MIN_PER_DAY, workMinutes: v.workH * 60 } } as PlanningCommand);
      if (v.startIso) cmds.push({ type: "task.update_schedule", payload: { taskId: id, plannedStart: v.startIso, plannedFinish: addFinish(v.startIso, v.durDays) } } as PlanningCommand);
      cmds.push({ type: "task.update_progress", payload: { taskId: id, percentComplete: v.pct } } as PlanningCommand);
      if (v.assigneeId) cmds.push({ type: "assignment.upsert", payload: { id: genId("a"), taskId: id, resourceId: v.assigneeId, role: "executor", unitsPermille: 1000, workMinutes: v.workH * 60 } } as PlanningCommand);
    }
    void runBatch(cmds);
  }

  function commitInline(r: Row) {
    const f = edit?.field;
    setEdit(null);
    if (!f) return;
    const n = Number(draft);
    if (f === "name") { if (draft.trim() && draft !== r.name) editName(r, draft.trim()); return; }
    if (Number.isNaN(n)) return;
    if (f === "dur" && n >= 0 && n !== r.durDays) editDuration(r, n);
    else if (f === "work" && n >= 0 && n !== r.workH) editWork(r, n);
    else if (f === "pct" && n !== r.pct) editPct(r, n);
    else if (f === "units" && n > 0) editUnits(r, n);
  }
  const beginEdit = (r: Row, field: "name" | "dur" | "work" | "pct" | "units", cur: string | number) => { setEdit({ id: r.id, field }); setDraft(String(cur)); };

  function depOptions(r: Row) {
    const banned = new Set([r.id, ...r.predList.map((p) => p.predId)]);
    return rows.filter((t) => t.id !== r.id && !t.wbs.startsWith(r.wbs + ".") && !banned.has(t.id) && t.kind !== "summary").map((t) => ({ id: t.id, label: `${t.wbs} ${t.name}` }));
  }
  const predRows = (r: Row) => r.predList.map((p) => ({ depId: p.depId, predId: p.predId, predLabel: rowById.get(p.predId)?.wbs ?? rows.find((x) => x.id === p.predId)?.wbs ?? "?", type: p.type, lagDays: p.lagDays }));

  // --- drag/resize/link ---
  const startDrag = (e: ReactPointerEvent, r: Row, mode: DragMode) => {
    e.stopPropagation();
    const d: DragState = { id: r.id, mode, startX: e.clientX, origStart: r.dayStart, origDur: r.dayDur, origWorkH: r.workH, origPct: r.pct, deltaDays: 0, curPct: r.pct };
    dragRef.current = d;
    setDrag(d);
  };
  const startColResize = (e: ReactPointerEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    const cd: ColDrag = { index, startX: e.clientX, origW: colW[index] ?? 80 };
    colDragRef.current = cd;
    setColDrag(cd);
  };
  const startLink = (e: ReactPointerEvent, r: Row, edge: "start" | "finish") => {
    e.stopPropagation();
    const fromX = (edge === "finish" ? r.dayStart + r.dayDur : r.dayStart) * dayW;
    const fromY = (indexById.get(r.id) ?? 0) * ROW_H + ROW_H / 2;
    linkRef.current = { fromId: r.id, fromEdge: edge };
    setLink({ fromId: r.id, fromEdge: edge, fromX, fromY, curX: fromX, curY: fromY });
  };

  return (
    <DeliveryFrame project={projectMeta} activeTab="График">
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Button variant="default" size="sm" onClick={() => openCreate(null)} disabled={busy}><Plus className="size-3.5" aria-hidden />Задача</Button>
        <Button variant="secondary" size="sm" onClick={() => selected && openCreate(selected.kind === "summary" ? selected.id : selected.parentId)} disabled={busy || !selected}><Plus className="size-3.5" aria-hidden />Подзадача</Button>
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <Button variant="ghost" size="sm" onClick={() => selected && outdent(selected)} disabled={busy || !selected || (selected ? !canOutdent(selected) : true)} title="На уровень выше"><IndentDecrease className="size-3.5" aria-hidden /></Button>
        <Button variant="ghost" size="sm" onClick={() => selected && indent(selected)} disabled={busy || !selected || (selected ? !canIndent(selected) : true)} title="На уровень глубже"><IndentIncrease className="size-3.5" aria-hidden /></Button>
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <Button variant={batchMode ? "default" : "ghost"} size="sm" onClick={() => setBatchMode((v) => !v)} title="Режим пакета: копить правки и применить одним коммитом"><GitBranch className="size-3.5" aria-hidden />Пакет{staged.length ? ` · ${staged.length}` : ""}</Button>
        <Button variant="ghost" size="sm" onClick={() => void undo()} disabled={busy || !canUndo} title="Откатить последний коммит (компенсирующий коммит)"><Undo2 className="size-3.5" aria-hidden />Откат</Button>
        <Button variant="ghost" size="sm" {...demoAction("снимок baseline")}><Layers className="size-3.5" aria-hidden />Baseline</Button>
        <Button variant="ghost" size="sm" {...demoAction("фильтры")}><Filter className="size-3.5" aria-hidden />Фильтры</Button>
        <Button variant="ghost" size="sm" {...demoAction("настройка колонок")}><Columns3 className="size-3.5" aria-hidden />Колонки</Button>
        <div className="ml-auto flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-0.5">
          {(["day", "week", "month"] as Zoom[]).map((z) => (
            <button key={z} type="button" onClick={() => setZoom(z)} className={cn("rounded-[var(--radius-sm)] px-2.5 py-1 text-[length:var(--text-sm)] font-medium transition-colors", zoom === z ? "bg-[var(--panel-strong)] text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text)]")}>
              {z === "day" ? "День" : z === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        Реальный контракт planning · каждая правка = коммит preview→apply через @kiss-pm/planning-client. Данные in-memory, не сохраняются. 2× клик — правка ячейки · ПКМ — меню · границы колонок — ширина · бар: тяни тело (сдвиг), края (длительность), точку справа — связь.
      </div>

      {errors.size > 0 ? (
        <div className="mb-2 flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--danger-text)]">
          {[...errors].map(([tid, msg]) => {
            const er = rows.find((x) => x.id === tid);
            return (
              <div key={tid} className="flex items-start gap-1.5">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span><span className="font-semibold">{er ? `${er.wbs} ${er.name}` : tid}</span> — {msg}</span>
              </div>
            );
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
                        {c.label}
                        {i < COLS.length - 1 ? (
                          <span
                            className="absolute -right-[3px] top-0 z-10 h-full w-[6px] cursor-col-resize hover:bg-[var(--accent)]"
                            onPointerDown={(e) => startColResize(e, i)}
                            title="Перетащите — изменить ширину колонки"
                          />
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r, i) => (
                    <RowMenu
                      key={r.id}
                      isLeaf={r.kind !== "summary"}
                      canIndent={canIndent(r)}
                      canOutdent={canOutdent(r)}
                      onOpen={() => openRow(r.id)}
                      onEdit={() => openEdit(r)}
                      onAddSub={() => openCreate(r.id)}
                      onAddBelow={() => openCreate(r.parentId)}
                      onIndent={() => indent(r)}
                      onOutdent={() => outdent(r)}
                      onMakeMilestone={() => makeMilestone(r)}
                      onDelete={() => deleteTask(r)}
                    >
                      <tr onClick={() => openRow(r.id)} className={cn(r.kind === "summary" && "is-summary", sel === r.id && "is-selected", flash.has(r.id) && "bg-[var(--success-soft)]", errors.has(r.id) && "bg-[var(--danger-soft)]")}>
                        <td className="num muted text-[length:var(--text-xs)]">{i + 1}</td>
                        <td>{r.kind === "milestone" ? <span className="text-[var(--muted-soft)]">—</span> : <ModeChip mode={r.mode} />}</td>
                        <td className="mono muted text-[length:var(--text-xs)]">{r.wbs}</td>
                        <td title={r.name} onDoubleClick={(e) => { stop(e); beginEdit(r, "name", r.name); }}>
                          <span className="name-cell" style={{ paddingLeft: r.level * 14 }}>
                            {r.kind === "summary" && hasChildren(r.wbs) ? (
                              <button type="button" onClick={(e) => { stop(e); toggle(r.wbs); }} className="grid size-3.5 shrink-0 place-items-center rounded-[var(--radius-xs)] text-[var(--muted)] transition-colors hover:bg-[var(--panel-strong)] hover:text-[var(--text)]" aria-label={collapsed.has(r.wbs) ? "Развернуть группу" : "Свернуть группу"}>
                                {collapsed.has(r.wbs) ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
                              </button>
                            ) : <span className="w-3.5 shrink-0" />}
                            {r.critical ? <span className="size-1.5 shrink-0 rounded-full bg-[var(--critical-stripe)]" title="На критическом пути" /> : null}
                            {r.warning ? <span className="inline-flex shrink-0" title={r.warnMsg ?? "Предупреждение планировщика"}><TriangleAlert className="size-3 text-[var(--warning)]" aria-hidden /></span> : null}
                            {edit?.id === r.id && edit.field === "name" ? (
                              <input autoFocus value={draft} onClick={stop} onChange={(e) => setDraft(e.target.value)} onBlur={() => commitInline(r)} onKeyDown={(e) => { if (e.key === "Enter") commitInline(r); if (e.key === "Escape") setEdit(null); }} className="w-full rounded-[var(--radius-xs)] border border-[var(--accent)] bg-[var(--panel)] px-1 text-[length:var(--text-sm)] outline-none" />
                            ) : <span className={cn("truncate", r.kind === "summary" ? "font-bold text-[var(--text-strong)]" : "font-medium text-[var(--text)]")}>{r.name}</span>}
                          </span>
                        </td>
                        <td className="num muted" onDoubleClick={(e) => { if (r.kind === "task") { stop(e); beginEdit(r, "dur", r.durDays); } }}>
                          {edit?.id === r.id && edit.field === "dur" ? <input autoFocus type="number" value={draft} onClick={stop} onChange={(e) => setDraft(e.target.value)} onBlur={() => commitInline(r)} onKeyDown={(e) => { if (e.key === "Enter") commitInline(r); if (e.key === "Escape") setEdit(null); }} className={numInput} /> : r.kind === "milestone" ? "0 дн" : `${r.durDays} дн`}
                        </td>
                        <td className="num muted" onDoubleClick={(e) => { if (r.kind === "task") { stop(e); beginEdit(r, "work", r.workH); } }}>
                          {edit?.id === r.id && edit.field === "work" ? <input autoFocus type="number" value={draft} onClick={stop} onChange={(e) => setDraft(e.target.value)} onBlur={() => commitInline(r)} onKeyDown={(e) => { if (e.key === "Enter") commitInline(r); if (e.key === "Escape") setEdit(null); }} className={numInput} /> : r.kind === "milestone" ? "—" : `${r.workH} ч`}
                        </td>
                        <td className="num" onDoubleClick={(e) => { if (r.kind === "task") { stop(e); beginEdit(r, "pct", r.pct); } }}>
                          {edit?.id === r.id && edit.field === "pct" ? <input autoFocus type="number" value={draft} onClick={stop} onChange={(e) => setDraft(e.target.value)} onBlur={() => commitInline(r)} onKeyDown={(e) => { if (e.key === "Enter") commitInline(r); if (e.key === "Escape") setEdit(null); }} className={numInput} /> : `${r.pct}%`}
                        </td>
                        <td className="mono muted">
                          {r.kind === "milestone" || r.kind === "task" ? <DateEditor valueIso={r.startIso} onPick={(iso) => editDate(r, iso)}><button type="button" onClick={stop} className={cellBtn}>{fmtDate(r.startIso)}</button></DateEditor> : fmtDate(r.startIso)}
                        </td>
                        <td className="mono muted">
                          {r.kind === "task" ? <DateEditor title="Окончание задачи" valueIso={r.finishIso} onPick={(iso) => editFinish(r, iso)}><button type="button" onClick={stop} className={cellBtn}>{fmtDate(r.finishIso)}</button></DateEditor> : fmtDate(r.finishIso)}
                        </td>
                        <td className="text-[var(--muted-strong)]">
                          {r.kind === "task" ? <ResourceEditor onPick={(rid) => assignRes(r.id, rid)}><button type="button" onClick={stop} className={cellBtn}>{r.res}</button></ResourceEditor> : <span className="text-[var(--muted-soft)]">{r.res}</span>}
                        </td>
                        <td className="mono text-[length:var(--text-xs)] text-[var(--muted)]">
                          {r.kind !== "summary" ? <DependencyEditor preds={predRows(r)} options={depOptions(r)} onAdd={(p, t, l) => depAdd(r.id, p, t, l)} onRemove={depRemove}><button type="button" onClick={stop} className={cellBtn}>{r.predDisplay}</button></DependencyEditor> : "—"}
                        </td>
                      </tr>
                    </RowMenu>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Gantt pane */}
            <div ref={ganttRef} className="relative min-w-0 flex-1" style={{ width: timelineW }}>
              <div className="sticky top-0 z-10 flex h-9 border-b border-[var(--border-strong)] bg-[var(--panel-subtle)]">
                {Array.from({ length: weeks }, (_, i) => <span key={i} className="v4-num shrink-0 border-r border-[var(--border-subtle)] px-2 text-[length:var(--text-xs)] leading-9 text-[var(--muted)]" style={{ width: weekW }}>{weekLabel(i)}</span>)}
              </div>
              <span className="pointer-events-none absolute bottom-0 top-9 z-[1] w-px bg-[var(--accent)]" style={{ left: TODAY_DAY * dayW }} title="Сегодня" />
              <span className="pointer-events-none absolute bottom-0 top-9 z-[1] w-px border-l border-dashed border-[var(--danger)]" style={{ left: deadlineDay * dayW }} title="Дедлайн 12.07" />
              {visibleRows.map((r) => {
                const dragging = drag?.id === r.id;
                const dMove = dragging && drag.mode === "move" ? drag.deltaDays : 0;
                const dLeft = dragging && drag.mode === "resizeLeft" ? drag.deltaDays : 0;
                const dRight = dragging && drag.mode === "resize" ? drag.deltaDays : 0;
                const left = (r.dayStart + dMove + dLeft) * dayW;
                const width = Math.max((r.dayDur + dRight - dLeft) * dayW, 6);
                const barRight = left + width;
                const fillPct = dragging && drag.mode === "progress" ? drag.curPct : r.pct;
                return (
                  <div key={r.id} data-task-id={r.id} onClick={() => openRow(r.id)} className={cn("group relative h-[var(--row-h)] cursor-pointer border-b border-[var(--border-subtle)] last:border-0", errors.has(r.id) ? "bg-[var(--danger-soft)]" : sel === r.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--panel-subtle)]")} style={{ backgroundImage: sel === r.id || errors.has(r.id) ? undefined : `repeating-linear-gradient(to right, transparent, transparent ${weekW - 1}px, var(--border-subtle) ${weekW - 1}px, var(--border-subtle) ${weekW}px)` }}>
                    {r.kind === "milestone" ? (
                      <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-[var(--text-strong)]" style={{ left }} title={`Веха · ${fmtDate(r.finishIso)}`} />
                    ) : r.kind === "summary" ? (
                      <span className="absolute top-1/2 -translate-y-1/2 rounded-[3px] bg-[var(--text-strong)]" style={{ left, width, height: 8 }} title={`${r.name} · ${r.pct}%`} />
                    ) : (
                      <>
                        {r.baseDay != null && r.baseDur != null ? <span className="absolute rounded-[3px] border border-[var(--border-strong)] bg-[var(--panel-strong)]" style={{ left: r.baseDay * dayW, width: Math.max(r.baseDur * dayW, 6), height: 6, bottom: 5 }} title="Baseline B2" /> : null}
                        <span
                          className={cn("gantt-bar absolute top-1/2 flex -translate-y-1/2 cursor-grab items-center overflow-hidden rounded-[5px] shadow-[var(--shadow-card)] active:cursor-grabbing", r.critical && "gantt-bar--crit", dragging && "opacity-90 outline-dashed outline-2 outline-offset-1 outline-[var(--accent)]", flash.has(r.id) && "ring-2 ring-[var(--success)]")}
                          style={{ left, width, height: 18 }}
                          title={`${r.name} · ${fillPct}% · тело — сдвиг, края — длительность`}
                          onPointerDown={(e) => startDrag(e, r, "move")}
                        >
                          <span className={cn("gantt-bar-fill h-full", r.critical && "gantt-bar-fill--crit")} style={{ width: `${fillPct}%` }} />
                          <span className="absolute top-0 h-full w-1 -translate-x-1/2 cursor-ew-resize bg-[var(--accent)] opacity-0 group-hover:opacity-100" style={{ left: `${fillPct}%` }} onPointerDown={(e) => startDrag(e, r, "progress")} title="Тяните — % выполнения" />
                          <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/10 opacity-0 group-hover:opacity-100" onPointerDown={(e) => startDrag(e, r, "resizeLeft")} title="Потяните — сдвинуть начало" />
                          <span className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/10 opacity-0 group-hover:opacity-100" onPointerDown={(e) => startDrag(e, r, "resize")} title="Потяните — изменить длительность" />
                        </span>
                        <span className="absolute top-1/2 z-[2] size-2.5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-[var(--panel)] bg-[var(--muted-soft)] opacity-0 shadow-[var(--shadow-card)] transition-opacity group-hover:opacity-100" style={{ left: left - 3 }} onPointerDown={(e) => startLink(e, r, "start")} title="Тяните от начала → связь НН/НО" />
                        <span className="absolute top-1/2 z-[2] size-2.5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-[var(--panel)] bg-[var(--accent)] opacity-0 shadow-[var(--shadow-card)] transition-opacity group-hover:opacity-100" style={{ left: barRight + 3 }} onPointerDown={(e) => startLink(e, r, "finish")} title="Тяните от конца → связь ОН/ОО" />
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
              {links.filter((l) => l.accent).map((l) => (
                <LinkLagEditor key={`badge-${l.key}`} type={l.type} lagDays={l.lagDays} onSave={(t, lag) => depUpsert(l.depId, l.predId, l.succId, t, lag)} onDelete={() => depRemove(l.depId)}>
                  <button type="button" onClick={stop} className="absolute z-[4] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--accent)] bg-[var(--panel)] px-1 text-[9px] font-semibold leading-tight text-[var(--accent)] shadow-[var(--shadow-card)] hover:bg-[var(--accent-soft)]" style={{ left: l.mx, top: HEADER_H + l.my }} title="Изменить связь (тип/лаг)">
                    {DEP_RU[l.type]}{l.lagDays ? `+${l.lagDays}` : ""}
                  </button>
                </LinkLagEditor>
              ))}
            </div>
          </div>
        </div>

        {/* Side-peek инспектор */}
        {inspectorOpen && selected ? (
          <aside className="absolute right-0 top-0 z-30 flex h-full w-[340px] flex-col border-l border-[var(--border-strong)] bg-[var(--panel)] shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--muted)]"><span className="mono">WBS {selected.wbs}</span>{selected.critical ? <span className="rounded-full bg-[var(--danger-soft)] px-1.5 text-[10px] font-semibold text-[var(--danger-text)]">критпуть</span> : null}</div>
                <h3 className="mt-0.5 truncate text-[length:var(--text-base)] font-bold text-[var(--text-strong)]">{selected.name}</h3>
              </div>
              <button type="button" onClick={() => setInspectorOpen(false)} className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--text)]" aria-label="Закрыть"><X className="size-4" aria-hidden /></button>
            </div>
            <div className="flex-1 overflow-auto px-4 py-3 text-[length:var(--text-sm)]">
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-[var(--muted)]"><span>Прогресс</span><span className="font-semibold text-[var(--text)]">{selected.pct}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-strong)]"><span className="block h-full rounded-full bg-[var(--success)]" style={{ width: `${selected.pct}%` }} /></div>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Fact label="Режим" value={selected.mode === "auto" ? "Авто" : "Ручной"} />
                <Fact label="Длительность" value={`${selected.durDays} дн`} />
                <Fact label="Трудозатраты" value={`${selected.workH} ч`} />
                <FactNum label="Единицы" value={unitsPct(selected.durDays, selected.workH)} suffix="%" disabled={selected.kind !== "task"} onCommit={(n) => editUnits(selected, n)} />
                <Fact label="Начало" value={fmtDate(selected.startIso)} mono />
                <Fact label="Окончание" value={fmtDate(selected.finishIso)} mono />
                <Fact label="Слак" value={selected.slackDays != null ? `${selected.slackDays} дн` : "—"} />
                <Fact label="Ресурсы" value={selected.res} span />
              </dl>
              <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--panel-subtle)] px-2 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">Триангл: Труд = Длит × {HPD}ч × Единицы. Изменишь длительность — пересчитается труд; изменишь труд — изменятся единицы.</p>
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                <div className="mb-1.5 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Зависимости</div>
                {selected.predList.length ? (
                  <ul className="space-y-1">
                    {selected.predList.map((p) => { const pr = rows.find((x) => x.id === p.predId); return <li key={p.depId} className="flex items-center gap-2 text-[var(--text)]"><span className="mono text-[var(--muted)]">{pr?.wbs}</span><span className="truncate">{pr?.name}</span><span className="ml-auto rounded bg-[var(--panel-strong)] px-1 text-[10px] font-semibold text-[var(--muted-strong)]">{DEP_RU[p.type]}{p.lagDays ? ` +${p.lagDays}д` : ""}</span></li>; })}
                  </ul>
                ) : <span className="text-[var(--muted)]">нет</span>}
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {staged.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2.5 shadow-[var(--shadow-raise)]">
          <span className="inline-flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]"><GitBranch className="size-4 text-[var(--accent)]" aria-hidden />Пакет правок</span>
          <span className="text-[length:var(--text-sm)] text-[var(--muted-strong)]">накоплено: <span className="font-semibold">{staged.length}</span> · применятся одним коммитом</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={discardStaged} disabled={busy}>Сбросить</Button>
            <Button variant="default" size="sm" onClick={() => void applyStaged()} disabled={busy}>Применить пакетом</Button>
          </div>
        </div>
      ) : null}
      {notice ? <div key={notice} className="anim-rise-in-fast mt-2 flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]"><GitBranch className="size-3.5 text-[var(--accent)]" aria-hidden />{notice}</div> : null}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[length:var(--text-sm)] text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-[3px] bg-[var(--success)]" /> Задача</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-[3px] bg-[var(--critical-stripe)]" /> Критический путь</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-[3px] bg-[var(--text-strong)]" /> Summary</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rotate-45 rounded-[2px] bg-[var(--text-strong)]" /> Веха</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-[3px] border border-[var(--border-strong)] bg-[var(--panel-strong)]" /> Baseline B2</span>
        <span className="flex items-center gap-1.5"><svg width="22" height="8" aria-hidden><polyline points="1,4 14,4" fill="none" stroke="var(--muted-soft)" strokeWidth="1.25" /><polygon points="21,4 15,1.5 15,6.5" fill="var(--muted-soft)" /></svg> Связь</span>
        <span className="ml-auto text-[length:var(--text-xs)] text-[var(--muted-soft)]">2× клик — правка · ПКМ — меню · тяни бар — сдвиг/длительность · движок считает даты/критпуть</span>
      </div>

      {taskModal ? <TaskModal open mode={taskModal.mode} initial={taskModal.initial} onOpenChange={(o) => { if (!o) setTaskModal(null); }} onSubmit={submitTaskModal} /> : null}
    </DeliveryFrame>
  );
}

function Fact({ label, value, mono, span }: { label: string; value: string; mono?: boolean; span?: boolean }) {
  return (
    <div className={cn(span && "col-span-2")}>
      <dt className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">{label}</dt>
      <dd className={cn("text-[var(--text)]", mono && "mono")}>{value}</dd>
    </div>
  );
}

function FactNum({ label, value, suffix, disabled, onCommit }: { label: string; value: number; suffix?: string; disabled?: boolean; onCommit: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  return (
    <div>
      <dt className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">{label}</dt>
      {editing && !disabled ? (
        <input autoFocus type="number" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { setEditing(false); const n = Number(draft); if (!Number.isNaN(n) && n !== value) onCommit(n); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }} className="w-16 rounded-[var(--radius-xs)] border border-[var(--accent)] bg-[var(--panel)] px-1 text-[length:var(--text-sm)] tabular-nums outline-none" />
      ) : (
        <dd className={cn("text-[var(--text)]", !disabled && "cursor-pointer rounded px-0.5 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]")} onClick={() => { if (!disabled) { setDraft(String(value)); setEditing(true); } }}>{value}{suffix}</dd>
      )}
    </div>
  );
}
