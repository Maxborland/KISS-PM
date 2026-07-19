"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { CapacityDayLoad, CapacityMatrixDayInfo, CapacityMatrixRow, OrgCapacityTree } from "@kiss-pm/domain";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { useCapacityTree, useProjects } from "@/workspace/lib/use-workspace";
import { cn } from "@/lib/cn";

/* ============================================================
   Workspace — поверхность «Загрузка» (Р10): дерево загрузки ресурсов
   организации за период. Боевой контракт: GET /api/workspace/capacity/tree
   ?monthIso=YYYY-MM[&projectId=…] (registerCapacityRoutes; RBAC
   tenant.project_resources.read, фильтр по проекту дополнительно требует
   tenant.projects.read — сервер отвечает 403, поверхность прячет фильтр,
   если список проектов недоступен).

   Матрица: ресурсы × дни периода (месяц или неделя внутри месяца —
   контракт месячный, неделя нарезается на клиенте). Ячейка — часы
   нагрузки; подсветка: перегруз var(--danger-*), высокая загрузка
   var(--warning-*). Состояния — только через <SurfaceState>.
   ============================================================ */

// ---- Чистые помощники периода (тестируются напрямую) ----

/** Сдвиг месяца YYYY-MM на delta месяцев (в обе стороны, через границы года). */
export function shiftMonthIso(monthIso: string, delta: number): string {
  const [yearText, monthText] = monthIso.split("-");
  const total = Number.parseInt(yearText ?? "0", 10) * 12 + (Number.parseInt(monthText ?? "1", 10) - 1) + delta;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12 + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

/** «Июль 2026» из YYYY-MM; невалидную строку отдаём как есть. */
export function capacityMonthLabel(monthIso: string): string {
  const month = Number.parseInt(monthIso.slice(5, 7), 10);
  const name = MONTHS_RU[month - 1];
  return name ? `${name} ${monthIso.slice(0, 4)}` : monthIso;
}

/** Нарезка дней месяца на календарные недели (новая неделя — с понедельника). */
export function splitCapacityWeeks<T extends { isoWeekday: number }>(days: readonly T[]): T[][] {
  const weeks: T[][] = [];
  for (const day of days) {
    const current = weeks[weeks.length - 1];
    if (!current || day.isoWeekday === 1) weeks.push([day]);
    else current.push(day);
  }
  return weeks;
}

// ---- Чистые помощники матрицы ----

export type CapacityCellTone = "danger" | "warning" | "ok" | "free" | "idle";

/** Тон ячейки дня: перегруз → danger, высокая загрузка (heat 3) → warning,
    есть работа → ok, нерабочий день → free, рабочий без нагрузки → idle. */
export function capacityCellTone(day: CapacityDayLoad): CapacityCellTone {
  if (day.isOverload) return "danger";
  if (day.heat === 3) return "warning";
  if (day.workMinutes > 0) return "ok";
  if (day.isWeekend || day.isHoliday || day.isFreeDay || day.hasAbsence) return "free";
  return "idle";
}

export type CapacitySection = { key: string; title: string; rows: CapacityMatrixRow[] };

/** Плоские секции таблицы из дерева: направление · отдел · должность → строки ресурсов.
    Служебные «—»-узлы (Без оргструктуры) схлопываются до имени направления. */
export function flattenCapacityTree(tree: OrgCapacityTree): CapacitySection[] {
  const sections: CapacitySection[] = [];
  for (const direction of tree.orgGroups) {
    for (const unit of direction.units) {
      for (const position of unit.positions) {
        if (position.rows.length === 0) continue;
        const parts = [direction.direction.name, unit.unit.name, position.position.name]
          .filter((part) => part && part !== "—");
        sections.push({
          key: `${direction.direction.id}:${unit.unit.id}:${position.position.id}`,
          title: parts.join(" · ") || "Без оргструктуры",
          rows: position.rows
        });
      }
    }
  }
  // Legacy-ветки контракта (groups/unassignedRows) — на случай не-org дерева.
  for (const group of tree.groups) {
    if (group.rows.length === 0) continue;
    sections.push({ key: `position:${group.position.id}`, title: group.position.name, rows: group.rows });
  }
  if (tree.unassignedRows.length > 0) {
    sections.push({ key: "unassigned", title: "Без должности", rows: tree.unassignedRows });
  }
  return sections;
}

/** Суммы нагрузки/ёмкости/перегруза по видимым дням строки. */
export function sumCapacityDays(days: readonly CapacityDayLoad[]): {
  workMinutes: number;
  capacityMinutes: number;
  overloadMinutes: number;
} {
  let workMinutes = 0;
  let capacityMinutes = 0;
  let overloadMinutes = 0;
  for (const day of days) {
    workMinutes += day.workMinutes;
    capacityMinutes += day.capacityMinutes;
    overloadMinutes += day.overloadMinutes;
  }
  return { workMinutes, capacityMinutes, overloadMinutes };
}

/** Минуты → часы для ячеек: «6» / «7,5». */
export const formatHours = (minutes: number): string =>
  (minutes / 60).toLocaleString("ru-RU", { maximumFractionDigits: 1 });

// RU-маппер кодов ошибок (локальный, как в соседних поверхностях).
const ERR_RU: Record<string, string> = {
  capacity_invalid_query: "Некорректный период или фильтр запроса",
  persistence_not_configured: "Хранилище данных не настроено",
  load_failed: "Не удалось загрузить данные о загрузке",
  request_failed: "Запрос не выполнен",
  invalid_json_response: "Некорректный ответ сервера"
};
export const capacityErrorMessage = (code?: string) =>
  (code && ERR_RU[code]) || (code ? "Запрос не выполнен" : "Не удалось загрузить");

const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// ISO-дата → ДД.ММ (заголовок недельного периода, title ячеек).
const fmtDayMonth = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

const CELL_TONE_CLS: Record<CapacityCellTone, string> = {
  danger: "bg-[var(--danger-soft)] font-semibold text-[var(--danger-text)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning-text)]",
  ok: "text-[var(--text)]",
  free: "bg-[var(--panel-subtle)] text-[var(--muted-soft)]",
  idle: "text-[var(--muted-soft)]"
};

type CapacityView = "month" | "week";

export function CapacitySurface() {
  const [monthIso, setMonthIso] = useState(() => new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<CapacityView>("month");
  const [weekIndex, setWeekIndex] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);

  const { data: tree, status, error, reload } = useCapacityTree(monthIso, projectId);
  // Фильтр по проекту: отдельное право (tenant.projects.read) — при forbidden/ошибке
  // списка проектов контрол не показываем (честность: нет рабочего пути — нет контрола).
  const projectsRes = useProjects();
  const filterProjects = projectsRes.status === "ready" ? (projectsRes.data?.projects ?? []) : [];

  const weeks = useMemo(() => (tree ? splitCapacityWeeks(tree.days) : []), [tree]);
  const clampedWeek = Math.min(weekIndex, Math.max(0, weeks.length - 1));
  const visibleDays: CapacityMatrixDayInfo[] =
    view === "month" ? tree?.days ?? [] : weeks[clampedWeek] ?? [];

  const sections = useMemo(() => (tree ? flattenCapacityTree(tree) : []), [tree]);
  const hasRows = sections.some((section) => section.rows.length > 0);

  const goPrev = () => {
    if (view === "month" || clampedWeek === 0) {
      setMonthIso(shiftMonthIso(monthIso, -1));
      // Неделя: с первой недели уходим на последнюю неделю предыдущего месяца (clamp после загрузки).
      setWeekIndex(view === "week" ? Number.MAX_SAFE_INTEGER : 0);
      return;
    }
    setWeekIndex(clampedWeek - 1);
  };
  const goNext = () => {
    if (view === "month" || clampedWeek >= weeks.length - 1) {
      setMonthIso(shiftMonthIso(monthIso, 1));
      setWeekIndex(0);
      return;
    }
    setWeekIndex(clampedWeek + 1);
  };

  const periodLabel =
    view === "month" || visibleDays.length === 0
      ? capacityMonthLabel(monthIso)
      : `${fmtDayMonth(visibleDays[0]!.date)} — ${fmtDayMonth(visibleDays[visibleDays.length - 1]!.date)} · ${capacityMonthLabel(monthIso)}`;

  const surfaceStatus = (() => {
    const base = surfaceStatusOf(status, tree !== null);
    return base === "ready" && !hasRows ? ("empty" as const) : base;
  })();

  return (
    <WorkspaceShell activeNav="Загрузка">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Загрузка ресурсов</h1>
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">
              Нагрузка и ёмкость сотрудников по дням периода
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filterProjects.length > 0 ? (
              <Select
                value={projectId ?? "all"}
                onValueChange={(value) => setProjectId(value === "all" ? null : value)}
              >
                <SelectTrigger size="sm" aria-label="Фильтр по проекту" className="max-w-[260px]">
                  <SelectValue placeholder="Все проекты" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все проекты</SelectItem>
                  {filterProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Segmented
              name="capacity-view"
              value={view}
              onChange={(next) => {
                setView(next);
                setWeekIndex(0);
              }}
              options={[
                { value: "month", label: "Месяц" },
                { value: "week", label: "Неделя" }
              ]}
            />
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" aria-label="Предыдущий период" onClick={goPrev}>
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <span className="min-w-[130px] text-center text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
                {periodLabel}
              </span>
              <Button variant="outline" size="sm" aria-label="Следующий период" onClick={goNext}>
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={capacityErrorMessage}
          loadingLabel="Загрузка данных о ресурсах…"
          empty={{
            title: "Нет данных о загрузке",
            description: projectId
              ? "По выбранному проекту в этом месяце нет ресурсов с нагрузкой. Снимите фильтр или выберите другой период."
              : "В этом месяце нет ресурсов с рассчитанной загрузкой."
          }}
          forbidden={{
            title: "Доступ ограничен",
            description: "Для просмотра загрузки нужно право чтения ресурсов проектов."
          }}
        >
          <CapacityMatrix sections={sections} days={visibleDays} allDays={tree?.days ?? []} />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-[var(--danger-soft)] ring-1 ring-inset ring-[var(--danger)]" aria-hidden /> Перегруз (нагрузка выше ёмкости)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-[var(--warning-soft)] ring-1 ring-inset ring-[var(--warning)]" aria-hidden /> Высокая загрузка
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-[var(--panel-subtle)] ring-1 ring-inset ring-[var(--border)]" aria-hidden /> Нерабочий день
            </span>
          </div>
        </SurfaceState>
      </main>
    </WorkspaceShell>
  );
}

/* Матрица «ресурсы × дни»: секции (направление · отдел · должность) → строки сотрудников.
   days — видимые колонки (месяц/неделя); allDays — весь месяц, по нему индексируются
   day-массивы строк (visibleSlice по датам). Итог считается по видимым дням. */
function CapacityMatrix({
  sections,
  days,
  allDays
}: {
  sections: CapacitySection[];
  days: CapacityMatrixDayInfo[];
  allDays: CapacityMatrixDayInfo[];
}) {
  const firstVisibleIndex = allDays.findIndex((day) => day.date === days[0]?.date);
  const sliceDays = (rowDays: CapacityDayLoad[]): CapacityDayLoad[] =>
    firstVisibleIndex < 0 ? [] : rowDays.slice(firstVisibleIndex, firstVisibleIndex + days.length);

  return (
    <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <table className="w-full border-collapse text-[length:var(--text-sm)]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
            <th className="sticky left-0 z-10 min-w-[180px] bg-[var(--panel-subtle)] px-3 py-2 font-semibold">Ресурс</th>
            {days.map((day) => (
              <th
                key={day.date}
                className={cn(
                  "min-w-[44px] px-1 py-2 text-center font-semibold",
                  (day.isWeekend || day.isHoliday) && "text-[var(--muted-soft)]/70"
                )}
              >
                <span className="v4-num block">{day.date.slice(8, 10)}</span>
                <span className="block font-normal normal-case">{WEEKDAY_SHORT[day.isoWeekday - 1]}</span>
              </th>
            ))}
            <th className="min-w-[104px] px-3 py-2 text-right font-semibold">Итог, ч</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <SectionRows key={section.key} section={section} colSpan={days.length + 2} sliceDays={sliceDays} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionRows({
  section,
  colSpan,
  sliceDays
}: {
  section: CapacitySection;
  colSpan: number;
  sliceDays: (rowDays: CapacityDayLoad[]) => CapacityDayLoad[];
}) {
  return (
    <>
      <tr className="border-b border-[var(--border-subtle)] bg-[var(--panel-subtle)]/60">
        <td
          colSpan={colSpan}
          className="sticky left-0 px-3 py-1.5 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.04em] text-[var(--muted-strong)]"
        >
          {section.title}
        </td>
      </tr>
      {section.rows.map((row) => {
        const visible = sliceDays(row.days);
        const totals = sumCapacityDays(visible);
        const overloaded = totals.overloadMinutes > 0;
        return (
          <tr key={row.user.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--panel-subtle)]">
            <td className="sticky left-0 z-[1] bg-[var(--panel)] px-3 py-2">
              <span className="block font-medium text-[var(--text-strong)]">{row.user.name}</span>
              {row.user.positionName ? (
                <span className="block text-[length:var(--text-xs)] text-[var(--muted-soft)]">{row.user.positionName}</span>
              ) : null}
            </td>
            {visible.map((day) => {
              const tone = capacityCellTone(day);
              const label =
                `${fmtDayMonth(day.date)}: нагрузка ${formatHours(day.workMinutes)} ч из ${formatHours(day.capacityMinutes)} ч` +
                (day.overloadMinutes > 0 ? `, перегруз ${formatHours(day.overloadMinutes)} ч` : "");
              return (
                <td key={day.date} className={cn("px-1 py-2 text-center", CELL_TONE_CLS[tone])} title={label}>
                  <span className="v4-num">{day.workMinutes > 0 ? formatHours(day.workMinutes) : "—"}</span>
                </td>
              );
            })}
            <td className="px-3 py-2 text-right">
              <span className={cn("v4-num font-semibold", overloaded ? "text-[var(--danger)]" : "text-[var(--text-strong)]")}>
                {formatHours(totals.workMinutes)} / {formatHours(totals.capacityMinutes)}
              </span>
              {overloaded ? (
                <span className="mt-0.5 block">
                  <Chip variant="danger">+{formatHours(totals.overloadMinutes)} ч сверх</Chip>
                </span>
              ) : null}
            </td>
          </tr>
        );
      })}
    </>
  );
}
