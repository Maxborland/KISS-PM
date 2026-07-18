import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

test("новый владелец проходит первый рабочий цикл и получает честные квитанции", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const workspaceName = `Бюро E2E ${suffix}`;
  const ownerName = `Владелец ${suffix}`;
  const email = `owner-${suffix}@kiss-pm.local`;
  const clientName = `Клиент ${suffix}`;
  const contactName = `Контакт ${suffix}`;
  const dealTitle = `Первая сделка ${suffix}`;

  await page.goto("/register");
  await page.getByPlaceholder("Бюро Север").fill(workspaceName);
  await page.getByLabel("Имя", { exact: true }).fill(ownerName);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("#register-password").fill("owner12345");

  const registerResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/register")
  );
  await page.getByRole("button", { name: "Создать workspace" }).click();
  expect((await registerResponse).status()).toBe(201);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Настройка первого цикла" })).toBeVisible();
  await expect(page.getByText("Создать первую сделку", { exact: true })).toBeVisible();

  const [pipelines, stages, projectTypes] = await Promise.all([
    page.request.get("/api/workspace/crm/pipelines"),
    page.request.get("/api/workspace/deal-stages"),
    page.request.get("/api/workspace/project-types")
  ]);
  expect(pipelines.status()).toBe(200);
  expect(stages.status()).toBe(200);
  expect(projectTypes.status()).toBe(200);
  expect((await pipelines.json()).pipelines).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: "Основная воронка", isDefault: true })])
  );
  expect((await stages.json()).dealStages).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: "Новая" })])
  );
  expect((await projectTypes.json()).projectTypes).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: "Базовый проект" })])
  );

  await page.goto("/crm/deals?create=deal");
  const firstDealDialog = page.getByRole("dialog", { name: "Новая сделка" });
  await expect(firstDealDialog).toBeVisible();
  await expect(firstDealDialog.getByText(/Нет активных клиентов/)).toBeVisible();
  await firstDealDialog.getByRole("link", { name: "«Клиенты»" }).click();
  await expect(page).toHaveURL(/\/crm\/clients$/);

  await page.getByRole("button", { name: "Клиент", exact: true }).click();
  const clientDialog = page.getByRole("dialog", { name: "Новый клиент" });
  await clientDialog.getByLabel("Название", { exact: true }).fill(clientName);
  const clientResponse = page.waitForResponse((response) =>
    response.url().includes("/api/workspace/clients") && response.request().method() === "POST"
  );
  await clientDialog.getByRole("button", { name: "Создать", exact: true }).click();
  expect((await clientResponse).status()).toBe(201);
  await expect(clientDialog).toBeHidden();

  await page.goto("/crm/contacts");
  await page.getByRole("button", { name: "Контакт", exact: true }).click();
  const contactDialog = page.getByRole("dialog", { name: "Новый контакт" });
  await contactDialog.getByRole("combobox").selectOption({ index: 1 });
  await contactDialog.getByLabel("Имя", { exact: true }).fill(contactName);
  const contactResponse = page.waitForResponse((response) =>
    response.url().includes("/api/workspace/contacts") && response.request().method() === "POST"
  );
  await contactDialog.getByRole("button", { name: "Создать", exact: true }).click();
  expect((await contactResponse).status()).toBe(201);
  await expect(contactDialog).toBeHidden();

  await page.goto("/crm/deals?create=deal");
  const dealDialog = page.getByRole("dialog", { name: "Новая сделка" });
  await dealDialog.getByLabel("Название", { exact: true }).fill(dealTitle);
  await dealDialog.getByTestId("deal-client").selectOption({ label: clientName });
  await dealDialog.getByTestId("deal-contact").selectOption({ label: contactName });
  await dealDialog.getByTestId("deal-stage").selectOption({ label: "Новая" });
  await dealDialog.getByLabel("Сумма, ₽", { exact: true }).fill("120000");
  await dealDialog.getByLabel("Ставка, ₽/ч", { exact: true }).fill("3000");
  const dealResponse = page.waitForResponse((response) =>
    response.url().includes("/api/workspace/opportunities") && response.request().method() === "POST"
  );
  await dealDialog.getByRole("button", { name: "Создать", exact: true }).click();
  expect((await dealResponse).status()).toBe(201);
  await expect(dealDialog).toBeHidden();
  await expect(page.getByText(dealTitle, { exact: true }).first()).toBeVisible();

  await page.goto("/agent");
  const composer = page.getByLabel("Сообщение Генри Гантту");
  await expect(composer).toBeEnabled();
  await composer.fill("Проверь первый проект");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Проверь первый проект");
  // e2e-webServer включает скриптованный LLM-провайдер (KISS_PM_AGENT_SCRIPTED=1),
  // поэтому агент отвечает по-настоящему; у свежего владельца задач нет — честный
  // ответ «действий не найдено». Ветка «LLM-провайдер не настроен» покрыта
  // unit-тестами (503 agent_provider_not_configured) и Storybook-состоянием.
  await expect(page.getByRole("log")).toContainText("Скриптованный агент");
  await expect(composer).toBeFocused();

  await page.goto("/dashboard");
  const continueWork = page.getByText("Продолжить работу", { exact: true });
  await expect(continueWork).toBeVisible();
  await continueWork.click();
  await expect(page).toHaveURL(/\/agent$/);

  await page.goto("/profile");
  await expect(page.getByText(workspaceName, { exact: true })).toBeVisible();
  await expect(page.getByText("Владелец", { exact: true })).toBeVisible();
  await expect(page.getByText("Активен", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Запросить деактивацию" }).click();
  const deactivationResponse = page.waitForResponse((response) =>
    response.url().includes("/api/profile/deactivation-request")
  );
  await page.getByRole("button", { name: "Записать запрос" }).click();
  expect((await deactivationResponse).status()).toBe(202);
  await expect(page.getByRole("status")).toContainText("Администратор должен обработать его вручную");
  await expect(page.getByText("Активен", { exact: true })).toBeVisible();

  const auditResponse = await page.request.get("/api/tenant/current/audit-events");
  expect(auditResponse.status()).toBe(200);
  expect((await auditResponse.json()).auditEvents).toEqual(
    expect.arrayContaining([expect.objectContaining({ actionType: "profile.deactivation_requested" })])
  );

  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const profileViewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(profileViewport.scrollWidth).toBeLessThanOrEqual(profileViewport.clientWidth);

  await page.screenshot({
    path: ".superloopy/evidence/frontend/persona-journey-fixes/persona-owner-profile-390.png",
    fullPage: true
  });
});

test("CRM reader видит только разрешённые действия и честный read-only режим", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, {
    email: "crm-reader@kiss-pm.local",
    password: "crmreader12345"
  });

  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/workspace/")) {
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await page.goto("/crm/deals");
  await expect(
    page.getByText(
      "Канбан доступен только для просмотра; перенос выполняет пользователь с правом управления сделками.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(page.getByText(/Перетащите карточку между стадиями/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Сделка", exact: true })).toBeDisabled();

  await page.keyboard.press("Control+K");
  const palette = page.getByRole("dialog", { name: "Поиск и команды" });
  await expect(palette).toBeVisible();
  await expect(palette.getByText("Создать сделку", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  expect(mutations).toEqual([]);

  await page.setViewportSize({ width: 1280, height: 900 });
  const kanban = page.getByTestId("deal-kanban");
  await expect(kanban).toBeVisible();
  const kanbanViewport = await kanban.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(kanbanViewport.scrollWidth).toBeLessThanOrEqual(kanbanViewport.clientWidth);
  const overflowingCards = await page.locator("[data-deal-id]").evaluateAll((cards) =>
    cards.filter((card) => card.scrollWidth > card.clientWidth).length
  );
  expect(overflowingCards).toBe(0);
  await page.screenshot({
    path: ".superloopy/evidence/frontend/persona-journey-fixes/persona-reader-deals-1280.png",
    fullPage: true
  });
});
