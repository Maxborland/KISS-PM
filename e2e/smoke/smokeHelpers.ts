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

// Живой путь выхода: аватар в топ-баре (последняя кнопка в banner) открывает
// меню shell-user-menu.tsx с пунктом «Выйти» (role="menuitem").
export async function logoutThroughUserMenu(page: Page) {
  await page.getByRole("banner").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Выйти" }).click();
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

// Общий журней «перегруз → сценарий агентом → живой коммит»: селекторы и шаги в
// ОДНОМ месте — agent-scenario-commit и agent-first-evidence раньше дублировали их
// побайтово и дрейфовали бы при первой правке лейбла. onStage — точка съёмки
// артефактов (evidence-спек), не влияющая на сами шаги.
export async function runAgentOverloadResolutionJourney(
  page: Page,
  hooks: { onStage?: (stage: "thread" | "proposal" | "receipt" | "commit") => Promise<void> } = {}
) {
  await page.goto("/agent");
  const composer = page.getByRole("textbox", { name: "Сообщение Генри Гантту" });
  await expect(composer).toBeEnabled();
  await hooks.onStage?.("thread");

  await composer.fill("Разгрузи перегруженный ресурс");
  const executeResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/workspace/agent/execute") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Отправить" }).click();

  await expect(page.getByText(/Применить сценарий разрешения перегрузки/).first()).toBeVisible({ timeout: 15_000 });
  await hooks.onStage?.("proposal");

  await page.getByRole("button", { name: "Применить выбранное" }).click();
  const executeResponse = await executeResponsePromise;
  await expect(page.getByText("Результат: применено 1, отказано 0, конфликтов 0, ошибок 0.").last()).toBeVisible();
  await hooks.onStage?.("receipt");

  const receipt = page.getByTestId("agent-receipt").last();
  const commitLink = receipt.getByRole("link", { name: "Открыть в Коммитах" });
  await expect(commitLink).toBeVisible();
  const receiptText = (await receipt.textContent()) ?? "";
  await commitLink.click();
  await expect(page).toHaveURL(/\/commits\?commit=/);
  const selectedCommitRow = page.locator('[data-testid="commit-row"][aria-pressed="true"]');
  await hooks.onStage?.("commit");

  return { executeResponse, receiptText, selectedCommitRow };
}

// Компенсирующий откат последнего коммита через превью-гейт — возвращает план,
// делая журней повторяемым.
export async function revertLastPlanCommit(page: Page) {
  await page.getByRole("button", { name: "Откатить последний", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Применить изменения", exact: true }).click();
  await expect(page.getByText(/Откат применён компенсирующим коммитом/)).toBeVisible();
}
