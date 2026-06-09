import type { PlanningCommand } from "@kiss-pm/domain";

export function auditActionForCommand(command: PlanningCommand): string {
  if (command.type === "task.delete_or_archive") {
    return command.payload.mode === "delete" ? "planning.task.deleted" : "planning.task.archived";
  }

  const actionByCommand: Record<Exclude<PlanningCommand["type"], "task.delete_or_archive">, string> = {
    "task.create": "planning.task.created",
    "task.update_identity": "planning.task.updated",
    "task.update_schedule": "planning.task.updated",
    "task.update_work_model": "planning.task.updated",
    "task.update_status": "planning.task.status_changed",
    "task.update_progress": "planning.task.updated",
    "task.move_wbs": "planning.task.updated",
    "dependency.upsert": "planning.dependency.upserted",
    "dependency.delete": "planning.dependency.deleted",
    "assignment.upsert": "planning.assignment.upserted",
    "assignment.delete": "planning.assignment.deleted",
    "assignment.allocations.replace": "planning.assignment_allocations.replaced",
    "baseline.capture": "planning.baseline.captured",
    "calendar.exception.upsert": "planning.calendar_exception.upserted",
    "constraint.update": "planning.constraint.updated",
    "resource.reserve": "planning.resource_reserved",
    "risk.accept_overload": "planning.overload_risk_accepted",
    "project.deadline.move": "planning.task.updated",
    "project.settings.update": "project.settings.update.applied",
    "task.update_custom_field": "task.update_custom_field.applied"
  };
  return actionByCommand[command.type];
}
