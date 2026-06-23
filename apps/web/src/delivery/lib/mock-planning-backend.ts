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

/* Ростер: роль (position) + команда (team) + дневная ёмкость */
export type Resource = { id: string; name: string; positionId: string; positionName: string; teamId: string; teamName: string; capacityMinPerDay: number };
export const RESOURCES: Resource[] = [
  { id: "u-petrov", name: "Петров А.", positionId: "pm", positionName: "Менеджер проекта", teamId: "team-core", teamName: "Управление", capacityMinPerDay: 480 },
  { id: "u-ivanova", name: "Иванова М.", positionId: "design", positionName: "Дизайнер", teamId: "team-product", teamName: "Продукт", capacityMinPerDay: 480 },
  { id: "u-orlova", name: "Орлова Д.", positionId: "design", positionName: "Дизайнер", teamId: "team-product", teamName: "Продукт", capacityMinPerDay: 480 },
  { id: "u-lebedeva", name: "Лебедева Е.", positionId: "analyst", positionName: "Аналитик", teamId: "team-product", teamName: "Продукт", capacityMinPerDay: 480 },
  { id: "u-sergeev", name: "Сергеев П.", positionId: "backend", positionName: "Backend-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 },
  { id: "u-dmitriev", name: "Дмитриев К.", positionId: "backend", positionName: "Backend-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 },
  { id: "u-fedorov", name: "Фёдоров И.", positionId: "backend", positionName: "Backend-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 },
  { id: "u-mikhail", name: "Михаил К.", positionId: "frontend", positionName: "Frontend-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 },
  { id: "u-kuznetsov", name: "Кузнецов Н.", positionId: "qa", positionName: "QA-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 }
];
const resName = (id: string) => RESOURCES.find((r) => r.id === id)?.name ?? id;
const resOf = (id: string) => RESOURCES.find((r) => r.id === id);
const nameToId = new Map(RESOURCES.map((r) => [r.name, r.id]));

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
  assignments: AssignmentA[];
  reservations: ReservationA[];
  exceptions: ExceptionA[];
  acceptedOverloads: string[]; // ключи "resourceId|day"
};

type Dep = SeedDep & { id: string };
type AssignmentA = { id: string; taskId: string; resourceId: string; role: string; unitsPermille: number; workMinutes: number };
type ReservationA = { id: string; resourceId: string; startDay: number; finishDay: number; workMinutesPerDay: number; reason: string };
type ExceptionA = { id: string; resourceId: string; day: number; workingMinutes: number; reason: string };

// Сборка авторской модели из сидов (используется и основным проектом, и портфельными)
function seedToAuthored(seedTasks: SeedTask[], seedDeps: SeedDep[], exceptions: ExceptionA[] = []): Authored {
  return {
    tasks: seedTasks.map((s) => ({
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
    deps: seedDeps.map((d, i) => ({ id: `dep-${i + 1}`, pred: idOf(d.pred), succ: idOf(d.succ), type: d.type, lagDays: d.lagDays })),
    // назначения из ростера (исполнитель = первое имя в res); грузят ресурсную матрицу
    assignments: seedTasks.filter((s) => s.kind === "task" && s.res !== "—" && nameToId.has(s.res.split(",")[0]!.trim())).map((s, i) => ({
      id: `a-${i + 1}`,
      taskId: idOf(s.wbs),
      resourceId: nameToId.get(s.res.split(",")[0]!.trim())!,
      role: "executor",
      unitsPermille: 1000,
      workMinutes: s.workH * 60
    })),
    reservations: [],
    exceptions,
    acceptedOverloads: []
  };
}

function freshAuthored(): Authored {
  return seedToAuthored(SEED, SEED_DEPS, [
    { id: "ex-1", resourceId: "u-ivanova", day: 31, workingMinutes: 0, reason: "Отпуск" },
    { id: "ex-2", resourceId: "u-ivanova", day: 32, workingMinutes: 0, reason: "Отпуск" },
    { id: "ex-3", resourceId: "u-ivanova", day: 33, workingMinutes: 0, reason: "Отпуск" }
  ]);
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
  return {
    tasks: a.tasks.map((t) => ({ ...t })),
    deps: a.deps.map((d) => ({ ...d })),
    assignments: a.assignments.map((x) => ({ ...x })),
    reservations: a.reservations.map((x) => ({ ...x })),
    exceptions: a.exceptions.map((x) => ({ ...x })),
    acceptedOverloads: [...a.acceptedOverloads]
  };
}

// Префиксует id задач/связей/назначений именем проекта — чтобы одинаковые WBS
// в разных проектах портфеля не сталкивались (t-1 есть в каждом проекте).
function namespaceAuthored(a: Authored, pfx: string): Authored {
  const nid = (id: string | null) => (id == null ? null : pfx + id);
  return {
    tasks: a.tasks.map((t) => ({ ...t, id: pfx + t.id, parentTaskId: nid(t.parentTaskId) })),
    deps: a.deps.map((d) => ({ ...d, id: pfx + d.id, pred: pfx + d.pred, succ: pfx + d.succ })),
    assignments: a.assignments.map((x) => ({ ...x, id: pfx + x.id, taskId: pfx + x.taskId })),
    reservations: a.reservations.map((x) => ({ ...x, id: pfx + x.id })),
    exceptions: a.exceptions.map((x) => ({ ...x, id: pfx + x.id })),
    acceptedOverloads: [...a.acceptedOverloads]
  };
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

/* ---- Движок ресурсной загрузки → ResourceLoadMatrix (день/неделя/месяц) ---- */
type LoadBucket = {
  resourceId: string; positionId: string | null; teamId: string | null; projectId: string;
  date: string; granularity: "day" | "week" | "month";
  assignedMinutes: number; reservedMinutes: number; occupiedMinutes: number; capacityMinutes: number; freeMinutes: number;
  taskIds: string[]; assignmentIds: string[];
  assignmentContributions: Array<{ taskId: string; assignmentId: string; workMinutes: number }>;
  reservationContributions: Array<{ reservationId: string; workMinutes: number }>;
  occupancyContributions: Array<{ occupancyId: string; sourceType: string; sourceId: string; workMinutes: number }>;
  reservationIds: string[]; occupancyIds: string[]; calendarExceptionIds: string[];
};

function buildResourceLoad(a: Authored, calc: Map<string, Calc>, projectId: string = PROJECT_ID) {
  const dow = (day: number) => new Date(BASE + day * 86_400_000).getUTCDay();
  const isWeekday = (day: number) => { const d = dow(day); return d >= 1 && d <= 5; };
  const lastDay = Math.max(34, ...a.tasks.filter((t) => t.kind !== "summary").map((t) => calc.get(t.id)?.ef ?? 0));

  // часы/день = work / календарные дни интервала; начисляем ТОЛЬКО в будни (на выходных нагрузки нет).
  // даёт ~8 ч/день (≈100%) для обычной задачи; перегруз — только на реальных пересечениях задач у ресурса.
  const asgPerDay = new Map<string, { es: number; ef: number; taskId: string; resourceId: string; per: number }>();
  for (const asg of a.assignments) {
    const c = calc.get(asg.taskId);
    if (!c) continue;
    asgPerDay.set(asg.id, { es: c.es, ef: c.ef, taskId: asg.taskId, resourceId: asg.resourceId, per: Math.round((asg.workMinutes * (asg.unitsPermille / 1000)) / Math.max(1, c.ef - c.es)) });
  }

  const dayBuckets: LoadBucket[] = [];
  for (const r of RESOURCES) {
    for (let day = 0; day <= lastDay; day++) {
      const exc = a.exceptions.find((e) => e.resourceId === r.id && e.day === day);
      const capacityMinutes = exc ? exc.workingMinutes : isWeekday(day) ? r.capacityMinPerDay : 0;
      let assigned = 0;
      const aIds: string[] = []; const tIds: string[] = []; const aContribs: LoadBucket["assignmentContributions"] = [];
      if (isWeekday(day)) {
        for (const [aid, info] of asgPerDay) {
          if (info.resourceId !== r.id || day < info.es || day >= info.ef || info.per <= 0) continue;
          assigned += info.per; aIds.push(aid); tIds.push(info.taskId); aContribs.push({ taskId: info.taskId, assignmentId: aid, workMinutes: info.per });
        }
      }
      let reserved = 0;
      const rIds: string[] = []; const rContribs: LoadBucket["reservationContributions"] = [];
      for (const rv of a.reservations) {
        if (rv.resourceId !== r.id || day < rv.startDay || day > rv.finishDay || !isWeekday(day)) continue;
        reserved += rv.workMinutesPerDay; rIds.push(rv.id); rContribs.push({ reservationId: rv.id, workMinutes: rv.workMinutesPerDay });
      }
      const occContribs: LoadBucket["occupancyContributions"] = [];
      const excIds: string[] = [];
      if (exc) { excIds.push(exc.id); occContribs.push({ occupancyId: exc.id, sourceType: "absence", sourceId: exc.id, workMinutes: r.capacityMinPerDay }); }
      const committed = assigned + reserved;
      dayBuckets.push({
        resourceId: r.id, positionId: r.positionId, teamId: r.teamId, projectId, date: dayToIso(day), granularity: "day",
        assignedMinutes: assigned, reservedMinutes: reserved, occupiedMinutes: 0, capacityMinutes, freeMinutes: Math.max(0, capacityMinutes - committed),
        taskIds: tIds, assignmentIds: aIds, assignmentContributions: aContribs, reservationContributions: rContribs, occupancyContributions: occContribs, reservationIds: rIds, occupancyIds: [], calendarExceptionIds: excIds
      });
    }
  }

  const weekStart = (day: number) => { const d = dow(day); return day - (d === 0 ? 6 : d - 1); };
  const monthStart = (day: number) => { const dt = new Date(BASE + day * 86_400_000); return Math.round((Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1) - BASE) / 86_400_000); };
  const agg = (gran: "week" | "month", keyFn: (day: number) => number): LoadBucket[] => {
    const map = new Map<string, LoadBucket>();
    for (const b of dayBuckets) {
      const periodStart = keyFn(isoToDay(b.date));
      const key = `${b.resourceId}|${periodStart}`;
      let bk = map.get(key);
      if (!bk) { bk = { ...b, date: dayToIso(periodStart), granularity: gran, assignedMinutes: 0, reservedMinutes: 0, occupiedMinutes: 0, capacityMinutes: 0, freeMinutes: 0, taskIds: [], assignmentIds: [], assignmentContributions: [], reservationContributions: [], occupancyContributions: [], reservationIds: [], occupancyIds: [], calendarExceptionIds: [] }; map.set(key, bk); }
      bk.assignedMinutes += b.assignedMinutes; bk.reservedMinutes += b.reservedMinutes; bk.occupiedMinutes += b.occupiedMinutes; bk.capacityMinutes += b.capacityMinutes;
      bk.taskIds.push(...b.taskIds); bk.assignmentIds.push(...b.assignmentIds); bk.assignmentContributions.push(...b.assignmentContributions); bk.reservationContributions.push(...b.reservationContributions); bk.occupancyContributions.push(...b.occupancyContributions); bk.reservationIds.push(...b.reservationIds); bk.calendarExceptionIds.push(...b.calendarExceptionIds);
    }
    for (const bk of map.values()) bk.freeMinutes = Math.max(0, bk.capacityMinutes - bk.assignedMinutes - bk.reservedMinutes - bk.occupiedMinutes);
    return [...map.values()];
  };

  const buckets = [...dayBuckets, ...agg("week", weekStart), ...agg("month", monthStart)];
  const overloads = dayBuckets
    .filter((b) => b.assignedMinutes + b.reservedMinutes + b.occupiedMinutes > b.capacityMinutes)
    .map((b) => ({ ...b, overloadMinutes: b.assignedMinutes + b.reservedMinutes + b.occupiedMinutes - b.capacityMinutes, reasons: [...b.taskIds.map((id) => ({ type: "task", id })), ...b.reservationIds.map((id) => ({ type: "reservation", id }))] }));
  return { buckets, overloads, freeCapacityBuckets: dayBuckets.filter((b) => b.freeMinutes > 0), acceptedOverloads: a.acceptedOverloads };
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
    authored: {
      tasks,
      dependencies,
      assignments: a.assignments.map((x) => ({ id: x.id, taskId: x.taskId, resourceId: x.resourceId, role: x.role, unitsPermille: x.unitsPermille, workMinutes: x.workMinutes, calendarId: null })),
      assignmentAllocations: [],
      baselines: []
    },
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
    resourceLoad: buildResourceLoad(a, calc),
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
      const p = cmd.payload;
      const taskId = String(p.taskId);
      const t = find(taskId);
      if (!t) return { ok: false, changedTaskIds: [], error: "task_not_found" };
      const id = p.id ? String(p.id) : "";
      const resourceId = String(p.resourceId);
      const units = (p.unitsPermille as number) ?? 1000;
      const wm = p.workMinutes == null ? null : (p.workMinutes as number);
      let asg = id ? a.assignments.find((x) => x.id === id) : undefined;
      if (!asg && wm == null) asg = a.assignments.find((x) => x.taskId === taskId); // смена ресурса из грида
      if (asg) {
        asg.resourceId = resourceId;
        asg.unitsPermille = units;
        if (wm != null) asg.workMinutes = wm;
      } else {
        a.assignments.push({ id: id || `a-${a.assignments.length + 1}`, taskId, resourceId, role: String(p.role ?? "executor"), unitsPermille: units, workMinutes: wm ?? t.workMinutes });
      }
      const primary = a.assignments.find((x) => x.taskId === taskId);
      if (primary) { const nm = resName(primary.resourceId); t.res = primary.unitsPermille !== 1000 ? `${nm} · ${Math.round(primary.unitsPermille / 10)}%` : nm; }
      return { ok: true, changedTaskIds: [t.id] };
    }
    case "resource.reserve": {
      const p = cmd.payload;
      const id = String(p.id);
      const start = isoToDay(String(p.start));
      const finish = isoToDay(String(p.finish));
      const total = (p.workMinutes as number) ?? 0;
      const perDay = Math.max(0, Math.round(total / Math.max(1, finish - start + 1)));
      const existing = a.reservations.find((x) => x.id === id);
      if (existing) { existing.resourceId = String(p.resourceId); existing.startDay = start; existing.finishDay = finish; existing.workMinutesPerDay = perDay; existing.reason = String(p.reason ?? ""); }
      else a.reservations.push({ id, resourceId: String(p.resourceId), startDay: start, finishDay: finish, workMinutesPerDay: perDay, reason: String(p.reason ?? "") });
      return { ok: true, changedTaskIds: [] };
    }
    case "calendar.exception.upsert": {
      const p = cmd.payload;
      const resourceId = p.resourceId == null ? null : String(p.resourceId);
      if (!resourceId) return { ok: false, changedTaskIds: [], error: "resource_required", issue: { code: "resource_required", message: "Для отсутствия нужен сотрудник", entityId: null } };
      const id = String(p.id);
      const existing = a.exceptions.find((x) => x.id === id);
      const day = isoToDay(String(p.date));
      const workingMinutes = (p.workingMinutes as number) ?? 0;
      const reason = String(p.reason ?? "");
      if (existing) { existing.resourceId = resourceId; existing.day = day; existing.workingMinutes = workingMinutes; existing.reason = reason; }
      else a.exceptions.push({ id, resourceId, day, workingMinutes, reason });
      return { ok: true, changedTaskIds: [] };
    }
    case "risk.accept_overload": {
      const key = String(cmd.payload.overloadId);
      if (!a.acceptedOverloads.includes(key)) a.acceptedOverloads.push(key);
      return { ok: true, changedTaskIds: [] };
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
  "assignment.upsert": "planning.assignment.upserted",
  "resource.reserve": "planning.resource_reserved",
  "calendar.exception.upsert": "planning.calendar_exception.upserted",
  "risk.accept_overload": "planning.overload_risk_accepted"
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

/* ============================================================
   ПОРТФЕЛЬ: тот же контракт загрузки на уровне команды/компании.
   Тот же движок, но по нескольким проектам. КЛЮЧЕВОЕ: ёмкость
   человека в день — глобальная (берётся ОДИН раз), а назначения
   СУММИРУЮТСЯ по проектам → виден межпроектный перегруз, которого
   не видно внутри одного проекта. Снимок in-memory, read-only.
   ============================================================ */

export type PortfolioProject = { id: string; name: string; code: string };
type ProjSeed = PortfolioProject & { tasks: SeedTask[]; deps: SeedDep[] };

const PORTFOLIO_SEEDS: ProjSeed[] = [
  { id: PROJECT_ID, name: "Производственный портал · Релиз 2", code: "ПР", tasks: SEED, deps: SEED_DEPS },
  {
    id: "proj-mobile-mvp", name: "Мобильное приложение · MVP", code: "МП",
    tasks: [
      { wbs: "1", title: "Дизайн экранов", kind: "task", mode: "auto", durDays: 18, workH: 120, pct: 60, res: "Иванова М." },
      { wbs: "2", title: "Мобильный фронт", kind: "task", mode: "auto", durDays: 32, workH: 240, pct: 30, res: "Михаил К.", startDay: 8 },
      { wbs: "3", title: "Push-уведомления", kind: "task", mode: "auto", durDays: 14, workH: 96, pct: 0, res: "Фёдоров И.", startDay: 22 },
      { wbs: "4", title: "QA мобильного", kind: "task", mode: "auto", durDays: 16, workH: 88, pct: 0, res: "Кузнецов Н.", startDay: 30 }
    ],
    deps: [{ pred: "1", succ: "2", type: "FS", lagDays: 0 }]
  },
  {
    id: "proj-erp-integration", name: "Интеграции · ERP", code: "ИЭ",
    tasks: [
      { wbs: "1", title: "Коннектор ERP", kind: "task", mode: "auto", durDays: 28, workH: 200, pct: 40, res: "Сергеев П." },
      { wbs: "2", title: "Маппинг данных", kind: "task", mode: "auto", durDays: 22, workH: 140, pct: 20, res: "Дмитриев К.", startDay: 6 },
      { wbs: "3", title: "Аналитика интеграций", kind: "task", mode: "auto", durDays: 24, workH: 150, pct: 10, res: "Лебедева Е." },
      { wbs: "4", title: "Приёмка интеграций", kind: "task", mode: "auto", durDays: 14, workH: 84, pct: 0, res: "Орлова Д.", startDay: 18 },
      { wbs: "5", title: "Координация ERP", kind: "task", mode: "auto", durDays: 30, workH: 120, pct: 35, res: "Петров А." }
    ],
    deps: [{ pred: "1", succ: "2", type: "SS", lagDays: 4 }]
  }
];

const PORTFOLIO_EXCEPTIONS: ExceptionA[] = [
  { id: "pf-ex-1", resourceId: "u-ivanova", day: 31, workingMinutes: 0, reason: "Отпуск" },
  { id: "pf-ex-2", resourceId: "u-ivanova", day: 32, workingMinutes: 0, reason: "Отпуск" },
  { id: "pf-ex-3", resourceId: "u-ivanova", day: 33, workingMinutes: 0, reason: "Отпуск" }
];

export type PortfolioModel = {
  buckets: LoadBucket[];
  tasks: Array<{ id: string; wbsCode: string; title: string; workMinutes: number; percentComplete: number; projectId: string; projectName: string }>;
  assignments: Array<{ id: string; taskId: string; resourceId: string; unitsPermille: number; workMinutes: number; role: string }>;
  calc: Array<{ id: string; calculatedStart: string }>;
  projects: PortfolioProject[];
};

export function buildPortfolioModel(): PortfolioModel {
  const dow = (day: number) => new Date(BASE + day * 86_400_000).getUTCDay();
  const isWeekday = (day: number) => { const d = dow(day); return d >= 1 && d <= 5; };

  type Contrib = { resourceId: string; es: number; ef: number; per: number; taskId: string; assignmentId: string };
  const contribs: Contrib[] = [];
  const tasks: PortfolioModel["tasks"] = [];
  const assignments: PortfolioModel["assignments"] = [];
  const calcArr: PortfolioModel["calc"] = [];
  let lastDay = 34;

  for (const proj of PORTFOLIO_SEEDS) {
    const exc = proj.id === PROJECT_ID ? PORTFOLIO_EXCEPTIONS : [];
    const a = namespaceAuthored(seedToAuthored(proj.tasks, proj.deps, exc), `${proj.id}::`);
    const calc = schedule(a);
    for (const t of a.tasks) {
      const c = calc.get(t.id);
      if (!c || t.kind === "summary") continue;
      lastDay = Math.max(lastDay, c.ef);
      tasks.push({ id: t.id, wbsCode: t.wbs, title: t.title, workMinutes: t.workMinutes, percentComplete: t.pct, projectId: proj.id, projectName: proj.name });
      calcArr.push({ id: t.id, calculatedStart: dayToIso(c.es) });
    }
    for (const asg of a.assignments) {
      const c = calc.get(asg.taskId);
      if (!c) continue;
      assignments.push({ id: asg.id, taskId: asg.taskId, resourceId: asg.resourceId, unitsPermille: asg.unitsPermille, workMinutes: asg.workMinutes, role: asg.role });
      contribs.push({ resourceId: asg.resourceId, es: c.es, ef: c.ef, taskId: asg.taskId, assignmentId: asg.id, per: Math.round((asg.workMinutes * (asg.unitsPermille / 1000)) / Math.max(1, c.ef - c.es)) });
    }
  }

  // дневные ведра: ёмкость глобальная (один раз на человека), назначения суммируются по проектам
  const dayBuckets: LoadBucket[] = [];
  for (const r of RESOURCES) {
    for (let day = 0; day <= lastDay; day++) {
      const ex = PORTFOLIO_EXCEPTIONS.find((e) => e.resourceId === r.id && e.day === day);
      const capacityMinutes = ex ? ex.workingMinutes : isWeekday(day) ? r.capacityMinPerDay : 0;
      let assigned = 0;
      const tIds: string[] = []; const aIds: string[] = [];
      const aContribs: LoadBucket["assignmentContributions"] = [];
      if (isWeekday(day)) {
        for (const c of contribs) {
          if (c.resourceId !== r.id || day < c.es || day >= c.ef || c.per <= 0) continue;
          assigned += c.per; tIds.push(c.taskId); aIds.push(c.assignmentId);
          aContribs.push({ taskId: c.taskId, assignmentId: c.assignmentId, workMinutes: c.per });
        }
      }
      const occContribs: LoadBucket["occupancyContributions"] = [];
      const excIds: string[] = [];
      if (ex) { excIds.push(ex.id); occContribs.push({ occupancyId: ex.id, sourceType: "absence", sourceId: ex.id, workMinutes: r.capacityMinPerDay }); }
      dayBuckets.push({
        resourceId: r.id, positionId: r.positionId, teamId: r.teamId, projectId: "portfolio", date: dayToIso(day), granularity: "day",
        assignedMinutes: assigned, reservedMinutes: 0, occupiedMinutes: 0, capacityMinutes, freeMinutes: Math.max(0, capacityMinutes - assigned),
        taskIds: tIds, assignmentIds: aIds, assignmentContributions: aContribs, reservationContributions: [], occupancyContributions: occContribs, reservationIds: [], occupancyIds: [], calendarExceptionIds: excIds
      });
    }
  }

  const weekStart = (day: number) => { const d = dow(day); return day - (d === 0 ? 6 : d - 1); };
  const monthStart = (day: number) => { const dt = new Date(BASE + day * 86_400_000); return Math.round((Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1) - BASE) / 86_400_000); };
  const agg = (gran: "week" | "month", keyFn: (day: number) => number): LoadBucket[] => {
    const map = new Map<string, LoadBucket>();
    for (const b of dayBuckets) {
      const periodStart = keyFn(isoToDay(b.date));
      const key = `${b.resourceId}|${periodStart}`;
      let bk = map.get(key);
      if (!bk) { bk = { ...b, date: dayToIso(periodStart), granularity: gran, assignedMinutes: 0, reservedMinutes: 0, occupiedMinutes: 0, capacityMinutes: 0, freeMinutes: 0, taskIds: [], assignmentIds: [], assignmentContributions: [], reservationContributions: [], occupancyContributions: [], reservationIds: [], occupancyIds: [], calendarExceptionIds: [] }; map.set(key, bk); }
      bk.assignedMinutes += b.assignedMinutes; bk.capacityMinutes += b.capacityMinutes;
      bk.taskIds.push(...b.taskIds); bk.assignmentIds.push(...b.assignmentIds); bk.assignmentContributions.push(...b.assignmentContributions); bk.occupancyContributions.push(...b.occupancyContributions); bk.calendarExceptionIds.push(...b.calendarExceptionIds);
    }
    for (const bk of map.values()) bk.freeMinutes = Math.max(0, bk.capacityMinutes - bk.assignedMinutes);
    return [...map.values()];
  };

  return {
    buckets: [...dayBuckets, ...agg("week", weekStart), ...agg("month", monthStart)],
    tasks, assignments, calc: calcArr,
    projects: PORTFOLIO_SEEDS.map((p) => ({ id: p.id, name: p.name, code: p.code }))
  };
}

export const MOCK_PROJECT_ID = PROJECT_ID;
export { MIN_PER_DAY, PROJECT_START_ISO };
