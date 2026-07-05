import type { PlanningCommand } from "./planningCommands";
import type { PlanSnapshot } from "./types";

// BUG-PROJ-24: инверсия команды по СНАПШОТУ «до». Возвращает компенсирующие команды,
// возвращающие затронутые сущности к прежним значениям. Server-side аналог
// planning-client/undo (тот читал read-model; здесь — доменный снапшот).
// Необратимые команды (создание/перенос/назначения/принятие риска) → [] (revert недоступен).
export function buildCompensatingCommands(
  command: PlanningCommand,
  before: PlanSnapshot
): PlanningCommand[] {
  const taskById = (taskId: string) => before.tasks.find((task) => task.id === taskId);
  switch (command.type) {
    case "task.update_identity": {
      const task = taskById(command.payload.taskId);
      if (!task?.title) return [];
      return [{ type: "task.update_identity", payload: { taskId: command.payload.taskId, title: task.title } }];
    }
    case "task.update_schedule": {
      const task = taskById(command.payload.taskId);
      if (!task) return [];
      return [
        {
          type: "task.update_schedule",
          payload: {
            taskId: command.payload.taskId,
            plannedStart: task.plannedStart ?? null,
            plannedFinish: task.plannedFinish ?? null
          }
        }
      ];
    }
    case "task.update_progress": {
      const task = taskById(command.payload.taskId);
      if (!task) return [];
      return [
        {
          type: "task.update_progress",
          payload: { taskId: command.payload.taskId, percentComplete: task.percentComplete ?? 0 }
        }
      ];
    }
    case "task.update_status": {
      const task = taskById(command.payload.taskId);
      if (!task?.statusId) return [];
      return [{ type: "task.update_status", payload: { taskId: command.payload.taskId, statusId: task.statusId } }];
    }
    case "task.update_work_model": {
      const task = taskById(command.payload.taskId);
      if (!task) return [];
      return [
        {
          type: "task.update_work_model",
          payload: {
            taskId: command.payload.taskId,
            taskType: task.taskType,
            effortDriven: task.effortDriven,
            durationMinutes: task.durationMinutes ?? null,
            workMinutes: task.workMinutes
          }
        }
      ];
    }
    case "dependency.upsert": {
      const existing = before.dependencies.find((dep) => dep.id === command.payload.id);
      if (existing) {
        return [
          {
            type: "dependency.upsert",
            payload: {
              id: command.payload.id,
              predecessorTaskId: existing.predecessorTaskId,
              successorTaskId: existing.successorTaskId,
              dependencyType: existing.type,
              lagMinutes: existing.lagMinutes
            }
          }
        ];
      }
      return [{ type: "dependency.delete", payload: { dependencyId: command.payload.id } }];
    }
    case "dependency.delete": {
      const existing = before.dependencies.find((dep) => dep.id === command.payload.dependencyId);
      if (!existing) return [];
      return [
        {
          type: "dependency.upsert",
          payload: {
            id: existing.id,
            predecessorTaskId: existing.predecessorTaskId,
            successorTaskId: existing.successorTaskId,
            dependencyType: existing.type,
            lagMinutes: existing.lagMinutes
          }
        }
      ];
    }
    default:
      return [];
  }
}
