import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type APIResponse, type Page } from "@playwright/test";

const evidenceRoot = ".superloopy/evidence/auth-shell-2026-07-10/dashboard-role-states";
const screenshotDir = join(evidenceRoot, "screenshots");

type RoleKey = "AADM" | "EADM" | "PLAN" | "RES" | "BADM";
type DashboardState = "full" | "partial" | "forbidden" | "empty";

type RoleCase = {
  key: RoleKey;
  email: string;
  password: string;
  userId: string;
  tenantId: "tenant-alpha" | "tenant-beta";
  state: DashboardState;
  statuses: {
    myWork: 200 | 403;
    projects: 200 | 403;
    opportunities: 200 | 403;
  };
};

type ApiEvent = {
  method: string;
  path: string;
  status: number;
};

type Readback = {
  status: number;
  body: unknown;
};

const roleCases: RoleCase[] = [
  {
    key: "AADM",
    email: "admin@kiss-pm.local",
    password: "admin12345",
    userId: "user-alpha-admin",
    tenantId: "tenant-alpha",
    state: "full",
    statuses: { myWork: 200, projects: 200, opportunities: 200 }
  },
  {
    key: "EADM",
    email: "engineer@kiss-pm.local",
    password: "engineer12345",
    userId: "user-alpha-engineer",
    tenantId: "tenant-alpha",
    state: "full",
    statuses: { myWork: 200, projects: 200, opportunities: 200 }
  },
  {
    key: "PLAN",
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345",
    userId: "user-alpha-plan-reader-no-resources",
    tenantId: "tenant-alpha",
    state: "partial",
    statuses: { myWork: 200, projects: 200, opportunities: 403 }
  },
  {
    key: "RES",
    email: "resource-reader@kiss-pm.local",
    password: "resource12345",
    userId: "user-alpha-resource-reader",
    tenantId: "tenant-alpha",
    state: "forbidden",
    statuses: { myWork: 403, projects: 403, opportunities: 403 }
  },
  {
    key: "BADM",
    email: "beta@kiss-pm.local",
    password: "beta12345",
    userId: "user-beta-admin",
    tenantId: "tenant-beta",
    state: "empty",
    statuses: { myWork: 200, projects: 200, opportunities: 200 }
  }
];

mkdirSync(screenshotDir, { recursive: true });

test.describe("SHELL-DASH dashboard role states", () => {
  test("ANON redirects to login before dashboard data is requested", async ({ page }) => {
    const events = recordApiEvents(page);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    const redirectedUrl = new URL(page.url());
    expect(redirectedUrl.searchParams.get("from")).toBe("/dashboard");
    await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();
    expect(dashboardEvents(events)).toEqual([]);
    await screenshot(page, "anon-redirect.png");

    console.log("DASHBOARD_EVIDENCE", JSON.stringify({ role: "ANON", url: page.url(), events }));
  });

  for (const roleCase of roleCases) {
    test(`${roleCase.key} renders ${roleCase.state}, survives reload, and preserves source readback`, async ({ page }) => {
      const events = recordApiEvents(page);
      const session = await loginThroughUi(page, roleCase);

      await expectDashboardState(page, roleCase.state);
      const firstReadback = await readDashboardSources(page);
      expectReadbackStatuses(firstReadback, roleCase.statuses);
      expect(session.user.id).toBe(roleCase.userId);
      expect(session.workspace.id).toBe(roleCase.tenantId);

      if (roleCase.key === "BADM") {
        await expectBetaIsolation(page, session, firstReadback);
      }

      const beforeReload = dashboardEvents(events).length;
      await page.reload();
      await expectDashboardState(page, roleCase.state);
      await expect.poll(() => dashboardEvents(events).length).toBeGreaterThan(beforeReload);

      const reloadReadback = await readDashboardSources(page);
      expectReadbackStatuses(reloadReadback, roleCase.statuses);
      if (roleCase.key === "BADM") {
        await expectBetaIsolation(page, session, reloadReadback);
      }

      await screenshot(page, `${roleCase.key.toLowerCase()}-${roleCase.state}-reload.png`);
      console.log(
        "DASHBOARD_EVIDENCE",
        JSON.stringify({
          role: roleCase.key,
          state: roleCase.state,
          session: { userId: session.user.id, tenantId: session.workspace.id },
          readback: summarizeReadback(reloadReadback),
          events: dashboardEvents(events)
        })
      );
    });
  }

  test("RES sees deterministic source 500, Retry issues a new request, then recovers to forbidden", async ({ page }) => {
    const roleCase = roleCases.find((candidate) => candidate.key === "RES")!;
    const events = recordApiEvents(page);
    await loginThroughUi(page, roleCase);
    await expectDashboardState(page, "forbidden");

    let interceptedRequests = 0;
    await page.route("**/api/workspace/my-work", async (route) => {
      interceptedRequests += 1;
      if (interceptedRequests === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "load_failed" })
        });
        return;
      }
      await route.continue();
    });

    const failedResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/workspace/my-work") && response.status() === 500
    );
    await page.reload();
    expect((await failedResponse).status()).toBe(500);
    await expect(page.getByText("Не удалось собрать сводку", { exact: true })).toBeVisible();
    const retry = page.getByRole("button", { name: "Повторить" });
    await expect(retry).toBeVisible();
    await screenshot(page, "res-source-500-error.png");

    const recoveredResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/workspace/my-work") && response.status() === 403
    );
    await retry.click();
    expect((await recoveredResponse).status()).toBe(403);
    await expect.poll(() => interceptedRequests).toBe(2);
    await expectDashboardState(page, "forbidden");
    await screenshot(page, "res-source-500-recovered.png");

    console.log(
      "DASHBOARD_EVIDENCE",
      JSON.stringify({
        role: "RES",
        interceptedSource: "/api/workspace/my-work",
        statuses: [500, 403],
        interceptedRequests,
        recoveryState: "forbidden",
        events: dashboardEvents(events)
      })
    );
  });
});

function recordApiEvents(page: Page): ApiEvent[] {
  const events: ApiEvent[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/")) return;
    events.push({
      method: response.request().method(),
      path: url.pathname,
      status: response.status()
    });
  });
  return events;
}

function dashboardEvents(events: ApiEvent[]) {
  return events.filter((event) =>
    event.path === "/api/workspace/my-work" ||
    event.path === "/api/workspace/projects" ||
    event.path === "/api/workspace/opportunities" ||
    event.path === "/api/workspace/deal-stages" ||
    event.path === "/api/workspace/clients" ||
    event.path === "/api/workspace/contacts" ||
    event.path === "/api/workspace/products" ||
    event.path === "/api/workspace/project-types" ||
    event.path === "/api/workspace/pipelines" ||
    event.path.includes("/stage-transitions")
  );
}

async function loginThroughUi(page: Page, roleCase: RoleCase) {
  await page.goto("/login?from=%2Fdashboard");
  await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();
  await page.getByLabel("Email").fill(roleCase.email);
  await page.getByLabel("Пароль", { exact: true }).fill(roleCase.password);

  const loginResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST"
  );
  const meResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/me") && response.status() === 200
  );
  await page.getByRole("button", { name: "Войти" }).click();
  expect((await loginResponse).status()).toBe(200);
  const sessionResponse = await meResponse;
  expect(sessionResponse.status()).toBe(200);
  const session = (await sessionResponse.json()) as {
    user: { id: string; name: string };
    workspace: { id: string };
  };

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
  return session;
}

async function expectDashboardState(page: Page, state: DashboardState) {
  const main = page.getByRole("main");
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();

  if (state === "forbidden") {
    await expect(main.getByText("Дашборд недоступен вашей роли", { exact: true })).toBeVisible();
    await expect(main.getByText("Мои задачи", { exact: true })).toHaveCount(0);
    return;
  }

  for (const label of ["Мои задачи", "Открытые сделки", "Активные проекты", "Сделки выиграны"]) {
    await expect(main.getByText(label, { exact: true })).toBeVisible();
  }

  if (state === "full") {
    await expect(main.getByText("нет доступа", { exact: true })).toHaveCount(0);
    await expect(main.getByText(/недоступны вашей роли/)).toHaveCount(0);
    return;
  }

  if (state === "partial") {
    await expect(main.getByText("нет доступа", { exact: true })).toHaveCount(2);
    await expect(main.getByText("Сделки недоступны вашей роли.", { exact: true })).toBeVisible();
    await expect(main.getByText("Активные проекты", { exact: true })).toBeVisible();
    return;
  }

  await expect(main.getByText("Незавершённых задач нет — всё закрыто.", { exact: true })).toBeVisible();
  await expect(main.getByText("Сделок пока нет.", { exact: true })).toBeVisible();
  await expect(main.getByText("0", { exact: true })).toHaveCount(4);
  await expect(main.getByText("нет доступа", { exact: true })).toHaveCount(0);
}

async function readDashboardSources(page: Page) {
  const [myWork, projects, opportunities] = await Promise.all([
    readJson(page, "/api/workspace/my-work"),
    readJson(page, "/api/workspace/projects"),
    readJson(page, "/api/workspace/opportunities")
  ]);
  return { myWork, projects, opportunities };
}

async function readJson(page: Page, path: string): Promise<Readback> {
  const response = await page.request.get(path);
  return {
    status: response.status(),
    body: await responseBody(response)
  };
}

async function responseBody(response: APIResponse) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function expectReadbackStatuses(
  readback: Awaited<ReturnType<typeof readDashboardSources>>,
  expected: RoleCase["statuses"]
) {
  expect({
    myWork: readback.myWork.status,
    projects: readback.projects.status,
    opportunities: readback.opportunities.status
  }).toEqual(expected);
}

async function expectBetaIsolation(
  page: Page,
  session: Awaited<ReturnType<typeof loginThroughUi>>,
  readback: Awaited<ReturnType<typeof readDashboardSources>>
) {
  expect(session.workspace.id).toBe("tenant-beta");
  expect(JSON.stringify({ session, readback })).not.toMatch(/alpha|Анна Администратор|Игорь Инженер|Никита Без Ресурсов|Роман Ресурсный/i);
  expect(arrayLength(readback.myWork.body, "tasks")).toBe(0);
  expect(arrayLength(readback.projects.body, "projects")).toBe(0);
  expect(arrayLength(readback.opportunities.body, "opportunities")).toBe(0);
  await expect(page.getByRole("main")).not.toContainText(/Анна Администратор|Игорь Инженер|Никита Без Ресурсов|Роман Ресурсный/);
}

function arrayLength(body: unknown, key: string) {
  if (!body || typeof body !== "object") return -1;
  const value = (body as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : -1;
}

function summarizeReadback(readback: Awaited<ReturnType<typeof readDashboardSources>>) {
  return {
    myWork: { status: readback.myWork.status, count: arrayLength(readback.myWork.body, "tasks") },
    projects: { status: readback.projects.status, count: arrayLength(readback.projects.body, "projects") },
    opportunities: {
      status: readback.opportunities.status,
      count: arrayLength(readback.opportunities.body, "opportunities")
    }
  };
}

async function screenshot(page: Page, filename: string) {
  await page.screenshot({ path: join(screenshotDir, filename), fullPage: true });
}
