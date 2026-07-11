import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../..");
const EVIDENCE_ROOT = resolve(REPO_ROOT, ".superloopy/evidence/projects-2026-07-10");
const REPORT_PATH = resolve(EVIDENCE_ROOT, "projects-settings-write.json");

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const PLAN_READER = {
  email: "plan-reader-no-resources@kiss-pm.local",
  password: "reader12345"
};

type ReadModel = {
  project: { deadline: string | null };
  planVersion: number;
};

type DeadlineEnvelope = {
  command: {
    type: "project.deadline.move";
    payload: { deadline: string; reason: string };
  };
  clientPlanVersion: number;
};

const report: {
  generatedAt?: string;
  baseURL?: string;
  admin?: Record<string, unknown>;
  planReader?: Record<string, unknown>;
  status?: string;
} = {};

test.describe("Projects settings write flows", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(() => {
    mkdirSync(EVIDENCE_ROOT, { recursive: true });
    writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          ...report,
          status: report.admin && report.planReader ? "PASS" : "PARTIAL"
        },
        null,
        2
      ),
      "utf8"
    );
  });

  test("ADMIN moves and restores project deadline through preview and apply", async ({
    page
  }, testInfo) => {
    test.setTimeout(90_000);
    report.baseURL = String(testInfo.project.use.baseURL);
    const projectId = await loginAndGetProject(page, ADMIN);
    const before = await getReadModel(page, projectId);
    expect(before.project.deadline).toBeTruthy();
    const originalDeadline = before.project.deadline!;
    const movedDeadline = shiftIsoDate(originalDeadline, 1);

    let cleanupRequired = false;
    let moveResult: SubmitResult | undefined;
    let restoreResult: SubmitResult | undefined;
    let moved: ReadModel | undefined;
    let restored: ReadModel | undefined;

    try {
      await openSettings(page, projectId);

      moveResult = await submitDeadline(page, projectId, {
        deadline: movedDeadline,
        reason: "Full Evaluation: проверка переноса"
      });
      expect(moveResult.previewStatus).toBe(200);
      expect(moveResult.applyStatus).toBe(200);
      cleanupRequired = true;

      moved = await getReadModel(page, projectId);
      expect(moved.project.deadline).toBe(movedDeadline);
      expect(moved.planVersion).toBeGreaterThan(before.planVersion);

      await page.reload();
      await waitForSettings(page);
      await expect(
        page.getByRole("main").getByText(formatRuDate(movedDeadline), { exact: true })
      ).toBeVisible();

      restoreResult = await submitDeadline(page, projectId, {
        deadline: originalDeadline,
        reason: "Full Evaluation: восстановление исходного дедлайна"
      });
      expect(restoreResult.previewStatus).toBe(200);
      expect(restoreResult.applyStatus).toBe(200);

      restored = await getReadModel(page, projectId);
      expect(restored.project.deadline).toBe(originalDeadline);
      expect(restored.planVersion).toBeGreaterThan(moved.planVersion);
      cleanupRequired = false;

      await page.reload();
      await waitForSettings(page);
      await expect(
        page.getByRole("main").getByText(formatRuDate(originalDeadline), { exact: true })
      ).toBeVisible();
    } finally {
      if (cleanupRequired) {
        await openSettings(page, projectId);
        const current = await getReadModel(page, projectId);
        if (current.project.deadline !== originalDeadline) {
          restoreResult = await submitDeadline(page, projectId, {
            deadline: originalDeadline,
            reason: "Full Evaluation: аварийное восстановление исходного дедлайна"
          });
        }
      }
    }

    expect(moved).toBeDefined();
    expect(restored).toBeDefined();
    report.admin = {
      projectId,
      originalDeadline,
      movedDeadline,
      movePreviewStatus: moveResult!.previewStatus,
      moveApplyStatus: moveResult!.applyStatus,
      restorePreviewStatus: restoreResult!.previewStatus,
      restoreApplyStatus: restoreResult!.applyStatus,
      planVersionBefore: before.planVersion,
      planVersionMoved: moved!.planVersion,
      planVersionRestored: restored!.planVersion,
      reloadMoveReadback: true,
      reloadRestoreReadback: true,
      cleanup: "restored_via_ui",
      status: "PASS"
    };
  });

  test("PLAN reader has no deadline controls and direct preview is denied without mutation", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, PLAN_READER);
    const before = await getReadModel(page, projectId);
    expect(before.project.deadline).toBeTruthy();
    const deniedDeadline = shiftIsoDate(before.project.deadline!, 2);

    await openSettings(page, projectId);
    await expect(page.getByRole("button", { name: "Изменить", exact: true })).toHaveCount(0);

    let applyRequestCount = 0;
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      const pathname = new URL(request.url()).pathname;
      if (
        pathname === planningPath(projectId, "apply-command") ||
        pathname === planningPath(projectId, "apply-command-batch")
      ) {
        applyRequestCount += 1;
      }
    });

    const deniedEnvelope: DeadlineEnvelope = {
      command: {
        type: "project.deadline.move",
        payload: {
          deadline: deniedDeadline,
          reason: "Full Evaluation: denied settings preview"
        }
      },
      clientPlanVersion: before.planVersion
    };
    const deniedResponse = await page.request.post(
      planningPath(projectId, "preview-command"),
      {
        data: deniedEnvelope,
        headers: sameOriginMutationHeaders(page)
      }
    );
    expect(deniedResponse.status()).toBe(403);
    expect(applyRequestCount).toBe(0);
    await expect(
      page.getByRole("dialog", { name: "Предпросмотр изменений" })
    ).toHaveCount(0);

    const after = await getReadModel(page, projectId);
    expect(after.project.deadline).toBe(before.project.deadline);
    expect(after.planVersion).toBe(before.planVersion);

    await page.reload();
    await waitForSettings(page);
    await expect(page.getByRole("button", { name: "Изменить", exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("main").getByText(formatRuDate(before.project.deadline!), { exact: true })
    ).toBeVisible();

    const reloaded = await getReadModel(page, projectId);
    expect(reloaded.project.deadline).toBe(before.project.deadline);
    expect(reloaded.planVersion).toBe(before.planVersion);

    report.planReader = {
      projectId,
      uiWriteControlCount: 0,
      previewStatus: deniedResponse.status(),
      applyRequestCount,
      deadlineBefore: before.project.deadline,
      deadlineAfter: after.project.deadline,
      deadlineReloaded: reloaded.project.deadline,
      planVersionBefore: before.planVersion,
      planVersionAfter: after.planVersion,
      planVersionReloaded: reloaded.planVersion,
      status: "PASS"
    };
  });
});

type SubmitResult = {
  previewStatus: number;
  applyStatus: number;
};

async function submitDeadline(
  page: Page,
  projectId: string,
  input: { deadline: string; reason: string }
): Promise<SubmitResult> {
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await page.getByLabel("Новая дата", { exact: true }).fill(input.deadline);
  await page
    .getByLabel("Причина переноса (обязательно)", { exact: true })
    .fill(input.reason);

  const previewPromise = waitForPlanningResponse(page, projectId, "preview-command");
  await page
    .getByRole("button", { name: "Применить перенос", exact: true })
    .click();
  const previewResponse = await previewPromise;
  expect(previewResponse.status()).toBe(200);

  const previewDialog = page.getByRole("dialog", {
    name: "Предпросмотр изменений"
  });
  await expect(previewDialog).toBeVisible();

  const applyPromise = waitForPlanningResponse(page, projectId, "apply-command");
  await previewDialog
    .getByRole("button", { name: "Применить изменения", exact: true })
    .click();
  const applyResponse = await applyPromise;
  expect(applyResponse.request().postDataJSON()).toEqual(
    previewResponse.request().postDataJSON()
  );

  return {
    previewStatus: previewResponse.status(),
    applyStatus: applyResponse.status()
  };
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

async function openSettings(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}/settings`);
  await waitForSettings(page);
}

async function waitForSettings(page: Page) {
  await expect(page.getByRole("heading", { name: "Настройки проекта" })).toBeVisible();
}

type PlanningEndpoint =
  | "preview-command"
  | "preview-command-batch"
  | "apply-command"
  | "apply-command-batch";

function waitForPlanningResponse(
  page: Page,
  projectId: string,
  endpoint: PlanningEndpoint
) {
  const path = planningPath(projectId, endpoint);
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === path
  );
}

function planningPath(projectId: string, endpoint: PlanningEndpoint) {
  return `/api/workspace/projects/${projectId}/planning/${endpoint}`;
}

async function getReadModel(page: Page, projectId: string): Promise<ReadModel> {
  const response = await page.request.get(
    `/api/workspace/projects/${projectId}/planning/read-model`
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

function sameOriginMutationHeaders(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "x-kiss-pm-action": "same-origin"
  };
}

function shiftIsoDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatRuDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
