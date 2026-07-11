import { expect, test, type Browser, type Page, type Response } from "@playwright/test";
import { createPostgresClient, type PostgresClient } from "@kiss-pm/persistence";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SPEC_DIR, "../..");
const EVIDENCE_ROOT = resolve(
  REPO_ROOT,
  ".superloopy/evidence/project-resources-assignments-2026-07-11"
);
const UI_ORIGIN = "http://127.0.0.1:3180";
const API_PORT = "4192";
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";
const RUN_ID = process.env.PROJECT_ASSIGNMENTS_CLOSEOUT_RUN_ID ?? "";
const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const PLAN_READER = {
  email: "plan-reader-no-resources@kiss-pm.local",
  password: "reader12345"
};

type Role = "A" | "PR";
type TargetRow = { scenarioId: `PROJ-${number}`; role: Role };
type EvidenceStatus = "pass" | "blocker";
type EvidenceRow = TargetRow & {
  key: string;
  status: EvidenceStatus;
  runId: string;
  generatedAt: string;
  assertions: string[];
  details: Record<string, unknown>;
  screenshot: string | null;
  blocker: string | null;
};

type Task = {
  id: string;
  parentTaskId: string | null;
  wbsCode: string;
  title: string;
  durationMinutes: number | null;
  workMinutes: number | null;
};
type Assignment = {
  id: string;
  taskId: string;
  resourceId: string;
  role: string;
  unitsPermille: number;
  workMinutes: number | null;
  calendarId?: string | null;
};
type Allocation = {
  assignmentId: string;
  taskId: string;
  resourceId: string;
  date: string;
  workMinutes: number;
};
type ReadModel = {
  project: { id: string; plannedStart: string; plannedFinish: string };
  authored: {
    tasks: Task[];
    assignments: Assignment[];
    assignmentAllocations: Allocation[];
  };
  calculatedPlan: {
    tasks: Array<{
      id: string;
      calculatedStart: string | null;
      calculatedFinish: string | null;
    }>;
  };
  planVersion: number;
};
type WorkspaceUser = { id: string; name: string };
type Fixture = {
  projectId: string;
  task: Task;
  assignment: Assignment;
  replacementUser: WorkspaceUser;
  originalAllocations: Allocation[];
  createdEmptyTaskId: string | null;
};
type CommandEnvelope = {
  command: { type: string; payload: Record<string, unknown> };
  clientPlanVersion: number;
  idempotencyKey?: string;
};
type UiWriteResult = {
  preview: CommandEnvelope;
  apply: CommandEnvelope;
  after: ReadModel;
};

const TARGET_ROWS = [
  row("PROJ-074", "A"),
  row("PROJ-074", "PR"),
  row("PROJ-075", "A"),
  row("PROJ-075", "PR"),
  row("PROJ-077", "A"),
  row("PROJ-078", "A"),
  row("PROJ-079", "A"),
  row("PROJ-080", "A")
] as const satisfies readonly TargetRow[];

const ASSERTIONS: Record<string, string[]> = {
  "PROJ-074:A": [
    "Grid origin and month are derived from the live read-model",
    "Task totals equal working-role assignment totals",
    "Empty assignments, explicit curve marker, weekend cells and crosshair render"
  ],
  "PROJ-074:PR": [
    "Plan Reader sees the same persisted assignment grid and explicit curve",
    "Plan Reader grid has no assignment mutation controls"
  ],
  "PROJ-075:A": [
    "Admin month arrows stop disabled at both edges",
    "Week columns are Monday anchored and inspector survives navigation"
  ],
  "PROJ-075:PR": [
    "Plan Reader month and Day/Week navigation remain read-only",
    "Week columns are Monday anchored and inspector survives navigation"
  ],
  "PROJ-077:A": [
    "Inspector resource options come from the live users API",
    "Resource, role, clamped units and work blur-commit through preview/apply",
    "Every edit agrees in API, PostgreSQL and after reload"
  ],
  "PROJ-078:A": [
    "Even, front and back presets each preview/apply through the UI",
    "Each explicit allocation curve sums exactly to assignment work",
    "API, PostgreSQL, marker and reload agree"
  ],
  "PROJ-079:A": [
    "Unbalanced manual curve is rejected without a successful apply",
    "Cancel discards a draft without a planning write",
    "Balanced fractional edit preview/applies and survives API/DB/reload"
  ],
  "PROJ-080:A": [
    "A stale reset fails closed and reloads authoritative state",
    "Explicit retry preview/applies allocations.replace []",
    "Curve marker disappears in API, PostgreSQL and after reload"
  ]
};

const receipts = new Map<string, EvidenceRow>();

test.describe.serial("Projects assignments literal closeout: 8 role rows", () => {
  test.beforeAll(() => {
    mkdirSync(EVIDENCE_ROOT, { recursive: true });
    expect(TARGET_ROWS).toHaveLength(8);
    expect(new Set(TARGET_ROWS.map(targetKey)).size).toBe(8);
    expect(Object.keys(ASSERTIONS).sort()).toEqual(TARGET_ROWS.map(targetKey).sort());
  });

  test.beforeEach(async ({}, testInfo) => {
    expect(process.env.E2E_API_PORT, "closeout must use isolated API port 4192").toBe(API_PORT);
    expect(process.env.E2E_WEB_PORT, "closeout must use isolated UI port 3180").toBe("3180");
    expect(
      process.env.KISS_PM_E2E_DISPOSABLE_DATABASE,
      "mutating closeout requires an explicitly disposable seeded PostgreSQL database"
    ).toBe("1");
    expect(RUN_ID, "set PROJECT_ASSIGNMENTS_CLOSEOUT_RUN_ID for stable row receipts").toBeTruthy();
    expect(new URL(String(testInfo.project.use.baseURL)).origin).toBe(UI_ORIGIN);
    expect(testInfo.config.workers, "row receipt writer requires --workers=1").toBe(1);
  });

  test("A/PR assignments closeout with PostgreSQL receipts and cleanup", async ({
    page,
    browser
  }) => {
    test.setTimeout(8 * 60_000);
    page.setDefaultTimeout(12_000);

    const failures: Error[] = [];
    const sql = createPostgresClient(DATABASE_URL);
    let fixture: Fixture | null = null;
    let reader: Page | null = null;
    let cleanupCompleted = false;

    try {
      await login(page, ADMIN);
      const users = await getWorkspaceUsers(page);
      fixture = await findFixture(page, users);
      fixture = await ensureEmptyLeaf(page, fixture);
      await openAssignments(page, fixture.projectId);

      await runRow(page, row("PROJ-077", "A"), failures, async () => {
        const operations: Array<Record<string, unknown>> = [];
        const directoryResponsePromise = page.waitForResponse((response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname === "/api/workspace/users"
        );
        await page.reload();
        const directoryResponse = await directoryResponsePromise;
        expect(directoryResponse.status()).toBe(200);
        const directoryBody = (await directoryResponse.json()) as { users: WorkspaceUser[] };
        expect(directoryBody.users.map((user) => user.id).sort()).toEqual(
          users.map((user) => user.id).sort()
        );
        let model = await getReadModel(page, fixture!.projectId);
        await openInspector(page, model, fixture!.assignment.id);

        const resource = page.getByTestId("assignment-resource-select");
        await expect(resource.locator("option")).toHaveCount(users.length);
        const optionIds = await resource.locator("option").evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value)
        );
        expect(new Set(optionIds)).toEqual(new Set(users.map((user) => user.id)));

        let write = await uiWrite(page, fixture!.projectId, async () => {
          await resource.selectOption(fixture!.replacementUser.id);
        });
        expect(write.preview.command).toMatchObject({
          type: "assignment.upsert",
          payload: { id: fixture!.assignment.id, resourceId: fixture!.replacementUser.id }
        });
        await expectAssignmentEverywhere(sql, fixture!.projectId, fixture!.assignment.id, {
          resourceId: fixture!.replacementUser.id
        });
        operations.push(operationReceipt("resource", write));

        model = await reopenAfterReload(page, fixture!.projectId, fixture!.assignment.id);
        const current = assignmentById(model, fixture!.assignment.id);
        const nextRole = current.role === "executor" ? "co_executor" : "executor";
        write = await uiWrite(page, fixture!.projectId, async () => {
          await page.getByTestId("assignment-role-select").selectOption(nextRole);
        });
        expect(write.preview.command.payload.role).toBe(nextRole);
        await expectAssignmentEverywhere(sql, fixture!.projectId, fixture!.assignment.id, {
          role: nextRole
        });
        operations.push(operationReceipt("role", write));

        await reopenAfterReload(page, fixture!.projectId, fixture!.assignment.id);
        write = await uiWrite(page, fixture!.projectId, async () => {
          const units = page.getByTestId("assignment-units-input");
          await units.fill("0");
          await units.press("Tab");
        });
        expect(write.preview.command.payload.unitsPermille).toBe(10);
        await expectAssignmentEverywhere(sql, fixture!.projectId, fixture!.assignment.id, {
          unitsPermille: 10
        });
        operations.push(operationReceipt("units-clamped", write));

        model = await reopenAfterReload(page, fixture!.projectId, fixture!.assignment.id);
        const beforeWork = assignmentById(model, fixture!.assignment.id).workMinutes ?? 0;
        const nextWorkHours = Math.max(2, Math.round(beforeWork / 60) + 1);
        write = await uiWrite(page, fixture!.projectId, async () => {
          const work = page.getByTestId("assignment-work-input");
          await work.fill(String(nextWorkHours));
          await work.press("Tab");
        });
        expect(write.preview.command.payload.workMinutes).toBe(nextWorkHours * 60);
        await expectAssignmentEverywhere(sql, fixture!.projectId, fixture!.assignment.id, {
          workMinutes: nextWorkHours * 60
        });
        expect(allocationsFor(write.after, fixture!.assignment.id)).toEqual([]);
        operations.push(operationReceipt("work", write));

        await page.reload();
        const reloaded = await getReadModel(page, fixture!.projectId);
        expect(assignmentById(reloaded, fixture!.assignment.id).workMinutes).toBe(nextWorkHours * 60);
        return { liveUserIds: optionIds.sort(), operations };
      });

      await runRow(page, row("PROJ-078", "A"), failures, async () => {
        const presets: Array<Record<string, unknown>> = [];
        for (const label of ["Равномерно", "К началу", "К концу"] as const) {
          await reopenAfterReload(page, fixture!.projectId, fixture!.assignment.id);
          const write = await uiWrite(page, fixture!.projectId, async () => {
            await page.getByRole("button", { name: label, exact: true }).click();
          });
          expect(write.preview.command.type).toBe("assignment.allocations.replace");
          const assignment = assignmentById(write.after, fixture!.assignment.id);
          const allocations = allocationsFor(write.after, fixture!.assignment.id);
          expect(allocations.length, `${label} must create an explicit curve`).toBeGreaterThan(0);
          expect(sumAllocations(allocations)).toBe(assignment.workMinutes);
          expect(allocations.every((allocation) => isWeekday(allocation.date))).toBe(true);
          await expectAllocationsInPostgres(
            sql,
            fixture!.projectId,
            fixture!.assignment.id,
            allocations
          );
          await page.reload();
          await expect(assignmentButton(page, write.after, fixture!.assignment.id)).toContainText("кривая");
          presets.push({
            label,
            previewEnvelope: write.preview,
            applyEnvelope: write.apply,
            apiReadback: { planVersion: write.after.planVersion, allocations },
            reloadMarkerVisible: true
          });
        }
        return { presets };
      });

      await runRow(page, row("PROJ-074", "A"), failures, async () =>
        assertGridRow(page, sql, fixture!, true, true)
      );

      await runRow(page, row("PROJ-075", "A"), failures, async () =>
        assertTimelineNavigation(page, fixture!, true)
      );

      reader = await authenticatedPage(browser, PLAN_READER);
      const readerProjects = await getProjects(reader);
      expect(readerProjects).toContain(fixture.projectId);
      await openAssignments(reader, fixture.projectId);

      await runRow(reader, row("PROJ-074", "PR"), failures, async () =>
        assertGridRow(reader!, sql, fixture!, true, false)
      );

      await runRow(reader, row("PROJ-075", "PR"), failures, async () =>
        assertTimelineNavigation(reader!, fixture!, false)
      );

      await runRow(page, row("PROJ-079", "A"), failures, async () => {
        let model = await reopenAfterReload(page, fixture!.projectId, fixture!.assignment.id);
        const before = stableAssignmentState(model, fixture!.assignment.id);
        const inputs = curveInputs(page);
        expect(await inputs.count()).toBeGreaterThanOrEqual(2);
        const first = Number(await inputs.nth(0).inputValue());
        await inputs.nth(0).fill(String(first + 0.5));

        const rejected = await rejectedCurveWrite(page, fixture!.projectId, async () => {
          await page.getByRole("button", { name: "Применить кривую", exact: true }).click();
        });
        expect([200, 409, 422]).toContain(rejected.status);
        await expect(page.getByText(/Сумма .*должна|Сумма распределения должна/).first()).toBeVisible();
        expect(stableAssignmentState(await getReadModel(page, fixture!.projectId), fixture!.assignment.id)).toEqual(before);
        await expectStablePostgres(sql, fixture!.projectId, fixture!.assignment.id, before);

        const postsBeforeCancel = await countPlanningPosts(page, async () => {
          await page.getByRole("button", { name: "Отмена", exact: true }).click();
        });
        expect(postsBeforeCancel).toBe(0);

        model = await reopenAfterReload(page, fixture!.projectId, fixture!.assignment.id);
        const balancedInputs = curveInputs(page);
        const a = Number(await balancedInputs.nth(0).inputValue());
        const b = Number(await balancedInputs.nth(1).inputValue());
        expect(b).toBeGreaterThanOrEqual(0.5);
        const write = await uiWrite(page, fixture!.projectId, async () => {
          await balancedInputs.nth(0).fill(String(a + 0.5));
          await balancedInputs.nth(1).fill(String(b - 0.5));
          await page.getByRole("button", { name: "Применить кривую", exact: true }).click();
        });
        const allocations = allocationsFor(write.after, fixture!.assignment.id);
        expect(sumAllocations(allocations)).toBe(
          assignmentById(write.after, fixture!.assignment.id).workMinutes
        );
        const sentAllocations = write.preview.command.payload.allocations as Array<{
          workMinutes: number;
        }>;
        expect(sentAllocations[0]?.workMinutes).toBe(Math.round((a + 0.5) * 60));
        expect(sentAllocations[1]?.workMinutes).toBe(Math.round((b - 0.5) * 60));
        await expectAllocationsInPostgres(sql, fixture!.projectId, fixture!.assignment.id, allocations);
        await page.reload();
        await expect(assignmentButton(page, write.after, fixture!.assignment.id)).toContainText("кривая");
        return {
          rejected,
          successfulPreviewEnvelope: write.preview,
          successfulApplyEnvelope: write.apply,
          apiReadback: { planVersion: write.after.planVersion, allocations },
          postgresAllocationCount: allocations.length,
          reloadMarkerVisible: true
        };
      });

      await runRow(page, row("PROJ-080", "A"), failures, async () => {
        const staleModel = await reopenAfterReload(page, fixture!.projectId, fixture!.assignment.id);
        expect(allocationsFor(staleModel, fixture!.assignment.id).length).toBeGreaterThan(0);

        const sameAllocations = allocationsFor(staleModel, fixture!.assignment.id);
        const external = await directPreviewApply(page, fixture!.projectId, {
          type: "assignment.allocations.replace",
          payload: {
            assignmentId: fixture!.assignment.id,
            allocations: sameAllocations.map((allocation) => ({
              date: allocation.date,
              workMinutes: allocation.workMinutes
            }))
          }
        });
        expect(external.planVersion).toBe(staleModel.planVersion + 1);

        const stalePreviewPromise = waitForPlanningResponse(
          page,
          fixture!.projectId,
          "preview-command"
        );
        await page.getByRole("button", { name: "Сбросить", exact: true }).click();
        const stalePreview = await stalePreviewPromise;
        expect(stalePreview.status()).toBe(409);
        await expect(page.getByText(/Конфликт версий/).first()).toBeVisible();
        await expect.poll(async () => (await getReadModel(page, fixture!.projectId)).planVersion).toBe(
          external.planVersion
        );
        expect(
          allocationsFor(await getReadModel(page, fixture!.projectId), fixture!.assignment.id).length
        ).toBeGreaterThan(0);

        await openInspector(page, await getReadModel(page, fixture!.projectId), fixture!.assignment.id);
        const write = await uiWrite(page, fixture!.projectId, async () => {
          await page.getByRole("button", { name: "Сбросить", exact: true }).click();
        });
        expect(write.preview.command).toEqual({
          type: "assignment.allocations.replace",
          payload: { assignmentId: fixture!.assignment.id, allocations: [] }
        });
        expect(allocationsFor(write.after, fixture!.assignment.id)).toEqual([]);
        await expectAllocationsInPostgres(sql, fixture!.projectId, fixture!.assignment.id, []);
        await page.reload();
        await expect(assignmentButton(page, write.after, fixture!.assignment.id)).not.toContainText("кривая");
        return {
          stalePreview: {
            status: stalePreview.status(),
            requestEnvelope: stalePreview.request().postDataJSON(),
            responseBody: await stalePreview.text()
          },
          externalWrite: external.evidence,
          resetPreviewEnvelope: write.preview,
          resetApplyEnvelope: write.apply,
          apiReadback: {
            planVersion: write.after.planVersion,
            allocations: allocationsFor(write.after, fixture!.assignment.id)
          },
          postgresAllocationCount: 0,
          reloadMarkerVisible: false
        };
      });
    } catch (error) {
      failures.push(asError(error));
      for (const target of TARGET_ROWS) {
        if (!receipts.has(targetKey(target))) {
          await writeBlockerReceipt(page, target, error);
        }
      }
    } finally {
      if (reader) await reader.context().close();
      if (fixture) {
        try {
          const cleanup = await restoreFixture(page, sql, fixture);
          cleanupCompleted = true;
          for (const receipt of [...receipts.values()]) {
            if (receipt.status !== "pass") continue;
            writeReceipt({
              ...receipt,
              details: { ...receipt.details, cleanup }
            });
          }
        } catch (error) {
          failures.push(new Error(`cleanup_failed:${errorMessage(error)}`));
        }
      }
      await sql.end({ timeout: 5 });
    }

    const missing = TARGET_ROWS.filter((target) => !receipts.has(targetKey(target)));
    if (missing.length > 0) {
      failures.push(new Error(`missing_row_receipts:${missing.map(targetKey).join(",")}`));
    }
    const blockers = [...receipts.values()].filter((receipt) => receipt.status === "blocker");
    if (blockers.length > 0) {
      failures.push(new Error(`blocker_rows:${blockers.map((receipt) => receipt.key).join(",")}`));
    }
    writeFileSync(
      resolve(EVIDENCE_ROOT, "assignments-closeout-run.json"),
      JSON.stringify({
        schemaVersion: 1,
        runId: RUN_ID,
        generatedAt: new Date().toISOString(),
        targetRows: TARGET_ROWS.map(targetKey),
        receiptStatuses: Object.fromEntries(
          [...receipts].map(([key, receipt]) => [key, receipt.status])
        ),
        cleanupCompleted,
        failureCount: failures.length,
        status: failures.length === 0 && cleanupCompleted ? "pass" : "fail"
      }, null, 2) + "\n",
      "utf8"
    );
    if (failures.length > 0) throw new AggregateError(failures, "assignments_closeout_failed_closed");
  });
});

function row(scenarioId: TargetRow["scenarioId"], role: Role): TargetRow {
  return { scenarioId, role };
}

function targetKey(target: TargetRow) {
  return `${target.scenarioId}:${target.role}`;
}

async function runRow(
  page: Page,
  target: TargetRow,
  failures: Error[],
  execute: () => Promise<Record<string, unknown>>
) {
  const key = targetKey(target);
  expect(receipts.has(key), `row ${key} must execute exactly once`).toBe(false);
  const stem = `${target.scenarioId.toLowerCase()}-${target.role.toLowerCase()}`;
  const screenshotPath = resolve(EVIDENCE_ROOT, `${stem}.png`);
  try {
    const details = await execute();
    await page.screenshot({ path: screenshotPath, fullPage: true });
    writeReceipt({
      ...target,
      key,
      status: "pass",
      runId: RUN_ID,
      generatedAt: new Date().toISOString(),
      assertions: ASSERTIONS[key]!,
      details,
      screenshot: relativeEvidencePath(screenshotPath),
      blocker: null
    });
  } catch (error) {
    failures.push(new Error(`${key}:${errorMessage(error)}`));
    let screenshot: string | null = null;
    try {
      const blockerPath = resolve(EVIDENCE_ROOT, `${stem}-BLOCKER.png`);
      await page.screenshot({ path: blockerPath, fullPage: true });
      screenshot = relativeEvidencePath(blockerPath);
    } catch {
      screenshot = null;
    }
    writeReceipt({
      ...target,
      key,
      status: "blocker",
      runId: RUN_ID,
      generatedAt: new Date().toISOString(),
      assertions: ASSERTIONS[key]!,
      details: {},
      screenshot,
      blocker: errorMessage(error)
    });
  }
}

async function writeBlockerReceipt(page: Page, target: TargetRow, error: unknown) {
  const failures: Error[] = [];
  await runRow(page, target, failures, async () => {
    throw error;
  });
}

function writeReceipt(receipt: EvidenceRow) {
  receipts.set(receipt.key, receipt);
  const path = resolve(
    EVIDENCE_ROOT,
    `${receipt.scenarioId.toLowerCase()}-${receipt.role.toLowerCase()}.json`
  );
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

async function login(page: Page, credentials: typeof ADMIN) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Пароль", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

async function authenticatedPage(browser: Browser, credentials: typeof ADMIN) {
  const context = await browser.newContext({ baseURL: UI_ORIGIN, locale: "ru-RU" });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  await login(page, credentials);
  return page;
}

async function getProjects(page: Page) {
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { projects: Array<{ id: string }> };
  return body.projects.map((project) => project.id);
}

async function getWorkspaceUsers(page: Page): Promise<WorkspaceUser[]> {
  const response = await page.request.get("/api/workspace/users");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { users: WorkspaceUser[] };
  expect(body.users.length).toBeGreaterThan(1);
  return body.users;
}

async function findFixture(page: Page, users: WorkspaceUser[]): Promise<Fixture> {
  for (const projectId of await getProjects(page)) {
    const model = await getReadModel(page, projectId);
    const childIds = new Set(
      model.authored.tasks
        .map((task) => task.parentTaskId)
        .filter((id): id is string => id !== null)
    );
    const taskById = new Map(model.authored.tasks.map((task) => [task.id, task]));
    for (const assignment of model.authored.assignments) {
      const task = taskById.get(assignment.taskId);
      if (!task || childIds.has(task.id) || (assignment.workMinutes ?? 0) < 120) continue;
      const calculated = model.calculatedPlan.tasks.find((item) => item.id === task.id);
      if (!calculated?.calculatedStart || !calculated.calculatedFinish) continue;
      const used = new Set(
        model.authored.assignments
          .filter((item) => item.taskId === task.id)
          .map((item) => item.resourceId)
      );
      const replacementUser = users.find((user) => !used.has(user.id));
      if (!replacementUser) continue;
      return {
        projectId,
        task,
        assignment: structuredClone(assignment),
        replacementUser,
        originalAllocations: structuredClone(allocationsFor(model, assignment.id)),
        createdEmptyTaskId: null
      };
    }
  }
  throw new Error("assignment_fixture_unavailable:working_leaf_free_user_required");
}

async function ensureEmptyLeaf(page: Page, fixture: Fixture): Promise<Fixture> {
  const before = await getReadModel(page, fixture.projectId);
  const parentIds = new Set(before.authored.tasks.flatMap((task) =>
    task.parentTaskId ? [task.parentTaskId] : []
  ));
  const existing = before.authored.tasks.find((task) =>
    !parentIds.has(task.id) &&
    !before.authored.assignments.some((assignment) => assignment.taskId === task.id)
  );
  if (existing) return fixture;

  const taskId = `t-${randomUUID()}`;
  const created = await directPreviewApply(page, fixture.projectId, {
    type: "task.create",
    payload: {
      id: taskId,
      projectId: fixture.projectId,
      parentTaskId: null,
      title: `PROJ-074 empty ${RUN_ID}`,
      statusId: "todo",
      plannedStart: before.project.plannedStart,
      plannedFinish: before.project.plannedStart,
      durationMinutes: 480,
      workMinutes: 60,
      assignments: []
    }
  });
  expect(created.authored.tasks.some((task) => task.id === taskId)).toBe(true);
  expect(created.authored.assignments.some((assignment) => assignment.taskId === taskId)).toBe(false);
  await page.goto(`/projects/${fixture.projectId}/assignments`);
  await expect(page.getByTestId("assignments-grid")).toBeVisible();
  expect((await getReadModel(page, fixture.projectId)).authored.tasks.some((task) => task.id === taskId))
    .toBe(true);
  return { ...fixture, createdEmptyTaskId: taskId };
}

async function openAssignments(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}/assignments`);
  await expect(page.getByTestId("assignments-grid")).toBeVisible();
}

async function openInspector(page: Page, model: ReadModel, assignmentId: string) {
  await assignmentButton(page, model, assignmentId).click();
  await expect(page.getByText("Кривая распределения", { exact: true }).first()).toBeVisible();
}

async function reopenAfterReload(page: Page, projectId: string, assignmentId: string) {
  await page.reload();
  await expect(page.getByTestId("assignments-grid")).toBeVisible();
  const model = await getReadModel(page, projectId);
  await openInspector(page, model, assignmentId);
  return model;
}

function taskBlock(page: Page, wbsCode: string) {
  return page.getByText(wbsCode, { exact: true }).first().locator("..").locator("..");
}

function assignmentButton(page: Page, model: ReadModel, assignmentId: string) {
  assignmentById(model, assignmentId);
  return page.getByTestId(`assignment-row-${assignmentId}`);
}

async function uiWrite(
  page: Page,
  projectId: string,
  trigger: () => Promise<void>
): Promise<UiWriteResult> {
  const before = await getReadModel(page, projectId);
  const previewPromise = waitForPlanningResponse(page, projectId, "preview-command");
  await trigger();
  const previewResponse = await previewPromise;
  expect(previewResponse.status(), "UI preview must succeed").toBe(200);
  const preview = previewResponse.request().postDataJSON() as CommandEnvelope;
  expect(preview.clientPlanVersion).toBe(before.planVersion);

  const applyPromise = waitForPlanningResponse(page, projectId, "apply-command");
  await confirmPlanningPreview(page);
  const applyResponse = await applyPromise;
  expect(applyResponse.status(), "UI apply must succeed").toBe(200);
  const apply = applyResponse.request().postDataJSON() as CommandEnvelope;
  expect(apply.command).toEqual(preview.command);
  expect(apply.clientPlanVersion).toBe(preview.clientPlanVersion);
  expect(apply.idempotencyKey).toMatch(/^planning-apply-[0-9a-f-]{36}$/i);

  const after = await getReadModel(page, projectId);
  expect(after.planVersion).toBe(before.planVersion + 1);
  return { preview, apply, after };
}

async function rejectedCurveWrite(page: Page, projectId: string, trigger: () => Promise<void>) {
  const before = await getReadModel(page, projectId);
  const previewPromise = waitForPlanningResponse(page, projectId, "preview-command");
  await trigger();
  const preview = await previewPromise;
  if (preview.status() !== 200) {
    expect((await getReadModel(page, projectId)).planVersion).toBe(before.planVersion);
    return {
      endpoint: "preview-command",
      status: preview.status(),
      requestEnvelope: preview.request().postDataJSON(),
      responseBody: await preview.text()
    };
  }

  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  const applyButton = dialog.getByRole("button", { name: "Применить изменения", exact: true });
  if (await applyButton.isDisabled()) {
    let applyCount = 0;
    const applyPath = planningPath(projectId, "apply-command");
    const listener = (request: { method(): string; url(): string }) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === applyPath) {
        applyCount += 1;
      }
    };
    page.on("request", listener);
    try {
      await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => applyCount, { timeout: 500 }).toBe(0);
    } finally {
      page.off("request", listener);
    }
    expect((await getReadModel(page, projectId)).planVersion).toBe(before.planVersion);
    return {
      endpoint: "preview-command-validation",
      status: preview.status(),
      requestEnvelope: preview.request().postDataJSON(),
      responseBody: await preview.text(),
      applySent: false
    };
  }

  const applyPromise = waitForPlanningResponse(page, projectId, "apply-command");
  await confirmPlanningPreview(page);
  const apply = await applyPromise;
  expect(apply.status()).not.toBe(200);
  expect((await getReadModel(page, projectId)).planVersion).toBe(before.planVersion);
  return {
    endpoint: "apply-command",
    status: apply.status(),
    requestEnvelope: apply.request().postDataJSON(),
    responseBody: await apply.text()
  };
}

function waitForPlanningResponse(
  page: Page,
  projectId: string,
  endpoint: "preview-command" | "apply-command"
) {
  const path = planningPath(projectId, endpoint);
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === path
  );
}

async function confirmPlanningPreview(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Применить изменения", exact: true }).click();
}

async function directPreviewApply(
  page: Page,
  projectId: string,
  command: CommandEnvelope["command"]
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await getReadModel(page, projectId);
    const base = { command, clientPlanVersion: before.planVersion };
    const preview = await page.request.post(planningPath(projectId, "preview-command"), {
      headers: mutationHeaders(page),
      data: base
    });
    if (preview.status() === 409) continue;
    expect(preview.status()).toBe(200);
    const applyEnvelope = {
      ...base,
      idempotencyKey: "planning-apply-" + randomUUID()
    };
    const apply = await page.request.post(planningPath(projectId, "apply-command"), {
      headers: mutationHeaders(page),
      data: applyEnvelope
    });
    if (apply.status() === 409) continue;
    expect(apply.status()).toBe(200);
    const after = await getReadModel(page, projectId);
    expect(after.planVersion).toBe(before.planVersion + 1);
    return {
      ...after,
      evidence: {
        previewEnvelope: base,
        previewStatus: preview.status(),
        applyEnvelope,
        applyStatus: apply.status(),
        apiReadbackPlanVersion: after.planVersion
      }
    };
  }
  throw new Error(`direct_preview_apply_conflict:${command.type}`);
}

async function assertGridRow(
  page: Page,
  sql: PostgresClient,
  fixture: Fixture,
  expectExplicit: boolean,
  canManage: boolean
) {
  await openAssignments(page, fixture.projectId);
  const model = await getReadModel(page, fixture.projectId);
  const assignment = assignmentById(model, fixture.assignment.id);
  const task = taskById(model, assignment.taskId);
  const workingRoles = new Set(["executor", "co_executor"]);
  const assignedWork = model.authored.assignments
    .filter((item) => item.taskId === task.id && workingRoles.has(item.role))
    .reduce((sum, item) => sum + (item.workMinutes ?? 0), 0);
  const expectedTitle = `Труд задачи ${hours(task.workMinutes ?? 0)} ч · сумма назначений ${hours(assignedWork)} ч`;
  await expect(taskBlock(page, task.wbsCode).getByTitle(expectedTitle)).toBeVisible();
  await expect(page.getByText("нет исполнителей", { exact: true }).first()).toBeVisible();

  const assignmentRow = assignmentButton(page, model, assignment.id);
  if (expectExplicit) await expect(assignmentRow).toContainText("кривая");
  await assignmentRow.hover();
  await expect.poll(async () => (await assignmentRow.getAttribute("class")) ?? "").toContain("shadow-");
  await assignmentRow.click();
  await expect(page.getByText("Кривая распределения", { exact: true }).first()).toBeVisible();

  const allocations = allocationsFor(model, assignment.id);
  await expectAllocationsInPostgres(sql, fixture.projectId, assignment.id, allocations);
  const weekends = page.locator('span[style*="min-width: 30px"]').filter({
    hasText: /сб|вс/
  });
  expect(await weekends.count()).toBeGreaterThan(0);
  expect(
    await weekends.evaluateAll((nodes) =>
      nodes.every((node) => (node as HTMLElement).style.background.includes("color-mix"))
    )
  ).toBe(true);

  if (canManage) {
    await expect(page.getByTestId("assignment-units-input")).toBeVisible();
  } else {
    await expect(page.getByTestId("assignment-units-input")).toHaveCount(0);
    await expect(page.getByTitle("Добавить исполнителя")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Применить кривую", exact: true })).toHaveCount(0);
  }
  return {
    projectPlannedStart: model.project.plannedStart,
    projectPlannedFinish: model.project.plannedFinish,
    taskId: task.id,
    assignmentId: assignment.id,
    taskWorkMinutes: task.workMinutes,
    workingRoleAssignmentMinutes: assignedWork,
    explicitAllocationMinutes: sumAllocations(allocations),
    postgres: await postgresState(sql, fixture.projectId, assignment.id)
  };
}

async function assertTimelineNavigation(page: Page, fixture: Fixture, canManage: boolean) {
  await openAssignments(page, fixture.projectId);
  let model = await getReadModel(page, fixture.projectId);
  await openInspector(page, model, fixture.assignment.id);
  const inspectorHeading = page.getByText("Кривая распределения", { exact: true }).first();
  const previous = page.getByRole("button", { name: "Предыдущий месяц", exact: true });
  const next = page.getByRole("button", { name: "Следующий месяц", exact: true });
  let forwardMoves = 0;
  while (await next.isEnabled()) {
    await next.click();
    forwardMoves += 1;
    expect(forwardMoves, "month navigation must have a finite upper edge").toBeLessThan(36);
    await expect(inspectorHeading).toBeVisible();
  }
  await expect(next).toBeDisabled();
  let backwardMoves = 0;
  while (await previous.isEnabled()) {
    await previous.click();
    backwardMoves += 1;
    expect(backwardMoves, "month navigation must have a finite lower edge").toBeLessThan(36);
    await expect(inspectorHeading).toBeVisible();
  }
  await expect(previous).toBeDisabled();

  await page.getByRole("button", { name: "Неделя", exact: true }).click();
  const weekHeaders = page.locator('span[style*="min-width: 44px"]').filter({ has: page.locator("span") });
  const labels = await weekHeaders.evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const children = node.querySelectorAll(":scope > span");
        return children.length === 2
          ? { day: children[0]?.textContent?.trim() ?? "", month: children[1]?.textContent?.trim() ?? "" }
          : null;
      })
      .filter((value): value is { day: string; month: string } => value !== null)
  );
  expect(labels.length).toBeGreaterThan(0);
  const year = Number(model.project.plannedStart.slice(0, 4));
  for (const label of labels) {
    const month = monthNumber(label.month);
    expect(month, `unknown week month label:${label.month}`).toBeGreaterThan(0);
    expect(new Date(Date.UTC(year, month - 1, Number(label.day))).getUTCDay()).toBe(1);
  }
  await expect(inspectorHeading).toBeVisible();
  await page.getByRole("button", { name: "День", exact: true }).click();
  if (!canManage) {
    await expect(page.getByTitle("Добавить исполнителя")).toHaveCount(0);
  }
  model = await getReadModel(page, fixture.projectId);
  return {
    forwardMoves,
    backwardMoves,
    weekLabels: labels,
    planVersion: model.planVersion,
    inspectorStayedOpen: true,
    readOnly: !canManage
  };
}

async function restoreFixture(page: Page, sql: PostgresClient, fixture: Fixture) {
  await directPreviewApply(page, fixture.projectId, {
    type: "assignment.upsert",
    payload: assignmentPayload(fixture.assignment)
  });
  await directPreviewApply(page, fixture.projectId, {
    type: "assignment.allocations.replace",
    payload: {
      assignmentId: fixture.assignment.id,
      allocations: fixture.originalAllocations.map((allocation) => ({
        date: allocation.date,
        workMinutes: allocation.workMinutes
      }))
    }
  });

  const restored = await getReadModel(page, fixture.projectId);
  expect(assignmentById(restored, fixture.assignment.id)).toMatchObject(fixture.assignment);
  expect(normalizeAllocations(allocationsFor(restored, fixture.assignment.id))).toEqual(
    normalizeAllocations(fixture.originalAllocations)
  );
  await expectAssignmentEverywhere(sql, fixture.projectId, fixture.assignment.id, fixture.assignment);
  await expectAllocationsInPostgres(
    sql,
    fixture.projectId,
    fixture.assignment.id,
    fixture.originalAllocations
  );
  let restoredEmptyTaskRemoved = true;
  if (fixture.createdEmptyTaskId) {
    await directPreviewApply(page, fixture.projectId, {
      type: "task.delete_or_archive",
      payload: { taskId: fixture.createdEmptyTaskId, mode: "delete" }
    });
    expect((await getReadModel(page, fixture.projectId)).authored.tasks.some(
      (task) => task.id === fixture.createdEmptyTaskId
    )).toBe(false);
    const taskRows = await sql`
      select id from tasks
      where project_id = ${fixture.projectId} and id = ${fixture.createdEmptyTaskId}
    `;
    expect(taskRows).toEqual([]);
  }
  await page.reload();
  await expect(page.getByTestId("assignments-grid")).toBeVisible();
  const finalReadback = await getReadModel(page, fixture.projectId);
  if (fixture.createdEmptyTaskId) {
    restoredEmptyTaskRemoved = !finalReadback.authored.tasks.some(
      (task) => task.id === fixture.createdEmptyTaskId
    );
  }
  return {
    scope: "shared_fixture_run",
    coversRows: TARGET_ROWS.map(targetKey),
    assignmentId: fixture.assignment.id,
    apiReadback: {
      assignment: assignmentById(finalReadback, fixture.assignment.id),
      allocations: allocationsFor(finalReadback, fixture.assignment.id),
      planVersion: finalReadback.planVersion
    },
    postgresReadbackVerified: true,
    restoredEmptyTaskRemoved,
    reloadVerified: true
  };
}

async function getReadModel(page: Page, projectId: string): Promise<ReadModel> {
  const response = await page.request.get(
    `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/read-model`
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

async function postgresState(sql: PostgresClient, projectId: string, assignmentId: string) {
  const assignments = await sql`
    select id, task_id, resource_id, role, units_permille, work_minutes, calendar_id
    from task_assignments
    where project_id = ${projectId} and id = ${assignmentId}
  `;
  const allocations = await sql`
    select assignment_id, task_id, resource_id, date, work_minutes
    from task_assignment_allocations
    where project_id = ${projectId} and assignment_id = ${assignmentId}
    order by date
  `;
  expect(assignments).toHaveLength(1);
  return {
    assignment: {
      id: String(assignments[0]!.id),
      taskId: String(assignments[0]!.task_id),
      resourceId: String(assignments[0]!.resource_id),
      role: String(assignments[0]!.role),
      unitsPermille: Number(assignments[0]!.units_permille),
      workMinutes: assignments[0]!.work_minutes === null ? null : Number(assignments[0]!.work_minutes),
      calendarId: assignments[0]!.calendar_id === null ? null : String(assignments[0]!.calendar_id)
    },
    allocations: allocations.map((allocation) => ({
      assignmentId: String(allocation.assignment_id),
      taskId: String(allocation.task_id),
      resourceId: String(allocation.resource_id),
      date: String(allocation.date),
      workMinutes: Number(allocation.work_minutes)
    }))
  };
}

async function expectAssignmentEverywhere(
  sql: PostgresClient,
  projectId: string,
  assignmentId: string,
  expected: Partial<Assignment>
) {
  const state = await postgresState(sql, projectId, assignmentId);
  expect(state.assignment).toMatchObject(expected);
}

async function expectAllocationsInPostgres(
  sql: PostgresClient,
  projectId: string,
  assignmentId: string,
  expected: Allocation[]
) {
  const state = await postgresState(sql, projectId, assignmentId);
  expect(normalizeAllocations(state.allocations)).toEqual(normalizeAllocations(expected));
}

async function expectStablePostgres(
  sql: PostgresClient,
  projectId: string,
  assignmentId: string,
  expected: ReturnType<typeof stableAssignmentState>
) {
  const state = await postgresState(sql, projectId, assignmentId);
  expect(state.assignment).toMatchObject(expected.assignment);
  expect(normalizeAllocations(state.allocations)).toEqual(normalizeAllocations(expected.allocations));
}

function assignmentById(model: ReadModel, assignmentId: string) {
  const assignment = model.authored.assignments.find((item) => item.id === assignmentId);
  expect(assignment, `assignment ${assignmentId} must exist`).toBeTruthy();
  return assignment!;
}

function taskById(model: ReadModel, taskId: string) {
  const task = model.authored.tasks.find((item) => item.id === taskId);
  expect(task, `task ${taskId} must exist`).toBeTruthy();
  return task!;
}

function allocationsFor(model: ReadModel, assignmentId: string) {
  return model.authored.assignmentAllocations.filter(
    (allocation) => allocation.assignmentId === assignmentId
  );
}

function stableAssignmentState(model: ReadModel, assignmentId: string) {
  return {
    assignment: structuredClone(assignmentById(model, assignmentId)),
    allocations: normalizeAllocations(allocationsFor(model, assignmentId)),
    planVersion: model.planVersion
  };
}

function assignmentPayload(assignment: Assignment) {
  return {
    id: assignment.id,
    taskId: assignment.taskId,
    resourceId: assignment.resourceId,
    role: assignment.role,
    unitsPermille: assignment.unitsPermille,
    workMinutes: assignment.workMinutes ?? 0
  };
}

function normalizeAllocations(allocations: Allocation[]) {
  return allocations
    .map((allocation) => ({
      assignmentId: allocation.assignmentId,
      taskId: allocation.taskId,
      resourceId: allocation.resourceId,
      date: allocation.date,
      workMinutes: allocation.workMinutes
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function sumAllocations(allocations: Allocation[]) {
  return allocations.reduce((sum, allocation) => sum + allocation.workMinutes, 0);
}

function curveInputs(page: Page) {
  return page.getByTestId("assignment-inspector").locator('[data-testid^="curve-day-"]');
}

async function countPlanningPosts(page: Page, action: () => Promise<void>) {
  let count = 0;
  const listener = (request: { method(): string; url(): string }) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.includes("/planning/")) {
      count += 1;
    }
  };
  page.on("request", listener);
  try {
    await action();
    await expect.poll(() => count, { timeout: 500 }).toBe(0);
    return count;
  } finally {
    page.off("request", listener);
  }
}

function planningPath(projectId: string, endpoint: "preview-command" | "apply-command") {
  return `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/${endpoint}`;
}

function mutationHeaders(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "x-kiss-pm-action": "same-origin"
  };
}

function operationReceipt(name: string, write: UiWriteResult) {
  const assignmentId = String(write.apply.command.payload.id ?? "");
  return {
    name,
    previewEnvelope: write.preview,
    applyEnvelope: write.apply,
    apiReadback: {
      planVersion: write.after.planVersion,
      assignment: assignmentId ? assignmentById(write.after, assignmentId) : null
    },
    postgresReadbackVerified: true,
    reloadVerifiedBeforeNextOperation: true
  };
}

function hours(minutes: number) {
  return (Math.round((minutes / 60) * 10) / 10).toLocaleString("ru-RU");
}

function isWeekday(iso: string) {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

function monthNumber(label: string) {
  return ["", "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"].indexOf(label);
}

function relativeEvidencePath(path: string) {
  return path.slice(REPO_ROOT.length + 1).replaceAll("\\", "/");
}

function asError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
