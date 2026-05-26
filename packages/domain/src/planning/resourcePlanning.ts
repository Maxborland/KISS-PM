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
import {
  aggregateOccupancyContributions,
  occupancyMinutesForDate,
  type OccupancyContribution,
  type OccupancyWindow
} from "./occupancy";

export type ResourceLoadBucket = {
  resourceId: string;
  positionId: string | null;
  teamId: string | null;
  projectId: string;
  date: PlanDate;
  granularity: BucketGranularity;
  assignedMinutes: number;
  reservedMinutes: number;
  occupiedMinutes: number;
  capacityMinutes: number;
  freeMinutes: number;
  taskIds: string[];
  assignmentIds: string[];
  assignmentContributions: Array<{
    taskId: string;
    assignmentId: string;
    workMinutes: number;
  }>;
  reservationContributions: Array<{
    reservationId: string;
    workMinutes: number;
  }>;
  occupancyContributions: OccupancyContribution[];
  reservationIds: string[];
  occupancyIds: string[];
  calendarExceptionIds: string[];
};

export type ResourceOverload = ResourceLoadBucket & {
  overloadMinutes: number;
  reasons: Array<{
    type: "task" | "assignment" | "reservation" | "occupancy" | "calendar_exception";
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
  assignmentAllocations?: PlanAssignmentAllocation[] | undefined;
  calendars: PlanCalendar[];
  calendarExceptions: PlanCalendarException[];
  reservations: PlanReservation[];
  occupancyWindows?: OccupancyWindow[] | undefined;
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
      .filter((bucket) => committedMinutes(bucket) > bucket.capacityMinutes)
      .map((bucket) => ({
        ...bucket,
        overloadMinutes: committedMinutes(bucket) - bucket.capacityMinutes,
        reasons: [
          ...bucket.taskIds.map((id) => ({ type: "task" as const, id })),
          ...bucket.assignmentIds.map((id) => ({ type: "assignment" as const, id })),
          ...bucket.reservationIds.map((id) => ({ type: "reservation" as const, id })),
          ...bucket.occupancyIds.map((id) => ({ type: "occupancy" as const, id })),
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
      const occupancyLoad = calculateOccupancyLoadForDate(input, resource.id, date);
      const capacityMinutes = workingMinutesForDate(
        date,
        calendar,
        calendarExceptions
      );
      const calendarExceptionIds = calendarExceptions
        .filter((exception) => exception.date === date)
        .map((exception) => exception.id)
        .sort();
      const totalCommittedMinutes =
        taskLoad.assignedMinutes + reservationLoad.reservedMinutes + occupancyLoad.occupiedMinutes;

      buckets.push({
        resourceId: resource.id,
        positionId: resource.positionId,
        teamId: resource.teamId,
        projectId: input.plan.projectId,
        date,
        granularity: "day",
        assignedMinutes: taskLoad.assignedMinutes,
        reservedMinutes: reservationLoad.reservedMinutes,
        occupiedMinutes: occupancyLoad.occupiedMinutes,
        capacityMinutes,
        freeMinutes: Math.max(0, capacityMinutes - totalCommittedMinutes),
        taskIds: taskLoad.taskIds,
        assignmentIds: taskLoad.assignmentIds,
        assignmentContributions: taskLoad.assignmentContributions,
        reservationContributions: reservationLoad.reservationContributions,
        occupancyContributions: occupancyLoad.occupancyContributions,
        reservationIds: reservationLoad.reservationIds,
        occupancyIds: occupancyLoad.occupancyIds,
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
): {
  assignedMinutes: number;
  taskIds: string[];
  assignmentIds: string[];
  assignmentContributions: Array<{ taskId: string; assignmentId: string; workMinutes: number }>;
} {
  let assignedMinutes = 0;
  const taskIds: string[] = [];
  const assignmentIds: string[] = [];
  const assignmentContributions: Array<{
    taskId: string;
    assignmentId: string;
    workMinutes: number;
  }> = [];

  for (const assignment of input.assignments.filter((item) => item.resourceId === resourceId)) {
    if (assignment.role !== "executor" && assignment.role !== "co_executor") continue;
    const explicitAllocations = (input.assignmentAllocations ?? []).filter(
      (allocation) => allocation.assignmentId === assignment.id
    );
    if (explicitAllocations.length > 0) {
      const allocatedMinutes = explicitAllocations
        .filter((allocation) => allocation.date === date)
        .reduce((total, allocation) => total + allocation.workMinutes, 0);
      if (allocatedMinutes > 0) {
        assignedMinutes += allocatedMinutes;
        taskIds.push(assignment.taskId);
        assignmentIds.push(assignment.id);
        assignmentContributions.push({
          taskId: assignment.taskId,
          assignmentId: assignment.id,
          workMinutes: allocatedMinutes
        });
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
        assignmentContributions.push({
          taskId: task.id,
          assignmentId: assignment.id,
          workMinutes: assignmentWork
        });
      }
      continue;
    }

    const currentCapacity = capacities.find((item) => item.date === date)?.capacityMinutes ?? 0;
    if (currentCapacity <= 0) continue;

    const workMinutes = Math.round((assignmentWork * currentCapacity) / totalCapacity);
    assignedMinutes += workMinutes;
    taskIds.push(task.id);
    assignmentIds.push(assignment.id);
    assignmentContributions.push({
      taskId: task.id,
      assignmentId: assignment.id,
      workMinutes
    });
  }

  return {
    assignedMinutes,
    taskIds: [...new Set(taskIds)].sort(),
    assignmentIds: [...new Set(assignmentIds)].sort(),
    assignmentContributions: aggregateAssignmentContributions(assignmentContributions)
  };
}

function aggregateAssignmentContributions(
  contributions: Array<{ taskId: string; assignmentId: string; workMinutes: number }>
): Array<{ taskId: string; assignmentId: string; workMinutes: number }> {
  const grouped = new Map<string, { taskId: string; assignmentId: string; workMinutes: number }>();
  for (const contribution of contributions) {
    const key = `${contribution.taskId}:${contribution.assignmentId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.workMinutes += contribution.workMinutes;
      continue;
    }
    grouped.set(key, { ...contribution });
  }
  return [...grouped.values()].sort(
    (left, right) =>
      left.taskId.localeCompare(right.taskId) ||
      left.assignmentId.localeCompare(right.assignmentId)
  );
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
): {
  reservedMinutes: number;
  reservationIds: string[];
  reservationContributions: Array<{ reservationId: string; workMinutes: number }>;
} {
  let reservedMinutes = 0;
  const reservationIds: string[] = [];
  const reservationContributions: Array<{ reservationId: string; workMinutes: number }> = [];

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

    const workMinutes = Math.round((reservation.workMinutes * currentCapacity) / totalCapacity);
    reservedMinutes += workMinutes;
    reservationIds.push(reservation.id);
    reservationContributions.push({ reservationId: reservation.id, workMinutes });
  }

  return {
    reservedMinutes,
    reservationIds: [...new Set(reservationIds)].sort(),
    reservationContributions: aggregateReservationContributions(reservationContributions)
  };
}

function calculateOccupancyLoadForDate(
  input: BuildResourceLoadMatrixInput,
  resourceId: string,
  date: PlanDate
): {
  occupiedMinutes: number;
  occupancyIds: string[];
  occupancyContributions: OccupancyContribution[];
} {
  const occupancyContributions: OccupancyContribution[] = [];
  for (const window of input.occupancyWindows ?? []) {
    if (window.resourceId !== resourceId) continue;
    if (window.capacityImpact === "tentative") continue;
    const workMinutes = occupancyMinutesForDate(window, date);
    if (workMinutes <= 0) continue;
    occupancyContributions.push({
      occupancyId: window.id,
      sourceType: window.sourceType,
      sourceId: window.sourceId,
      workMinutes
    });
  }

  const aggregated = aggregateOccupancyContributions(occupancyContributions);
  return {
    occupiedMinutes: aggregated.reduce((total, contribution) => total + contribution.workMinutes, 0),
    occupancyIds: aggregated.map((contribution) => contribution.occupancyId),
    occupancyContributions: aggregated
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
        assignmentContributions: [...bucket.assignmentContributions],
        reservationContributions: [...bucket.reservationContributions],
        occupancyContributions: [...bucket.occupancyContributions],
        reservationIds: [...bucket.reservationIds],
        occupancyIds: [...bucket.occupancyIds],
        calendarExceptionIds: [...bucket.calendarExceptionIds]
      });
      continue;
    }

    current.assignedMinutes += bucket.assignedMinutes;
    current.reservedMinutes += bucket.reservedMinutes;
    current.occupiedMinutes += bucket.occupiedMinutes;
    current.capacityMinutes += bucket.capacityMinutes;
    current.freeMinutes = Math.max(
      0,
      current.capacityMinutes - committedMinutes(current)
    );
    current.taskIds = [...new Set([...current.taskIds, ...bucket.taskIds])].sort();
    current.assignmentIds = [...new Set([...current.assignmentIds, ...bucket.assignmentIds])].sort();
    current.assignmentContributions = aggregateAssignmentContributions([
      ...current.assignmentContributions,
      ...bucket.assignmentContributions
    ]);
    current.reservationContributions = aggregateReservationContributions([
      ...current.reservationContributions,
      ...bucket.reservationContributions
    ]);
    current.occupancyContributions = aggregateOccupancyContributions([
      ...current.occupancyContributions,
      ...bucket.occupancyContributions
    ]);
    current.reservationIds = [...new Set([...current.reservationIds, ...bucket.reservationIds])].sort();
    current.occupancyIds = [...new Set([...current.occupancyIds, ...bucket.occupancyIds])].sort();
    current.calendarExceptionIds = [
      ...new Set([...current.calendarExceptionIds, ...bucket.calendarExceptionIds])
    ].sort();
  }

  return [...grouped.values()];
}

function committedMinutes(
  bucket: Pick<ResourceLoadBucket, "assignedMinutes" | "reservedMinutes" | "occupiedMinutes">
): number {
  return bucket.assignedMinutes + bucket.reservedMinutes + bucket.occupiedMinutes;
}

function aggregateReservationContributions(
  contributions: Array<{ reservationId: string; workMinutes: number }>
): Array<{ reservationId: string; workMinutes: number }> {
  const grouped = new Map<string, { reservationId: string; workMinutes: number }>();
  for (const contribution of contributions) {
    const existing = grouped.get(contribution.reservationId);
    if (existing) {
      existing.workMinutes += contribution.workMinutes;
      continue;
    }
    grouped.set(contribution.reservationId, { ...contribution });
  }
  return [...grouped.values()].sort((left, right) =>
    left.reservationId.localeCompare(right.reservationId)
  );
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
