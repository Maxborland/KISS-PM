import type { Task, TaskStatus } from "./api";

export function formatTaskStatus(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    new: "Новая",
    waiting: "Ожидает",
    in_progress: "В работе",
    review: "На контроле",
    done: "Выполнено"
  };
  return labels[status];
}

export function getNextTaskAction(
  status: TaskStatus
): { label: string; status: TaskStatus } | null {
  if (status === "new" || status === "waiting") return { label: "В работу", status: "in_progress" };
  if (status === "in_progress") return { label: "На контроль", status: "review" };
  if (status === "review") return { label: "Принять", status: "done" };
  return null;
}

export function canUserTransitionTask(task: Task, userId: string): boolean {
  const transitionRoles = new Set(["executor", "co_executor", "controller"]);
  return task.participants.some(
    (participant) =>
      participant.userId === userId && transitionRoles.has(participant.role)
  );
}
