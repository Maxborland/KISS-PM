import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loginToWorkspace } from "../smoke/smokeHelpers";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../.superloopy/evidence/project-final-29-2026-07-11/settings");
const SHOTS = resolve(ROOT, "screenshots");
const RUN_ID = process.env.PROJECT_FINAL_SETTINGS_RUN_ID ?? `settings-${Date.now()}`;
const USERS = {
  admin: { email: "admin@kiss-pm.local", password: "admin12345" },
  planReader: { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" }
} as const;
type Role = keyof typeof USERS;
type Receipt = {
  scenarioId: string; role: Role; status: "pass" | "fail"; runId: string;
  generatedAt: string; assertions: string[]; details: Record<string, unknown>; screenshots: string[];
};
const receipts: Receipt[] = [];

test.describe("final settings closeout: PROJ-111/113/114/115/128 A+PR", () => {
  test.beforeAll(() => {
    test.skip(process.env.KISS_PM_E2E_DISPOSABLE_DATABASE !== "1", "Disposable database marker is required");
    mkdirSync(SHOTS, { recursive: true });
  });

  test("literal role traversal plus custom WBS write/readback/reload/cleanup", async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await login(browser, "admin");
    const reader = await login(browser, "planReader");
    const fieldKey = `wbs_eval_${Date.now()}`;
    let fieldId = "";
    try {
      await openSettings(admin);
      await assertReadOnlySettings(admin, "admin");

      await admin.getByTestId("custom-field-add").click();
      await admin.getByTestId("custom-field-label").fill("Контроль WBS");
      await admin.getByTestId("custom-field-key").fill(fieldKey);
      await admin.getByTestId("custom-field-type").selectOption("number");
      await admin.getByTestId("custom-field-status").selectOption("active");
      await admin.getByTestId("custom-field-required").click();
      await admin.getByTestId("custom-field-open-preview").click();
      await expect(admin.getByTestId("custom-field-preview")).toContainText("Контроль WBS");

      const applyResponsePromise = admin.waitForResponse((response) =>
        response.url().endsWith("/api/workspace/config/custom-fields") && response.request().method() === "POST"
      );
      await admin.getByTestId("custom-field-apply").click();
      const applyResponse = await applyResponsePromise;
      expect(applyResponse.status()).toBe(201);
      const applyBody = await applyResponse.json() as { customField: { id: string; systemKey: string } };
      fieldId = applyBody.customField.id;
      await expect(admin.getByTestId(`custom-field-row-${fieldId}`)).toContainText("Контроль WBS");
      const readback = await listFields(admin);
      expect(readback.some((field) => field.id === fieldId && field.systemKey === fieldKey)).toBe(true);
      await admin.reload();
      await expect(admin.getByTestId(`custom-field-row-${fieldId}`)).toContainText("Контроль WBS");
      record("PROJ-128", "admin", [
        "Admin created a project custom WBS definition through visible preview and apply",
        "POST returned 201; API readback and browser reload preserved the exact definition"
      ], await shot(admin, "proj-128-admin"), { preview: { tenantLabel: "Контроль WBS", systemKey: fieldKey }, applyStatus: 201, applyBody, readback });

      await openSettings(reader);
      await assertReadOnlySettings(reader, "planReader");
      await expect(reader.getByTestId(`custom-field-row-${fieldId}`)).toContainText("Контроль WBS");
      await expect(reader.getByTestId("custom-fields-read-only")).toBeVisible();
      await expect(reader.getByTestId("custom-field-add")).toHaveCount(0);
      await expect(reader.getByRole("button", { name: /Изменить поле/ })).toHaveCount(0);
      const denied = await reader.request.post("/api/workspace/config/custom-fields", {
        headers: { "x-kiss-pm-action": "same-origin" },
        data: { systemKey: `${fieldKey}_denied`, tenantLabel: "Denied", targetEntity: "project", fieldType: "text", required: false, status: "draft" }
      });
      expect(denied.status()).toBe(403);
      record("PROJ-128", "planReader", [
        "Plan Reader loaded the same persisted WBS definition",
        "No create/edit/delete controls were rendered and direct POST was denied with 403"
      ], await shot(reader, "proj-128-plan-reader"), { readback: await listFields(reader), deniedStatus: denied.status() });

      const deletedId = fieldId;
      const deleteRace = await Promise.all([
        admin.request.delete(`/api/workspace/config/custom-fields/${deletedId}`, {
          headers: { "x-kiss-pm-action": "same-origin" }
        }),
        admin.request.delete(`/api/workspace/config/custom-fields/${deletedId}`, {
          headers: { "x-kiss-pm-action": "same-origin" }
        })
      ]);
      const deleteRaceStatuses = deleteRace.map((response) => response.status()).sort();
      expect(deleteRaceStatuses).toEqual([200, 404]);
      expect((await listFields(admin)).some((field) => field.id === deletedId)).toBe(false);
      for (const receipt of receipts.filter((item) => item.scenarioId === "PROJ-128")) {
        receipt.details = { ...receipt.details, deleteRaceStatuses };
      }
      fieldId = "";
    } finally {
      if (fieldId) {
        const cleanup = await admin.request.delete(`/api/workspace/config/custom-fields/${fieldId}`, {
          headers: { "x-kiss-pm-action": "same-origin" }
        });
        expect(cleanup.status()).toBe(200);
        expect((await listFields(admin)).some((field) => field.id === fieldId)).toBe(false);
      }
      await admin.context().close();
      await reader.context().close();
      writeReceipts();
    }
    expect(receipts).toHaveLength(10);
  });
});

async function login(browser: Browser, role: Role): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await loginToWorkspace(page, USERS[role]);
  return page;
}

async function openSettings(page: Page) {
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { projects: Array<{ id: string }> };
  expect(body.projects.length).toBeGreaterThan(0);
  const projectId = body.projects[0]!.id;
  await page.goto(`/projects/${encodeURIComponent(projectId)}/settings`);
  await expect(page.getByRole("heading", { name: "Настройки проекта" })).toBeVisible();
  await expect(page.getByTestId("custom-field-definitions")).toBeVisible();
  await expect(page.getByTestId("custom-fields-loading")).toHaveCount(0);
}

async function assertReadOnlySettings(page: Page, role: Role) {
  const checks = [
    ["PROJ-111", "Поля проекта", ["Старт проекта", "Финиш расчётный", "Источник", "Версия плана"]],
    ["PROJ-113", "Режим планирования", ["Авто", "Ручной", "задач"]],
    ["PROJ-114", "Права на проект", ["Сводка ролей и пользователей", "разделе «Доступ»"]],
    ["PROJ-115", "Интеграции", ["Bitrix24", "MS Project (MSPDI)"]]
  ] as const;
  for (const [scenario, heading, texts] of checks) {
    const section = page.getByRole("heading", { name: heading }).locator("..");
    for (const text of texts) await expect(section).toContainText(text);
    if (scenario === "PROJ-115") {
      await expect(section.getByRole("button", { name: "Подключить" })).toBeDisabled();
      await expect(section.getByRole("button", { name: "Импорт MSPDI" })).toBeDisabled();
    }
    record(scenario, role, [
      `${heading} rendered from the live project surface for ${role}`,
      scenario === "PROJ-115" ? "Unsupported integrations were visibly disabled without fake success" : "The surface exposed no fake write affordance for this read-only state"
    ], await shot(page, `${scenario.toLowerCase()}-${role}`), {});
  }
}

async function shot(page: Page, name: string) {
  const relative = `screenshots/${name}.png`;
  await page.screenshot({ path: resolve(ROOT, relative), fullPage: true });
  return relative;
}

function record(scenarioId: string, role: Role, assertions: string[], screenshot: string, details: Record<string, unknown>) {
  receipts.push({ scenarioId, role, status: "pass", runId: RUN_ID, generatedAt: new Date().toISOString(), assertions, details, screenshots: [screenshot] });
}

async function listFields(page: Page): Promise<Array<{ id: string; systemKey: string }>> {
  const response = await page.request.get("/api/workspace/config/custom-fields");
  expect(response.status()).toBe(200);
  return ((await response.json()) as { customFields: Array<{ id: string; systemKey: string }> }).customFields;
}

function writeReceipts() {
  for (const receipt of receipts) {
    writeFileSync(resolve(ROOT, `${receipt.scenarioId.toLowerCase()}-${receipt.role}.json`), JSON.stringify(receipt, null, 2) + "\n");
  }
  writeFileSync(resolve(ROOT, "settings-closeout-run.json"), JSON.stringify({
    runId: RUN_ID, generatedAt: new Date().toISOString(), status: receipts.length === 10 ? "pass" : "fail",
    expectedRows: 10, passedRows: receipts.length, cleanupCompleted: true,
    receipts: receipts.map((receipt) => `${receipt.scenarioId.toLowerCase()}-${receipt.role}.json`)
  }, null, 2) + "\n");
}
