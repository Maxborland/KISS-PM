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
    case "task.delete_or_archive": {
      // Обратимость удаления ветки WBS (Блок 9): по снапшоту «до» пересоздаём задачу
      // (task.create) и восстанавливаем поля, которые create не переносит (прогресс,
      // рабочая модель, кастом-поля), её назначения с распределением и связи. Так ошибочное
      // удаление откатывается кнопкой «Откат» тем же путём apply, что и остальные команды.
      const taskId = command.payload.taskId;
      const source = before.authored.tasks.find((task) => String(task.id) === taskId);
      if (!source) return [];
      const assignments = before.authored.assignments.filter(
        (assignment) => String(assignment.taskId) === taskId
      );
      const commands: PlanningCommand[] = [
        {
          type: "task.create",
          payload: {
            id: taskId,
            projectId: String(before.project.id),
            parentTaskId: source.parentTaskId ?? null,
            title: source.title,
            statusId: source.statusId,
            plannedStart: source.plannedStart ?? null,
            plannedFinish: source.plannedFinish ?? null,
            durationMinutes: source.durationMinutes ?? null,
            workMinutes: source.workMinutes,
            assignments: assignments.map((assignment) => ({
              id: assignment.id,
              resourceId: assignment.resourceId,
              role: assignment.role,
              unitsPermille: assignment.unitsPermille,
              workMinutes: assignment.workMinutes
            }))
          }
        },
        // create фиксирует taskType=fixed_units/effortDriven=false и progress=0 — возвращаем прежние
        {
          type: "task.update_work_model",
          payload: {
            taskId,
            taskType: source.taskType,
            effortDriven: source.effortDriven,
            durationMinutes: source.durationMinutes ?? null,
            workMinutes: source.workMinutes
          }
        }
      ];
      if (source.percentComplete > 0) {
        commands.push({
          type: "task.update_progress",
          payload: { taskId, percentComplete: source.percentComplete }
        });
      }
      for (const [fieldKey, value] of Object.entries(source.customFields ?? {})) {
        commands.push({ type: "task.update_custom_field", payload: { taskId, fieldKey, value } });
      }
      // распределение труда назначений (assignmentAllocations create не переносит)
      for (const assignment of assignments) {
        const allocations = before.authored.assignmentAllocations
          .filter((allocation) => String(allocation.assignmentId) === String(assignment.id))
          .map(({ date, workMinutes }) => ({ date, workMinutes }));
        if (allocations.length > 0) {
          commands.push({
            type: "assignment.allocations.replace",
            payload: { assignmentId: assignment.id, allocations }
          });
        }
      }
      // связи, которых касалась удалённая задача (summary-задачи связей не имеют по правилам домена)
      for (const dep of before.authored.dependencies) {
        if (String(dep.predecessorTaskId) === taskId || String(dep.successorTaskId) === taskId) {
          commands.push({
            type: "dependency.upsert",
            payload: {
              id: String(dep.id),
              predecessorTaskId: String(dep.predecessorTaskId),
              successorTaskId: String(dep.successorTaskId),
              dependencyType: dep.type,
              lagMinutes: Number(dep.lagMinutes ?? 0)
            }
          });
        }
      }
      if (source.constraint) {
        commands.push({
          type: "constraint.update",
          payload: {
            taskId,
            constraintId: String(source.constraint.id),
            type: source.constraint.type,
            date: source.constraint.date ?? null
          }
        });
      }
      return commands;
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
  const flat = groups.reverse().flat();
  // Пересоздание (task.create) должно предшествовать всему, что ссылается на задачи
  // (dependency.upsert между сёстрами, assignment/constraint) — иначе в откате удалённого
  // поддерева связь сослалась бы на ещё не созданную задачу и валидация отклонила бы пакет.
  // Стабильная секционировка: сначала все creates (в их порядке — родитель раньше ребёнка,
  // т.к. удаление шло листья→корень и уже перевёрнуто), затем остальное. Для команд без
  // task.create (все прочие откаты) порядок не меняется.
  if (!flat.some((command) => command.type === "task.create")) return flat;
  const creates = flat.filter((command) => command.type === "task.create");
  const rest = flat.filter((command) => command.type !== "task.create");
  return [...creates, ...rest];
}
