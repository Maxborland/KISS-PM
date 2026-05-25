import { buildResourceLoadMatrix, type ResourceLoadMatrix } from "../planning/resourcePlanning";
import { calculatePlan } from "../planning/schedulingEngine";
import { applyPlanDeltaToSnapshot, proposePlanningScenarios } from "../planning/scenarioPlanning";
import type { CalculatedPlan, PlanSnapshot } from "../planning/types";
import { createEmptyPlanDelta, type PlanDelta, type PlanningCommand } from "../planning/planningCommands";
import { dateDeltaDays } from "./kpiEngine";
import type { ControlSignal, ManagementActionCandidate } from "./types";

export type ControlSolverInput = {
  snapshot: PlanSnapshot;
  calculatedPlan: CalculatedPlan;
  resourceLoad: ResourceLoadMatrix;
  signals: ControlSignal[];
  calculatedAt: string;
};

export function proposeManagementActions(input: ControlSolverInput): ManagementActionCandidate[] {
  const candidates = [
    ...resourceOverloadCandidates(input),
    ...deadlineCompressionCandidates(input),
    ...deadlineMoveFallback(input)
  ];

  return candidates.sort((left, right) =>
    left.explainability.cost - right.explainability.cost || left.id.localeCompare(right.id)
  );
}

function resourceOverloadCandidates(input: ControlSolverInput): ManagementActionCandidate[] {
  const overloadSignal = input.signals.find(
    (signal) => signal.sourceMetric === "resource_overload_minutes"
  );
  if (!overloadSignal) return [];
  const overload = [...input.resourceLoad.overloads]
    .filter((candidate) => candidate.granularity === "day")
    .sort((left, right) => right.overloadMinutes - left.overloadMinutes)[0];
  if (!overload) return [];

  const proposals = proposePlanningScenarios({
    snapshot: input.snapshot,
    calculatedPlan: input.calculatedPlan,
    resourceLoad: input.resourceLoad,
    target: {
      type: "resource_overload",
      resourceId: overload.resourceId,
      date: overload.date,
      overloadMinutes: overload.overloadMinutes,
      taskIds: overload.taskIds
    }
  });

  return proposals.map((proposal) => {
    const evaluated = evaluatePlanDelta(input, proposal.planDelta);
    return {
      id: `action-${overloadSignal.id}-${proposal.id}`,
      type: "apply_planning_delta",
      label: `Применить сценарий ${proposal.profile}`,
      targetEntity: { type: "ControlSignal", id: overloadSignal.id },
      requiredPermissions: ["tenant.planning_scenarios.apply"],
      planDelta: proposal.planDelta,
      input: { scenarioProposalId: proposal.id, profile: proposal.profile },
      explainability: {
        reason: `Сценарий ${proposal.profile} для перегруза ${overload.resourceId} ${overload.date}`,
        deadlineDeltaDays: evaluated.deadlineDeltaDays,
        overloadMinutes: evaluated.overloadMinutes,
        changedTaskIds: proposal.planDelta.changedTaskIds,
        changedAssignmentIds: proposal.planDelta.changedAssignmentIds,
        riskScore: proposal.explainability.riskScore,
        cost: cost({
          deadlineDeltaDays: evaluated.deadlineDeltaDays,
          overloadMinutes: evaluated.overloadMinutes,
          changedCount:
            proposal.planDelta.changedTaskIds.length + proposal.planDelta.changedAssignmentIds.length,
          riskScore: proposal.explainability.riskScore
        })
      }
    };
  });
}

function deadlineCompressionCandidates(input: ControlSolverInput): ManagementActionCandidate[] {
  const deadlineSignal = input.signals.find((signal) => signal.sourceMetric === "deadline_delta_days");
  if (!deadlineSignal || !input.snapshot.project.deadline || !input.calculatedPlan.projectFinish) return [];
  if (dateDeltaDays(input.snapshot.project.deadline, input.calculatedPlan.projectFinish) <= 0) return [];

  return input.calculatedPlan.tasks
    .filter((task) => task.isCritical && task.durationMinutes && task.durationMinutes > 60)
    .slice(0, 5)
    .map((task) => {
      const reducedBy = Math.min(480, Math.max(60, Math.floor((task.durationMinutes ?? 0) * 0.1)));
      const commands: PlanningCommand[] = [
        {
          type: "task.update_work_model",
          payload: {
            taskId: task.id,
            taskType: task.taskType,
            effortDriven: task.effortDriven,
            durationMinutes: Math.max(60, (task.durationMinutes ?? 60) - reducedBy),
            workMinutes: Math.max(0, task.workMinutes - reducedBy)
          }
        }
      ];
      const planDelta: PlanDelta = {
        ...createEmptyPlanDelta(),
        commands,
        changedTaskIds: [task.id]
      };
      const evaluated = evaluatePlanDelta(input, planDelta);
      const riskScore = task.percentComplete > 0 ? 70 : 45;

      return {
        id: `action-${deadlineSignal.id}-compress-${task.id}`,
        type: "apply_planning_delta",
        label: `Сжать критическую задачу: ${task.title}`,
        targetEntity: { type: "ControlSignal", id: deadlineSignal.id },
        requiredPermissions: ["tenant.project_plan.manage"],
        planDelta,
        input: { taskId: task.id, reducedByMinutes: reducedBy },
        explainability: {
          reason: "Deadline-first solver уменьшает duration/work критической задачи и требует ручного подтверждения",
          deadlineDeltaDays: evaluated.deadlineDeltaDays,
          overloadMinutes: evaluated.overloadMinutes,
          changedTaskIds: [task.id],
          changedAssignmentIds: [],
          riskScore,
          cost: cost({
            deadlineDeltaDays: evaluated.deadlineDeltaDays,
            overloadMinutes: evaluated.overloadMinutes,
            changedCount: 1,
            riskScore
          })
        }
      };
    });
}

function deadlineMoveFallback(input: ControlSolverInput): ManagementActionCandidate[] {
  const deadlineSignal = input.signals.find((signal) => signal.sourceMetric === "deadline_delta_days");
  if (!deadlineSignal || !input.snapshot.project.deadline || !input.calculatedPlan.projectFinish) return [];
  if (dateDeltaDays(input.snapshot.project.deadline, input.calculatedPlan.projectFinish) <= 0) return [];

  const command: PlanningCommand = {
    type: "project.deadline.move",
    payload: {
      deadline: input.calculatedPlan.projectFinish,
      reason: "Solver fallback: текущий план не попадает в срок без управленческого изменения deadline"
    }
  };
  const planDelta: PlanDelta = {
    ...createEmptyPlanDelta(),
    commands: [command]
  };

  return [
    {
      id: `action-${deadlineSignal.id}-move-deadline`,
      type: "move_deadline",
      label: "Сдвинуть deadline до расчетного финиша",
      targetEntity: { type: "ControlSignal", id: deadlineSignal.id },
      requiredPermissions: ["tenant.project_plan.manage"],
      planDelta,
      input: { deadline: input.calculatedPlan.projectFinish },
      explainability: {
        reason: "Fallback не чинит план, а явно оформляет управленческое решение по сроку",
        deadlineDeltaDays: 0,
        overloadMinutes: input.resourceLoad.overloads.reduce(
          (total, overload) => total + overload.overloadMinutes,
          0
        ),
        changedTaskIds: [],
        changedAssignmentIds: [],
        riskScore: 90,
        cost: 90_000
      }
    }
  ];
}

function evaluatePlanDelta(
  input: ControlSolverInput,
  planDelta: PlanDelta
): { deadlineDeltaDays: number; overloadMinutes: number } {
  const nextSnapshot = applyPlanDeltaToSnapshot(input.snapshot, planDelta);
  const calculatedPlan = calculatePlan(nextSnapshot, {
    calculatedAt: input.calculatedAt,
    engineVersion: input.calculatedPlan.engineVersion
  });
  const resourceLoad = buildResourceLoadMatrix({
    plan: calculatedPlan,
    resources: nextSnapshot.resources,
    assignments: nextSnapshot.assignments,
    assignmentAllocations: nextSnapshot.assignmentAllocations,
    calendars: nextSnapshot.calendars,
    calendarExceptions: nextSnapshot.calendarExceptions,
    reservations: nextSnapshot.reservations,
    rangeStart: nextSnapshot.project.plannedStart,
    rangeFinish: calculatedPlan.projectFinish ?? nextSnapshot.project.plannedFinish,
    granularities: ["day"]
  });

  return {
    deadlineDeltaDays:
      nextSnapshot.project.deadline && calculatedPlan.projectFinish
        ? Math.max(0, dateDeltaDays(nextSnapshot.project.deadline, calculatedPlan.projectFinish))
        : 0,
    overloadMinutes: resourceLoad.overloads.reduce(
      (total, overload) => total + overload.overloadMinutes,
      0
    )
  };
}

function cost(input: {
  deadlineDeltaDays: number;
  overloadMinutes: number;
  changedCount: number;
  riskScore: number;
}): number {
  return input.deadlineDeltaDays * 10_000 + input.overloadMinutes + input.changedCount * 100 + input.riskScore;
}
