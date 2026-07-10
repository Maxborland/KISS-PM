import { expect, test, type Page, type Response } from "@playwright/test";

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const PLAN_READER = {
  email: "plan-reader-no-resources@kiss-pm.local",
  password: "reader12345"
};
const DISPOSABLE_DATABASE_ENV = "KISS_PM_E2E_DISPOSABLE_DATABASE";

type PlanTask = {
  id: string;
  title: string;
};

type PlanBaseline = {
  id: string;
  label: string;
  capturedAt: string;
  tasks: Array<{ taskId: string }>;
};

type ReadModel = {
  authored: {
    tasks: PlanTask[];
    baselines: PlanBaseline[];
  };
  baselineComparison: { baselineId: string | null };
  planVersion: number;
};

type ApplyResponse = {
  auditEventId: string;
  newPlanVersion: number;
};

type AuditEvent = {
  id: string;
  sourceWorkflow: string | null;
  afterState: {
    compensatingCommands?: unknown[];
  } | null;
};

test.describe("Projects baseline and commits write flows", () => {
  test.describe.configure({ mode: "serial" });
  test("ADMIN captures a baseline with API readback, reload, and commit history", async ({
    page
  }) => {
    test.skip(
      process.env[DISPOSABLE_DATABASE_ENV] !== "1",
      `baseline.capture has no inverse or delete API; set ${DISPOSABLE_DATABASE_ENV}=1 only for a disposable database`
    );
    test.setTimeout(90_000);

    const marker = `FullEval baseline ${Date.now()}`;
    const projectId = await loginAndGetProject(page);
    const before = await getReadModel(page, projectId);

    await page.goto(`/projects/${projectId}/baseline`);
    await expect(page.getByRole("heading", { name: "Базовый план" })).toBeVisible();

    await page
      .getByRole("button", { name: "Зафиксировать базовый план", exact: true })
      .click();
    await page.getByPlaceholder("Название снимка").fill(marker);

    const previewPromise = waitForPlanningResponse(page, projectId, "preview-command");
    await page.getByRole("button", { name: "Зафиксировать", exact: true }).click();
    expect((await previewPromise).status()).toBe(200);

    const applyPromise = waitForPlanningResponse(page, projectId, "apply-command");
    await confirmPlanningPreview(page);
    const applyResponse = await applyPromise;
    expect(applyResponse.status()).toBe(200);
    const applied = (await applyResponse.json()) as ApplyResponse;

    const capturedModel = await getReadModel(page, projectId);
    const captured = capturedModel.authored.baselines.find(
      (baseline) => baseline.label === marker
    );
    expect(captured).toBeTruthy();
    expect(capturedModel.authored.baselines).toHaveLength(
      before.authored.baselines.length + 1
    );
    expect(capturedModel.baselineComparison.baselineId).toBe(captured!.id);
    expect(capturedModel.planVersion).toBe(applied.newPlanVersion);
    expect(capturedModel.planVersion).toBeGreaterThan(before.planVersion);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Базовый план" })).toBeVisible();
    await expect(page.getByText(marker, { exact: true }).locator("..")).toContainText(
      "активный"
    );

    await page.goto(`/projects/${projectId}/commits`);
    await expect(page.getByRole("heading", { name: "Коммиты плана" })).toBeVisible();
    const commit = commitButton(page, applied.newPlanVersion, "Зафиксирован базовый план");
    await expect(commit).toBeVisible();
    await commit.click();
    await expect(page.getByText(applied.auditEventId, { exact: true })).toBeVisible();
  });

  test("ADMIN reverts a reversible commit and restores the task after reload", async ({
    page
  }) => {
    test.setTimeout(90_000);

    const marker = `FullEval commit ${Date.now()}`;
    const projectId = await loginAndGetProject(page);
    const before = await getReadModel(page, projectId);
    const task = before.authored.tasks[0];
    expect(task, "revert test requires at least one project task").toBeTruthy();
    let restoreRequired = false;

    try {
      const renamed = await applyTaskTitle(page, projectId, task!.id, marker);
      restoreRequired = true;

      const renamedModel = await getReadModel(page, projectId);
      expect(findTask(renamedModel, task!.id)?.title).toBe(marker);
      expect(renamedModel.planVersion).toBe(renamed.newPlanVersion);

      await page.goto(`/projects/${projectId}/commits`);
      await expect(page.getByRole("heading", { name: "Коммиты плана" })).toBeVisible();
      const commit = commitButton(page, renamed.newPlanVersion, "Изменено название задачи");
      await expect(commit).toBeVisible();
      await commit.click();
      await expect(page.getByText(renamed.auditEventId, { exact: true })).toBeVisible();

      const latestRevertible = await getLatestRevertibleAuditEvent(page, projectId);
      expect(
        latestRevertible?.id,
        "another reversible commit overtook the test fixture; refusing to revert unrelated state"
      ).toBe(renamed.auditEventId);

      const revertPromise = waitForPlanningResponse(page, projectId, "revert-last");
      await page
        .getByRole("button", { name: "Откатить последний", exact: true })
        .click();
      const revertResponse = await revertPromise;
      expect(revertResponse.status()).toBe(200);
      const reverted = (await revertResponse.json()) as ApplyResponse & {
        reverted: string;
      };
      expect(reverted.reverted).toBe(renamed.auditEventId);

      const restoredModel = await getReadModel(page, projectId);
      expect(findTask(restoredModel, task!.id)?.title).toBe(task!.title);
      expect(restoredModel.planVersion).toBe(reverted.newPlanVersion);
      expect(restoredModel.planVersion).toBeGreaterThan(renamed.newPlanVersion);
      restoreRequired = false;

      await page.reload();
      await expect(page.getByRole("heading", { name: "Коммиты плана" })).toBeVisible();
      await expect(
        commitButton(page, reverted.newPlanVersion, "Изменено название задачи")
      ).toBeVisible();

      await page.goto(`/projects/${projectId}/schedule`);
      await expect(page.getByText(task!.title, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
    } finally {
      if (restoreRequired) {
        await restoreTaskTitle(page, projectId, task!.id, marker, task!.title);
      }
    }
  });
  test("PLAN reader sees baseline history but cannot capture through UI or API", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, PLAN_READER);
    const before = await getReadModel(page, projectId);
    let applyRequestCount = 0;
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (
        request.method() === "POST" &&
        (pathname.endsWith("/planning/apply-command") ||
          pathname.endsWith("/planning/apply-command-batch"))
      ) {
        applyRequestCount += 1;
      }
    });

    await page.goto(`/projects/${projectId}/baseline`);
    await expect(page.getByRole("heading", { name: "Базовый план" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Зафиксировать базовый план", exact: true })
    ).toHaveCount(0);

    const deniedResponse = await page.request.post(
      `/api/workspace/projects/${projectId}/planning/preview-command`,
      {
        headers: sameOriginMutationHeaders(page),
        data: {
          command: {
            type: "baseline.capture",
            payload: {
              baselineId: `baseline-denied-${Date.now()}`,
              label: "Denied baseline"
            }
          },
          clientPlanVersion: before.planVersion
        }
      }
    );
    expect(deniedResponse.status()).toBe(403);
    expect(applyRequestCount).toBe(0);

    const after = await getReadModel(page, projectId);
    expect(after.planVersion).toBe(before.planVersion);
    expect(after.authored.baselines).toEqual(before.authored.baselines);
    expect(after.baselineComparison).toEqual(before.baselineComparison);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Базовый план" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Зафиксировать базовый план", exact: true })
    ).toHaveCount(0);
  });

  test("PLAN reader sees commit history but cannot revert through UI or API", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, PLAN_READER);
    const before = await getReadModel(page, projectId);
    let applyRequestCount = 0;
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (
        request.method() === "POST" &&
        (pathname.endsWith("/planning/apply-command") ||
          pathname.endsWith("/planning/apply-command-batch"))
      ) {
        applyRequestCount += 1;
      }
    });

    await page.goto(`/projects/${projectId}/commits`);
    await expect(page.getByRole("heading", { name: "Коммиты плана" })).toBeVisible();
    await expect(page.getByText(/Лента \(\d+\)/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Откатить последний", exact: true })
    ).toHaveCount(0);
    await expect(page.getByText("Откатить коммит", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Откатить", { exact: true })).toHaveCount(0);

    const deniedResponse = await page.request.post(
      `/api/workspace/projects/${projectId}/planning/revert-last`,
      {
        headers: sameOriginMutationHeaders(page),
        data: {}
      }
    );
    expect(deniedResponse.status()).toBe(403);
    expect(applyRequestCount).toBe(0);

    const after = await getReadModel(page, projectId);
    expect(after.planVersion).toBe(before.planVersion);
    expect(after.authored.tasks).toEqual(before.authored.tasks);
    expect(after.authored.baselines).toEqual(before.authored.baselines);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Коммиты плана" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Откатить последний", exact: true })
    ).toHaveCount(0);
    await expect(page.getByText("Откатить коммит", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Откатить", { exact: true })).toHaveCount(0);
  });
});

async function loginAndGetProject(
  page: Page,
  credentials: { email: string; password: string } = ADMIN
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
    `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/read-model`
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

async function applyTaskTitle(
  page: Page,
  projectId: string,
  taskId: string,
  title: string
): Promise<ApplyResponse> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await getReadModel(page, projectId);
    const response = await page.request.post(applyCommandPath(projectId), {
      headers: sameOriginMutationHeaders(page),
      data: {
        command: {
          type: "task.update_identity",
          payload: { taskId, title }
        },
        clientPlanVersion: current.planVersion
      }
    });
    if (response.status() === 200) return (await response.json()) as ApplyResponse;
    if (response.status() !== 409) {
      throw new Error(`task_title_apply_failed:${taskId}:${response.status()}`);
    }
  }
  throw new Error(`task_title_apply_conflict:${taskId}`);
}

async function restoreTaskTitle(
  page: Page,
  projectId: string,
  taskId: string,
  marker: string,
  originalTitle: string
) {
  const current = await getReadModel(page, projectId);
  const currentTitle = findTask(current, taskId)?.title;
  if (currentTitle === originalTitle) return;
  if (currentTitle !== marker) {
    throw new Error(`task_title_cleanup_refused_concurrent_change:${taskId}`);
  }
  await applyTaskTitle(page, projectId, taskId, originalTitle);
  const restored = await getReadModel(page, projectId);
  if (findTask(restored, taskId)?.title !== originalTitle) {
    throw new Error(`task_title_cleanup_failed:${taskId}`);
  }
}

async function getLatestRevertibleAuditEvent(page: Page, projectId: string) {
  const response = await page.request.get(
    `/api/tenant/current/audit-events?projectId=${encodeURIComponent(projectId)}`
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { auditEvents: AuditEvent[] };
  return body.auditEvents.find((event) => {
    const commands = event.afterState?.compensatingCommands;
    return (
      event.sourceWorkflow === "planning" &&
      Array.isArray(commands) &&
      commands.length > 0
    );
  });
}

function waitForPlanningResponse(
  page: Page,
  projectId: string,
  endpoint: "preview-command" | "apply-command" | "revert-last"
): Promise<Response> {
  const path = `/api/workspace/projects/${encodeURIComponent(
    projectId
  )}/planning/${endpoint}`;
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === path
  );
}

async function confirmPlanningPreview(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Применить изменения", exact: true })
    .click();
}

function commitButton(page: Page, version: number, summary: string) {
  return page
    .getByRole("button")
    .filter({ has: page.getByText(`v${version}`, { exact: true }) })
    .filter({ has: page.getByText(summary, { exact: true })

});
}

function findTask(readModel: ReadModel, taskId: string) {
  return readModel.authored.tasks.find((task) => task.id === taskId);
}

function applyCommandPath(projectId: string) {
  return `/api/workspace/projects/${encodeURIComponent(
    projectId
  )}/planning/apply-command`;
}

function sameOriginMutationHeaders(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "x-kiss-pm-action": "same-origin"
  };
}
