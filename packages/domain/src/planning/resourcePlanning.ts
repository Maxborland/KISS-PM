import { addDays, comparePlanDates, diffCalendarDays } from "./calendar";
import {
  addWorkingMinutesToInstant,
  compareWorkingInstants,
  diffWorkingMinutes,
  maxWorkingInstant,
  minWorkingInstant,
  startOfWorkingDate,
  workingMinutesForDate
} from "./workingTime";
import type {
  BucketGranularity,
  CalculatedPlan,
  PlanAssignment,
  PlanAssignmentAllocation,
  PlanCalendar,
  PlanCalendarException,
  PlanDate,
  PlanReservation,
  PlanResource
} from "./types";

export type ResourceLoadBucket = {
  resourceId: string;
  positionId: string | null;
  teamId: string | null;
  projectId: string;
  date: PlanDate;
  granularity: BucketGranularity;
  assignedMinutes: number;
  reservedMinutes: number;
  capacityMinutes: number;
  freeMinutes: number;
  taskIds: string[];
  assignmentIds: string[];
  reservationIds: string[];
  calendarExceptionIds: string[];
};

export type ResourceOverload = ResourceLoadBucket & {
  overloadMinutes: number;
  reasons: Array<{
    type: "task" | "assignment" | "reservation" | "calendar_exception";
    id: string;
  }>;
};

export type FreeCapacityBucket = ResourceLoadBucket & {
  freeMinutes: number;
};

export type ResourceLoadMatrix = {
  buckets: ResourceLoadBucket[];
  overloads: ResourceOverload[];
  freeCapacityBuckets: FreeCapacityBucket[];
};

export type BuildResourceLoadMatrixInput = {
  plan: CalculatedPlan;
  resources: PlanResource[];
  assignments: PlanAssignment[];
  assignmentAllocations?: PlanAssignmentAllocation[];
  calendars: PlanCalendar[];
  calendarExceptions: PlanCalendarException[];
  reservations: PlanReservation[];
  rangeStart: PlanDate;
  rangeFinish: PlanDate;
  granularities?: BucketGranularity[];
};

const defaultCalendar: PlanCalendar = {
  id: "default-calendar",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480
};

export function buildResourceLoadMatrix(
  input: BuildResourceLoadMatrixInput
): ResourceLoadMatrix {
  const granularities = input.granularities ?? ["day", "week", "month"];
  const dayBuckets = buildDayBuckets(input);
  const buckets = [
    ...(granularities.includes("day") ? dayBuckets : []),
    ...(granularities.includes("week") ? aggregateBuckets(dayBuckets, "week") : []),
    ...(granularities.includes("month") ? aggregateBuckets(dayBuckets, "month") : [])
  ].sort(compareBuckets);

  return {
    buckets,
    overloads: buckets
      .filter((bucket) => bucket.assignedMinutes + bucket.reservedMinutes > bucket.capacityMinutes)
      .map((bucket) => ({
        ...bucket,
        overloadMinutes: bucket.assignedMinutes + bucket.reservedMinutes - bucket.capacityMinutes,
        reasons: [
          ...bucket.taskIds.map((id) => ({ type: "task" as const, id })),
          ...bucket.assignmentIds.map((id) => ({ type: "assignment" as const, id })),
          ...bucket.reservationIds.map((id) => ({ type: "reservation" as const, id })),
          ...bucket.calendarExceptionIds.map((id) => ({ type: "calendar_exception" as const, id }))
        ]
      })),
    freeCapacityBuckets: buckets
      .filter((bucket) => bucket.freeMinutes > 0)
      .map((bucket) => ({ ...bucket, freeMinutes: bucket.freeMinutes }))
  };
}

function buildDayBuckets(input: BuildResourceLoadMatrixInput): ResourceLoadBucket[] {
  const dates = enumerateDates(input.rangeStart, input.rangeFinish);
  const buckets: ResourceLoadBucket[] = [];

  for (const resource of input.resources) {
    const calendar = selectCalendar(resource.calendarId, input.calendars);
    const calendarExceptions = selectResourceCalendarExceptions(input, calendar, resource.id);
    for (const date of dates) {
      const taskLoad = calculateTaskLoadForDate(
        input,
        resource.id,
        date,
        calendar,
        calendarExceptions
      );
      const reservationLoad = calculateReservationLoadForDate(
        input,
        resource.id,
        date,
        calendar,
        calendarExceptions
      );
      const capacityMinutes = workingMinutesForDate(
        date,
        calendar,
        calendarExceptions
      );
      const calendarExceptionIds = calendarExceptions
        .filter((exception) => exception.date === date)
        .map((exception) => exception.id)
        .sort();
      const committedMinutes = taskLoad.assignedMinutes + reservationLoad.reservedMinutes;

      buckets.push({
        resourceId: resource.id,
        positionId: resource.positionId,
        teamId: resource.teamId,
        projectId: input.plan.projectId,
        date,
        granularity: "day",
        assignedMinutes: taskLoad.assignedMinutes,
        reservedMinutes: reservationLoad.reservedMinutes,
        capacityMinutes,
        freeMinutes: Math.max(0, capacityMinutes - committedMinutes),
        taskIds: taskLoad.taskIds,
        assignmentIds: taskLoad.assignmentIds,
        reservationIds: reservationLoad.reservationIds,
        calendarExceptionIds
      });
    }
  }

  return buckets;
}

function calculateTaskLoadForDate(
  input: BuildResourceLoadMatrixInput,
  resourceId: string,
  date: PlanDate,
  calendar: PlanCalendar,
  calendarExceptions: PlanCalendarException[]
): { assignedMinutes: number; taskIds: string[]; assignmentIds: string[] } {
  let assignedMinutes = 0;
  const taskIds: string[] = [];
  const assignmentIds: string[] = [];

  for (const assignment of input.assignments.filter((item) => item.resourceId === resourceId)) {
    if (assignment.role !== "executor" && assignment.role !== "co_executor") continue;
    const explicitAllocation = explicitAssignmentAllocationForDate(
      input.assignmentAllocations ?? [],
      assignment,
      date
    );
    if (explicitAllocation !== null) {
      if (explicitAllocation > 0) {
        assignedMinutes += explicitAllocation;
        taskIds.push(assignment.taskId);
        assignmentIds.push(assignment.id);
      }
      continue;
    }

    const task = input.plan.tasks.find((candidate) => candidate.id === assignment.taskId);
    if (!task?.calculatedStart || !task.calculatedFinish) continue;
    if (comparePlanDates(date, task.calculatedStart) < 0 || comparePlanDates(date, task.calculatedFinish) > 0) {
      continue;
    }

    const taskDates = enumerateDates(task.calculatedStart, task.calculatedFinish);
    const capacities = taskDates.map((taskDate) => ({
      date: taskDate,
      capacityMinutes: taskWorkingOverlapForDate(task, taskDate, calendar, calendarExceptions)
    }));
    const totalCapacity = capacities.reduce((total, item) => total + item.capacityMinutes, 0);
    const assignmentWork = resolveAssignmentWork(input.assignments, assignment, task.workMinutes);
    if (totalCapacity <= 0) {
      if (date === task.calculatedStart && assignmentWork > 0) {
        assignedMinutes += assignmentWork;
        taskIds.push(task.id);
        assignmentIds.push(assignment.id);
      }
      continue;
    }

    const currentCapacity = capacities.find((item) => item.date === date)?.capacityMinutes ?? 0;
    if (currentCapacity <= 0) continue;

    assignedMinutes += Math.round((assignmentWork * currentCapacity) / totalCapacity);
    taskIds.push(task.id);
    assignmentIds.push(assignment.id);
  }

  return {
    assignedMinutes,
    taskIds: [...new Set(taskIds)].sort(),
    assignmentIds: [...new Set(assignmentIds)].sort()
  };
}

function explicitAssignmentAllocationForDate(
  allocations: PlanAssignmentAllocation[],
  assignment: PlanAssignment,
  date: PlanDate
): number | null {
  const assignmentAllocations = allocations.filter(
    (allocation) => allocation.assignmentId === assignment.id
  );
  if (assignmentAllocations.length === 0) return null;

  return assignmentAllocations
    .filter(
      (allocation) =>
        allocation.date === date &&
        allocation.taskId === assignment.taskId &&
        allocation.resourceId === assignment.resourceId
    )
    .reduce((total, allocation) => total + allocation.workMinutes, 0);
}

function taskWorkingOverlapForDate(
  task: CalculatedPlan["tasks"][number],
  date: PlanDate,
  calendar: PlanCalendar,
  calendarExceptions: PlanCalendarException[]
): number {
  if (!task.calculatedStartInstant || !task.calculatedFinishInstant) return 0;
  const dayCapacity = workingMinutesForDate(date, calendar, calendarExceptions);
  if (dayCapacity <= 0) return 0;

  const dayStart = startOfWorkingDate(date, calendar, calendarExceptions);
  const dayFinish = addWorkingMinutesToInstant(
    dayStart,
    dayCapacity,
    calendar,
    calendarExceptions
  );
  const overlapStart = maxWorkingInstant(task.calculatedStartInstant, dayStart);
  const overlapFinish = minWorkingInstant(task.calculatedFinishInstant, dayFinish);
  if (compareWorkingInstants(overlapFinish, overlapStart) <= 0) return 0;
  return diffWorkingMinutes(overlapStart, overlapFinish, calendar, calendarExceptions);
}

function resolveAssignmentWork(
  assignments: PlanAssignment[],
  assignment: PlanAssignment,
  taskWorkMinutes: number
): number {
  if (assignment.workMinutes !== null) return assignment.workMinutes;

  const taskWorkAssignments = assignments.filter(
    (candidate) =>
      candidate.taskId === assignment.taskId &&
      (candidate.role === "executor" || candidate.role === "co_executor")
  );
  const explicitWork = taskWorkAssignments.reduce(
    (total, candidate) => total + (candidate.workMinutes ?? 0),
    0
  );
  const implicitAssignments = taskWorkAssignments.filter(
    (candidate) => candidate.workMinutes === null
  );
  const implicitUnits = implicitAssignments.reduce(
    (total, candidate) => total + candidate.unitsPermille,
    0
  );
  if (implicitUnits <= 0) return 0;

  const remainingWork = Math.max(0, taskWorkMinutes - explicitWork);
  return Math.round((remainingWork * assignment.unitsPermille) / implicitUnits);
}

function calculateReservationLoadForDate(
  input: BuildResourceLoadMatrixInput,
  resourceId: string,
  date: PlanDate,
  calendar: PlanCalendar,
  calendarExceptions: PlanCalendarException[]
): { reservedMinutes: number; reservationIds: string[] } {
  let reservedMinutes = 0;
  const reservationIds: string[] = [];

  for (const reservation of input.reservations.filter((item) => item.resourceId === resourceId)) {
    if (comparePlanDates(date, reservation.start) < 0 || comparePlanDates(date, reservation.finish) > 0) {
      continue;
    }
    const reservationDates = enumerateDates(reservation.start, reservation.finish);
    const capacities = reservationDates.map((reservationDate) =>
      workingMinutesForDate(reservationDate, calendar, calendarExceptions)
    );
    const totalCapacity = capacities.reduce((total, capacity) => total + capacity, 0);
    const currentCapacity = workingMinutesForDate(date, calendar, calendarExceptions);
    if (totalCapacity <= 0 || currentCapacity <= 0) continue;

    reservedMinutes += Math.round((reservation.workMinutes * currentCapacity) / totalCapacity);
    reservationIds.push(reservation.id);
  }

  return {
    reservedMinutes,
    reservationIds: [...new Set(reservationIds)].sort()
  };
}

function aggregateBuckets(
  buckets: ResourceLoadBucket[],
  granularity: Exclude<BucketGranularity, "day">
): ResourceLoadBucket[] {
  const grouped = new Map<string, ResourceLoadBucket>();

  for (const bucket of buckets) {
    const date = granularity === "week" ? weekStart(bucket.date) : monthStart(bucket.date);
    const key = [
      bucket.resourceId,
      bucket.positionId ?? "",
      bucket.teamId ?? "",
      bucket.projectId,
      granularity,
      date
    ].join("|");
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        ...bucket,
        date,
        granularity,
        taskIds: [...bucket.taskIds],
        assignmentIds: [...bucket.assignmentIds],
        reservationIds: [...bucket.reservationIds],
        calendarExceptionIds: [...bucket.calendarExceptionIds]
      });
      continue;
    }

    current.assignedMinutes += bucket.assignedMinutes;
    current.reservedMinutes += bucket.reservedMinutes;
    current.capacityMinutes += bucket.capacityMinutes;
    current.freeMinutes = Math.max(
      0,
      current.capacityMinutes - current.assignedMinutes - current.reservedMinutes
    );
    current.taskIds = [...new Set([...current.taskIds, ...bucket.taskIds])].sort();
    current.assignmentIds = [...new Set([...current.assignmentIds, ...bucket.assignmentIds])].sort();
    current.reservationIds = [...new Set([...current.reservationIds, ...bucket.reservationIds])].sort();
    current.calendarExceptionIds = [
      ...new Set([...current.calendarExceptionIds, ...bucket.calendarExceptionIds])
    ].sort();
  }

  return [...grouped.values()];
}

function selectCalendar(calendarId: string | null, calendars: PlanCalendar[]): PlanCalendar {
  return calendars.find((calendar) => calendar.id === calendarId) ?? calendars[0] ?? defaultCalendar;
}

function selectResourceCalendarExceptions(
  input: BuildResourceLoadMatrixInput,
  calendar: PlanCalendar,
  resourceId: string
): PlanCalendarException[] {
  return input.calendarExceptions.filter(
    (exception) =>
      exception.calendarId === calendar.id &&
      (exception.resourceId === null || exception.resourceId === resourceId)
  );
}

function enumerateDates(start: PlanDate, finish: PlanDate): PlanDate[] {
  const days = diffCalendarDays(start, finish);
  return Array.from({ length: days + 1 }, (_, offset) => addDays(start, offset));
}

function weekStart(date: PlanDate): PlanDate {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const day = parsed.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(date, mondayOffset);
}

function monthStart(date: PlanDate): PlanDate {
  return `${date.slice(0, 7)}-01`;
}

function compareBuckets(left: ResourceLoadBucket, right: ResourceLoadBucket): number {
  return (
    left.resourceId.localeCompare(right.resourceId) ||
    left.granularity.localeCompare(right.granularity) ||
    comparePlanDates(left.date, right.date)
  );
}
