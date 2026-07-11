import type {
  AutoPlanningSolverProposal,
  PlanningCommand,
  ScenarioProposal
} from "@kiss-pm/domain";
import { createHash } from "node:crypto";

import { parsePlanningCommand } from "./planningParsers";

type PersistedPlanningProposal = ScenarioProposal | AutoPlanningSolverProposal;

export function hashJson(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function parseScenarioProposal(input: Record<string, unknown>): ScenarioProposal | null {
  return parsePersistedProposal<ScenarioProposal>(input);
}

export function parseAutoSolverProposal(
  input: Record<string, unknown> | undefined
): AutoPlanningSolverProposal | null {
  return parsePersistedProposal<AutoPlanningSolverProposal>(input);
}

export function proposalRequiresAcceptedRiskReason(proposal: PersistedPlanningProposal): boolean {
  return proposal.planDelta.commands.some((command) => command.type === "risk.accept_overload");
}

export function proposalRequiresResourceManage(proposal: PersistedPlanningProposal): boolean {
  return proposal.planDelta.commands.some(
    (command) =>
      command.type === "assignment.upsert" ||
      command.type === "assignment.delete" ||
      command.type === "assignment.allocations.replace" ||
      command.type === "resource.reserve"
  );
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

function parsePersistedProposal<T extends PersistedPlanningProposal>(
  input: Record<string, unknown> | undefined
): T | null {
  if (!input || !Array.isArray((input as { planDelta?: { commands?: unknown[] } }).planDelta?.commands)) {
    return null;
  }
  const commands = (input as { planDelta: { commands: unknown[] } }).planDelta.commands.map(
    (command) => parsePlanningCommand(command)
  );
  if (commands.some((command) => !command.ok)) return null;
  return {
    ...(input as unknown as T),
    planDelta: {
      ...(input as unknown as T).planDelta,
      commands: commands.map((command) => (command.ok ? command.value : neverCommand()))
    }
  };
}

function stableStringify(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function neverCommand(): PlanningCommand {
  throw new Error("unreachable_invalid_planning_command");
}
