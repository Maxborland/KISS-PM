/* ============================================================
   Contract-grounded mock backend для Project Delivery (Storybook).

   ЧЕСТНОСТЬ: это in-memory мок, а НЕ боевой сервер. Он реализует
   реальный планировочный контракт (форма read-model, команды
   preview→apply, plan-version guard + 409, аудит-превью) так, как его
   отдаёт `apps/api`. Компонент работает через настоящий
   `@kiss-pm/planning-client` (createPlanningApiClient с fetchImpl),
   поэтому переключение на боевой API — это смена apiOrigin, не кода UI.

   Производные данные (calculatedStart/Finish, isCritical, slack,
   каскад) считает ЭТОТ бэкенд (его «движок»), а не компонент —
   ровно как в реальной системе. Правки живут в памяти сессии.
   ============================================================ */

import type { PlanningCommand } from "@kiss-pm/domain";

const MIN_PER_DAY = 480; // 8 рабочих часов = «день» длительности
const PROJECT_START_ISO = "2026-03-02"; // понедельник
const PROJECT_ID = "proj-prod-portal-r2";
const DEFAULT_CALENDAR = "cal-5x8";

type Kind = "summary" | "task" | "milestone";
type Mode = "auto" | "manual";
type DepType = "FS" | "SS" | "FF" | "SF";

type SeedTask = {
  wbs: string;
  title: string;
  kind: Kind;
  mode: Mode;
  durDays: number;
  workH: number;
  pct: number;
  res: string;
  /** для manual задач — авторский старт в днях от старта проекта */
  startDay?: number;
  baseStartDay?: number;
  baseDurDays?: number;
};

type SeedDep = { pred: string; succ: string; type: DepType; lagDays: number };

const SEED: SeedTask[] = [
  { wbs: "1", title: "Подготовка", kind: "summary", mode: "auto", durDays: 0, workH: 312, pct: 100, res: "—" },
  { wbs: "1.1", title: "Согласовать требования", kind: "task", mode: "auto", durDays: 10, workH: 80, pct: 100, res: "Петров А.", baseStartDay: 0, baseDurDays: 9 },
  { wbs: "1.2", title: "Подготовить макеты", kind: "task", mode: "auto", durDays: 14, workH: 112, pct: 100, res: "Иванова М.", baseStartDay: 9, baseDurDays: 12 },
  { wbs: "1.3", title: "Согласовать с клиентом", kind: "milestone", mode: "auto", durDays: 0, workH: 0, pct: 100, res: "Петров А." },
  { wbs: "2", title: "Архитектура и дизайн", kind: "summary", mode: "auto", durDays: 0, workH: 268, pct: 88, res: "—" },
  { wbs: "2.1", title: "Решение по интеграциям", kind: "task", mode: "auto", durDays: 18, workH: 96, pct: 100, res: "Сергеев П." },
  { wbs: "2.2", title: "Контур безопасности", kind: "task", mode: "manual", durDays: 26, workH: 172, pct: 72, res: "Иванова М., +1", startDay: 31, baseStartDay: 31, baseDurDays: 22 },
  { wbs: "3", title: "Реализация MVP", kind: "summary", mode: "auto", durDays: 0, workH: 940, pct: 54, res: "—" },
  { wbs: "3.1", title: "Backend", kind: "summary", mode: "auto", durDays: 0, workH: 520, pct: 64, res: "—" },
  { wbs: "3.1.1", title: "Планировочный движок", kind: "task", mode: "auto", durDays: 39, workH: 312, pct: 92, res: "Сергеев П." },
  { wbs: "3.1.2", title: "Коммиты и права", kind: "task", mode: "auto", durDays: 39, workH: 208, pct: 48, res: "Дмитриев К." },
  { wbs: "3.2", title: "Frontend", kind: "summary", mode: "auto", durDays: 0, workH: 420, pct: 42, res: "—" },
  { wbs: "3.2.1", title: "WBS + Gantt", kind: "task", mode: "auto", durDays: 46, workH: 320, pct: 38, res: "Михаил К.", baseStartDay: 52, baseDurDays: 43 },
  { wbs: "3.2.2", title: "Инспектор задачи", kind: "task", mode: "auto", durDays: 25, workH: 160, pct: 14, res: "Михаил К." },
  { wbs: "3.2.3", title: "Сценарии", kind: "task", mode: "manual", durDays: 25, workH: 120, pct: 0, res: "Лебедева Е.", startDay: 70 },
  { wbs: "4", title: "Тестирование", kind: "summary", mode: "auto", durDays: 0, workH: 240, pct: 10, res: "—" },
  { wbs: "4.1", title: "Функциональное", kind: "task", mode: "auto", durDays: 18, workH: 144, pct: 12, res: "Кузнецов Н." },
  { wbs: "4.2", title: "Нагрузочное", kind: "task", mode: "auto", durDays: 22, workH: 96, pct: 0, res: "Кузнецов Н." }
];

const SEED_DEPS: SeedDep[] = [
  { pred: "1.1", succ: "1.2", type: "FS", lagDays: 0 },
  { pred: "1.2", succ: "1.3", type: "FS", lagDays: 0 },
  { pred: "1.3", succ: "2.1", type: "FS", lagDays: 0 },
  { pred: "2.1", succ: "2.2", type: "SS", lagDays: 2 },
  { pred: "2.1", succ: "3.1.1", type: "FS", lagDays: 0 },
  { pred: "3.1.1", succ: "3.1.2", type: "SS", lagDays: 0 },
  { pred: "3.1.1", succ: "3.2.1", type: "FS", lagDays: 0 },
  { pred: "3.2.1", succ: "3.2.2", type: "SS", lagDays: 0 },
  { pred: "3.2.1", succ: "3.2.3", type: "FS", lagDays: 0 },
  { pred: "3.2", succ: "4.1", type: "FS", lagDays: 0 },
  { pred: "4.1", succ: "4.2", type: "SS", lagDays: 0 }
];

/* Ростер сотрудников (для выпадашки ресурсов) */
export type Resource = { id: string; name: string };
export const RESOURCES: Resource[] = [
  { id: "u-petrov", name: "Петров А." },
  { id: "u-ivanova", name: "Иванова М." },
  { id: "u-sergeev", name: "Сергеев П." },
  { id: "u-dmitriev", name: "Дмитриев К." },
  { id: "u-mikhail", name: "Михаил К." },
  { id: "u-lebedeva", name: "Лебедева Е." },
  { id: "u-kuznetsov", name: "Кузнецов Н." },
  { id: "u-orlova", name: "Орлова Д." },
  { id: "u-fedorov", name: "Фёдоров И." }
];
const resName = (id: string) => RESOURCES.find((r) => r.id === id)?.name ?? id;

const idOf = (wbs: string) => `t-${wbs}`;
const levelOf = (wbs: string) => wbs.split(".").length - 1;

const BASE = Date.UTC(2026, 2, 2);
export function dayToIso(day: number): string {
  return new Date(BASE + day * 86_400_000).toISOString().slice(0, 10);
}
export function isoToDay(iso: string): number {
  const t = Date.parse(iso + "T00:00:00Z");
  return Math.round((t - BASE) / 86_400_000);
}

/* ---- Авторская модель (то, что реально редактируется) ---- */
type Authored = {
  tasks: Array<{
    id: string;
    wbs: string;
    parentTaskId: string | null;
    title: string;
    kind: Kind;
    mode: Mode;
    durDays: number;
    workMinutes: number;
    pct: number;
    res: string;
    startDay: number | null; // авторский старт (manual)
    baseStartDay?: number;
    baseDurDays?: number;
  }>;
  deps: Dep[];
};

type Dep = SeedDep & { id: string };

function freshAuthored(): Authored {
  return {
    tasks: SEED.map((s) => ({
      id: idOf(s.wbs),
      wbs: s.wbs,
      parentTaskId: levelOf(s.wbs) === 0 ? null : idOf(s.wbs.split(".").slice(0, -1).join(".")),
      title: s.title,
      kind: s.kind,
      mode: s.mode,
      durDays: s.durDays,
      workMinutes: s.workH * 60,
      pct: s.pct,
      res: s.res,
      startDay: s.startDay ?? null,
      ...(s.baseStartDay != null ? { baseStartDay: s.baseStartDay } : {}),
      ...(s.baseDurDays != null ? { baseDurDays: s.baseDurDays } : {})
    })),
    // связи храним по СТАБИЛЬНЫМ id (wbs — производный, перенумеровывается при move/create/delete)
    deps: SEED_DEPS.map((d, i) => ({ id: `dep-${i + 1}`, pred: idOf(d.pred), succ: idOf(d.succ), type: d.type, lagDays: d.lagDays }))
  };
}

// Перенумерация wbs по дереву (parentTaskId) в порядке массива — id остаются стабильными
function renumber(a: Authored): void {
  const assign = (parentId: string | null, prefix: string): void => {
    let i = 0;
    for (const t of a.tasks) {
      if (t.parentTaskId !== parentId) continue;
      i += 1;
      t.wbs = prefix ? `${prefix}.${i}` : `${i}`;
      assign(t.id, t.wbs);
    }
  };
  assign(null, "");
}

function cloneAuthored(a: Authored): Authored {
  return { tasks: a.tasks.map((t) => ({ ...t })), deps: a.deps.map((d) => ({ ...d })) };
}

/* ---- «Движок»: forward/backward CPM с FS/SS/FF/SF + lag ---- */
type Calc = { es: number; ef: number; ls: number; slack: number; critical: boolean };

function schedule(a: Authored): Map<string, Calc> {
  const byId = new Map(a.tasks.map((t) => [t.id, t]));
  const leaves = a.tasks.filter((t) => t.kind !== "summary");
  const summaries = a.tasks.filter((t) => t.kind === "summary").sort((x, y) => levelOf(y.wbs) - levelOf(x.wbs));
  const leafDesc = (id: string) => {
    const w = byId.get(id)?.wbs ?? " ";
    return leaves.filter((l) => l.wbs.startsWith(w + "."));
  };

  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const l of leaves) { es.set(l.id, 0); ef.set(l.id, l.durDays); }

  // Резолв summary-эндпоинта в листовой: для finish — самый поздний лист, для start — самый ранний
  const predFinish = (id: string) => {
    const t = byId.get(id);
    if (!t) return 0;
    if (t.kind !== "summary") return ef.get(id) ?? 0;
    const d = leafDesc(id);
    return d.length ? Math.max(...d.map((x) => ef.get(x.id) ?? 0)) : 0;
  };
  const predStart = (id: string) => {
    const t = byId.get(id);
    if (!t) return 0;
    if (t.kind !== "summary") return es.get(id) ?? 0;
    const d = leafDesc(id);
    return d.length ? Math.min(...d.map((x) => es.get(x.id) ?? 0)) : 0;
  };

  const passes = a.tasks.length + 2;
  // forward: ES/EF до сходимости.
  //  - manual: задача жёстко закреплена на startDay (игнорирует связи) — для исключений
  //  - auto: startDay работает как ограничение «не раньше» (SNET); старт = max(ограничение, связи)
  for (let k = 0; k < passes; k++) {
    for (const t of leaves) {
      if (t.mode === "manual") {
        const e = Math.max(0, t.startDay ?? 0);
        es.set(t.id, e);
        ef.set(t.id, e + t.durDays);
        continue;
      }
      let v = t.startDay != null ? t.startDay : 0;
      for (const d of a.deps) {
        if (d.succ !== t.id) continue;
        const predId = d.pred;
        const lag = d.lagDays;
        let cand: number;
        if (d.type === "FS") cand = predFinish(predId) + lag;
        else if (d.type === "SS") cand = predStart(predId) + lag;
        else if (d.type === "FF") cand = predFinish(predId) + lag - t.durDays;
        else cand = predStart(predId) + lag - t.durDays; // SF
        v = Math.max(v, cand);
      }
      const e = Math.max(0, v);
      es.set(t.id, e);
      ef.set(t.id, e + t.durDays);
    }
  }
  const projectEnd = Math.max(0, ...leaves.map((t) => ef.get(t.id) ?? 0));

  // эффективные листовые связи для backward-прохода
  type Eff = { pred: string; succ: string; type: DepType; lag: number };
  const eff: Eff[] = [];
  for (const d of a.deps) {
    const p = byId.get(d.pred);
    const s = byId.get(d.succ);
    if (!p || !s) continue;
    const predLeaf = p.kind !== "summary" ? p.id : leafDesc(p.id).slice().sort((x, y) => (ef.get(y.id) ?? 0) - (ef.get(x.id) ?? 0))[0]?.id;
    const succLeaf = s.kind !== "summary" ? s.id : leafDesc(s.id).slice().sort((x, y) => (es.get(x.id) ?? 0) - (es.get(y.id) ?? 0))[0]?.id;
    if (predLeaf && succLeaf) eff.push({ pred: predLeaf, succ: succLeaf, type: d.type, lag: d.lagDays });
  }
  const hasSucc = new Set(eff.map((e) => e.pred));
  const ls = new Map<string, number>();
  for (const t of leaves) ls.set(t.id, hasSucc.has(t.id) ? Number.POSITIVE_INFINITY : projectEnd - t.durDays);
  for (let k = 0; k < passes; k++) {
    for (const e of eff) {
      const p = byId.get(e.pred);
      const s = byId.get(e.succ);
      if (!p || !s) continue;
      const lsS = ls.get(e.succ);
      if (lsS == null || !Number.isFinite(lsS)) continue;
      const pd = p.durDays;
      const sd = s.durDays;
      let bound: number;
      if (e.type === "FS") bound = lsS - pd - e.lag;
      else if (e.type === "SS") bound = lsS - e.lag;
      else if (e.type === "FF") bound = lsS + sd - pd - e.lag;
      else bound = lsS + sd - e.lag; // SF
      ls.set(e.pred, Math.min(ls.get(e.pred) ?? Number.POSITIVE_INFINITY, bound));
    }
  }

  const out = new Map<string, Calc>();
  for (const t of leaves) {
    const e = es.get(t.id) ?? 0;
    const lsv = Number.isFinite(ls.get(t.id) ?? Infinity) ? (ls.get(t.id) as number) : e;
    const slack = lsv - e;
    out.set(t.id, { es: e, ef: ef.get(t.id) ?? e, ls: lsv, slack, critical: slack <= 0.001 });
  }
  for (const s of summaries) {
    const cs = leafDesc(s.id).map((k) => out.get(k.id)).filter(Boolean) as Calc[];
    if (cs.length === 0) { out.set(s.id, { es: 0, ef: 0, ls: 0, slack: 0, critical: false }); continue; }
    out.set(s.id, { es: Math.min(...cs.map((c) => c.es)), ef: Math.max(...cs.map((c) => c.ef)), ls: 0, slack: 0, critical: false });
  }
  return out;
}

/* ---- Построение read-model в реальной форме контракта ---- */
function buildReadModel(a: Authored, planVersion: number): Record<string, unknown> {
  const calc = schedule(a);
  const projectFinish = Math.max(0, ...a.tasks.filter((t) => t.kind !== "summary").map((t) => calc.get(t.id)?.ef ?? 0));

  // rollup суммарных задач: труд = сумма листьев, % — взвешенно по труду
  const leavesUnder = (wbs: string) => a.tasks.filter((x) => x.kind !== "summary" && x.wbs.startsWith(wbs + "."));
  const rollWork = (wbs: string) => leavesUnder(wbs).reduce((s, x) => s + x.workMinutes, 0);
  const rollPct = (wbs: string) => {
    const ks = leavesUnder(wbs);
    if (ks.length === 0) return 0;
    const w = ks.reduce((s, x) => s + x.workMinutes, 0);
    return w > 0 ? Math.round(ks.reduce((s, x) => s + x.workMinutes * x.pct, 0) / w) : Math.round(ks.reduce((s, x) => s + x.pct, 0) / ks.length);
  };

  const tasks = a.tasks.map((t) => {
    const c = calc.get(t.id)!;
    return {
      id: t.id,
      parentTaskId: t.parentTaskId,
      wbsCode: t.wbs,
      title: t.title,
      statusId: t.pct >= 100 ? "done" : t.pct > 0 ? "in_progress" : "todo",
      schedulingMode: t.mode,
      taskType: "fixed_duration" as const,
      effortDriven: false,
      plannedStart: dayToIso(c.es),
      plannedFinish: dayToIso(c.ef),
      durationMinutes: t.kind === "summary" ? null : t.durDays * MIN_PER_DAY,
      workMinutes: t.kind === "summary" ? rollWork(t.wbs) : t.workMinutes,
      percentComplete: t.kind === "summary" ? rollPct(t.wbs) : t.pct,
      calendarId: DEFAULT_CALENDAR,
      customFields: { resLabel: t.res, kind: t.kind },
      constraint: null
    };
  });

  const calculatedTasks = a.tasks.map((t) => {
    const c = calc.get(t.id)!;
    return {
      id: t.id,
      calculatedStart: dayToIso(c.es),
      calculatedFinish: dayToIso(c.ef),
      earliestStart: dayToIso(c.es),
      earliestFinish: dayToIso(c.ef),
      latestStart: dayToIso(c.ls),
      latestFinish: dayToIso(c.ls + (t.kind === "summary" ? 0 : t.durDays)),
      totalSlackMinutes: t.kind === "summary" ? null : Math.round(c.slack * MIN_PER_DAY),
      isCritical: c.critical
    };
  });

  const dependencies = a.deps.map((d) => ({
    id: d.id,
    predecessorTaskId: d.pred,
    successorTaskId: d.succ,
    type: d.type,
    lagMinutes: d.lagDays * MIN_PER_DAY
  }));

  const baselineTasks = a.tasks
    .filter((t) => t.baseStartDay != null && t.baseDurDays != null)
    .map((t) => ({
      taskId: t.id,
      baselineStart: dayToIso(t.baseStartDay!),
      baselineFinish: dayToIso(t.baseStartDay! + t.baseDurDays!),
      baselineWorkMinutes: t.workMinutes,
      currentStart: dayToIso(calc.get(t.id)!.es),
      currentFinish: dayToIso(calc.get(t.id)!.ef),
      currentWorkMinutes: t.workMinutes,
      startDeltaDays: calc.get(t.id)!.es - t.baseStartDay!,
      finishDeltaDays: calc.get(t.id)!.ef - (t.baseStartDay! + t.baseDurDays!),
      workDeltaMinutes: 0
    }));

  const validationIssues = a.tasks
    .filter((t) => t.mode === "manual")
    .map((t) => ({
      code: "schedule_outside_project_bounds",
      severity: "warning" as const,
      message: `Ручной режим: ${t.title} не пересчитывается автоматически`,
      entity: { type: "task", id: t.id }
    }));

  return {
    project: {
      id: PROJECT_ID,
      sourceType: "opportunity",
      sourceOpportunityId: "opp-2207",
      plannedStart: PROJECT_START_ISO,
      plannedFinish: dayToIso(projectFinish),
      deadline: "2026-07-12",
      calendarId: DEFAULT_CALENDAR
    },
    authored: { tasks, dependencies, assignments: [], assignmentAllocations: [], baselines: [] },
    calculatedPlan: {
      tenantId: "tenant-alpha",
      projectId: PROJECT_ID,
      planVersion,
      engineVersion: "planning-core-v1",
      calculatedAt: "2026-06-22T09:00:00.000Z",
      tasks: calculatedTasks,
      dependencies: dependencies.map((d) => ({ ...d, valid: true, issueCodes: [] })),
      projectFinish: dayToIso(projectFinish),
      criticalPathTaskIds: a.tasks.filter((t) => calc.get(t.id)?.critical).map((t) => t.id),
      criticalPath: { taskIds: a.tasks.filter((t) => calc.get(t.id)?.critical).map((t) => t.id) },
      scheduleTrace: [],
      validationIssues
    },
    baselineComparison: {
      baselineId: "baseline-b2",
      capturedAt: "2026-05-20T08:00:00.000Z",
      tasks: baselineTasks
    },
    resourceLoad: { buckets: [], overloads: [], freeCapacityBuckets: [] },
    validationIssues,
    planVersion,
    engineVersion: "planning-core-v1"
  };
}

/* ---- Применение поддерживаемых команд к авторской модели ---- */
type CmdIssue = { code: string; message: string; entityId: string | null };
function applyCommand(a: Authored, command: PlanningCommand): { ok: boolean; changedTaskIds: string[]; error?: string; issue?: CmdIssue } {
  const cmd = command as { type: string; payload: Record<string, unknown> };
  const find = (id: string) => a.tasks.find((t) => t.id === id);
  switch (cmd.type) {
    case "task.update_work_model": {
      const t = find(cmd.payload.taskId as string);
      if (!t) return { ok: false, changedTaskIds: [], error: "task_not_found" };
      const dm = cmd.payload.durationMinutes as number | null;
      if (dm != null) t.durDays = Math.max(0, Math.round(dm / MIN_PER_DAY));
      if (typeof cmd.payload.workMinutes === "number") t.workMinutes = cmd.payload.workMinutes;
      return { ok: true, changedTaskIds: [t.id] };
    }
    case "task.update_schedule": {
      const t = find(cmd.payload.taskId as string);
      if (!t) return { ok: false, changedTaskIds: [], error: "task_not_found" };
      const ps = cmd.payload.plannedStart as string | null;
      const pf = cmd.payload.plannedFinish as string | null;
      // дата = ограничение «не раньше», режим НЕ меняем (авто остаётся авто)
      if (ps) t.startDay = isoToDay(ps);
      if (ps && pf) {
        const newDur = Math.max(0, isoToDay(pf) - isoToDay(ps));
        // длительность меняется → трудозатраты пересчитываются (единицы/день сохраняются)
        const workPerDay = t.durDays > 0 ? t.workMinutes / t.durDays : MIN_PER_DAY;
        t.workMinutes = Math.round(newDur * workPerDay);
        t.durDays = newDur;
      }
      return { ok: true, changedTaskIds: [t.id] };
    }
    case "task.update_progress": {
      const t = find(cmd.payload.taskId as string);
      if (!t) return { ok: false, changedTaskIds: [], error: "task_not_found" };
      t.pct = Math.max(0, Math.min(100, cmd.payload.percentComplete as number));
      return { ok: true, changedTaskIds: [t.id] };
    }
    case "task.update_identity": {
      const t = find(cmd.payload.taskId as string);
      if (!t) return { ok: false, changedTaskIds: [], error: "task_not_found" };
      t.title = String(cmd.payload.title ?? t.title);
      return { ok: true, changedTaskIds: [t.id] };
    }
    case "assignment.upsert": {
      const t = find(cmd.payload.taskId as string);
      if (!t) return { ok: false, changedTaskIds: [], error: "task_not_found" };
      const name = resName(String(cmd.payload.resourceId));
      const units = (cmd.payload.unitsPermille as number) ?? 1000;
      t.res = units !== 1000 ? `${name} · ${Math.round(units / 10)}%` : name;
      return { ok: true, changedTaskIds: [t.id] };
    }
    case "dependency.upsert": {
      const p = cmd.payload;
      const predId = String(p.predecessorTaskId);
      const succId = String(p.successorTaskId);
      const wbsById = (tid: string) => a.tasks.find((t) => t.id === tid)?.wbs ?? tid;
      if (predId === succId) return { ok: false, changedTaskIds: [], error: "self_dependency", issue: { code: "self_dependency", message: "Задача не может зависеть от себя", entityId: succId } };
      // цикл: достижим ли predId из succId по существующим связям (pred→succ)?
      const adj = new Map<string, string[]>();
      for (const d of a.deps) { const arr = adj.get(d.pred) ?? []; arr.push(d.succ); adj.set(d.pred, arr); }
      const seen = new Set<string>();
      const stack = [succId];
      while (stack.length) {
        const cur = stack.pop()!;
        if (cur === predId) return { ok: false, changedTaskIds: [], error: "dependency_cycle_detected", issue: { code: "dependency_cycle_detected", message: `Цикл зависимостей: «${wbsById(succId)}» уже предшествует «${wbsById(predId)}»`, entityId: succId } };
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const n of adj.get(cur) ?? []) stack.push(n);
      }
      const id = String(p.id);
      const type = p.dependencyType as DepType;
      const lagDays = Math.round(((p.lagMinutes as number) ?? 0) / MIN_PER_DAY);
      const existing = a.deps.find((d) => d.id === id);
      if (existing) { existing.pred = predId; existing.succ = succId; existing.type = type; existing.lagDays = lagDays; }
      else a.deps.push({ id, pred: predId, succ: succId, type, lagDays });
      return { ok: true, changedTaskIds: [succId] };
    }
    case "dependency.delete": {
      const id = String(cmd.payload.dependencyId);
      const dep = a.deps.find((d) => d.id === id);
      a.deps = a.deps.filter((d) => d.id !== id);
      return { ok: true, changedTaskIds: dep ? [dep.succ] : [] };
    }
    case "task.create": {
      const p = cmd.payload;
      const id = String(p.id);
      const parentId = (p.parentTaskId as string | null) ?? null;
      const dm = p.durationMinutes as number | null;
      const durDays = dm != null ? Math.max(0, Math.round(dm / MIN_PER_DAY)) : 5;
      let wbs: string;
      let insertAt: number;
      if (parentId) {
        const parent = find(parentId);
        if (!parent) return { ok: false, changedTaskIds: [], error: "parent_not_found" };
        const childCount = a.tasks.filter((t) => t.parentTaskId === parentId).length;
        wbs = `${parent.wbs}.${childCount + 1}`;
        const descendants = a.tasks.filter((t) => t.wbs.startsWith(parent.wbs + "."));
        const lastDesc = descendants[descendants.length - 1] ?? parent;
        insertAt = a.tasks.indexOf(lastDesc) + 1;
        parent.kind = "summary";
      } else {
        wbs = `${a.tasks.filter((t) => t.parentTaskId === null).length + 1}`;
        insertAt = a.tasks.length;
      }
      a.tasks.splice(insertAt, 0, {
        id,
        wbs,
        parentTaskId: parentId,
        title: String(p.title ?? "Новая задача"),
        kind: "task",
        mode: "auto",
        durDays,
        workMinutes: typeof p.workMinutes === "number" ? p.workMinutes : durDays * MIN_PER_DAY,
        pct: 0,
        res: "—",
        startDay: null
      });
      renumber(a);
      return { ok: true, changedTaskIds: [id] };
    }
    case "task.delete_or_archive": {
      const t = find(cmd.payload.taskId as string);
      if (!t) return { ok: false, changedTaskIds: [], error: "task_not_found" };
      const ids = new Set([t.id, ...a.tasks.filter((x) => x.wbs.startsWith(t.wbs + ".")).map((x) => x.id)]);
      a.tasks = a.tasks.filter((x) => !ids.has(x.id));
      a.deps = a.deps.filter((d) => !ids.has(d.pred) && !ids.has(d.succ));
      renumber(a);
      return { ok: true, changedTaskIds: [] };
    }
    case "task.move_wbs": {
      const t = find(cmd.payload.taskId as string);
      if (!t) return { ok: false, changedTaskIds: [], error: "task_not_found" };
      const newParent = (cmd.payload.parentTaskId as string | null) ?? null;
      const subtree = new Set([t.id, ...a.tasks.filter((x) => x.wbs.startsWith(t.wbs + ".")).map((x) => x.id)]);
      if (newParent && subtree.has(newParent)) return { ok: false, changedTaskIds: [], error: "into_descendant", issue: { code: "invalid_move", message: "Нельзя вложить задачу в собственную подзадачу", entityId: t.id } };
      const block = a.tasks.filter((x) => subtree.has(x.id));
      const rest = a.tasks.filter((x) => !subtree.has(x.id));
      let idx = rest.length;
      if (newParent) {
        const parent = rest.find((x) => x.id === newParent);
        if (!parent) return { ok: false, changedTaskIds: [], error: "parent_not_found" };
        parent.kind = "summary";
        const descs = rest.filter((x) => x.wbs.startsWith(parent.wbs + "."));
        const anchor = descs.length ? descs[descs.length - 1]! : parent;
        idx = rest.indexOf(anchor) + 1;
      }
      t.parentTaskId = newParent;
      rest.splice(idx, 0, ...block);
      a.tasks = rest;
      renumber(a);
      // пустые summary (без детей) → обычная задача
      for (const s of a.tasks) {
        if (s.kind === "summary" && !a.tasks.some((x) => x.parentTaskId === s.id)) { s.kind = "task"; if (s.durDays === 0) s.durDays = 5; }
      }
      return { ok: true, changedTaskIds: [t.id] };
    }
    default:
      return { ok: false, changedTaskIds: [], error: "command_not_supported_in_prototype" };
  }
}

const AUDIT_ACTION: Record<string, string> = {
  "task.create": "planning.task.created",
  "task.update_identity": "planning.task.updated",
  "task.update_schedule": "planning.task.updated",
  "task.update_work_model": "planning.task.updated",
  "task.update_progress": "planning.task.updated",
  "task.delete_or_archive": "planning.task.deleted",
  "task.move_wbs": "planning.task.updated",
  "dependency.upsert": "planning.dependency.upserted",
  "dependency.delete": "planning.dependency.deleted",
  "assignment.upsert": "planning.assignment.upserted"
};

function changedByCascade(before: Authored, after: Authored): string[] {
  const cb = schedule(before);
  const ca = schedule(after);
  const ids: string[] = [];
  for (const t of after.tasks) {
    const b = cb.get(t.id);
    const c = ca.get(t.id);
    if (!b || !c) continue;
    if (b.es !== c.es || b.ef !== c.ef || b.critical !== c.critical) ids.push(t.id);
  }
  return ids;
}

/* ---- Транспорт: fetchImpl, совместимый с createPlanningApiClient ---- */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function createMockPlanningFetch(): typeof fetch {
  let authored = freshAuthored();
  let planVersion = 17;

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "");

    if (method === "GET" && /\/planning\/read-model$/.test(path)) {
      return json(buildReadModel(authored, planVersion));
    }

    const isPreview = method === "POST" && /\/planning\/preview-command$/.test(path);
    const isApply = method === "POST" && /\/planning\/apply-command$/.test(path);
    if (isPreview || isApply) {
      const reqBody = init?.body ? (JSON.parse(String(init.body)) as { command: PlanningCommand; clientPlanVersion: number }) : null;
      if (!reqBody) return json({ error: "validation_error" }, 400);
      if (reqBody.clientPlanVersion !== planVersion) {
        return json({ error: "plan_version_conflict", currentPlanVersion: planVersion }, 409);
      }
      const before = cloneAuthored(authored);
      const after = cloneAuthored(authored);
      const res = applyCommand(after, reqBody.command);
      if (!res.ok) {
        const issue = res.issue ?? { code: "planning_command_invalid", message: res.error ?? "invalid", entityId: null };
        return json({ error: "planning_precondition_failed", validationIssues: [{ code: issue.code, severity: "error", message: issue.message, entity: issue.entityId ? { type: "task", id: issue.entityId } : null }] }, 409);
      }
      const changed = Array.from(new Set([...res.changedTaskIds, ...changedByCascade(before, after)]));

      if (isPreview) {
        return json({
          before: buildReadModel(before, planVersion),
          after: buildReadModel(after, planVersion + 1),
          planDelta: { changedTaskIds: changed, changedAssignmentIds: [], changedDependencyIds: [] },
          validationIssues: [],
          permissionPreview: { allowed: true, reason: "manage_project_plan" },
          auditPreview: { actionType: AUDIT_ACTION[reqBody.command.type] ?? "planning.command.applied", sourceWorkflow: "planning", planVersionBefore: planVersion, planVersionAfter: planVersion + 1 }
        });
      }
      // apply
      authored = after;
      planVersion += 1;
      return json({
        applied: { changedTaskIds: changed, changedAssignmentIds: [], changedDependencyIds: [] },
        newPlanVersion: planVersion,
        auditEventId: `audit-${planVersion}`,
        readModel: buildReadModel(authored, planVersion)
      });
    }

    if (method === "POST" && /\/planning\/apply-command-batch$/.test(path)) {
      const reqBody = init?.body ? (JSON.parse(String(init.body)) as { commands: PlanningCommand[]; clientPlanVersion: number }) : null;
      if (!reqBody) return json({ error: "validation_error" }, 400);
      if (reqBody.clientPlanVersion !== planVersion) return json({ error: "plan_version_conflict", currentPlanVersion: planVersion }, 409);
      const before = cloneAuthored(authored);
      const after = cloneAuthored(authored);
      const allChanged = new Set<string>();
      for (const command of reqBody.commands) {
        const r = applyCommand(after, command);
        if (!r.ok) {
          const issue = r.issue ?? { code: "planning_command_invalid", message: r.error ?? "invalid", entityId: null };
          return json({ error: "planning_precondition_failed", validationIssues: [{ code: issue.code, severity: "error", message: issue.message, entity: issue.entityId ? { type: "task", id: issue.entityId } : null }] }, 409);
        }
        r.changedTaskIds.forEach((cid) => allChanged.add(cid));
      }
      changedByCascade(before, after).forEach((cid) => allChanged.add(cid));
      authored = after;
      planVersion += 1;
      return json({ applied: { changedTaskIds: [...allChanged], changedAssignmentIds: [], changedDependencyIds: [] }, newPlanVersion: planVersion, auditEventId: `audit-${planVersion}`, readModel: buildReadModel(authored, planVersion) });
    }

    return json({ error: "not_found" }, 404);
  };

  return mockFetch;
}

export const MOCK_PROJECT_ID = PROJECT_ID;
export { MIN_PER_DAY, PROJECT_START_ISO };
