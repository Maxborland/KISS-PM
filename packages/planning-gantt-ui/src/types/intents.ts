import type {
  PlanningGanttDependencyType,
  PlanningGanttTaskType
} from "./viewModel";

export type PlanningGanttIntent =
  | { type: "task.create"; parentTaskId: string | null; insertAfterTaskId: string | null }
  | { type: "task.rename"; taskId: string; title: string }
  | {
      type: "task.schedule.drag";
      taskId: string;
      plannedStart: string | null;
      plannedFinish: string | null;
    }
  | {
      type: "task.work_model.edit";
      taskId: string;
      durationMinutes: number | null;
      workMinutes: number;
      taskType: PlanningGanttTaskType;
      effortDriven: boolean;
    }
  | { type: "task.status.update"; taskId: string; statusId: string }
  | { type: "task.move_wbs"; taskId: string; parentTaskId: string | null; sortOrder: number }
  | {
      type: "dependency.upsert";
      id: string;
      predecessorTaskId: string;
      successorTaskId: string;
      dependencyType: PlanningGanttDependencyType;
      lagMinutes: number;
    }
  | { type: "dependency.delete"; dependencyId: string }
  | {
      type: "assignment.upsert";
      id: string;
      taskId: string;
      resourceId: string;
      role: "executor" | "co_executor" | "controller" | "approver" | "observer";
      unitsPermille: number;
      workMinutes: number | null;
    }
  | { type: "assignment.delete"; assignmentId: string }
  | { type: "baseline.capture"; label: string };
