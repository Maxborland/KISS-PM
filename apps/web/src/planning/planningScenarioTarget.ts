import type { ScenarioTarget } from "@kiss-pm/domain";

export function scenarioTargetKey(target: ScenarioTarget): string {
  return `${target.type}:${target.resourceId}:${target.date}:${target.overloadMinutes}:${[...target.taskIds].sort().join(",")}`;
}
