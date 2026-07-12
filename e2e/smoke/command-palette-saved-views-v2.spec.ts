import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { loginToWorkspace } from "./smokeHelpers";

const PROJECT_ID = "project-vektor-portal";
const LEGACY_PROJECT_ID = "project-demo-crm-intake";
const LEGACY_VIEW_ID = "saved-view-167f58f8-0622-489a-bec9-90fb56b72793";
const TASK_TITLE = "Подготовить ресурсную оценку по сделке";
const DEAL_TITLE = "Проверка прав CRM E2E";
const EVIDENCE_DIR = resolve(".superloopy/evidence/frontend/pr10-palette");

async function openPalette(page: Page) {
  await page.keyboard.press("Control+K");
  const dialog = page.getByRole("dialog", { name: "Поиск и команды" });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("combobox", { name: "Поиск и команды" });
  await expect(input).toBeFocused();
  return { dialog, input };
}

test("admin uses the keyboard palette for task/deal/project peeks and the real create-deal action", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  await page.goto("/my-work");

  const trigger = page.getByRole("button", { name: "Поиск и команды…" });
  await trigger.focus();
  let palette = await openPalette(page);
  await expect(palette.dialog.getByText("Навигация", { exact: true })).toBeVisible();
  await expect(palette.dialog.getByText("Действия", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  // Палитра должна разрешить задачу, скрытую локальным фильтром списка.
  await page.getByRole("textbox", { name: "Поиск задачи" }).fill("задача скрыта локальным фильтром");

  palette = await openPalette(page);
  const taskResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/workspace/search" && url.searchParams.get("types") === "project,task,opportunity";
  });
  await palette.input.fill("ресурсную оценку");
  expect((await taskResponse).status()).toBe(200);
  await expect(palette.dialog.getByText(TASK_TITLE, { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/my-work\?task=task-demo-resource-estimate$/);
  await expect(page.getByRole("dialog").getByRole("heading", { name: TASK_TITLE })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/my-work$/);

  palette = await openPalette(page);
  await palette.input.fill(DEAL_TITLE);
  await expect(palette.dialog.getByText(DEAL_TITLE, { exact: true })).toBeVisible();
  await palette.dialog.getByText(DEAL_TITLE, { exact: true }).click();
  await expect(page).toHaveURL(/\/crm\/deals\?deal=opportunity-reader-e2e$/);
  await expect(page.getByRole("dialog").getByRole("heading", { name: DEAL_TITLE })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/crm\/deals$/);

  palette = await openPalette(page);
  await palette.input.fill("Вектор");
  const projectResult = palette.dialog.getByRole("group", { name: "Проекты" }).getByText(/Вектор/i).first();
  await expect(projectResult).toBeVisible();
  await projectResult.click();
  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}$`));

  palette = await openPalette(page);
  await palette.input.fill("Создать сделку");
  await palette.dialog.getByText("Создать сделку", { exact: true }).click();
  await expect(page).toHaveURL(/\/crm\/deals\?create=deal$/);
  const dealForm = page.getByRole("dialog", { name: "Новая сделка" });
  await expect(dealForm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/crm\/deals$/);
});

test("reader palette fails closed for privileged actions and still searches permitted tasks", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" });
  await page.goto("/my-work");

  const palette = await openPalette(page);
  await expect(palette.dialog.getByText("Создать сделку", { exact: true })).toHaveCount(0);
  await expect(palette.dialog.getByText("Администрирование", { exact: true })).toHaveCount(0);
  await palette.input.fill("ресурсную оценку");
  await expect(palette.dialog.getByText(TASK_TITLE, { exact: true })).toBeVisible();
  await palette.dialog.getByText(TASK_TITLE, { exact: true }).click();
  await expect(page).toHaveURL(/\/my-work\?task=task-demo-resource-estimate$/);
  await expect(page.getByRole("dialog").getByRole("heading", { name: TASK_TITLE })).toBeVisible();
});

test("resource Saved Views v2 round-trip, partial fallback and legacy schedule payload stay live", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  const endpoint = `/api/workspace/projects/${PROJECT_ID}/planning/saved-views`;
  const marker = `Ресурсы PR10 ${Date.now()}`;
  let viewId = "";
  let partialViewId = "";
  let legacyViewId = LEGACY_VIEW_ID;
  let legacyViewName = "PR10 legacy baseline";
  const legacyEndpoint = `/api/workspace/projects/${LEGACY_PROJECT_ID}/planning/saved-views`;
  let createdLegacyReplay = false;
  const legacyList = await page.request.get(legacyEndpoint);
  expect(legacyList.status()).toBe(200);
  const legacyViews = ((await legacyList.json()) as { savedViews: Array<{ id: string }> }).savedViews;
  if (!legacyViews.some((view) => view.id === LEGACY_VIEW_ID)) {
    legacyViewName = `PR10 legacy replay ${Date.now()}`;
    const legacyCreate = await page.request.post(legacyEndpoint, {
      headers: { "x-kiss-pm-action": "same-origin" },
      data: {
        name: legacyViewName,
        scope: "user",
        clientRequestId: `pr10-legacy-replay-${Date.now()}`,
        payload: { zoom: "day", columnWidths: [52, 64, 44, 196, 52, 56, 44, 90, 90, 120, 104], legacyUnknown: "ignored-later", collapsedTaskIds: ["task-summary-legacy-pr10"] }
      }
    });
    expect(legacyCreate.status()).toBe(201);
    legacyViewId = ((await legacyCreate.json()) as { savedView: { id: string } }).savedView.id;
    createdLegacyReplay = true;
  }

  try {
    await page.goto(`/projects/${PROJECT_ID}/resources`);
    await expect(page.getByTestId("saved-views-dropdown")).toBeVisible();
    await page.getByRole("button", { name: "Неделя", exact: true }).click();
    await page.getByRole("button", { name: "Только перегруженные" }).click();
    await page.getByRole("button", { name: "Скрыть незанятых" }).click();
    await page.getByRole("button", { name: "Сохранить текущий вид" }).click();
    await page.getByLabel("Название вида").fill(marker);

    const createResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === endpoint);
    await page.getByRole("dialog").getByRole("button", { name: "Сохранить", exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json() as { savedView: { id: string; payload: Record<string, unknown> } };
    viewId = created.savedView.id;
    expect(created.savedView.payload).toMatchObject({
      version: 2,
      surface: "resource-matrix",
      state: { granularity: "week", onlyOverload: true, hideIdle: true, teamFilter: "all", roleFilter: "all", projectFilter: "all", sortBy: "load" }
    });

    await page.getByRole("button", { name: "День", exact: true }).click();
    await page.getByRole("button", { name: "Только перегруженные" }).click();
    await page.getByRole("button", { name: "Скрыть незанятых" }).click();
    await page.getByTestId("saved-views-dropdown").selectOption(viewId);
    await expect(page.getByRole("button", { name: "Неделя", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Только перегруженные" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Скрыть незанятых" })).toHaveAttribute("aria-pressed", "true");

    const partialResponse = await page.request.post(endpoint, {
      headers: { "x-kiss-pm-action": "same-origin" },
      data: { name: `${marker} partial`, scope: "user", clientRequestId: `pr10-partial-${Date.now()}`, payload: {
        version: 2, surface: "resource-matrix", state: {
          granularity: "month", monthOffset: 1200, collapsedGroupIds: [], onlyOverload: false, hideIdle: false,
          teamFilter: "team-missing", roleFilter: "role-missing", projectFilter: "project-missing", sortBy: "name"
        }
      } }
    });
    expect(partialResponse.status()).toBe(201);
    partialViewId = ((await partialResponse.json()) as { savedView: { id: string } }).savedView.id;
    await page.reload();
    await page.getByTestId("saved-views-dropdown").selectOption(partialViewId);
    await expect(page.getByText("Вид применён частично: недоступные фильтры сброшены")).toBeVisible();
    await expect(page.getByRole("button", { name: "Месяц", exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.goto(`/projects/${LEGACY_PROJECT_ID}/schedule`);
    const legacyOption = page.getByTestId("saved-views-dropdown").locator(`option[value="${legacyViewId}"]`);
    await expect(legacyOption).toHaveText(legacyViewName);
    await page.getByRole("button", { name: "Месяц", exact: true }).click();
    await page.getByTestId("saved-views-dropdown").selectOption(legacyViewId);
    await expect(page.getByRole("button", { name: "День", exact: true })).toHaveAttribute("aria-pressed", "true");
  } finally {
    for (const [projectId, id] of [[PROJECT_ID, viewId], [PROJECT_ID, partialViewId], [LEGACY_PROJECT_ID, createdLegacyReplay ? legacyViewId : ""]] as const) {
      if (!id) continue;
      const response = await page.request.delete(`/api/workspace/projects/${projectId}/planning/saved-views/${encodeURIComponent(id)}`, {
        headers: { "x-kiss-pm-action": "same-origin" },
        data: { clientRequestId: `pr10-cleanup-${id}-${Date.now()}` }
      });
      expect([200, 404]).toContain(response.status());
    }
  }
});

test("palette evidence is stable at 390, 768 and 1280 with normal and reduced motion", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  await page.goto("/my-work");

  for (const reducedMotion of [false, true]) {
    await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const palette = await openPalette(page);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: resolve(EVIDENCE_DIR, `${width}-${reducedMotion ? "reduced" : "normal"}.png`), fullPage: true });
      await page.keyboard.press("Escape");
      await expect(palette.dialog).toBeHidden();
    }
  }
});
