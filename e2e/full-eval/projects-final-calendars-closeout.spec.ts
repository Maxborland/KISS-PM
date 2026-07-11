import { expect, test, type Browser, type Page, type Response, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USERS = {
  A: { email: "admin@kiss-pm.local", password: "admin12345" },
  PR: { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" }
} as const;
const DISPOSABLE_DATABASE_ENV = "KISS_PM_E2E_DISPOSABLE_DATABASE";
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_ROOT = resolve(
  TEST_DIR,
  "../../.superloopy/evidence/project-final-29-2026-07-11/calendars"
);
const SCREENSHOT_ROOT = resolve(EVIDENCE_ROOT, "screenshots");
const RECEIPT_ROOT = resolve(EVIDENCE_ROOT, "receipts");
const MANIFEST_PATH = resolve(EVIDENCE_ROOT, "calendars-closeout-run.json");
const RUN_ID = process.env.PROJECT_FINAL_CALENDARS_RUN_ID ?? `project-final-calendars-${Date.now()}`;

type Role = keyof typeof USERS;
type CalendarException = {
  id: string;
  calendarId: string;
  resourceId: string | null;
  date: string;
  workingMinutes: number;
  reason: string | null;
};
type ReadModel = {
  project: { calendarId: string | null; plannedStart: string | null; plannedFinish: string | null };
  calendars: Array<{ id: string; workingWeekdays: number[]; workingMinutesPerDay: number }>;
  calendarExceptions: CalendarException[];
  calculatedPlan: { tasks: Array<{ calculatedStart: string | null; calculatedFinish: string | null }> };
  planVersion: number;
};
type WorkspaceUser = { id: string; name: string; positionId?: string | null; positionName?: string | null };
type CommandEnvelope = {
  command: { type: "calendar.exception.upsert"; payload: CalendarException };
  clientPlanVersion: number;
  idempotencyKey?: string;
};
type UiCommandEvidence = {
  previewEnvelope: CommandEnvelope;
  previewStatus: number;
  previewBody: unknown;
  applyEnvelope: CommandEnvelope;
  applyStatus: number;
  applyBody: unknown;
};
type Receipt = {
  scenarioId: "PROJ-089" | "PROJ-091" | "PROJ-093";
  role: Role;
  key: string;
  status: "pending" | "pass" | "fail";
  runId: string;
  generatedAt: string | null;
  assertions: string[];
  details: Record<string, unknown>;
  screenshots: string[];
  screenshotPathBase: "lane_root";
  error: string | null;
};

const targets = [
  { scenarioId: "PROJ-089", role: "A" },
  { scenarioId: "PROJ-089", role: "PR" },
  { scenarioId: "PROJ-091", role: "A" },
  { scenarioId: "PROJ-093", role: "A" },
  { scenarioId: "PROJ-093", role: "PR" }
] as const;
const receipts = new Map<string, Receipt>(
  targets.map(({ scenarioId, role }) => {
    const key = `${scenarioId}:${role}`;
    return [key, {
      scenarioId,
      role,
      key,
      status: "pending",
      runId: RUN_ID,
      generatedAt: null,
      assertions: [],
      details: {},
      screenshots: [],
      screenshotPathBase: "lane_root",
      error: null
    }];
  })
);
let projectId = "";

test.describe.serial("Projects final Calendars closeout: five literal matrix rows", () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_ROOT, { recursive: true });
    mkdirSync(RECEIPT_ROOT, { recursive: true });
    expect(targets).toHaveLength(5);
    expect(new Set(targets.map((target) => `${target.scenarioId}:${target.role}`)).size).toBe(5);
  });

  test("PROJ-089 and PROJ-093 traverse ADMIN and PLAN reader", async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    for (const role of ["A", "PR"] as const) {
      await withRole(browser, role, testInfo, async (page) => {
        try {
          if (role === "A") projectId = await selectCalendarFixture(page);
          expect(projectId, "ADMIN must select the shared calendar fixture first").not.toBe("");
          const model = await getReadModel(page, projectId);
          const users = await getWorkspaceUsers(page);
          const calendar = resolveCalendar(model);
          const expectedMonths = monthHorizon(model);

          await openCalendars(page, projectId);
          await expect(page.getByTestId("calendar-project-selector")).toBeVisible();
          for (const user of users) {
            await expect(page.getByTestId(`calendar-resource-${user.id}`)).toContainText(user.name);
            const expectedCount = model.calendarExceptions.filter(
              (item) =>
                item.calendarId === calendar.id &&
                item.resourceId === user.id &&
                item.workingMinutes < calendar.workingMinutesPerDay
            ).length;
            await expect(page.getByTestId(`calendar-resource-badge-${user.id}`)).toHaveText(
              expectedCount === 0 ? "наследует" : `правил · ${expectedCount}`
            );
          }
          const listShot = await screenshot(page, "PROJ-089", role, "live-directory");
          pass("PROJ-089", role, [
            "Project selector and every live workspace resource were rendered",
            "The selected project calendar matched project.calendarId",
            role === "PR"
              ? "PLAN reader received the read-only resource-exception view with persisted rule counts"
              : "ADMIN badges matched active live resource exceptions"
          ], {
            projectId,
            projectCalendarId: calendar.id,
            workspaceUsers: users,
            expectedActiveRuleCounts: Object.fromEntries(users.map((user) => [
              user.id,
              model.calendarExceptions.filter((item) =>
                item.calendarId === calendar.id &&
                item.resourceId === user.id &&
                item.workingMinutes < calendar.workingMinutesPerDay
              ).length
            ]))
          }, [listShot]);

          const monthLabel = page.getByTestId("calendar-month-label");
          const previous = page.getByRole("button", { name: "Предыдущий месяц" });
          const next = page.getByRole("button", { name: "Следующий месяц" });
          await expect(monthLabel).toHaveAttribute("data-month-key", expectedMonths[0]!);
          await expect(previous).toBeDisabled();
          const visited = [expectedMonths[0]!];
          for (const month of expectedMonths.slice(1)) {
            await next.click();
            await expect(monthLabel).toHaveAttribute("data-month-key", month);
            visited.push(month);
          }
          await expect(next).toBeDisabled();
          const navigationShot = await screenshot(page, "PROJ-093", role, "live-horizon-last-month");
          while (!(await previous.isDisabled())) await previous.click();
          await expect(monthLabel).toHaveAttribute("data-month-key", expectedMonths[0]!);
          pass("PROJ-093", role, [
            "Initial month equalled the earliest live project/calculated horizon month",
            "Next/previous navigation visited every horizon month without wrapping",
            "Both boundary controls were disabled at their respective limits"
          ], {
            projectId,
            projectStart: model.project.plannedStart,
            projectFinish: model.project.plannedFinish,
            expectedMonths,
            visitedMonths: visited,
            initialMonth: expectedMonths[0],
            finalMonth: expectedMonths.at(-1)
          }, [navigationShot]);
        } catch (error) {
          await failPendingRoleRows(page, role, error);
          throw error;
        }
      });
    }
  });

  test("PROJ-091 proves resource absence write, ID reuse, reload and cleanup", async ({ page }) => {
    test.skip(
      process.env[DISPOSABLE_DATABASE_ENV] !== "1",
      `PROJ-091 writes calendar exceptions; set ${DISPOSABLE_DATABASE_ENV}=1 only for a disposable database`
    );
    test.setTimeout(240_000);
    let created: CalendarException | null = null;
    try {
      await login(page, "A");
      expect(projectId, "read traversal must select the calendar fixture first").not.toBe("");
      const before = await getReadModel(page, projectId);
      const calendar = resolveCalendar(before);
      const users = await getWorkspaceUsers(page);
      const resource = users[0]!;
      const date = chooseWritableDate(before, resource.id);
      const activeHoliday = before.calendarExceptions.find(
        (item) =>
          item.calendarId === calendar.id &&
          item.resourceId === null &&
          item.workingMinutes < calendar.workingMinutesPerDay
      );
      expect(activeHoliday, "PROJ-091 requires a live project holiday edge").toBeTruthy();

      await openCalendars(page, projectId);
      await page.getByTestId(`calendar-resource-${resource.id}`).click();
      await navigateToMonth(page, activeHoliday!.date.slice(0, 7));
      await expect(calendarDay(page, activeHoliday!.date)).toBeDisabled();
      expect(await calendarDay(page, activeHoliday!.date).getAttribute("title")).toContain(activeHoliday!.reason);

      await navigateToMonth(page, date.slice(0, 7));
      const create = await runUiCommand(page, projectId, () => calendarDay(page, date).click());
      created = create.applyEnvelope.command.payload;
      expect(created.resourceId).toBe(resource.id);
      expect(created.calendarId).toBe(calendar.id);
      expect(created.date).toBe(date);
      expect(created.workingMinutes).toBe(0);
      expect(created.reason).toBe("Отсутствие");
      const createdReadback = exceptionSnapshot(await getReadModel(page, projectId), created.id);
      expect(createdReadback.exception).toEqual(created);

      await page.reload();
      await waitForCalendars(page);
      await page.getByTestId(`calendar-resource-${resource.id}`).click();
      await navigateToMonth(page, date.slice(0, 7));
      await expect(calendarDay(page, date)).toHaveAttribute("title", /Отсутствие|отсутствие/);
      const createReload = exceptionSnapshot(await getReadModel(page, projectId), created.id);
      expect(createReload.exception).toEqual(created);

      const remove = await runUiCommand(page, projectId, () => calendarDay(page, date).click());
      expect(remove.applyEnvelope.command.payload.id).toBe(created.id);
      expect(remove.applyEnvelope.command.payload.workingMinutes).toBe(calendar.workingMinutesPerDay);
      const removedReadback = exceptionSnapshot(await getReadModel(page, projectId), created.id);
      expect(removedReadback.active).toBe(false);
      await expect(calendarDay(page, date)).not.toHaveAttribute("title", /Отсутствие|отсутствие/);

      const reactivate = await runUiCommand(page, projectId, () => calendarDay(page, date).click());
      expect(reactivate.applyEnvelope.command.payload.id).toBe(created.id);
      expect(reactivate.applyEnvelope.command.payload.workingMinutes).toBe(0);
      const reactivatedReadback = exceptionSnapshot(await getReadModel(page, projectId), created.id);
      expect(reactivatedReadback.active).toBe(true);
      await expect(calendarDay(page, date)).toHaveAttribute("title", /Отсутствие|отсутствие/);
      const activeShot = await screenshot(page, "PROJ-091", "A", "reactivated-same-id");

      await page.reload();
      await waitForCalendars(page);
      await page.getByTestId(`calendar-resource-${resource.id}`).click();
      await navigateToMonth(page, date.slice(0, 7));
      await expect(calendarDay(page, date)).toHaveAttribute("title", /Отсутствие|отсутствие/);
      const reactivationReload = exceptionSnapshot(await getReadModel(page, projectId), created.id);
      expect(reactivationReload.active).toBe(true);

      const cleanup = await runUiCommand(page, projectId, () => calendarDay(page, date).click());
      expect(cleanup.applyEnvelope.command.payload.id).toBe(created.id);
      const cleanupReadback = exceptionSnapshot(await getReadModel(page, projectId), created.id);
      expect(cleanupReadback.active).toBe(false);
      await page.reload();
      await waitForCalendars(page);
      await page.getByTestId(`calendar-resource-${resource.id}`).click();
      await navigateToMonth(page, date.slice(0, 7));
      await expect(calendarDay(page, date)).not.toHaveAttribute("title", /Отсутствие|отсутствие/);
      const cleanupReload = exceptionSnapshot(await getReadModel(page, projectId), created.id);
      expect(cleanupReload.active).toBe(false);
      const cleanupShot = await screenshot(page, "PROJ-091", "A", "cleanup-reload");

      pass("PROJ-091", "A", [
        "A project holiday remained disabled from the resource view",
        "UI create passed preview/apply, API readback and browser reload",
        "Remove/reactivate reused the same exception ID",
        "Cleanup passed preview/apply, API readback and browser reload"
      ], {
        projectId,
        resource,
        date,
        protectedHoliday: activeHoliday,
        originalPlanVersion: before.planVersion,
        create,
        createdReadback,
        createReload,
        remove,
        removedReadback,
        reactivate,
        reactivatedReadback,
        reactivationReload,
        cleanup,
        cleanupReadback,
        cleanupReload
      }, [activeShot, cleanupShot]);
      created = null;
    } catch (error) {
      await fail("PROJ-091", "A", page, error);
      throw error;
    } finally {
      if (created) await fallbackCleanup(page, projectId, created);
    }
  });

  test.afterAll(() => {
    const rows = [...receipts.values()];
    writeFileSync(MANIFEST_PATH, JSON.stringify({
      schemaVersion: 1,
      runId: RUN_ID,
      generatedAt: new Date().toISOString(),
      targetRowCount: targets.length,
      statusCounts: Object.fromEntries(["pass", "fail", "pending"].map((status) => [
        status,
        rows.filter((row) => row.status === status).length
      ])),
      rows
    }, null, 2), "utf8");

    expect(rows.filter((row) => row.status !== "pass").map((row) => row.key)).toEqual([]);
    const hashes = new Map<string, string>();
    for (const row of rows) {
      expect(row.assertions.length, `${row.key} requires assertions`).toBeGreaterThan(0);
      expect(row.screenshots.length, `${row.key} requires screenshots`).toBeGreaterThan(0);
      expect(existsSync(receiptPath(row.scenarioId, row.role))).toBe(true);
      for (const relativePath of row.screenshots) {
        const path = resolve(EVIDENCE_ROOT, relativePath);
        expect(statSync(path).size).toBeGreaterThan(0);
        const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
        expect(hashes.has(hash), `${relativePath} duplicates ${hashes.get(hash)}`).toBe(false);
        hashes.set(hash, relativePath);
      }
    }
  });
});

async function withRole(browser: Browser, role: Role, testInfo: TestInfo, run: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ baseURL: String(testInfo.project.use.baseURL), locale: "ru-RU" });
  const page = await context.newPage();
  try {
    await login(page, role);
    await run(page);
  } finally {
    await context.close();
  }
}

async function login(page: Page, role: Role) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(USERS[role].email);
  await page.getByLabel("Пароль", { exact: true }).fill(USERS[role].password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

async function selectCalendarFixture(page: Page) {
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { projects: Array<{ id: string }> };
  const candidates: Array<{ id: string; score: number }> = [];
  for (const project of body.projects) {
    const model = await getReadModel(page, project.id);
    if (!model.project.calendarId) continue;
    const calendar = model.calendars.find((item) => item.id === model.project.calendarId);
    if (!calendar) continue;
    const months = monthHorizon(model);
    if (months.length < 2) continue;
    const holiday = model.calendarExceptions.some((item) =>
      item.calendarId === calendar.id && item.resourceId === null && item.workingMinutes < calendar.workingMinutesPerDay
    );
    candidates.push({ id: project.id, score: months.length * 10 + (holiday ? 1_000 : 0) });
  }
  candidates.sort((left, right) => right.score - left.score);
  expect(candidates[0], "calendar fixture with project.calendarId is required").toBeTruthy();
  return candidates[0]!.id;
}

async function openCalendars(page: Page, id: string) {
  await page.goto(`/projects/${encodeURIComponent(id)}/calendars`);
  await waitForCalendars(page);
}

async function waitForCalendars(page: Page) {
  await expect(page.getByRole("heading", { name: "Календари проекта и ресурсов" })).toBeVisible();
  await expect(page.getByTestId("calendar-month-grid")).toBeVisible();
}

async function getReadModel(page: Page, id: string): Promise<ReadModel> {
  const response = await page.request.get(`/api/workspace/projects/${encodeURIComponent(id)}/planning/read-model`);
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

async function getWorkspaceUsers(page: Page): Promise<WorkspaceUser[]> {
  const response = await page.request.get("/api/workspace/users");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { users: WorkspaceUser[] };
  expect(body.users.length).toBeGreaterThan(0);
  return body.users;
}

function resolveCalendar(model: ReadModel) {
  const calendar = model.calendars.find((item) => item.id === model.project.calendarId);
  expect(calendar, `project calendar ${model.project.calendarId ?? "null"} missing`).toBeTruthy();
  return calendar!;
}

function monthHorizon(model: ReadModel) {
  const dates = [
    model.project.plannedStart,
    model.project.plannedFinish,
    ...model.calculatedPlan.tasks.flatMap((task) => [task.calculatedStart, task.calculatedFinish])
  ].filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
  expect(dates.length, "live project/read-model horizon is required").toBeGreaterThan(0);
  const sorted = [...dates].sort();
  const first = new Date(`${sorted[0]!.slice(0, 7)}-01T00:00:00Z`);
  const last = new Date(`${sorted.at(-1)!.slice(0, 7)}-01T00:00:00Z`);
  const months: string[] = [];
  for (let cursor = first; cursor <= last; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    months.push(cursor.toISOString().slice(0, 7));
  }
  return months;
}

async function navigateToMonth(page: Page, target: string) {
  const label = page.getByTestId("calendar-month-label");
  for (let attempts = 0; attempts < 240; attempts += 1) {
    const current = await label.getAttribute("data-month-key");
    if (current === target) return;
    expect(current, "calendar month key missing").toBeTruthy();
    const direction = current! < target ? "Следующий месяц" : "Предыдущий месяц";
    const button = page.getByRole("button", { name: direction });
    await expect(button, `cannot navigate from ${current} to ${target}`).toBeEnabled();
    await button.click();
  }
  throw new Error(`calendar_navigation_limit:${target}`);
}

function chooseWritableDate(model: ReadModel, resourceId: string) {
  const calendar = resolveCalendar(model);
  const occupied = new Set(
    model.calendarExceptions
      .filter((item) => item.calendarId === calendar.id && (item.resourceId === null || item.resourceId === resourceId))
      .map((item) => item.date)
  );
  for (const month of monthHorizon(model)) {
    const cursor = new Date(`${month}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 7) === month) {
      const date = cursor.toISOString().slice(0, 10);
      if (calendar.workingWeekdays.includes(cursor.getUTCDay()) && !occupied.has(date)) return date;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  throw new Error("calendar_writable_date_missing");
}

function calendarDay(page: Page, date: string) {
  return page.locator(`[data-testid="calendar-day-${date}"][data-in-month="true"]`);
}

async function runUiCommand(page: Page, id: string, trigger: () => Promise<void>): Promise<UiCommandEvidence> {
  const previewPromise = waitForPlanningResponse(page, id, "preview-command");
  await trigger();
  const previewResponse = await previewPromise;
  expect(previewResponse.status()).toBe(200);
  const previewEnvelope = previewResponse.request().postDataJSON() as CommandEnvelope;
  const previewBody = await responseJson(previewResponse);

  const applyPromise = waitForPlanningResponse(page, id, "apply-command");
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Применить изменения", exact: true }).click();
  const applyResponse = await applyPromise;
  expect(applyResponse.status()).toBe(200);
  const applyEnvelope = applyResponse.request().postDataJSON() as CommandEnvelope;
  expect(applyEnvelope.command).toEqual(previewEnvelope.command);
  expect(applyEnvelope.clientPlanVersion).toBe(previewEnvelope.clientPlanVersion);
  expect(applyEnvelope.idempotencyKey).toMatch(/^planning-apply-[0-9a-f-]{36}$/i);
  return {
    previewEnvelope,
    previewStatus: previewResponse.status(),
    previewBody,
    applyEnvelope,
    applyStatus: applyResponse.status(),
    applyBody: await responseJson(applyResponse)
  };
}

function waitForPlanningResponse(page: Page, id: string, endpoint: "preview-command" | "apply-command") {
  const path = `/api/workspace/projects/${encodeURIComponent(id)}/planning/${endpoint}`;
  return page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === path
  );
}

async function responseJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function exceptionSnapshot(model: ReadModel, id: string) {
  const exception = model.calendarExceptions.find((item) => item.id === id) ?? null;
  const calendar = exception ? model.calendars.find((item) => item.id === exception.calendarId) : null;
  return {
    planVersion: model.planVersion,
    exception,
    active: Boolean(exception && calendar && exception.workingMinutes < calendar.workingMinutesPerDay)
  };
}

async function fallbackCleanup(page: Page, id: string, created: CalendarException) {
  const model = await getReadModel(page, id);
  const snapshot = exceptionSnapshot(model, created.id);
  if (!snapshot.active) return;
  const calendar = resolveCalendar(model);
  const response = await page.request.post(`/api/workspace/projects/${encodeURIComponent(id)}/planning/apply-command`, {
    data: {
      command: {
        type: "calendar.exception.upsert",
        payload: { ...created, workingMinutes: calendar.workingMinutesPerDay, reason: "" }
      },
      clientPlanVersion: model.planVersion,
      idempotencyKey: `calendar-cleanup-${Date.now()}`
    },
    headers: { Origin: new URL(page.url()).origin, "x-kiss-pm-action": "same-origin" }
  });
  expect(response.status()).toBe(200);
}

async function screenshot(page: Page, scenarioId: string, role: Role, state: string) {
  const name = `${scenarioId.toLowerCase()}-${role.toLowerCase()}-${state}.png`;
  const path = resolve(SCREENSHOT_ROOT, name);
  await page.screenshot({ path, fullPage: true });
  return `screenshots/${name}`;
}

function pass(
  scenarioId: Receipt["scenarioId"],
  role: Role,
  assertions: string[],
  details: Record<string, unknown>,
  screenshots: string[]
) {
  const row = receipt(scenarioId, role);
  Object.assign(row, { status: "pass", generatedAt: new Date().toISOString(), assertions, details, screenshots, error: null });
  writeReceipt(row);
}

async function failPendingRoleRows(page: Page, role: Role, error: unknown) {
  for (const scenarioId of ["PROJ-089", "PROJ-093"] as const) {
    if (receipt(scenarioId, role).status === "pending") await fail(scenarioId, role, page, error);
  }
}

async function fail(scenarioId: Receipt["scenarioId"], role: Role, page: Page, error: unknown) {
  const row = receipt(scenarioId, role);
  let screenshots: string[] = [];
  try {
    screenshots = [await screenshot(page, scenarioId, role, "BLOCKER")];
  } catch {
    // Receipt remains fail-closed even if the page cannot be captured.
  }
  Object.assign(row, {
    status: "fail",
    generatedAt: new Date().toISOString(),
    screenshots,
    error: error instanceof Error ? error.message : String(error)
  });
  writeReceipt(row);
}

function receipt(scenarioId: Receipt["scenarioId"], role: Role) {
  const row = receipts.get(`${scenarioId}:${role}`);
  if (!row) throw new Error(`calendar_receipt_missing:${scenarioId}:${role}`);
  return row;
}

function receiptPath(scenarioId: string, role: Role) {
  return resolve(RECEIPT_ROOT, `${scenarioId.toLowerCase()}-${role.toLowerCase()}.json`);
}

function writeReceipt(row: Receipt) {
  writeFileSync(receiptPath(row.scenarioId, row.role), JSON.stringify({ schemaVersion: 1, row }, null, 2), "utf8");
}
