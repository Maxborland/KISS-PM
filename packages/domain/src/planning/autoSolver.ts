import { addDays, comparePlanDates, diffCalendarDays, maxPlanDate } from "./calendar";
import { reducePlanningCommand } from "./commandReducer";
import { createEmptyPlanDelta, type PlanDelta, type PlanningCommand } from "./planningCommands";
import { buildResourceLoadMatrix, type ResourceLoadMatrix } from "./resourcePlanning";
import { calculatePlan } from "./schedulingEngine";
import { workingMinutesForDate } from "./workingTime";
import type {
  CalculatedPlan,
  CalculatedTask,
  PlanAssignment,
  PlanCalendar,
  PlanCalendarException,
  PlanDate,
  PlanResource,
  PlanSnapshot
} from "./types";

export type AutoPlanningSolverMode = "schedule" | "repair";

export type AutoPlanningSolverOptions = {
  beamWidth?: number;
  maxIterations?: number;
  maxProposals?: number;
};

export type AutoPlanningSolverInput = {
  snapshot: PlanSnapshot;
  mode: AutoPlanningSolverMode;
  targetDeadline?: PlanDate | null;
  calculatedAt?: string;
  engineVersion?: string;
  options?: AutoPlanningSolverOptions;
};

export type AutoPlanningSolverProposal = {
  id: string;
  mode: AutoPlanningSolverMode;
  kind: "no_overlap" | "accepted_overload";
  planDelta: PlanDelta;
  explainability: {
    finishDate: PlanDate | null;
    deadlineDeltaDays: number;
    overloadMinutes: number;
    overloadedResourceIds: string[];
    changedTaskIds: string[];
    changedAssignmentIds: string[];
    requiredApprovals: string[];
    riskScore: number;
    cost: AutoPlanningSolverCost;
  };
};

export type AutoPlanningSolverCost = {
  deadlineMissDays: number;
  finishDateRank: number;
  overloadMinutes: number;
  changedTaskCount: number;
  changedAssignmentCount: number;
  riskScore: number;
};

export type AutoPlanningSolverRunResult = {
  mode: AutoPlanningSolverMode;
  engineVersion: string;
  clientPlanVersion: number;
  targetDeadline: PlanDate | null;
  proposals: AutoPlanningSolverProposal[];
  search: {
    beamWidth: number;
    maxIterations: number;
    iterations: number;
  };
};

type AssignmentPlan = {
  assignment: PlanAssignment;
  allocations: PlannedAllocation[];
  acceptedOverloadMinutes: number;
};

type PlannedAllocation = {
  assignmentId: string;
  taskId: string;
  resourceId: string;
  date: PlanDate;
  workMinutes: number;
  isSyntheticAssignment: boolean;
};

type UsageMap = Map<string, number>;

type AssignmentPlanCandidate = {
  plan: AssignmentPlan;
  usage: UsageMap;
};

type SearchState = {
  plans: AssignmentPlan[];
  usage: UsageMap;
  cost: AutoPlanningSolverCost;
};

const defaultEngineVersion = "planning-core-v1";

export function proposeAutoPlanningSolutions(
  input: AutoPlanningSolverInput
): AutoPlanningSolverRunResult {
  const beamWidth = clampPositiveInteger(input.options?.beamWidth, 20);
  const maxIterations = clampPositiveInteger(input.options?.maxIterations, 200);
  const maxProposals = clampPositiveInteger(input.options?.maxProposals, 5);
  const engineVersion = input.engineVersion ?? defaultEngineVersion;
  const calculatedPlan = calculatePlan(input.snapshot, {
    calculatedAt: input.calculatedAt ?? input.snapshot.capturedAt,
    engineVersion
  });
  const targetDeadline =
    input.targetDeadline ??
    input.snapshot.project.deadline ??
    calculatedPlan.projectFinish ??
    input.snapshot.project.plannedFinish;

  const assignmentQueue = planEligibleAssignments(input.snapshot, calculatedPlan);
  const baseUsage = buildBaseUsage(input.snapshot, assignmentQueue);
  const noOverlapPlans = scheduleAssignments({
    snapshot: input.snapshot,
    calculatedPlan,
    assignments: assignmentQueue,
    targetDeadline,
    baseUsage: cloneUsage(baseUsage),
    allowOverload: false,
    beamWidth,
    maxIterations
  });
  const proposals: AutoPlanningSolverProposal[] = [];

  appendNonEmptyProposal(
    proposals,
    noOverlapPlans &&
      createSolverProposal({
        snapshot: input.snapshot,
        calculatedPlan,
        mode: input.mode,
        kind: "no_overlap",
        targetDeadline,
        assignmentPlans: noOverlapPlans.assignmentPlans,
        engineVersion
      })
  );

  const overloadPlans = scheduleAssignments({
    snapshot: input.snapshot,
    calculatedPlan,
    assignments: assignmentQueue,
    targetDeadline,
    baseUsage: cloneUsage(baseUsage),
    allowOverload: true,
    beamWidth,
    maxIterations
  });
  appendNonEmptyProposal(
    proposals,
    overloadPlans &&
      createSolverProposal({
        snapshot: input.snapshot,
        calculatedPlan,
        mode: input.mode,
        kind: overloadPlans.assignmentPlans.some((plan) => plan.acceptedOverloadMinutes > 0)
          ? "accepted_overload"
          : "no_overlap",
        targetDeadline,
        assignmentPlans: overloadPlans.assignmentPlans,
        engineVersion
      })
  );

  const unique = uniqueProposals(proposals)
    .sort(compareSolverProposals)
    .slice(0, maxProposals);

  return {
    mode: input.mode,
    engineVersion,
    clientPlanVersion: input.snapshot.planVersion,
    targetDeadline,
    proposals: unique,
    search: {
      beamWidth,
      maxIterations,
      iterations: Math.max(noOverlapPlans?.iterations ?? 0, overloadPlans?.iterations ?? 0)
    }
  };
}

function scheduleAssignments(input: {
  snapshot: PlanSnapshot;
  calculatedPlan: CalculatedPlan;
  assignments: PlanAssignment[];
  targetDeadline: PlanDate;
  baseUsage: UsageMap;
  allowOverload: boolean;
  beamWidth: number;
  maxIterations: number;
}): { assignmentPlans: AssignmentPlan[]; iterations: number } | null {
  let states: SearchState[] = [
    {
      plans: [],
      usage: input.baseUsage,
      cost: emptySearchCost()
    }
  ];
  let iterations = 0;

  for (const assignment of input.assignments) {
    const task = input.calculatedPlan.tasks.find((candidate) => candidate.id === assignment.taskId);
    if (!task?.calculatedStart) continue;
    const workMinutes = resolveAssignmentWork(input.snapshot.assignments, assignment, task.workMinutes);
    if (workMinutes <= 0) {
      states = states.map((state) => {
        const plans = [...state.plans, { assignment, allocations: [], acceptedOverloadMinutes: 0 }];
        return {
          plans,
          usage: state.usage,
          cost: costForAssignmentPlans(plans, input.snapshot, input.targetDeadline)
        };
      });
      continue;
    }

    const nextStates: SearchState[] = [];
    const activeStates = iterations >= input.maxIterations ? states.slice(0, 1) : states;
    for (const state of activeStates) {
      const candidates = allocateAssignmentCandidates({
        snapshot: input.snapshot,
        task,
        assignment,
        workMinutes,
        targetDeadline: input.targetDeadline,
        usage: state.usage,
        allowOverload: input.allowOverload
      });
      const activeCandidates = iterations >= input.maxIterations ? candidates.slice(0, 1) : candidates;
      for (const candidate of activeCandidates) {
        if (iterations < input.maxIterations) iterations += 1;
        const plans = [...state.plans, candidate.plan];
        nextStates.push({
          plans,
          usage: candidate.usage,
          cost: costForAssignmentPlans(plans, input.snapshot, input.targetDeadline)
        });
        if (iterations >= input.maxIterations) break;
      }
      if (iterations >= input.maxIterations && nextStates.length > 0) break;
    }

    states = dedupeSearchStates(nextStates)
      .sort(compareSearchStates)
      .slice(0, iterations >= input.maxIterations ? 1 : input.beamWidth);
    if (states.length === 0) return null;
  }

  return { assignmentPlans: states[0]?.plans ?? [], iterations };
}

function allocateAssignmentCandidates(input: {
  snapshot: PlanSnapshot;
  task: CalculatedTask;
  assignment: PlanAssignment;
  workMinutes: number;
  targetDeadline: PlanDate;
  usage: UsageMap;
  allowOverload: boolean;
}): AssignmentPlanCandidate[] {
  const candidates = resourceOrders(input.snapshot, input.assignment.resourceId).flatMap((resourceOrder) => {
    const candidate = allocateAssignmentForResourceOrder({
      ...input,
      resourceOrder
    });
    return candidate ? [candidate] : [];
  });
  return dedupeAssignmentCandidates(candidates).sort((left, right) =>
    compareAssignmentPlans(left.plan, right.plan, input.snapshot, input.targetDeadline)
  );
}

function allocateAssignmentForResourceOrder(input: {
  snapshot: PlanSnapshot;
  task: CalculatedTask;
  assignment: PlanAssignment;
  workMinutes: number;
  targetDeadline: PlanDate;
  usage: UsageMap;
  allowOverload: boolean;
  resourceOrder: string[];
}): AssignmentPlanCandidate | null {
  const usage = cloneUsage(input.usage);
  const start = input.task.calculatedStart ?? input.snapshot.project.plannedStart;
  const finish = maxPlanDate(start, input.targetDeadline);
  const dates = enumerateDates(start, finish);
  let remaining = input.workMinutes;
  const allocations: PlannedAllocation[] = [];

  for (const resourceId of input.resourceOrder) {
    for (const date of dates) {
      if (remaining <= 0) break;
      const free = freeCapacityFor(input.snapshot, usage, resourceId, date);
      if (free <= 0) continue;
      const workMinutes = Math.min(free, remaining);
      allocations.push({
        assignmentId: assignmentIdForResource(input.assignment, resourceId),
        taskId: input.assignment.taskId,
        resourceId,
        date,
        workMinutes,
        isSyntheticAssignment: resourceId !== input.assignment.resourceId
      });
      addUsage(usage, resourceId, date, workMinutes);
      remaining -= workMinutes;
    }
  }

  let acceptedOverloadMinutes = 0;
  if (remaining > 0) {
    if (!input.allowOverload) return null;
    const overloadDate = dates[dates.length - 1] ?? input.targetDeadline;
    allocations.push({
      assignmentId: input.assignment.id,
      taskId: input.assignment.taskId,
      resourceId: input.assignment.resourceId,
      date: overloadDate,
      workMinutes: remaining,
      isSyntheticAssignment: false
    });
    addUsage(usage, input.assignment.resourceId, overloadDate, remaining);
    acceptedOverloadMinutes = remaining;
  }

  return {
    plan: {
      assignment: input.assignment,
      allocations,
      acceptedOverloadMinutes
    },
    usage
  };
}

function createSolverProposal(input: {
  snapshot: PlanSnapshot;
  calculatedPlan: CalculatedPlan;
  mode: AutoPlanningSolverMode;
  kind: AutoPlanningSolverProposal["kind"];
  targetDeadline: PlanDate;
  assignmentPlans: AssignmentPlan[];
  engineVersion: string;
}): AutoPlanningSolverProposal {
  const commands = commandsForAssignmentPlans(input.assignmentPlans);
  const planDelta = createPlanDelta(commands);
  const nextSnapshot = commands.reduce(
    (snapshot, command) => reducePlanningCommand(snapshot, command).nextSnapshot,
    input.snapshot
  );
  const nextPlan = calculatePlan(nextSnapshot, {
    calculatedAt: input.snapshot.capturedAt,
    engineVersion: input.engineVersion
  });
  const resourceLoad = buildResourceLoadMatrix({
    plan: nextPlan,
    resources: nextSnapshot.resources,
    assignments: nextSnapshot.assignments,
    assignmentAllocations: nextSnapshot.assignmentAllocations,
    calendars: nextSnapshot.calendars,
    calendarExceptions: nextSnapshot.calendarExceptions,
    reservations: nextSnapshot.reservations,
    rangeStart: nextSnapshot.project.plannedStart,
    rangeFinish: maxPlanDate(input.targetDeadline, nextPlan.projectFinish ?? input.targetDeadline),
    granularities: ["day"]
  });
  const finishDate = nextPlan.projectFinish ?? latestAllocationDate(input.assignmentPlans);
  const overloadMinutes = resourceLoad.overloads.reduce(
    (total, overload) => total + overload.overloadMinutes,
    0
  );
  const riskScore =
    input.kind === "accepted_overload"
      ? Math.min(100, 70 + Math.ceil(overloadMinutes / 60))
      : overloadMinutes > 0
        ? 40
        : 10;
  const deadlineMissDays =
    finishDate && comparePlanDates(finishDate, input.targetDeadline) > 0
      ? diffCalendarDays(input.targetDeadline, finishDate)
      : 0;
  const cost: AutoPlanningSolverCost = {
    deadlineMissDays,
    finishDateRank: finishDate ? diffCalendarDays(input.snapshot.project.plannedStart, finishDate) : 0,
    overloadMinutes,
    changedTaskCount: planDelta.changedTaskIds.length,
    changedAssignmentCount: planDelta.changedAssignmentIds.length,
    riskScore
  };

  return {
    id: `auto-${input.mode}-${input.kind}-${input.targetDeadline}`,
    mode: input.mode,
    kind: input.kind,
    planDelta,
    explainability: {
      finishDate,
      deadlineDeltaDays: deadlineMissDays,
      overloadMinutes,
      overloadedResourceIds: [
        ...new Set(resourceLoad.overloads.map((overload) => overload.resourceId))
      ].sort(),
      changedTaskIds: planDelta.changedTaskIds,
      changedAssignmentIds: planDelta.changedAssignmentIds,
      requiredApprovals:
        input.kind === "accepted_overload" ? ["tenant.project_plan.manage"] : [],
      riskScore,
      cost
    }
  };
}

function commandsForAssignmentPlans(plans: AssignmentPlan[]): PlanningCommand[] {
  const commands: PlanningCommand[] = [];

  for (const plan of plans) {
    const allocationsByAssignmentId = groupAllocationsByAssignmentId(plan.allocations);
    const originalAllocations = allocationsByAssignmentId.get(plan.assignment.id) ?? [];
    const syntheticAssignmentIds = [...allocationsByAssignmentId.keys()]
      .filter((assignmentId) => assignmentId !== plan.assignment.id)
      .sort();

    if (syntheticAssignmentIds.length > 0) {
      commands.push({
        type: "assignment.upsert",
        payload: {
          id: plan.assignment.id,
          taskId: plan.assignment.taskId,
          resourceId: plan.assignment.resourceId,
          role: plan.assignment.role,
          unitsPermille: plan.assignment.unitsPermille,
          workMinutes: sumAllocationMinutes(originalAllocations)
        }
      });
    }
    commands.push({
      type: "assignment.allocations.replace",
      payload: {
        assignmentId: plan.assignment.id,
        allocations: compactAllocationsByDate(originalAllocations).map((allocation) => ({
          date: allocation.date,
          workMinutes: allocation.workMinutes
        }))
      }
    });

    for (const assignmentId of syntheticAssignmentIds) {
      const allocations = allocationsByAssignmentId.get(assignmentId) ?? [];
      const first = allocations[0];
      if (!first) continue;
      commands.push({
        type: "assignment.upsert",
        payload: {
          id: assignmentId,
          taskId: plan.assignment.taskId,
          resourceId: first.resourceId,
          role: "co_executor",
          unitsPermille: 1000,
          workMinutes: sumAllocationMinutes(allocations)
        }
      });
      commands.push({
        type: "assignment.allocations.replace",
        payload: {
          assignmentId,
          allocations: compactAllocationsByDate(allocations).map((allocation) => ({
            date: allocation.date,
            workMinutes: allocation.workMinutes
          }))
        }
      });
    }

    if (plan.acceptedOverloadMinutes > 0) {
      commands.push({
        type: "risk.accept_overload",
        payload: {
          overloadId: `${plan.assignment.resourceId}:${plan.assignment.taskId}`,
          acceptedRiskReason: "Auto-solver could not find a no-overlap allocation before the deadline"
        }
      });
    }
  }

  return commands;
}

function createPlanDelta(commands: PlanningCommand[]): PlanDelta {
  const changedTaskIds = [
    ...new Set(
      commands.flatMap((command) => {
        if ("taskId" in command.payload) return [String(command.payload.taskId)];
        return [];
      })
    )
  ].sort();
  const changedAssignmentIds = [
    ...new Set(
      commands.flatMap((command) => {
        if (command.type === "assignment.upsert") return [command.payload.id];
        if (command.type === "assignment.delete") return [command.payload.assignmentId];
        if (command.type === "assignment.allocations.replace") return [command.payload.assignmentId];
        return [];
      })
    )
  ].sort();
  return {
    ...createEmptyPlanDelta(),
    commands,
    changedTaskIds,
    changedAssignmentIds,
    acceptedRiskIds: commands.flatMap((command) =>
      command.type === "risk.accept_overload" ? [command.payload.overloadId] : []
    )
  };
}

function resourceOrders(snapshot: PlanSnapshot, primaryResourceId: string): string[][] {
  const sortedResourceIds = snapshot.resources.map((resource) => resource.id).sort();
  const fallbackOrder = [
    primaryResourceId,
    ...sortedResourceIds.filter((resourceId) => resourceId !== primaryResourceId)
  ];
  const alternateOrders = sortedResourceIds
    .filter((resourceId) => resourceId !== primaryResourceId)
    .map((resourceId) => [
      resourceId,
      primaryResourceId,
      ...sortedResourceIds.filter(
        (candidate) => candidate !== resourceId && candidate !== primaryResourceId
      )
    ]);
  return dedupeResourceOrders([fallbackOrder, ...alternateOrders]);
}

function dedupeResourceOrders(orders: string[][]): string[][] {
  const seen = new Set<string>();
  const unique: string[][] = [];
  for (const order of orders) {
    const signature = order.join("|");
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(order);
  }
  return unique;
}

function emptySearchCost(): AutoPlanningSolverCost {
  return {
    deadlineMissDays: 0,
    finishDateRank: 0,
    overloadMinutes: 0,
    changedTaskCount: 0,
    changedAssignmentCount: 0,
    riskScore: 0
  };
}

function costForAssignmentPlans(
  plans: AssignmentPlan[],
  snapshot: PlanSnapshot,
  targetDeadline: PlanDate
): AutoPlanningSolverCost {
  const finishDate = latestAllocationDate(plans);
  const overloadMinutes = plans.reduce((total, plan) => total + plan.acceptedOverloadMinutes, 0);
  const changedTaskCount = new Set(plans.map((plan) => plan.assignment.taskId)).size;
  const changedAssignmentCount = new Set(
    plans.flatMap((plan) => plan.allocations.map((allocation) => allocation.assignmentId))
  ).size;
  return {
    deadlineMissDays:
      finishDate && comparePlanDates(finishDate, targetDeadline) > 0
        ? diffCalendarDays(targetDeadline, finishDate)
        : 0,
    finishDateRank: finishDate ? diffCalendarDays(snapshot.project.plannedStart, finishDate) : 0,
    overloadMinutes,
    changedTaskCount,
    changedAssignmentCount,
    riskScore: overloadMinutes > 0 ? Math.min(100, 70 + Math.ceil(overloadMinutes / 60)) : 0
  };
}

function compareSearchStates(left: SearchState, right: SearchState): number {
  return compareSolverCosts(left.cost, right.cost) || searchStateSignature(left).localeCompare(searchStateSignature(right));
}

function compareAssignmentPlans(
  left: AssignmentPlan,
  right: AssignmentPlan,
  snapshot: PlanSnapshot,
  targetDeadline: PlanDate
): number {
  return (
    compareSolverCosts(
      costForAssignmentPlans([left], snapshot, targetDeadline),
      costForAssignmentPlans([right], snapshot, targetDeadline)
    ) ||
    assignmentPlanSignature(left).localeCompare(assignmentPlanSignature(right))
  );
}

function compareSolverCosts(left: AutoPlanningSolverCost, right: AutoPlanningSolverCost): number {
  return (
    left.deadlineMissDays - right.deadlineMissDays ||
    left.finishDateRank - right.finishDateRank ||
    left.overloadMinutes - right.overloadMinutes ||
    left.changedTaskCount - right.changedTaskCount ||
    left.changedAssignmentCount - right.changedAssignmentCount ||
    left.riskScore - right.riskScore
  );
}

function dedupeSearchStates(states: SearchState[]): SearchState[] {
  const seen = new Set<string>();
  const unique: SearchState[] = [];
  for (const state of states) {
    const signature = searchStateSignature(state);
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(state);
  }
  return unique;
}

function dedupeAssignmentCandidates(candidates: AssignmentPlanCandidate[]): AssignmentPlanCandidate[] {
  const seen = new Set<string>();
  const unique: AssignmentPlanCandidate[] = [];
  for (const candidate of candidates) {
    const signature = assignmentPlanSignature(candidate.plan);
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(candidate);
  }
  return unique;
}

function searchStateSignature(state: SearchState): string {
  return state.plans.map(assignmentPlanSignature).join("\n");
}

function assignmentPlanSignature(plan: AssignmentPlan): string {
  return plan.allocations
    .map((allocation) =>
      [
        allocation.assignmentId,
        allocation.taskId,
        allocation.resourceId,
        allocation.date,
        allocation.workMinutes
      ].join(":")
    )
    .sort()
    .join("|");
}

function planEligibleAssignments(snapshot: PlanSnapshot, calculatedPlan: CalculatedPlan): PlanAssignment[] {
  const calculatedTaskIds = new Set(
    calculatedPlan.tasks
      .filter((task) => task.calculatedStart && task.workMinutes > 0)
      .map((task) => task.id)
  );
  return snapshot.assignments
    .filter(
      (assignment) =>
        calculatedTaskIds.has(assignment.taskId) &&
        (assignment.role === "executor" || assignment.role === "co_executor")
    )
    .sort((left, right) => {
      const leftTask = calculatedPlan.tasks.find((task) => task.id === left.taskId);
      const rightTask = calculatedPlan.tasks.find((task) => task.id === right.taskId);
      return (
        String(leftTask?.calculatedFinish ?? "").localeCompare(String(rightTask?.calculatedFinish ?? "")) ||
        String(leftTask?.wbsCode ?? "").localeCompare(String(rightTask?.wbsCode ?? "")) ||
        left.id.localeCompare(right.id)
      );
    });
}

function buildBaseUsage(snapshot: PlanSnapshot, plannedAssignments: PlanAssignment[]): UsageMap {
  const usage: UsageMap = new Map();
  const plannedAssignmentIds = new Set(plannedAssignments.map((assignment) => assignment.id));

  for (const reservation of snapshot.reservations) {
    const dates = enumerateDates(reservation.start, reservation.finish);
    const resource = snapshot.resources.find((candidate) => candidate.id === reservation.resourceId);
    if (!resource) continue;
    const capacities = dates.map((date) => capacityFor(snapshot, resource, date));
    const totalCapacity = capacities.reduce((total, capacity) => total + capacity, 0);
    for (const [index, date] of dates.entries()) {
      const capacity = capacities[index] ?? 0;
      if (capacity <= 0 || totalCapacity <= 0) continue;
      addUsage(usage, reservation.resourceId, date, Math.round((reservation.workMinutes * capacity) / totalCapacity));
    }
  }

  for (const allocation of snapshot.assignmentAllocations) {
    if (plannedAssignmentIds.has(allocation.assignmentId)) continue;
    addUsage(usage, allocation.resourceId, allocation.date, allocation.workMinutes);
  }

  return usage;
}

function freeCapacityFor(
  snapshot: PlanSnapshot,
  usage: UsageMap,
  resourceId: string,
  date: PlanDate
): number {
  const resource = snapshot.resources.find((candidate) => candidate.id === resourceId);
  if (!resource) return 0;
  return Math.max(0, capacityFor(snapshot, resource, date) - (usage.get(usageKey(resourceId, date)) ?? 0));
}

function capacityFor(snapshot: PlanSnapshot, resource: PlanResource, date: PlanDate): number {
  const calendar = selectCalendar(snapshot.calendars, resource.calendarId);
  return workingMinutesForDate(date, calendar, selectExceptions(snapshot, calendar, resource.id));
}

function selectCalendar(calendars: PlanCalendar[], calendarId: string | null): PlanCalendar {
  return calendars.find((calendar) => calendar.id === calendarId) ?? calendars[0] ?? {
    id: "default-calendar",
    workingWeekdays: [1, 2, 3, 4, 5],
    workingMinutesPerDay: 480
  };
}

function selectExceptions(
  snapshot: PlanSnapshot,
  calendar: PlanCalendar,
  resourceId: string
): PlanCalendarException[] {
  return snapshot.calendarExceptions.filter(
    (exception) =>
      exception.calendarId === calendar.id &&
      (exception.resourceId === null || exception.resourceId === resourceId)
  );
}

function resolveAssignmentWork(
  assignments: PlanAssignment[],
  assignment: PlanAssignment,
  taskWorkMinutes: number
): number {
  if (assignment.workMinutes !== null) return assignment.workMinutes;
  const taskAssignments = assignments.filter(
    (candidate) =>
      candidate.taskId === assignment.taskId &&
      (candidate.role === "executor" || candidate.role === "co_executor")
  );
  const explicitWork = taskAssignments.reduce(
    (total, candidate) => total + (candidate.workMinutes ?? 0),
    0
  );
  const implicitAssignments = taskAssignments.filter((candidate) => candidate.workMinutes === null);
  const implicitUnits = implicitAssignments.reduce(
    (total, candidate) => total + candidate.unitsPermille,
    0
  );
  if (implicitUnits <= 0) return 0;
  return Math.round((Math.max(0, taskWorkMinutes - explicitWork) * assignment.unitsPermille) / implicitUnits);
}

function groupAllocationsByAssignmentId(
  allocations: PlannedAllocation[]
): Map<string, PlannedAllocation[]> {
  const groups = new Map<string, PlannedAllocation[]>();
  for (const allocation of allocations) {
    groups.set(allocation.assignmentId, [...(groups.get(allocation.assignmentId) ?? []), allocation]);
  }
  return groups;
}

function sumAllocationMinutes(allocations: PlannedAllocation[]): number {
  return allocations.reduce((total, allocation) => total + allocation.workMinutes, 0);
}

function compactAllocationsByDate(allocations: PlannedAllocation[]): PlannedAllocation[] {
  const byDate = new Map<PlanDate, PlannedAllocation>();
  for (const allocation of allocations) {
    const current = byDate.get(allocation.date);
    byDate.set(allocation.date, {
      ...allocation,
      workMinutes: (current?.workMinutes ?? 0) + allocation.workMinutes
    });
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function latestAllocationDate(plans: AssignmentPlan[]): PlanDate | null {
  const dates = plans.flatMap((plan) => plan.allocations.map((allocation) => allocation.date));
  if (dates.length === 0) return null;
  return dates.sort(comparePlanDates).at(-1) ?? null;
}

function assignmentIdForResource(assignment: PlanAssignment, resourceId: string): string {
  return resourceId === assignment.resourceId
    ? assignment.id
    : `${assignment.id}__solver__${resourceId}`;
}

function enumerateDates(start: PlanDate, finish: PlanDate): PlanDate[] {
  const days = diffCalendarDays(start, finish);
  return Array.from({ length: Math.max(0, days) + 1 }, (_, offset) => addDays(start, offset));
}

function usageKey(resourceId: string, date: PlanDate): string {
  return `${resourceId}:${date}`;
}

function addUsage(usage: UsageMap, resourceId: string, date: PlanDate, workMinutes: number): void {
  const key = usageKey(resourceId, date);
  usage.set(key, (usage.get(key) ?? 0) + workMinutes);
}

function cloneUsage(usage: UsageMap): UsageMap {
  return new Map(usage);
}

function appendNonEmptyProposal(
  proposals: AutoPlanningSolverProposal[],
  proposal: AutoPlanningSolverProposal | false | null
): void {
  if (!proposal || proposal.planDelta.commands.length === 0) return;
  proposals.push(proposal);
}

function uniqueProposals(proposals: AutoPlanningSolverProposal[]): AutoPlanningSolverProposal[] {
  const seen = new Set<string>();
  const unique: AutoPlanningSolverProposal[] = [];
  for (const proposal of proposals) {
    const signature = proposal.planDelta.commands
      .map((command) => JSON.stringify(command))
      .join("\n");
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(proposal);
  }
  return unique;
}

function compareSolverProposals(
  left: AutoPlanningSolverProposal,
  right: AutoPlanningSolverProposal
): number {
  return (
    left.explainability.cost.deadlineMissDays - right.explainability.cost.deadlineMissDays ||
    left.explainability.cost.finishDateRank - right.explainability.cost.finishDateRank ||
    left.explainability.cost.overloadMinutes - right.explainability.cost.overloadMinutes ||
    left.explainability.cost.changedTaskCount - right.explainability.cost.changedTaskCount ||
    left.explainability.cost.changedAssignmentCount - right.explainability.cost.changedAssignmentCount ||
    left.explainability.cost.riskScore - right.explainability.cost.riskScore ||
    left.id.localeCompare(right.id)
  );
}

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}
