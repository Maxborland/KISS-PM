import { expect, test, type Page } from "@playwright/test";

type PlanTask = {
  id: string;
  title: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  durationMinutes?: number | null;
  workMinutes?: number;
  customFields?: Record<string, unknown>;
};

type ReadModel = {
  authored: {
    tasks: PlanTask[];
    assignments: Array<{
      id: string;
      taskId: string;
      resourceId: string;
    }>;
  };
  resourceLoad: {
    buckets: Array<{
      assignmentIds: string[];
      assignedMinutes: number;
    }>;
  };
  planVersion: number;
};

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const PLAN_READER = { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" };

test.describe("Projects schedule productivity", () => {
  test("ADMIN uses keyboard create/undo, atomic TSV paste and reviewed date fill", async ({ page }) => {
    test.setTimeout(180_000);
    const runId = Date.now();
    const keyboardTitles = Array.from({ length: 10 }, (_, index) => `Keyboard task ${runId} ${index + 1}`);
    const keyboardTitle = keyboardTitles[0]!;
    const editedKeyboardTitle = `${keyboardTitle} edited`;
    const importedTitles = Array.from({ length: 10 }, (_, index) => `TSV ${runId} ${index + 1}`);
    const tsv = importedTitles
      .map((title, index) => title + "\t2026-07-01\t\t5\t40\t" + index)
      .join("\r\n");
    const raceImportTitles = Array.from(
      { length: 10 },
      (_, index) => "TSV race " + runId + " " + (index + 1)
    );
    const raceTsv = raceImportTitles
      .map((title, index) => title + "\t2026-07-01\t\t5\t40\t" + index)
      .join("\r\n");
    const cleanupIds = new Set<string>();
    const projectId = await loginAndGetProject(page, ADMIN);

    try {
      await page.goto(`/projects/${projectId}/schedule`);
      const workspace = page.getByTestId("schedule-productivity-workspace");
      await expect(workspace).toBeVisible();

      await workspace.focus();
      await page.keyboard.press("Home");
      await expect(page.locator("[data-schedule-row-id]").first()).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(page.locator("[data-schedule-row-id]").nth(1)).toBeFocused();
      await page.keyboard.press("End");
      await expect(page.locator("[data-schedule-row-id]").last()).toBeFocused();
      const quickCreate = page.getByRole("textbox", { name: "Создать задачу (Enter; Tab — подзадачей)" }).last();
      for (const title of keyboardTitles) {
        await workspace.focus();
        await page.keyboard.press("Insert");
        await expect(quickCreate).toBeFocused();
        await page.keyboard.type(title);
        const createPreviewPromise = waitForPlanningResponse(page, projectId, "preview-command");
        await page.keyboard.press("Enter");
        expect((await createPreviewPromise).status()).toBe(200);
        const createApplyPromise = waitForPlanningResponse(page, projectId, "apply-command");
        await confirmPlanningPreviewWithKeyboard(page);
        expect((await createApplyPromise).status()).toBe(200);
        await expect(page.getByText(title, { exact: true })).toBeVisible();
      }

      let readModel = await getReadModel(page, projectId);
      const keyboardTasks = keyboardTitles.map((title) => findTask(readModel, title));
      expect(keyboardTasks.every(Boolean)).toBe(true);
      keyboardTasks.forEach((task) => cleanupIds.add(task!.id));
      const keyboardTask = keyboardTasks[0]!;

      const keyboardRow = page.locator(`[data-schedule-row-id="${keyboardTask!.id}"]`);
      await keyboardRow.focus();
      await page.keyboard.press("F2");
      const nameEditor = keyboardRow.locator("td").nth(3).locator("input");
      await expect(nameEditor).toBeFocused();
      await page.keyboard.press("Control+A");
      await page.keyboard.type(editedKeyboardTitle);
      const editPreviewPromise = waitForPlanningResponse(page, projectId, "preview-command");
      await page.keyboard.press("Enter");
      expect((await editPreviewPromise).status()).toBe(200);
      const editApplyPromise = waitForPlanningResponse(page, projectId, "apply-command");
      await confirmPlanningPreviewWithKeyboard(page);
      expect((await editApplyPromise).status()).toBe(200);
      await expect(page.getByText(editedKeyboardTitle, { exact: true })).toBeVisible();

      await workspace.focus();
      const undoPreviewPromise = waitForPlanningResponse(page, projectId, "preview-command-batch");
      await page.keyboard.press("Control+Shift+Z");
      expect((await undoPreviewPromise).status()).toBe(200);
      const undoApplyPromise = waitForPlanningResponse(page, projectId, "apply-command-batch");
      await confirmPlanningPreviewWithKeyboard(page);
      expect((await undoApplyPromise).status()).toBe(200);
      await expect(page.getByText(keyboardTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(editedKeyboardTitle, { exact: true })).toHaveCount(0);

      await dispatchTsvPaste(workspace, tsv);
      const importDialog = page.getByRole("dialog", { name: "Импорт задач из TSV" });
      await expect(importDialog).toContainText("Будет создано задач: 10");
      const pastePreviewPromise = waitForPlanningResponse(page, projectId, "preview-command-batch");
      await importDialog.getByRole("button", { name: "Проверить и применить" }).click();
      expect((await pastePreviewPromise).status()).toBe(200);
      const pasteApplyPromise = waitForPlanningResponse(page, projectId, "apply-command-batch");
      await confirmPlanningPreview(page);
      const pasteApplyResponse = await pasteApplyPromise;
      expect(pasteApplyResponse.status()).toBe(200);
      const pasteApplyEnvelope = pasteApplyResponse.request().postDataJSON() as {
        commands: unknown[];
        clientPlanVersion: number;
        idempotencyKey: string;
      };
      const pasteApplyBody = (await pasteApplyResponse.json()) as {
        newPlanVersion: number;
      };
      expect(pasteApplyEnvelope.idempotencyKey).toMatch(/^schedule-tsv-tsv-/);

      readModel = await getReadModel(page, projectId);
      const imported = importedTitles.map((title) => {
        const task = findTask(readModel, title);
        expect(task).toBeTruthy();
        cleanupIds.add(task!.id);
        return task!;
      });
      await expect(page.getByRole("button", { name: "Откат" })).toBeDisabled();
      let irreversibleUndoRequests = 0;
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          new URL(request.url()).pathname === planningPath(projectId, "preview-command-batch")
        ) {
          irreversibleUndoRequests += 1;
        }
      });
      await workspace.focus();
      await page.keyboard.press("Control+Shift+Z");
      await expect(page.getByText("Нет применённого действия для отката")).toBeVisible();
      expect(irreversibleUndoRequests).toBe(0);

      await dispatchTsvPaste(workspace, tsv);
      await expect(importDialog.getByRole("alert")).toContainText("уже применён");
      await expect(importDialog.getByRole("button", { name: "Проверить и применить" })).toBeDisabled();
      await importDialog.getByRole("button", { name: "Отмена" }).click();
      expect((await getReadModel(page, projectId)).authored.tasks.filter((task) => importedTitles.includes(task.title))).toHaveLength(10);
      await page.reload();
      await expect(workspace).toBeVisible();
      const durableReplay = await page.request.post(
        planningPath(projectId, "apply-command-batch"),
        {
          headers: sameOriginMutationHeaders(page),
          data: pasteApplyEnvelope
        }
      );
      expect(durableReplay.status()).toBe(200);
      expect((await durableReplay.json()).newPlanVersion).toBe(
        pasteApplyBody.newPlanVersion
      );
      const afterDurableReplay = await getReadModel(page, projectId);
      expect(
        afterDurableReplay.authored.tasks.filter((task) =>
          importedTitles.includes(task.title)
        )
      ).toHaveLength(10);
      expect(imported.every((task) => task.id.startsWith("task-tsv-"))).toBe(true);
      await dispatchTsvPaste(workspace, raceTsv);
      await expect(importDialog).toContainText("Будет создано задач: 10");
      const externalRaceTitle = imported[9]!.title + " external";
      await applyTaskTitle(page, projectId, imported[9]!.id, externalRaceTitle);
      let staleTsvApplyRequests = 0;
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          new URL(request.url()).pathname === planningPath(projectId, "apply-command-batch")
        ) {
          staleTsvApplyRequests += 1;
        }
      });
      const staleTsvPreviewPromise = waitForPlanningResponse(
        page,
        projectId,
        "preview-command-batch"
      );
      await importDialog.getByRole("button", { name: "Проверить и применить" }).click();
      expect((await staleTsvPreviewPromise).status()).toBe(409);
      await expect(page.getByText("Конфликт версий плана — перезагружено")).toBeVisible();
      expect(staleTsvApplyRequests).toBe(0);
      await importDialog.getByRole("button", { name: "Отмена" }).click();
      const afterStaleTsv = await getReadModel(page, projectId);
      expect(
        afterStaleTsv.authored.tasks.filter((task) => raceImportTitles.includes(task.title))
      ).toHaveLength(0);
      expect(afterStaleTsv.authored.tasks.find((task) => task.id === imported[9]!.id)?.title).toBe(
        externalRaceTitle
      );

      const sourceRow = page.locator('[data-schedule-row-id="' + imported[0]!.id + '"]');
      const dragTargetRow = page.locator('[data-schedule-row-id="' + imported[2]!.id + '"]');
      const fillHandle = sourceRow.getByRole("button", {
        name: "Протянуть дату окончания от " + importedTitles[0]
      });
      await fillHandle.hover();
      await page.mouse.down();
      await dragTargetRow.hover();
      await page.mouse.up();

      const fillDialog = page.getByRole("dialog", { name: "Заполнение дат окончания" });
      const expectedFirstFill = await fillDialog.getByLabel("Первая дата окончания").inputValue();
      const expectedSecondFill = addIsoDays(expectedFirstFill, 1);
      await expect(fillDialog).toContainText(expectedFirstFill);
      await expect(fillDialog).toContainText(expectedSecondFill);
      const fillPreviewPromise = waitForPlanningResponse(page, projectId, "preview-command-batch");
      await fillDialog.getByRole("button", { name: "Проверить и применить" }).click();
      expect((await fillPreviewPromise).status()).toBe(200);
      const fillApplyPromise = waitForPlanningResponse(page, projectId, "apply-command-batch");
      await confirmPlanningPreview(page);
      expect((await fillApplyPromise).status()).toBe(200);

      readModel = await getReadModel(page, projectId);
      expect(findTask(readModel, importedTitles[1])?.plannedFinish).toBe(expectedFirstFill);
      expect(findTask(readModel, importedTitles[2])?.plannedFinish).toBe(expectedSecondFill);

      const raceTask = imported[2]!;
      const unchangedTarget = findTask(readModel, importedTitles[3])!;
      const raceTitle = `${raceTask.title} external`;
      await applyTaskTitle(page, projectId, raceTask.id, raceTitle);

      await page.getByRole("checkbox", { name: `Выбрать ${importedTitles[3]} для заполнения дат` }).check();
      await page.getByRole("button", { name: /Заполнить даты/ }).click();
      await fillDialog.getByLabel("Первая дата окончания").fill("2026-08-10");
      const conflictPreviewPromise = waitForPlanningResponse(page, projectId, "preview-command-batch");
      await fillDialog.getByRole("button", { name: "Проверить и применить" }).click();
      expect((await conflictPreviewPromise).status()).toBe(409);
      await expect(page.getByText("Конфликт версий плана — перезагружено")).toBeVisible();
      await fillDialog.getByRole("button", { name: "Отмена" }).click();

      readModel = await getReadModel(page, projectId);
      expect(readModel.authored.tasks.find((task) => task.id === unchangedTarget.id)?.plannedFinish).toBe(unchangedTarget.plannedFinish);
      expect(readModel.authored.tasks.find((task) => task.id === raceTask.id)?.title).toBe(raceTitle);

      let guardedUndoRequests = 0;
      page.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/planning/preview-command-batch")) guardedUndoRequests += 1;
      });
      await workspace.focus();
      await page.keyboard.press("Control+Shift+Z");
      await expect(page.getByText("План уже изменён. Откат отменён, данные перезагружены")).toBeVisible();
      expect(guardedUndoRequests).toBe(0);

      await page.reload();
      const afterReload = await getReadModel(page, projectId);
      expect(
        keyboardTitles.map((title) => findTask(afterReload, title)?.id)
      ).toEqual(keyboardTasks.map((task) => task!.id));
      await expect(page.getByText(keyboardTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(raceTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(importedTitles[0], { exact: true })).toBeVisible();
    } finally {
      for (const taskId of cleanupIds) await cleanupTask(page, projectId, taskId);
    }
  });

  test("ADMIN converts a task to a zero-load milestone through reviewed batch", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const marker = "Milestone task " + Date.now();
    const projectId = await loginAndGetProject(page, ADMIN);
    let taskId: string | undefined;
    const assignmentId = "assignment-milestone-" + Date.now();

    try {
      await page.goto("/projects/" + projectId + "/schedule");
      const workspace = page.getByTestId("schedule-productivity-workspace");
      const initialModel = await getReadModel(page, projectId);
      const resourceId = initialModel.authored.assignments[0]?.resourceId;
      expect(resourceId).toBeTruthy();
      await workspace.focus();
      await page.keyboard.press("Insert");
      const quickCreate = page.getByRole("textbox", {
        name: "Создать задачу (Enter; Tab — подзадачей)"
      }).last();
      await quickCreate.fill(marker);
      const createPreviewPromise = waitForPlanningResponse(page, projectId, "preview-command");
      await page.keyboard.press("Enter");
      expect((await createPreviewPromise).status()).toBe(200);
      const createApplyPromise = waitForPlanningResponse(page, projectId, "apply-command");
      await confirmPlanningPreview(page);
      expect((await createApplyPromise).status()).toBe(200);

      const created = findTask(await getReadModel(page, projectId), marker);
      expect(created).toBeTruthy();
      taskId = created!.id;
      await applyAssignment(page, projectId, taskId, resourceId!, assignmentId);
      await page.reload();
      const assignedModel = await getReadModel(page, projectId);
      expect(
        assignedModel.authored.assignments.some(
          (assignment) => assignment.id === assignmentId && assignment.taskId === taskId
        )
      ).toBe(true);
      expect(
        assignedModel.resourceLoad.buckets.some((bucket) =>
          bucket.assignmentIds.includes(assignmentId)
        )
      ).toBe(true);
      const row = page.locator('[data-schedule-row-id="' + taskId + '"]');
      await row.click({ button: "right" });
      const milestoneItem = page.getByRole("menuitem", { name: "Сделать вехой" });
      await expect(milestoneItem).toBeEnabled();

      const milestonePreviewPromise = waitForPlanningResponse(
        page,
        projectId,
        "preview-command-batch"
      );
      await milestoneItem.click();
      expect((await milestonePreviewPromise).status()).toBe(200);
      const milestoneApplyPromise = waitForPlanningResponse(
        page,
        projectId,
        "apply-command-batch"
      );
      await confirmPlanningPreview(page);
      expect((await milestoneApplyPromise).status()).toBe(200);

      const milestoneModel = await getReadModel(page, projectId);
      const milestone = findTask(milestoneModel, marker);
      expect(milestone?.durationMinutes).toBe(0);
      expect(milestone?.workMinutes).toBe(0);
      expect(milestone?.customFields?.kind).toBe("milestone");
      expect(
        milestoneModel.authored.assignments.some(
          (assignment) => assignment.id === assignmentId
        )
      ).toBe(false);
      expect(
        milestoneModel.resourceLoad.buckets.some((bucket) =>
          bucket.assignmentIds.includes(assignmentId)
        )
      ).toBe(false);
      await page.reload();
      const reloadedMilestoneModel = await getReadModel(page, projectId);
      const reloadedMilestone = findTask(reloadedMilestoneModel, marker);
      expect(reloadedMilestone?.durationMinutes).toBe(0);
      expect(reloadedMilestone?.workMinutes).toBe(0);
      expect(reloadedMilestone?.customFields?.kind).toBe("milestone");
      expect(
        reloadedMilestoneModel.authored.assignments.some(
          (assignment) => assignment.id === assignmentId
        )
      ).toBe(false);
      expect(
        reloadedMilestoneModel.resourceLoad.buckets.some((bucket) =>
          bucket.assignmentIds.includes(assignmentId)
        )
      ).toBe(false);
      await expect(page.locator('[data-schedule-row-id="' + taskId + '"]')).toContainText(
        "0 дн"
      );
    } finally {
      if (taskId) await cleanupTask(page, projectId, taskId);
    }
  });
  test("ADMIN productivity toolbar remains usable at responsive widths", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, ADMIN);

    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 820 });
      await page.goto(`/projects/${projectId}/schedule`);
      await expect(page.getByRole("button", { name: "Вставить TSV" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Заполнить даты/ })).toBeVisible();
      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
      await testInfo.attach(`schedule-productivity-${width}.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png"
      });
    }
  });

  test("PLAN has no productivity writes and direct preview remains denied", async ({ page }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, PLAN_READER);
    const before = await getReadModel(page, projectId);
    const task = before.authored.tasks[0];
    expect(task).toBeTruthy();

    await page.goto(`/projects/${projectId}/schedule`);
    const workspace = page.getByTestId("schedule-productivity-workspace");
    await expect(workspace).toBeVisible();
    await expect(page.getByRole("button", { name: "Вставить TSV" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Заполнить даты/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Откат" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /заполнения дат/ })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Создать задачу (Enter; Tab — подзадачей)" })).toHaveCount(0);

    let shortcutWriteRequests = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.includes("/planning/")) shortcutWriteRequests += 1;
    });
    await workspace.focus();
    await page.keyboard.press("Control+Shift+Z");
    expect(shortcutWriteRequests).toBe(0);

    const denied = await page.request.post(planningPath(projectId, "preview-command-batch"), {
      headers: sameOriginMutationHeaders(page),
      data: {
        clientPlanVersion: before.planVersion,
        commands: [{ type: "task.update_progress", payload: { taskId: task!.id, percentComplete: 1 } }]
      }
    });
    expect(denied.status()).toBe(403);

    const after = await getReadModel(page, projectId);
    expect(after.planVersion).toBe(before.planVersion);
    expect(after.authored.tasks).toEqual(before.authored.tasks);
  });
});

function planningPath(projectId: string, endpoint: "preview-command" | "preview-command-batch" | "apply-command" | "apply-command-batch") {
  return `/api/workspace/projects/${projectId}/planning/${endpoint}`;
}

function waitForPlanningResponse(
  page: Page,
  projectId: string,
  endpoint: "preview-command" | "preview-command-batch" | "apply-command" | "apply-command-batch"
) {
  return page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === planningPath(projectId, endpoint));
}

async function confirmPlanningPreview(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Применить изменения" }).click();
}

async function confirmPlanningPreviewWithKeyboard(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  const applyButton = dialog.getByRole("button", { name: "Применить изменения" });
  await applyButton.focus();
  await page.keyboard.press("Enter");
}

async function dispatchTsvPaste(workspace: ReturnType<Page["getByTestId"]>, text: string) {
  await workspace.evaluate((element, clipboardText) => {
    const data = new DataTransfer();
    data.setData("text/plain", clipboardText);
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: data }));
  }, text);
}

async function loginAndGetProject(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Пароль", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { projects: Array<{ id: string }> };
  expect(body.projects.length).toBeGreaterThan(0);
  return body.projects[0]!.id;
}

async function getReadModel(page: Page, projectId: string): Promise<ReadModel> {
  const response = await page.request.get(planningPath(projectId, "preview-command").replace("preview-command", "read-model"));
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

function findTask(readModel: ReadModel, title: string) {
  return readModel.authored.tasks.find((task) => task.title === title);
}

async function applyTaskTitle(page: Page, projectId: string, taskId: string, title: string) {
  const current = await getReadModel(page, projectId);
  const response = await page.request.post(planningPath(projectId, "apply-command"), {
    headers: sameOriginMutationHeaders(page),
    data: {
      clientPlanVersion: current.planVersion,
      command: { type: "task.update_identity", payload: { taskId, title } }
    }
  });
  expect(response.status()).toBe(200);
}

async function applyAssignment(
  page: Page,
  projectId: string,
  taskId: string,
  resourceId: string,
  assignmentId: string
) {
  const current = await getReadModel(page, projectId);
  const response = await page.request.post(planningPath(projectId, "apply-command"), {
    headers: sameOriginMutationHeaders(page),
    data: {
      clientPlanVersion: current.planVersion,
      command: {
        type: "assignment.upsert",
        payload: {
          id: assignmentId,
          taskId,
          resourceId,
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 480
        }
      }
    }
  });
  expect(response.status()).toBe(200);
}
async function cleanupTask(page: Page, projectId: string, taskId: string) {
  const response = await page.request.delete(`/api/workspace/tasks/${taskId}`, { headers: sameOriginMutationHeaders(page) });
  if (![200, 404].includes(response.status())) throw new Error(`cleanup_failed:${projectId}:${taskId}:${response.status()}`);
}

function addIsoDays(value: string, days: number) {
  const date = new Date(value + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function sameOriginMutationHeaders(page: Page) {
  return { Origin: new URL(page.url()).origin, "x-kiss-pm-action": "same-origin" };
}
