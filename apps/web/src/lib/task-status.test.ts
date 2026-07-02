import { expect, test } from "vitest";

import {
  isTaskStatusTransitionAllowed,
  nextTaskStatus,
  type TaskStatusCategory
} from "./task-status";

type Status = { id: string; status: string; sortOrder: number; category: TaskStatusCategory };

const statuses: Status[] = [
  { id: "s-new", status: "active", sortOrder: 0, category: "new" },
  { id: "s-wait", status: "active", sortOrder: 1, category: "waiting" },
  { id: "s-prog", status: "active", sortOrder: 2, category: "in_progress" },
  { id: "s-review", status: "active", sortOrder: 3, category: "review" },
  { id: "s-done", status: "active", sortOrder: 4, category: "done" }
];

// BUG-004: продвижение вперёд по воронке, всегда в рамках матрицы бэкенда.
test("nextTaskStatus продвигает по разрешённым переходам", () => {
  const next = (category: TaskStatusCategory) =>
    nextTaskStatus(statuses, { statusCategory: category })?.category ?? null;
  expect(next("new")).toBe("waiting");
  expect(next("waiting")).toBe("in_progress");
  expect(next("in_progress")).toBe("review");
  expect(next("review")).toBe("done");
  expect(next("done")).toBeNull();
});

test("любой предложенный переход проходит матрицу бэкенда (нет 409)", () => {
  for (const from of ["new", "waiting", "in_progress", "review", "done"] as TaskStatusCategory[]) {
    const proposed = nextTaskStatus(statuses, { statusCategory: from });
    if (proposed) expect(isTaskStatusTransitionAllowed(from, proposed.category)).toBe(true);
  }
});

test("матрица переходов совпадает с бэкендом", () => {
  expect(isTaskStatusTransitionAllowed("new", "review")).toBe(false); // старый sortOrder-баг предлагал это
  expect(isTaskStatusTransitionAllowed("in_progress", "done")).toBe(true);
  expect(isTaskStatusTransitionAllowed("done", "in_progress")).toBe(false);
});
