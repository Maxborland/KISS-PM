import type { PlanningReadModel } from "@kiss-pm/planning-client";

export type WbsGridRow = {
  id: string;
  wbsIndex: number;
  wbsCode: string;
  title: string;
  durationLabel: string;
  finish: string | null;
  percentComplete: number;
  assignmentsLabel: string;
  hasValidation: boolean;
  task: Record<string, unknown>;
};

export function buildWbsRows(readModel: PlanningReadModel | undefined): WbsGridRow[] {
  if (!readModel) return [];
  const tasks = [...readModel.authored.tasks].sort((left, right) =>
    String(left.wbsCode ?? "").localeCompare(String(right.wbsCode ?? ""), "ru")
  );
  const calculatedById = new Map(
    (readModel.calculatedPlan.tasks as Array<Record<string, unknown>>).map((task) => [
      String(task.id),
      task
    ])
  );
  const workingMinutesPerDay = 8 * 60;
  return tasks.map((task, index) => {
    const calculated = calculatedById.get(String(task.id));
    const finish =
      (calculated?.calculatedFinish as string | null | undefined) ??
      (task.plannedFinish as string | null | undefined) ??
      null;
    const durationMinutes = Number(task.durationMinutes ?? calculated?.durationMinutes ?? 0);
    const durationLabel =
      durationMinutes > 0
        ? durationMinutes % workingMinutesPerDay === 0
          ? `${durationMinutes / workingMinutesPerDay} дн`
          : `${Math.round(durationMinutes / 60)} ч`
        : "";
    const assignments = readModel.authored.assignments.filter(
      (assignment) => String(assignment.taskId) === String(task.id)
    );
    return {
      id: String(task.id),
      wbsIndex: index + 1,
      wbsCode: String(task.wbsCode ?? index + 1),
      title: String(task.title ?? ""),
      durationLabel,
      finish,
      percentComplete: Number(task.percentComplete ?? 0),
      assignmentsLabel: assignments.length > 0 ? String(assignments.length) : "",
      hasValidation: readModel.validationIssues.some(
        (issue) =>
          issue.entity?.type === "task" && issue.entity.id === String(task.id) && issue.severity === "error"
      ),
      task
    };
  });
}
