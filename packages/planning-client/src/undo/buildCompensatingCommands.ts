import type { PlanningCommand } from "@kiss-pm/domain";

import type { PlanningReadModel } from "../api/types";

type AuthoredTask = {
  id: string;
  title?: string;
  plannedStart?: string | null;
  plannedFinish?: string | null;
  percentComplete?: number;
  taskType?: string;
  effortDriven?: boolean;
  durationMinutes?: number | null;
  workMinutes?: number;
  statusId?: string;
};

function taskById(readModel: PlanningReadModel, taskId: string): AuthoredTask | undefined {
  return readModel.authored.tasks.find((task) => String(task.id) === taskId) as AuthoredTask | undefined;
}

export function buildCompensatingCommands(
  command: PlanningCommand,
  before: PlanningReadModel
): PlanningCommand[] {
  switch (command.type) {
    case "task.update_identity": {
      const task = taskById(before, command.payload.taskId);
      if (!task?.title) return [];
      return [
        {
          type: "task.update_identity",
          payload: { taskId: command.payload.taskId, title: String(task.title) }
        }
      ];
    }
    case "task.update_schedule": {
      const task = taskById(before, command.payload.taskId);
      if (!task) return [];
      return [
        {
          type: "task.update_schedule",
          payload: {
            taskId: command.payload.taskId,
            plannedStart: (task.plannedStart as string | null) ?? null,
            plannedFinish: (task.plannedFinish as string | null) ?? null
          }
        }
      ];
    }
    case "task.update_progress": {
      const task = taskById(before, command.payload.taskId);
      if (!task) return [];
      return [
        {
          type: "task.update_progress",
          payload: {
            taskId: command.payload.taskId,
            percentComplete: Number(task.percentComplete ?? 0)
          }
        }
      ];
    }
    case "task.update_status": {
      const task = taskById(before, command.payload.taskId);
      if (!task?.statusId) return [];
      return [
        {
          type: "task.update_status",
          payload: { taskId: command.payload.taskId, statusId: String(task.statusId) }
        }
      ];
    }
    case "task.update_work_model": {
      const task = taskById(before, command.payload.taskId);
      if (!task) return [];
      return [
        {
          type: "task.update_work_model",
          payload: {
            taskId: command.payload.taskId,
            taskType: (task.taskType ?? "fixed_duration") as "fixed_duration",
            effortDriven: Boolean(task.effortDriven),
            durationMinutes: (task.durationMinutes as number | null) ?? null,
            workMinutes: Number(task.workMinutes ?? 0)
          }
        }
      ];
    }
    case "assignment.upsert": {
      // Правки труда/длительности шлют [task.update_work_model, assignment.upsert] пакетом,
      // поэтому откат task-модели без отката назначения возвращал бы тот самый рассинхрон
      // WBS↔Ресурсы (нагрузка считается из assignment.workMinutes). Восстанавливаем прежнее
      // назначение по id; если его не было до правки — компенсируем удалением.
      const existing = before.authored.assignments.find(
        (assignment) => String((assignment as { id?: unknown }).id) === command.payload.id
      ) as Record<string, unknown> | undefined;
      if (existing) {
        return [
          {
            type: "assignment.upsert",
            payload: {
              id: command.payload.id,
              taskId: String(existing.taskId),
              resourceId: String(existing.resourceId),
              role: (existing.role as string | undefined) ?? "executor",
              unitsPermille: Number(existing.unitsPermille ?? 1000),
              workMinutes: existing.workMinutes == null ? null : Number(existing.workMinutes)
            }
          } as PlanningCommand
        ];
      }
      return [{ type: "assignment.delete", payload: { assignmentId: command.payload.id } }];
    }
    case "dependency.upsert": {
      const existing = before.authored.dependencies.find((dep) => String(dep.id) === command.payload.id);
      if (existing) {
        return [
          {
            type: "dependency.upsert",
            payload: {
              id: command.payload.id,
              predecessorTaskId: String(existing.predecessorTaskId),
              successorTaskId: String(existing.successorTaskId),
              dependencyType: existing.type as "FS",
              lagMinutes: Number(existing.lagMinutes ?? 0)
            }
          }
        ];
      }
      return [{ type: "dependency.delete", payload: { dependencyId: command.payload.id } }];
    }
    case "dependency.delete": {
      const existing = before.authored.dependencies.find(
        (dep) => String(dep.id) === command.payload.dependencyId
      );
      if (!existing) return [];
      return [
        {
          type: "dependency.upsert",
          payload: {
            id: String(existing.id),
            predecessorTaskId: String(existing.predecessorTaskId),
            successorTaskId: String(existing.successorTaskId),
            dependencyType: existing.type as "FS",
            lagMinutes: Number(existing.lagMinutes ?? 0)
          }
        }
      ];
    }
    default:
      return [];
  }
}
