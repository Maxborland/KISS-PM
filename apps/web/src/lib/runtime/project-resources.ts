import type { Project, Task, WorkspaceUser } from "@/lib/api-types";
import {
  aggregateDayCells,
  aggregateRowPercent,
  computeMatrixStats,
  type DayCell,
  type DayHeader,
  type MatrixRow,
  type ResourceMatrixData
} from "@/widgets/resource-matrix";
import { resolvePersonDayLoadLevel } from "@/widgets/resource-matrix/load-level";

type RuntimeResourceDayHeader = DayHeader & { isoDate: string };

export type BuildProjectResourceMatrixDataInput = {
  project: Project;
  tasks: Task[];
  workspaceUsers: WorkspaceUser[];
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RU_WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;
const ASSIGNEE_COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"] as const;
const DAILY_NORM_HOURS = 8;
const MAX_VISIBLE_DAYS = 31;

export function buildProjectResourceMatrixData({
  project,
  tasks,
  workspaceUsers,
  now = new Date()
}: BuildProjectResourceMatrixDataInput): ResourceMatrixData {
  const activeTasks = tasks.filter((task) => task.archivedAt == null);
  const rangeStart = startOfUtcDay(project.plannedStart);
  const rangeFinish = minDate(
    maxDate([
      startOfUtcDay(project.plannedFinish),
      ...activeTasks.flatMap((task) => [
        startOfUtcDay(task.plannedStart),
        startOfUtcDay(task.plannedFinish)
      ])
    ]),
    addDays(rangeStart, MAX_VISIBLE_DAYS - 1)
  );
  const days = buildDays(rangeStart, rangeFinish, now);
  const usersById = new Map(workspaceUsers.map((user) => [user.id, user]));
  const tasksByOwner = groupTasksByOwner(activeTasks);
  const workshopId = `project-resources-${project.id}`;
  const personRows = Array.from(tasksByOwner.entries()).map(([userId, ownerTasks], index) =>
    personRow({
      days,
      index,
      tasks: ownerTasks,
      user: usersById.get(userId),
      userId
    })
  );
  const roleRows = buildRoleRows(personRows, days, workshopId);
  const workshopRow: MatrixRow = {
    id: workshopId,
    kind: "workshop",
    indent: 0,
    name: project.title,
    collapsible: true,
    percent: aggregateRowPercent(personRows, days),
    cells: aggregateDayCells(personRows, days)
  };

  return {
    days,
    rows: personRows.length ? [workshopRow, ...roleRows.flatMap(({ role, people }) => [role, ...people])] : [],
    stats: computeMatrixStats(personRows, days)
  };
}

function groupTasksByOwner(tasks: Task[]): Map<string, Task[]> {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    const ownerTasks = grouped.get(task.ownerUserId) ?? [];
    ownerTasks.push(task);
    grouped.set(task.ownerUserId, ownerTasks);
  }
  return grouped;
}

function personRow({
  days,
  index,
  tasks,
  user,
  userId
}: {
  days: RuntimeResourceDayHeader[];
  index: number;
  tasks: Task[];
  user?: WorkspaceUser | undefined;
  userId: string;
}): MatrixRow {
  const cells = days.map((day) => dayCellForTasks(day, tasks));
  const row: MatrixRow = {
    id: userId,
    kind: "person",
    parentId: roleId(user?.positionName),
    indent: 2,
    name: user?.name ?? `Пользователь ${userId}`,
    avatar: {
      initials: initialsFromName(user?.name ?? userId),
      color: ASSIGNEE_COLORS[index % ASSIGNEE_COLORS.length] ?? "c1"
    },
    cells,
    dailyNormHours: DAILY_NORM_HOURS
  };
  return { ...row, percent: aggregateRowPercent([row], days) };
}

function buildRoleRows(personRows: MatrixRow[], days: RuntimeResourceDayHeader[], workshopId: string) {
  const roleGroups = new Map<string, MatrixRow[]>();
  for (const row of personRows) {
    const rows = roleGroups.get(row.parentId ?? roleId(null)) ?? [];
    rows.push(row);
    roleGroups.set(row.parentId ?? roleId(null), rows);
  }

  return Array.from(roleGroups.entries()).map(([id, people]) => {
    const role: MatrixRow = {
      id,
      kind: "role",
      parentId: workshopId,
      indent: 1,
      name: roleName(id),
      collapsible: true,
      percent: aggregateRowPercent(people, days),
      cells: aggregateDayCells(people, days)
    };
    return {
      role,
      people: people.map((person) => ({ ...person, parentId: id }))
    };
  });
}

function dayCellForTasks(day: RuntimeResourceDayHeader, tasks: Task[]): DayCell {
  if (day.weekend) return { kind: "weekend" };
  const iso = day.isoDate;
  const dayTasks = tasks.filter((task) => {
    const start = task.plannedStart.slice(0, 10);
    const finish = task.plannedFinish.slice(0, 10);
    return start <= iso && iso <= finish;
  });
  if (!dayTasks.length) return { kind: "zero" };

  const hours = dayTasks.reduce((sum, task) => sum + dailyTaskHours(task), 0);
  return {
    kind: "load",
    hours: Math.round(hours * 100) / 100,
    level: resolvePersonDayLoadLevel(hours)
  };
}

function dailyTaskHours(task: Task): number {
  return task.plannedWork / Math.max(1, task.durationWorkingDays);
}

function buildDays(start: Date, finish: Date, now: Date): RuntimeResourceDayHeader[] {
  const todayIso = isoDate(startOfUtcDay(now));
  const totalDays = inclusiveDiffDays(start, finish);
  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(start, index);
    const weekday = date.getUTCDay();
    const iso = isoDate(date);
    return {
      day: date.getUTCDate(),
      isoDate: iso,
      weekdayShort: RU_WEEKDAYS[weekday] ?? "",
      weekend: weekday === 0 || weekday === 6,
      today: iso === todayIso
    };
  });
}

function roleId(positionName: string | null | undefined): string {
  return `role-${(positionName ?? "without-role").toLowerCase().replace(/[^a-zа-я0-9]+/giu, "-")}`;
}

function roleName(id: string): string {
  return id === roleId(null) ? "Роль не указана" : id.replace(/^role-/, "").replaceAll("-", " ");
}

function initialsFromName(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "??";
}

function startOfUtcDay(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function diffDays(start: Date, finish: Date): number {
  return Math.round((finish.getTime() - start.getTime()) / DAY_MS);
}

function inclusiveDiffDays(start: Date, finish: Date): number {
  return diffDays(start, finish) + 1;
}

function maxDate(dates: Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function minDate(left: Date, right: Date): Date {
  return new Date(Math.min(left.getTime(), right.getTime()));
}
