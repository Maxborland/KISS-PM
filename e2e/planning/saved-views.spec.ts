import { expect, test, type Browser, type Page } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const PLAN_READER = { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" };
const PROJECT_ID = "project-vektor-portal";

test("saved WBS views: admin persists once and plan reader applies without mutation access", async ({
  browser
}, testInfo) => {
  test.setTimeout(90_000);
  const marker = `WBS ${Date.now()}`;
  const admin = await authenticatedPage(browser, testInfo.project.use.baseURL, ADMIN);
  let projectId = "";
  let viewId = "";

  try {
    projectId = PROJECT_ID;
    const endpoint = `/api/workspace/projects/${projectId}/planning/saved-views`;
    await admin.goto(`/projects/${projectId}/schedule`);
    await expect(admin.getByTestId("saved-views-dropdown")).toBeVisible();

    await admin.getByRole("button", { name: "День", exact: true }).click();
    await expect(admin.getByRole("button", { name: "День", exact: true })).toHaveAttribute("aria-pressed", "true");
    await admin.getByRole("button", { name: "Сохранить текущий вид" }).click();
    await admin.getByLabel("Название вида").fill(marker);
    await admin.getByLabel("Доступ к виду").selectOption("project");

    let createRequests = 0;
    let createPayload: Record<string, unknown> | null = null;
    admin.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === endpoint) {
        createRequests += 1;
        createPayload = request.postDataJSON() as Record<string, unknown>;
      }
    });
    const createdResponse = admin.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === endpoint
    );
    await admin.getByRole("dialog").getByRole("button", { name: "Сохранить", exact: true }).evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    const created = await createdResponse;
    expect(created.status()).toBe(201);
    expect(createRequests).toBe(1);
    const body = await created.json() as { savedView: { id: string } };
    viewId = body.savedView.id;
    await expect(admin.getByTestId("saved-views-dropdown")).toHaveValue(viewId);
    expect(createPayload).not.toBeNull();
    const submitted = createPayload!;
    const replay = await admin.evaluate(async ({ path, payload }) => {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify(payload)
      });
      return { status: response.status, body: await response.json() as { savedView?: { id: string }; error?: string } };
    }, { path: endpoint, payload: submitted });
    expect(replay.status).toBe(201);
    expect(replay.body.savedView?.id).toBe(viewId);

    const conflict = await admin.evaluate(async ({ path, payload }) => {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify({ ...payload, name: `${String(payload.name)} conflict` })
      });
      return { status: response.status, body: await response.json() as { error?: string } };
    }, { path: endpoint, payload: submitted });
    expect(conflict).toEqual({ status: 409, body: { error: "idempotency_key_conflict" } });

    await admin.getByRole("button", { name: "Месяц", exact: true }).click();
    await admin.getByTestId("saved-views-dropdown").selectOption(viewId);
    await expect(admin.getByRole("button", { name: "День", exact: true })).toHaveAttribute("aria-pressed", "true");

    await admin.reload();
    await expect(admin.getByTestId("saved-views-dropdown").locator(`option[value="${viewId}"]`)).toHaveText(`${marker} · общий`);
    await admin.getByRole("button", { name: "Месяц", exact: true }).click();
    await admin.getByTestId("saved-views-dropdown").selectOption(viewId);
    await expect(admin.getByRole("button", { name: "День", exact: true })).toHaveAttribute("aria-pressed", "true");

    const reader = await authenticatedPage(browser, testInfo.project.use.baseURL, PLAN_READER);
    try {
      await reader.goto(`/projects/${projectId}/schedule`);
      await expect(reader.getByTestId("saved-views-dropdown").locator(`option[value="${viewId}"]`)).toHaveText(`${marker} · общий`);
      await expect(reader.getByRole("button", { name: "Сохранить текущий вид" })).toHaveCount(0);
      await expect(reader.getByRole("button", { name: "Удалить выбранный вид" })).toHaveCount(0);
      await reader.getByTestId("saved-views-dropdown").selectOption(viewId);
      await expect(reader.getByRole("button", { name: "День", exact: true })).toHaveAttribute("aria-pressed", "true");

      const deniedStatus = await reader.evaluate(async ({ path, name }) => {
        const response = await fetch(path, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
          body: JSON.stringify({
            name,
            clientRequestId: `reader-denied-${Date.now()}`,
            scope: "user",
            payload: { version: 1, zoom: "week", columnWidths: Array(11).fill(80), collapsedTaskIds: [] }
          })
        });
        return response.status;
      }, { path: endpoint, name: `${marker} denied` });
      expect(deniedStatus).toBe(403);
    } finally {
      await reader.context().unrouteAll({ behavior: "ignoreErrors" });
      await reader.context().close();
    }

    const deletedResponse = admin.waitForResponse((response) =>
      response.request().method() === "DELETE" && new URL(response.url()).pathname === `${endpoint}/${viewId}`
    );
    await admin.getByRole("button", { name: "Удалить выбранный вид" }).click();
    expect((await deletedResponse).status()).toBe(200);
    viewId = "";
    await expect(admin.getByTestId("saved-views-dropdown").getByRole("option", { name: `${marker} · общий` })).toHaveCount(0);
    const readback = await admin.evaluate(async (path) => {
      const response = await fetch(path, { credentials: "include" });
      return { status: response.status, body: await response.json() as { savedViews: Array<{ name: string }> } };
    }, endpoint);
    expect(readback.status).toBe(200);
    const readbackBody = readback.body;
    expect(readbackBody.savedViews.some((view) => view.name === marker)).toBe(false);
  } finally {
    if (viewId && projectId) await cleanupView(admin, projectId, viewId);
    // Снимаем route-хендлеры до close: in-flight fetch не должен ронять teardown.
    await admin.context().unrouteAll({ behavior: "ignoreErrors" });
    await admin.context().close();
  }
});

async function authenticatedPage(
  browser: Browser,
  baseURL: string | undefined,
  user: { email: string; password: string }
): Promise<Page> {
  const context = await browser.newContext({ baseURL: String(baseURL), locale: "ru-RU" });
  const apiPort = process.env.E2E_API_PORT;
  if (apiPort) {
    await context.route("**/api/**", async (route) => {
      const target = new URL(route.request().url());
      // Бесконечные SSE-потоки (realtime/planning events) нельзя тянуть через
      // route.fetch — хендлер повисает на живом стриме до закрытия контекста и
      // роняет teardown («Target page … has been closed»); пропускаем их через
      // штатный Next-прокси без перезаписи хоста.
      if (target.pathname.endsWith("/events")) {
        await route.continue();
        return;
      }
      target.protocol = "http:";
      target.hostname = "127.0.0.1";
      target.port = apiPort;
      const response = await route.fetch({ url: target.toString() });
      await route.fulfill({ response });
    });
  }
  const page = await context.newPage();
  await page.goto("/");
  await loginToWorkspace(page, user);
  return page;
}

async function cleanupView(page: Page, projectId: string, viewId: string) {
  const status = await page.evaluate(async (path) => {
    const response = await fetch(path, { method: "DELETE", credentials: "include", headers: { "x-kiss-pm-action": "same-origin" } });
    return response.status;
  }, `/api/workspace/projects/${projectId}/planning/saved-views/${encodeURIComponent(viewId)}`);
  if (![200, 404].includes(status)) throw new Error(`saved_view_cleanup_failed:${status}`);
}