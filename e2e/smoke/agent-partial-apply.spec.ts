import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

const proposal = {
  goal: "Обновить задачи",
  model: "e2e",
  reasoning: "Проверьте три изменения перед применением.",
  analyzeResults: [],
  proposedActions: [
    {
      tool: "change_task_status",
      title: "Перевести смету на сверку",
      input: { projectId: "project-demo-crm-intake", taskId: "task-1", statusId: "review" },
      capability: { allowed: true, reason: "allowed" },
      preview: { before: "В работе", after: "Сверка заказчиком" },
      preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
    },
    {
      tool: "comment_task",
      title: "Добавить комментарий",
      input: { taskId: "task-1", body: "Смета готова" },
      capability: { allowed: true, reason: "allowed" },
      preview: { before: "Без комментария", after: "Смета готова" }
    },
    {
      tool: "create_task",
      title: "Создать контрольную задачу",
      input: { projectId: "project-demo-crm-intake", title: "Проверить смету" },
      capability: { allowed: true, reason: "allowed" },
      preview: { before: "Не существует", after: "Проверить смету" }
    }
  ],
  iterations: 1,
  stopReason: "completed"
};

const failedProposal = {
  ...proposal,
  proposedActions: [proposal.proposedActions[1]!]
};

const permissionDeniedProposal = {
  ...proposal,
  proposedActions: [{
    ...proposal.proposedActions[1]!,
    capability: { allowed: false, reason: "task_participant_required" },
    preview: { before: "Количество комментариев недоступно", after: "Смета готова" }
  }]
};

test("Agent Workspace показывает честный partial apply и повторяет только failed item", async ({ page }, testInfo) => {
  let executeCalls = 0;
  let currentProposal = proposal;
  await page.route("**/api/workspace/agent/tools", (route) => route.fulfill({
    json: { tools: [], provider: { model: "e2e", live: true } }
  }));
  await page.route("**/api/workspace/agent/propose/stream", (route) => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: `event: done\ndata: ${JSON.stringify(currentProposal)}\n\n`
  }));
  await page.route("**/api/workspace/agent/execute", async (route) => {
    executeCalls += 1;
    const request = route.request().postDataJSON() as { actions: Array<{ tool: string }> };
    if (executeCalls === 1) {
      expect(request.actions.map((action) => action.tool)).toEqual([
        "change_task_status",
        "comment_task",
        "create_task"
      ]);
      expect(request.actions[0]).toMatchObject({
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      });
      await route.fulfill({
        json: {
          results: [
            { tool: "change_task_status", ok: true, status: "applied", result: {} },
            { tool: "comment_task", ok: false, status: "conflict", error: "task_version_conflict" },
            { tool: "create_task", ok: false, status: "failed", error: "create_failed" }
          ],
          applied: true,
          summary: { applied: 1, skipped: 0, denied: 0, conflict: 1, failed: 1 }
        }
      });
      return;
    }
    if (executeCalls === 2) {
      expect(request.actions.map((action) => action.tool)).toEqual(["create_task"]);
      await route.fulfill({
        json: {
          results: [{ tool: "create_task", ok: true, status: "applied", result: {} }],
          applied: true,
          summary: { applied: 1, skipped: 0, denied: 0, conflict: 0, failed: 0 }
        }
      });
      return;
    }
    expect(request.actions.map((action) => action.tool)).toEqual(["comment_task"]);
    await route.fulfill({
      json: {
        results: [{ tool: "comment_task", ok: false, status: "failed", error: "comment_failed" }],
        applied: false,
        summary: { applied: 0, skipped: 0, denied: 0, conflict: 0, failed: 1 }
      }
    });
  });

  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });
  await page.goto("/agent");

  await page.getByRole("textbox", { name: "Сообщение Генри Гантту" }).fill("Обновить задачи");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("В работе", { exact: true })).toBeVisible();
  await expect(page.getByText("Сверка заказчиком", { exact: true })).toBeVisible();
  await expect(page.getByText("Без комментария", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Применить выбранное" }).click();
  await expect(page.getByText("Результат: применено 1, пропущено 0, отказано 0, конфликтов 1, ошибок 1.")).toBeVisible();
  await expect(page.getByText(/Предложение по задаче устарело/)).toBeVisible();
  await expect(page.getByRole("button", { name: "применено" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "конфликт" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "ошибка" })).toBeEnabled();
  await expect(page.getByText("Применено 1 из 3")).toBeVisible();
  await expect(page.getByText("Требуют внимания: 2")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) {
      await page.getByRole("button", { name: "Сверка" }).click();
    }
    await expect(page.getByText("Частично применено")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`agent-partial-apply-${width}.png`),
      fullPage: false
    });
  }

  const retryButton = page.getByRole("button", { name: "Применить оставшиеся" });
  await retryButton.focus();
  await expect(retryButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Результат: применено 1, пропущено 0, отказано 0, конфликтов 0, ошибок 0.")).toBeVisible();
  expect(executeCalls).toBe(2);

  await page.getByRole("button", { name: "Сбросить" }).click();
  currentProposal = failedProposal;
  await page.getByRole("textbox", { name: "Сообщение Генри Гантту" }).fill("Добавить комментарий");
  await page.getByRole("button", { name: "Отправить" }).click();
  await page.getByRole("button", { name: "Применить выбранное" }).click();
  await expect(page.getByText("Требуют внимания", { exact: true })).toBeVisible();
  await expect(page.getByText("Применено 0 из 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Применить оставшиеся" })).toBeEnabled();
  expect(executeCalls).toBe(3);

  await page.getByRole("button", { name: "Сбросить" }).click();
  currentProposal = permissionDeniedProposal;
  await page.getByRole("textbox", { name: "Сообщение Генри Гантту" }).fill("Чужая задача");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByRole("button", { name: "требует прав" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Изменить" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Отклонить" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Применить выбранное" })).toBeDisabled();
  await expect(page.getByText("Требуют внимания", { exact: true })).toBeVisible();
  await expect(page.getByText("Применено 0 из 1")).toHaveCount(0);
  expect(executeCalls).toBe(3);
});

test("Agent Workspace применяет live batch и показывает конфликт из реального backend", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });

  const projectId = "project-demo-crm-intake";
  const actionHeaders = {
    "content-type": "application/json",
    "x-kiss-pm-action": "same-origin"
  };
  const statusesResponse = await page.request.get("/api/workspace/task-statuses");
  expect(statusesResponse.status()).toBe(200);
  const { taskStatuses } = await statusesResponse.json() as {
    taskStatuses: Array<{ id: string; name: string; category: string }>;
  };
  const waiting = taskStatuses.find((status) => status.category === "waiting");
  const inProgress = taskStatuses.find((status) => status.category === "in_progress");
  expect(waiting).toBeTruthy();
  expect(inProgress).toBeTruthy();

  const meResponse = await page.request.get("/api/auth/me");
  expect(meResponse.status()).toBe(200);
  const { user } = await meResponse.json() as { user: { id: string } };
  const taskId = `e2e-agent-partial-${Date.now().toString(36)}`;
  const createResponse = await page.request.post(`/api/workspace/projects/${projectId}/tasks`, {
    headers: actionHeaders,
    data: {
      id: taskId,
      title: `Agent partial apply ${taskId}`,
      description: "Disposable live Agent E2E fixture",
      plannedStart: "2026-07-11",
      plannedFinish: "2026-07-11",
      durationWorkingDays: 1,
      plannedWork: 8,
      priority: "normal",
      statusId: waiting!.id,
      requiresAcceptance: false,
      participants: [{ userId: user.id, role: "executor" }]
    }
  });
  expect(createResponse.status()).toBe(201);
  const { task } = await createResponse.json() as {
    task: { id: string; updatedAt: string };
  };

  try {
    const statusAction = {
      tool: "change_task_status",
      title: "Начать работу",
      input: { projectId, taskId: task.id, statusId: inProgress!.id },
      capability: { allowed: true, reason: "allowed" },
      preview: { before: waiting!.name, after: inProgress!.name },
      preconditionVersions: { taskUpdatedAt: task.updatedAt }
    };
    const liveProposal = {
      ...proposal,
      goal: "Проверить live partial apply",
      proposedActions: [
        statusAction,
        { ...statusAction, title: "Повторить устаревшее изменение" }
      ]
    };
    await page.route("**/api/workspace/agent/tools", (route) => route.fulfill({
      json: { tools: [], provider: { model: "e2e", live: true } }
    }));
    await page.route("**/api/workspace/agent/propose/stream", (route) => route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `event: done\ndata: ${JSON.stringify(liveProposal)}\n\n`
    }));

    await page.goto("/agent");
    await page.getByRole("textbox", { name: "Сообщение Генри Гантту" }).fill("Проверить live partial apply");
    await page.getByRole("button", { name: "Отправить" }).click();
    const executeResponse = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/workspace/agent/execute"
    );
    await page.getByRole("button", { name: "Применить выбранное" }).click();
    expect((await executeResponse).status()).toBe(200);

    await expect(page.getByText("Результат: применено 1, пропущено 0, отказано 0, конфликтов 1, ошибок 0.")).toBeVisible();
    await expect(page.getByRole("button", { name: "применено" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "конфликт" })).toBeDisabled();

    const readback = await page.request.get(`/api/workspace/tasks/${task.id}`);
    expect(readback.status()).toBe(200);
    const readbackBody = await readback.json() as { task: { statusId: string } };
    expect(readbackBody.task.statusId).toBe(inProgress!.id);
  } finally {
    const cleanup = await page.request.delete(`/api/workspace/tasks/${task.id}`, {
      headers: actionHeaders
    });
    expect(cleanup.status()).toBe(200);
  }
});
