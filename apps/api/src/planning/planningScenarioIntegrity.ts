import type { PlanningCommand, PlanSnapshot, ScenarioProposal, ScenarioTarget } from "@kiss-pm/domain";
import type { PlanningScenarioRunRecord } from "@kiss-pm/persistence";

import { parsePlanningCommand } from "../planningParsers";
import { PLANNING_ENGINE_VERSION } from "./planningConstants";
import { createPlanningReadModel } from "./planningReadModel";

export function scenarioRequiresAcceptedRiskReason(proposal: ScenarioProposal): boolean {
  return proposal.planDelta.commands.some((command) => command.type === "risk.accept_overload");
}

export function withAcceptedRiskReason(
  commands: PlanningCommand[],
  acceptedRiskReason: string | null
): PlanningCommand[] {
  if (!acceptedRiskReason) return commands;
  return commands.map((command) =>
    command.type === "risk.accept_overload"
      ? {
          ...command,
          payload: {
            ...command.payload,
            acceptedRiskReason
          }
        }
      : command
  );
}

export function validateScenarioRunIntegrity(
  scenarioRun: PlanningScenarioRunRecord,
  snapshot: PlanSnapshot
): string | null {
  if (scenarioRun.engineVersion !== PLANNING_ENGINE_VERSION) {
    return "planning_scenario_engine_mismatch";
  }
  const target = parseScenarioTargetRecord(scenarioRun.targetConflict);
  if (!target) return "planning_scenario_target_mismatch";

  const readModel = createPlanningReadModel(snapshot);
  const overload = readModel.resourceLoad.overloads.find(
    (candidate) =>
      candidate.granularity === "day" &&
      candidate.resourceId === target.resourceId &&
      candidate.date === target.date
  );
  if (!overload) return "planning_scenario_target_mismatch";
  if (overload.overloadMinutes !== target.overloadMinutes) {
    return "planning_scenario_target_mismatch";
  }
  if (!sameStringSet(overload.taskIds, target.taskIds)) {
    return "planning_scenario_target_mismatch";
  }
  return null;
}

export function parseScenarioTargetRecord(input: Record<string, unknown>): ScenarioTarget | null {
  if (input.type !== "resource_overload") return null;
  if (typeof input.resourceId !== "string" || input.resourceId.trim().length === 0) return null;
  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null;
  if (
    typeof input.overloadMinutes !== "number" ||
    !Number.isInteger(input.overloadMinutes) ||
    input.overloadMinutes <= 0
  ) {
    return null;
  }
  if (!isStringArray(input.taskIds)) {
    return null;
  }
  return {
    type: "resource_overload",
    resourceId: input.resourceId,
    date: input.date,
    overloadMinutes: input.overloadMinutes,
    taskIds: input.taskIds
  };
}

export function parseScenarioProposal(input: Record<string, unknown>): ScenarioProposal | null {
  const planDelta = isRecord(input.planDelta) ? input.planDelta : null;
  if (!Array.isArray(planDelta?.commands)) {
    return null;
  }
  const commands = planDelta.commands.map((command) => parsePlanningCommand(command));
  if (commands.some((command) => !command.ok)) return null;
  return {
    ...input,
    planDelta: {
      ...planDelta,
      commands: commands.map((command) => (command.ok ? command.value : neverCommand()))
    }
  } as ScenarioProposal;
}

function sameStringSet(left: string[], right: string[]): boolean {
  const normalize = (values: string[]) => [...new Set(values)].sort().join("\n");
  return normalize(left) === normalize(right);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isStringArray(input: unknown): input is string[] {
  return Array.isArray(input) && input.every((item) => typeof item === "string");
}

function neverCommand(): PlanningCommand {
  throw new Error("unreachable_invalid_planning_command");
}
