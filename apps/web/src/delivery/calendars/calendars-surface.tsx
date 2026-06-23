"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, TriangleAlert, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { dayToIso, isoToDay, MIN_PER_DAY, MOCK_PROJECT_ID, RESOURCES } from "@/delivery/lib/mock-planning-backend";
import { usePlanning } from "@/delivery/lib/use-planning";
import { AbsenceDialog } from "@/delivery/resources/resources-editors";
import type { PlanningCommand } from "@kiss-pm/domain";

type CalRaw = { id: string; workingWeekdays: number[]; workingMinutesPerDay: number };
type ExcRaw = { id: string; calendarId: string; resourceId: string | null; date: string; workingMinutes: number; reason: string };
type TaskRaw = { id: string; wbsCode: string; title: string; durationMinutes: number | null };
type CalcRaw = { id: string; calculatedStart: string; calculatedFinish: string };

const PROJECT: ProjectMeta = { name: "Производственный портал · Релиз 2", code: "ПР", status: "В работе", statusTone: "info", planVersion: "v17", deadline: "12.07.2026", finish: "14.06.2026", variance: { label: "+2 дня к baseline B2", tone: "warning" } };
const MONTHS_CAP = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const DOW_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const BASE_MS = Date.UTC(2026, 2, 2);
const resOf = (id: string) => RESOURCES.find((r) => r.id === id);
const ddmm = (iso: string) => { const d = new Date(iso + "T00:00:00Z"); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`; };
const jsDow = (day: number) => { const d = new Date(BASE_MS + day * 86_400_000).getUTCDay(); return d === 0 ? 7 : d; }; // 1..7 (Пн..Вс)

let NID = 0;
const nid = (p: string) => `${p}-n${(NID += 1)}`;

export function ProjectCalendars() {
  const { readModel, status, error, reload, apply, applyBatch } = usePlanning(MOCK_PROJECT_ID);
  const [selCal, setSelCal] = useState<string>("project"); // "project" | resourceId
  const [monthOffset, setMonthOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const model = useMemo(() => {
    if (!readModel) return null;
    const cal = ((readModel as unknown as { calendars: CalRaw[] }).calendars ?? [])[0] ?? { id: "cal-5x8", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: MIN_PER_DAY };
    const exns = (readModel as unknown as { calendarExceptions: ExcRaw[] }).calendarExceptions ?? [];
    const full = cal.workingMinutesPerDay;
    // нерабочие исключения (workingMinutes < полного дня): праздники (resourceId=null) и отсутствия
    const active = exns.filter((x) => x.workingMinutes < full);
    const holidayByDay = new Map<number, ExcRaw>();
    const absByResDay = new Map<string, Map<number, ExcRaw>>();
    for (const x of active) {
      const day = isoToDay(x.date);
      if (x.resourceId === null) holidayByDay.set(day, x);
      else { let m = absByResDay.get(x.resourceId); if (!m) { m = new Map(); absByResDay.set(x.resourceId, m); } m.set(day, x); }
    }
    const authored = readModel.authored as unknown as { tasks: TaskRaw[] };
    const calc = (readModel.calculatedPlan as unknown as { tasks: CalcRaw[] }).tasks;
    const calcById = new Map(calc.map((c) => [c.id, c]));
    const leafTasks = authored.tasks.filter((t) => t.durationMinutes != null);
    // конфликты: задача, чей интервал пересекает праздник (нерабочий день календаря)
    const conflicts = leafTasks.map((t) => {
      const c = calcById.get(t.id); if (!c) return null;
      const es = isoToDay(c.calculatedStart), ef = isoToDay(c.calculatedFinish);
      for (let d = es; d < Math.max(ef, es + 1); d++) if (holidayByDay.has(d)) return { task: t, day: d };
      return null;
    }).filter((x): x is { task: TaskRaw; day: number } => x !== null);
    // диапазон месяцев
    let maxDay = 34;
    for (const c of calc) maxDay = Math.max(maxDay, isoToDay(c.calculatedFinish));
    const monthsList = [...new Set(Array.from({ length: maxDay + 1 }, (_, i) => dayToIso(i).slice(0, 7)))].sort();
    return { cal, full, holidayByDay, absByResDay, leafTasks, conflicts, monthsList };
  }, [readModel]);

  if (status === "loading" && !readModel) {
    return <DeliveryFrame project={PROJECT} activeTab="Календари"><div className="flex h-[420px] items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]"><Loader2 className="size-4 animate-spin" aria-hidden /> Загрузка календарей…</div></DeliveryFrame>;
  }
  if (status === "error" || !model || !readModel) {
    return <DeliveryFrame project={PROJECT} activeTab="Календари"><div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]"><span>Не удалось загрузить: {error ?? "unknown"}</span><Button variant="secondary" size="sm" onClick={() => void reload()}>Повторить</Button></div></DeliveryFrame>;
  }

  const projectMeta: ProjectMeta = { ...PROJECT, planVersion: `v${readModel.planVersion}` };
  const focusMonth = model.monthsList[Math.max(0, Math.min(monthOffset, model.monthsList.length - 1))] ?? "";
  const monthLabel = focusMonth ? `${MONTHS_CAP[Number(focusMonth.slice(5, 7)) - 1]} ${focusMonth.slice(0, 4)}` : "";
  const isResourceView = selCal !== "project";
  const selRes = isResourceView ? resOf(selCal) : null;
  const absMap = isResourceView ? model.absByResDay.get(selCal) ?? new Map<number, ExcRaw>() : new Map<number, ExcRaw>();

  // сетка месяца: 6 недель × 7 дней, начиная с понедельника
  const grid: number[] = [];
  if (focusMonth) {
    const y = Number(focusMonth.slice(0, 4)), m = Number(focusMonth.slice(5, 7)) - 1;
    const first = Math.round((Date.UTC(y, m, 1) - BASE_MS) / 86_400_000);
    const start = first - (jsDow(first) - 1);
    for (let i = 0; i < 42; i++) grid.push(start + i);
  }
  const dayState = (day: number) => {
    const inMonth = dayToIso(day).slice(0, 7) === focusMonth;
    const weekend = !model.cal.workingWeekdays.includes(new Date(BASE_MS + day * 86_400_000).getUTCDay());
    const holiday = model.holidayByDay.get(day) ?? null;
    const absence = isResourceView ? absMap.get(day) ?? null : null;
    return { inMonth, weekend, holiday, absence, working: !weekend && !holiday && !absence };
  };

  async function applyCmd(command: PlanningCommand, okMsg: string) {
    setBusy(true); setNotice(null);
    const res = await apply(command);
    setBusy(false);
    setNotice(res.ok ? `${okMsg} · коммит v${res.planVersion}` : res.conflict ? "Конфликт версий — перезагружено" : `Отклонено: ${res.issues?.[0]?.message ?? res.message}`);
  }

  // клик по дню: тогл праздника (вид проекта) или отсутствия (вид ресурса). Восстановление = рабочие минуты.
  const toggleDay = (day: number) => {
    const st = dayState(day);
    if (st.weekend) return; // выходные задаются календарём (read-only)
    if (!isResourceView) {
      if (st.holiday) void applyCmd({ type: "calendar.exception.upsert", payload: { id: st.holiday.id, calendarId: model.cal.id, resourceId: null, date: dayToIso(day), workingMinutes: model.full, reason: "" } } as PlanningCommand, "Праздник снят");
      else void applyCmd({ type: "calendar.exception.upsert", payload: { id: nid("hol"), calendarId: model.cal.id, resourceId: null, date: dayToIso(day), workingMinutes: 0, reason: "Праздник" } } as PlanningCommand, "Праздник добавлен");
    } else {
      if (st.holiday) return; // праздник — общий, снимается в календаре проекта
      if (st.absence) void applyCmd({ type: "calendar.exception.upsert", payload: { id: st.absence.id, calendarId: model.cal.id, resourceId: selCal, date: dayToIso(day), workingMinutes: model.full, reason: "" } } as PlanningCommand, "Отсутствие снято");
      else void applyCmd({ type: "calendar.exception.upsert", payload: { id: nid("ex"), calendarId: model.cal.id, resourceId: selCal, date: dayToIso(day), workingMinutes: 0, reason: "Отсутствие" } } as PlanningCommand, "Отсутствие добавлено");
    }
  };
  const removeExc = (x: ExcRaw) => void applyCmd({ type: "calendar.exception.upsert", payload: { id: x.id, calendarId: x.calendarId, resourceId: x.resourceId, date: x.date, workingMinutes: model.full, reason: "" } } as PlanningCommand, "Исключение снято");

  const doAbsence = async (resourceId: string, typeLabel: string, start: string, finish: string) => {
    const cmds: PlanningCommand[] = [];
    const end = isoToDay(finish);
    for (let d = isoToDay(start); d <= end; d += 1) {
      // только рабочие дни диапазона: пропускаем выходные и праздники
      if (!model.cal.workingWeekdays.includes(new Date(BASE_MS + d * 86_400_000).getUTCDay()) || model.holidayByDay.has(d)) continue;
      cmds.push({ type: "calendar.exception.upsert", payload: { id: nid("ex"), calendarId: model.cal.id, resourceId, date: dayToIso(d), workingMinutes: 0, reason: typeLabel } } as PlanningCommand);
    }
    if (cmds.length === 0) return;
    setBusy(true);
    const res = await applyBatch(cmds);
    setBusy(false);
    setNotice(res.ok ? `${typeLabel} добавлен · коммит v${res.planVersion}` : `Отклонено: ${res.message}`);
  }

  // правый столбец: список исключений (праздники + отсутствия выбранного ресурса)
  const listExc: ExcRaw[] = [
    ...[...model.holidayByDay.values()],
    ...(isResourceView ? [...absMap.values()] : [])
  ].sort((a, b) => isoToDay(a.date) - isoToDay(b.date));

  return (
    <DeliveryFrame project={projectMeta} activeTab="Календари">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Календари проекта и ресурсов</h2>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Производственный календарь проекта, праздники и персональные отсутствия ресурсов.</p>
        </div>
        <div className="ml-auto">
          {isResourceView && selRes ? (
            <AbsenceDialog onSubmit={doAbsence}><Button variant="default" size="sm" disabled={busy}><UserPlus className="size-3.5" aria-hidden />Исключение</Button></AbsenceDialog>
          ) : <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Клик по дню сетки — добавить/снять праздник</span>}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        Реальный контракт: PlanCalendar (5×8, рабочая неделя read-only) + calendar.exception.upsert (праздник для всех — resourceId=null, отсутствие — по ресурсу). Ёмкость пересчитывается. Данные in-memory.
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* LEFT: календари/ресурсы */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Календари · ресурсы</div>
          <button type="button" onClick={() => setSelCal("project")} className={cn("flex w-full items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2 text-left hover:bg-[var(--panel-subtle)]", !isResourceView && "bg-[var(--accent-soft)]")}>
            <span className="flex items-center gap-2"><CalendarDays className="size-4 text-[var(--accent)]" aria-hidden /><span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Календарь проекта</span></span>
            <span className="rounded-full bg-[var(--accent-soft)] px-1.5 text-[10px] font-semibold text-[var(--accent)]">проект</span>
          </button>
          <div className="max-h-[520px] overflow-auto">
            {RESOURCES.map((r) => {
              const cnt = model.absByResDay.get(r.id)?.size ?? 0;
              const active = selCal === r.id;
              return (
                <button key={r.id} type="button" onClick={() => setSelCal(r.id)} className={cn("flex w-full items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-1.5 text-left hover:bg-[var(--panel-subtle)]", active && "bg-[var(--accent-soft)]")}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--panel-strong)] text-[9px] font-semibold text-[var(--muted-strong)]">{r.name.slice(0, 1)}</span>
                    <span className="min-w-0"><span className="block truncate text-[length:var(--text-sm)] text-[var(--text)]">{r.name}</span><span className="block truncate text-[10px] text-[var(--muted-soft)]">{r.positionName}</span></span>
                  </span>
                  {cnt > 0 ? <span className="shrink-0 rounded-full bg-[var(--warning-soft)] px-1.5 text-[10px] font-semibold text-[var(--warning-text)]">правил · {cnt}</span> : <span className="shrink-0 rounded-full bg-[var(--panel-strong)] px-1.5 text-[10px] font-medium text-[var(--muted-soft)]">наследует</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* MIDDLE: месячная сетка */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-0.5 py-0.5">
              <button type="button" onClick={() => setMonthOffset((o) => Math.max(0, o - 1))} disabled={monthOffset <= 0} className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-40" aria-label="Предыдущий месяц"><ChevronLeft className="size-4" aria-hidden /></button>
              <span className="min-w-[120px] text-center text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{monthLabel}</span>
              <button type="button" onClick={() => setMonthOffset((o) => Math.min(model.monthsList.length - 1, o + 1))} disabled={monthOffset >= model.monthsList.length - 1} className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-40" aria-label="Следующий месяц"><ChevronRight className="size-4" aria-hidden /></button>
            </div>
            <span className="text-[length:var(--text-sm)] text-[var(--muted)]">{isResourceView && selRes ? `${selRes.name} · наследует календарь проекта` : "Календарь проекта · базовый"}</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-strong)]">Пн–Пт</span>
              <span className="rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-strong)]">8 ч/день</span>
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DOW_SHORT.map((d) => <div key={d} className="py-1 text-center text-[length:var(--text-xs)] font-semibold text-[var(--muted-soft)]">{d}</div>)}
            {grid.map((day) => {
              const st = dayState(day);
              const dt = new Date(BASE_MS + day * 86_400_000);
              const clickable = st.inMonth && !st.weekend && !(isResourceView && st.holiday);
              const tone = st.holiday ? "border-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_28%,var(--panel))] text-[color-mix(in_oklab,var(--warning-text)_80%,#000)]" : st.absence ? "border-[var(--violet)] bg-[color-mix(in_oklab,var(--violet)_30%,var(--panel))] text-[var(--violet)]" : st.weekend ? "border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--muted-soft)_22%,var(--panel))] text-[var(--muted-strong)]" : "border-[var(--border-subtle)] bg-[var(--panel-subtle)] text-[var(--text)]";
              return (
                <button key={day} type="button" disabled={!clickable || busy} onClick={() => toggleDay(day)} title={st.holiday ? `${ddmm(dayToIso(day))} · ${st.holiday.reason || "Праздник"}` : st.absence ? `${ddmm(dayToIso(day))} · ${st.absence.reason || "Отсутствие"}` : st.weekend ? "Выходной" : "Рабочий день — клик: нерабочий"} className={cn("relative flex h-[58px] flex-col rounded-[var(--radius-sm)] border p-1 text-left outline-none transition-colors", tone, !st.inMonth && "opacity-35", clickable && "hover:ring-1 hover:ring-[var(--accent)]")}>
                  <span className="text-[length:var(--text-xs)] font-semibold tabular-nums">{dt.getUTCDate()}</span>
                  <span className="mt-auto self-end text-[10px] font-medium">{st.holiday ? "праздник" : st.absence ? (st.absence.reason || "отсутствие").toLowerCase() : st.weekend ? "" : "8 ч"}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--muted-soft)]">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-[var(--panel-subtle)] ring-1 ring-[var(--border-subtle)]" /> рабочий 8 ч</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded" style={{ background: "color-mix(in oklab, var(--muted-soft) 22%, var(--panel))" }} /> выходной</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded ring-1 ring-[var(--warning)]" style={{ background: "color-mix(in oklab, var(--warning) 28%, var(--panel))" }} /> праздник</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded" style={{ background: "color-mix(in oklab, var(--violet) 30%, var(--panel))", boxShadow: "inset 0 0 0 1px var(--violet)" }} /> отсутствие</span>
          </div>
        </div>

        {/* RIGHT: исключения + конфликты */}
        <div className="flex flex-col gap-3">
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Исключения {isResourceView && selRes ? `· ${selRes.name}` : "· праздники"}</div>
            <div className="max-h-[300px] overflow-auto">
              {listExc.length === 0 ? <div className="px-3 py-4 text-center text-[length:var(--text-sm)] text-[var(--muted)]">Нет исключений.</div> : listExc.map((x) => (
                <div key={x.id} className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-1.5 last:border-b-0">
                  <span className={cn("inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold", x.resourceId === null ? "bg-[var(--warning-soft)] text-[var(--warning-text)]" : "bg-[color-mix(in_oklab,var(--violet)_16%,var(--panel))] text-[var(--violet)]")}>{x.resourceId === null ? "праздник" : (x.reason || "отсутствие")}</span>
                  <span className="mono min-w-0 flex-1 truncate text-[length:var(--text-xs)] text-[var(--muted-strong)]">{ddmm(x.date)}{x.resourceId && x.resourceId !== selCal ? ` · ${resOf(x.resourceId)?.name ?? ""}` : ""}</span>
                  <button type="button" onClick={() => removeExc(x)} disabled={busy} className="grid size-5 shrink-0 place-items-center rounded text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--danger)]" title="Снять исключение"><X className="size-3.5" aria-hidden /></button>
                </div>
              ))}
            </div>
          </div>

          {model.conflicts.length > 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-[length:var(--text-xs)] text-[var(--warning-text)]">
              <div className="mb-1 flex items-center gap-1.5 font-semibold"><TriangleAlert className="size-3.5" aria-hidden />Конфликт с расписанием</div>
              <p>Задача «{model.conflicts[0]!.task.wbsCode} {model.conflicts[0]!.task.title}» запланирована на нерабочий день ({ddmm(dayToIso(model.conflicts[0]!.day))}).{model.conflicts.length > 1 ? ` И ещё ${model.conflicts.length - 1}.` : ""}</p>
              <button type="button" title="Демо-прототип: переход на График появится в приложении" className="mt-2 cursor-default rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--panel)] px-2 py-1 font-medium text-[var(--warning-text)]">Открыть График</button>
            </div>
          ) : null}
        </div>
      </div>

      {notice ? <div className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </DeliveryFrame>
  );
}
