"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, TriangleAlert, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, deriveProjectMeta, planningErr, useProjectBase } from "@/delivery/lib/project-chrome";
import { NON_WORKING_TONE } from "@/delivery/ui/non-working-tones";
import { dayToIso, isoToDay, MOCK_PROJECT_ID } from "@/delivery/lib/planning-demo-data";
import { buildProjectMonthKeys, currentPlanDate, monthGridDays, planDateFromDay, utcDayOfWeek } from "@/delivery/lib/date-origin";
import { usePlanning } from "@/delivery/lib/use-planning";
import { resolveProjectCalendar } from "@/delivery/lib/project-calendar";
import { usePlanningRuntime } from "@/delivery/lib/planning-runtime";
import { useResourceDirectory } from "@/delivery/lib/use-resource-directory";
import { hasPermission } from "@/lib/permissions";
import { useSessionUser } from "@/shell/use-session-user";
import { AbsenceDialog } from "@/delivery/resources/resources-editors";
import { createClientId } from "@/delivery/lib/client-id";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { createPlanningCommand } from "@kiss-pm/domain";
import type { PlanningCommand, PlanCalendar, PlanCalendarException, PlanTask } from "@kiss-pm/domain";

const PROJECT: ProjectMeta = { name: "Производственный портал · Релиз 2", code: "ПР", status: "В работе", statusTone: "info", planVersion: "v17", deadline: "12.07.2026", finish: "14.06.2026", variance: { label: "+2 дня к базовому плану B2", tone: "warning" } };
const MONTHS_CAP = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const DOW_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DOW_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const ddmm = (iso: string) => { const d = new Date(iso + "T00:00:00Z"); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`; };

const nid = createClientId;
const PLAN_MANAGE_PERMISSION = "tenant.project_plan.manage";
const RESOURCE_MANAGE_PERMISSION = "tenant.project_resources.manage";

function absenceRangeForMonth(monthKey: string, projectStart?: string | null, projectFinish?: string | null) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    const fallback = currentPlanDate();
    return { start: fallback, finish: fallback };
  }
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = `${monthKey}-01`;
  const monthFinish = new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
  const start = projectStart && projectStart >= monthStart && projectStart <= monthFinish
    ? projectStart
    : monthStart;
  const fiveDayFinish = dayToIso(Math.min(isoToDay(start) + 4, isoToDay(monthFinish)));
  const finish = projectFinish && projectFinish >= start && projectFinish < fiveDayFinish
    ? projectFinish
    : fiveDayFinish;
  return { start, finish };
}

export function canManageCalendarControls({ live, permissions, scope = "project" }: { live: boolean; permissions: readonly string[]; scope?: "project" | "resource" }): boolean {
  return !live || hasPermission(permissions, scope === "resource" ? RESOURCE_MANAGE_PERMISSION : PLAN_MANAGE_PERMISSION);
}

export function ProjectCalendars({ projectId = MOCK_PROJECT_ID }: { projectId?: string }) {
  const { live } = usePlanningRuntime();
  const sessionUser = useSessionUser();
  const canManagePlan = canManageCalendarControls({ live, permissions: sessionUser?.permissions ?? [] });
  const canManageResources = canManageCalendarControls({ live, permissions: sessionUser?.permissions ?? [], scope: "resource" });
  const { readModel, status, error, reload, apply, applyBatch } = usePlanning(projectId);
  const projectBase = useProjectBase(projectId, PROJECT);
  const resDir = useResourceDirectory();
  const [selCal, setSelCal] = useState<string>("project"); // "project" | resourceId
  const [monthOffset, setMonthOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const projectCalendar = useMemo(
    () => readModel ? resolveProjectCalendar({ project: readModel.project, calendars: readModel.calendars }) : null,
    [readModel]
  );

  const model = useMemo(() => {
    if (!readModel || !projectCalendar) return null;
    // Календарь, по которому реально считается расписание, выбирается только через project.calendarId.
    const cal = projectCalendar;
    const exns = readModel.calendarExceptions ?? [];
    const full = cal.workingMinutesPerDay;
    // нерабочие исключения (workingMinutes < полного дня): праздники (resourceId=null) и отсутствия
    const active = exns.filter((x) => x.calendarId === cal.id && x.workingMinutes < full);
    const holidayByDay = new Map<number, PlanCalendarException>();
    const absByResDay = new Map<string, Map<number, PlanCalendarException>>();
    for (const x of active) {
      const day = isoToDay(x.date);
      if (x.resourceId === null) holidayByDay.set(day, x);
      else { let m = absByResDay.get(x.resourceId); if (!m) { m = new Map(); absByResDay.set(x.resourceId, m); } m.set(day, x); }
    }
    // ВСЕ исключения календаря проекта (включая реактивированные workingMinutes=full): чтобы повторный тогл
    // off→on переиспользовал существующий id записи на эту дату/ресурс, а не плодил дубликат (десинк ёмкости).
    const anyHolidayByDay = new Map<number, PlanCalendarException>();
    const anyAbsByResDay = new Map<string, Map<number, PlanCalendarException>>();
    for (const x of exns) {
      if (x.calendarId !== cal.id) continue;
      const day = isoToDay(x.date);
      if (x.resourceId === null) anyHolidayByDay.set(day, x);
      else { let m = anyAbsByResDay.get(x.resourceId); if (!m) { m = new Map(); anyAbsByResDay.set(x.resourceId, m); } m.set(day, x); }
    }
    const authored = readModel.authored;
    const calc = readModel.calculatedPlan.tasks;
    const calcById = new Map(calc.map((c) => [c.id, c]));
    const leafTasks = authored.tasks.filter((t) => t.durationMinutes != null);
    // конфликты: задача, чей интервал пересекает праздник (нерабочий день календаря)
    const conflicts = leafTasks.map((t) => {
      const c = calcById.get(t.id); if (!c || !c.calculatedStart || !c.calculatedFinish) return null;
      // calculatedStart/Finish nullable (задача без расписания) — пропускаем, иначе NaN-границы цикла молча
      // отключают детекцию конфликтов.
      const es = isoToDay(c.calculatedStart), ef = isoToDay(c.calculatedFinish);
      for (let d = es; d < Math.max(ef, es + 1); d++) if (holidayByDay.has(d)) return { task: t, day: d };
      return null;
    }).filter((x): x is { task: PlanTask; day: number } => x !== null);
    const monthsList = buildProjectMonthKeys({
      projectStartIso: readModel.project.plannedStart,
      projectFinishIso: readModel.project.plannedFinish,
      calculatedStarts: calc.map((c) => c.calculatedStart),
      calculatedFinishes: calc.map((c) => c.calculatedFinish),
      fallbackIso: currentPlanDate()
    });
    return { cal, full, holidayByDay, absByResDay, anyHolidayByDay, anyAbsByResDay, leafTasks, conflicts, monthsList };
  }, [readModel, projectCalendar]);

  const firstHorizonMonth = model?.monthsList[0] ?? null;
  useEffect(() => {
    setMonthOffset(0);
  }, [projectId, firstHorizonMonth]);

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error);
  // готовый контент — только при наличии model+readModel. Frame-обёртку сохраняем.
  if (status !== "ready" || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={{ ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code }} projectId={projectId} activeTab="Календари">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка календарей…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const projectMeta = deriveProjectMeta(readModel, projectBase);
  if (!projectCalendar || !model) {
    return (
      <DeliveryFrame project={projectMeta} projectId={projectId} activeTab="Календари">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Календари проекта и ресурсов</h2>
          <div role="status" className="mt-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-8 text-center text-[length:var(--text-sm)] text-[var(--muted)] shadow-[var(--shadow-card)]">
            Календарь проекта не настроен. Исключения и отсутствия недоступны до выбора календаря.
          </div>
        </div>
      </DeliveryFrame>
    );
  }
  const workweekLabel = model.cal.workingWeekdays.map((day) => DOW_RU[day] ?? "?").join(", ");
  const workdayHours = (model.full / 60).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  const focusMonth = model.monthsList[Math.max(0, Math.min(monthOffset, model.monthsList.length - 1))] ?? "";
  const monthLabel = focusMonth ? `${MONTHS_CAP[Number(focusMonth.slice(5, 7)) - 1]} ${focusMonth.slice(0, 4)}` : "";
  const absenceRange = absenceRangeForMonth(focusMonth, readModel.project.plannedStart, readModel.project.plannedFinish);
  const isResourceView = selCal !== "project";
  const selRes = isResourceView ? resDir.of(selCal) : null;
  const absMap = isResourceView ? model.absByResDay.get(selCal) ?? new Map<number, PlanCalendarException>() : new Map<number, PlanCalendarException>();

  // сетка месяца: 6 недель × 7 дней, начиная с понедельника
  const grid: number[] = focusMonth ? monthGridDays(focusMonth) : [];
  const dayState = (day: number) => {
    const inMonth = dayToIso(day).slice(0, 7) === focusMonth;
    const weekend = !model.cal.workingWeekdays.includes(utcDayOfWeek(day));
    const holiday = model.holidayByDay.get(day) ?? null;
    const absence = isResourceView ? absMap.get(day) ?? null : null;
    return { inMonth, weekend, holiday, absence, working: !weekend && !holiday && !absence };
  };

  async function applyCmd(command: PlanningCommand, okMsg: string) {
    const allowed = command.type === "calendar.exception.upsert" && command.payload.resourceId !== null
      ? canManageResources
      : canManagePlan;
    if (!allowed) return;
    setBusy(true);
    const res = await apply(command);
    setBusy(false);
    if (res.ok) toast.success(`${okMsg} · коммит v${res.planVersion}`);
    else toast.error(res.conflict ? "Конфликт версий — перезагружено" : `Отклонено: ${res.issues?.[0]?.message ?? res.message}`);
  }

  // клик по дню: тогл праздника (вид проекта) или отсутствия (вид ресурса). Восстановление = рабочие минуты.
  const toggleDay = (day: number) => {
    if (isResourceView ? !canManageResources : !canManagePlan) return;
    const st = dayState(day);
    if (st.weekend) return; // выходные задаются календарём (read-only)
    if (!isResourceView) {
      if (st.holiday) void applyCmd(createPlanningCommand({ type: "calendar.exception.upsert", payload: { id: st.holiday.id, calendarId: model.cal.id, resourceId: null, date: dayToIso(day), workingMinutes: model.full, reason: "" } }), "Праздник снят");
      // переиспользуем id уже существующей записи на эту дату (в т.ч. реактивированной), иначе минтим новую — без дубликата
      else { const existing = model.anyHolidayByDay.get(day); void applyCmd(createPlanningCommand({ type: "calendar.exception.upsert", payload: { id: existing?.id ?? nid("hol"), calendarId: model.cal.id, resourceId: null, date: dayToIso(day), workingMinutes: 0, reason: "Праздник" } }), "Праздник добавлен"); }
    } else {
      if (st.holiday) return; // праздник — общий, снимается в календаре проекта
      if (st.absence) void applyCmd(createPlanningCommand({ type: "calendar.exception.upsert", payload: { id: st.absence.id, calendarId: model.cal.id, resourceId: selCal, date: dayToIso(day), workingMinutes: model.full, reason: "" } }), "Отсутствие снято");
      else { const existing = model.anyAbsByResDay.get(selCal)?.get(day); void applyCmd(createPlanningCommand({ type: "calendar.exception.upsert", payload: { id: existing?.id ?? nid("ex"), calendarId: model.cal.id, resourceId: selCal, date: dayToIso(day), workingMinutes: 0, reason: "Отсутствие" } }), "Отсутствие добавлено"); }
    }
  };
  const removeExc = (x: PlanCalendarException) => void applyCmd(createPlanningCommand({ type: "calendar.exception.upsert", payload: { id: x.id, calendarId: x.calendarId, resourceId: x.resourceId, date: x.date, workingMinutes: model.full, reason: "" } }), "Исключение снято");

  const doAbsence = async (resourceId: string, typeLabel: string, start: string, finish: string) => {
    if (!canManageResources) return;
    const cmds: PlanningCommand[] = [];
    const end = isoToDay(finish);
    for (let d = isoToDay(start); d <= end; d += 1) {
      // только рабочие дни диапазона: пропускаем выходные и праздники
      if (!model.cal.workingWeekdays.includes(utcDayOfWeek(d)) || model.holidayByDay.has(d)) continue;
      cmds.push(createPlanningCommand({ type: "calendar.exception.upsert", payload: { id: nid("ex"), calendarId: model.cal.id, resourceId, date: dayToIso(d), workingMinutes: 0, reason: typeLabel } }));
    }
    if (cmds.length === 0) { toast.error("В выбранном диапазоне нет рабочих дней"); return; }
    setBusy(true);
    const res = await applyBatch(cmds);
    setBusy(false);
    if (res.ok) toast.success(`${typeLabel} добавлен · коммит v${res.planVersion}`);
    else toast.error(`Отклонено: ${res.message}`);
  }

  // правый столбец: список исключений (праздники + отсутствия выбранного ресурса)
  const listExc: PlanCalendarException[] = [
    ...[...model.holidayByDay.values()],
    ...(isResourceView ? [...absMap.values()] : [])
  ].sort((a, b) => isoToDay(a.date) - isoToDay(b.date));

  return (
    <DeliveryFrame project={projectMeta} projectId={projectId} activeTab="Календари">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Календари проекта и ресурсов</h2>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Производственный календарь проекта, праздники и персональные отсутствия ресурсов.</p>
        </div>
        <div className="ml-auto">
          {(isResourceView ? canManageResources : canManagePlan) ? (isResourceView && selRes ? (
            <AbsenceDialog
              onSubmit={doAbsence}
              resources={resDir.list}
              initialResourceId={selCal}
              initialStart={absenceRange.start}
              initialFinish={absenceRange.finish}
            ><Button variant="default" size="sm" disabled={busy}><UserPlus className="size-3.5" aria-hidden />Исключение</Button></AbsenceDialog>
          ) : <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Клик по дню сетки — добавить/снять праздник</span>) : null}
        </div>
      </div>

      {prototypeNotesEnabled ? (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          Реальный контракт: PlanCalendar (рабочая неделя и длительность дня read-only) + calendar.exception.upsert (праздник для всех, отсутствие по ресурсу). Ёмкость пересчитывается. Данные in-memory.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* LEFT: календари/ресурсы */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Календари · ресурсы</div>
          <button data-testid="calendar-project-selector" type="button" onClick={() => setSelCal("project")} className={cn("flex w-full items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2 text-left hover:bg-[var(--panel-subtle)]", !isResourceView && "bg-[var(--accent-soft)]")}>
            <span className="flex items-center gap-2"><CalendarDays className="size-4 text-[var(--accent)]" aria-hidden /><span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Календарь проекта</span></span>
            <span className="rounded-full bg-[var(--accent-soft)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--accent)]">проект</span>
          </button>
          <div className="max-h-[520px] overflow-auto">
            {resDir.list.map((r) => {
              const cnt = model.absByResDay.get(r.id)?.size ?? 0;
              const active = selCal === r.id;
              return (
                <button key={r.id} data-testid={`calendar-resource-${r.id}`} type="button" onClick={() => setSelCal(r.id)} className={cn("flex w-full items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-1.5 text-left hover:bg-[var(--panel-subtle)]", active && "bg-[var(--accent-soft)]")}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--panel-strong)] text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{r.name.slice(0, 1)}</span>
                    <span className="min-w-0"><span className="block truncate text-[length:var(--text-sm)] text-[var(--text)]">{r.name}</span><span className="block truncate text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{r.positionName}</span></span>
                  </span>
                  {cnt > 0 ? <span data-testid={`calendar-resource-badge-${r.id}`} className="shrink-0 rounded-full bg-[var(--warning-soft)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--warning-text)]">правил · {cnt}</span> : <span data-testid={`calendar-resource-badge-${r.id}`} className="shrink-0 rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-medium text-[var(--muted-soft)]">наследует</span>}
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
              <span data-testid="calendar-month-label" data-month-key={focusMonth} className="min-w-[120px] text-center text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{monthLabel}</span>
              <button type="button" onClick={() => setMonthOffset((o) => Math.min(model.monthsList.length - 1, o + 1))} disabled={monthOffset >= model.monthsList.length - 1} className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-40" aria-label="Следующий месяц"><ChevronRight className="size-4" aria-hidden /></button>
            </div>
            <span className="text-[length:var(--text-sm)] text-[var(--muted)]">{isResourceView && selRes ? `${selRes.name} · наследует календарь проекта` : "Календарь проекта · базовый"}</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-[length:var(--text-2xs)] font-medium text-[var(--muted-strong)]">{workweekLabel}</span>
              <span className="rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-[length:var(--text-2xs)] font-medium text-[var(--muted-strong)]">{workdayHours} ч/день</span>
            </span>
          </div>
          <div data-testid="calendar-month-grid" className="grid grid-cols-7 gap-1">
            {DOW_SHORT.map((d) => <div key={d} className="py-1 text-center text-[length:var(--text-xs)] font-semibold text-[var(--muted-soft)]">{d}</div>)}
            {grid.map((day) => {
              const st = dayState(day);
              const dt = planDateFromDay(day);
              const canManageView = isResourceView ? canManageResources : canManagePlan;
              const clickable = canManageView && st.inMonth && !st.weekend && !(isResourceView && st.holiday);
              const dayTone = st.holiday ? NON_WORKING_TONE.holiday : st.absence ? NON_WORKING_TONE.absence : st.weekend ? NON_WORKING_TONE.weekend : { bg: "var(--panel-subtle)", fg: "var(--text)", border: "var(--border-subtle)" };
              return (
                <button key={day} data-testid={`calendar-day-${dayToIso(day)}`} data-in-month={st.inMonth ? "true" : "false"} type="button" disabled={!clickable || busy} onClick={() => toggleDay(day)} title={st.holiday ? `${ddmm(dayToIso(day))} · ${st.holiday.reason || "Праздник"}` : st.absence ? `${ddmm(dayToIso(day))} · ${st.absence.reason || "Отсутствие"}` : st.weekend ? "Выходной" : canManageView ? "Рабочий день — клик: нерабочий" : "Рабочий день"} style={{ background: dayTone.bg, color: dayTone.fg, borderColor: dayTone.border }} className={cn("relative flex h-[58px] flex-col rounded-[var(--radius-sm)] border p-1 text-left outline-none transition-colors", !st.inMonth && "opacity-35", clickable && "hover:ring-1 hover:ring-[var(--accent)]")}>
                  <span className="text-[length:var(--text-xs)] font-semibold tabular-nums">{dt.getUTCDate()}</span>
                  <span className="mt-auto self-end text-[length:var(--text-2xs)] font-medium">{st.holiday ? "праздник" : st.absence ? (st.absence.reason || "отсутствие").toLowerCase() : st.weekend ? "" : `${workdayHours} ч`}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-[var(--panel-subtle)] ring-1 ring-[var(--border-subtle)]" /> рабочий {workdayHours} ч</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded" style={{ background: NON_WORKING_TONE.weekend.bg }} /> выходной</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded" style={{ background: NON_WORKING_TONE.holiday.bg, boxShadow: `inset 0 0 0 1px ${NON_WORKING_TONE.holiday.border}` }} /> праздник</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded" style={{ background: NON_WORKING_TONE.absence.bg, boxShadow: `inset 0 0 0 1px ${NON_WORKING_TONE.absence.border}` }} /> отсутствие</span>
          </div>
        </div>

        {/* RIGHT: исключения + конфликты */}
        <div className="flex flex-col gap-3">
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Исключения {isResourceView && selRes ? `· ${selRes.name}` : "· праздники"}</div>
            <div className="max-h-[300px] overflow-auto">
              {listExc.length === 0 ? <div className="px-3 py-4 text-center text-[length:var(--text-sm)] text-[var(--muted)]">Нет исключений.</div> : listExc.map((x) => (
                <div key={x.id} className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-1.5 last:border-b-0">
                  <span className={cn("inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold", x.resourceId === null ? "bg-[var(--warning-soft)] text-[var(--warning-text)]" : "bg-[color-mix(in_oklab,var(--violet)_16%,var(--panel))] text-[var(--violet)]")}>{x.resourceId === null ? "праздник" : (x.reason || "отсутствие")}</span>
                  <span className="mono min-w-0 flex-1 truncate text-[length:var(--text-xs)] text-[var(--muted-strong)]">{ddmm(x.date)}{x.resourceId && x.resourceId !== selCal ? ` · ${resDir.of(x.resourceId)?.name ?? ""}` : ""}</span>
                  {(x.resourceId === null ? canManagePlan : canManageResources) ? <button type="button" onClick={() => removeExc(x)} disabled={busy} className="grid size-5 shrink-0 place-items-center rounded text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--danger)]" title="Снять исключение"><X className="size-3.5" aria-hidden /></button> : null}
                </div>
              ))}
            </div>
          </div>

          {model.conflicts.length > 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-[length:var(--text-xs)] text-[var(--warning-text)]">
              <div className="mb-1 flex items-center gap-1.5 font-semibold"><TriangleAlert className="size-3.5" aria-hidden />Конфликт с расписанием</div>
              <p>Задача «{model.conflicts[0]!.task.wbsCode} {model.conflicts[0]!.task.title}» запланирована на нерабочий день ({ddmm(dayToIso(model.conflicts[0]!.day))}).{model.conflicts.length > 1 ? ` И ещё ${model.conflicts.length - 1}.` : ""}</p>
              <Button asChild variant="secondary" size="sm" className="mt-2"><Link href={`/projects/${projectId}/schedule`}>Открыть График</Link></Button>
            </div>
          ) : null}
        </div>
      </div>

    </DeliveryFrame>
  );
}
