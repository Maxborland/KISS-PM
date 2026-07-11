import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EVIDENCE = resolve(ROOT, ".superloopy/evidence/project-final-29-2026-07-11/commits");
const SHOTS = resolve(EVIDENCE, "screenshots");
const RECEIPTS = resolve(EVIDENCE, "receipts");
const RUN_ID = process.env.PROJECT_COMMITS_CLOSEOUT_RUN_ID ?? `project-commits-${Date.now()}`;
const USERS = {
  admin: { email: "admin@kiss-pm.local", password: "admin12345", matrixRole: "A" },
  planReader: { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345", matrixRole: "PR" }
} as const;

type Role = keyof typeof USERS;
type Scenario = "PROJ-105" | "PROJ-106" | "PROJ-108";
type Task = { id: string; wbsCode: string; title: string };
type Model = { planVersion: number; authored: { tasks: Task[] } };
type Event = {
  id: string;
  actionType: string;
  sourceWorkflow: string | null;
  commandType: string | null;
  afterState?: { planVersion?: number; changedTaskIds?: string[]; hasCompensatingCommands?: boolean };
  executionStatus: string | null;
  createdAt: string;
};
type Receipt = {
  scenarioId: Scenario;
  role: "A" | "PR";
  status: "pass";
  runId: string;
  generatedAt: string;
  assertions: string[];
  details: Record<string, unknown>;
  screenshots: string[];
  screenshotPathBase: "lane_root";
};

const TARGETS = (["PROJ-105", "PROJ-106", "PROJ-108"] as const).flatMap((scenarioId) =>
  (["admin", "planReader"] as const).map((role) => ({ scenarioId, role, key: `${scenarioId}:${USERS[role].matrixRole}` }))
);
const completed = new Map<string, Receipt>();
let populatedProjectId = "";
let emptyProjectId = "";

test.describe.configure({ mode: "serial" });
test.describe("Commits closeout: PROJ-105/106/108 for A and PR", () => {
  test.beforeEach(() => {
    test.skip(process.env.KISS_PM_E2E_DISPOSABLE_DATABASE !== "1", "Explicit disposable database marker required");
  });

  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
    mkdirSync(RECEIPTS, { recursive: true });
    expect(TARGETS).toHaveLength(6);
  });

  test("populated history, details, raw payload and task resolution", async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    for (const role of ["admin", "planReader"] as const) {
      await withRole(browser, role, testInfo, async (page) => {
        if (role === "admin") populatedProjectId = await populatedFixture(page);
        expect(populatedProjectId).not.toBe("");
        const [allEvents, model] = await Promise.all([eventsFor(page, populatedProjectId), modelFor(page, populatedProjectId)]);
        const events = planningEvents(allEvents);
        expect(events.length).toBeGreaterThan(1);

        await openCommits(page, populatedProjectId);
        const rows = page.getByTestId("commit-row");
        await expect(rows).toHaveCount(events.length);
        const apiVersions = events.map((event) => event.afterState!.planVersion!);
        const uiVersions = await rows.evaluateAll((items) => items.map((item) => Number((item as HTMLElement).dataset.planVersion)));
        expect(uiVersions).toEqual(apiVersions);
        expect(uiVersions.every((version, index) => index === 0 || version <= uiVersions[index - 1]!)).toBe(true);
        expect(new Set(uiVersions).size).toBe(uiVersions.length);
        await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
        if (role === "planReader") {
          await expect(page.getByRole("button", { name: "Откатить последний", exact: true })).toHaveCount(0);
          await expect(page.getByText("Откатить коммит", { exact: true })).toHaveCount(0);
        }
        const feedShot = await shot(page, "PROJ-105", role, "populated-sorted-history");
        record("PROJ-105", role, [
          "API and UI exposed exactly the same filtered planning-history rows",
          "Versions were numeric, unique and sorted descending",
          "Every row exposed timestamp, vN, summary, type and changed-task metadata",
          role === "planReader" ? "Plan Reader saw no manager-only revert action" : "Admin completed the manager traversal"
        ], { projectId: populatedProjectId, allEventCount: allEvents.length, apiVersions, uiVersions, events: events.map(snapshot) }, feedShot);

        const tasks = new Map(model.authored.tasks.map((task) => [task.id, task]));
        const resolved = events.find((event) => ids(event).some((id) => tasks.has(id)));
        const deleted = events.find((event) => ids(event).some((id) => !tasks.has(id)));
        expect(resolved, "requires a commit whose task still exists").toBeTruthy();

        await selectCommit(page, resolved!);
        const resolvedId = ids(resolved!).find((id) => tasks.has(id))!;
        const task = tasks.get(resolvedId)!;
        await expect(page.getByTestId("commit-details")).toContainText(`v${resolved!.afterState!.planVersion! - 1} → v${resolved!.afterState!.planVersion!}`);
        await expect(page.getByTestId("commit-details")).toContainText(resolved!.id);
        await expect(page.getByTestId("commit-task").filter({ hasText: task.title })).toHaveText(`${task.wbsCode} ${task.title}`);
        let selectedEvent = resolved!;
        let raw = await assertRaw(page, resolved!);
        let deletedTaskId: string | null = null;

        if (deleted) {
          await selectCommit(page, deleted);
          deletedTaskId = ids(deleted).find((id) => !tasks.has(id))!;
          await expect(page.getByTestId("commit-task").filter({ hasText: deletedTaskId })).toHaveText(deletedTaskId);
          selectedEvent = deleted;
          raw = await assertRaw(page, deleted);
        }
        const detailsShot = await shot(page, "PROJ-106", role, "details-raw-task-resolution");
        record("PROJ-106", role, [
          "Selecting a row updated version transition and auditEventId",
          "A current task resolved to WBS code plus title from the read-model",
          deleted ? "A deleted task fell back to its honest raw identifier" : "No deleted-task event existed in this fixture, so its optional fallback check was not applicable",
          "Raw payload disclosure matched the selected live API event metadata"
        ], { projectId: populatedProjectId, resolvedTask: { id: resolvedId, label: `${task.wbsCode} ${task.title}` }, deletedTaskId, apiEvent: snapshot(selectedEvent), uiRawPayload: raw }, detailsShot);
      });
    }
  });

  test("actual newly activated project has empty planning history", async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    for (const role of ["admin", "planReader"] as const) {
      await withRole(browser, role, testInfo, async (page) => {
        let creation: Record<string, unknown> | null = null;
        if (role === "admin") {
          const created = await createEmptyProject(page);
          emptyProjectId = created.projectId;
          creation = created.evidence;
        }
        expect(emptyProjectId).not.toBe("");
        const [allEvents, model] = await Promise.all([eventsFor(page, emptyProjectId), modelFor(page, emptyProjectId)]);
        expect(model.planVersion).toBe(1);
        expect(planningEvents(allEvents)).toEqual([]);

        await openCommits(page, emptyProjectId);
        await expect(page.getByTestId("commit-row")).toHaveCount(0);
        await expect(page.getByText("Лента (0)", { exact: true })).toBeVisible();
        await expect(page.getByText("История пуста.", { exact: true })).toBeVisible();
        await expect(page.getByText("Выберите коммит из ленты.", { exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByText("История пуста.", { exact: true })).toBeVisible();
        await expect(page.getByText("Выберите коммит из ленты.", { exact: true })).toBeVisible();
        const emptyShot = await shot(page, "PROJ-108", role, "actual-empty-history-reload");
        record("PROJ-108", role, [
          "Used a newly activated real project without request interception",
          "API readback proved the initial planVersion and no planning audit events",
          "Feed and details rendered their distinct empty states",
          "Both empty states survived a full reload"
        ], { projectId: emptyProjectId, planVersion: model.planVersion, allProjectEvents: allEvents.map(snapshot), creation }, emptyShot);
      });
    }
  });

  test.afterAll(() => {
    expect([...completed.keys()].sort()).toEqual(TARGETS.map((target) => target.key).sort());
    for (const target of TARGETS) {
      const path = receiptPath(target.scenarioId, target.role);
      expect(existsSync(path), `missing ${target.key}`).toBe(true);
      const receipt = JSON.parse(readFileSync(path, "utf8")) as Receipt;
      expect(receipt.status).toBe("pass");
      expect(receipt.assertions.length).toBeGreaterThanOrEqual(4);
      expect(receipt.screenshots).toHaveLength(1);
      const screenshot = resolve(EVIDENCE, receipt.screenshots[0]!);
      expect(existsSync(screenshot)).toBe(true);
      expect(statSync(screenshot).size).toBeGreaterThan(1_000);
    }
    writeJson(resolve(EVIDENCE, "commits-closeout-run.json"), {
      runId: RUN_ID,
      generatedAt: new Date().toISOString(),
      status: "pass",
      targetCount: TARGETS.length,
      receiptCount: completed.size,
      populatedProjectId,
      emptyProjectId,
      receipts: TARGETS.map((target) => relative(receiptPath(target.scenarioId, target.role)))
    });
  });
});

async function withRole(browser: Browser, role: Role, testInfo: TestInfo, run: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ baseURL: String(testInfo.project.use.baseURL), locale: "ru-RU" });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(USERS[role].email);
    await page.getByLabel("Пароль", { exact: true }).fill(USERS[role].password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await run(page);
  } finally {
    await context.close();
  }
}

async function populatedFixture(page: Page) {
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const projects = ((await response.json()) as { projects: Array<{ id: string }> }).projects;
  for (const project of projects) {
    const [events, model] = await Promise.all([eventsFor(page, project.id), modelFor(page, project.id)]);
    const planning = planningEvents(events);
    const taskIds = new Set(model.authored.tasks.map((task) => task.id));
    if (planning.length > 1 && planning.some((event) => ids(event).some((id) => taskIds.has(id)))) return project.id;
  }
  for (const project of projects) {
    const model = await modelFor(page, project.id);
    const task = model.authored.tasks[0];
    if (!task) continue;
    const marker = `${task.title} [commit closeout]`;
    await applyTaskTitle(page, project.id, task.id, marker);
    await applyTaskTitle(page, project.id, task.id, task.title);
    return project.id;
  }
  throw new Error("no_project_with_task_for_populated_history");
}

async function applyTaskTitle(page: Page, projectId: string, taskId: string, title: string) {
  const current = await modelFor(page, projectId);
  const response = await page.request.post(
    `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/apply-command`,
    {
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      data: {
        clientPlanVersion: current.planVersion,
        command: { type: "task.update_identity", payload: { taskId, title } }
      }
    }
  );
  expect(response.status(), `create populated commit fixture for ${projectId}`).toBe(200);
}
async function eventsFor(page: Page, projectId: string) {
  const response = await page.request.get(`/api/workspace/projects/${encodeURIComponent(projectId)}/planning/commits`);
  expect(response.status(), `audit history ${projectId}`).toBe(200);
  const events = ((await response.json()) as { auditEvents: Event[] }).auditEvents;
  for (const event of events) {
    expect(event).not.toHaveProperty("input");
    expect(event).not.toHaveProperty("beforeState");
    expect(event).not.toHaveProperty("permissionResult");
    expect(event).not.toHaveProperty("executionResult");
  }
  return events;
}

async function modelFor(page: Page, projectId: string) {
  const response = await page.request.get(`/api/workspace/projects/${encodeURIComponent(projectId)}/planning/read-model`);
  expect(response.status(), `read model ${projectId}`).toBe(200);
  return (await response.json()) as Model;
}

function planningEvents(events: Event[]) {
  return events.filter((event) => event.sourceWorkflow === "planning" && Number.isFinite(event.afterState?.planVersion)).sort((a, b) => b.afterState!.planVersion! - a.afterState!.planVersion!);
}

function ids(event: Event) { return event.afterState?.changedTaskIds ?? []; }

async function openCommits(page: Page, projectId: string) {
  await page.goto(`/projects/${encodeURIComponent(projectId)}/commits`);
  await expect(page.getByRole("heading", { name: "Коммиты плана", exact: true })).toBeVisible();
  await expect(page.getByTestId("commits-workspace")).toBeVisible();
}

async function selectCommit(page: Page, event: Event) {
  const row = page.locator(`[data-testid="commit-row"][data-audit-event-id="${event.id}"]`);
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "true");
}

async function assertRaw(page: Page, event: Event) {
  const details = page.getByTestId("commit-details").locator("details");
  if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
  const raw = JSON.parse((await page.getByTestId("commit-raw-payload").textContent()) ?? "null") as Record<string, unknown>;
  expect(raw).toMatchObject({ version: event.afterState!.planVersion, actionType: event.actionType, auditEventId: event.id, changedTaskIds: ids(event), at: event.createdAt });
  return raw;
}

async function createEmptyProject(page: Page) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const opportunityId = `opportunity-commits-${suffix}`;
  const projectId = `project-commits-${suffix}`;
  const headers = { "content-type": "application/json", "x-kiss-pm-action": "same-origin" };
  const created = await page.request.post("/api/workspace/opportunities", { headers, data: { id: opportunityId, clientId: "client-romashka", primaryContactId: "contact-irina", projectTypeId: "project-type-implementation", stageId: "deal-stage-new", title: `PROJ-108 empty history ${suffix}`, plannedStart: "2028-03-01", plannedFinish: "2028-03-31", contractValue: 100000, plannedHourlyRate: 2500, probability: 80, demand: [{ positionId: "position-engineer", requiredHours: 8 }] } });
  expect(created.status()).toBe(201);
  const feasibility = await page.request.post(`/api/workspace/opportunities/${encodeURIComponent(opportunityId)}/feasibility`, { headers: { "x-kiss-pm-action": "same-origin" } });
  expect(feasibility.status()).toBe(200);
  const activated = await page.request.post(`/api/workspace/opportunities/${encodeURIComponent(opportunityId)}/activate`, { headers, data: { id: projectId, acceptedRiskReason: "Full evaluation disposable empty commits history" } });
  expect(activated.status()).toBe(201);
  return { projectId, evidence: { opportunityId, createStatus: created.status(), feasibilityStatus: feasibility.status(), activateStatus: activated.status(), activatedBody: await activated.json() } };
}

async function shot(page: Page, scenario: Scenario, role: Role, state: string) {
  const path = resolve(SHOTS, `${scenario.toLowerCase()}-${role}-${state}.png`);
  await page.screenshot({ path, fullPage: true });
  expect(statSync(path).size).toBeGreaterThan(1_000);
  return relative(path);
}

function record(scenarioId: Scenario, role: Role, assertions: string[], details: Record<string, unknown>, screenshot: string) {
  const receipt: Receipt = { scenarioId, role: USERS[role].matrixRole, status: "pass", runId: RUN_ID, generatedAt: new Date().toISOString(), assertions, details, screenshots: [screenshot], screenshotPathBase: "lane_root" };
  const key = `${scenarioId}:${receipt.role}`;
  expect(completed.has(key), `duplicate ${key}`).toBe(false);
  completed.set(key, receipt);
  writeJson(receiptPath(scenarioId, role), receipt);
}

function receiptPath(scenario: Scenario, role: Role) { return resolve(RECEIPTS, `${scenario.toLowerCase()}-${role}.json`); }
function snapshot(event: Event) { return { id: event.id, actionType: event.actionType, sourceWorkflow: event.sourceWorkflow, commandType: event.commandType, planVersion: event.afterState?.planVersion ?? null, changedTaskIds: ids(event), executionStatus: event.executionStatus, createdAt: event.createdAt }; }
function relative(path: string) { return path.slice(EVIDENCE.length + 1).replaceAll("\\", "/"); }
function writeJson(path: string, value: unknown) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
