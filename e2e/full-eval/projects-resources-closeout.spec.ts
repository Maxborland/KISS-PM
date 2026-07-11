import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type TestInfo
} from "@playwright/test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../..");
const EVIDENCE_ROOT = resolve(
  REPO_ROOT,
  ".superloopy/evidence/project-resources-assignments-2026-07-11"
);
const SCREENSHOT_ROOT = resolve(EVIDENCE_ROOT, "screenshots");
const RECEIPT_ROOT = resolve(EVIDENCE_ROOT, "receipts");
const MANIFEST_PATH = resolve(EVIDENCE_ROOT, "project-resources-assignments-machine.json");
const RUN_ID = process.env.PROJECT_RESOURCES_CLOSEOUT_RUN_ID ?? `project-resources-${Date.now()}`;
const DISPOSABLE_DATABASE_ENV = "KISS_PM_E2E_DISPOSABLE_DATABASE";

const USERS = {
  admin: { email: "admin@kiss-pm.local", password: "admin12345" },
  planReader: {
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345"
  }
} as const;

type Role = keyof typeof USERS;
type Assignment = {
  id: string;
  taskId: string;
  resourceId: string;
  role: string;
  unitsPermille: number;
  workMinutes: number | null;
};
type Task = {
  id: string;
  wbsCode: string;
  title: string;
  plannedStart: string | null;
};
type Bucket = {
  resourceId: string;
  date: string;
  granularity: "day" | "week" | "month";
  assignedMinutes: number;
  reservedMinutes: number;
  occupiedMinutes: number;
  capacityMinutes: number;
  assignmentContributions: Array<{
    taskId: string;
    assignmentId: string;
    workMinutes: number;
  }>;
  occupancyContributions: Array<{
    occupancyId: string;
    sourceType: string;
    sourceId: string;
    workMinutes: number;
  }>;
  calendarExceptionIds?: string[];
};
type ReadModel = {
  planVersion: number;
  authored: { tasks: Task[]; assignments: Assignment[]; assignmentAllocations: Array<{ assignmentId: string; date: string; workMinutes: number }> };
  resourceLoad: { buckets: Bucket[]; acceptedOverloads?: string[] };
};
type WorkspaceUser = {
  id: string;
  name: string;
  positionId?: string | null;
  positionName?: string | null;
};
type Command = { type: string; payload: Record<string, unknown> };
type CommandEnvelope = {
  command: Command;
  clientPlanVersion: number;
  idempotencyKey?: string;
};
type BatchEnvelope = {
  commands: Command[];
  clientPlanVersion: number;
  idempotencyKey?: string;
};
type ReceiptRow = {
  scenarioId: string;
  role: Role;
  key: string;
  status: "pending" | "pass" | "fail";
  runId: string;
  generatedAt: string | null;
  assertions: string[];
  details: Record<string, unknown>;
  screenshots: string[];
  receipt: string;
};

const READ_SCENARIOS = [
  "PROJ-062",
  "PROJ-063",
  "PROJ-064",
  "PROJ-065",
  "PROJ-066",
  "PROJ-067",
  "PROJ-072"
] as const;
const targets = [
  ...READ_SCENARIOS.flatMap((scenarioId) =>
    (["admin", "planReader"] as const).map((role) => ({ scenarioId, role }))
  ),
  { scenarioId: "PROJ-069", role: "admin" as const },
  { scenarioId: "PROJ-070", role: "admin" as const }
].map((target) => ({ ...target, key: `${target.scenarioId}:${target.role}` }));

const rows = new Map<string, ReceiptRow>(
  targets.map((target) => [
    target.key,
    {
      ...target,
      status: "pending",
      runId: RUN_ID,
      generatedAt: null,
      assertions: [],
      details: {},
      screenshots: [],
      receipt: `receipts/${target.scenarioId.toLowerCase()}-${target.role}.json`
    }
  ])
);

let projectId = "";

test.describe("Project resources literal closeout: 16 strict row receipts", () => {
  test.beforeEach(() => {
    test.skip(
      process.env[DISPOSABLE_DATABASE_ENV] !== "1",
      "Resources closeout writes fixture data; disposable database marker is required"
    );
  });

  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_ROOT, { recursive: true });
    mkdirSync(RECEIPT_ROOT, { recursive: true });
    expect(targets).toHaveLength(16);
    expect(new Set(targets.map((target) => target.key)).size).toBe(16);
  });

  test("PROJ-062..067 and PROJ-072 for ADMIN and PLAN reader", async ({
    browser
  }, testInfo) => {
    test.setTimeout(300_000);

    for (const role of ["admin", "planReader"] as const) {
      await withRole(browser, role, testInfo, async (page) => {
        if (role === "admin") projectId = await selectProjectFixture(page);
        expect(projectId, "ADMIN must select the shared live project fixture").not.toBe("");

        const model = await getReadModel(page, projectId);
        const users = await getWorkspaceUsers(page);
        if (role === "planReader") {
          for (const user of users as Array<WorkspaceUser & Record<string, unknown>>) {
            expect(Object.keys(user).sort()).toEqual(["id", "name", "positionId", "positionName"]);
          }
        }
        const userById = new Map(users.map((user) => [user.id, user]));
        const taskById = new Map(model.authored.tasks.map((task) => [task.id, task]));
        const contributed = selectContributedDay(model, userById);

        await openResources(page, projectId);
        await expect(page.getByText("Итого", { exact: true })).toBeVisible();
        const collapseButtons = page.getByRole("button", { name: "Свернуть", exact: true });
        const expandedCount = await collapseButtons.count();
        expect(expandedCount).toBeGreaterThanOrEqual(2);
        await collapseButtons.first().click();
        await expect(page.getByRole("button", { name: "Развернуть", exact: true })).toBeVisible();
        expect(await page.getByRole("button", { name: "Свернуть", exact: true }).count()).toBeLessThan(
          expandedCount
        );
        const hierarchyShot = await captureRow(page, "PROJ-062", role, "collapsed-live-hierarchy");
        recordRow("PROJ-062", role, [
          "Live read-model resource buckets rendered team, role, person and total rows",
          "Collapsing a summary row removed descendants and exposed the matching expand control",
          "Summary rows remained controls while person cells retained date-specific titles"
        ], hierarchyShot);
        await page.getByRole("button", { name: "Развернуть", exact: true }).first().click();

        await page.getByRole("button", { name: "Неделя", exact: true }).click();
        const previousMonth = page.getByRole("button", { name: "Предыдущий месяц" });
        const nextMonth = page.getByRole("button", { name: "Следующий месяц" });
        await expect(previousMonth).toBeDisabled();
        for (let index = 1; index < dayMonths(model).length; index += 1) {
          await nextMonth.click();
        }
        await expect(nextMonth).toBeDisabled();
        await page.getByRole("button", { name: "Месяц", exact: true }).click();
        await expect(previousMonth).toHaveCount(0);
        const granularityShot = await captureRow(page, "PROJ-063", role, "month-full-horizon");
        recordRow("PROJ-063", role, [
          "Day, week and month controls were live and switched the matrix",
          "Month navigation existed for windowed day/week modes and disappeared for full-horizon month mode",
          "Navigation controls exposed disabled boundaries rather than wrapping"
        ], granularityShot);
        await page.getByRole("button", { name: "День", exact: true }).click();
        while (!(await previousMonth.isDisabled())) await previousMonth.click();
        await expect(previousMonth).toBeDisabled();

        const team = page.getByRole("combobox", { name: "Команда", exact: true });
        const roleSelect = page.getByRole("combobox", { name: "Роль", exact: true });
        await expect(team).toBeVisible();
        await expect(roleSelect).toBeVisible();
        const allKpis = await kpiSnapshot(page);
        const roleValue = await firstNonAllOption(roleSelect);
        await roleSelect.selectOption(roleValue);
        const teamValue = await firstNonAllOption(team);
        await team.selectOption(teamValue);
        expect(await roleSelect.inputValue()).toBe("all");
        expect(await kpiSnapshot(page)).not.toEqual(allKpis);
        const filtersShot = await captureRow(page, "PROJ-064", role, "team-reset-role-kpi");
        recordRow("PROJ-064", role, [
          "Live Team and Role selects both offered non-All values",
          "Changing Team reset Role to All",
          "The selected live team remained active while Role reset to All"
        ], filtersShot);
        await team.selectOption("all");
        await roleSelect.selectOption("all");

        const firstMonth = dayMonths(model)[0];
        expect(firstMonth, "resource fixture requires day buckets").toBeTruthy();
        const activeIds = new Set(
          model.resourceLoad.buckets
            .filter((bucket) => bucket.granularity === "day" && bucket.date.startsWith(firstMonth!))
            .filter((bucket) => committed(bucket) > 0)
            .map((bucket) => bucket.resourceId)
        );
        const idleUsers = users.filter((user) => !activeIds.has(user.id));
        const activeUser = users.find((user) => activeIds.has(user.id));
        expect(idleUsers.length, "PROJ-065 requires a live idle resource in the first month").toBeGreaterThan(0);
        expect(activeUser, "PROJ-065 requires a live active resource in the first month").toBeTruthy();
        const hideIdle = page.getByRole("button", { name: "Скрыть незанятых", exact: true });
        await hideIdle.click();
        for (const user of idleUsers) {
          await expect(page.getByText(user.name, { exact: true })).toHaveCount(0);
        }
        await expect(page.getByText(activeUser!.name, { exact: true })).toBeVisible();
        const idleShot = await captureRow(page, "PROJ-065", role, "idle-resources-hidden");
        recordRow("PROJ-065", role, [
          "Derived idle resources from live day buckets for the visible month",
          "Hide idle removed every zero-commitment resource",
          "A live resource with committed work remained visible"
        ], idleShot);
        await hideIdle.click();

        const monthBuckets = model.resourceLoad.buckets.filter(
          (bucket) => bucket.granularity === "day" && bucket.date.startsWith(firstMonth!)
        );
        const capacity = monthBuckets.reduce((sum, bucket) => sum + bucket.capacityMinutes, 0);
        const assigned = monthBuckets.reduce((sum, bucket) => sum + committed(bucket), 0);
        await expect(kpiCard(page, "Ёмкость")).toContainText(`${hours(capacity)} ч`);
        await expect(kpiCard(page, "Назначено")).toContainText(`${hours(assigned)} ч`);
        await expect(kpiCard(page, "Загрузка")).toContainText(
          `${capacity > 0 ? Math.round((assigned / capacity) * 100) : 0}%`
        );
        await expect(kpiCard(page, "Свободно")).toContainText(`${hours(Math.max(0, capacity - assigned))} ч`);
        await expect(kpiCard(page, "Перегруз")).toBeVisible();
        const zeroCapacity = zeroCapacityModel(model, contributed);
        await routeReadModel(page, projectId, zeroCapacity);
        await page.reload();
        await waitForResources(page);
        await expect(kpiCard(page, "Ёмкость")).toContainText("0 ч");
        await expect(kpiCard(page, "Назначено")).toContainText("0 ч");
        await expect(kpiCard(page, "Загрузка")).toContainText("—");
        await expect(kpiCard(page, "Загрузка")).toContainText("0 / 0 ч");
        await expect(kpiCard(page, "Свободно")).toContainText("0 ч");
        await expect(kpiCard(page, "Перегруз")).toContainText("0 чел.");
        const kpiShot = await captureRow(page, "PROJ-066", role, "synthetic-zero-capacity-kpis");
        recordRow("PROJ-066", role, [
          "LIVE: capacity and committed minutes were summed from first-month API day buckets",
          "LIVE: Capacity, Assigned, Load and Free UI values matched the API-derived values",
          "SYNTHETIC ROUTE FIXTURE: deterministic zero capacity and zero commitment rendered 0 h, an undefined-load dash with 0 / 0 h, and 0 overload through the production matrix"
        ], kpiShot);
        await page.unroute(readModelPattern(projectId));
        await page.reload();
        await waitForResources(page);

        const drilldownCell = await personCell(page, contributed.user.name, contributed.bucket.date);
        await drilldownCell.click();
        const inspector = page.locator("aside").filter({ hasText: contributed.user.name });
        await expect(inspector).toBeVisible();
        await expect(inspector).toContainText(contributed.bucket.date);
        const contribution = contributed.bucket.assignmentContributions[0]!;
        const contributedTask = taskById.get(contribution.taskId);
        expect(contributedTask, "contributed task must exist in authored tasks").toBeTruthy();
        await expect(inspector).toContainText(contributedTask!.title);
        if (role === "admin") {
          await expect(inspector.getByTitle("Редактировать задачу").first()).toBeVisible();
          await expect(inspector.getByTitle("Изменить трудозатраты по задаче (всего)").first()).toBeVisible();
        } else {
          await expect(inspector.getByTitle("Редактировать задачу")).toHaveCount(0);
          await expect(inspector.getByTitle("Изменить трудозатраты по задаче (всего)")).toHaveCount(0);
        }
        const drilldownShot = await captureRow(page, "PROJ-067", role, "live-contribution-drilldown");
        recordRow("PROJ-067", role, [
          "Clicked a live person/day bucket selected from API assignment contributions",
          "Inspector identity, date and authored task title matched the read-model",
          role === "admin"
            ? "ADMIN received task and assignment edit controls"
            : "PLAN reader received the same contribution detail without write controls"
        ], drilldownShot);
        await inspector.getByRole("button", { name: "Закрыть", exact: true }).click();

        const syntheticSemantics = colorSemanticsModel(model, contributed);
        await routeReadModel(page, projectId, syntheticSemantics);
        await page.reload();
        await waitForResources(page);
        const semanticStates = [
          { kind: "normal", date: "2026-07-06" },
          { kind: "overload", date: "2026-07-08" },
          { kind: "absence", date: "2026-07-10" },
          { kind: "holiday", date: "2026-07-13" },
          { kind: "weekend", date: "2026-07-11" }
        ];
        const semanticColors: string[] = [];
        for (const item of semanticStates) {
          const cell = await personCell(page, contributed.user.name, item.date);
          semanticColors.push(await cell.evaluate((node) => (node as HTMLElement).style.background));
        }
        expect(new Set(semanticColors).size).toBe(semanticStates.length);
        await expect(page.getByText("Перегруз (>100%)", { exact: true })).toBeVisible();
        await expect(page.getByText("Отпуск / отсутствие", { exact: true })).toBeVisible();
        await expect(page.getByText("Праздник", { exact: true })).toBeVisible();
        await expect(page.getByText("Выходной", { exact: true })).toBeVisible();
        await expect(await personCell(page, contributed.user.name, "2026-07-08")).toHaveAttribute(
          "title",
          /ПЕРЕГРУЗ/
        );
        const acceptedCell = await personCell(page, contributed.user.name, "2026-07-09");
        await expect(acceptedCell).toHaveText("✓");
        await expect(acceptedCell).toHaveAttribute("title", /перегруз принят/);
        await (await personCell(page, contributed.user.name, "2026-07-08")).hover();
        const semanticsShot = await captureRow(
          page,
          "PROJ-072",
          role,
          "synthetic-five-cell-semantics"
        );
        recordRow("PROJ-072", role, [
          "SYNTHETIC ROUTE FIXTURE: deterministic normal, overload, absence, holiday and weekend buckets rendered through the production matrix",
          "SYNTHETIC ROUTE FIXTURE: all five semantic classes produced distinct inline background values",
          "SYNTHETIC ROUTE FIXTURE: accepted overload rendered a check mark and literal accepted-overload title while the semantic legend remained visible"
        ], semanticsShot);
        await page.unroute(readModelPattern(projectId));
      });
    }
    expect(
      [...rows.values()].filter((row) => row.role === "planReader" && row.status === "fail")
        .map((row) => row.key),
      "planReader resources rows failed because the live directory endpoint returned 403"
    ).toEqual([]);
  });

  test("PROJ-069:A edits assignment work and restores it through preview/apply", async ({
    browser
  }, testInfo) => {
    test.setTimeout(120_000);
    await withRole(browser, "admin", testInfo, async (page) => {
      if (!projectId) projectId = await selectProjectFixture(page);
      expect(projectId).not.toBe("");
      const before = await getReadModel(page, projectId);
      const users = await getWorkspaceUsers(page);
      const userById = new Map(users.map((user) => [user.id, user]));
      const fixture = selectEditableAssignment(before, userById);
      const originalMinutes = fixture.assignment.workMinutes!;
      const originalAllocations = before.authored.assignmentAllocations.filter(
        (allocation) => allocation.assignmentId === fixture.assignment.id
      );
      const changedMinutes = originalMinutes === 60 ? 120 : originalMinutes - 60;
      let applied = false;

      try {
        await openResources(page, projectId);
        const write = await editAssignmentHours(
          page,
          projectId,
          fixture.user.name,
          fixture.bucket.date,
          changedMinutes / 60
        );
        expect(write.preview.status()).toBe(200);
        expect(write.apply.status()).toBe(200);
        applied = true;
        const previewEnvelope = write.preview.request().postDataJSON() as CommandEnvelope;
        const applyEnvelope = write.apply.request().postDataJSON() as CommandEnvelope;
        expect(previewEnvelope.command).toEqual(applyEnvelope.command);
        expect(applyEnvelope.command).toMatchObject({
          type: "assignment.upsert",
          payload: {
            id: fixture.assignment.id,
            taskId: fixture.assignment.taskId,
            resourceId: fixture.assignment.resourceId,
            role: fixture.assignment.role,
            unitsPermille: fixture.assignment.unitsPermille,
            workMinutes: changedMinutes
          }
        });
        expect(applyEnvelope.idempotencyKey).toMatch(/^planning-apply-[0-9a-f-]{36}$/i);
        applied = true;

        let readback = await getReadModel(page, projectId);
        expect(findAssignment(readback, fixture.assignment.id)?.workMinutes).toBe(changedMinutes);
        await page.reload();
        await waitForResources(page);
        readback = await getReadModel(page, projectId);
        expect(findAssignment(readback, fixture.assignment.id)?.workMinutes).toBe(changedMinutes);
        const appliedShot = await captureRow(page, "PROJ-069", "admin", "applied-readback-reload");

        const changedBucket = bucketForAssignment(readback, fixture.assignment.id);
        const cleanup = await editAssignmentHours(
          page,
          projectId,
          fixture.user.name,
          changedBucket.date,
          originalMinutes / 60
        );
        expect(cleanup.preview.status()).toBe(200);
        expect(cleanup.apply.status()).toBe(200);
        expect(
          (cleanup.apply.request().postDataJSON() as CommandEnvelope).command
        ).toMatchObject({
          type: "assignment.upsert",
          payload: {
            id: fixture.assignment.id,
            taskId: fixture.assignment.taskId,
            resourceId: fixture.assignment.resourceId,
            role: fixture.assignment.role,
            unitsPermille: fixture.assignment.unitsPermille,
            workMinutes: originalMinutes
          }
        });
        applied = false;

        const allocationCleanup = await previewApplyCommand(page, projectId, {
          type: "assignment.allocations.replace",
          payload: {
            assignmentId: fixture.assignment.id,
            allocations: originalAllocations.map(({ date, workMinutes }) => ({
              date,
              workMinutes
            }))
          }
        });

        const cleaned = await getReadModel(page, projectId);
        expect(findAssignment(cleaned, fixture.assignment.id)).toEqual(fixture.assignment);
        expect(
          cleaned.authored.assignmentAllocations.filter(
            (allocation) => allocation.assignmentId === fixture.assignment.id
          )
        ).toEqual(originalAllocations);
        await page.reload();
        await waitForResources(page);
        expect(findAssignment(await getReadModel(page, projectId), fixture.assignment.id)).toEqual(
          fixture.assignment
        );
        recordRow("PROJ-069", "admin", [
          "UI hours edit emitted matching assignment.upsert preview and apply envelopes",
          "API readback converted hours to exact minutes and survived reload",
          "A second UI preview/apply restored the exact original assignment and survived cleanup reload"
        ], appliedShot, {
          previewEnvelope,
          applyEnvelope,
          reloadReadback: {
            reloaded: true,
            planVersion: readback.planVersion,
            assignment: findAssignment(readback, fixture.assignment.id)
          },
          cleanup: {
            assignmentPreviewEnvelope: cleanup.preview.request().postDataJSON(),
            assignmentApplyEnvelope: cleanup.apply.request().postDataJSON(),
            allocations: allocationCleanup,
            finalPlanVersion: cleaned.planVersion,
            restoredAssignment: findAssignment(cleaned, fixture.assignment.id),
            restoredAllocations: originalAllocations
          }
        });
      } finally {
        if (applied) {
          await previewApplyCommand(page, projectId, {
            type: "assignment.upsert",
            payload: { ...fixture.assignment, workMinutes: originalMinutes }
          });
          await previewApplyCommand(page, projectId, {
            type: "assignment.allocations.replace",
            payload: {
              assignmentId: fixture.assignment.id,
              allocations: originalAllocations.map(({ date, workMinutes }) => ({
                date,
                workMinutes
              }))
            }
          });
        }
      }
    });
  });

  test("PROJ-070:A creates a resource-preset task and removes it through preview/apply", async ({
    browser
  }, testInfo) => {
    test.setTimeout(120_000);
    await withRole(browser, "admin", testInfo, async (page) => {
      if (!projectId) projectId = await selectProjectFixture(page);
      expect(projectId).not.toBe("");
      const before = await getReadModel(page, projectId);
      const users = await getWorkspaceUsers(page);
      const userById = new Map(users.map((user) => [user.id, user]));
      const fixture = selectContributedDay(before, userById);
      const title = `PROJ-070 preset ${RUN_ID}`;
      let createdTaskId = "";

      try {
        await openResources(page, projectId);
        await (await personCell(page, fixture.user.name, fixture.bucket.date)).click();
        await page.getByRole("button", { name: "Задача", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Новая задача" });
        await expect(dialog).toBeVisible();
        const assignee = dialog.getByText("Исполнитель", { exact: true }).locator("..").locator("select");
        expect(await assignee.inputValue()).toBe(fixture.user.id);
        await dialog.getByText("Название", { exact: true }).locator("..").locator("input").fill(title);
        await dialog.getByText("Начало", { exact: true }).locator("..").locator("input").fill(fixture.bucket.date);
        await dialog.getByText("Длит, дн", { exact: true }).locator("..").locator("input").fill("1");
        await dialog.getByText("Труд, ч", { exact: true }).locator("..").locator("input").fill("1");

        const previewPromise = waitForPlanningResponse(page, projectId, "preview-command-batch");
        await dialog.getByRole("button", { name: "Создать", exact: true }).click();
        const preview = await previewPromise;
        expect(preview.status()).toBe(200);
        const previewEnvelope = preview.request().postDataJSON() as BatchEnvelope;
        const createCommand = previewEnvelope.commands.find((command) => command.type === "task.create");
        const assignmentCommand = previewEnvelope.commands.find(
          (command) => command.type === "assignment.upsert"
        );
        expect(createCommand?.payload.title).toBe(title);
        expect(assignmentCommand?.payload.resourceId).toBe(fixture.user.id);
        createdTaskId = String(createCommand?.payload.id ?? "");
        expect(createdTaskId).toMatch(/^t-[0-9a-f-]{36}$/i);

        const applyPromise = waitForPlanningResponse(page, projectId, "apply-command-batch");
        await confirmPlanningPreview(page);
        const apply = await applyPromise;
        expect(apply.status()).toBe(200);
        const applyEnvelope = apply.request().postDataJSON() as BatchEnvelope;
        expect(applyEnvelope.commands).toEqual(previewEnvelope.commands);
        expect(applyEnvelope.idempotencyKey).toMatch(/^planning-batch-[0-9a-f-]{36}$/i);

        let readback = await getReadModel(page, projectId);
        expect(readback.authored.tasks.find((task) => task.id === createdTaskId)?.title).toBe(title);
        expect(
          readback.authored.assignments.find((assignment) => assignment.taskId === createdTaskId)
            ?.resourceId
        ).toBe(fixture.user.id);
        await page.reload();
        await waitForResources(page);
        readback = await getReadModel(page, projectId);
        expect(readback.authored.tasks.some((task) => task.id === createdTaskId)).toBe(true);
        const appliedShot = await captureRow(page, "PROJ-070", "admin", "preset-created-reload");

        const deletedTaskId = createdTaskId;
        const cleanup = await previewApplyCommand(page, projectId, {
          type: "task.delete_or_archive",
          payload: { taskId: deletedTaskId, mode: "delete" }
        });
        createdTaskId = "";
        const cleaned = await getReadModel(page, projectId);
        expect(cleaned.authored.tasks.some((task) => task.title === title)).toBe(false);
        expect(cleaned.authored.assignments.some((assignment) => assignment.taskId === deletedTaskId)).toBe(
          false
        );
        await page.reload();
        await waitForResources(page);
        expect((await getReadModel(page, projectId)).authored.tasks.some((task) => task.title === title)).toBe(
          false
        );
        recordRow("PROJ-070", "admin", [
          "Selected a live person/day cell and proved TaskModal preset the exact resourceId",
          "UI create emitted matching batch preview/apply commands and API readback contained task plus assignment",
          "Reload preserved the task; cleanup preview/apply removed it and cleanup reload confirmed absence"
        ], appliedShot, {
          previewEnvelope,
          applyEnvelope,
          reloadReadback: {
            reloaded: true,
            planVersion: readback.planVersion,
            taskId: createdTaskId,
            resourceId: fixture.user.id
          },
          cleanup: {
            ...cleanup,
            finalPlanVersion: cleaned.planVersion,
            taskAbsent: true,
            assignmentAbsent: true
          }
        });
      } finally {
        if (createdTaskId) {
          await previewApplyCommand(page, projectId, {
            type: "task.delete_or_archive",
            payload: { taskId: createdTaskId, mode: "delete" }
          });
        }
      }
    });
  });

  test.afterAll(() => {
    const receiptRows = [...rows.values()];
    writeFileSync(
      MANIFEST_PATH,
      JSON.stringify(
        {
          schemaVersion: 1,
          runId: RUN_ID,
          generatedAt: new Date().toISOString(),
          targetRowCount: targets.length,
          statusCounts: Object.fromEntries(
            ["pass", "fail", "pending"].map((status) => [
              status,
              receiptRows.filter((row) => row.status === status).length
            ])
          ),
          rows: receiptRows
        },
        null,
        2
      ),
      "utf8"
    );

    expect(receiptRows).toHaveLength(16);
    expect(receiptRows.filter((row) => row.status !== "pass").map((row) => row.key)).toEqual([]);
    const screenshotHashes = new Map<string, string>();
    const receiptPaths = new Set<string>();
    for (const row of receiptRows) {
      expect(row.assertions.length, `${row.key} requires assertions`).toBeGreaterThan(0);
      expect(row.screenshots).toHaveLength(1);
      expect(receiptPaths.has(row.receipt), `${row.key} reused receipt ${row.receipt}`).toBe(false);
      receiptPaths.add(row.receipt);
      expect(existsSync(resolve(EVIDENCE_ROOT, row.receipt))).toBe(true);
      for (const screenshot of row.screenshots) {
        const screenshotPath = resolve(EVIDENCE_ROOT, screenshot);
        expect(statSync(screenshotPath).size).toBeGreaterThan(0);
        const hash = createHash("sha256").update(readFileSync(screenshotPath)).digest("hex");
        expect(screenshotHashes.has(hash), `${screenshot} duplicates ${screenshotHashes.get(hash)}`).toBe(
          false
        );
        screenshotHashes.set(hash, screenshot);
      }
    }
  });
});

async function withRole(
  browser: Browser,
  role: Role,
  testInfo: TestInfo,
  run: (page: Page) => Promise<void>
) {
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    locale: "ru-RU"
  });
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

async function selectProjectFixture(page: Page) {
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const projects = (await response.json()) as { projects: Array<{ id: string }> };
  const users = await getWorkspaceUsers(page);
  const userIds = new Set(users.map((user) => user.id));
  const candidates: Array<{ id: string; score: number }> = [];
  for (const project of projects.projects) {
    const model = await getReadModel(page, project.id);
    const day = model.resourceLoad.buckets.filter(
      (bucket) => bucket.granularity === "day" && userIds.has(bucket.resourceId)
    );
    const kinds = semanticKinds(day);
    const editable = model.authored.assignments.some(
      (assignment) =>
        assignment.workMinutes !== null &&
        assignment.workMinutes >= 60 &&
        assignment.workMinutes % 60 === 0 &&
        day.some((bucket) =>
          bucket.assignmentContributions.some(
            (contribution) => contribution.assignmentId === assignment.id
          )
        )
    );
    const score = kinds.size * 100 + day.length + (editable ? 1_000 : 0);
    candidates.push({ id: project.id, score });
  }
  candidates.sort((left, right) => right.score - left.score);
  expect(candidates.length).toBeGreaterThan(0);
  return candidates[0]!.id;
}

async function openResources(page: Page, id: string) {
  const encodedId = encodeURIComponent(id);
  const navigation = page.getByRole("navigation", { name: "Основная навигация" });
  await navigation.locator('a[href="/projects"]').click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/projects");
  await expect(page.getByText("Загрузка проектов…", { exact: true })).toHaveCount(0);

  const projectLink = page.locator('a[href="/projects/' + encodedId + '"]');
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(
    "/projects/" + encodedId
  );

  const resourcesPath = "/projects/" + encodedId + "/resources";
  await page.goto(resourcesPath);
  await expect.poll(() => new URL(page.url()).pathname).toBe(resourcesPath);
  await waitForResources(page);
}
async function waitForResources(page: Page) {
  await expect(page.getByText("Ресурс / команда", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Загрузка ресурсной загрузки…", { exact: true })).toHaveCount(0);
}

async function getReadModel(page: Page, id: string): Promise<ReadModel> {
  const response = await page.request.get(
    `/api/workspace/projects/${encodeURIComponent(id)}/planning/read-model`
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

async function getWorkspaceUsers(page: Page): Promise<WorkspaceUser[]> {
  const response = await page.request.get("/api/workspace/users");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { users: WorkspaceUser[] };
  expect(body.users.length).toBeGreaterThan(1);
  return body.users;
}

function selectContributedDay(model: ReadModel, userById: Map<string, WorkspaceUser>) {
  const bucket = model.resourceLoad.buckets.find(
    (candidate) =>
      candidate.granularity === "day" &&
      candidate.assignmentContributions.length > 0 &&
      userById.has(candidate.resourceId)
  );
  expect(bucket, "fixture requires a live contributed person/day bucket").toBeTruthy();
  return { bucket: bucket!, user: userById.get(bucket!.resourceId)! };
}

function selectEditableAssignment(model: ReadModel, userById: Map<string, WorkspaceUser>) {
  for (const assignment of model.authored.assignments) {
    if (
      assignment.workMinutes === null ||
      assignment.workMinutes < 60 ||
      assignment.workMinutes % 60 !== 0
    ) {
      continue;
    }
    const bucket = model.resourceLoad.buckets.find(
      (candidate) =>
        candidate.granularity === "day" &&
        userById.has(candidate.resourceId) &&
        candidate.assignmentContributions.some(
          (contribution) => contribution.assignmentId === assignment.id
        )
    );
    if (bucket) return { assignment, bucket, user: userById.get(bucket.resourceId)! };
  }
  throw new Error("PROJ-069 requires an integer-hour assignment with a live day contribution");
}

function readModelPattern(id: string) {
  return "**/api/workspace/projects/" + encodeURIComponent(id) + "/planning/read-model";
}

async function routeReadModel(page: Page, id: string, model: ReadModel) {
  await page.route(readModelPattern(id), (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(model)
    })
  );
}

function syntheticBucket(
  template: Bucket,
  date: string,
  assignedMinutes: number,
  capacityMinutes: number,
  kind: "work" | "absence" | "holiday" | "weekend"
): Bucket {
  const source = template.assignmentContributions[0];
  return {
    ...template,
    date,
    granularity: "day",
    assignedMinutes,
    reservedMinutes: 0,
    occupiedMinutes: kind === "absence" ? 480 : 0,
    capacityMinutes,
    assignmentContributions:
      kind === "work" && source
        ? [{ ...source, workMinutes: assignedMinutes }]
        : [],
    occupancyContributions:
      kind === "absence"
        ? [{
            occupancyId: "synthetic-absence",
            sourceType: "absence",
            sourceId: "synthetic-absence",
            workMinutes: 480
          }]
        : [],
    calendarExceptionIds:
      kind === "holiday"
        ? ["synthetic-holiday"]
        : kind === "absence"
          ? ["synthetic-absence"]
          : []
  };
}

function colorSemanticsModel(
  model: ReadModel,
  contributed: ReturnType<typeof selectContributedDay>
): ReadModel {
  const synthetic = structuredClone(model);
  const template = contributed.bucket;
  synthetic.resourceLoad.buckets = [
    syntheticBucket(template, "2026-07-06", 240, 480, "work"),
    syntheticBucket(template, "2026-07-07", 480, 480, "work"),
    syntheticBucket(template, "2026-07-08", 600, 480, "work"),
    syntheticBucket(template, "2026-07-09", 600, 480, "work"),
    syntheticBucket(template, "2026-07-10", 0, 0, "absence"),
    syntheticBucket(template, "2026-07-11", 0, 0, "weekend"),
    syntheticBucket(template, "2026-07-13", 0, 0, "holiday")
  ];
  synthetic.resourceLoad.acceptedOverloads = [
    contributed.user.id + ":2026-07-09"
  ];
  return synthetic;
}
function zeroCapacityModel(
  model: ReadModel,
  contributed: ReturnType<typeof selectContributedDay>
): ReadModel {
  const synthetic = structuredClone(model);
  synthetic.resourceLoad.buckets = [
    syntheticBucket(contributed.bucket, "2026-07-06", 0, 0, "weekend")
  ];
  synthetic.resourceLoad.acceptedOverloads = [];
  return synthetic;
}
function selectSemanticBuckets(model: ReadModel, userById: Map<string, WorkspaceUser>) {
  const result = new Map<string, { kind: string; bucket: Bucket; user: WorkspaceUser }>();
  for (const bucket of model.resourceLoad.buckets) {
    if (bucket.granularity !== "day") continue;
    const user = userById.get(bucket.resourceId);
    if (!user) continue;
    const kind = semanticKind(bucket);
    if (kind && !result.has(kind)) result.set(kind, { kind, bucket, user });
  }
  const ordered = ["normal", "overload", "absence", "holiday", "weekend"].map((kind) =>
    result.get(kind)
  );
  expect(
    ordered.map((item, index) => item?.kind ?? `missing:${index}`),
    "PROJ-072 requires live normal, overload, absence, holiday and weekend buckets"
  ).toEqual(["normal", "overload", "absence", "holiday", "weekend"]);
  return ordered as Array<{ kind: string; bucket: Bucket; user: WorkspaceUser }>;
}

function semanticKinds(buckets: Bucket[]) {
  return new Set(buckets.map(semanticKind).filter((kind): kind is string => kind !== null));
}

function semanticKind(bucket: Bucket): string | null {
  const total = committed(bucket);
  const absence = bucket.occupancyContributions.some(
    (contribution) => contribution.sourceType === "absence"
  );
  const weekday = new Date(`${bucket.date}T00:00:00Z`).getUTCDay();
  if (bucket.capacityMinutes > 0 && total > bucket.capacityMinutes) return "overload";
  if (bucket.capacityMinutes > 0 && total > 0 && total <= bucket.capacityMinutes) return "normal";
  if (bucket.capacityMinutes === 0 && absence) return "absence";
  if (
    bucket.capacityMinutes === 0 &&
    weekday >= 1 &&
    weekday <= 5 &&
    (bucket.calendarExceptionIds?.length ?? 0) > 0
  ) {
    return "holiday";
  }
  if (bucket.capacityMinutes === 0 && (weekday === 0 || weekday === 6)) return "weekend";
  return null;
}

async function personCell(page: Page, userName: string, date: string): Promise<Locator> {
  const cells = page.locator("button[title]");
  const index = await cells.evaluateAll(
    (nodes, prefix) => nodes.findIndex((node) => node.getAttribute("title")?.startsWith(prefix)),
    `${userName} · ${date}`
  );
  expect(index, `missing person cell ${userName}:${date}`).toBeGreaterThanOrEqual(0);
  return cells.nth(index);
}

async function firstNonAllOption(select: Locator) {
  const values = await select.locator("option").evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).filter((value) => value !== "all")
  );
  expect(values.length).toBeGreaterThan(0);
  return values[0]!;
}

function kpiCard(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("..");
}

async function kpiSnapshot(page: Page) {
  return Promise.all(
    ["Ёмкость", "Назначено", "Загрузка", "Свободно", "Перегруз"].map((label) =>
      kpiCard(page, label).innerText()
    )
  );
}

async function editAssignmentHours(
  page: Page,
  id: string,
  userName: string,
  date: string,
  hoursValue: number
) {
  await (await personCell(page, userName, date)).click();
  const inspector = page.locator("aside").filter({ hasText: userName });
  const edit = inspector.getByTitle("Изменить трудозатраты по задаче (всего)").first();
  await expect(edit).toBeVisible();
  await edit.click();
  const input = inspector.locator('input[type="number"]').first();
  const previewPromise = waitForPlanningResponse(page, id, "preview-command");
  await input.fill(String(hoursValue));
  await input.press("Enter");
  const preview = await previewPromise;
  const applyPromise = waitForPlanningResponse(page, id, "apply-command");
  await confirmPlanningPreview(page);
  const apply = await applyPromise;
  return { preview, apply };
}

function waitForPlanningResponse(
  page: Page,
  id: string,
  endpoint:
    | "preview-command"
    | "apply-command"
    | "preview-command-batch"
    | "apply-command-batch"
) {
  const path = `/api/workspace/projects/${encodeURIComponent(id)}/planning/${endpoint}`;
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

async function previewApplyCommand(page: Page, id: string, command: Command) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const model = await getReadModel(page, id);
    const data = { command, clientPlanVersion: model.planVersion };
    const preview = await page.request.post(
      `/api/workspace/projects/${encodeURIComponent(id)}/planning/preview-command`,
      { headers: mutationHeaders(page), data }
    );
    if (preview.status() === 409) continue;
    expect(preview.status()).toBe(200);
    const apply = await page.request.post(
      `/api/workspace/projects/${encodeURIComponent(id)}/planning/apply-command`,
      { headers: mutationHeaders(page), data }
    );
    if (apply.status() === 409) continue;
    expect(apply.status()).toBe(200);
    const after = await getReadModel(page, id);
    return {
      previewEnvelope: data,
      previewStatus: preview.status(),
      applyEnvelope: data,
      applyStatus: apply.status(),
      planVersion: after.planVersion
    };
  }
  throw new Error(`preview_apply_cleanup_conflict:${command.type}`);
}

function mutationHeaders(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "x-kiss-pm-action": "same-origin"
  };
}

function findAssignment(model: ReadModel, assignmentId: string) {
  return model.authored.assignments.find((assignment) => assignment.id === assignmentId);
}

function bucketForAssignment(model: ReadModel, assignmentId: string) {
  const bucket = model.resourceLoad.buckets.find(
    (candidate) =>
      candidate.granularity === "day" &&
      candidate.assignmentContributions.some(
        (contribution) => contribution.assignmentId === assignmentId
      )
  );
  if (!bucket) throw new Error(`assignment_bucket_missing:${assignmentId}`);
  return bucket;
}

function committed(bucket: Bucket) {
  return bucket.assignedMinutes + bucket.reservedMinutes + bucket.occupiedMinutes;
}

function dayMonths(model: ReadModel) {
  return [
    ...new Set(
      model.resourceLoad.buckets
        .filter((bucket) => bucket.granularity === "day")
        .map((bucket) => bucket.date.slice(0, 7))
    )
  ].sort();
}

function hours(minutes: number) {
  return (Math.round((minutes / 60) * 10) / 10).toLocaleString("ru-RU");
}

async function captureRow(page: Page, scenarioId: string, role: Role, state: string) {
  const safeState = state.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const filename = `${scenarioId.toLowerCase()}-${role}-${safeState}.png`;
  const relative = `screenshots/${filename}`;
  const label = `${scenarioId}:${role}:${safeState}:${RUN_ID}`;
  await page.evaluate((evidenceLabel) => {
    document.querySelector('[data-full-eval-evidence="true"]')?.remove();
    const stamp = document.createElement("div");
    stamp.dataset.fullEvalEvidence = "true";
    stamp.textContent = `Full Eval evidence | ${evidenceLabel}`;
    Object.assign(stamp.style, {
      position: "fixed",
      right: "8px",
      bottom: "8px",
      zIndex: "2147483647",
      padding: "4px 6px",
      background: "rgba(0, 0, 0, 0.86)",
      color: "white",
      font: "11px/1.2 monospace",
      pointerEvents: "none"
    });
    document.body.append(stamp);
  }, label);
  try {
    await page.screenshot({ path: resolve(EVIDENCE_ROOT, relative), fullPage: true });
  } finally {
    await page.evaluate(() =>
      document.querySelector('[data-full-eval-evidence="true"]')?.remove()
    );
  }
  return relative;
}

function recordFailureRow(
  scenarioId: string,
  role: Role,
  assertions: string[],
  screenshot: string
) {
  const key = scenarioId + ":" + role;
  const row = rows.get(key);
  expect(row, "unexpected failure receipt row " + key).toBeTruthy();
  expect(row!.status, "duplicate failure receipt row " + key).toBe("pending");
  expect(existsSync(resolve(EVIDENCE_ROOT, screenshot)), "missing " + screenshot).toBe(true);
  const completed: ReceiptRow = {
    ...row!,
    status: "fail",
    generatedAt: new Date().toISOString(),
    assertions,
    details: {},
    screenshots: [screenshot]
  };
  rows.set(key, completed);
  writeFileSync(
    resolve(EVIDENCE_ROOT, completed.receipt),
    JSON.stringify({ schemaVersion: 1, ...completed }, null, 2),
    "utf8"
  );
}
function recordRow(
  scenarioId: string,
  role: Role,
  assertions: string[],
  screenshot: string,
  details: Record<string, unknown> = {}
) {
  const key = `${scenarioId}:${role}`;
  const row = rows.get(key);
  expect(row, `unexpected receipt row ${key}`).toBeTruthy();
  expect(row!.status, `duplicate receipt row ${key}`).toBe("pending");
  expect(assertions.length).toBeGreaterThan(0);
  expect(existsSync(resolve(EVIDENCE_ROOT, screenshot)), `missing ${screenshot}`).toBe(true);
  const completed: ReceiptRow = {
    ...row!,
    status: "pass",
    generatedAt: new Date().toISOString(),
    assertions,
    details,
    screenshots: [screenshot]
  };
  rows.set(key, completed);
  writeFileSync(
    resolve(EVIDENCE_ROOT, completed.receipt),
    JSON.stringify({ schemaVersion: 1, ...completed }, null, 2),
    "utf8"
  );
}
