import { createPlanningCommand, type PlanningCommand } from "@kiss-pm/domain";

type MilestoneAssignment = { id: string };

export function buildMilestoneCommands(input: {
  taskId: string;
  assignments: readonly MilestoneAssignment[];
}): PlanningCommand[] {
  return [
    ...input.assignments.map((assignment) =>
      createPlanningCommand({
        type: "assignment.delete",
        payload: { assignmentId: assignment.id }
      })
    ),
    createPlanningCommand({
      type: "task.update_work_model",
      payload: {
        taskId: input.taskId,
        taskType: "fixed_duration",
        effortDriven: false,
        durationMinutes: 0,
        workMinutes: 0
      }
    }),
    createPlanningCommand({
      type: "task.update_custom_field",
      payload: {
        taskId: input.taskId,
        fieldKey: "kind",
        value: "milestone"
      }
    })
  ];
}
