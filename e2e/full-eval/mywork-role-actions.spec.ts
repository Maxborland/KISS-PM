import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  expect,
  test,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page
} from "@playwright/test";

// Дефолт совпадает с playwright.config.ts (E2E_WEB_PORT ?? "3100"): под стандартным
// раннером web поднят на 3100. Изолированный closeout-харнесс задаёт E2E_WEB_PORT явно.
const WEB_ORIGIN = `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? "3100"}`;
const EVIDENCE_DIR = resolve(
  ".superloopy/evidence/auth-shell-2026-07-10/screenshots"
);

const ROLES = {
  AADM: {
    email: "admin@kiss-pm.local",
    password: "admin12345",
    expectedName: "Анна Администратор"
  },
  EADM: {
    email: "engineer@kiss-pm.local",
    password: "engineer12345",
    expectedName: "Игорь Инженер"
  },
  PLAN: {
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345",
    expectedName: "Никита Без Ресурсов"
  },
  RES: {
    email: "resource-reader@kiss-pm.local",
    password: "resource12345",
    expectedName: "Роман Ресурсный"
  },
  BADM: {
    email: "beta@kiss-pm.local",
    password: "beta12345",
    expectedName: "Борис Администратор"
  }
} as const;

type RoleCode = keyof typeof ROLES;
type TaskCategory = "new" | "waiting" | "in_progress" | "review" | "done";

type MyWorkTask = {
  id: string;
  title: string;
  projectId: string;
  ownerUserId: string;
  statusId: string;
  status?: TaskCategory;
  statusCategory?: TaskCategory;
};

type TaskStatus = {
  id: string;
  name: string;
  category: TaskCategory;
};

type Project = { id: string; title: string };
type WorkspaceUser = { id: string; name: string };

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
});

for (const roleCode of ["AADM", "EADM", "PLAN"] as const) {
  test(`${roleCode}: rows resolve user names and project labels`, async ({ page }) => {
    await loginAndOpenMyWork(page, roleCode);

    const myWorkResponse = await page.request.get("/api/workspace/my-work");
    const { tasks } = await expectJson<{ tasks: MyWorkTask[] }>(myWorkResponse, 200);
    expect(tasks.length, `${roleCode} needs seeded my-work rows`).toBeGreaterThan(0);

    const projectsResponse = await page.request.get("/api/workspace/projects");
    const { projects } = await expectJson<{ projects: Project[] }>(projectsResponse, 200);
    const projectsById = new Map(projects.map((project) => [project.id, project.title]));

    const usersResponse = await page.request.get("/api/workspace/users");
    const users = usersResponse.status() === 200
      ? ((await usersResponse.json()) as { users: WorkspaceUser[] }).users
      : [];
    const usersById = new Map(users.map((user) => [user.id, user.name]));

    await switchToList(page);
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, `${roleCode.toLowerCase()}-mywork-list.png`),
      fullPage: true
    });

    const actorUserId = await currentUserId(page);
    for (const task of tasks) {
      const row = page.getByRole("row").filter({ hasText: task.title });
      await expect(row, `${roleCode} row for ${task.id}`).toHaveCount(1);

      const expectedOwnerName =
        usersById.get(task.ownerUserId) ??
        (task.ownerUserId === actorUserId
          ? ROLES[roleCode].expectedName
          : `Участник ${task.ownerUserId.slice(-4)}`);
      await expect(
        row.getByText(expectedOwnerName, { exact: true }),
        `${roleCode} owner display name for ${task.ownerUserId}`
      ).toBeVisible();

      const projectName = projectsById.get(task.projectId);
      expect(projectName, `project label source for ${task.projectId}`).toBeTruthy();
      await expect(
        row.getByText(projectName!, { exact: true }),
        `${roleCode} should render project name instead of ${task.projectId}`
      ).toBeVisible();
    }
  });
}

test("AADM: Kanban/List tabs and task filter preserve the same data", async ({ page }) => {
  await loginAndOpenMyWork(page, "AADM");
  const { tasks } = await expectJson<{ tasks: MyWorkTask[] }>(
    await page.request.get("/api/workspace/my-work"),
    200
  );
  expect(tasks.length).toBeGreaterThan(1);

  await expect(page.getByRole("radio", { name: "Канбан", exact: true })).toBeVisible();
  await expect(page.getByText(tasks[0]!.title, { exact: true })).toBeVisible();
  await switchToList(page);

  const filter = page.getByPlaceholder("Поиск задачи...");
  await expect(filter, "My Work needs a task filter for a multi-project list").toBeVisible();
  await filter.fill(tasks[0]!.title);
  await expect(page.getByRole("row").filter({ hasText: tasks[0]!.title })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: tasks[1]!.title })).toHaveCount(0);

  await page.getByRole("radiogroup").getByText("Канбан", { exact: true }).click();
  await expect(page.getByText(tasks[0]!.title, { exact: true })).toBeVisible();
  await expect(page.getByText(tasks[1]!.title, { exact: true })).toHaveCount(0);
});

for (const roleCode of ["AADM", "EADM", "PLAN"] as const) {
  test(`${roleCode}: allowed status change has network, API readback, reload and restore`, async ({
    browser,
    page
  }) => {
    await loginAndOpenMyWork(page, roleCode);
    const { tasks } = await expectJson<{ tasks: MyWorkTask[] }>(
      await page.request.get("/api/workspace/my-work"),
      200
    );
    const { taskStatuses } = await expectJson<{ taskStatuses: TaskStatus[] }>(
      await page.request.get("/api/workspace/task-statuses"),
      200
    );

    let seedAdmin: Awaited<ReturnType<typeof openRoleContext>> | null = null;
    let disposableTaskId: string | null = null;
    let originalStatusIdForRestore: string | null = null;
    let candidate = tasks.find((task) => {
      const category = taskCategory(task);
      return category === "waiting" || category === "in_progress";
    });

    if (!candidate && roleCode === "PLAN") {
      const sourceTask = tasks[0];
      expect(sourceTask, "PLAN needs one seeded task for reversible status setup").toBeTruthy();
      const waitingStatus = taskStatuses.find((status) => status.category === "waiting");
      expect(waitingStatus, "waiting status definition for PLAN setup").toBeTruthy();

      seedAdmin = await openRoleContext(browser, "AADM");
      const disposableId = `e2e-plan-status-${Date.now().toString(36)}`;
      const setup = await seedAdmin.page.request.post(
        `/api/workspace/projects/${sourceTask!.projectId}/tasks`,
        {
          data: {
            id: disposableId,
            title: `E2E PLAN status ${disposableId}`,
            description: "Disposable Full Evaluation fixture",
            plannedStart: "2026-07-10",
            plannedFinish: "2026-07-11",
            durationWorkingDays: 2,
            plannedWork: 8,
            priority: "normal",
            statusId: waitingStatus!.id,
            requiresAcceptance: false,
            participants: [
              { userId: "user-alpha-plan-reader-no-resources", role: "executor" }
            ]
          },
          headers: actionHeaders(`lane5-plan-setup-${Date.now().toString(36)}`)
        }
      );
      expect(setup.status(), "admin creates disposable PLAN reversible task").toBe(201);
      const setupBody = (await setup.json()) as { task: MyWorkTask };
      disposableTaskId = setupBody.task.id;
      originalStatusIdForRestore = waitingStatus!.id;
      candidate = {
        ...setupBody.task,
        status: "waiting",
        statusCategory: "waiting",
        statusId: waitingStatus!.id
      };
      await page.reload();
      await expect(page.getByRole("heading", { name: "Мои задачи" })).toBeVisible();
    }

    expect(candidate, `${roleCode} needs a reversible status candidate`).toBeTruthy();
    const selectedCandidate = candidate!;

    const originalCategory = taskCategory(selectedCandidate)!;
    const targetCategory: TaskCategory =
      originalCategory === "waiting" ? "in_progress" : "waiting";
    const targetStatus = taskStatuses.find((status) => status.category === targetCategory);
    expect(targetStatus, `status definition for ${targetCategory}`).toBeTruthy();
    const marker = `lane5-${roleCode.toLowerCase()}-${Date.now().toString(36)}`;
    const statusUrl = `/api/workspace/projects/${selectedCandidate.projectId}/tasks/${selectedCandidate.id}/status`;
    let mutationApplied = false;

    await page.route("**/api/workspace/projects/*/tasks/*/status", async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          "x-kiss-pm-e2e-marker": marker
        }
      });
    });

    try {
      await switchToList(page);
      const row = page.getByRole("row").filter({ hasText: selectedCandidate.title });
      const select = row.locator("select");
      await expect(select, `${roleCode} status affordance`).toBeEnabled();

      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname === statusUrl
      );
      await select.selectOption(targetStatus!.id);
      const response = await responsePromise;
      mutationApplied = response.status() === 200;
      expect(response.status(), `${roleCode} UI PATCH ${statusUrl}`).toBe(200);
      expect(response.request().headers()["x-kiss-pm-e2e-marker"]).toBe(marker);

      const afterApi = await readTask(page, selectedCandidate.id);
      expect(afterApi.statusId, `${roleCode} API readback after UI change`).toBe(targetStatus!.id);

      await page.reload();
      await switchToList(page);
      const reloadedRow = page.getByRole("row").filter({ hasText: selectedCandidate.title });
      await expect(reloadedRow.locator("select"), `${roleCode} reload readback`).toHaveValue(
        targetStatus!.id
      );
      await page.screenshot({
        path: resolve(EVIDENCE_DIR, `${roleCode.toLowerCase()}-status-reload.png`),
        fullPage: true
      });
    } finally {
      await page.unroute("**/api/workspace/projects/*/tasks/*/status");
      let restoreResult: { body: unknown; status: number } | null = null;
      let restoredStatusId: string | null = null;
      let cleanupResult: { body: unknown; status: number } | null = null;
      let archivedTaskReadStatus: number | null = null;
      let activeAfterCleanup: boolean | null = null;

      try {
        if (mutationApplied || seedAdmin) {
          const restorePage = seedAdmin?.page ?? page;
          const restoreStatusId = originalStatusIdForRestore ?? selectedCandidate.statusId;
          const beforeRestore = await readTask(restorePage, selectedCandidate.id);
          if (beforeRestore.statusId === restoreStatusId) {
            restoreResult = { body: { status: "already_restored" }, status: 200 };
          } else {
            const restore = await restorePage.request.patch(statusUrl, {
              data: { statusId: restoreStatusId },
              headers: actionHeaders(`${marker}-restore`)
            });
            restoreResult = { body: await restore.json(), status: restore.status() };
          }
          if (restoreResult.status === 200) {
            restoredStatusId = (await readTask(restorePage, selectedCandidate.id)).statusId;
          }
        }
      } finally {
        try {
          if (disposableTaskId && seedAdmin) {
            const cleanup = await seedAdmin.page.request.delete(
              `/api/workspace/tasks/${disposableTaskId}`,
              { headers: actionHeaders(`${marker}-cleanup`) }
            );
            cleanupResult = { body: await cleanup.json(), status: cleanup.status() };
            archivedTaskReadStatus = (
              await seedAdmin.page.request.get(`/api/workspace/tasks/${disposableTaskId}`)
            ).status();
            const active = await expectJson<{ tasks: MyWorkTask[] }>(
              await page.request.get("/api/workspace/my-work"),
              200
            );
            activeAfterCleanup = active.tasks.some((task) => task.id === disposableTaskId);
          }
        } finally {
          await seedAdmin?.context.close();
        }
      }

      if (restoreResult) {
        expect(
          restoreResult.status,
          `${roleCode} restore PATCH: ${JSON.stringify(restoreResult.body)}`
        ).toBe(200);
        expect(restoredStatusId, `${roleCode} restored status`).toBe(
          originalStatusIdForRestore ?? selectedCandidate.statusId
        );
      }
      if (cleanupResult) {
        expect(
          cleanupResult.status,
          `admin archives disposable PLAN task: ${JSON.stringify(cleanupResult.body)}`
        ).toBe(200);
        expect(archivedTaskReadStatus, "archived PLAN task leaves active detail reads").toBe(404);
        expect(activeAfterCleanup, "archived PLAN task leaves active My Work").toBe(false);
      }
    }
  });
}

test("PLAN: no affordance for another user's task and direct write is 403 unchanged", async ({
  browser,
  page
}) => {
  const admin = await openRoleContext(browser, "AADM");
  try {
    const target = await firstTask(admin.page);
    const before = await readTask(admin.page, target.id);

    await loginAndOpenMyWork(page, "PLAN");
    await expect(page.getByText(target.title, { exact: true })).toHaveCount(0);

    const denied = await page.request.patch(
      `/api/workspace/projects/${target.projectId}/tasks/${target.id}/status`,
      {
        data: { statusId: differentStatusId(before) },
        headers: actionHeaders(`lane5-plan-denied-${Date.now().toString(36)}`)
      }
    );
    expect(denied.status()).toBe(403);
    expect(await denied.json()).toEqual({ error: "task_participant_role_required" });

    const after = await readTask(admin.page, target.id);
    expect(after.statusId).toBe(before.statusId);
  } finally {
    await admin.context.close();
  }
});

test("RES: forbidden My Work has no write affordance and direct write is 403 unchanged", async ({
  browser,
  page
}) => {
  const admin = await openRoleContext(browser, "AADM");
  try {
    const target = await firstTask(admin.page);
    const before = await readTask(admin.page, target.id);

    await loginOnly(page, "RES");
    const myWorkResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/api/workspace/my-work"
    );
    await page.goto("/my-work");
    expect((await myWorkResponse).status()).toBe(403);
    await expect(page.getByText(/Недостаточно прав|Доступ ограничен/).first()).toBeVisible();
    await expect(page.locator("select")).toHaveCount(0);
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, "res-mywork-forbidden.png"),
      fullPage: true
    });

    const denied = await page.request.patch(
      `/api/workspace/projects/${target.projectId}/tasks/${target.id}/status`,
      {
        data: { statusId: differentStatusId(before) },
        headers: actionHeaders(`lane5-res-denied-${Date.now().toString(36)}`)
      }
    );
    expect(denied.status()).toBe(403);
    expect(await denied.json()).toEqual({ error: "permission_missing" });
    expect((await readTask(admin.page, target.id)).statusId).toBe(before.statusId);
  } finally {
    await admin.context.close();
  }
});

test("BADM: empty tenant is isolated from alpha tasks", async ({ browser, page }) => {
  const admin = await openRoleContext(browser, "AADM");
  try {
    const alphaTask = await firstTask(admin.page);
    const before = await readTask(admin.page, alphaTask.id);

    await loginAndOpenMyWork(page, "BADM");
    const { tasks } = await expectJson<{ tasks: MyWorkTask[] }>(
      await page.request.get("/api/workspace/my-work"),
      200
    );
    expect(tasks).toEqual([]);
    await expect(page.getByText("Задач пока нет", { exact: true })).toBeVisible();
    await expect(page.getByText(alphaTask.title, { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, "badm-mywork-empty-isolated.png"),
      fullPage: true
    });

    const crossTenantWrite = await page.request.patch(
      `/api/workspace/projects/${alphaTask.projectId}/tasks/${alphaTask.id}/status`,
      {
        data: { statusId: differentStatusId(before) },
        headers: actionHeaders(`lane5-badm-isolation-${Date.now().toString(36)}`)
      }
    );
    expect(crossTenantWrite.status()).toBe(404);
    expect(await crossTenantWrite.json()).toEqual({ error: "project_not_found" });
    expect((await readTask(admin.page, alphaTask.id)).statusId).toBe(before.statusId);
  } finally {
    await admin.context.close();
  }
});

test("AADM: deterministic My Work 5xx shows retry and recovers on the next request", async ({
  page
}) => {
  await loginOnly(page, "AADM");
  const statuses: number[] = [];
  let attempt = 0;

  page.on("response", (response) => {
    if (
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/workspace/my-work"
    ) {
      statuses.push(response.status());
    }
  });
  await page.route("**/api/workspace/my-work", async (route) => {
    attempt += 1;
    if (attempt === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "load_failed" })
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/my-work");
  await expect.poll(() => statuses).toEqual([503]);
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "aadm-mywork-503.png"),
    fullPage: true
  });

  await page.getByRole("button", { name: "Повторить" }).click();
  await expect.poll(() => statuses).toEqual([503, 200]);
  await expect(page.getByRole("heading", { name: "Мои задачи" })).toBeVisible();
  await expect(page.getByText("Задач пока нет", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "aadm-mywork-retry-200.png"),
    fullPage: true
  });
});

async function loginOnly(page: Page, roleCode: RoleCode) {
  const role = ROLES[roleCode];
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const email = page.getByLabel("Email");
  const password = page.getByLabel("Пароль", { exact: true });
  const submit = page.getByRole("button", { name: "Войти" });
  await email.fill(role.email);
  await password.fill(role.password);
  await expect(email).toHaveValue(role.email);
  await expect(password).toHaveValue(role.password);
  await expect(submit).toBeEnabled();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/auth/login"
  );
  await submit.click();
  const response = await responsePromise;
  expect(response.status(), `${roleCode} login`).toBe(200);
  await expect.poll(async () => (await page.request.get("/api/auth/me")).status()).toBe(200);
}

async function loginAndOpenMyWork(page: Page, roleCode: RoleCode) {
  await loginOnly(page, roleCode);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/workspace/my-work"
  );
  await page.goto("/my-work");
  const response = await responsePromise;
  expect(response.status(), `${roleCode} GET /api/workspace/my-work`).toBe(200);
  await expect(page.getByRole("heading", { name: "Мои задачи" })).toBeVisible();
}

async function switchToList(page: Page) {
  await page.getByRole("radiogroup").getByText("Список", { exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
}

async function expectJson<T>(response: APIResponse, status: number): Promise<T> {
  expect(response.status(), response.url()).toBe(status);
  return (await response.json()) as T;
}

async function currentUserId(page: Page): Promise<string> {
  const response = await page.request.get("/api/auth/me");
  const payload = await expectJson<{ user: { id: string } }>(response, 200);
  return payload.user.id;
}

async function readTask(page: Page, taskId: string): Promise<MyWorkTask> {
  const response = await page.request.get(`/api/workspace/tasks/${taskId}`);
  const payload = await expectJson<{ task: MyWorkTask }>(response, 200);
  return payload.task;
}

async function firstTask(page: Page): Promise<MyWorkTask> {
  const response = await page.request.get("/api/workspace/my-work");
  const { tasks } = await expectJson<{ tasks: MyWorkTask[] }>(response, 200);
  expect(tasks.length, "admin readback target").toBeGreaterThan(0);
  return tasks[0]!;
}

function taskCategory(task: MyWorkTask): TaskCategory | undefined {
  return task.statusCategory ?? task.status;
}

function differentStatusId(task: MyWorkTask): string {
  return task.statusId === "task-status-in-progress"
    ? "task-status-waiting"
    : "task-status-in-progress";
}

function actionHeaders(marker: string) {
  return {
    "x-kiss-pm-action": "same-origin",
    "x-kiss-pm-e2e-marker": marker
  };
}

async function openRoleContext(
  browser: Browser,
  roleCode: RoleCode
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: WEB_ORIGIN, locale: "ru-RU" });
  const page = await context.newPage();
  await loginOnly(page, roleCode);
  return { context, page };
}
