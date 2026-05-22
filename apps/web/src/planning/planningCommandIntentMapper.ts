import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningGanttIntent } from "@kiss-pm/planning-gantt-ui";

export type PlanningCommandIntentContext = {
  projectId: string;
  defaultStatusId: string;
  defaultStart: string | null;
  defaultFinish: string | null;
  defaultWorkMinutes: number;
  makeId(prefix: string): string;
};

export function mapPlanningGanttIntentToCommand(
  intent: PlanningGanttIntent,
  context: PlanningCommandIntentContext
): PlanningCommand {
  switch (intent.type) {
    case "task.create":
      return {
        type: "task.create",
        payload: {
          id: context.makeId("task"),
          projectId: context.projectId,
          parentTaskId: intent.parentTaskId,
          title: "Новая задача",
          statusId: context.defaultStatusId,
          plannedStart: context.defaultStart,
          plannedFinish: context.defaultFinish,
          durationMinutes: null,
          workMinutes: context.defaultWorkMinutes,
          assignments: []
        }
      };
    case "task.rename":
      return {
        type: "task.update_identity",
        payload: {
          taskId: intent.taskId,
          title: intent.title
        }
      };
    case "task.schedule.drag":
      return {
        type: "task.update_schedule",
        payload: {
          taskId: intent.taskId,
          plannedStart: intent.plannedStart,
          plannedFinish: intent.plannedFinish
        }
      };
    case "task.work_model.edit":
      return {
        type: "task.update_work_model",
        payload: {
          taskId: intent.taskId,
          taskType: intent.taskType,
          effortDriven: intent.effortDriven,
          durationMinutes: intent.durationMinutes,
          workMinutes: intent.workMinutes
        }
      };
    case "task.move_wbs":
      return {
        type: "task.move_wbs",
        payload: {
          taskId: intent.taskId,
          parentTaskId: intent.parentTaskId,
          sortOrder: intent.sortOrder
        }
      };
    case "dependency.upsert":
      return {
        type: "dependency.upsert",
        payload: {
          id: intent.id,
          predecessorTaskId: intent.predecessorTaskId,
          successorTaskId: intent.successorTaskId,
          dependencyType: intent.dependencyType,
          lagMinutes: intent.lagMinutes
        }
      };
    case "dependency.delete":
      return {
        type: "dependency.delete",
        payload: {
          dependencyId: intent.dependencyId
        }
      };
    case "assignment.upsert":
      return {
        type: "assignment.upsert",
        payload: {
          id: intent.id,
          taskId: intent.taskId,
          resourceId: intent.resourceId,
          role: intent.role,
          unitsPermille: intent.unitsPermille,
          workMinutes: intent.workMinutes
        }
      };
    case "assignment.delete":
      return {
        type: "assignment.delete",
        payload: {
          assignmentId: intent.assignmentId
        }
      };
    case "baseline.capture":
      return {
        type: "baseline.capture",
        payload: {
          baselineId: context.makeId("baseline"),
          label: intent.label
        }
      };
  }
}
