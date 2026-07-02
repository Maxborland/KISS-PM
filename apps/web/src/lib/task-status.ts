/**
 * Матрица разрешённых переходов статусов задач — зеркало бэкенда
 * (apps/api/src/project-work/taskCommandGuards.ts:isTaskStatusTransitionAllowed).
 * Держим синхронно: если фронт предложит переход вне матрицы, бэк вернёт 409.
 */
export type TaskStatusCategory = "new" | "waiting" | "in_progress" | "review" | "done";

const ALLOWED_TRANSITIONS: Record<TaskStatusCategory, TaskStatusCategory[]> = {
  new: ["waiting", "in_progress"],
  waiting: ["in_progress"],
  in_progress: ["waiting", "review", "done"],
  review: ["in_progress", "done"],
  done: []
};

// Порядок «вперёд» по воронке — для выбора продвигающего перехода из нескольких разрешённых.
const CATEGORY_ORDER: Record<TaskStatusCategory, number> = {
  new: 0,
  waiting: 1,
  in_progress: 2,
  review: 3,
  done: 4
};

export function isTaskStatusTransitionAllowed(
  from: TaskStatusCategory,
  to: TaskStatusCategory
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Следующий статус для кнопки «продвинуть»: наименьшая разрешённая категория строго «дальше»
 * текущей по воронке (new→waiting→in_progress→review→done). Гарантирует, что предложенный переход
 * пройдёт бэкенд-валидацию. Возвращает первый активный статус целевой категории (по sortOrder).
 */
export function nextTaskStatus<
  S extends { id: string; status: string; sortOrder: number; category: TaskStatusCategory }
>(statuses: readonly S[], current: { statusCategory: TaskStatusCategory }): S | null {
  const allowed = ALLOWED_TRANSITIONS[current.statusCategory] ?? [];
  if (allowed.length === 0) return null;
  const currentOrder = CATEGORY_ORDER[current.statusCategory] ?? 0;
  const active = statuses
    .filter((status) => status.status !== "archived")
    .sort((left, right) => left.sortOrder - right.sortOrder);
  // Идём по разрешённым категориям «вперёд» по воронке и берём ПЕРВУЮ, у которой реально есть
  // статус: если промежуточная категория (напр. review) в тенанте отсутствует, не залипаем на ней,
  // а продвигаем на следующий валидный переход (in_progress→done), который бэк тоже разрешает.
  const forwardCategories = allowed
    .filter((category) => CATEGORY_ORDER[category] > currentOrder)
    .sort((left, right) => CATEGORY_ORDER[left] - CATEGORY_ORDER[right]);
  for (const category of forwardCategories) {
    const match = active.find((status) => status.category === category);
    if (match) return match;
  }
  return null;
}
