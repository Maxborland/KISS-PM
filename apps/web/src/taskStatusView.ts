import type { Task, TaskStatus } from "./api";

export function formatTaskStatus(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    todo: "К выполнению",
    in_progress: "В работе",
    blocked: "Блокер",
    done: "Готово"
  };
  return labels[status];
}

export function getNextTaskAction(
  status: TaskStatus
): { label: string; status: TaskStatus } | null {
  if (status === "todo") return { label: "Начать", status: "in_progress" };
  if (status === "in_progress" || status === "blocked") {
    return { label: "Завершить", status: "done" };
  }
  return null;
}

export function canUserTransitionTask(task: Task, userId: string): boolean {
  const transitionRoles = new Set(["executor", "co_executor", "controller"]);
  return task.participants.some(
    (participant) =>
      participant.userId === userId && transitionRoles.has(participant.role)
  );
}
