import type {
  Project,
  Task,
  TaskParticipantRole,
  TaskStatus,
  TaskStatusDefinition,
  WorkspaceUser
} from "./api";

export type TaskDueFilter = "all" | "overdue" | "today" | "tomorrow" | "two_weeks";
export type TaskViewMode = "table" | "kanban";
export type TaskRoleFilter = "all" | TaskParticipantRole;

export type TaskFilters = {
  due: TaskDueFilter;
  role: TaskRoleFilter;
  statusId: string;
  projectId: string;
  query: string;
};

const transitionGraph: Record<TaskStatus, TaskStatus[]> = {
  new: ["waiting", "in_progress"],
  waiting: ["in_progress"],
  in_progress: ["waiting", "review", "done"],
  review: ["in_progress", "done"],
  done: []
};

export function sortTaskStatuses(
  statuses: readonly TaskStatusDefinition[]
): TaskStatusDefinition[] {
  return [...statuses]
    .filter((status) => status.status === "active")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export function filterTasks(
  tasks: readonly Task[],
  filters: TaskFilters,
  context: {
    currentUserId: string;
    projects: readonly Project[];
    users: readonly WorkspaceUser[];
    today?: string;
  }
): Task[] {
  const today = context.today ?? toDateOnly(new Date());
  const query = normalize(filters.query);

  return tasks.filter((task) => {
    if (filters.statusId !== "all" && task.statusId !== filters.statusId) return false;
    if (filters.projectId !== "all" && task.projectId !== filters.projectId) return false;
    if (filters.role !== "all" && !hasTaskRole(task, context.currentUserId, filters.role)) {
      return false;
    }
    if (!matchesDueFilter(task, filters.due, today)) return false;
    if (!query) return true;

    const project = context.projects.find((candidate) => candidate.id === task.projectId);
    const participantNames = task.participants
      .map((participant) => context.users.find((user) => user.id === participant.userId)?.name ?? participant.userId)
      .join(" ");
    const haystack = normalize(
      [
        task.id,
        task.title,
        task.description ?? "",
        project?.title ?? "",
        project?.clientName ?? "",
        participantNames
      ].join(" ")
    );
    return query.split(/\s+/).every((term) => haystack.includes(term));
  });
}

export function groupTasksByStatus(
  tasks: readonly Task[],
  statuses: readonly TaskStatusDefinition[]
): { status: TaskStatusDefinition; tasks: Task[] }[] {
  return sortTaskStatuses(statuses).map((status) => ({
    status,
    tasks: tasks.filter((task) => task.statusId === status.id)
  }));
}

export function canEditTaskFields(
  task: Task,
  currentUserId: string,
  permissions: readonly string[]
): boolean {
  return (
    task.requesterUserId === currentUserId ||
    permissions.includes("tenant.tasks.edit") ||
    permissions.includes("tenant.projects.manage")
  );
}

export function canArchiveTask(permissions: readonly string[]): boolean {
  return (
    permissions.includes("tenant.tasks.delete") ||
    permissions.includes("tenant.projects.manage")
  );
}

export function canCommentTask(
  task: Task,
  currentUserId: string,
  permissions: readonly string[]
): boolean {
  return (
    task.participants.some((participant) => participant.userId === currentUserId) ||
    canEditTaskFields(task, currentUserId, permissions)
  );
}

export function canTransitionTaskStatus(
  task: Task,
  currentUserId: string,
  permissions: readonly string[]
): boolean {
  if (canEditTaskFields(task, currentUserId, permissions)) return true;
  return task.participants.some(
    (participant) =>
      participant.userId === currentUserId &&
      ["executor", "co_executor", "controller"].includes(participant.role)
  );
}

export function getNextTaskStatusAction(
  task: Task,
  statuses: readonly TaskStatusDefinition[],
  currentUserId: string,
  permissions: readonly string[]
): { label: string; statusId: string; category: TaskStatus; disabledReason?: string } | null {
  if (task.statusCategory === "done") return null;

  const activeStatuses = sortTaskStatuses(statuses);
  const currentCategory = task.statusCategory;
  const allowedCategories = transitionGraph[currentCategory] ?? [];
  const preferredCategory = getPreferredNextCategory(task, currentUserId, permissions);
  const category = allowedCategories.includes(preferredCategory)
    ? preferredCategory
    : allowedCategories[0];
  const target = activeStatuses.find((status) => status.category === category);
  if (!target) {
    return {
      label: "Недоступно",
      statusId: task.statusId,
      category: currentCategory,
      disabledReason: "В настройках нет активного следующего статуса."
    };
  }
  if (!canTransitionTaskStatus(task, currentUserId, permissions)) {
    return {
      label: getActionLabel(target.category),
      statusId: target.id,
      category: target.category,
      disabledReason: "Нужна роль исполнителя, контролера, постановщика или право редактирования задач."
    };
  }
  if (
    task.requiresAcceptance &&
    currentCategory === "in_progress" &&
    target.category === "done" &&
    !canEditTaskFields(task, currentUserId, permissions)
  ) {
    return {
      label: "На контроль",
      statusId:
        activeStatuses.find((status) => status.category === "review")?.id ?? target.id,
      category: "review"
    };
  }

  return {
    label: getActionLabel(target.category),
    statusId: target.id,
    category: target.category
  };
}

export function getTaskCounters(tasks: readonly Task[], today = toDateOnly(new Date())) {
  return {
    overdue: tasks.filter((task) => task.statusCategory !== "done" && task.plannedFinish < today).length,
    inProgress: tasks.filter((task) => task.statusCategory === "in_progress").length,
    done: tasks.filter((task) => task.statusCategory === "done").length,
    plannedWork: tasks.reduce((sum, task) => sum + task.plannedWork, 0)
  };
}

export function getProjectName(projects: readonly Project[], projectId: string): string {
  return projects.find((project) => project.id === projectId)?.title ?? projectId;
}

export function getUserName(users: readonly WorkspaceUser[], currentUser: WorkspaceUser, userId: string): string {
  if (currentUser.id === userId) return currentUser.name;
  return users.find((user) => user.id === userId)?.name ?? userId;
}

export function getRoleLabel(role: TaskParticipantRole): string {
  const labels: Record<TaskParticipantRole, string> = {
    requester: "Постановщик",
    executor: "Ответственный",
    co_executor: "Соисполнитель",
    controller: "Контролер",
    approver: "Принимающий",
    observer: "Наблюдатель"
  };
  return labels[role];
}

export function getPriorityLabel(priority: Task["priority"]): string {
  return {
    low: "Низкий",
    normal: "Обычный",
    high: "Высокий",
    critical: "Критичный"
  }[priority];
}

export function getStatusTone(category: TaskStatus): "success" | "warning" | "danger" | "muted" {
  if (category === "done") return "success";
  if (category === "review") return "warning";
  if (category === "waiting") return "muted";
  if (category === "in_progress") return "warning";
  return "muted";
}

function hasTaskRole(task: Task, userId: string, role: TaskParticipantRole): boolean {
  if (role === "executor" && task.ownerUserId === userId) return true;
  if (role === "requester" && task.requesterUserId === userId) return true;
  return task.participants.some(
    (participant) => participant.userId === userId && participant.role === role
  );
}

function matchesDueFilter(task: Task, filter: TaskDueFilter, today: string): boolean {
  if (filter === "all") return true;
  if (filter === "overdue") {
    return task.statusCategory !== "done" && task.plannedFinish < today;
  }
  if (filter === "today") return task.plannedFinish === today;
  if (filter === "tomorrow") return task.plannedFinish === addDays(today, 1);
  if (filter === "two_weeks") {
    const limit = addDays(today, 14);
    return task.plannedFinish >= today && task.plannedFinish <= limit;
  }
  return true;
}

function getPreferredNextCategory(
  task: Task,
  currentUserId: string,
  permissions: readonly string[]
): TaskStatus {
  if (task.statusCategory === "new" || task.statusCategory === "waiting") {
    return "in_progress";
  }
  if (task.statusCategory === "in_progress") {
    return task.requiresAcceptance && !canEditTaskFields(task, currentUserId, permissions)
      ? "review"
      : "done";
  }
  if (task.statusCategory === "review") return "done";
  return "done";
}

function getActionLabel(category: TaskStatus): string {
  return {
    new: "Сделать новой",
    waiting: "В ожидание",
    in_progress: "В работу",
    review: "На контроль",
    done: "Закрыть"
  }[category];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
