import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../..");
const EVIDENCE_ROOT = resolve(REPO_ROOT, ".superloopy/evidence/projects-2026-07-10");
const REPORT_PATH = resolve(EVIDENCE_ROOT, "projects-schedule-write.json");

type ReadModel = {
  authored: { tasks: Array<{ id: string; title: string }> };
  planVersion: number;
};

test.describe("Projects schedule write flows", () => {
  test("ADMIN creates and deletes a task with API readback and reload", async ({
    page
  }, testInfo) => {
    test.setTimeout(90_000);
    mkdirSync(EVIDENCE_ROOT, { recursive: true });
    const marker = `FullEval schedule ${Date.now()}`;
    const projectId = await loginAndGetProject(page, {
      email: "admin@kiss-pm.local",
      password: "admin12345"
    });
    let createdTaskId = "";

    try {
      await page.goto(`/projects/${projectId}/schedule`);
      await expect(page.getByRole("button", { name: "Задача", exact: true })).toBeVisible();

      const createPreviewPromise = waitForPlanningResponse(
        page,
        projectId,
        "preview-command-batch"
      );
      await page.getByRole("button", { name: "Задача", exact: true }).click();
      const createDialog = page.getByRole("dialog", { name: "Новая задача" });
      await createDialog.getByLabel("Название", { exact: true }).fill(marker);
      await createDialog.getByRole("button", { name: "Создать", exact: true }).click();
      expect((await createPreviewPromise).status()).toBe(200);
      const createResponsePromise = waitForPlanningResponse(
        page,
        projectId,
        "apply-command-batch"
      );
      await confirmPlanningPreview(page);
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(200);
      await expect(page.getByText(marker, { exact: true })).toBeVisible();

      let readModel = await getReadModel(page, projectId);
      const created = readModel.authored.tasks.find((task) => task.title === marker);
      expect(created).toBeTruthy();
      createdTaskId = created!.id;
      expect(createdTaskId).toMatch(/^t-[0-9a-f-]{36}$/i);
      await expect(page.getByRole("button", { name: "Откат", exact: true })).toBeDisabled();
      const createdPlanVersion = readModel.planVersion;

      await page.reload();
      await expect(page.getByText(marker, { exact: true })).toBeVisible();

      const row = page.getByRole("row").filter({ hasText: marker });
      await expect(row).toHaveCount(1);
      await row.click({ button: "right" });
      await page.getByRole("menuitem", { name: "Удалить", exact: true }).click();

      const deletePreviewPromise = waitForPlanningResponse(
        page,
        projectId,
        "preview-command"
      );
      const deleteDialog = page.getByRole("dialog", {
        name: new RegExp(`Удалить задачу «${escapeRegExp(marker)}»\\?`)
      });
      await expect(deleteDialog).toContainText("безвозвратно удалена из плана");
      await deleteDialog.getByRole("button", { name: "Удалить", exact: true }).click();
      expect((await deletePreviewPromise).status()).toBe(200);
      const deleteResponsePromise = waitForPlanningResponse(
        page,
        projectId,
        "apply-command"
      );
      await confirmPlanningPreview(page);
      const deleteResponse = await deleteResponsePromise;
      expect(deleteResponse.status()).toBe(200);
      await expect(page.getByText(marker, { exact: true })).toHaveCount(0);

      readModel = await getReadModel(page, projectId);
      expect(readModel.authored.tasks.some((task) => task.id === createdTaskId)).toBe(false);
      expect(readModel.planVersion).toBeGreaterThan(createdPlanVersion);

      await page.reload();
      await expect(page.getByText(marker, { exact: true })).toHaveCount(0);

      writeFileSync(
        REPORT_PATH,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            baseURL: String(testInfo.project.use.baseURL),
            admin: {
              projectId,
              marker,
              taskId: createdTaskId,
              createStatus: createResponse.status(),
              deleteStatus: deleteResponse.status(),
              createdPlanVersion,
              finalPlanVersion: readModel.planVersion,
              reloadCreateReadback: true,
              reloadDeleteReadback: true,
              cleanup: "deleted_via_ui",
              status: "PASS"
            }
          },
          null,
          2
        ),
        "utf8"
      );
      createdTaskId = "";
    } finally {
      if (createdTaskId) {
        await cleanupTask(page, projectId, createdTaskId);
      }
    }
  });

  test("PLAN sees no write controls and the server still rejects mutation preview", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const marker = `FullEval denied ${Date.now()}`;
    const projectId = await loginAndGetProject(page, {
      email: "plan-reader-no-resources@kiss-pm.local",
      password: "reader12345"
    });
    const before = await getReadModel(page, projectId);
    const targetTask = before.authored.tasks[0];
    expect(targetTask).toBeTruthy();

    await page.goto(`/projects/${projectId}/schedule`);
    await expect(
      page.getByRole("heading", { name: "Портал подрядчиков Вектор" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Задача", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Пакет", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", {
        name: "Создать задачу (Enter; Tab — подзадачей)"
      })
    ).toHaveCount(0);

    const deniedResponse = await page.request.post(
      `/api/workspace/projects/${projectId}/planning/preview-command`,
      {
        headers: {
          Origin: new URL(page.url()).origin,
          "x-kiss-pm-action": "same-origin"
        },
        data: {
          clientPlanVersion: before.planVersion,
          command: {
            type: "task.update_progress",
            payload: {
              taskId: targetTask!.id,
              percentComplete: 1
            }
          }
        }
      }
    );
    expect(deniedResponse.status()).toBe(403);

    const after = await getReadModel(page, projectId);
    expect(after.planVersion).toBe(before.planVersion);
    expect(after.authored.tasks).toEqual(before.authored.tasks);

    const report = JSON.parse(await readTextFile(REPORT_PATH)) as Record<string, unknown>;
    writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          ...report,
          planReader: {
            projectId,
            marker,
            writeControlsHidden: true,
            previewMutationStatus: deniedResponse.status(),
            planVersionBefore: before.planVersion,
            planVersionAfter: after.planVersion,
            unchanged: true,
            status: "PASS_PERMISSION_GATED"
          }
        },
        null,
        2
      ),
      "utf8"
    );
  });
});


function waitForPlanningResponse(
  page: Page,
  projectId: string,
  endpoint:
    | "preview-command"
    | "preview-command-batch"
    | "apply-command"
    | "apply-command-batch"
) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/workspace/projects/${projectId}/planning/${endpoint}`
  );
}

async function confirmPlanningPreview(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Применить изменения", exact: true })
    .click();
}
async function loginAndGetProject(
  page: Page,
  credentials: { email: string; password: string }
) {
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
  const response = await page.request.get(
    `/api/workspace/projects/${projectId}/planning/read-model`
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

async function cleanupTask(page: Page, projectId: string, taskId: string) {
  const response = await page.request.delete(`/api/workspace/tasks/${taskId}`, {
    headers: {
      Origin: new URL(page.url()).origin,
      "x-kiss-pm-action": "same-origin"
    }
  });
  if (![200, 404].includes(response.status())) {
    throw new Error(
      `cleanup_failed:${projectId}:${taskId}:${response.status()}`
    );
  }
}

async function readTextFile(path: string) {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
}
