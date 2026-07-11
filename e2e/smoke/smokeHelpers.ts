import { expect, type Locator, type Page } from "@playwright/test";

type SmokeCustomField = {
  id: string;
  systemKey: string;
  tenantLabel: string;
  targetEntity: string;
  fieldType: string;
  required: boolean;
  status: string;
};

type SmokeAuditEvent = {
  actionType: string;
  sourceEntity?: {
    type: string;
    id: string;
  };
};

export async function loginToWorkspace(
  page: Page,
  input: { email?: string; password: string }
) {
  await page.getByLabel("Email", { exact: true }).fill(input.email ?? "admin@kiss-pm.local");
  await page.locator('input[name="password"]').fill(input.password);
  const loginResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/login")
  );
  await page.getByRole("button", { name: "Войти" }).click();
  const response = await loginResponse;
  if (response.status() !== 200) {
    throw new Error(`Login failed with ${response.status()}: ${await response.text()}`);
  }
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const response = await fetch("/api/auth/me", { credentials: "same-origin" });
        return response.status;
      })
    )
    .toBe(200);
}

export async function logoutThroughUserMenu(page: Page) {
  const explicitMenuButton = page.getByRole("button", { name: "Открыть меню пользователя" });
  if (await explicitMenuButton.count()) {
    await explicitMenuButton.click();
  } else {
    await page.getByRole("banner").getByRole("button").last().click();
  }
  const logoutMenuItem = page.getByRole("menuitem", { name: "Выйти" });
  if (await logoutMenuItem.count()) {
    await logoutMenuItem.click();
  } else {
    await page.getByRole("button", { name: "Выйти из рабочего пространства" }).click();
  }
}

export async function getRequiredOpportunityCustomFieldValues(
  page: Page
): Promise<Record<string, string>> {
  const fields = await getRequiredOpportunityCustomFields(page);

  return Object.fromEntries(
    fields.map((field) => [field.id, getSmokeCustomFieldValue(field)])
  );
}

export async function deactivateStaleSmokeOpportunityFields(page: Page) {
  const fields = await getRequiredOpportunityCustomFields(page, {
    includeOptionalSmokeFields: true
  });

  const responses = await Promise.all(
    fields.map((field) =>
      page.request.patch(`/api/workspace/config/custom-fields/${field.id}`, {
        data: {
          systemKey: field.systemKey,
          tenantLabel: field.tenantLabel,
          targetEntity: field.targetEntity,
          fieldType: field.fieldType,
          required: false,
          status: "draft"
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    )
  );
  for (const response of responses) {
    expect(response.status()).toBe(200);
  }
}

export async function fillRequiredOpportunityCustomFields(
  page: Page,
  root: Locator
) {
  const fields = await getRequiredOpportunityCustomFields(page);

  for (const field of fields) {
    const input = root.locator(`input[name="customField:${field.id}"]`);
    await expect(input, `Required opportunity field ${field.tenantLabel}`).toHaveCount(1);
    await input.fill(getSmokeCustomFieldValue(field));
  }
}

export async function expectAuditEventForSource(
  page: Page,
  input: { actionType: string; sourceEntityId: string; sourceEntityType: string }
) {
  const response = await page.request.get("/api/tenant/current/audit-events");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { auditEvents: SmokeAuditEvent[] };

  expect(
    payload.auditEvents.some(
      (event) =>
        event.actionType === input.actionType &&
        event.sourceEntity?.type === input.sourceEntityType &&
        event.sourceEntity.id === input.sourceEntityId
    )
  ).toBe(true);
}

export async function expectAuditEventForCurrentRun(
  page: Page,
  input: { actionType: string; suffix: string }
) {
  const response = await page.request.get("/api/tenant/current/audit-events");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { auditEvents: SmokeAuditEvent[] };

  expect(
    payload.auditEvents.some(
      (event) =>
        event.actionType === input.actionType &&
        JSON.stringify(event).includes(input.suffix)
    )
  ).toBe(true);
}

async function getRequiredOpportunityCustomFields(
  page: Page,
  options: { includeOptionalSmokeFields?: boolean } = {}
): Promise<SmokeCustomField[]> {
  const response = await page.request.get("/api/workspace/config/custom-fields");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { customFields: SmokeCustomField[] };

  return payload.customFields.filter(
    (field) =>
      field.targetEntity === "opportunity" &&
      field.status === "active" &&
      (field.required ||
        (options.includeOptionalSmokeFields &&
          /^Приоритет проекта mpd/.test(field.tenantLabel)))
  );
}

function getSmokeCustomFieldValue(field: SmokeCustomField): string {
  if (field.fieldType === "number") return "1";
  if (field.fieldType === "date") return "2031-01-15";
  return "Smoke";
}

export async function expectAdminDashboardReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("complementary")).toBeVisible();
  await expect(page.getByRole("button", { name: "Экспорт" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Сортировка" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Создать сделку" })).toHaveCount(0);
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Сделки" })
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Проекты" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Последние события аудита" })).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Последние пользователи" }).locator(".checkbox-visual")
  ).toHaveCount(0);
}

export async function verifyResponsiveNavigation(page: Page) {
  await page.getByRole("button", { name: "Открыть меню пользователя" }).click();
  await expect(page.locator(".account-menu")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".account-menu")).toHaveCount(0);
  await expect(page.locator(".sidebar-account-menu .account-menu")).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Свернуть навигацию" }).click();
  await expect(page.getByRole("button", { name: "Пользователи" })).toHaveAttribute(
    "title",
    "Пользователи"
  );
  await expect(page.getByRole("button", { name: "Открыть профиль" })).toHaveCount(0);
  await page.getByRole("button", { name: "Открыть меню пользователя" }).click();
  await expect(page.locator(".account-menu")).toBeVisible();
  const compactAccountMenuBox = await page.locator(".sidebar-account-menu .account-menu").boundingBox();
  const compactSidebarBox = await page.locator(".sidebar").boundingBox();
  expect(compactAccountMenuBox?.x).toBeGreaterThanOrEqual(
    Math.floor((compactSidebarBox?.x ?? 0) + (compactSidebarBox?.width ?? 0))
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Пользователи" }).focus();
  const collapsedSidebarBox = await page.locator(".sidebar").boundingBox();
  expect(collapsedSidebarBox?.width).toBeLessThan(120);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await expect(page.locator(".sidebar")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Открыть навигацию" })).toBeFocused();
  await page.getByRole("button", { name: "Открыть навигацию" }).click();
  await expect(page.locator(".sidebar")).toBeInViewport();
  await expect(page.locator(".sidebar")).not.toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".sidebar")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".content-shell")).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Главная" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Открыть меню пользователя" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".account-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".account-menu")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toBeInViewport();
  await expect(page.locator(".content-shell")).toHaveAttribute("inert", "");
  await expect(
    page.getByRole("button", { name: "Открыть меню пользователя" })
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Главная" })).toBeFocused();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() => page.locator(".sidebar").evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await expect(page.locator(".sidebar")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await expect(page.locator(".content-shell")).not.toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Открыть навигацию" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Переход по разделам")).toBeFocused();
  await page.waitForTimeout(250);
  await expect(page.getByLabel("Переход по разделам")).toBeFocused();
  await page.getByRole("button", { name: "Открыть навигацию" }).click();
  await page.getByRole("button", { name: "Главная" }).click();
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await expect(page.getByRole("button", { name: "Открыть навигацию" })).toBeFocused();
  await page.getByRole("button", { name: "Открыть навигацию" }).click();
  await page.getByRole("button", { name: "Должности" }).click();
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await expect(page.getByRole("button", { name: "Открыть навигацию" })).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByLabel("Переход по разделам").fill("Должности");
  await page.getByLabel("Переход по разделам").press("Enter");
  await expect(page.getByRole("heading", { name: "Должности" }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/positions$/);
}
