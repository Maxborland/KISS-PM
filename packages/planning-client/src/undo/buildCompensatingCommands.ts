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
  customFields?: Record<string, unknown>;
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
    case "task.update_custom_field": {
      const task = taskById(before, command.payload.taskId);
      if (!task) return [];
      const customFields = task.customFields ?? {};
      const value = Object.prototype.hasOwnProperty.call(customFields, command.payload.fieldKey)
        ? customFields[command.payload.fieldKey]
        : null;
      return [
        {
          type: "task.update_custom_field",
          payload: {
            taskId: command.payload.taskId,
            fieldKey: command.payload.fieldKey,
            value
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
        const allocations = before.authored.assignmentAllocations
          .filter((allocation) => String(allocation.assignmentId) === command.payload.id)
          .map(({ date, workMinutes }) => ({ date, workMinutes }));
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
          } as PlanningCommand,
          ...(allocations.length > 0
            ? [{
                type: "assignment.allocations.replace" as const,
                payload: { assignmentId: command.payload.id, allocations }
              }]
            : [])
        ];
      }
      return [{ type: "assignment.delete", payload: { assignmentId: command.payload.id } }];
    }
    case "assignment.delete": {
      const existing = before.authored.assignments.find(
        (assignment) => String((assignment as { id?: unknown }).id) === command.payload.assignmentId
      ) as Record<string, unknown> | undefined;
      if (!existing) return [];
      const allocations = before.authored.assignmentAllocations
        .filter((allocation) => String(allocation.assignmentId) === command.payload.assignmentId)
        .map(({ date, workMinutes }) => ({ date, workMinutes }));
      return [
        {
          type: "assignment.upsert",
          payload: {
            id: command.payload.assignmentId,
            taskId: String(existing.taskId),
            resourceId: String(existing.resourceId),
            role: (existing.role as string | undefined) ?? "executor",
            unitsPermille: Number(existing.unitsPermille ?? 1000),
            workMinutes: existing.workMinutes == null ? null : Number(existing.workMinutes)
          }
        } as PlanningCommand,
        ...(allocations.length > 0
          ? [{
              type: "assignment.allocations.replace" as const,
              payload: { assignmentId: command.payload.assignmentId, allocations }
            }]
          : [])
      ];
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

export function buildCompensatingCommandBatch(
  commands: readonly PlanningCommand[],
  before: PlanningReadModel
): PlanningCommand[] {
  const groups = commands.map((command) => buildCompensatingCommands(command, before));
  if (groups.some((group) => group.length === 0)) return [];
  return groups.reverse().flat();
}
