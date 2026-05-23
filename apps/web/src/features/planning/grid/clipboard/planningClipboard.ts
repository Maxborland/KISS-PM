import type { PlanningCommand } from "@kiss-pm/domain";
import { parsePredecessorString } from "@kiss-pm/planning-client";

export function normalizeTsvInput(input: string): string {
  return input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
}

export function buildCommandsFromTsvPaste(
  input: string,
  projectId: string,
  statusId: string,
  wbsIndexToTaskId: Map<number, string>
): PlanningCommand[] {
  const lines = normalizeTsvInput(input).split("\n").filter(Boolean);
  const commands: PlanningCommand[] = [];
  lines.forEach((line, index) => {
    const cells = line.split("\t");
    const title = cells[0]?.trim();
    if (!title) return;
    const taskId = `paste-task-${Date.now()}-${index}`;
    commands.push({
      type: "task.create",
      payload: {
        id: taskId,
        projectId,
        title,
        statusId,
        plannedStart: null,
        plannedFinish: cells[2]?.trim() || null,
        durationMinutes: null,
        workMinutes: 480,
        assignments: []
      }
    });
    const predecessors = cells[5]?.trim() ?? cells[4]?.trim();
    if (predecessors) {
      const parsed = parsePredecessorString(predecessors);
      if (parsed.ok) {
        for (const link of parsed.links) {
          const predecessorTaskId = wbsIndexToTaskId.get(link.predecessorWbsIndex);
          if (!predecessorTaskId) continue;
          commands.push({
            type: "dependency.upsert",
            payload: {
              id: `dep-${taskId}-${link.predecessorWbsIndex}`,
              predecessorTaskId,
              successorTaskId: taskId,
              dependencyType: link.dependencyType,
              lagMinutes: link.lagMinutes
            }
          });
        }
      }
    }
  });
  return commands;
}
