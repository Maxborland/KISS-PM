"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownWideNarrow, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, EyeOff, Filter, Pencil, Plus, ShieldCheck, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { dayToIso, isoToDay, type Resource } from "@/delivery/lib/planning-demo-data";
import { AbsenceDialog } from "@/delivery/resources/resources-editors";
import { NON_WORKING_TONE } from "@/delivery/ui/non-working-tones";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

/* ============================================================
   ResourceLoadMatrix — УНИВЕРСАЛЬНАЯ матрица загрузки.
   Один компонент для всех уровней: проект / команда / компания.
   Источник данных и обработчики приходят пропсами (scope + data +
   callbacks) — компонент ничего не знает о том, откуда буфера:
   живой usePlanning (проект, редактируемо) или портфельный снимок
   (команда/компания, read-only). Иерархия строк задаётся scope.groupLevels.

   Визуальный язык строк: ячейка СОТРУДНИКА — сплошной цветной блок
   (кликабельна, редактируема); ячейка СУММАРНОЙ строки (команда /
   позиция / Итого) — мини-бар на тонированной полосе (это свод, не
   редактируемая ячейка). Наведение даёт «прицел»: подсветку текущих
   строки и столбца (+ шапка периода и левая подпись).
   ============================================================ */

export type Gran = "day" | "week" | "month";

export type RBucket = {
  resourceId: string;
  date: string;
  granularity: Gran;
  assignedMinutes: number;
  reservedMinutes: number;
  occupiedMinutes: number;
  capacityMinutes: number;
  freeMinutes: number;
  assignmentContributions: Array<{ taskId: string; assignmentId: string; workMinutes: number }>;
  reservationContributions: Array<{ reservationId: string; workMinutes: number }>;
  occupancyContributions: Array<{ occupancyId: string; sourceType: string; sourceId: string; workMinutes: number }>;
  // id исключений календаря в бакете: праздник (resourceId=null) отличаем от обычного выходного
  calendarExceptionIds?: string[];
};

export type MatrixTask = { id: string; wbsCode: string; title: string; workMinutes: number; percentComplete: number; projectId?: string; projectName?: string };
export type MatrixAssignment = { id: string; taskId: string; resourceId: string; unitsPermille: number; workMinutes: number; role: string };

export type MatrixData = {
  buckets: RBucket[];
  resources: Resource[]; // ростер в скоупе (для команды — отфильтрован)
  taskById: Map<string, MatrixTask>;
  asgById: Map<string, MatrixAssignment>;
  calcStartById: Map<string, string>;
  accepted: Set<string>;
  /** проекты портфеля (для фильтра по проекту); на уровне проекта — не задаётся */
  projects?: Array<{ id: string; name: string }>;
};

export type GroupLevel = "team" | "role" | "person";

export type MatrixScope = {
  level: "project" | "team" | "company";
  groupLevels: GroupLevel[]; // последний всегда "person"
  /** существительное скоупа для подписи KPI: «весь проект» / «весь портфель» */
  windowNoun: string;
};

export type MatrixCallbacks = {
  busy?: boolean;
  notice?: string | null;
  onCreateTask?: (presetResourceId?: string) => void;
  onEditTask?: (taskId: string) => void;
  onAcceptOverload?: (resourceId: string, dateIso: string) => void;
  onEditAssignmentHours?: (asg: MatrixAssignment, hours: number) => void;
  onAbsence?: (resourceId: string, typeLabel: string, startIso: string, finishIso: string) => void;
};

const ROW_H = 34;
const HEADER_H = 40;
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_CAP = ["", "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const COL_W: Record<Gran, number> = { day: 26, week: 34, month: 72 };

// подсветка «прицела»: тонирующий inset-shadow (не конфликтует с inline-фоном ячеек).
// ВНИМАНИЕ: две shadow-[…]-утилиты на одном элементе схлопнутся twMerge — держим их взаимоисключающими.
const CROSS = "shadow-[inset_0_0_0_9999px_color-mix(in_oklab,var(--accent)_14%,transparent)]";
const CROSS_SOFT = "shadow-[inset_0_0_0_9999px_color-mix(in_oklab,var(--accent)_8%,transparent)]";
const CROSS_FOCAL = "shadow-[inset_0_0_0_9999px_color-mix(in_oklab,var(--accent)_26%,transparent)]"; // фокусная (пересечение)

const committedOf = (b: RBucket) => b.assignedMinutes + b.reservedMinutes + b.occupiedMinutes;
const h1 = (min: number) => (Math.round((min / 60) * 10) / 10).toLocaleString("ru-RU");

function periodLabel(iso: string, gran: Gran): { top: string; sub: string; weekend: boolean } {
  const d = new Date(iso + "T00:00:00Z");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS[d.getUTCMonth()] ?? "";
  const wd = d.getUTCDay();
  if (gran === "day") return { top: dd, sub: ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][wd] ?? "", weekend: wd === 0 || wd === 6 };
  if (gran === "month") return { top: `${mon[0]?.toUpperCase()}${mon.slice(1)}`, sub: String(d.getUTCFullYear()).slice(2), weekend: false };
  return { top: dd, sub: mon, weekend: false };
}

/* цвет ячейки: зелёный по интенсивности ≤100% (норма), красный >100% (перегруз).
   Нерабочие дни различаем и делаем заметными: отпуск/отсутствие — фиолетовый,
   праздник — янтарный, выходной — серый (раньше сливались в бледный panel-strong). */
function cellTone(pct: number, cap: number, hasAbsence: boolean, holiday: boolean): { bg: string; fg: string } {
  if (cap === 0) {
    if (hasAbsence) return NON_WORKING_TONE.absence;
    if (holiday) return NON_WORKING_TONE.holiday;
    return NON_WORKING_TONE.weekend;
  }
  if (pct === 0) return { bg: "var(--panel-subtle)", fg: "var(--muted-soft)" };
  if (pct > 100) return { bg: "var(--danger)", fg: "#fff" };
  const mix = Math.round(22 + Math.min(1, pct / 100) * 58);
  return { bg: `color-mix(in oklab, var(--success) ${mix}%, #fff)`, fg: pct >= 55 ? "#fff" : "var(--success-text)" };
}

type Cell = { committed: number; capacity: number; pct: number; bucket: RBucket | null; hasAbsence: boolean; holiday: boolean; overload: boolean; accepted: boolean };
type Rrow = { key: string; depth: number; isPerson: boolean; label: string; sub: string; resourceId?: string; memberIds: string[]; cells: Map<string, Cell> };

const keyOf = (r: Resource, lvl: GroupLevel) => (lvl === "team" ? r.teamId : lvl === "role" ? r.positionId : r.id);
const labelOf = (r: Resource, lvl: GroupLevel) => (lvl === "team" ? r.teamName : lvl === "role" ? r.positionName : r.name);

const selectCls = "h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";

export function ResourceLoadMatrix({ scope, data, callbacks = {} }: { scope: MatrixScope; data: MatrixData; callbacks?: MatrixCallbacks }) {
  const { busy, notice, onCreateTask, onEditTask, onAcceptOverload, onEditAssignmentHours, onAbsence } = callbacks;
  const [gran, setGran] = useState<Gran>("day");
  const [monthOffset, setMonthOffset] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [onlyOverload, setOnlyOverload] = useState(false);
  const [hideIdle, setHideIdle] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"load" | "name">("load");
  const [sel, setSel] = useState<{ resourceId: string; date: string } | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // «прицел»: строка (key) и столбец (date) под курсором — подсветка без пересчёта данных
  const [hover, setHover] = useState<{ key: string; date: string } | null>(null);

  const colW = COL_W[gran];

  // ВСЕ тяжёлые производные (окно, ячейки, дерево, KPI) считаем в useMemo — наведение «прицела»
  // меняет только hover-стейт и НЕ триггерит пересчёт этого блока (перерисовка остаётся дешёвой).
  // Инвариант: caller передаёт СТАБИЛЬНЫЕ (мемоизированные) data/scope (см. resources-surface /
  // portfolio-resources) — иначе M пересчитается на каждый рендер родителя.
  const M = useMemo(() => {
    const buckets = data.buckets.filter((b) => b.granularity === gran);
    const byKey = new Map(buckets.map((b) => [`${b.resourceId}|${b.date}`, b]));
    const dayByKey = new Map(data.buckets.filter((b) => b.granularity === "day").map((b) => [`${b.resourceId}|${b.date}`, b]));

    // окно по месяцу (день/неделя); месяц-гранулярность — весь горизонт
    const monthsList = [...new Set(data.buckets.filter((b) => b.granularity === "day").map((b) => b.date.slice(0, 7)))].sort();
    const focusMonth = monthsList[Math.max(0, Math.min(monthOffset, monthsList.length - 1))] ?? "";
    const windowed = gran !== "month";
    const inWindow = (iso: string) => !windowed || iso.slice(0, 7) === focusMonth;
    const periods = [...new Set(buckets.map((b) => b.date))].filter(inWindow).sort();
    const monthLabel = focusMonth ? `${MONTHS_CAP[Number(focusMonth.slice(5, 7))]} ${focusMonth.slice(0, 4)}` : "";

    // фильтр по проекту: загрузку ячейки считаем только по вкладам выбранного проекта
    // (taskId портфеля закодирован как «projId::t-wbs»). Ёмкость не трогаем.
    const projOf = (taskId: string) => (taskId.includes("::") ? taskId.split("::")[0]! : null);
    const committedFor = (b: RBucket) => {
      if (projectFilter === "all") return committedOf(b);
      return b.assignmentContributions.filter((c) => projOf(c.taskId) === projectFilter).reduce((s, c) => s + c.workMinutes, 0);
    };

    // принятие перегруза хранится по дням каноничным ключом `resourceId:dateIso`. Чтобы оно не «воскресало»
    // при переключении на неделю/месяц, откатываем его по дням периода: ячейка «принята»,
    // если ВСЕ перегруженные дни внутри периода приняты (зависит и от фильтра по проекту).
    const dayRangeOf = (iso: string): [number, number] => {
      const d0 = isoToDay(iso);
      if (gran === "day") return [d0, d0];
      if (gran === "week") return [d0, d0 + 6];
      const dt = new Date(iso + "T00:00:00Z");
      const days = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
      return [d0, d0 + days - 1];
    };
    const acceptedForPeriod = (resourceId: string, iso: string): boolean => {
      const [d0, d1] = dayRangeOf(iso);
      let anyOver = false;
      for (let day = d0; day <= d1; day++) {
        const db = dayByKey.get(`${resourceId}|${dayToIso(day)}`);
        if (!db) continue;
        const com = committedFor(db);
        if (com > db.capacityMinutes && (db.capacityMinutes > 0 || com > 0)) {
          anyOver = true;
          if (!data.accepted.has(`${resourceId}:${dayToIso(day)}`)) return false;
        }
      }
      return anyOver;
    };

    const cellFor = (resourceId: string, date: string): Cell => {
      const b = byKey.get(`${resourceId}|${date}`) ?? null;
      const committed = b ? committedFor(b) : 0;
      const capacity = b ? b.capacityMinutes : 0;
      const hasAbsence = !!b && b.occupancyContributions.some((o) => o.sourceType === "absence");
      // праздник = БУДНИЙ день, обнулённый исключением календаря, но НЕ персональное отсутствие.
      // Гард по будням важен: calendarExceptionIds непуст и для персонального отсутствия, попавшего
      // на выходной (там нет occupancy-absence) — без гарда такой день красился бы как праздник.
      const dow = new Date(date + "T00:00:00Z").getUTCDay();
      const holiday = dow >= 1 && dow <= 5 && !hasAbsence && capacity === 0 && !!b && (b.calendarExceptionIds?.length ?? 0) > 0;
      const overload = committed > capacity && (capacity > 0 || committed > 0);
      const accepted = acceptedForPeriod(resourceId, date);
      return { committed, capacity, pct: capacity > 0 ? Math.round((committed / capacity) * 100) : committed > 0 ? 999 : 0, bucket: b, hasAbsence, holiday, overload, accepted };
    };
    const aggCells = (resourceIds: string[]): Map<string, Cell> => {
      const m = new Map<string, Cell>();
      for (const date of periods) {
        let committed = 0, capacity = 0, over = false, abs = false;
        for (const rid of resourceIds) { const c = cellFor(rid, date); committed += c.committed; capacity += c.capacity; over = over || c.overload; abs = abs || c.hasAbsence; }
        m.set(date, { committed, capacity, pct: capacity > 0 ? Math.round((committed / capacity) * 100) : committed > 0 ? 999 : 0, bucket: null, hasAbsence: abs, holiday: false, overload: over, accepted: false });
      }
      return m;
    };

    // загрузка ресурса за окно (для фильтра «скрыть незанятых» и сортировки)
    const commByRes = new Map<string, number>();
    for (const r of data.resources) commByRes.set(r.id, periods.reduce((s, d) => s + cellFor(r.id, d).committed, 0));
    const isOverloadedRes = (rid: string) => periods.some((d) => { const c = cellFor(rid, d); return c.overload && !c.accepted; });

    // фильтры (команда / роль / только перегруженные / скрыть незанятых) → видимые ресурсы
    let visibleResList = data.resources.filter((r) => {
      if (teamFilter !== "all" && r.teamId !== teamFilter) return false;
      if (roleFilter !== "all" && r.positionId !== roleFilter) return false;
      if (onlyOverload && !isOverloadedRes(r.id)) return false;
      if (hideIdle && (commByRes.get(r.id) ?? 0) <= 0) return false;
      return true;
    });
    if (sortBy === "load") visibleResList = [...visibleResList].sort((a, b) => (commByRes.get(b.id) ?? 0) - (commByRes.get(a.id) ?? 0));

    // списки для фильтров (по всему скоупу)
    const teamsAll = [...new Map(data.resources.map((r) => [r.teamId, r.teamName])).entries()];
    const rolesAll = [...new Map(data.resources.filter((r) => teamFilter === "all" || r.teamId === teamFilter).map((r) => [r.positionId, r.positionName])).entries()];
    const showTeamFilter = scope.groupLevels.includes("team") && teamsAll.length > 1;

    // дерево по scope.groupLevels (рекурсивно, сортировка по загрузке)
    const dims = scope.groupLevels.filter((l) => l !== "person");
    const rows: Rrow[] = [];
    const recurse = (members: Resource[], dimIdx: number, prefix: string, depth: number) => {
      if (dimIdx >= dims.length) {
        for (const p of members) rows.push({ key: p.id, depth, isPerson: true, label: p.name, sub: p.positionName, resourceId: p.id, memberIds: [p.id], cells: new Map(periods.map((d) => [d, cellFor(p.id, d)])) });
        return;
      }
      const dim = dims[dimIdx]!;
      const groupMap = new Map<string, Resource[]>();
      for (const r of members) { const k = keyOf(r, dim); const arr = groupMap.get(k) ?? []; arr.push(r); groupMap.set(k, arr); }
      let groups = [...groupMap.entries()];
      if (sortBy === "load") groups = groups.sort((a, b) => b[1].reduce((s, r) => s + (commByRes.get(r.id) ?? 0), 0) - a[1].reduce((s, r) => s + (commByRes.get(r.id) ?? 0), 0));
      for (const [, gm] of groups) {
        const head = gm[0]!;
        const gkey = `${prefix}/${dim}:${keyOf(head, dim)}`;
        const ids = gm.map((m) => m.id);
        rows.push({ key: gkey, depth, isPerson: false, label: labelOf(head, dim), sub: dim === "team" ? `${gm.length} чел.` : `${gm.length}`, memberIds: ids, cells: aggCells(ids) });
        if (collapsed.has(gkey)) continue;
        recurse(gm, dimIdx + 1, gkey, depth + 1);
      }
    };
    recurse(visibleResList, 0, "", 0);

    // KPI по видимым ресурсам × видимым периодам (учитывают окно и все фильтры)
    let kCap = 0, kCommitted = 0, kOverHours = 0;
    for (const r of visibleResList) for (const d of periods) { const c = cellFor(r.id, d); kCap += c.capacity; kCommitted += c.committed; if (c.overload && !c.accepted) kOverHours += Math.max(0, c.committed - c.capacity); }
    const kLoad = kCap > 0 ? Math.round((kCommitted / kCap) * 100) : 0;
    const kFree = Math.max(0, kCap - kCommitted);
    const overloadedCount = visibleResList.filter((r) => periods.some((d) => { const c = cellFor(r.id, d); return c.overload && !c.accepted; })).length;
    const allVisibleIds = visibleResList.map((r) => r.id);
    const totalsCells = aggCells(allVisibleIds);

    return { byKey, periods, monthsList, windowed, monthLabel, projOf, committedFor, cellFor, rows, visibleResList, teamsAll, rolesAll, showTeamFilter, kCap, kCommitted, kOverHours, kLoad, kFree, overloadedCount, allVisibleIds, totalsCells };
  }, [data, gran, monthOffset, collapsed, onlyOverload, hideIdle, teamFilter, roleFilter, projectFilter, sortBy, scope.groupLevels]);

  const { byKey, periods, monthsList, windowed, monthLabel, projOf, committedFor, cellFor, rows, visibleResList, teamsAll, rolesAll, showTeamFilter, kCap, kCommitted, kOverHours, kLoad, kFree, overloadedCount, allVisibleIds, totalsCells } = M;

  // эффективный «прицел»: под курсором (hover); когда курсор ушёл из сетки, но открыт дрилдаун —
  // держим подсветку на выбранной строке/столбце (визуальная связь с источником дрилдауна).
  const crosshair = hover ?? (sel ? { key: sel.resourceId, date: sel.date } : null);

  const toggle = (k: string) => setCollapsed((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const selBucket = sel ? byKey.get(`${sel.resourceId}|${sel.date}`) ?? null : null;
  const selRes = sel ? data.resources.find((r) => r.id === sel.resourceId) ?? null : null;
  const selOverloaded = sel ? cellFor(sel.resourceId, sel.date).overload && !cellFor(sel.resourceId, sel.date).accepted : false;

  // дрилдаун согласован с ячейкой: при активном фильтре по проекту учитываем только его вклады
  const selCommitted = selBucket ? committedFor(selBucket) : 0;
  const selCap = selBucket ? selBucket.capacityMinutes : 0;
  const selPct = selCap > 0 ? Math.round((selCommitted / selCap) * 100) : selCommitted > 0 ? 999 : 0;
  const selAsg = selBucket ? [...selBucket.assignmentContributions.filter((ac) => projectFilter === "all" || projOf(ac.taskId) === projectFilter).reduce((m, ac) => { const e = m.get(ac.assignmentId); if (e) e.minutes += ac.workMinutes; else m.set(ac.assignmentId, { taskId: ac.taskId, minutes: ac.workMinutes }); return m; }, new Map<string, { taskId: string; minutes: number }>()).entries()] : [];
  const selOcc = selBucket ? [...new Set(selBucket.occupancyContributions.map((o) => o.occupancyId))] : [];

  const LEFT_W = 348;

  const leftRow = (r: Rrow, opts?: { totals?: boolean }) => {
    const tot = [...r.cells.values()].reduce((a, c) => ({ committed: a.committed + c.committed, capacity: a.capacity + c.capacity }), { committed: 0, capacity: 0 });
    const pct = tot.capacity > 0 ? Math.round((tot.committed / tot.capacity) * 100) : 0;
    const collapsedHere = collapsed.has(r.key);
    const rowHover = crosshair?.key === r.key;
    return (
      <div key={r.key} onMouseEnter={() => setHover({ key: r.key, date: "" })} className={cn("flex items-center gap-1.5 border-b px-2", opts?.totals ? "border-[var(--border-strong)] bg-[var(--panel-subtle)]" : "border-[var(--border-subtle)]", !opts?.totals && (r.depth === 0 ? "bg-[color-mix(in_oklab,var(--panel-strong)_55%,var(--panel))]" : r.depth === 1 && "bg-[color-mix(in_oklab,var(--panel-strong)_25%,var(--panel))]"), rowHover && CROSS_SOFT)} style={{ height: ROW_H, width: LEFT_W }}>
        <span className="flex min-w-0 flex-1 items-center gap-1.5" style={{ paddingLeft: r.depth * 16 }}>
          {opts?.totals ? <span className="text-[length:var(--text-sm)] font-bold text-[var(--text-strong)]">Итого</span> : r.isPerson ? (
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--panel-strong)] text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{r.label.slice(0, 1)}</span>
          ) : (
            <button type="button" onClick={() => toggle(r.key)} className="grid size-4 shrink-0 place-items-center rounded text-[var(--muted)] hover:bg-[var(--panel-strong)]" aria-label={collapsedHere ? "Развернуть" : "Свернуть"}>{collapsedHere ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}</button>
          )}
          {!opts?.totals ? <span className={cn("truncate", r.isPerson ? "text-[length:var(--text-sm)] text-[var(--text)]" : r.depth === 0 ? "text-[length:var(--text-sm)] font-bold text-[var(--text-strong)]" : "text-[length:var(--text-sm)] font-semibold text-[var(--text)]")}>{r.label}</span> : <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">{allVisibleIds.length} чел.</span>}
          {!opts?.totals && !r.isPerson ? <span className="shrink-0 rounded-full bg-[var(--panel)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-soft)] shadow-[inset_0_0_0_1px_var(--border)]">{r.sub}</span> : null}
        </span>
        <span className="w-[84px] shrink-0 text-right" title={`Поставлено ${h1(tot.committed)} ч из ${h1(tot.capacity)} ч · загрузка ${pct}% · свободно ${h1(Math.max(0, tot.capacity - tot.committed))} ч`}>
          <span className={cn("v4-num block text-[length:var(--text-xs)] font-semibold tabular-nums", pct > 100 ? "text-[var(--danger)]" : opts?.totals ? "text-[var(--text-strong)]" : "text-[var(--text)]")}>{Math.round(tot.committed / 60)}/{Math.round(tot.capacity / 60)} ч</span>
          <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-[var(--panel-strong)]"><span className={cn("block h-full rounded-full", pct > 100 ? "bg-[var(--danger)]" : "bg-[var(--success)]")} style={{ width: `${Math.min(100, pct)}%` }} /></span>
        </span>
      </div>
    );
  };

  const periodRow = (r: Rrow, opts?: { totals?: boolean }) => {
    const aggregate = !r.isPerson; // команда / позиция / Итого — это свод, рисуем баром
    return (
      <div key={r.key} onMouseEnter={() => setHover((h) => ({ key: r.key, date: h?.date ?? "" }))} className={cn("flex border-b", opts?.totals ? "border-[var(--border-strong)] bg-[var(--panel-subtle)]" : "border-[var(--border-subtle)]", !opts?.totals && (r.depth === 0 ? "bg-[color-mix(in_oklab,var(--panel-strong)_40%,var(--panel))]" : r.depth === 1 && "bg-[color-mix(in_oklab,var(--panel-strong)_18%,var(--panel))]"))} style={{ height: ROW_H }}>
        {periods.map((d) => {
          const c = r.cells.get(d)!;
          const inCross = crosshair?.date === d || crosshair?.key === r.key;
          const isFocal = crosshair?.date === d && crosshair?.key === r.key; // пересечение — фокус
          const show = c.committed === 0 ? "" : `${Math.round(c.committed / 60)}`;

          if (aggregate) {
            // СУММАРНАЯ ячейка: число + мини-бар %, на тонированной полосе строки (фон прозрачный → видно полосу)
            const over = c.pct > 100;
            const barW = Math.min(100, c.pct);
            return (
              <button
                key={d}
                type="button"
                onMouseEnter={() => setHover({ key: r.key, date: d })}
                onClick={() => (opts?.totals ? undefined : toggle(r.key))}
                className={cn("relative flex shrink-0 items-center justify-center border-r border-[var(--border-subtle)] text-[length:var(--text-2xs)] font-semibold tabular-nums outline-none", opts?.totals ? "cursor-default" : "cursor-pointer", isFocal ? CROSS_FOCAL : inCross ? CROSS : "")}
                style={{ flex: `1 0 ${colW}px`, minWidth: colW, color: over ? "var(--danger)" : "var(--muted-strong)" }}
                title={`${r.label} · ${d}\nСвод ${c.pct}% · ${h1(c.committed)}/${h1(c.capacity)} ч${c.overload ? " · перегруз" : ""}`}
              >
                <span className="relative z-[1] leading-none">{show}</span>
                {c.pct > 0 ? (
                  <span className="pointer-events-none absolute inset-x-1 bottom-[3px] h-[3px] overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--muted-soft)_28%,transparent)]">
                    <span className="block h-full rounded-full" style={{ width: `${barW}%`, background: over ? "var(--danger)" : "var(--success)" }} />
                  </span>
                ) : null}
              </button>
            );
          }

          // ячейка СОТРУДНИКА: сплошной цветной блок (кликабельна → дрилдаун)
          const tone = cellTone(c.pct, c.capacity, c.hasAbsence, c.holiday);
          const isSel = sel?.resourceId === r.resourceId && sel?.date === d;
          return (
            <button
              key={d}
              type="button"
              onMouseEnter={() => setHover({ key: r.key, date: d })}
              onClick={() => (r.resourceId ? setSel({ resourceId: r.resourceId, date: d }) : undefined)}
              className={cn("flex shrink-0 items-center justify-center border-r border-[var(--border-subtle)] text-[length:var(--text-2xs)] font-semibold tabular-nums outline-none", isSel ? "ring-2 ring-inset ring-[var(--accent)]" : isFocal ? CROSS_FOCAL : inCross ? CROSS : "")}
              style={{ flex: `1 0 ${colW}px`, minWidth: colW, background: tone.bg, color: tone.fg }}
              title={c.bucket ? `${r.label} · ${d}\nЗагрузка ${c.pct}% · ${h1(c.committed)}/${h1(c.capacity)} ч${c.overload ? (c.accepted ? " · перегруз принят" : " · ПЕРЕГРУЗ") : ""}` : `${r.label} · ${d}`}
            >
              {c.accepted && c.overload ? "✓" : show}
            </button>
          );
        })}
      </div>
    );
  };

  const captureBanner: ReactNode = scope.level === "project"
    ? "Реальный контракт resourceLoad (assigned/capacity/free + перегрузы). Клик по ячейке — из чего сложилась загрузка + правка часов и снятие перегруза (preview→apply). Данные in-memory."
    : "Снимок портфеля по нескольким проектам. Ёмкость человека считается один раз, назначения суммируются по проектам — поэтому видно межпроектный перегруз. Read-only · in-memory.";

  return (
    <div>
      {/* toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {onCreateTask ? <Button variant="default" size="sm" onClick={() => onCreateTask(sel?.resourceId)} disabled={busy}><Plus className="size-3.5" aria-hidden />Задача</Button> : null}
        <Button variant="ghost" size="sm" onClick={() => setOnlyOverload((v) => !v)} className={cn(onlyOverload && "bg-[var(--danger-soft)] text-[var(--danger-text)]")}><Filter className="size-3.5" aria-hidden />Только перегруженные</Button>
        <Button variant="ghost" size="sm" onClick={() => setHideIdle((v) => !v)} className={cn(hideIdle && "bg-[var(--panel-strong)] text-[var(--text-strong)]")}><EyeOff className="size-3.5" aria-hidden />Скрыть незанятых</Button>
        {onAbsence ? <AbsenceDialog onSubmit={onAbsence} resources={data.resources}><Button variant="ghost" size="sm" disabled={busy}><UserPlus className="size-3.5" aria-hidden />Отсутствие</Button></AbsenceDialog> : null}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {showTeamFilter ? (
            <select value={teamFilter} onChange={(e) => { setTeamFilter(e.target.value); setRoleFilter("all"); }} className={selectCls} aria-label="Команда">
              <option value="all">Все команды</option>
              {teamsAll.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          ) : null}
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectCls} aria-label="Роль">
            <option value="all">Все роли</option>
            {rolesAll.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {data.projects && data.projects.length > 1 ? (
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={cn(selectCls, projectFilter !== "all" && "border-[var(--accent)] text-[var(--accent)]")} aria-label="Проект">
              <option value="all">Все проекты</option>
              {data.projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </select>
          ) : null}
          <button type="button" onClick={() => setSortBy((s) => (s === "load" ? "name" : "load"))} className={cn("inline-flex h-7 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] px-2 text-[length:var(--text-sm)]", sortBy === "load" ? "bg-[var(--panel-strong)] text-[var(--text-strong)]" : "bg-[var(--panel)] text-[var(--muted)]")} title="Сортировка"><ArrowDownWideNarrow className="size-3.5" aria-hidden />{sortBy === "load" ? "по загрузке" : "по имени"}</button>
          {windowed ? (
            <div className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-0.5 py-0.5">
              <button type="button" onClick={() => setMonthOffset((o) => Math.max(0, o - 1))} disabled={monthOffset <= 0} className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-40" aria-label="Предыдущий месяц"><ChevronLeft className="size-4" aria-hidden /></button>
              <span className="min-w-[92px] text-center text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{monthLabel}</span>
              <button type="button" onClick={() => setMonthOffset((o) => Math.min(monthsList.length - 1, o + 1))} disabled={monthOffset >= monthsList.length - 1} className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-40" aria-label="Следующий месяц"><ChevronRight className="size-4" aria-hidden /></button>
            </div>
          ) : null}
          <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-0.5">
            {(["day", "week", "month"] as Gran[]).map((g) => (
              <button key={g} type="button" onClick={() => setGran(g)} className={cn("rounded-[var(--radius-sm)] px-2.5 py-1 text-[length:var(--text-sm)] font-medium transition-colors", gran === g ? "bg-[var(--panel-strong)] text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text)]")}>{g === "day" ? "День" : g === "week" ? "Неделя" : "Месяц"}</button>
            ))}
          </div>
        </div>
      </div>

      {prototypeNotesEnabled && (
        <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          {captureBanner}
        </div>
      )}

      {/* KPI — по видимому окну × видимым ресурсам (учитывают период и все фильтры) */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Ёмкость", value: `${h1(kCap)} ч`, sub: `${windowed ? `за ${monthLabel}` : `весь ${scope.windowNoun}`} · ${visibleResList.length} чел.`, tone: "text-[var(--text-strong)]" },
          { label: "Назначено", value: `${h1(kCommitted)} ч`, sub: onlyOverload ? "фильтр: перегруженные" : "по реальным задачам", tone: "text-[var(--accent)]" },
          { label: "Загрузка", value: `${kLoad}%`, sub: `${Math.round(kCommitted / 60)} / ${Math.round(kCap / 60)} ч`, tone: kLoad > 100 ? "text-[var(--danger)]" : "text-[var(--text-strong)]" },
          { label: "Свободно", value: `${h1(kFree)} ч`, sub: "остаток ёмкости", tone: "text-[var(--success-text)]" },
          { label: "Перегруз", value: `${overloadedCount} чел.`, sub: overloadedCount > 0 ? `+${h1(kOverHours)} ч сверх ёмкости` : "нет перегруза", tone: overloadedCount > 0 ? "text-[var(--danger)]" : "text-[var(--muted-soft)]" }
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-card)]">
            <div className="text-[length:var(--text-xs)] uppercase tracking-[0.04em] text-[var(--muted-soft)]">{k.label}</div>
            <div className={cn("v4-num text-[length:var(--text-h2)] font-extrabold leading-tight", k.tone)}>{k.value}</div>
            <div className="mt-0.5 truncate text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <div className="flex min-w-full align-top" onMouseLeave={() => setHover(null)}>
            {/* sticky-left: имена + загрузка часами */}
            <div className="sticky left-0 z-20 shrink-0 border-r border-[var(--border-strong)] bg-[var(--panel)]">
              <div className="flex items-end gap-2 border-b border-[var(--border-strong)] bg-[var(--panel-subtle)] px-3 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]" style={{ height: HEADER_H, width: LEFT_W }}>
                <span className="flex-1 self-center">Ресурс / команда</span><span className="w-[84px] self-center text-right">Часы / ёмк.</span>
              </div>
              {rows.map((r) => leftRow(r))}
              {rows.length ? leftRow({ key: "__totals", depth: 0, isPerson: false, label: "Итого", sub: "", memberIds: allVisibleIds, cells: totalsCells }, { totals: true }) : null}
            </div>

            {/* scrolling: периоды (flex-fill — без правого зазора) */}
            <div className="relative min-w-0 flex-1">
              <div className="flex border-b border-[var(--border-strong)] bg-[var(--panel-subtle)]" style={{ height: HEADER_H }}>
                {periods.map((d) => { const pl = periodLabel(d, gran); const inCol = crosshair?.date === d; return <span key={d} className={cn("flex flex-col items-center justify-center border-r border-[var(--border-subtle)] text-[length:var(--text-xs)] leading-none", pl.weekend && "bg-[color-mix(in_oklab,var(--muted-soft)_18%,var(--panel))]", inCol && CROSS)} style={{ flex: `1 0 ${colW}px`, minWidth: colW }}><span className={cn("font-semibold", inCol ? "text-[var(--accent)]" : "text-[var(--muted-strong)]")}>{pl.top}</span><span className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{pl.sub}</span></span>; })}
              </div>
              {rows.map((r) => periodRow(r))}
              {rows.length ? periodRow({ key: "__totals", depth: 0, isPerson: false, label: "Итого", sub: "", memberIds: allVisibleIds, cells: totalsCells }, { totals: true }) : null}
            </div>
          </div>
          {rows.length === 0 ? <div className="px-4 py-10 text-center text-[length:var(--text-sm)] text-[var(--muted)]">Нет ресурсов под фильтры. Снимите фильтр или выберите другой период.</div> : null}
        </div>

        {/* drilldown */}
        {sel && selRes ? (
          <aside className="absolute right-0 top-0 z-30 flex h-full w-[360px] flex-col border-l border-[var(--border-strong)] bg-[var(--panel)] shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <div className="text-[length:var(--text-xs)] text-[var(--muted)]">{selRes.positionName} · {selRes.teamName}</div>
                <h3 className="truncate text-[length:var(--text-base)] font-bold text-[var(--text-strong)]">{selRes.name}</h3>
                <div className="mono mt-0.5 text-[length:var(--text-xs)] text-[var(--muted)]">{sel.date}{selBucket ? ` · загрузка ${selPct}% · ${h1(selCommitted)}/${h1(selCap)} ч` : ""}</div>
              </div>
              <button type="button" onClick={() => setSel(null)} className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)]" aria-label="Закрыть"><X className="size-4" aria-hidden /></button>
            </div>
            <div className="flex-1 overflow-auto px-4 py-3 text-[length:var(--text-sm)]">
              {selOverloaded ? (
                <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] px-2.5 py-2 text-[length:var(--text-xs)] text-[var(--danger-text)]">
                  <span className="flex-1">Перегруз {selBucket ? `+${h1(selCommitted - selCap)} ч` : ""}{scope.level !== "project" ? (projectFilter === "all" ? " (по всем проектам)" : " (в проекте)") : ""}</span>
                  {onAcceptOverload && gran === "day" ? <Button variant="secondary" size="sm" onClick={() => onAcceptOverload(sel.resourceId, sel.date)} disabled={busy}>Снять перегруз</Button> : gran !== "day" ? <span className="text-[var(--muted)]">снятие — на дне</span> : null}
                </div>
              ) : null}
              <div className="mb-1.5 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Из чего сложилась загрузка</div>
              {selAsg.length || selOcc.length ? (
                <ul className="space-y-1.5">
                  {selAsg.map(([assignmentId, info]) => {
                    const task = data.taskById.get(info.taskId);
                    const asg = data.asgById.get(assignmentId);
                    return (
                      <li key={assignmentId} className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--panel-subtle)] px-2 py-1.5">
                        <span className="mono text-[var(--muted)]">{task?.wbsCode}</span>
                        <span className="min-w-0 flex-1">
                          {onEditTask ? (
                            <button type="button" onClick={() => onEditTask(info.taskId)} className="flex w-full items-center gap-1 truncate text-left text-[var(--text)] hover:text-[var(--accent)]" title="Редактировать задачу"><span className="truncate">{task?.title ?? info.taskId}</span><Pencil className="size-3 shrink-0 opacity-60" aria-hidden /></button>
                          ) : (
                            <span className="block truncate text-[var(--text)]">{task?.title ?? info.taskId}</span>
                          )}
                          {task?.projectName ? (
                            data.projects && task.projectId ? (
                              <button type="button" onClick={() => { setProjectFilter(task.projectId!); setSel(null); }} className="mt-0.5 flex items-center gap-0.5 truncate text-[length:var(--text-2xs)] text-[var(--accent)] hover:underline" title={`Открыть в проекте «${task.projectName}» (фильтр по проекту)`}><ArrowUpRight className="size-3 shrink-0" aria-hidden /><span className="truncate">{task.projectName}</span></button>
                            ) : (
                              <span className="mt-0.5 block truncate text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{task.projectName}</span>
                            )
                          ) : null}
                          {asg && onEditAssignmentHours ? (
                            edit === assignmentId ? (
                              <span className="mt-0.5 flex items-center gap-1 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">всего <input autoFocus type="number" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { setEdit(null); onEditAssignmentHours(asg, Number(draft)); }} onKeyDown={(e) => { if (e.key === "Enter") { setEdit(null); onEditAssignmentHours(asg, Number(draft)); } if (e.key === "Escape") setEdit(null); }} className="w-14 rounded border border-[var(--accent)] bg-[var(--panel)] px-1 text-right tabular-nums outline-none" /> ч</span>
                            ) : (
                              <button type="button" onClick={() => { setEdit(assignmentId); setDraft(String(Math.round(asg.workMinutes / 60))); }} className="text-[length:var(--text-2xs)] text-[var(--muted-soft)] hover:text-[var(--accent)]" title="Изменить трудозатраты по задаче (всего)">всего {h1(asg.workMinutes)} ч · изменить</button>
                            )
                          ) : asg ? (
                            <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">всего {h1(asg.workMinutes)} ч</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-[var(--text-strong)]">{h1(info.minutes)} ч</span>
                      </li>
                    );
                  })}
                  {selOcc.map((occId) => <li key={occId} className="flex items-center gap-2 px-2 py-1 text-[var(--violet)]"><UserPlus className="size-3.5 shrink-0" aria-hidden />Отсутствие (отпуск)</li>)}
                </ul>
              ) : <p className="text-[var(--muted)]">{selBucket && selBucket.capacityMinutes === 0 ? "Нерабочий день." : "Нет нагрузки в этот период."}</p>}
              {scope.level === "project" ? <p className="mt-3 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Клик по часам — правка трудозатрат назначения (preview→apply, пересчитает загрузку).</p> : <p className="mt-3 inline-flex items-center gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]"><ShieldCheck className="size-3.5" aria-hidden />Отчётный уровень — правки делаются в проекте.</p>}
            </div>
          </aside>
        ) : null}
      </div>

      {notice ? <div className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[length:var(--text-xs)] text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded" style={{ background: "color-mix(in oklab, var(--success) 35%, #fff)" }} /> Ниже нормы</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded" style={{ background: "color-mix(in oklab, var(--success) 80%, #fff)" }} /> Полная (~100%)</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-[var(--danger)]" /> Перегруз (&gt;100%)</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded" style={{ background: NON_WORKING_TONE.absence.bg }} /> Отпуск / отсутствие</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded" style={{ background: NON_WORKING_TONE.holiday.bg }} /> Праздник</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded" style={{ background: NON_WORKING_TONE.weekend.bg }} /> Выходной</span>
        <span className="flex items-center gap-1.5"><span className="inline-flex h-3 w-5 items-center rounded bg-[color-mix(in_oklab,var(--panel-strong)_40%,var(--panel))] px-0.5"><span className="h-[3px] w-3 rounded-full bg-[var(--success)]" /></span> Свод (бар)</span>
        <span className="ml-auto text-[var(--muted-soft)]">Сотрудник — блок · свод — бар · наведение — прицел строки/столбца</span>
      </div>
    </div>
  );
}
