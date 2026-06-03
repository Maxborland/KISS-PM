import type { Project, Task, TaskStatus, WorkspaceUser } from "@/lib/api-types";
import type { GanttData, GanttDayHeader, GanttRow } from "@/widgets/gantt";

export type BuildProjectTimelineGanttDataInput = {
  project: Project;
  tasks: Task[];
  taskStatuses: TaskStatus[];
  workspaceUsers: WorkspaceUser[];
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RU_WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;
const ASSIGNEE_COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"] as const;

export function buildProjectTimelineGanttData({
  project,
  tasks,
  taskStatuses,
  workspaceUsers,
  now = new Date()
}: BuildProjectTimelineGanttDataInput): GanttData {
  const activeTasks = tasks.filter((task) => task.archivedAt == null);
  const projectStart = startOfUtcDay(project.plannedStart);
  const projectFinish = startOfUtcDay(project.plannedFinish);
  const taskDates = activeTasks.flatMap((task) => [
    startOfUtcDay(task.plannedStart),
    startOfUtcDay(task.plannedFinish)
  ]);
  const rangeStart = minDate([projectStart, ...taskDates]);
  const rangeFinish = maxDate([projectFinish, ...taskDates, addDays(rangeStart, 13)]);
  const days = buildTimelineDays(rangeStart, rangeFinish, now);
  const usersById = new Map(workspaceUsers.map((user) => [user.id, user]));
  const statusesById = new Map(taskStatuses.map((status) => [status.id, status]));
  const projectDurationDays = inclusiveDiffDays(rangeStart, rangeFinish);

  return {
    days,
    monthLabel: monthRangeLabel(rangeStart, rangeFinish),
    rows: activeTasks.length
      ? [
          {
            id: project.id,
            tenantId: project.tenantId,
            projectId: project.id,
            level: 0,
            kind: "summary",
            name: project.title,
            wbs: "0",
            startDay: 0,
            durationDays: projectDurationDays,
            progress: averageProgress(activeTasks),
            plannedWork: project.plannedHours,
            scheduleState: projectFinish.getTime() < startOfUtcDay(now).getTime() ? "overdue" : "on-track"
          },
          ...activeTasks.map((task, index) =>
            taskToGanttRow({
              index,
              now,
              rangeStart,
              status: statusesById.get(task.statusId),
              task,
              user: usersById.get(task.ownerUserId)
            })
          )
        ]
      : [],
    dependencies: []
  };
}

function taskToGanttRow({
  index,
  now,
  rangeStart,
  status,
  task,
  user
}: {
  index: number;
  now: Date;
  rangeStart: Date;
  status?: TaskStatus | undefined;
  task: Task;
  user?: WorkspaceUser | undefined;
}): GanttRow {
  const taskStart = startOfUtcDay(task.plannedStart);
  const taskFinish = startOfUtcDay(task.plannedFinish);
  const statusCategory = status?.category ?? task.statusCategory;

  return {
    id: task.id,
    tenantId: task.tenantId,
    projectId: task.projectId,
    stageId: task.stageId,
    statusId: task.statusId,
    statusName: status?.name ?? task.statusName,
    statusCategory,
    requesterUserId: task.requesterUserId,
    ownerUserId: task.ownerUserId,
    level: 1,
    kind: inclusiveDiffDays(taskStart, taskFinish) <= 0 ? "milestone" : "task",
    name: task.title,
    wbs: `1.${index + 1}`,
    startDay: diffDays(rangeStart, taskStart),
    durationDays: Math.max(1, inclusiveDiffDays(taskStart, taskFinish)),
    progress: task.progress,
    plannedWork: task.plannedWork,
    actualWork: task.actualWork,
    ...(user
      ? {
          assignee: {
            initials: initialsFromName(user.name),
            color: ASSIGNEE_COLORS[index % ASSIGNEE_COLORS.length] ?? "c1"
          }
        }
      : {}),
    scheduleState: scheduleStateForTask(taskFinish, statusCategory, now),
    critical: task.priority === "critical"
  };
}

function buildTimelineDays(rangeStart: Date, rangeFinish: Date, now: Date): GanttDayHeader[] {
  const todayIso = isoDate(startOfUtcDay(now));
  return Array.from({ length: inclusiveDiffDays(rangeStart, rangeFinish) }, (_, index) => {
    const date = addDays(rangeStart, index);
    const day = date.getUTCDate();
    const weekday = date.getUTCDay();
    const iso = isoDate(date);
    return {
      day,
      isoDate: iso,
      today: iso === todayIso,
      weekdayShort: RU_WEEKDAYS[weekday] ?? "",
      weekend: weekday === 0 || weekday === 6
    };
  });
}

function scheduleStateForTask(
  finish: Date,
  statusCategory: Task["statusCategory"],
  now: Date
): NonNullable<GanttRow["scheduleState"]> {
  if (statusCategory === "done") return "on-track";
  if (finish.getTime() < startOfUtcDay(now).getTime()) return "overdue";
  if (statusCategory === "waiting" || statusCategory === "review") return "at-risk";
  return "on-track";
}

function averageProgress(tasks: Task[]): number {
  if (!tasks.length) return 0;
  return tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length;
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

function monthRangeLabel(start: Date, finish: Date): string {
  const formatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
  const startLabel = formatter.format(start);
  const finishLabel = formatter.format(finish);
  return startLabel === finishLabel ? startLabel : `${startLabel} - ${finishLabel}`;
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

function minDate(dates: Date[]): Date {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function maxDate(dates: Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}
