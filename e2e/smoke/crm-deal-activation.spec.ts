import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

const STAGED_DEAL = {
  id: "opportunity-vektor-audit",
  title: "Аудит процессов Вектор",
  stageId: "deal-stage-qualified"
};
const UNSTAGED_DEAL = {
  id: "opportunity-without-stage",
  title: "Запрос без стадии",
  stageId: "deal-stage-new",
  stageName: "Новая"
};

const dealLinkName = (title: string) => `Открыть сделку «${title}»`;
const assignStageName = (title: string, stageName: string) =>
  `Назначить стадию «${stageName}» сделке «${title}»`;

test("current CRM routes open deals and assign an unstaged deal", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  const opportunitiesUrl = "**/api/workspace/opportunities";
  await page.route(opportunitiesUrl, async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as {
      opportunities: Array<Record<string, unknown> & { id: string }>;
    };
    await route.fulfill({
      response,
      json: {
        opportunities: payload.opportunities.map((opportunity) =>
          opportunity.id === STAGED_DEAL.id
            ? { ...opportunity, pipelineId: null }
            : opportunity
        )
      }
    });
  });

  await page.goto("/crm/deals");

  const kanbanLink = page.getByRole("link", { name: dealLinkName(STAGED_DEAL.title), exact: true });
  await expect(kanbanLink).toHaveAttribute("href", `/crm/deals/${STAGED_DEAL.id}`);
  await kanbanLink.focus();
  await expect(kanbanLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/crm/deals/${STAGED_DEAL.id}$`));
  await expect(page.getByRole("heading", { name: STAGED_DEAL.title, exact: true })).toBeVisible();
  const stageSelect = page.getByRole("combobox", { name: "Стадия", exact: true });
  await expect(stageSelect).toHaveValue(STAGED_DEAL.stageId);
  await expect(stageSelect).toBeEnabled();
  await expect(page.getByRole("button", { name: "Проверить", exact: true })).toBeEnabled();
  await expect(stageSelect.getByRole("option", { name: "Новая", exact: true })).toHaveCount(1);
  await expect(stageSelect.getByRole("option", { name: "Квалификация", exact: true })).toHaveCount(1);
  await expect(stageSelect.getByRole("option", { name: "Согласование", exact: true })).toHaveCount(1);
  await expect(stageSelect.getByRole("option", { name: "Готова к оценке", exact: true })).toHaveCount(1);

  await page.goto("/crm/deals");
  const listMode = page.getByRole("radio", { name: "Список", exact: true });
  await listMode.focus();
  await expect(listMode).toBeFocused();
  await page.keyboard.press("Space");
  await expect(listMode).toBeChecked();

  const listLink = page.getByRole("link", { name: dealLinkName(STAGED_DEAL.title), exact: true });
  await expect(listLink).toHaveAttribute("href", `/crm/deals/${STAGED_DEAL.id}`);
  await listLink.click();
  await expect(page).toHaveURL(new RegExp(`/crm/deals/${STAGED_DEAL.id}$`));
  await expect(page.getByRole("heading", { name: STAGED_DEAL.title, exact: true })).toBeVisible();

  await page.goto("/crm/deals");

  const unstagedLink = page.getByRole("link", { name: dealLinkName(UNSTAGED_DEAL.title), exact: true });
  await expect(unstagedLink).toHaveAttribute("href", `/crm/deals/${UNSTAGED_DEAL.id}`);
  await unstagedLink.click();
  await expect(page).toHaveURL(new RegExp(`/crm/deals/${UNSTAGED_DEAL.id}$`));
  await expect(page.getByText("Сначала назначьте сделке стадию.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Название", { exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Стадия", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toBeDisabled();
  const assignInListLink = page.getByRole("link", { name: "Назначить стадию в списке", exact: true });
  await assignInListLink.focus();
  await expect(assignInListLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/crm\/deals$/);

  const assignStage = page.getByRole("button", {
    name: assignStageName(UNSTAGED_DEAL.title, UNSTAGED_DEAL.stageName),
    exact: true
  });
  await expect(assignStage).toBeVisible();
  await assignStage.focus();
  await expect(assignStage).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Сделка перемещена в «${UNSTAGED_DEAL.stageName}»`, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: dealLinkName(UNSTAGED_DEAL.title), exact: true })).toBeFocused();

  await page.reload();
  await expect(assignStage).toHaveCount(0);
  await expect(page.getByRole("link", { name: dealLinkName(UNSTAGED_DEAL.title), exact: true })).toBeVisible();

  const opportunitiesResponse = await page.request.get("/api/workspace/opportunities");
  expect(opportunitiesResponse.status()).toBe(200);
  const opportunitiesPayload = await opportunitiesResponse.json();
  expect(
    opportunitiesPayload.opportunities.find((opportunity: { id: string }) => opportunity.id === UNSTAGED_DEAL.id)
  ).toMatchObject({
    stageId: UNSTAGED_DEAL.stageId,
    pipelineId: "tenant-alpha-pipeline-default"
  });
  await page.unroute(opportunitiesUrl);
});

test("CRM reader can inspect deals without any stage mutation affordance", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, {
    email: "crm-reader@kiss-pm.local",
    password: "crmreader12345"
  });

  const opportunitiesUrl = "**/api/workspace/opportunities";
  await page.route(opportunitiesUrl, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const payload = (await response.json()) as {
      opportunities: Array<Record<string, unknown> & { id: string }>;
    };
    await route.fulfill({
      response,
      json: {
        opportunities: payload.opportunities.map((opportunity) =>
          opportunity.id === UNSTAGED_DEAL.id
            ? { ...opportunity, pipelineId: null, stageId: null }
            : opportunity
        )
      }
    });
  });

  const uiMutationRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      (request.url().includes("/api/workspace/opportunities/") ||
        request.url().includes("/api/workspace/crm/"))
    ) {
      uiMutationRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  let stageMutationRequests = 0;
  const stageMutationUrl = "**/api/workspace/opportunities/*/stage";
  await page.route(stageMutationUrl, async (route) => {
    stageMutationRequests += 1;
    await route.continue();
  });

  await page.goto("/crm/deals");
  const stagedCard = page.locator(`[data-deal-id="${STAGED_DEAL.id}"]`);
  await expect(stagedCard).toBeVisible();
  await expect.poll(() => stagedCard.evaluate((card) => card.draggable)).toBe(false);
  await expect(page.getByRole("link", { name: dealLinkName(UNSTAGED_DEAL.title), exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: assignStageName(UNSTAGED_DEAL.title, UNSTAGED_DEAL.stageName),
      exact: true
    })
  ).toHaveCount(0);

  const listMode = page.getByRole("radio", { name: "Список", exact: true });
  await listMode.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("combobox", { name: `Стадия сделки «${STAGED_DEAL.title}»` })).toBeDisabled();
  const stagedRow = page.getByRole("row").filter({ hasText: STAGED_DEAL.title });
  await expect(stagedRow.getByRole("button", { name: "Воронка", exact: true })).toBeDisabled();

  await stagedRow.getByRole("link", { name: dealLinkName(STAGED_DEAL.title), exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/crm/deals/${STAGED_DEAL.id}$`));
  await expect(page.getByRole("heading", { name: STAGED_DEAL.title, exact: true })).toBeVisible();
  await expect(page.getByLabel("Название", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Проверить", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Активировать в проект", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Выиграна", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Проиграна", exact: true })).toBeDisabled();
  await expect(page.getByText("Лента доступна только для чтения.", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Написать комментарий…")).toHaveCount(0);
  expect(uiMutationRequests).toEqual([]);
  expect(stageMutationRequests).toBe(0);

  const beforeResponse = await page.request.get("/api/workspace/opportunities");
  expect(beforeResponse.status()).toBe(200);
  const beforePayload = (await beforeResponse.json()) as {
    opportunities: Array<{ id: string; stageId: string | null; pipelineId: string | null }>;
  };
  const before = beforePayload.opportunities.find((opportunity) => opportunity.id === UNSTAGED_DEAL.id);
  expect(before).toBeTruthy();
  const deniedResponse = await page.request.patch(
    `/api/workspace/opportunities/${UNSTAGED_DEAL.id}/stage`,
    {
      data: {
        stageId: before?.stageId === "deal-stage-qualified"
          ? "deal-stage-new"
          : "deal-stage-qualified"
      },
      headers: { "x-kiss-pm-action": "same-origin" }
    }
  );
  expect(deniedResponse.status()).toBe(403);
  const afterResponse = await page.request.get("/api/workspace/opportunities");
  expect(afterResponse.status()).toBe(200);
  const afterPayload = (await afterResponse.json()) as {
    opportunities: Array<{ id: string; stageId: string | null; pipelineId: string | null }>;
  };
  expect(afterPayload.opportunities.find((opportunity) => opportunity.id === UNSTAGED_DEAL.id)).toEqual(before);

  await page.unroute(stageMutationUrl);
  await page.unroute(opportunitiesUrl);
});

test("CRM deals route exposes honest loading, empty, error, permission, and partial states", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  const opportunitiesUrl = "**/api/workspace/opportunities";

  let releaseOpportunities!: () => void;
  const opportunitiesGate = new Promise<void>((resolve) => {
    releaseOpportunities = resolve;
  });
  await page.route(opportunitiesUrl, async (route) => {
    await opportunitiesGate;
    await route.continue();
  });
  await page.goto("/crm/deals");
  await expect(page.getByText("Загрузка сделок…", { exact: true })).toBeVisible();
  releaseOpportunities();
  await expect(page.getByRole("link", { name: dealLinkName(STAGED_DEAL.title), exact: true })).toBeVisible();
  await page.unroute(opportunitiesUrl);

  await page.route(opportunitiesUrl, async (route) => {
    await route.fulfill({ status: 500, json: { error: "test_failure" } });
  });
  await page.goto("/crm/deals");
  await expect(page.getByRole("alert").filter({ hasText: "Не удалось загрузить" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить", exact: true })).toBeVisible();
  await page.unroute(opportunitiesUrl);

  await page.route(opportunitiesUrl, async (route) => {
    await route.fulfill({ status: 403, json: { error: "forbidden" } });
  });
  await page.goto("/crm/deals");
  await expect(page.getByText("Доступ к сделкам ограничен", { exact: true })).toBeVisible();
  await page.unroute(opportunitiesUrl);

  await page.route(opportunitiesUrl, async (route) => {
    await route.fulfill({ status: 200, json: { opportunities: [] } });
  });
  await page.goto("/crm/deals");
  await expect(page.getByRole("link", { name: /Открыть сделку/ })).toHaveCount(0);
  await expect(page.getByText("перетащите сюда", { exact: true }).first()).toBeVisible();
  await page.unroute(opportunitiesUrl);

  const pipelinesUrl = "**/api/workspace/pipelines";
  await page.route(pipelinesUrl, async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as {
      pipelines: Array<Record<string, unknown> & { isDefault?: boolean }>;
    };
    await route.fulfill({
      response,
      json: {
        pipelines: payload.pipelines.map((pipeline) =>
          pipeline.isDefault ? { ...pipeline, status: "archived" } : pipeline
        )
      }
    });
  });
  await page.route(opportunitiesUrl, async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as {
      opportunities: Array<Record<string, unknown> & { id: string }>;
    };
    await route.fulfill({
      response,
      json: {
        opportunities: payload.opportunities.map((opportunity) =>
          opportunity.id === UNSTAGED_DEAL.id
            ? { ...opportunity, pipelineId: null, stageId: null }
            : opportunity
        )
      }
    });
  });
  await page.goto("/crm/deals");
  await expect(page.getByRole("link", { name: dealLinkName(UNSTAGED_DEAL.title), exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: assignStageName(UNSTAGED_DEAL.title, UNSTAGED_DEAL.stageName),
      exact: true
    })
  ).toHaveCount(0);
  await page.unroute(opportunitiesUrl);
  await page.unroute(pipelinesUrl);

  const usersUrl = "**/api/workspace/users";
  await page.route(usersUrl, async (route) => {
    await route.fulfill({ status: 403, json: { error: "forbidden" } });
  });
  await page.goto("/crm/deals");
  const listMode = page.getByRole("radio", { name: "Список", exact: true });
  await listMode.focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Участник dmin", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("user-alpha-admin", { exact: true })).toHaveCount(0);
});
