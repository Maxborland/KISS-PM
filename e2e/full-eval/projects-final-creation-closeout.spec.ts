import { expect, test, type Locator, type Page, type Response } from "@playwright/test";
import { createPostgresClient, type PostgresClient } from "@kiss-pm/persistence";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SPEC_DIR, "../..");
const EVIDENCE_ROOT = resolve(
  REPO_ROOT,
  ".superloopy/evidence/project-final-29-2026-07-11/creation"
);
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";
const RUN_ID = process.env.PROJECT_FINAL_CREATION_RUN_ID ?? "";
const RUN_TOKEN = RUN_ID.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "run";
const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const WRITE_HEADERS = {
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin"
};

type Opportunity = {
  id: string;
  tenantId: string;
  clientId: string;
  primaryContactId: string;
  projectTypeId: string;
  stageId: string;
  title: string;
  plannedStart: string;
  plannedFinish: string;
  contractValue: number;
  plannedHourlyRate: number;
  probability: number;
  status: string;
  demand: Array<{ positionId: string; requiredHours: number }>;
};

type Project = {
  id: string;
  tenantId: string;
  sourceOpportunityId: string;
  title: string;
  status: string;
};

test.describe("PROJ-116 A project creation closeout", () => {
  test("literal Admin UI creation, validation, races, readback, reload and cleanup", async ({ page }) => {
    expect(
      process.env.KISS_PM_E2E_DISPOSABLE_DATABASE,
      "project creation closeout may run only against an explicitly disposable database"
    ).toBe("1");
    expect(RUN_ID, "central runner must provide PROJECT_FINAL_CREATION_RUN_ID").not.toBe("");

    mkdirSync(EVIDENCE_ROOT, { recursive: true });
    const sql = createPostgresClient(DATABASE_URL);
    const opportunityIds = new Set<string>();
    const projectIds = new Set<string>();
    const screenshots: string[] = [];
    const details: Record<string, unknown> = {};
    let failure: unknown;

    try {
      const database = await sql`select current_database() as name`;
      expect(String(database[0]?.name ?? "")).toMatch(/test|e2e|disposable/i);
      await login(page);

      await page.goto("/projects");
      await expect(page.getByRole("heading", { name: "Проекты", exact: true })).toBeVisible();
      const createProjectLink = page.getByRole("link", { name: "Создать проект", exact: true });
      await expect(createProjectLink).toHaveAttribute("href", "/crm/deals");
      screenshots.push(await screenshot(page, "01-project-list-create-entry.png"));
      await createProjectLink.click();
      await page.waitForURL("**/crm/deals");

      await page.getByRole("button", { name: "Сделка", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Новая сделка" });
      await expect(dialog).toBeVisible();
      const submit = dialog.getByRole("button", { name: "Создать", exact: true });
      await expect(submit).toBeDisabled();
      screenshots.push(await screenshot(page, "02-required-fields-disabled.png"));

      const marker = `PROJ-116 ${RUN_ID}`;
      await dialog.getByLabel("Название", { exact: true }).fill(marker);
      await selectFirstEnabledOption(dialog.getByTestId("deal-client"));
      await selectFirstEnabledOption(dialog.getByTestId("deal-contact"));
      await selectFirstEnabledOption(dialog.getByTestId("deal-stage"));
      await dialog.getByLabel("Сумма, ₽", { exact: true }).fill("100000");
      await dialog.getByLabel("Ставка, ₽/ч", { exact: true }).fill("2500");
      await dialog.getByLabel("Старт", { exact: true }).fill("2028-01-10");
      await dialog.getByLabel("Финиш", { exact: true }).fill("2028-02-10");

      await dialog.getByLabel("Вероятность, %", { exact: true }).fill("101");
      await expect(submit).toBeDisabled();
      await dialog.getByLabel("Вероятность, %", { exact: true }).fill("80");
      await dialog.getByLabel("Финиш", { exact: true }).fill("2028-01-09");
      await expect(dialog.getByLabel("Финиш", { exact: true })).toHaveAttribute("aria-invalid", "true");
      await expect(submit).toBeDisabled();
      screenshots.push(await screenshot(page, "03-invalid-values-disabled.png"));
      await dialog.getByLabel("Финиш", { exact: true }).fill("2028-02-10");
      await expect(submit).toBeEnabled();

      const createResponsePromise = waitForMutation(page, "POST", "/api/workspace/opportunities");
      await submit.click();
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(201);
      const createBody = (await createResponse.json()) as { opportunity: Opportunity };
      const opportunity = createBody.opportunity;
      opportunityIds.add(opportunity.id);
      expect(opportunity.title).toBe(marker);
      await expect(page.getByText("Сделка создана", { exact: true })).toBeVisible();
      await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
      screenshots.push(await screenshot(page, "04-opportunity-created.png"));

      await page.goto(`/crm/deals/${encodeURIComponent(opportunity.id)}`);
      const activateButton = page.getByRole("button", { name: "Активировать в проект", exact: true });
      await expect(activateButton).toBeDisabled();
      const feasibilityResponsePromise = waitForMutation(
        page,
        "POST",
        `/api/workspace/opportunities/${opportunity.id}/feasibility`
      );
      await page.getByRole("button", { name: "Проверить", exact: true }).click();
      const feasibilityResponse = await feasibilityResponsePromise;
      expect(feasibilityResponse.status()).toBe(200);
      const feasibilityBody = await feasibilityResponse.json() as {
        opportunity: Opportunity;
        assessment: { status: string };
      };
      expect(["ok", "warning", "conflict"]).toContain(feasibilityBody.assessment.status);
      await expect(activateButton).toBeEnabled();
      if (feasibilityBody.assessment.status === "conflict") {
        await page.getByLabel("Обоснование риска (для активации при конфликте)", { exact: true })
          .fill("Disposable PROJ-116 full-evaluation race closeout");
      }
      screenshots.push(await screenshot(page, "05-feasibility-readback.png"));

      const activateResponsePromise = waitForMutation(
        page,
        "POST",
        `/api/workspace/opportunities/${opportunity.id}/activate`
      );
      await activateButton.click();
      const activateResponse = await activateResponsePromise;
      expect(activateResponse.status()).toBe(201);
      const activateBody = (await activateResponse.json()) as { project: Project };
      const project = activateBody.project;
      projectIds.add(project.id);
      await expect(page.getByText(/Создан проект/).first()).toBeVisible();

      const replay = await page.request.post(
        `/api/workspace/opportunities/${opportunity.id}/activate`,
        { headers: WRITE_HEADERS, data: { id: project.id } }
      );
      expect(replay.status()).toBe(409);
      expect(await replay.json()).toEqual({ error: "opportunity_not_activatable" });

      const invalidOpportunityId = `opportunity-proj116-invalid-${RUN_TOKEN}`;
      const invalidCreate = await page.request.post("/api/workspace/opportunities", {
        headers: WRITE_HEADERS,
        data: opportunityInput(opportunity, invalidOpportunityId, `${marker} invalid`, {
          plannedStart: "2028-03-10",
          plannedFinish: "2028-03-09"
        })
      });
      expect(invalidCreate.status()).toBe(400);
      expect(await invalidCreate.json()).toEqual({ error: "invalid_planned_dates" });

      const raceOpportunityId = `opportunity-proj116-race-${RUN_TOKEN}`;
      const raceInput = opportunityInput(opportunity, raceOpportunityId, `${marker} race`);
      opportunityIds.add(raceOpportunityId);
      const createRace = await Promise.all([
        page.request.post("/api/workspace/opportunities", { headers: WRITE_HEADERS, data: raceInput }),
        page.request.post("/api/workspace/opportunities", { headers: WRITE_HEADERS, data: raceInput })
      ]);
      expect(createRace.map((response) => response.status()).sort()).toEqual([201, 409]);
      const createRaceBodies = await Promise.all(createRace.map((response) => response.json()));
      expect(createRaceBodies).toContainEqual({ error: "opportunity_id_taken" });

      const raceFeasibility = await page.request.post(
        `/api/workspace/opportunities/${raceOpportunityId}/feasibility`,
        { headers: { "x-kiss-pm-action": "same-origin" } }
      );
      expect(raceFeasibility.status()).toBe(200);
      const raceAssessment = (await raceFeasibility.json()) as { assessment: { status: string } };
      expect(["ok", "warning", "conflict"]).toContain(raceAssessment.assessment.status);
      const raceProjectIds = [
        `project-proj116-race-a-${RUN_TOKEN}`,
        `project-proj116-race-b-${RUN_TOKEN}`
      ];
      raceProjectIds.forEach((id) => projectIds.add(id));

      const raceActivationData = raceAssessment.assessment.status === "conflict"
        ? { acceptedRiskReason: "Disposable PROJ-116 concurrent activation" }
        : {};
      const activationRace = await Promise.all(raceProjectIds.map((id) =>
        page.request.post(`/api/workspace/opportunities/${raceOpportunityId}/activate`, {
          headers: WRITE_HEADERS,
          data: { id, ...raceActivationData }
        })
      ));
      expect(activationRace.map((response) => response.status()).sort()).toEqual([201, 409]);
      const activationRaceBodies = await Promise.all(activationRace.map((response) => response.json()));
      const raceProject = (activationRaceBodies.find((body) => "project" in body) as { project: Project }).project;
      projectIds.add(raceProject.id);
      expect(activationRaceBodies).toContainEqual({ error: "opportunity_not_activatable" });

      await page.goto("/projects");
      const projectLink = page.getByRole("link", { name: marker, exact: true });
      await expect(projectLink).toBeVisible();
      await projectLink.click();
      await page.waitForURL(`**/projects/${project.id}`);
      await expect(page.getByRole("heading", { name: marker, exact: true })).toBeVisible();
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
      await expect(page.getByRole("heading", { name: marker, exact: true })).toBeVisible();
      screenshots.push(await screenshot(page, "06-project-navigation-reload.png"));

      const projectApi = await page.request.get(`/api/workspace/projects/${project.id}`);
      expect(projectApi.status()).toBe(200);
      const projectApiBody = await projectApi.json();
      const postgresBeforeCleanup = await postgresReadback(sql, opportunityIds, projectIds);
      expect(postgresBeforeCleanup.opportunities).toHaveLength(2);
      expect(postgresBeforeCleanup.projects).toHaveLength(2);
      expect(postgresBeforeCleanup.projects.every((row) => row.status === "active")).toBe(true);
      expect(postgresBeforeCleanup.auditEvents.length).toBeGreaterThanOrEqual(6);

      details.ui = {
        createOpportunityRequest: createResponse.request().postDataJSON(),
        createOpportunityResponse: createBody,
        feasibilityResponse: feasibilityBody,
        activationResponse: activateBody
      };
      details.validation = {
        requiredSubmitDisabled: true,
        probability101Disabled: true,
        finishBeforeStartDisabled: true,
        invalidApiResponse: { status: invalidCreate.status(), body: { error: "invalid_planned_dates" } }
      };
      details.duplicateAndRace = {
        activationReplay: { status: replay.status(), body: { error: "opportunity_not_activatable" } },
        opportunityCreateStatuses: createRace.map((response) => response.status()),
        opportunityCreateBodies: createRaceBodies,
        activationStatuses: activationRace.map((response) => response.status()),
        activationBodies: activationRaceBodies
      };
      details.readback = { projectApi: projectApiBody, postgres: postgresBeforeCleanup };

      const cleanup = await cleanupGeneratedRows(sql, opportunityIds, projectIds);
      expect(cleanup.remainingOpportunities).toBe(0);
      expect(cleanup.remainingProjects).toBe(0);
      expect(cleanup.remainingAuditEvents).toBe(0);
      details.cleanup = {
        ...cleanup,
        contract: "disposable database harness cleanup; product project archive/delete route does not exist"
      };

      writeReceipt({
        status: "pass",
        generatedAt: new Date().toISOString(),
        assertions: [
          "Admin reached CRM-backed creation from a non-empty project list",
          "Required, probability, and date validation blocked invalid UI submission",
          "UI create, feasibility, activation, project navigation, and reload succeeded",
          "Duplicate activation replay and concurrent create/activate converged to 409",
          "API and PostgreSQL readback matched two active projects",
          "Disposable harness cleanup removed only generated rows and audit events"
        ],
        screenshots,
        details,
        blocker: null
      });
    } catch (error) {
      failure = error;
      const blockerScreenshot = await screenshot(page, "PROJ-116-A-BLOCKER.png").catch(() => null);
      if (blockerScreenshot) screenshots.push(blockerScreenshot);
      const cleanup = await cleanupGeneratedRows(sql, opportunityIds, projectIds).catch((cleanupError) => ({
        cleanupError: errorMessage(cleanupError)
      }));
      writeReceipt({
        status: "fail",
        generatedAt: new Date().toISOString(),
        assertions: [],
        screenshots,
        details: { ...details, cleanup },
        blocker: errorMessage(error)
      });
    } finally {
      await sql.end({ timeout: 5 });
    }

    if (failure) throw failure;
  });
});

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Пароль", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

async function selectFirstEnabledOption(select: Locator) {
  await expect(select).toBeEnabled();
  const value = await select.evaluate((element: HTMLSelectElement) =>
    Array.from(element.options).find((option) => !option.disabled)?.value ?? ""
  );
  expect(value).not.toBe("");
  await select.selectOption(value);
}
function waitForMutation(page: Page, method: string, pathname: string): Promise<Response> {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === method && url.pathname === pathname;
  });
}

function opportunityInput(
  source: Opportunity,
  id: string,
  title: string,
  overrides: Partial<Pick<Opportunity, "plannedStart" | "plannedFinish">> = {}
) {
  return {
    id,
    clientId: source.clientId,
    primaryContactId: source.primaryContactId,
    projectTypeId: source.projectTypeId,
    stageId: source.stageId,
    title,
    plannedStart: overrides.plannedStart ?? "2028-04-10",
    plannedFinish: overrides.plannedFinish ?? "2028-05-10",
    contractValue: source.contractValue,
    plannedHourlyRate: source.plannedHourlyRate,
    probability: source.probability,
    demand: source.demand
  };
}

async function screenshot(page: Page, name: string) {
  const path = resolve(EVIDENCE_ROOT, name);
  await page.screenshot({ path, fullPage: true });
  return name;
}

async function postgresReadback(
  sql: PostgresClient,
  opportunityIds: Set<string>,
  projectIds: Set<string>
) {
  const opportunities = [];
  const projects = [];
  const auditEvents = [];
  for (const id of opportunityIds) {
    opportunities.push(...await sql`
      select id, tenant_id, title, status, feasibility_status
      from opportunities where id = ${id}
    `);
    auditEvents.push(...await sql`
      select id, action_type, source_entity, input
      from audit_events where source_entity ->> 'id' = ${id}
      order by created_at
    `);
  }
  for (const id of projectIds) {
    projects.push(...await sql`
      select id, tenant_id, source_opportunity_id, title, status, activated_at
      from projects where id = ${id}
    `);
    auditEvents.push(...await sql`
      select id, action_type, source_entity, input
      from audit_events where source_entity ->> 'id' = ${id}
      order by created_at
    `);
  }
  return { opportunities, projects, auditEvents };
}

async function cleanupGeneratedRows(
  sql: PostgresClient,
  opportunityIds: Set<string>,
  projectIds: Set<string>
) {
  for (const id of projectIds) {
    await sql`delete from audit_events where source_entity ->> 'id' = ${id}`;
    await sql`delete from projects where id = ${id}`;
  }
  for (const id of opportunityIds) {
    await sql`delete from audit_events where source_entity ->> 'id' = ${id}`;
    await sql`delete from opportunities where id = ${id}`;
  }
  const readback = await postgresReadback(sql, opportunityIds, projectIds);
  return {
    remainingOpportunities: readback.opportunities.length,
    remainingProjects: readback.projects.length,
    remainingAuditEvents: readback.auditEvents.length
  };
}

function writeReceipt(input: {
  status: "pass" | "fail";
  generatedAt: string;
  assertions: string[];
  screenshots: string[];
  details: Record<string, unknown>;
  blocker: string | null;
}) {
  writeFileSync(
    resolve(EVIDENCE_ROOT, "proj-116-a-receipt.json"),
    JSON.stringify({
      scenarioId: "PROJ-116",
      role: "A",
      runId: RUN_ID,
      ...input
    }, null, 2) + "\n",
    "utf8"
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}
