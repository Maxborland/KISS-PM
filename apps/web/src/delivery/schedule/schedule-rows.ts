import { dayToIso, isoToDay, MIN_PER_DAY } from "@/delivery/lib/mock-planning-backend";
import type { PlanningReadModel } from "@kiss-pm/planning-client";

// Чистое отображение канонического read-model в строки Гантта (WBS + summary-rollup + предшественники).
// Вынесено из schedule-surface (god-компонент) в самостоятельный модуль без React — тестируемо и локально.
export type Kind = "summary" | "task" | "milestone";
export type Mode = "auto" | "manual";
export type Pred = { depId: string; predId: string; type: string; lagDays: number };
const DEP_RU: Record<string, string> = { FS: "ОН", SS: "НН", FF: "ОО", SF: "НО" };
export type Row = {
  id: string;
  wbs: string;
  name: string;
  level: number;
  kind: Kind;
  hasChildren: boolean;
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

export function mapRows(
  rm: PlanningReadModel,
  resName: (id: string) => string
): { rows: Row[]; deadlineDay: number | null; projectFinishDay: number } {
  // Типизированный доступ к каноническому read-model (@kiss-pm/domain) — без прежних `as unknown as`.
  const authored = rm.authored;
  const calc = rm.calculatedPlan.tasks;
  const baseCmp = rm.baselineComparison.tasks ?? [];
  const project = rm.project;
  const issues = rm.validationIssues ?? [];

  const calcById = new Map(calc.map((c) => [c.id, c]));
  const wbsById = new Map(authored.tasks.map((t) => [t.id, t.wbsCode]));
  const taskById = new Map(authored.tasks.map((t) => [t.id, t]));
  const childrenByParent = new Map<string, typeof authored.tasks>();
  for (const t of authored.tasks) {
    if (!t.parentTaskId) continue;
    const arr = childrenByParent.get(t.parentTaskId) ?? [];
    arr.push(t);
    childrenByParent.set(t.parentTaskId, arr);
  }
  const levelCache = new Map<string, number>();
  const levelOfTask = (taskId: string, seen = new Set<string>()): number => {
    const cached = levelCache.get(taskId);
    if (cached != null) return cached;
    const t = taskById.get(taskId);
    if (!t?.parentTaskId || seen.has(taskId)) {
      const fallback = Math.max(0, (t?.wbsCode ?? "").split(".").filter(Boolean).length - 1);
      levelCache.set(taskId, fallback);
      return fallback;
    }
    seen.add(taskId);
    const level = levelOfTask(t.parentTaskId, seen) + 1;
    levelCache.set(taskId, level);
    return level;
  };
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
  // Имена ресурсов для колонки «Ресурсы»: read-model не отдаёт customFields.resLabel,
  // поэтому собираем из назначений (taskId→resourceId) через справочник (live: реальные users).
  const assigneesByTask = new Map<string, string[]>();
  for (const a of authored.assignments ?? []) {
    const arr = assigneesByTask.get(a.taskId) ?? [];
    arr.push(resName(a.resourceId));
    assigneesByTask.set(a.taskId, arr);
  }
  const assigneeLabel = (taskId: string) => (assigneesByTask.get(taskId) ?? []).join(", ");

  const rows: Row[] = authored.tasks.map((t) => {
    const c = calcById.get(t.id);
    const start = c?.calculatedStart ?? "";
    const finish = c?.calculatedFinish ?? "";
    const dayStart = start ? isoToDay(start) : 0;
    const dayDur = start && finish ? isoToDay(finish) - dayStart : 0;
    // customFields в домене — намеренно открытый Record<string,unknown>; типизируем ожидаемые ключи.
    const cf = (t.customFields ?? {}) as { resLabel?: string; kind?: Kind };
    const hasChildren = (childrenByParent.get(t.id)?.length ?? 0) > 0;
    // summary определяется структурой live read-model (parentTaskId), а не только mock customFields/WBS.
    // Веха остаётся листом: если у строки есть дети, summary выигрывает над нулевой длительностью.
    const kind: Kind = hasChildren || cf.kind === "summary" ? "summary" : cf.kind === "milestone" || t.durationMinutes === 0 ? "milestone" : "task";
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
      level: levelOfTask(t.id),
      kind,
      hasChildren,
      mode: t.schedulingMode,
      parentId: t.parentTaskId,
      durDays: t.durationMinutes != null ? Math.round(t.durationMinutes / MIN_PER_DAY) : dayDur,
      pct: t.percentComplete,
      startIso: start,
      finishIso: finish,
      predDisplay,
      predList,
      res: cf.resLabel ?? (assigneeLabel(t.id) || "—"),
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

  const rowsByParent = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const arr = rowsByParent.get(row.parentId) ?? [];
    arr.push(row);
    rowsByParent.set(row.parentId, arr);
  }
  const descendantsOf = (id: string): Row[] => {
    const out: Row[] = [];
    const visit = (parentId: string) => {
      for (const child of rowsByParent.get(parentId) ?? []) {
        out.push(child);
        visit(child.id);
      }
    };
    visit(id);
    return out;
  };

  // полный rollup суммарных задач НА ФРОНТЕ: труд = Σ листьев, % — взвешенно по труду,
  // старт/финиш/длительность = span подзадач. Дерево берём из parentTaskId; WBS — только метка.
  const summariesDesc = rows.filter((r) => r.kind === "summary").sort((a, b) => b.level - a.level);
  for (const s of summariesDesc) {
    const directKids = rowsByParent.get(s.id) ?? [];
    if (directKids.length === 0) continue;
    const leaves = descendantsOf(s.id).filter((r) => r.kind !== "summary");
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
    deadlineDay: project.deadline ? isoToDay(project.deadline) : null,
    projectFinishDay: project.plannedFinish ? isoToDay(project.plannedFinish) : 0
  };
}
