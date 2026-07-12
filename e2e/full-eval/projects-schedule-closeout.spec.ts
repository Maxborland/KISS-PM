import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type Response, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SPEC_DIR, "../..");
const EVIDENCE_ROOT = resolve(REPO_ROOT, ".superloopy/evidence/schedule-closeout-2026-07-10");
const MACHINE_PATH = resolve(EVIDENCE_ROOT, "schedule-closeout-machine.json");
const UI_ORIGIN = "http://127.0.0.1:3180";
const API_ORIGIN = "http://127.0.0.1:4192";
const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const PLAN_READER = { email: "plan-reader-no-resources@kiss-pm.local", password: "reader12345" };
const RUN_ID = process.env.SCHEDULE_CLOSEOUT_RUN_ID ?? `${Date.now()}-${process.pid}`;

type Role = "admin" | "planReader";
type BundleId = "C01" | "C02" | "C03" | "C04" | "C05" | "C06" | "C07" | "C08" | "C09" | "C10" | "C11";
type EvidenceStatus = "pending" | "pass" | "blocker";

type TargetRow = {
  scenarioId: `PROJ-${number}`;
  role: Role;
  bundle: BundleId;
};

type PlanTask = {
  id: string;
  title: string;
  parentTaskId?: string | null;
  plannedStart?: string | null;
  plannedFinish?: string | null;
  durationMinutes?: number | null;
  workMinutes?: number | null;
  percentComplete?: number;
  customFields?: Record<string, unknown>;
};

type Assignment = {
  id: string;
  taskId: string;
  resourceId: string;
  workMinutes?: number | null;
  unitsPermille?: number;
};

type Dependency = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: string;
  lagMinutes: number;
};

type ReadModel = {
  project: { id?: string; title?: string; name?: string; plannedStart?: string; plannedFinish?: string };
  authored: {
    tasks: PlanTask[];
    assignments: Assignment[];
    dependencies: Dependency[];
    baselines?: Array<{ id: string; label: string }>;
  };
  baselineComparison?: {
    baselineId: string | null;
    label: string | null;
    tasks: Array<{
      taskId: string;
      startDeltaDays: number | null;
      finishDeltaDays: number | null;
      workDeltaMinutes: number | null;
    }>;
  };
  planVersion: number;
};

type EvidenceRow = TargetRow & {
  key: string;
  status: EvidenceStatus;
  runId: string;
  generatedAt: string | null;
  assertions: string[];
  screenshots: string[];
  blocker: string | null;
};

const TARGET_ROWS = [
  row("PROJ-033", "admin", "C01"), row("PROJ-034", "admin", "C01"),
  row("PROJ-040", "admin", "C01"), row("PROJ-041", "admin", "C01"),
  row("PROJ-042", "admin", "C01"), row("PROJ-043", "admin", "C01"),
  row("PROJ-045", "admin", "C01"), row("PROJ-048", "admin", "C01"),
  row("PROJ-035", "admin", "C02"), row("PROJ-036", "admin", "C02"),
  row("PROJ-037", "admin", "C02"),
  row("PROJ-038", "admin", "C03"), row("PROJ-038", "planReader", "C03"),
  row("PROJ-039", "admin", "C03"), row("PROJ-039", "planReader", "C03"),
  row("PROJ-049", "admin", "C03"), row("PROJ-049", "planReader", "C03"),
  row("PROJ-050", "admin", "C03"), row("PROJ-050", "planReader", "C03"),
  row("PROJ-056", "admin", "C03"), row("PROJ-056", "planReader", "C03"),
  row("PROJ-051", "admin", "C04"), row("PROJ-052", "admin", "C04"),
  row("PROJ-053", "admin", "C04"), row("PROJ-054", "admin", "C04"),
  row("PROJ-044", "admin", "C05"), row("PROJ-055", "admin", "C05"),
  row("PROJ-047", "admin", "C06"), row("PROJ-057", "admin", "C06"),
  row("PROJ-058", "admin", "C06"),
  row("PROJ-059", "admin", "C07"), row("PROJ-117", "admin", "C07"),
  row("PROJ-130", "admin", "C07"),
  row("PROJ-060", "admin", "C08"), row("PROJ-060", "planReader", "C08"),
  row("PROJ-119", "admin", "C09"),
  row("PROJ-127", "admin", "C10"), row("PROJ-127", "planReader", "C10"),
  row("PROJ-129", "admin", "C11"), row("PROJ-129", "planReader", "C11")
] as const satisfies readonly TargetRow[];

const ROW_ASSERTIONS: Record<string, string[]> = {
  "PROJ-033:admin": ["Subtask disabled without selection; selected row becomes persisted parentTaskId"],
  "PROJ-034:admin": ["Create/edit modal persists all fields, clamps values, and reuses stable assignment id"],
  "PROJ-040:admin": ["Inline Enter/Escape/Tab/Shift+Tab navigation persists only committed editable task fields"],
  "PROJ-041:admin": ["Live start-date editor shifts schedule and persists through reload"],
  "PROJ-042:admin": ["Finish-date editor recalculates duration/work and keeps assignment id stable"],
  "PROJ-043:admin": ["Live resource editor persists real user id without duplicate assignment"],
  "PROJ-045:admin": ["All row-menu actions and disabled hierarchy states are traversed"],
  "PROJ-048:admin": ["Bottom and positioned quick-create cover Enter, Tab, Escape, validation, and readback"],
  "PROJ-035:admin": ["Indent/outdent boundaries and resulting WBS order persist after reload"],
  "PROJ-036:admin": ["Two edits stage with zero writes, apply atomically, and reset with zero writes"],
  "PROJ-037:admin": ["Compensating undo works once and rejects unsupported, stale, duplicate, and foreign targets"],
  "PROJ-038:admin": ["Admin Baseline route is real and undeclared Filters/Columns controls are absent"],
  "PROJ-038:planReader": ["Reader Baseline route is readable and undeclared Filters/Columns controls are absent"],
  "PROJ-039:admin": ["Admin Day/Week/Month reflows bars, links, and markers at 36/20/8 px"],
  "PROJ-039:planReader": ["Reader Day/Week/Month reflows read-only bars, links, and markers at 36/20/8 px"],
  "PROJ-049:admin": ["Admin nested collapse hides descendants and connectors, then restores them"],
  "PROJ-049:planReader": ["Reader nested collapse hides descendants and connectors without a write"],
  "PROJ-050:admin": ["Admin column resize clamps at 36 px and resets on remount"],
  "PROJ-050:planReader": ["Reader column resize clamps at 36 px and resets on remount"],
  "PROJ-056:admin": ["Admin inspector facts, close action, and units write persist"],
  "PROJ-056:planReader": ["Reader inspector exposes facts but no units write control"],
  "PROJ-051:admin": ["Gantt body move covers positive, negative, zero, clamp, and release outside"],
  "PROJ-052:admin": ["Gantt left/right resize clamps duration and synchronizes assignment work"],
  "PROJ-053:admin": ["Gantt progress drag clamps 0..100 and zero delta emits no write"],
  "PROJ-054:admin": ["Gantt link drag covers four edge types plus self, miss, duplicate, summary, and cycle rejection"],
  "PROJ-044:admin": ["Dependency editor excludes invalid options and persists add/update/delete with signed lag"],
  "PROJ-055:admin": ["Selected-task link badge edits type/lag by stable dependency id and deletes it"],
  "PROJ-047:admin": ["Leaf and leaves-first summary deletion remove real assignments/dependencies and expose an honest empty plan"],
  "PROJ-057:admin": ["Local and server rejection roll back data, show multiple row/global issues, highlight rows, and clear after success"],
  "PROJ-058:admin": ["Optimistic patch is visible before preview resolves; authoritative commit notice/flash replace it; busy second input emits zero writes"],
  "PROJ-059:admin": ["Single and batch stale writes return visible 409 outcomes and reload authoritative state without automatic retry"],
  "PROJ-117:admin": ["10+ create/edit/dependency/milestone/delete steps increment versions monotonically with readback after every commit; reject adds zero versions"],
  "PROJ-130:admin": ["Dirty single draft and staged batch conflict in two windows; staged retry succeeds only after explicit restage"],
  "PROJ-060:admin": ["Admin timeline origin, week label, today marker, identity, baseline label, and assignment request derive from live data"],
  "PROJ-060:planReader": ["Reader timeline geometry derives from live data and every UI/API write path is absent or 403 with unchanged readback"],
  "PROJ-119:admin": ["Baseline capture, finish-controlling shift, API/table/header/Gantt deltas, reload, and recapture-to-zero agree"],
  "PROJ-127:admin": ["Admin saved views cover full payload, create/rename/delete, privacy, corrupt/empty states, duplicate races, replay, and divergent conflicts"],
  "PROJ-127:planReader": ["Reader selects shared view, cannot see private views, has no mutation controls, and direct create/rename/delete are 403"],
  "PROJ-129:admin": ["Admin default, inspector, dialog, preview, validation, and mobile states have zero critical axe violations"],
  "PROJ-129:planReader": ["Reader default, inspector, forbidden, keyboard, and mobile states have zero critical axe violations and zero writes"]
};
const evidenceRows = new Map<string, EvidenceRow>(
  TARGET_ROWS.map((target) => [targetKey(target), {
    ...target,
    key: targetKey(target),
    status: "pending",
    runId: RUN_ID,
    generatedAt: null,
    assertions: [],
    screenshots: [],
    blocker: null
  }])
);

const sourceStateAtStart = sourceState();

test.describe("Schedule exhaustive browser closeout: 40 role rows / 11 bundles", () => {
  test.describe.configure({ timeout: 300_000 });
  test.beforeAll(() => {
    mkdirSync(EVIDENCE_ROOT, { recursive: true });
    hydrateMachineReceipt();
    expect(TARGET_ROWS).toHaveLength(40);
    expect(new Set(TARGET_ROWS.map(targetKey)).size).toBe(40);
    expect(new Set(TARGET_ROWS.map((target) => target.bundle)).size).toBe(11);
    expect(Object.keys(ROW_ASSERTIONS).sort()).toEqual(TARGET_ROWS.map(targetKey).sort());
    for (const target of TARGET_ROWS) expect(screenshotPrefixesFor(target).length).toBeGreaterThan(0);
    writeMachineReceipt();
  });

  test.beforeEach(async ({ context, page }, testInfo) => {
    page.setDefaultTimeout(10_000);
    expect(process.env.E2E_API_PORT, "closeout must use isolated API port 4192").toBe("4192");
    expect(process.env.E2E_WEB_PORT, "closeout UI must be served on port 3180").toBe("3180");
    expect(process.env.KISS_PM_E2E_DISPOSABLE_DATABASE, "mutating closeout requires an explicitly disposable seeded DB").toBe("1");
    expect(process.env.SCHEDULE_CLOSEOUT_RUN_ID, "set one stable run id so evidence survives Playwright worker restarts").toBeTruthy();
    expect(new URL(String(testInfo.project.use.baseURL)).origin).toBe(UI_ORIGIN);
    expect(testInfo.config.workers, "machine evidence writer requires --workers=1").toBe(1);
    await routeBrowserApi(contextRoute(context), "4192");
  });

  test("C01 admin authoring, modal, inline editors, row menu, and quick-create", async ({ page, browser }, testInfo) => {
    await executeBundle("C01", page, testInfo, async (shot) => {
      const projectId = await loginAndGetProject(page, ADMIN);
      const cleanup = new Set<string>();
      try {
        await openSchedule(page, projectId);
        await expect(page.getByRole("button", { name: "Подзадача", exact: true })).toBeDisabled();
        const users = await browserJson<{ users: Array<{ id: string; name: string }> }>(page, "/api/workspace/users");
        expect(users.status).toBe(200);
        const liveUser = users.body.users.find((user) => user.id && user.name);
        expect(liveUser, "C01 requires a live assignable workspace user").toBeTruthy();
        let replacementUser: { id: string; name: string } | undefined;

        const parentTitle = marker("C01 parent");
        const parent = await createModalTask(page, projectId, {
          title: parentTitle, start: "2027-01-11", duration: "0", work: "16", progress: "150",
          assigneeLabel: liveUser!.name
        });
        cleanup.add(parent.id);
        expect(parent.durationMinutes).toBe(480);
        expect(parent.percentComplete).toBe(100);
        const parentAssignment = (await getReadModel(page, projectId)).authored.assignments.find((item) => item.taskId === parent.id);
        expect(parentAssignment?.resourceId).toBe(liveUser!.id);

        await rowById(page, parent.id).click();
        await expect(page.getByRole("button", { name: "Подзадача", exact: true })).toBeEnabled();
        const childTitle = marker("C01 child");
        const child = await createModalTask(page, projectId, { title: childTitle, assigneeLabel: liveUser!.name }, "Подзадача");
        cleanup.add(child.id);
        expect(child.parentTaskId).toBe(parent.id);

        const childRow = rowById(page, child.id);
        await childRow.click({ button: "right" });
        const expectedMenu = [
          "Открыть инспектор", "Редактировать…", "Создать подзадачу", "Создать задачу рядом",
          "На уровень глубже", "На уровень выше", "Сделать вехой", "Удалить"
        ];
        for (const label of expectedMenu) await expect(page.getByRole("menuitem", { name: label, exact: true })).toBeVisible();
        expect(expectedMenu).toHaveLength(8);
        await page.getByRole("menuitem", { name: "Редактировать…", exact: true }).click();
        const editDialog = page.getByRole("dialog", { name: "Редактировать задачу" });
        const editedTitle = `${childTitle} edited`;
        await editDialog.getByLabel("Название", { exact: true }).fill(editedTitle);
        await editDialog.locator("label").filter({ hasText: "Исполнитель" }).locator("select").selectOption({ label: liveUser!.name });
        await editDialog.getByLabel("Начало", { exact: true }).fill("2027-01-13");
        await editDialog.getByLabel("Длит, дн", { exact: true }).fill("3");
        await editDialog.getByLabel("Труд, ч", { exact: true }).fill("18");
        await editDialog.getByLabel("Прогресс, %", { exact: true }).fill("25");
        await planningWrite(page, projectId, "batch", async () => editDialog.getByLabel("Название", { exact: true }).press("Enter"), {
          readback: (model) => {
            expect(taskById(model, child.id)?.title).toBe(editedTitle);
            const assignments = model.authored.assignments.filter((item) => item.taskId === child.id);
            expect(assignments).toHaveLength(1);
            expect(assignments[0]!.resourceId).toBe(liveUser!.id);
          },
          reload: async () => expect(rowById(page, child.id)).toContainText(editedTitle)
        });
        const stableAssignmentId = (await getReadModel(page, projectId)).authored.assignments.find((item) => item.taskId === child.id)!.id;

        await inlineEdit(page, projectId, child.id, 3, `${editedTitle} inline`, "Enter");
        await inlineEdit(page, projectId, child.id, 4, "4", "Tab");
        await inlineEdit(page, projectId, child.id, 5, "20", "Shift+Tab");
        await inlineEdit(page, projectId, child.id, 6, "42", "Enter");
        const afterInline = await getReadModel(page, projectId);
        const beforeStartEdit = taskById(afterInline, child.id)!;
        expect(afterInline.authored.assignments.filter((item) => item.taskId === child.id)).toHaveLength(1);
        expect(afterInline.authored.assignments.find((item) => item.taskId === child.id)!.id).toBe(stableAssignmentId);

        await editDateCell(page, projectId, child.id, 7, "2027-01-20");
        const afterStart = taskById(await getReadModel(page, projectId), child.id)!;
        expect(afterStart.plannedStart).toBe("2027-01-20");
        expect(afterStart.durationMinutes).toBe(beforeStartEdit.durationMinutes);
        await editDateCell(page, projectId, child.id, 8, "2027-01-26", "Окончание задачи");
        const afterFinish = await getReadModel(page, projectId);
        expect(taskById(afterFinish, child.id)!.durationMinutes).toBeGreaterThanOrEqual(480);
        expect(afterFinish.authored.assignments.find((item) => item.taskId === child.id)!.id).toBe(stableAssignmentId);

        const resourceButton = rowById(page, child.id).locator("td").nth(9).getByRole("button");
        await planningWrite(page, projectId, "single", async () => {
          await resourceButton.click();
          const picker = page.getByText("Назначить сотрудника", { exact: true }).locator("..");
          for (const candidate of users.body.users.filter((user) => user.id !== liveUser!.id && user.name)) {
            const option = picker.getByRole("button", { name: candidate.name });
            if (await option.count()) {
              replacementUser = candidate;
              await option.click();
              break;
            }
          }
          expect(replacementUser, "C01 requires a second user from the live resource directory").toBeTruthy();
        }, {
          readback: (model) => {
            const assignments = model.authored.assignments.filter((item) => item.taskId === child.id);
            expect(assignments).toHaveLength(1);
            expect(assignments[0]!.id).toBe(stableAssignmentId);
            expect(assignments[0]!.resourceId).toBe(replacementUser!.id);
          },
          reload: async () => expect(rowById(page, child.id)).toBeVisible()
        });

        const quickCreate = page.getByRole("textbox", { name: "Создать задачу (Enter; Tab — подзадачей)" }).last();
        const noWriteBefore = await countPlanningPosts(page, async () => {
          await quickCreate.fill("ab");
          await quickCreate.press("Enter");
          await expect(page.getByText("Название задачи: минимум 3 символа", { exact: true })).toBeVisible();
          await quickCreate.press("Escape");
        });
        expect(noWriteBefore).toBe(0);

        const quickTitle = marker("C01 quick");
        const quick = await quickCreateTask(page, projectId, quickTitle, "Enter");
        cleanup.add(quick.id);
        const tabTitle = marker("C01 tab child");
        const tabChild = await quickCreateTask(page, projectId, tabTitle, "Tab");
        cleanup.add(tabChild.id);
        expect(tabChild.parentTaskId).toBe(quick.id);
        await expect(quickCreate).toHaveValue("");

        await shot("c01-admin-authoring.png");
      } finally {
        await cleanupTasks(page, projectId, cleanup);
      }

      const reader = await authenticatedPage(browser, PLAN_READER);
      try {
        const deniedProjectId = await firstProjectId(reader);
        const before = await getReadModel(reader, deniedProjectId);
        const task = before.authored.tasks[0];
        expect(task, "PROJ-041 denied check requires a seeded task").toBeTruthy();
        await openSchedule(reader, deniedProjectId);
        await expect(rowById(reader, task!.id).locator("td").nth(7).getByRole("button")).toHaveCount(0);
        const denied = await browserFetch(reader, `/api/workspace/projects/${deniedProjectId}/planning/preview-command`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
          body: JSON.stringify({
            clientPlanVersion: before.planVersion,
            command: {
              type: "task.update_schedule",
              payload: { taskId: task!.id, plannedStart: "2027-01-20", plannedFinish: "2027-01-25" }
            }
          })
        });
        expect(denied.status).toBe(403);
        expectStableReadModel(await getReadModel(reader, deniedProjectId), before);
        await reader.reload();
        await expect(rowById(reader, task!.id)).toBeVisible();
        await shot("c01-plan-reader-date-denied.png", reader);
      } finally {
        await reader.context().close();
      }
    });
  });

  test("C02 hierarchy, staged batch, and toolbar compensation", async ({ page }, testInfo) => {
    await executeBundle("C02", page, testInfo, async (shot) => {
      const projectId = await loginAndGetProject(page, ADMIN);
      const cleanup = new Set<string>();
      try {
        await openSchedule(page, projectId);
        const first = await quickCreateTask(page, projectId, marker("C02 first"), "Enter"); cleanup.add(first.id);
        const second = await quickCreateTask(page, projectId, marker("C02 second"), "Enter"); cleanup.add(second.id);
        const third = await quickCreateTask(page, projectId, marker("C02 third"), "Enter"); cleanup.add(third.id);

        await page.locator('tr[data-schedule-row-id]').first().click();
        await expect(page.getByTitle("На уровень глубже")).toBeDisabled();
        await rowById(page, second.id).click();
        await planningWrite(page, projectId, "single", () => page.getByTitle("На уровень глубже").click(), {
          readback: (model) => expect(taskById(model, second.id)?.parentTaskId).toBe(first.id),
          reload: async () => expect(rowById(page, second.id)).toBeVisible()
        });
        await shot("proj-035-indent.png");
        await rowById(page, second.id).click();
        await planningWrite(page, projectId, "single", () => page.getByTitle("На уровень выше").click(), {
          readback: (model) => expect(taskById(model, second.id)?.parentTaskId ?? null).toBe(null),
          reload: async () => expect(rowById(page, second.id)).toBeVisible()
        });
        await shot("proj-035-outdent.png");

        await page.getByRole("button", { name: "Пакет", exact: true }).click();
        const versionBeforeBatch = (await getReadModel(page, projectId)).planVersion;
        expect(await countPlanningPosts(page, async () => {
          await stageInlineEdit(page, first.id, 3, `${first.title} staged`);
          await stageInlineEdit(page, second.id, 6, "31");
        })).toBe(0);
        await expect(page.getByRole("button", { name: "Пакет · 2", exact: true })).toBeVisible();
        await expect(page.getByText("накоплено:").locator("..")).toContainText("2");
        await shot("proj-036-batch-staged.png");
        await planningWrite(page, projectId, "batch", () => page.getByRole("button", { name: "Применить пакетом", exact: true }).click(), {
          beforeVersion: versionBeforeBatch,
          expectedVersionDelta: 1,
          readback: (model) => {
            expect(taskById(model, first.id)?.title).toBe(`${first.title} staged`);
            expect(taskById(model, second.id)?.percentComplete).toBe(31);
          },
          reload: async () => expect(rowById(page, first.id)).toContainText(`${first.title} staged`)
        });
        await shot("proj-036-batch-applied.png");

        await page.getByRole("button", { name: "Пакет", exact: true }).click();
        const beforeReset = await getReadModel(page, projectId);
        await stageInlineEdit(page, third.id, 3, `${third.title} discarded`);
        expect(await countPlanningPosts(page, () => page.getByRole("button", { name: "Сбросить", exact: true }).click())).toBe(0);
        expectStableReadModel(await getReadModel(page, projectId), beforeReset);
        await page.reload();
        await expect(rowById(page, third.id)).toContainText(third.title);
        await shot("proj-036-batch-reset.png");

        const undoTitle = `${third.title} reversible`;
        await inlineEdit(page, projectId, third.id, 3, undoTitle, "Enter", false);
        await shot("proj-037-before-undo.png");
        await planningWrite(page, projectId, "batch", () => page.getByRole("button", { name: "Откат", exact: true }).click(), {
          readback: (model) => expect(taskById(model, third.id)?.title).toBe(third.title),
          reload: async () => expect(rowById(page, third.id)).toContainText(third.title)
        });
        await shot("proj-037-after-undo.png");
        const exhaustedUndo = page.getByRole("button", { name: "Откат", exact: true });
        expect(await countPlanningPosts(page, async () => expect(exhaustedUndo).toBeDisabled())).toBe(0);
      } finally {
        await cleanupTasks(page, projectId, cleanup);
      }
    });
  });

  test("C03 view-state parity for admin and planReader", async ({ browser }, testInfo) => {
    await executeBundle("C03", undefined, testInfo, async (shot) => {
      for (const actor of [{ role: "admin" as const, credentials: ADMIN }, { role: "planReader" as const, credentials: PLAN_READER }]) {
        const page = await authenticatedPage(browser, actor.credentials);
        const cleanup = new Set<string>();
        let projectId = "";
        try {
          projectId = await firstProjectId(page);
          await openSchedule(page, projectId);
          const baseline = page.getByTestId("schedule-productivity-workspace").getByRole("link", { name: "Baseline", exact: true });
          await expect(baseline).toHaveAttribute("href", `/projects/${projectId}/baseline`);
          await expect(page.getByRole("button", { name: "Фильтры", exact: true })).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Колонки", exact: true })).toHaveCount(0);

          const widths: number[] = [];
          for (const zoom of ["День", "Неделя", "Месяц"] as const) {
            await page.getByRole("button", { name: zoom, exact: true }).click();
            await expect(page.getByRole("button", { name: zoom, exact: true })).toHaveAttribute("aria-pressed", "true");
            widths.push(await firstGanttBar(page).evaluate((node) => node.getBoundingClientRect().width));
          }
          expect(widths[0]! / widths[1]!).toBeCloseTo(36 / 20, 1);
          expect(widths[1]! / widths[2]!).toBeCloseTo(20 / 8, 1);
          if (actor.role === "planReader") {
            await expect(page.getByTitle("Потяните — изменить длительность")).toHaveCount(0);
            await expect(page.getByTitle("Тяните — % выполнения")).toHaveCount(0);
          }

          const hierarchy = await getReadModel(page, projectId);
          const collapseButtons = page.getByRole("button", { name: "Свернуть группу", exact: true });
          let collapse: { summaryId: string; childId: string } | null = null;
          for (let index = 0; index < await collapseButtons.count(); index += 1) {
            const summaryId = await collapseButtons.nth(index).locator("xpath=ancestor::tr[@data-schedule-row-id]").getAttribute("data-schedule-row-id");
            if (!summaryId) continue;
            const descendants = new Set<string>();
            let frontier = [summaryId];
            while (frontier.length) {
              const parents = new Set(frontier);
              frontier = hierarchy.authored.tasks.filter((task) => task.parentTaskId && parents.has(task.parentTaskId)).map((task) => task.id);
              for (const id of frontier) descendants.add(id);
            }
            const childId = [...descendants][0];
            const linked = hierarchy.authored.dependencies.some((dep) => descendants.has(dep.predecessorTaskId) || descendants.has(dep.successorTaskId));
            if (childId && linked) { collapse = { summaryId, childId }; break; }
          }
          expect(collapse, "C03 requires a collapsible group with a linked descendant").toBeTruthy();
          await rowById(page, collapse!.childId).click();
          await expect(page.getByText("Прогресс", { exact: true }).last()).toBeVisible();
          const rowsBeforeCollapse = await page.locator("[data-schedule-row-id]").count();
          const linksBeforeCollapse = await page.locator("svg[aria-hidden] polyline").count();
          expect(linksBeforeCollapse).toBeGreaterThan(0);
          await rowById(page, collapse!.summaryId).getByRole("button", { name: "Свернуть группу", exact: true }).click();
          expect(await page.locator("[data-schedule-row-id]").count()).toBeLessThan(rowsBeforeCollapse);
          await expect(rowById(page, collapse!.childId)).toHaveCount(0);
          expect(await page.locator("svg[aria-hidden] polyline").count()).toBeLessThan(linksBeforeCollapse);
          await expect(page.getByText("Прогресс", { exact: true }).last()).toBeVisible();
          await page.getByRole("button", { name: "Закрыть", exact: true }).last().click();
          await rowById(page, collapse!.summaryId).getByRole("button", { name: "Развернуть группу", exact: true }).click();
          await expect(rowById(page, collapse!.childId)).toBeVisible();

          const resize = page.getByTitle("Перетащите — изменить ширину колонки").first();
          const header = resize.locator("xpath=..");
          const originalWidth = await header.evaluate((node) => node.getBoundingClientRect().width);
          await dragBy(page, resize, -1000, 0);
          expect(await header.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(36);
          await dragBy(page, resize, 40, 0);
          await dragBy(page, resize, 40, 0);
          await page.reload();
          const remountedWidth = await page.getByTitle("Перетащите — изменить ширину колонки").first().locator("xpath=..").evaluate((node) => node.getBoundingClientRect().width);
          expect(Math.abs(remountedWidth - originalWidth)).toBeLessThanOrEqual(2);

          if (actor.role === "admin") {
            const users = await browserJson<{ users: Array<{ id: string; name: string }> }>(page, "/api/workspace/users");
            const assignee = users.body.users.find((user) => user.id && user.name);
            expect(assignee).toBeTruthy();
            const created = await createModalTask(page, projectId, {
              title: marker("C03 units"), duration: "5", work: "40", assigneeLabel: assignee!.name
            });
            cleanup.add(created.id);
            const beforeUnits = await getReadModel(page, projectId);
            const assignment = beforeUnits.authored.assignments.find((item) => item.taskId === created.id);
            expect(assignment).toBeTruthy();
            expect(created.durationMinutes).toBeGreaterThan(0);
            await rowById(page, created.id).click();
            const units = page.getByText("Единицы", { exact: true }).last().locator("..");
            await planningWrite(page, projectId, "batch", async () => {
              await units.locator("dd").click();
              await units.getByRole("spinbutton").fill("70");
              await units.getByRole("spinbutton").press("Enter");
            }, {
              readback: (model) => {
                const expectedWork = Math.round(created.durationMinutes! * 0.7);
                expect(taskById(model, created.id)?.workMinutes).toBe(expectedWork);
                const updated = model.authored.assignments.find((item) => item.taskId === created.id);
                expect(updated?.id).toBe(assignment!.id);
                expect(updated?.workMinutes).toBe(expectedWork);
              },
              reload: async () => {
                await rowById(page, created.id).click();
                await expect(page.getByText("Единицы", { exact: true }).last()).toBeVisible();
              }
            });
            const restoredUnits = page.getByText("Единицы", { exact: true }).last().locator("..");
            await planningWrite(page, projectId, "batch", async () => {
              await restoredUnits.locator("dd").click();
              await restoredUnits.getByRole("spinbutton").fill("100");
              await restoredUnits.getByRole("spinbutton").press("Enter");
            }, {
              readback: (model) => {
                expect(taskById(model, created.id)?.workMinutes).toBe(created.durationMinutes);
                expect(model.authored.assignments.find((item) => item.taskId === created.id)?.workMinutes).toBe(created.durationMinutes);
              },
              reload: async () => {
                await rowById(page, created.id).click();
                await expect(page.getByText("Единицы", { exact: true }).last()).toBeVisible();
              }
            });
          } else {
            const taskId = await firstGanttBar(page).locator("xpath=..").getAttribute("data-task-id");
            expect(taskId).toBeTruthy();
            await rowById(page, taskId!).click();
            const units = page.getByText("Единицы", { exact: true }).last().locator("..");
            expect(await countPlanningPosts(page, () => units.locator("dd").click())).toBe(0);
            await expect(units.getByRole("spinbutton")).toHaveCount(0);
          }
          await expect(page.getByText("Прогресс", { exact: true }).last()).toBeVisible();
          await expect(page.getByText("Зависимости", { exact: true }).last()).toBeVisible();
          await page.getByRole("button", { name: "Закрыть", exact: true }).last().click();
          await expect(page.getByText("Прогресс", { exact: true }).last()).toHaveCount(0);
          await shot(`c03-${actor.role}.png`, page);
        } finally {
          if (projectId && cleanup.size) await cleanupTasks(page, projectId, cleanup);
          await page.context().close();
        }
      }
    });
  });

  test("C04 literal Gantt pointer gestures", async ({ page }, testInfo) => {
    await executeBundle("C04", page, testInfo, async (shot) => {
      const projectId = await loginAndGetProject(page, ADMIN);
      const cleanup = new Set<string>();
      try {
        await page.setViewportSize({ width: 2400, height: 1000 });
        await openSchedule(page, projectId);
        const initial = await getReadModel(page, projectId);
        const sourceStart = initial.project.plannedStart ?? "2026-06-01";
        const targetStart = new Date(`${sourceStart}T00:00:00Z`); targetStart.setUTCDate(targetStart.getUTCDate() + 10);
        const users = await browserJson<{ users: Array<{ id: string; name: string }> }>(page, "/api/workspace/users");
        const assignee = users.body.users.find((user) => user.id && user.name);
        expect(assignee).toBeTruthy();
        const source = await createModalTask(page, projectId, { title: marker("C04 source"), start: sourceStart, duration: "5", work: "40", assigneeLabel: assignee!.name }); cleanup.add(source.id);
        const target = await createModalTask(page, projectId, { title: marker("C04 target"), start: targetStart.toISOString().slice(0, 10), duration: "4", work: "32" }); cleanup.add(target.id);
        await page.getByRole("button", { name: "День", exact: true }).click();
        await expect(page.getByRole("button", { name: "День", exact: true })).toHaveAttribute("aria-pressed", "true");

        const sourceTimelineRow = ganttTask(page, source.id);
        const sourceBar = sourceTimelineRow.locator(".gantt-bar");
        const noMove = await getReadModel(page, projectId);
        expect(await countPlanningPosts(page, () => dragBy(page, sourceBar, 0, 0))).toBe(0);
        expectStableReadModel(await getReadModel(page, projectId), noMove);

        const progressHandle = sourceTimelineRow.getByTitle("Тяните — % выполнения");
        expect(await pointerHitTitle(progressHandle)).toBe("Тяните — % выполнения");
        const progressTravel = (await sourceBar.boundingBox())!.width;
        const beforeProgressNoOp = await getReadModel(page, projectId);
        expect(await countPlanningPosts(page, () => dragBy(page, progressHandle, -progressTravel, 0, 0.5, 1))).toBe(0);
        expectStableReadModel(await getReadModel(page, projectId), beforeProgressNoOp);
        await planningWrite(page, projectId, "single", () => dragBy(page, progressHandle, progressTravel, 0, 0.5, 1), {
          readback: (model) => expect(taskById(model, source.id)?.percentComplete).toBe(100),
          reload: async () => expect(ganttTask(page, source.id).locator(".gantt-bar")).toBeVisible()
        });
        const atHundred = await getReadModel(page, projectId);
        const atHundredTravel = (await sourceBar.boundingBox())!.width;
        expect(await countPlanningPosts(page, () => dragBy(page, progressHandle, atHundredTravel, 0, 0.5, 1))).toBe(0);
        expectStableReadModel(await getReadModel(page, projectId), atHundred);
        const beforeMove = taskById(await getReadModel(page, projectId), source.id)!;
        await planningWrite(page, projectId, "single", () => dragBy(page, sourceBar, 36, 0), {
          readback: (model) => {
            const moved = taskById(model, source.id)!;
            expect(moved.plannedStart).not.toBe(beforeMove.plannedStart);
            expect(moved.durationMinutes).toBe(beforeMove.durationMinutes);
            expect(moved.workMinutes).toBe(beforeMove.workMinutes);
          },
          reload: async () => expect(ganttTask(page, source.id).locator(".gantt-bar")).toBeVisible()
        });

        const beforeOutside = taskById(await getReadModel(page, projectId), source.id)!;
        await planningWrite(page, projectId, "single", async () => {
          await sourceBar.scrollIntoViewIfNeeded();
          const box = await sourceBar.boundingBox();
          expect(box).toBeTruthy();
          await dragTo(page, sourceBar, box!.x + box!.width / 2 + 36, 5);
        }, {
          readback: (model) => expect(taskById(model, source.id)?.plannedStart).not.toBe(beforeOutside.plannedStart),
          reload: async () => expect(ganttTask(page, source.id).locator(".gantt-bar")).toBeVisible()
        });

        const beforeClamp = taskById(await getReadModel(page, projectId), source.id)!;
        await planningWrite(page, projectId, "single", async () => {
          await sourceBar.scrollIntoViewIfNeeded();
          const box = await sourceBar.boundingBox();
          expect(box).toBeTruthy();
          await dragTo(page, sourceBar, 1, box!.y + box!.height / 2);
        }, {
          readback: (model) => {
            const clamped = taskById(model, source.id)!;
            expect(Date.parse(`${clamped.plannedStart}T00:00:00Z`)).toBeLessThan(Date.parse(`${beforeClamp.plannedStart}T00:00:00Z`));
            expect(Date.parse(`${clamped.plannedStart}T00:00:00Z`)).toBeGreaterThanOrEqual(Date.parse(`${initial.project.plannedStart}T00:00:00Z`));
          },
          reload: async () => expect(ganttTask(page, source.id).locator(".gantt-bar")).toBeVisible()
        });

        const summaryToggle = page.getByRole("button", { name: "Свернуть группу", exact: true }).first();
        const summaryId = await summaryToggle.locator("xpath=ancestor::tr[@data-schedule-row-id]").getAttribute("data-schedule-row-id");
        expect(summaryId).toBeTruthy();
        await expect(ganttTask(page, summaryId!).locator(".gantt-bar")).toHaveCount(0);
        await expect(ganttTask(page, summaryId!).getByTitle("Потяните — изменить длительность")).toHaveCount(0);
        const milestone = page.locator('[data-task-id] [title^="Веха ·"]').first();
        await expect(milestone).toBeVisible();
        const milestoneId = await milestone.locator("xpath=..").getAttribute("data-task-id");
        expect(milestoneId).toBeTruthy();
        await expect(ganttTask(page, milestoneId!).locator(".gantt-bar")).toHaveCount(0);
        await expect(ganttTask(page, milestoneId!).getByTitle("Тяните — % выполнения")).toHaveCount(0);

        const assignmentBeforeResize = (await getReadModel(page, projectId)).authored.assignments.find((item) => item.taskId === source.id)!;
        const leftResize = sourceTimelineRow.getByTitle("Потяните — сдвинуть начало");
        expect(await pointerHitTitle(leftResize, 0.9)).toBe("Потяните — сдвинуть начало");
        const beforeLeft = taskById(await getReadModel(page, projectId), source.id)!;
        await planningWrite(page, projectId, "batch", () => dragBy(page, leftResize, 36, 0, 0.9), {
          readback: (model) => {
            const resized = taskById(model, source.id)!;
            const assignment = model.authored.assignments.find((item) => item.taskId === source.id)!;
            expect(resized.plannedStart).not.toBe(beforeLeft.plannedStart);
            expect(resized.durationMinutes).toBeLessThan(beforeLeft.durationMinutes!);
            expect(resized.workMinutes).toBeLessThan(beforeLeft.workMinutes!);
            expect(assignment.id).toBe(assignmentBeforeResize.id);
            expect(assignment.workMinutes).toBe(resized.workMinutes);
          },
          reload: async () => expect(ganttTask(page, source.id).locator(".gantt-bar")).toBeVisible()
        });

        const rightResize = sourceTimelineRow.getByTitle("Потяните — изменить длительность");
        expect(await pointerHitTitle(rightResize, 0.1)).toBe("Потяните — изменить длительность");
        const beforeRight = taskById(await getReadModel(page, projectId), source.id)!;
        await planningWrite(page, projectId, "batch", () => dragBy(page, rightResize, 36, 0, 0.1), {
          readback: (model) => {
            const resized = taskById(model, source.id)!;
            const assignment = model.authored.assignments.find((item) => item.taskId === source.id)!;
            expect(resized.durationMinutes).toBeGreaterThan(beforeRight.durationMinutes!);
            expect(resized.workMinutes).toBeGreaterThan(beforeRight.workMinutes!);
            expect(assignment.id).toBe(assignmentBeforeResize.id);
            expect(assignment.workMinutes).toBe(resized.workMinutes);
          },
          reload: async () => expect(ganttTask(page, source.id).locator(".gantt-bar")).toBeVisible()
        });
        await planningWrite(page, projectId, "batch", () => dragBy(page, rightResize, -1000, 0, 0.1), {
          readback: (model) => expect(taskById(model, source.id)?.durationMinutes).toBeGreaterThan(0),
          reload: async () => expect(ganttTask(page, source.id).locator(".gantt-bar")).toBeVisible()
        });
        const beforeCollapsedResize = await getReadModel(page, projectId);
        expect(await countPlanningPosts(page, () => dragBy(page, rightResize, -1000, 0, 0.1))).toBe(0);
        expectStableReadModel(await getReadModel(page, projectId), beforeCollapsedResize);



        await page.getByRole("button", { name: "Месяц", exact: true }).click();
        await expect(page.getByRole("button", { name: "Месяц", exact: true })).toHaveAttribute("aria-pressed", "true");
        const monthBar = ganttTask(page, target.id).locator(".gantt-bar");
        expect(await pointerHitTitle(monthBar)).toContain(target.title);
        const beforeMonth = taskById(await getReadModel(page, projectId), target.id)!;
        await planningWrite(page, projectId, "single", () => dragBy(page, monthBar, 8, 0), {
          readback: (model) => expect(taskById(model, target.id)?.plannedStart).not.toBe(beforeMonth.plannedStart),
          reload: async () => expect(ganttTask(page, target.id).locator(".gantt-bar")).toBeVisible()
        });
        await page.getByRole("button", { name: "День", exact: true }).click();
        await expect(page.getByRole("button", { name: "День", exact: true })).toHaveAttribute("aria-pressed", "true");

        const finishHandle = sourceTimelineRow.getByTitle("Тяните от конца → связь ОН/ОО");
        const toolbarBaseline = page.getByTestId("schedule-productivity-workspace").getByRole("link", { name: "Baseline", exact: true });
        expect(await countPlanningPosts(page, () => dragToElement(page, finishHandle, toolbarBaseline))).toBe(0);
        expect(await countPlanningPosts(page, () => dragToElement(page, finishHandle, ganttTask(page, summaryId!)))).toBe(0);
        expect(await countPlanningPosts(page, () => dragToElement(page, finishHandle, sourceTimelineRow))).toBe(0);

        for (const [from, to] of [["finish", "start"], ["finish", "finish"], ["start", "start"], ["start", "finish"]] as const) {
          const fromHandle = sourceTimelineRow.getByTitle(from === "start" ? "Тяните от начала → связь НН/НО" : "Тяните от конца → связь ОН/ОО");
          const targetPoint = ganttTask(page, target.id).locator(".gantt-bar");
          await planningWrite(page, projectId, "single", async () => {
            await fromHandle.scrollIntoViewIfNeeded();
            expect(await pointerHitTitle(fromHandle)).toBe(from === "start" ? "Тяните от начала → связь НН/НО" : "Тяните от конца → связь ОН/ОО");
            const box = await targetPoint.boundingBox();
            expect(box).toBeTruthy();
            await dragTo(page, fromHandle, to === "start" ? box!.x + 2 : box!.x + box!.width - 2, box!.y + box!.height / 2);
          }, {
            readback: (model) => expect(model.authored.dependencies.some((dep) => dep.predecessorTaskId === source.id && dep.successorTaskId === target.id)).toBe(true),
            reload: async () => expect(ganttTask(page, target.id).locator(".gantt-bar")).toBeVisible()
          });
        }
        const dependencies = (await getReadModel(page, projectId)).authored.dependencies.filter((dep) => dep.predecessorTaskId === source.id && dep.successorTaskId === target.id);
        expect(new Set(dependencies.map((dep) => dep.type))).toEqual(new Set(["FS", "FF", "SS", "SF"]));
        const targetBar = ganttTask(page, target.id).locator(".gantt-bar");
        expect(await countPlanningPosts(page, async () => {
          await finishHandle.scrollIntoViewIfNeeded();
          const box = await targetBar.boundingBox();
          expect(box).toBeTruthy();
          await dragTo(page, finishHandle, box!.x + 2, box!.y + box!.height / 2);
        })).toBe(0);

        const cyclePreview = await planningReject(page, projectId, async () => {
          const reverseHandle = ganttTask(page, target.id).getByTitle("Тяните от конца → связь ОН/ОО");
          await reverseHandle.scrollIntoViewIfNeeded();
          const box = await ganttTask(page, source.id).locator(".gantt-bar").boundingBox();
          expect(box).toBeTruthy();
          await dragTo(page, reverseHandle, box!.x + 2, box!.y + box!.height / 2);
        });
        expect(cyclePreview.status()).toBe(200);
        expect(JSON.stringify(await responseJson<Record<string, unknown>>(cyclePreview))).toContain("dependency_cycle_detected");

        const invalidBefore = await getReadModel(page, projectId);
        const invalidCommands = [
          { type: "dependency.upsert", payload: { id: `dep-summary-${RUN_ID}`, predecessorTaskId: source.id, successorTaskId: summaryId!, dependencyType: "FS", lagMinutes: 0 } },
          { type: "dependency.upsert", payload: { id: `dep-duplicate-${RUN_ID}`, predecessorTaskId: source.id, successorTaskId: target.id, dependencyType: "FS", lagMinutes: 0 } }
        ];
        for (const [index, command] of invalidCommands.entries()) {
          const preview = await directApiJson<Record<string, unknown>>(page, `/api/workspace/projects/${projectId}/planning/preview-command`, {
            method: "POST", body: JSON.stringify({ clientPlanVersion: invalidBefore.planVersion, command })
          });
          expect(preview.status).toBe(200);
          expect(JSON.stringify(preview.body)).toContain("planning_command_invalid");
          const apply = await directApiJson<Record<string, unknown>>(page, `/api/workspace/projects/${projectId}/planning/apply-command`, {
            method: "POST", body: JSON.stringify({ clientPlanVersion: invalidBefore.planVersion, idempotencyKey: `c04-invalid-${index}-${RUN_ID}`, command })
          });
          expect(apply.status).toBe(409);
          expect(JSON.stringify(apply.body)).toContain("planning_command_invalid");
          expectStableReadModel(await getReadModel(page, projectId), invalidBefore);
        }

        await shot("c04-gantt-gestures.png");
      } finally {
        await cleanupTasks(page, projectId, cleanup);
      }
    });
  });

  test("C05 dependency and link-lag editors", async ({ page }, testInfo) => {
    await executeBundle("C05", page, testInfo, async (shot) => {
      const projectId = await loginAndGetProject(page, ADMIN);
      const cleanup = new Set<string>();
      try {
        await openSchedule(page, projectId);
        const c05Run = `${RUN_ID}-${Date.now()}`;
        const c05Title = (label: string) => `${label} ${c05Run}`;
        const predecessor = await quickCreateTask(page, projectId, c05Title("C05 predecessor"), "Enter"); cleanup.add(predecessor.id);
        const successor = await quickCreateTask(page, projectId, c05Title("C05 successor"), "Enter"); cleanup.add(successor.id);
        const chainTail = await quickCreateTask(page, projectId, c05Title("C05 chain tail"), "Enter"); cleanup.add(chainTail.id);
        const unrelated = await quickCreateTask(page, projectId, c05Title("C05 unrelated"), "Enter"); cleanup.add(unrelated.id);
        const summaryId = await page.getByRole("button", { name: "Свернуть группу", exact: true }).first().locator("xpath=ancestor::tr[@data-schedule-row-id]").getAttribute("data-schedule-row-id");
        expect(summaryId).toBeTruthy();

        const initialModel = await getReadModel(page, projectId);
        const successorTask = taskById(initialModel, successor.id)!;
        const successorCalendar = initialModel.calendars.find((calendar) => calendar.id === (successorTask.calendarId ?? initialModel.project.calendarId))
          ?? initialModel.calendars[0];
        const workingMinutesPerDay = successorCalendar?.workingMinutesPerDay ?? 480;

        await rowById(page, successor.id).locator("td").nth(10).getByRole("button").click();
        let dependencyEditor = page.getByText("Зависимости (предшественники)", { exact: true }).locator("..");
        const predecessorSelect = dependencyEditor.locator("select").first();
        await expect(predecessorSelect.locator(`option[value="${successor.id}"]`)).toHaveCount(0);
        await expect(predecessorSelect.locator(`option[value="${summaryId}"]`)).toHaveCount(0);
        await expect(predecessorSelect.locator(`option[value="${predecessor.id}"]`)).toHaveCount(1);
        await page.keyboard.press("Escape");
        await expect(dependencyEditor).toBeHidden();
        await expect(page.getByRole("button", { name: /^Пакет/ })).toHaveAttribute("aria-pressed", "false");
        await expect(page.getByRole("button", { name: "Задача", exact: true })).toBeEnabled();

        await planningWrite(page, projectId, "single", async () => {
          await rowById(page, successor.id).locator("td").nth(10).getByRole("button").click();
          dependencyEditor = page.getByText("Зависимости (предшественники)", { exact: true }).locator("..");
          await dependencyEditor.locator("select").first().selectOption(predecessor.id);
          await dependencyEditor.locator("select").nth(1).selectOption("FS");
          await dependencyEditor.getByLabel("Лаг, дней").fill("-2");
          await expect(dependencyEditor.locator("select").first()).toHaveValue(predecessor.id);
          await expect(dependencyEditor.locator("select").nth(1)).toHaveValue("FS");
          await expect(dependencyEditor.getByLabel("Лаг, дней")).toHaveValue("-2");
          const addLink = dependencyEditor.getByRole("button", { name: "Связь", exact: true });
          await expect(addLink).toBeEnabled();
          await addLink.click();
        }, {
          readback: (model) => {
            const dep = model.authored.dependencies.find((item) => item.predecessorTaskId === predecessor.id && item.successorTaskId === successor.id);
            expect(dep?.type).toBe("FS");
            expect(dep?.lagMinutes).toBe(-2 * workingMinutesPerDay);
          },
          reload: async () => expect(rowById(page, successor.id)).toBeVisible()
        });
        const depId = (await getReadModel(page, projectId)).authored.dependencies.find((item) => item.predecessorTaskId === predecessor.id && item.successorTaskId === successor.id)!.id;

        await rowById(page, successor.id).locator("td").nth(10).getByRole("button").click();
        dependencyEditor = page.getByText("Зависимости (предшественники)", { exact: true }).locator("..");
        await expect(dependencyEditor.locator("select").first().locator(`option[value="${predecessor.id}"]`)).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(dependencyEditor).toBeHidden();
        await page.reload();
        await expect(rowById(page, successor.id)).toBeVisible();

        await rowById(page, successor.id).click();
        await expect(page.getByTitle("Изменить связь (тип/лаг)").filter({ hasText: "ОН-2" })).toHaveCount(1);
        await expect(page.getByText(/\+-2/)).toHaveCount(0);

        for (const [type, lagDays] of [["SS", 3], ["FF", 0], ["SF", -1], ["FS", 2]] as const) {
          await rowById(page, successor.id).click();
          const badge = page.getByTitle("Изменить связь (тип/лаг)").first();
          await planningWrite(page, projectId, "single", async () => {
            await badge.scrollIntoViewIfNeeded();
            const badgeBox = await badge.boundingBox();
            expect(badgeBox).toBeTruthy();
            expect(await pointerHitTitle(badge)).toBe("Изменить связь (тип/лаг)");
            await page.mouse.click(badgeBox!.x + badgeBox!.width / 2, badgeBox!.y + badgeBox!.height / 2);
            await expect(page.getByText("Связь — тип и лаг", { exact: true })).toBeVisible();
            await focusLinkLagEditor(page);
            await page.keyboard.press("Home");
            const typeIndex = ["FS", "SS", "FF", "SF"].indexOf(type);
            for (let index = 0; index < typeIndex; index += 1) await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Tab");
            await page.keyboard.press("Control+A");
            await page.keyboard.type(String(lagDays));
            const editorValues = await linkLagEditorValues(page);
            expect(editorValues).toEqual({ type, lag: String(lagDays) });
            await page.keyboard.press("Tab");
            await page.keyboard.press("Tab");
            const activeControl = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim() }));
            expect(activeControl).toEqual({ tag: "BUTTON", text: "Сохранить" });
            await page.keyboard.press("Enter");
          }, {
            readback: (model) => {
              const dep = model.authored.dependencies.find((item) => item.id === depId);
              expect(dep?.id).toBe(depId);
              expect(dep?.type).toBe(type);
              expect(dep?.lagMinutes).toBe(lagDays * workingMinutesPerDay);
            },
            reload: async () => expect(rowById(page, successor.id)).toBeVisible()
          });
        }

        await rowById(page, successor.id).click();
        expect(await countPlanningPosts(page, async () => {
          await page.getByTitle("Изменить связь (тип/лаг)").first().click();
          await page.getByText("Связь — тип и лаг", { exact: true }).locator("..").getByRole("button", { name: "Сохранить", exact: true }).click();
        })).toBe(0);        await page.keyboard.press("Escape");
        await expect(page.getByText("Связь — тип и лаг", { exact: true })).toBeHidden();

        await page.getByRole("button", { name: "Закрыть", exact: true }).click();
        await planningWrite(page, projectId, "single", async () => {
          await rowById(page, chainTail.id).locator("td").nth(10).getByRole("button").click();
          const editor = page.getByText("Зависимости (предшественники)", { exact: true }).locator("..");
          await editor.locator("select").first().selectOption(successor.id);
          await editor.locator("select").nth(1).selectOption("FS");
          await editor.getByLabel("Лаг, дней").fill("0");
          await editor.getByRole("button", { name: "Связь", exact: true }).click();
        }, {
          readback: (model) => expect(model.authored.dependencies.some((item) => item.predecessorTaskId === successor.id && item.successorTaskId === chainTail.id)).toBe(true),
          reload: async () => expect(rowById(page, chainTail.id)).toBeVisible()
        });

        await rowById(page, predecessor.id).click();
        await expect(page.getByTitle("Изменить связь (тип/лаг)")).toHaveCount(1);
        await rowById(page, successor.id).click();
        await expect(page.getByTitle("Изменить связь (тип/лаг)")).toHaveCount(2);
        await rowById(page, chainTail.id).click();
        await expect(page.getByTitle("Изменить связь (тип/лаг)")).toHaveCount(1);
        await rowById(page, unrelated.id).click();
        await expect(page.getByTitle("Изменить связь (тип/лаг)")).toHaveCount(0);
        await page.getByRole("button", { name: "Закрыть", exact: true }).click();

        const cycleBefore = await getReadModel(page, projectId);
        const cycleCommand = {
          type: "dependency.upsert",
          payload: {
            id: `dep-c05-cycle-${RUN_ID}`,
            predecessorTaskId: chainTail.id,
            successorTaskId: predecessor.id,
            dependencyType: "FS",
            lagMinutes: 0
          }
        };
        const cyclePreview = await planningReject(page, projectId, async () => {
          await rowById(page, predecessor.id).locator("td").nth(10).getByRole("button").click();
          const editor = page.getByText("Зависимости (предшественники)", { exact: true }).locator("..");
          await editor.locator("select").first().selectOption(chainTail.id);
          await editor.locator("select").nth(1).selectOption("FS");
          await editor.getByRole("button", { name: "Связь", exact: true }).click();
        });
        expect(cyclePreview.status()).toBe(200);
        expect(JSON.stringify(await responseJson<Record<string, unknown>>(cyclePreview))).toContain("dependency_cycle_detected");
        const cycleApply = await directApiJson<Record<string, unknown>>(page, `/api/workspace/projects/${projectId}/planning/apply-command`, {
          method: "POST",
          body: JSON.stringify({ clientPlanVersion: cycleBefore.planVersion, idempotencyKey: `c05-cycle-${RUN_ID}`, command: cycleCommand })
        });
        expect(cycleApply.status).toBe(409);
        expect(JSON.stringify(cycleApply.body)).toContain("dependency_cycle_detected");
        expectStableReadModel(await getReadModel(page, projectId), cycleBefore);

        await rowById(page, predecessor.id).click();
        await page.getByRole("button", { name: "Закрыть", exact: true }).click();
        await planningWrite(page, projectId, "single", async () => {
          await page.getByTitle("Изменить связь (тип/лаг)").first().click();
          await page.getByText("Связь — тип и лаг", { exact: true }).locator("..").getByRole("button", { name: "Удалить", exact: true }).click();
        }, {
          readback: (model) => expect(model.authored.dependencies.some((item) => item.id === depId)).toBe(false),
          reload: async () => expect(rowById(page, predecessor.id)).toBeVisible()
        });
        await shot("c05-dependencies.png");
      } finally {
        await cleanupTasks(page, projectId, cleanup);
      }
    });
  });

  test("C06 delete, validation rollback, optimistic state, and honest empty plan", async ({ page }, testInfo) => {
    await executeBundle("C06", page, testInfo, async (shot) => {
      const projectId = await loginAndGetProject(page, ADMIN);
      const cleanup = new Set<string>();
      try {
        await openSchedule(page, projectId);
        const users = await browserJson<{ users: Array<{ id: string; name: string }> }>(page, "/api/workspace/users");
        expect(users.status).toBe(200);
        const liveUser = users.body.users.find((user) => user.id && user.name);
        expect(liveUser, "C06 requires a live assignable workspace user").toBeTruthy();

        const parent = await quickCreateTask(page, projectId, marker("C06 parent"), "Enter"); cleanup.add(parent.id);
        const child = await quickCreateTask(page, projectId, marker("C06 child"), "Tab"); cleanup.add(child.id);
        const grandchild = await quickCreateTask(page, projectId, marker("C06 grandchild"), "Tab"); cleanup.add(grandchild.id);
        const external = await quickCreateTask(page, projectId, marker("C06 external"), "Enter"); cleanup.add(external.id);
        const hierarchy = await getReadModel(page, projectId);
        expect(taskById(hierarchy, child.id)?.parentTaskId).toBe(parent.id);
        expect(taskById(hierarchy, grandchild.id)?.parentTaskId).toBe(child.id);
        expect(taskById(hierarchy, external.id)?.parentTaskId ?? null).toBeNull();

        await planningWrite(page, projectId, "single", async () => {
          await rowById(page, grandchild.id).locator("td").nth(9).getByRole("button").click();
          const picker = page.getByText("Назначить сотрудника", { exact: true }).locator("..");
          await picker.getByRole("button", { name: liveUser!.name }).click();
        }, {
          readback: (model) => expect(model.authored.assignments.some((item) => item.taskId === grandchild.id && item.resourceId === liveUser!.id)).toBe(true),
          reload: async () => expect(rowById(page, grandchild.id)).toBeVisible()
        });
        await planningWrite(page, projectId, "single", async () => {
          await rowById(page, external.id).locator("td").nth(10).getByRole("button").click();
          const editor = page.getByText("Зависимости (предшественники)", { exact: true }).locator("..");
          await editor.locator("select").first().selectOption(grandchild.id);
          await editor.locator("select").nth(1).selectOption("FS");
          await editor.getByLabel("Лаг, дней").fill("0");
          await editor.getByRole("button", { name: "Связь", exact: true }).click();
        }, {
          readback: (model) => expect(model.authored.dependencies.some((item) => item.predecessorTaskId === grandchild.id && item.successorTaskId === external.id)).toBe(true),
          reload: async () => expect(rowById(page, external.id)).toBeVisible()
        });

        const beforeReject = await getReadModel(page, projectId);
        expect(await countPlanningPosts(page, async () => {
          const row = rowById(page, grandchild.id);
          await row.locator("td").nth(4).dblclick();
          await row.locator("td").nth(4).getByRole("spinbutton").fill("-10");
          await row.locator("td").nth(4).getByRole("spinbutton").press("Enter");
        })).toBe(0);
        await expect(page.getByText("Длительность задачи должна быть больше 0 (для вехи — пункт меню «Сделать вехой»)", { exact: false })).toBeVisible();
        await expect(rowById(page, grandchild.id)).toHaveClass(/bg-\[var\(--danger-soft\)\]/);
        expectStableReadModel(await getReadModel(page, projectId), beforeReject);

        const rejectedTitle = external.title + " rejected";
        const syntheticBefore = await getReadModel(page, projectId);
        await page.route("**/api/workspace/projects/" + projectId + "/planning/apply-command", (route) => route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "planning_precondition_failed",
            validationIssues: [
              { code: "c06_row_one", severity: "error", message: "Ошибка строки 1", entity: { kind: "task", id: external.id } },
              { code: "c06_row_two", severity: "error", message: "Ошибка строки 2", entity: { kind: "task", id: external.id } },
              { code: "c06_plan", severity: "error", message: "Ошибка плана", entity: null }
            ]
          })
        }), { times: 1 });
        const rejectedPreviewPromise = waitForPlanningResponse(page, projectId, "preview-command");
        const rejectedApplyPromise = waitForPlanningResponse(page, projectId, "apply-command");
        const nameCell = rowById(page, external.id).locator("td").nth(3);
        await nameCell.dblclick();
        await nameCell.locator("input").fill(rejectedTitle);
        await nameCell.locator("input").press("Enter");
        expect((await rejectedPreviewPromise).status()).toBe(200);
        await expect(rowById(page, external.id)).toContainText(rejectedTitle);
        await confirmPlanningPreview(page);
        expect((await rejectedApplyPromise).status()).toBe(409);
        expectStableReadModel(await getReadModel(page, projectId), syntheticBefore);
        await expect(rowById(page, external.id)).toContainText(external.title);
        await expect(rowById(page, external.id)).toHaveClass(/bg-\[var\(--danger-soft\)\]/);
        const validationPanel = page.getByTestId("schedule-validation-errors");
        await expect(validationPanel).toContainText("Ошибка строки 1");
        await expect(validationPanel).toContainText("Ошибка строки 2");
        await expect(validationPanel).toContainText("План — Ошибка плана");
        await shot("c06-validation-rollback.png");

        const recoveredTitle = external.title + " recovered";
        await inlineEdit(page, projectId, external.id, 3, recoveredTitle, "Enter");
        await expect(page.getByTestId("schedule-validation-errors")).toHaveCount(0);

        const optimisticBefore = await getReadModel(page, projectId);
        const optimisticTitle = recoveredTitle + " optimistic";
        let releasePreview!: () => void;
        let markPreviewIntercepted!: () => void;
        const previewGate = new Promise<void>((resolve) => { releasePreview = resolve; });
        const previewIntercepted = new Promise<void>((resolve) => { markPreviewIntercepted = resolve; });
        await page.route("**/api/workspace/projects/" + projectId + "/planning/preview-command", async (route) => {
          markPreviewIntercepted();
          await previewGate;
          const target = new URL(route.request().url());
          target.port = "4192";
          const response = await route.fetch({ url: target.toString() });
          await route.fulfill({ response });
        }, { times: 1 });
        const optimisticPreviewPromise = waitForPlanningResponse(page, projectId, "preview-command");
        const optimisticApplyPromise = waitForPlanningResponse(page, projectId, "apply-command");
        const optimisticCell = rowById(page, external.id).locator("td").nth(3);
        await optimisticCell.dblclick();
        await optimisticCell.locator("input").fill(optimisticTitle);
        await optimisticCell.locator("input").press("Enter");
        await previewIntercepted;
        await expect(rowById(page, external.id)).toContainText(optimisticTitle);
        const busyProgress = String(((taskById(optimisticBefore, external.id)?.percentComplete ?? 0) + 17) % 100);
        expect(await countPlanningPosts(page, async () => {
          const progressCell = rowById(page, external.id).locator("td").nth(6);
          await progressCell.dblclick();
          await progressCell.locator("input").fill(busyProgress);
          await progressCell.locator("input").press("Enter");
        })).toBe(0);
        await expect(page.getByText("Дождитесь завершения текущей операции", { exact: true })).toBeVisible();
        releasePreview();
        expect((await optimisticPreviewPromise).status()).toBe(200);
        await confirmPlanningPreview(page);
        const optimisticApply = await optimisticApplyPromise;
        expect(optimisticApply.status()).toBe(200);
        const optimisticBody = await responseJson<Record<string, unknown>>(optimisticApply);
        const optimisticVersion = responseVersion(optimisticBody);
        const optimisticAfter = await getReadModel(page, projectId);
        expect(optimisticAfter.planVersion).toBe(optimisticVersion);
        expect(optimisticAfter.planVersion).toBe(optimisticBefore.planVersion + 1);
        expect(taskById(optimisticAfter, external.id)?.title).toBe(optimisticTitle);
        expect(taskById(optimisticAfter, external.id)?.percentComplete).toBe(taskById(optimisticBefore, external.id)?.percentComplete);
        await expect(page.getByText("Коммит v" + optimisticVersion + " применён · затронуто задач: 1", { exact: true })).toBeVisible();
        await expect(rowById(page, external.id)).toHaveClass(/bg-\[var\(--success-soft\)\]/);
        await shot("c06-optimistic-commit.png");
        await page.reload();
        await expect(rowById(page, external.id)).toContainText(optimisticTitle);
        expectStableReadModel(await getReadModel(page, projectId), optimisticAfter);

        await rowById(page, parent.id).click({ button: "right" });
        await page.getByRole("menuitem", { name: "Удалить", exact: true }).click();
        const deletion = await planningWrite(page, projectId, "batch", () => page.getByRole("dialog", { name: new RegExp("Удалить задачу") }).getByRole("button", { name: "Удалить", exact: true }).click(), {
          readback: (model) => {
            for (const id of [parent.id, child.id, grandchild.id]) {
              expect(taskById(model, id)).toBeUndefined();
              expect(model.authored.assignments.some((item) => item.taskId === id)).toBe(false);
              expect(model.authored.dependencies.some((item) => item.predecessorTaskId === id || item.successorTaskId === id)).toBe(false);
            }
            expect(taskById(model, external.id)).toBeTruthy();
          },
          reload: async () => expect(rowById(page, parent.id)).toHaveCount(0)
        });
        const deletionEnvelope = deletion.apply.request().postDataJSON() as { commands?: Array<{ type?: string; payload?: { taskId?: string } }> };
        expect(deletionEnvelope.commands?.map((command) => command.payload?.taskId)).toEqual([grandchild.id, child.id, parent.id]);
        expect(deletionEnvelope.commands?.every((command) => command.type === "task.delete_or_archive")).toBe(true);
        cleanup.delete(parent.id); cleanup.delete(child.id); cleanup.delete(grandchild.id);

        await planningWrite(page, projectId, "single", async () => {
          await rowById(page, external.id).locator("td").nth(9).getByRole("button").click();
          const picker = page.getByText("Назначить сотрудника", { exact: true }).locator("..");
          await picker.getByRole("button", { name: liveUser!.name }).click();
        }, {
          readback: (model) => expect(model.authored.assignments.some((item) => item.taskId === external.id)).toBe(true),
          reload: async () => expect(rowById(page, external.id)).toBeVisible()
        });
        await rowById(page, external.id).click({ button: "right" });
        await page.getByRole("menuitem", { name: "Удалить", exact: true }).click();
        await planningWrite(page, projectId, "single", () => page.getByRole("dialog", { name: new RegExp("Удалить задачу") }).getByRole("button", { name: "Удалить", exact: true }).click(), {
          readback: (model) => {
            expect(taskById(model, external.id)).toBeUndefined();
            expect(model.authored.assignments.some((item) => item.taskId === external.id)).toBe(false);
            expect(model.authored.dependencies.some((item) => item.predecessorTaskId === external.id || item.successorTaskId === external.id)).toBe(false);
          },
          reload: async () => expect(rowById(page, external.id)).toHaveCount(0)
        });
        cleanup.delete(external.id);
        await expect(page.getByRole("button", { name: "Откат", exact: true })).toBeDisabled();

        const projects = await browserJson<{ projects: Array<{ id: string }> }>(page, "/api/workspace/projects");
        const emptyProjectId = projects.body.projects.find((project) => project.id !== projectId)?.id;
        expect(emptyProjectId, "C06 requires a second disposable project for destructive empty-plan traversal").toBeTruthy();
        await openSchedule(page, emptyProjectId!, false);
        if ((await getReadModel(page, emptyProjectId!)).authored.tasks.length === 0) {
          await quickCreateTask(page, emptyProjectId!, marker("C06 last task"), "Enter");
        }
        while (true) {
          const model = await getReadModel(page, emptyProjectId!);
          if (model.authored.tasks.length === 0) break;
          const root = model.authored.tasks.find((task) => !task.parentTaskId || !model.authored.tasks.some((candidate) => candidate.id === task.parentTaskId));
          expect(root, "empty-plan traversal requires a visible root task").toBeTruthy();
          const subtree = new Set<string>([root!.id]);
          let expanded = true;
          while (expanded) {
            expanded = false;
            for (const task of model.authored.tasks) {
              if (task.parentTaskId && subtree.has(task.parentTaskId) && !subtree.has(task.id)) {
                subtree.add(task.id);
                expanded = true;
              }
            }
          }
          await rowById(page, root!.id).click({ button: "right" });
          await page.getByRole("menuitem", { name: "Удалить", exact: true }).click();
          const remaining = model.authored.tasks.length - subtree.size;
          await planningWrite(page, emptyProjectId!, subtree.size > 1 ? "batch" : "single", () => page.getByRole("dialog", { name: new RegExp("Удалить задачу") }).getByRole("button", { name: "Удалить", exact: true }).click(), {
            readback: (next) => {
              expect(next.authored.tasks).toHaveLength(remaining);
              for (const id of subtree) {
                expect(taskById(next, id)).toBeUndefined();
                expect(next.authored.assignments.some((item) => item.taskId === id)).toBe(false);
                expect(next.authored.dependencies.some((item) => item.predecessorTaskId === id || item.successorTaskId === id)).toBe(false);
              }
            },
            reload: async () => remaining === 0
              ? expect(page.getByText("В плане пока нет задач", { exact: true })).toBeVisible()
              : expect(page.locator("[data-schedule-row-id]").first()).toBeVisible()
          });
        }
        await expect(page.locator("[data-schedule-row-id]")).toHaveCount(0);
        await expect(page.getByText("В плане пока нет задач", { exact: true })).toBeVisible();
        await expect(page.getByRole("textbox", { name: "Создать задачу (Enter; Tab — подзадачей)" })).toBeVisible();
        await shot("c06-honest-empty-plan.png");
      } finally {
        await cleanupTasks(page, projectId, cleanup);
      }
    });
  });
  test("C07 commit workflow and concurrent conflict", async ({ browser }, testInfo) => {
    await executeBundle("C07", undefined, testInfo, async (shot) => {
      const page = await authenticatedPage(browser, ADMIN);
      const cleanup = new Set<string>();
      try {
        const projectId = await firstProjectId(page);
        await openSchedule(page, projectId);
        const versions: number[] = [(await getReadModel(page, projectId)).planVersion];
        const c07Run = `${RUN_ID}-${Date.now()}`;
        const one = await quickCreateTask(page, projectId, `C07 one ${c07Run}`, "Enter"); cleanup.add(one.id); versions.push((await getReadModel(page, projectId)).planVersion);
        const two = await quickCreateTask(page, projectId, `C07 two ${c07Run}`, "Enter"); cleanup.add(two.id); versions.push((await getReadModel(page, projectId)).planVersion);
        await inlineEdit(page, projectId, one.id, 3, `${one.title} renamed`, "Enter"); versions.push((await getReadModel(page, projectId)).planVersion);
        await inlineEdit(page, projectId, one.id, 4, "13", "Enter"); versions.push((await getReadModel(page, projectId)).planVersion);
        await inlineEdit(page, projectId, one.id, 5, "24", "Enter"); versions.push((await getReadModel(page, projectId)).planVersion);
        await inlineEdit(page, projectId, one.id, 6, "55", "Enter"); versions.push((await getReadModel(page, projectId)).planVersion);
        expect(versions.every((value, index) => index === 0 || value === versions[index - 1]! + 1)).toBe(true);

        await page.goto(`/projects/${projectId}/commits`);
        await expect(page.getByRole("heading", { name: "Коммиты плана" })).toBeVisible();
        const beforeRevert = await getReadModel(page, projectId);
        const revertResponsePromise = waitForRevertResponse(page, projectId);
        await page.getByRole("button", { name: "Откатить последний", exact: true }).click();
        // откат идёт через тот же превью-гейт, что и правки плана
        await confirmPlanningPreview(page);
        const revertResponse = await revertResponsePromise;
        expect(revertResponse.status()).toBe(200);
        const revertEnvelope = revertResponse.request().postDataJSON() as {
          targetCommitId?: unknown;
          clientPlanVersion?: unknown;
          idempotencyKey?: unknown;
        };
        expect(revertEnvelope.targetCommitId).toEqual(expect.any(String));
        expect(revertEnvelope.clientPlanVersion).toBe(beforeRevert.planVersion);
        expect(revertEnvelope.idempotencyKey).toEqual(expect.stringMatching(/^planning-revert-/));
        const revertBody = await responseJson<Record<string, unknown>>(revertResponse);
        expect(revertBody.reverted).toBe(revertEnvelope.targetCommitId);
        const afterRevert = await getReadModel(page, projectId);
        expect(afterRevert.planVersion).toBe(beforeRevert.planVersion + 1);
        expect(taskById(afterRevert, one.id)?.percentComplete).toBe(0);
        versions.push(afterRevert.planVersion);

        const revertPath = `/api/workspace/projects/${projectId}/planning/revert-last`;
        const [replayLeft, replayRight] = await Promise.all([
          directApiJson<Record<string, unknown>>(page, revertPath, { method: "POST", body: JSON.stringify(revertEnvelope) }),
          directApiJson<Record<string, unknown>>(page, revertPath, { method: "POST", body: JSON.stringify(revertEnvelope) })
        ]);
        expect(replayLeft.status).toBe(200);
        expect(replayRight.status).toBe(200);
        expect(replayLeft.body).toEqual(revertBody);
        expect(replayRight.body).toEqual(revertBody);
        expectStableReadModel(await getReadModel(page, projectId), afterRevert);

        const divergentRevert = await directApiJson<{ error: string }>(page, revertPath, {
          method: "POST",
          body: JSON.stringify({ ...revertEnvelope, targetCommitId: `${String(revertEnvelope.targetCommitId)}-different` })
        });
        expect(divergentRevert).toEqual({ status: 409, body: { error: "idempotency_key_conflict" } });
        for (const invalid of [
          { clientPlanVersion: afterRevert.planVersion, idempotencyKey: `c07-missing-target-${RUN_ID}` },
          { targetCommitId: revertEnvelope.targetCommitId, clientPlanVersion: afterRevert.planVersion }
        ]) {
          const malformed = await directApiJson<{ error: string }>(page, revertPath, { method: "POST", body: JSON.stringify(invalid) });
          expect(malformed).toEqual({ status: 400, body: { error: "planning_revert_invalid" } });
        }
        expectStableReadModel(await getReadModel(page, projectId), afterRevert);
        await page.reload();
        await expect(page.getByRole("heading", { name: "Коммиты плана" })).toBeVisible();
        expectStableReadModel(await getReadModel(page, projectId), afterRevert);
        await openSchedule(page, projectId);

        await planningWrite(page, projectId, "single", async () => {
          await rowById(page, two.id).locator("td").nth(10).getByRole("button").click();
          const editor = page.getByText("Зависимости (предшественники)", { exact: true }).locator("..");
          await editor.locator("select").first().selectOption(one.id);
          await editor.locator("select").nth(1).selectOption("FS");
          await editor.getByLabel("Лаг, дней").fill("0");
          await editor.getByRole("button", { name: "Связь", exact: true }).click();
        }, {
          readback: (model) => expect(model.authored.dependencies.some((item) => item.predecessorTaskId === one.id && item.successorTaskId === two.id)).toBe(true),
          reload: async () => expect(rowById(page, two.id)).toBeVisible()
        });
        versions.push((await getReadModel(page, projectId)).planVersion);

        await rowById(page, two.id).click({ button: "right" });
        await planningWrite(page, projectId, "batch", () => page.getByRole("menuitem", { name: "Сделать вехой", exact: true }).click(), {
          readback: (model) => {
            expect(taskById(model, two.id)?.durationMinutes).toBe(0);
            expect(model.authored.assignments.some((item) => item.taskId === two.id)).toBe(false);
          },
          reload: async () => expect(rowById(page, two.id)).toContainText("0 дн")
        });
        versions.push((await getReadModel(page, projectId)).planVersion);

        const three = await quickCreateTask(page, projectId, "C07 three " + c07Run, "Enter");
        cleanup.add(three.id);
        versions.push((await getReadModel(page, projectId)).planVersion);
        const threeRenamed = three.title + " renamed";
        await inlineEdit(page, projectId, three.id, 3, threeRenamed, "Enter");
        versions.push((await getReadModel(page, projectId)).planVersion);
        await rowById(page, three.id).click({ button: "right" });
        await page.getByRole("menuitem", { name: "Удалить", exact: true }).click();
        await planningWrite(page, projectId, "single", () => page.getByRole("dialog", { name: new RegExp("Удалить задачу") }).getByRole("button", { name: "Удалить", exact: true }).click(), {
          readback: (model) => {
            expect(taskById(model, three.id)).toBeUndefined();
            expect(model.authored.dependencies.some((item) => item.predecessorTaskId === three.id || item.successorTaskId === three.id)).toBe(false);
          },
          reload: async () => expect(rowById(page, three.id)).toHaveCount(0)
        });
        cleanup.delete(three.id);
        versions.push((await getReadModel(page, projectId)).planVersion);
        expect(versions.every((value, index) => index === 0 || value === versions[index - 1]! + 1)).toBe(true);

        const rejectBefore = await getReadModel(page, projectId);
        const rejectCommand = { type: "task.update_work_model", payload: { taskId: one.id, taskType: "fixed_duration", effortDriven: false, durationMinutes: -1, workMinutes: 0 } };
        const rejectedPreview = await directApiJson<Record<string, unknown>>(page, "/api/workspace/projects/" + projectId + "/planning/preview-command", {
          method: "POST",
          body: JSON.stringify({ clientPlanVersion: rejectBefore.planVersion, command: rejectCommand })
        });
        expect(rejectedPreview.status).toBe(200);
        expect(JSON.stringify(rejectedPreview.body)).toContain("planning_command_invalid");
        const rejectedApply = await directApiJson<Record<string, unknown>>(page, "/api/workspace/projects/" + projectId + "/planning/apply-command", {
          method: "POST",
          body: JSON.stringify({ clientPlanVersion: rejectBefore.planVersion, idempotencyKey: "c07-reject-" + RUN_ID, command: rejectCommand })
        });
        expect(rejectedApply.status).toBe(409);
        expectStableReadModel(await getReadModel(page, projectId), rejectBefore);

        const remote = await authenticatedPage(browser, ADMIN);
        try {
          await openSchedule(remote, projectId);
          const staleBase = await getReadModel(page, projectId);
          const dirtyProgressCell = rowById(page, one.id).locator("td").nth(6);
          await dirtyProgressCell.dblclick();
          await dirtyProgressCell.getByRole("spinbutton").fill("56");
          const firstRemoteTitle = two.title + " remote";
          await inlineEdit(remote, projectId, two.id, 3, firstRemoteTitle, "Enter");
          const applyPostsBefore = await countPlanningPosts(page, async () => {
            const conflict = waitForPlanningResponse(page, projectId, "preview-command");
            await dirtyProgressCell.getByRole("spinbutton").press("Enter");
            expect((await conflict).status()).toBe(409);
            await expect(page.getByText("Конфликт версий плана — перезагружено", { exact: true })).toBeVisible();
          });
          expect(applyPostsBefore).toBe(1);
          const authoritative = await getReadModel(page, projectId);
          expect(authoritative.planVersion).toBe(staleBase.planVersion + 1);
          expect(taskById(authoritative, two.id)?.title).toBe(firstRemoteTitle);
          expect(taskById(authoritative, one.id)?.percentComplete).toBe(taskById(staleBase, one.id)?.percentComplete);
          await page.reload();
          await expect(rowById(page, two.id)).toContainText(firstRemoteTitle);
          versions.push(authoritative.planVersion);

          await page.getByRole("button", { name: /^Пакет/ }).click();
          expect(await countPlanningPosts(page, async () => {
            await stageInlineEdit(page, one.id, 3, one.title + " stale batch");
            await stageInlineEdit(page, one.id, 6, "57");
          })).toBe(0);
          await expect(page.getByRole("button", { name: "Применить пакетом", exact: true })).toBeVisible();
          const secondRemoteTitle = two.title + " remote batch";
          await inlineEdit(remote, projectId, two.id, 3, secondRemoteTitle, "Enter");
          const batchConflict = waitForPlanningResponse(page, projectId, "preview-command-batch");
          const batchPosts = await countPlanningPosts(page, async () => {
            await page.getByRole("button", { name: "Применить пакетом", exact: true }).click();
            expect((await batchConflict).status()).toBe(409);
            await expect(page.getByText("Конфликт версий плана — пакет сброшен, данные перезагружены", { exact: true })).toBeVisible();
          });
          expect(batchPosts).toBe(1);
          const afterBatchConflict = await getReadModel(page, projectId);
          expect(afterBatchConflict.planVersion).toBe(authoritative.planVersion + 1);
          expect(taskById(afterBatchConflict, two.id)?.title).toBe(secondRemoteTitle);
          expect(taskById(afterBatchConflict, one.id)?.title).toBe(one.title + " renamed");
          expect(taskById(afterBatchConflict, one.id)?.percentComplete).toBe(taskById(authoritative, one.id)?.percentComplete);
          await expect(page.getByRole("button", { name: "Применить пакетом", exact: true })).toHaveCount(0);
          await expect(rowById(page, one.id)).toContainText(one.title + " renamed");
          versions.push(afterBatchConflict.planVersion);

          const retryTitle = one.title + " batch retry";
          expect(await countPlanningPosts(page, async () => {
            await stageInlineEdit(page, one.id, 3, retryTitle);
            await stageInlineEdit(page, one.id, 6, "58");
          })).toBe(0);
          const retry = await planningWrite(page, projectId, "batch", () => page.getByRole("button", { name: "Применить пакетом", exact: true }).click(), {
            readback: (model) => {
              expect(taskById(model, one.id)?.title).toBe(retryTitle);
              expect(taskById(model, one.id)?.percentComplete).toBe(58);
              expect(taskById(model, two.id)?.title).toBe(secondRemoteTitle);
            },
            reload: async () => expect(rowById(page, one.id)).toContainText(retryTitle)
          });
          versions.push(retry.after.planVersion);
          expect(versions.every((value, index) => index === 0 || value === versions[index - 1]! + 1)).toBe(true);
          await page.getByRole("button", { name: /^Пакет/ }).click();        } finally {
          await remote.context().close();
        }
        await page.goto(`/projects/${projectId}/commits`);
        await expect(page.getByRole("heading", { name: "Коммиты плана" })).toBeVisible();
        for (const version of versions.slice(1)) await expect(page.getByText(`v${version}`, { exact: true }).first()).toBeVisible();
        await shot("c07-workflow-conflict.png", page);
      } finally {
        await cleanupTasks(page, await firstProjectId(page), cleanup);
        await page.context().close();
      }
    });
  });

  test("C08 live timeline geometry and role permissions", async ({ browser }, testInfo) => {
    await executeBundle("C08", undefined, testInfo, async (shot) => {
      for (const actor of [{ role: "admin" as const, credentials: ADMIN }, { role: "planReader" as const, credentials: PLAN_READER }]) {
        const page = await authenticatedPage(browser, actor.credentials);
        const cleanup = new Set<string>();
        try {
          await page.clock.install({ time: new Date("2028-04-28T12:00:00Z") });
          const projectId = await firstProjectId(page);
          const projects = await browserJson<{ projects: Array<{ id: string; title: string }> }>(page, "/api/workspace/projects");
          await openSchedule(page, projectId);
          const projectName = projects.body.projects.find((project) => project.id === projectId)?.title;
          expect(projectName).toBeTruthy();
          await expect(page.getByRole("heading", { name: projectName!, exact: true })).toBeVisible();
          const liveModel = await getReadModel(page, projectId);
          const baselineLabel = liveModel.baselineComparison?.label ?? "Базовый план";
          await expect(page.getByText(baselineLabel, { exact: true })).toBeVisible();

          const todayIso = "2028-04-28";
          const isoDay = (iso: string) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86_400_000);
          const validStarts = [
            todayIso,
            liveModel.project.plannedStart,
            ...liveModel.authored.tasks.map((task) => task.plannedStart)
          ].filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
          const earliestDay = Math.min(...validStarts.map(isoDay));
          const utcDow = new Date(earliestDay * 86_400_000).getUTCDay();
          const originDay = earliestDay - ((utcDow === 0 ? 7 : utcDow) - 1);
          const originDate = new Date(originDay * 86_400_000);
          const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
          const month = months[originDate.getUTCMonth()]!;
          const expectedFirstWeek = month[0]!.toUpperCase() + month.slice(1) + " " + String(originDate.getUTCDate()).padStart(2, "0");
          const readGeometry = () => page.getByTitle("Сегодня").evaluate((marker) => {
            const header = marker.parentElement?.querySelector<HTMLElement>("div.sticky.top-0 span");
            if (!header) throw new Error("timeline_week_header_missing");
            return {
              left: Number.parseFloat((marker as HTMLElement).style.left),
              weekWidth: header.getBoundingClientRect().width,
              label: header.textContent?.trim() ?? ""
            };
          });
          const geometry = await readGeometry();
          expect(geometry.weekWidth).toBeGreaterThan(0);
          expect(geometry.label).toBe(expectedFirstWeek);
          expect(geometry.left).toBeCloseTo((isoDay(todayIso) - originDay) * (geometry.weekWidth / 7), 1);
          await page.reload();
          await expect(page.getByTestId("schedule-productivity-workspace")).toBeVisible();
          const reloadedGeometry = await readGeometry();
          expect(reloadedGeometry).toEqual(geometry);

          const visible = await page.locator("body").innerText();
          expect(visible).not.toContain("PROJECT");
          expect(visible).not.toContain("RESOURCES");
          expect(visible).not.toContain("2026-04-28");

          if (actor.role === "admin") {
            const users = await browserJson<{ users: Array<{ id: string; name: string }> }>(page, "/api/workspace/users");
            expect(users.status).toBe(200);
            const liveUser = users.body.users.find((user) => user.id && user.name);
            expect(liveUser, "C08 admin request needs a live user from the API").toBeTruthy();
            const title = marker("C08 live assignment");
            const write = await planningWrite(page, projectId, "batch", async () => {
              await page.getByRole("button", { name: "Задача", exact: true }).click();
              const dialog = page.getByRole("dialog", { name: "Новая задача" });
              await dialog.getByLabel("Название", { exact: true }).fill(title);
              await dialog.locator("label").filter({ hasText: "Исполнитель" }).locator("select").selectOption({ label: liveUser!.name });
              await dialog.getByRole("button", { name: "Создать", exact: true }).click();
            }, {
              readback: (model) => {
                const task = taskByTitle(model, title);
                expect(task).toBeTruthy();
                expect(model.authored.assignments.some((item) => item.taskId === task!.id && item.resourceId === liveUser!.id)).toBe(true);
                cleanup.add(task!.id);
              },
              reload: async () => expect(page.getByText(title, { exact: true }).first()).toBeVisible()
            });
            const requestEnvelope = write.apply.request().postDataJSON() as Record<string, unknown>;
            expect(JSON.stringify(requestEnvelope)).toContain(liveUser!.id);
            const persisted = await getReadModel(page, projectId);
            const persistedTask = taskByTitle(persisted, title);
            expect(persistedTask).toBeTruthy();
            expect(persisted.authored.assignments.some((item) => item.taskId === persistedTask!.id && item.resourceId === liveUser!.id)).toBe(true);
          } else {
            await expect(page.getByRole("button", { name: "Задача", exact: true })).toHaveCount(0);
            await expect(page.getByRole("button", { name: "Подзадача", exact: true })).toHaveCount(0);
            await expect(page.getByRole("button", { name: /^Пакет/ })).toHaveCount(0);
            await expect(page.getByRole("button", { name: "Откат", exact: true })).toHaveCount(0);
            await expect(page.getByRole("textbox", { name: "Создать задачу (Enter; Tab — подзадачей)" })).toHaveCount(0);
            const firstRow = page.locator("[data-schedule-row-id]").first();
            for (const cell of [7, 8, 9, 10]) await expect(firstRow.locator("td").nth(cell).getByRole("button")).toHaveCount(0);
            await firstRow.click({ button: "right" });
            await expect(page.getByRole("menu")).toHaveCount(0);
            await expect(page.getByTitle("Потяните — сдвинуть начало")).toHaveCount(0);
            await expect(page.getByTitle("Потяните — изменить длительность")).toHaveCount(0);
            await expect(page.getByTitle(/Тяните от начала/)).toHaveCount(0);
            await expect(page.getByTitle(/Тяните от конца/)).toHaveCount(0);

            const before = await getReadModel(page, projectId);
            const task = before.authored.tasks.find((item) => !before.authored.tasks.some((candidate) => candidate.parentTaskId === item.id));
            expect(task).toBeTruthy();
            const command = { type: "task.update_progress", payload: { taskId: task!.id, percentComplete: 1 } };
            const deniedPreview = await browserFetch(page, "/api/workspace/projects/" + projectId + "/planning/preview-command", {
              method: "POST",
              headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
              body: JSON.stringify({ clientPlanVersion: before.planVersion, command })
            });
            expect(deniedPreview.status).toBe(403);
            const deniedApply = await browserFetch(page, "/api/workspace/projects/" + projectId + "/planning/apply-command", {
              method: "POST",
              headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
              body: JSON.stringify({ clientPlanVersion: before.planVersion, idempotencyKey: "c08-reader-denied-" + RUN_ID, command })
            });
            expect(deniedApply.status).toBe(403);
            expectStableReadModel(await getReadModel(page, projectId), before);
          }
          await shot("c08-" + actor.role + "-live-data.png", page);
        } finally {
          const projectId = await firstProjectId(page);
          await cleanupTasks(page, projectId, cleanup);
          await page.context().close();
        }
      }
    });
  });
  test("C09 baseline cross-surface equality and recapture", async ({ page }, testInfo) => {
    await executeBundle("C09", page, testInfo, async (shot) => {
      const projectId = await loginAndGetProject(page, ADMIN);
      const cleanup = new Set<string>();
      try {
        await openSchedule(page, projectId);
        const c09Run = `${RUN_ID}-${Date.now()}`;
        const fixtureModel = await getReadModel(page, projectId);
        const leafTasks = fixtureModel.authored.tasks
          .filter((candidate) => candidate.plannedStart && candidate.plannedFinish && !fixtureModel.authored.tasks.some((other) => other.parentTaskId === candidate.id))
          .sort((left, right) => right.plannedFinish!.localeCompare(left.plannedFinish!));
        const task = leafTasks[0];
        expect(task, "C09 requires a live leaf controlling project finish").toBeTruthy();
        const tailTasks = leafTasks.filter((candidate) => candidate.plannedFinish === task!.plannedFinish);
        expect(tailTasks.length).toBeGreaterThan(0);
        const firstLabel = `C09 capture ${c09Run}`;
        await page.goto(`/projects/${projectId}/baseline`);
        await baselineCapture(page, projectId, firstLabel);
        let model = await getReadModel(page, projectId);
        expect(model.baselineComparison?.tasks.every((item) => item.startDeltaDays === 0 && item.finishDeltaDays === 0 && item.workDeltaMinutes === 0)).toBe(true);

        await openSchedule(page, projectId);
        for (const tailTask of tailTasks) {
          const shiftedStart = new Date(`${tailTask.plannedStart}T00:00:00Z`);
          shiftedStart.setUTCDate(shiftedStart.getUTCDate() + 1);
          await editDateCell(page, projectId, tailTask.id, 7, shiftedStart.toISOString().slice(0, 10));
        }
        model = await getReadModel(page, projectId);
        const comparison = model.baselineComparison?.tasks.find((item) => item.taskId === task.id);
        const finishDelta = comparison?.finishDeltaDays;
        expect(finishDelta).toEqual(expect.any(Number));
        expect(finishDelta!).toBeGreaterThan(0);
        expect(comparison?.startDeltaDays).toEqual(expect.any(Number));
        expect(comparison!.startDeltaDays!).toBeGreaterThan(0);
        const currentBarBox = await ganttTask(page, task.id).locator(".gantt-bar, .gantt-milestone").boundingBox();
        const baselineBarBox = await ganttTask(page, task.id).getByTitle(firstLabel).boundingBox();
        const weekHeaderBox = await ganttTask(page, task.id).locator("xpath=preceding::*[contains(@class,'leading-9')][1]").boundingBox();
        expect(currentBarBox).toBeTruthy();
        expect(baselineBarBox).toBeTruthy();
        expect(weekHeaderBox).toBeTruthy();
        const dayWidth = weekHeaderBox!.width / 7;
        expect(Math.round((currentBarBox!.x - baselineBarBox!.x) / dayWidth)).toBe(comparison!.startDeltaDays);
        expect(Math.round(((currentBarBox!.x + currentBarBox!.width) - (baselineBarBox!.x + baselineBarBox!.width)) / dayWidth)).toBe(finishDelta);
        await page.goto(`/projects/${projectId}/baseline`);
        const baselineRow = page.getByRole("row").filter({ hasText: task.title });
        await expect(baselineRow).toContainText(`+${finishDelta} дн`);
        await expect(page.getByText("Финиш проекта", { exact: true }).locator("..")).toContainText(`+${finishDelta} дн`);
        await page.reload();
        await expect(page.getByRole("row").filter({ hasText: task.title })).toContainText(`+${finishDelta} дн`);

        await baselineCapture(page, projectId, `C09 recapture ${c09Run}`);
        model = await getReadModel(page, projectId);
        expect(model.baselineComparison?.tasks.every((item) => item.startDeltaDays === 0 && item.finishDeltaDays === 0 && item.workDeltaMinutes === 0)).toBe(true);
        await page.reload();
        await page.getByRole("button", { name: "Только изменённые", exact: true }).click();
        await expect(page.getByText("Нет изменённых задач — план совпадает с базовым.", { exact: true })).toBeVisible();
        await shot("c09-baseline-cross-surface.png");
      } finally {
        await cleanupTasks(page, projectId, cleanup);
      }
    });
  });

  test("C10 persisted Saved WBS Views for admin and planReader", async ({ browser }, testInfo) => {
    await executeBundle("C10", undefined, testInfo, async (shot) => {
      const admin = await authenticatedPage(browser, ADMIN);
      let viewId = "";
      let privateViewId = "";
      let corruptViewId = "";
      const cleanupViews = new Set<string>();
      try {
        const projectId = await firstProjectId(admin);
        const endpoint = `/api/workspace/projects/${projectId}/planning/saved-views`;
        const c10Run = `${RUN_ID}-${Date.now()}`;
        const name = `C10 shared view ${c10Run}`;
        const renamedName = `${name} renamed`;
        await openSchedule(admin, projectId);
        await expect(admin.getByTestId("saved-views-dropdown")).toBeVisible();
        const canonicalPayload = { version: 1, zoom: "day", columnWidths: Array(11).fill(80), collapsedTaskIds: [] };

        const initialRaceEnvelope = {
          name: "C10 initial same-key " + c10Run,
          scope: "project",
          payload: canonicalPayload,
          clientRequestId: "c10-create-race-same-" + c10Run
        };
        const [initialRaceLeft, initialRaceRight] = await Promise.all([
          directApiJson<{ savedView: { id: string; name: string } }>(admin, endpoint, { method: "POST", body: JSON.stringify(initialRaceEnvelope) }),
          directApiJson<{ savedView: { id: string; name: string } }>(admin, endpoint, { method: "POST", body: JSON.stringify(initialRaceEnvelope) })
        ]);
        expect(initialRaceLeft.status).toBe(201);
        expect(initialRaceRight).toEqual(initialRaceLeft);
        cleanupViews.add(initialRaceLeft.body.savedView.id);
        const afterInitialRace = await browserJson<{ savedViews: Array<{ id: string; name: string }> }>(admin, endpoint);
        expect(afterInitialRace.body.savedViews.filter((view) => view.id === initialRaceLeft.body.savedView.id)).toHaveLength(1);

        const nameRace = "C10 different-key same-name " + c10Run;
        const differentKeyRace = await Promise.all([
          directApiJson<{ savedView?: { id: string; name: string }; error?: string }>(admin, endpoint, {
            method: "POST",
            body: JSON.stringify({ name: nameRace, scope: "project", payload: canonicalPayload, clientRequestId: "c10-name-race-left-" + c10Run })
          }),
          directApiJson<{ savedView?: { id: string; name: string }; error?: string }>(admin, endpoint, {
            method: "POST",
            body: JSON.stringify({ name: nameRace.toLocaleUpperCase("ru-RU"), scope: "project", payload: canonicalPayload, clientRequestId: "c10-name-race-right-" + c10Run })
          })
        ]);
        expect(differentKeyRace.map((result) => result.status).sort()).toEqual([201, 409]);
        const nameWinner = differentKeyRace.find((result) => result.status === 201);
        const nameLoser = differentKeyRace.find((result) => result.status === 409);
        expect(nameWinner?.body.savedView?.id).toEqual(expect.any(String));
        expect(nameLoser?.body).toEqual({ error: "saved_view_name_conflict" });
        cleanupViews.add(nameWinner!.body.savedView!.id);
        const afterNameRace = await browserJson<{ savedViews: Array<{ id: string; name: string }> }>(admin, endpoint);
        expect(afterNameRace.body.savedViews.filter((view) => view.name.toLocaleLowerCase("ru-RU") === nameRace.toLocaleLowerCase("ru-RU"))).toHaveLength(1);
        await admin.getByRole("button", { name: "День", exact: true }).click();
        await admin.getByRole("button", { name: "Сохранить текущий вид" }).click();
        await admin.getByLabel("Название вида").fill(name);
        await admin.getByLabel("Доступ к виду").selectOption("project");
        let requestCount = 0;
        admin.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname === endpoint) requestCount += 1; });
        const createdPromise = admin.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === endpoint);
        await admin.getByRole("dialog").getByRole("button", { name: "Сохранить", exact: true }).evaluate((button) => {
          (button as HTMLButtonElement).click();
          (button as HTMLButtonElement).click();
        });
        const created = await createdPromise;
        expect(created.status()).toBe(201);
        expect(requestCount).toBe(1);
        const createEnvelope = created.request().postDataJSON() as {
          name: string;
          scope: "user" | "project";
          payload: Record<string, unknown>;
          clientRequestId?: unknown;
        };
        expect(createEnvelope.clientRequestId).toEqual(expect.stringMatching(/^saved-view-/));
        expect(createEnvelope.payload).toMatchObject({ version: 1, zoom: "day", collapsedTaskIds: [] });
        expect((createEnvelope.payload.columnWidths as unknown[]).every((width) => typeof width === "number" && Number.isFinite(width))).toBe(true);
        expect((createEnvelope.payload.columnWidths as unknown[])).toHaveLength(11);
        const createdBody = (await created.json()) as { savedView: { id: string; name: string } };
        viewId = createdBody.savedView.id;
        cleanupViews.add(viewId);
        const [sameKeyLeft, sameKeyRight] = await Promise.all([
          directApiJson<typeof createdBody>(admin, endpoint, { method: "POST", body: JSON.stringify(createEnvelope) }),
          directApiJson<typeof createdBody>(admin, endpoint, { method: "POST", body: JSON.stringify(createEnvelope) })
        ]);
        expect(sameKeyLeft).toEqual({ status: 201, body: createdBody });
        expect(sameKeyRight).toEqual({ status: 201, body: createdBody });
        const divergent = await directApiJson<{ error: string }>(admin, endpoint, {
          method: "POST",
          body: JSON.stringify({ ...createEnvelope, name: `${name} divergent` })
        });
        expect(divergent).toEqual({ status: 409, body: { error: "idempotency_key_conflict" } });
        const afterIdempotency = await browserJson<{ savedViews: Array<{ id: string; name: string }> }>(admin, endpoint);
        expect(afterIdempotency.status).toBe(200);
        expect(afterIdempotency.body.savedViews.filter((view) => view.id === viewId)).toHaveLength(1);
        expect(afterIdempotency.body.savedViews.some((view) => view.name === `${name} divergent`)).toBe(false);
        const duplicateName = await directApiJson<{ error: string }>(admin, endpoint, {
          method: "POST",
          body: JSON.stringify({ ...createEnvelope, clientRequestId: `c10-duplicate-${c10Run}`, name: name.toLocaleUpperCase("ru-RU") })
        });
        expect(duplicateName).toEqual({ status: 409, body: { error: "saved_view_name_conflict" } });
        await admin.reload();
        await expect(admin.getByTestId("saved-views-dropdown").locator(`option[value="${viewId}"]`)).toHaveText(`${name} · общий`);
        await admin.getByRole("button", { name: "Месяц", exact: true }).click();
        await admin.getByTestId("saved-views-dropdown").selectOption(viewId);
        await expect(admin.getByRole("button", { name: "День", exact: true })).toHaveAttribute("aria-pressed", "true");
        const renameEndpoint = `${endpoint}/${viewId}`;
        const renameButton = admin.getByRole("button", { name: "Переименовать выбранный вид" });
        await expect(renameButton).toBeVisible();
        await renameButton.click();
        await admin.getByLabel("Новое название вида").fill(renamedName);
        let renameRequestCount = 0;
        admin.on("request", (request) => {
          if (request.method() === "PATCH" && new URL(request.url()).pathname === renameEndpoint) renameRequestCount += 1;
        });
        const renamedPromise = admin.waitForResponse((response) =>
          response.request().method() === "PATCH" && new URL(response.url()).pathname === renameEndpoint
        );
        await admin.getByRole("dialog").getByRole("button", { name: "Переименовать", exact: true }).click();
        const renamedResponse = await renamedPromise;
        expect(renamedResponse.status()).toBe(200);
        expect(renameRequestCount).toBe(1);
        const renameEnvelope = renamedResponse.request().postDataJSON() as { name: string; clientRequestId?: unknown };
        expect(renameEnvelope).toMatchObject({ name: renamedName });
        expect(renameEnvelope.clientRequestId).toEqual(expect.stringMatching(/^saved-view-rename-/));
        const renamedBody = (await renamedResponse.json()) as { savedView: { id: string; name: string } };
        expect(renamedBody.savedView).toMatchObject({ id: viewId, name: renamedName });
        const [renameReplayLeft, renameReplayRight] = await Promise.all([
          directApiJson<typeof renamedBody>(admin, renameEndpoint, { method: "PATCH", body: JSON.stringify(renameEnvelope) }),
          directApiJson<typeof renamedBody>(admin, renameEndpoint, { method: "PATCH", body: JSON.stringify(renameEnvelope) })
        ]);
        expect(renameReplayLeft).toEqual({ status: 200, body: renamedBody });
        expect(renameReplayRight).toEqual({ status: 200, body: renamedBody });
        const renameConflict = await directApiJson<{ error: string }>(admin, renameEndpoint, {
          method: "PATCH",
          body: JSON.stringify({ ...renameEnvelope, name: "C10 divergent rename" })
        });
        expect(renameConflict).toEqual({ status: 409, body: { error: "idempotency_key_conflict" } });
        const afterRename = await browserJson<{ savedViews: Array<{ id: string; name: string }> }>(admin, endpoint);
        expect(afterRename.body.savedViews.filter((view) => view.id === viewId && view.name === renamedName)).toHaveLength(1);
        await admin.reload();
        await expect(admin.getByTestId("saved-views-dropdown").locator(`option[value="${viewId}"]`)).toHaveText(`${renamedName} · общий`);

        const privateName = "C10 private " + c10Run;
        const privateCreated = await directApiJson<{ savedView: { id: string; name: string } }>(admin, endpoint, {
          method: "POST",
          body: JSON.stringify({
            name: privateName,
            scope: "user",
            payload: { ...canonicalPayload, zoom: "week" },
            clientRequestId: "c10-private-" + c10Run
          })
        });
        expect(privateCreated.status).toBe(201);
        privateViewId = privateCreated.body.savedView.id;
        cleanupViews.add(privateViewId);

        const corruptName = "C10 corrupt " + c10Run;
        const corruptCreated = await directApiJson<{ savedView: { id: string; name: string } }>(admin, endpoint, {
          method: "POST",
          body: JSON.stringify({
            name: corruptName,
            scope: "user",
            payload: { version: 99, zoom: "day" },
            clientRequestId: "c10-corrupt-" + c10Run
          })
        });
        expect(corruptCreated.status).toBe(201);
        corruptViewId = corruptCreated.body.savedView.id;
        cleanupViews.add(corruptViewId);
        await admin.reload();
        await expect(admin.getByTestId("saved-views-dropdown").locator('option[value="' + privateViewId + '"]')).toHaveText(privateName);
        await expect(admin.getByTestId("saved-views-dropdown").locator('option[value="' + corruptViewId + '"]')).toHaveText(corruptName);
        await admin.getByRole("button", { name: "Месяц", exact: true }).click();
        await admin.getByTestId("saved-views-dropdown").selectOption(corruptViewId);
        await expect(admin.getByText("Сохранённый вид повреждён и не был применён", { exact: true })).toBeVisible();
        await expect(admin.getByRole("button", { name: "Месяц", exact: true })).toHaveAttribute("aria-pressed", "true");
        const reader = await authenticatedPage(browser, PLAN_READER);
        try {
          await openSchedule(reader, projectId);
          await expect(reader.getByTestId("saved-views-dropdown").locator('option[value="' + privateViewId + '"]')).toHaveCount(0);
          await expect(reader.getByTestId("saved-views-dropdown").locator('option[value="' + corruptViewId + '"]')).toHaveCount(0);
          await expect(reader.getByTestId("saved-views-dropdown").locator(`option[value="${viewId}"]`)).toHaveText(`${renamedName} · общий`);
          await reader.getByTestId("saved-views-dropdown").selectOption(viewId);
          await expect(reader.getByRole("button", { name: "День", exact: true })).toHaveAttribute("aria-pressed", "true");
          await expect(reader.getByRole("button", { name: "Сохранить текущий вид" })).toHaveCount(0);
          await expect(reader.getByRole("button", { name: "Удалить выбранный вид" })).toHaveCount(0);
          await expect(reader.getByRole("button", { name: "Переименовать выбранный вид" })).toHaveCount(0);
          const before = await browserJson<{ savedViews: unknown[] }>(reader, endpoint);
          const denied = await browserFetch(reader, endpoint, {
            method: "POST",
            headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
            body: JSON.stringify({
              name: `${name} denied`,
              scope: "project",
              clientRequestId: `c10-denied-${RUN_ID}`,
              payload: { version: 1, zoom: "week", columnWidths: Array(11).fill(80), collapsedTaskIds: [] }
            })
          });
          expect(denied.status).toBe(403);
          const deniedRename = await browserFetch(reader, `${endpoint}/${viewId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
            body: JSON.stringify({
              name: `${renamedName} denied`,
              clientRequestId: `c10-rename-denied-${RUN_ID}`
            })
          });
          expect(deniedRename.status).toBe(403);
          const deniedDelete = await browserFetch(reader, `${endpoint}/${viewId}`, {
            method: "DELETE",
            headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
            body: JSON.stringify({ clientRequestId: `c10-delete-denied-${c10Run}` })
          });
          expect(deniedDelete.status).toBe(403);
          expect((await browserJson<{ savedViews: unknown[] }>(reader, endpoint)).body).toEqual(before.body);
          await shot("c10-plan-reader-saved-view.png", reader);
        } finally {
          await reader.context().close();
        }

        const deleteRaceCreated = await directApiJson<{ savedView: { id: string } }>(admin, endpoint, {
          method: "POST",
          body: JSON.stringify({
            name: "C10 delete race " + c10Run,
            scope: "project",
            payload: canonicalPayload,
            clientRequestId: "c10-delete-race-create-" + c10Run
          })
        });
        expect(deleteRaceCreated.status).toBe(201);
        const deleteRaceViewId = deleteRaceCreated.body.savedView.id;
        cleanupViews.add(deleteRaceViewId);
        const deleteRacePath = endpoint + "/" + deleteRaceViewId;
        const deleteRaceEnvelope = { clientRequestId: "c10-delete-race-" + c10Run };
        const [deleteRaceLeft, deleteRaceRight] = await Promise.all([
          directApiJson<{ ok: boolean }>(admin, deleteRacePath, { method: "DELETE", body: JSON.stringify(deleteRaceEnvelope) }),
          directApiJson<{ ok: boolean }>(admin, deleteRacePath, { method: "DELETE", body: JSON.stringify(deleteRaceEnvelope) })
        ]);
        expect(deleteRaceLeft).toEqual({ status: 200, body: { ok: true } });
        expect(deleteRaceRight).toEqual(deleteRaceLeft);
        const deleteRaceReplay = await directApiJson<{ ok: boolean }>(admin, deleteRacePath, { method: "DELETE", body: JSON.stringify(deleteRaceEnvelope) });
        expect(deleteRaceReplay).toEqual(deleteRaceLeft);
        cleanupViews.delete(deleteRaceViewId);
        const divergentDeleteTarget = await directApiJson<{ error: string }>(admin, endpoint + "/" + corruptViewId, {
          method: "DELETE",
          body: JSON.stringify(deleteRaceEnvelope)
        });
        expect(divergentDeleteTarget).toEqual({ status: 409, body: { error: "idempotency_key_conflict" } });
        const afterDeleteRace = await browserJson<{ savedViews: Array<{ id: string }> }>(admin, endpoint);
        expect(afterDeleteRace.body.savedViews.some((savedView) => savedView.id === corruptViewId)).toBe(true);
        expect(afterDeleteRace.body.savedViews.some((savedView) => savedView.id === deleteRaceViewId)).toBe(false);

        await admin.getByTestId("saved-views-dropdown").selectOption(viewId);
        const deleted = admin.waitForResponse((response) => response.request().method() === "DELETE" && new URL(response.url()).pathname === `${endpoint}/${viewId}`);
        await admin.getByRole("button", { name: "Удалить выбранный вид" }).click();
        const deletedResponse = await deleted;
        expect(deletedResponse.status()).toBe(200);
        const deleteEnvelope = deletedResponse.request().postDataJSON() as { clientRequestId?: unknown };
        expect(deleteEnvelope.clientRequestId).toEqual(expect.stringMatching(/^saved-view-delete-/));
        const [deleteReplayLeft, deleteReplayRight] = await Promise.all([
          directApiJson<{ ok: boolean }>(admin, `${endpoint}/${viewId}`, { method: "DELETE", body: JSON.stringify(deleteEnvelope) }),
          directApiJson<{ ok: boolean }>(admin, `${endpoint}/${viewId}`, { method: "DELETE", body: JSON.stringify(deleteEnvelope) })
        ]);
        expect(deleteReplayLeft).toEqual({ status: 200, body: { ok: true } });
        expect(deleteReplayRight).toEqual({ status: 200, body: { ok: true } });
        cleanupViews.delete(viewId);
        viewId = "";
        for (const pendingViewId of [...cleanupViews]) {
          await cleanupSavedView(admin, projectId, pendingViewId);
          cleanupViews.delete(pendingViewId);
        }
        await admin.reload();
        const emptyDropdown = admin.getByTestId("saved-views-dropdown");
        await expect(emptyDropdown.locator('option[value=""]')).toHaveText("Нет сохранённых видов");
        await expect(emptyDropdown.locator("option")).toHaveCount(1);
        await shot("c10-admin-saved-views.png", admin);
      } finally {
        const projectId = await firstProjectId(admin);
        for (const pendingViewId of cleanupViews) await cleanupSavedView(admin, projectId, pendingViewId);
        await admin.context().close();
      }
    });
  });

  test("C11 current-surface axe for admin and planReader", async ({ browser }, testInfo) => {
    await executeBundle("C11", undefined, testInfo, async (shot) => {
      for (const actor of [{ role: "admin" as const, credentials: ADMIN }, { role: "planReader" as const, credentials: PLAN_READER }]) {
        const page = await authenticatedPage(browser, actor.credentials);
        try {
          const projectId = await firstProjectId(page);
          await page.setViewportSize({ width: 1280, height: 900 });
          await openSchedule(page, projectId);
          await axeCritical(page, `${actor.role}:default`);
          await shot(`c11-${actor.role}-default.png`, page);

          const beforeKeyboard = await getReadModel(page, projectId);
          const firstRow = page.locator("[data-schedule-row-id]").first();
          const secondRowId = await page.locator("[data-schedule-row-id]").nth(1).getAttribute("data-schedule-row-id");
          await firstRow.focus();
          expect(await countPlanningPosts(page, () => page.keyboard.press("ArrowDown"))).toBe(0);
          expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.scheduleRowId ?? null)).toBe(secondRowId);
          expectStableReadModel(await getReadModel(page, projectId), beforeKeyboard);
          await firstRow.click();
          await axeCritical(page, `${actor.role}:inspector`);
          await shot(`c11-${actor.role}-inspector.png`, page);

          if (actor.role === "admin") {
            await page.getByRole("button", { name: "Задача", exact: true }).click();
            await axeCritical(page, "admin:dialog");
            await shot("c11-admin-dialog.png", page);
            await page.getByRole("dialog", { name: "Новая задача" }).getByRole("button", { name: "Закрыть" }).click();

            const live = await getReadModel(page, projectId);
            const leaf = live.authored.tasks.find((task) => !live.authored.tasks.some((candidate) => candidate.parentTaskId === task.id));
            expect(leaf).toBeTruthy();
            const preview = waitForPlanningResponse(page, projectId, "preview-command");
            const progressCell = rowById(page, leaf!.id).locator("td").nth(6);
            await progressCell.dblclick();
            await progressCell.locator("input").fill(String(((leaf!.percentComplete ?? 0) + 1) % 100));
            await progressCell.locator("input").press("Enter");
            expect((await preview).status()).toBe(200);
            const previewDialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
            await expect(previewDialog).toBeVisible();
            await axeCritical(page, "admin:preview");
            await shot("c11-admin-preview.png", page);
            await previewDialog.getByRole("button", { name: "Отмена", exact: true }).click();
            expectStableReadModel(await getReadModel(page, projectId), live);

            expect(await countPlanningPosts(page, async () => {
              const durationCell = rowById(page, leaf!.id).locator("td").nth(4);
              await durationCell.dblclick();
              await durationCell.locator("input").fill("-1");
              await durationCell.locator("input").press("Enter");
            })).toBe(0);
            await expect(page.getByText("Длительность задачи должна быть больше 0", { exact: false })).toBeVisible();
            await axeCritical(page, "admin:validation");
            await shot("c11-admin-validation.png", page);
            await page.reload();
          } else {
            await expect(page.getByRole("button", { name: "Задача", exact: true })).toHaveCount(0);
            const before = await getReadModel(page, projectId);
            const task = before.authored.tasks[0];
            expect(task).toBeTruthy();
            const denied = await browserFetch(page, `/api/workspace/projects/${projectId}/planning/preview-command`, {
              method: "POST",
              headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
              body: JSON.stringify({ clientPlanVersion: before.planVersion, command: { type: "task.update_progress", payload: { taskId: task!.id, percentComplete: 1 } } })
            });
            expect(denied.status).toBe(403);
            expectStableReadModel(await getReadModel(page, projectId), before);
          }

          await page.setViewportSize({ width: 390, height: 820 });
          await axeCritical(page, `${actor.role}:mobile`);
          await shot(`c11-${actor.role}-mobile.png`, page);

          if (actor.role === "planReader") {
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.route(`**/api/workspace/projects/${projectId}/planning/read-model`, (route) => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "forbidden" }) }), { times: 1 });
            await page.reload();
            await expect(page.getByText("Доступ ограничен", { exact: true })).toBeVisible();
            await axeCritical(page, "planReader:forbidden");
            await shot("c11-planReader-forbidden.png", page);
          }
        } finally {
          await page.context().close();
        }
      }
    });
  });
  test.afterAll(() => {
    const rows = [...evidenceRows.values()];
    const missing = rows.filter((item) => item.status === "pending" || item.generatedAt === null || item.runId !== RUN_ID || item.assertions.length === 0 || item.screenshots.length === 0);
    const staleSource = sourceState();
    writeMachineReceipt({ sourceStateAtEnd: staleSource });
    expect(sourceStateAtStart, "Schedule/spec source changed during closeout; evidence is stale").toEqual(staleSource);
    expect(missing.map((item) => item.key), "every one of 40 target role rows requires fresh bundle evidence").toEqual([]);
    expect(rows).toHaveLength(40);
    expect(new Set(rows.map((item) => item.bundle)).size).toBe(11);
  });
});

function row(scenarioId: TargetRow["scenarioId"], role: Role, bundle: BundleId): TargetRow {
  return { scenarioId, role, bundle };
}

function targetKey(target: Pick<TargetRow, "scenarioId" | "role">) {
  return `${target.scenarioId}:${target.role}`;
}

function screenshotPrefixesFor(target: TargetRow): string[] {
  switch (target.bundle) {
    case "C01": return ["c01-admin-authoring"];
    case "C02":
      if (target.scenarioId === "PROJ-035") return ["proj-035-"];
      if (target.scenarioId === "PROJ-036") return ["proj-036-"];
      return ["proj-037-"];
    case "C03": return ["c03-" + target.role];
    case "C04": return ["c04-gantt-gestures"];
    case "C05": return ["c05-dependencies"];
    case "C06":
      if (target.scenarioId === "PROJ-047") return ["c06-honest-empty-plan"];
      if (target.scenarioId === "PROJ-057") return ["c06-validation-rollback"];
      return ["c06-optimistic-commit"];
    case "C07": return ["c07-workflow-conflict"];
    case "C08": return ["c08-" + target.role + "-live-data"];
    case "C09": return ["c09-baseline-cross-surface"];
    case "C10": return [target.role === "admin" ? "c10-admin-" : "c10-plan-reader-"];
    case "C11": return ["c11-" + target.role + "-"];
  }
  return [];
}
async function executeBundle(
  bundle: BundleId,
  defaultPage: Page | undefined,
  testInfo: TestInfo,
  body: (screenshot: (name: string, pageOverride?: Page) => Promise<void>) => Promise<void>
) {
  const screenshots: string[] = [];
  const shot = async (name: string, pageOverride?: Page) => {
    const page = pageOverride ?? defaultPage;
    if (!page || page.isClosed()) throw new Error(`screenshot_page_missing:${bundle}:${name}`);
    const path = resolve(EVIDENCE_ROOT, name);
    await page.screenshot({ path, fullPage: true });
    screenshots.push(name);
    await testInfo.attach(name, { path, contentType: "image/png" });
  };
  try {
    await body(shot);
    if (testInfo.errors.length) throw new Error(`soft_assertions_failed:${testInfo.errors.map((error) => error.message).join(" | ")}`);
    updateBundle(bundle, "pass", screenshots, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (defaultPage && !defaultPage.isClosed()) {
      try { await shot(`${bundle.toLowerCase()}-blocker.png`); } catch { /* keep the original blocker */ }
    }
    updateBundle(bundle, "blocker", screenshots, message);
    throw error;
  } finally {
    writeMachineReceipt();
  }
}

function updateBundle(bundle: BundleId, status: Exclude<EvidenceStatus, "pending">, screenshots: string[], blocker: string | null) {
  for (const evidence of evidenceRows.values()) {
    if (evidence.bundle !== bundle) continue;
    const assertions = ROW_ASSERTIONS[evidence.key] ?? [];
    const prefixes = screenshotPrefixesFor(evidence);
    const rowScreenshots = screenshots.filter((name) => prefixes.some((prefix) => name.startsWith(prefix)));
    if (status === "pass") {
      expect(assertions.length, evidence.key + " requires row-specific assertions").toBeGreaterThan(0);
      expect(rowScreenshots.length, evidence.key + " requires row-specific screenshots").toBeGreaterThan(0);
    }
    evidence.status = status;
    evidence.generatedAt = new Date().toISOString();
    evidence.assertions = [...assertions];
    evidence.screenshots = [...rowScreenshots];
    evidence.blocker = blocker;
  }
}

function writeMachineReceipt(extra: Record<string, unknown> = {}) {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const rows = [...evidenceRows.values()];
  writeFileSync(MACHINE_PATH, JSON.stringify({
    schemaVersion: 2,
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    uiOrigin: UI_ORIGIN,
    apiOrigin: API_ORIGIN,
    targetRowCount: TARGET_ROWS.length,
    bundleCount: new Set(TARGET_ROWS.map((item) => item.bundle)).size,
    statusCounts: countStatuses(rows),
    sourceStateAtStart,
    rows,
    ...extra
  }, null, 2), "utf8");
}

function hydrateMachineReceipt() {
  if (!existsSync(MACHINE_PATH)) return;
  const previous = JSON.parse(readFileSync(MACHINE_PATH, "utf8")) as {
    runId?: string;
    rows?: EvidenceRow[];
    sourceStateAtStart?: Record<string, string>;
  };
  if (
    previous.runId !== RUN_ID
    || !Array.isArray(previous.rows)
    || JSON.stringify(previous.sourceStateAtStart) !== JSON.stringify(sourceStateAtStart)
  ) return;
  for (const item of previous.rows) {
    const current = evidenceRows.get(item.key);
    if (
      !current
      || item.runId !== RUN_ID
      || item.status === "pending"
      || item.generatedAt === null
      || item.assertions.length === 0
      || item.screenshots.length === 0
    ) continue;
    evidenceRows.set(item.key, item);
  }
}

function countStatuses(rows: EvidenceRow[]) {
  return rows.reduce<Record<EvidenceStatus, number>>((counts, item) => {
    counts[item.status] += 1;
    return counts;
  }, { pending: 0, pass: 0, blocker: 0 });
}

function sourceState() {
  const files = [
    resolve(SPEC_DIR, "projects-schedule-closeout.spec.ts"),
    resolve(REPO_ROOT, "apps/api/src/planning/planningRevertRoute.ts"),
    resolve(REPO_ROOT, "apps/api/src/planning/planningSavedViewRoutes.ts"),
    resolve(REPO_ROOT, "apps/api/src/apiDocs/openApiDocument.ts"),
    resolve(REPO_ROOT, "apps/api/src/apiDocs/schemas/planning.ts"),
    resolve(REPO_ROOT, "apps/api/src/planningRoutes.db.test.ts"),
    resolve(REPO_ROOT, "apps/api/src/planningParsers.ts"),
    resolve(REPO_ROOT, "packages/persistence/src/planningSavedViewsRepository.ts"),
    resolve(REPO_ROOT, "packages/persistence/src/schema/planning.ts"),
    resolve(REPO_ROOT, "packages/persistence/migrations/0027_planning_saved_view_name_uniqueness.sql"),
    resolve(REPO_ROOT, "apps/web/src/delivery/commits/commits-surface.tsx"),
    resolve(REPO_ROOT, "apps/web/src/delivery/lib/use-planning.ts"),
    resolve(REPO_ROOT, "packages/planning-client/src/api/planningApiClient.ts"),
    resolve(REPO_ROOT, "packages/planning-client/src/api/types.ts"),
    ...readdirSync(resolve(REPO_ROOT, "apps/web/src/delivery/schedule"))
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .map((name) => resolve(REPO_ROOT, "apps/web/src/delivery/schedule", name))
  ].sort();
  return Object.fromEntries(files.map((path) => [path.replace(`${REPO_ROOT}\\`, ""), sha256(path)]));
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function contextRoute(context: Parameters<typeof routeBrowserApi>[0]) {
  return context;
}

async function routeBrowserApi(context: { route: Page["route"] }, apiPort: string) {
  await context.route("**/api/**", async (route) => {
    const target = new URL(route.request().url());
    target.protocol = "http:";
    target.hostname = "127.0.0.1";
    target.port = apiPort;
    const response = await route.fetch({ url: target.toString() });
    await route.fulfill({ response });
  });
}

async function authenticatedPage(browser: Browser, credentials: typeof ADMIN) {
  const context = await browser.newContext({ baseURL: UI_ORIGIN, locale: "ru-RU" });
  await routeBrowserApi(context, "4192");
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await loginAndGetProject(page, credentials);
  return page;
}

async function loginAndGetProject(page: Page, credentials: typeof ADMIN) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Пароль", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
  return firstProjectId(page);
}

async function firstProjectId(page: Page) {
  const response = await browserJson<{ projects: Array<{ id: string }> }>(page, "/api/workspace/projects");
  expect(response.status).toBe(200);
  expect(response.body.projects.length).toBeGreaterThan(0);
  return response.body.projects[0]!.id;
}

async function openSchedule(page: Page, projectId: string, expectRows = true) {
  await page.goto(`/projects/${projectId}/schedule`);
  await expect(page.getByTestId("schedule-productivity-workspace")).toBeVisible();
  if (expectRows) await expect(page.locator("[data-schedule-row-id]").first()).toBeVisible();
}

async function getReadModel(page: Page, projectId: string): Promise<ReadModel> {
  const response = await browserJson<ReadModel>(page, `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/read-model`);
  expect(response.status).toBe(200);
  return response.body;
}

function taskById(model: ReadModel, taskId: string) {
  return model.authored.tasks.find((task) => task.id === taskId);
}

function taskByTitle(model: ReadModel, title: string) {
  return model.authored.tasks.find((task) => task.title === title);
}

function rowById(page: Page, taskId: string) {
  return page.locator(`[data-schedule-row-id="${taskId}"]`);
}

function ganttTask(page: Page, taskId: string) {
  return page.locator(`[data-task-id="${taskId}"]`);
}

function firstGanttBar(page: Page) {
  return page.locator("[data-task-id] .gantt-bar").first();
}

function marker(prefix: string) {
  return `${prefix} ${RUN_ID}`;
}

async function createModalTask(
  page: Page,
  projectId: string,
  values: { title: string; start?: string; duration?: string; work?: string; progress?: string; assigneeLabel?: string },
  buttonName: "Задача" | "Подзадача" = "Задача"
) {
  const kind = values.assigneeLabel || Number(values.progress ?? 0) > 0 ? "batch" : "single";
  await planningWrite(page, projectId, kind, async () => {
    await page.getByRole("button", { name: buttonName, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Новая задача" });
    await dialog.getByLabel("Название", { exact: true }).fill(values.title);
    if (values.assigneeLabel) await dialog.locator("label").filter({ hasText: "Исполнитель" }).locator("select").selectOption({ label: values.assigneeLabel });
    if (values.start) await dialog.getByLabel("Начало", { exact: true }).fill(values.start);
    if (values.duration) await dialog.getByLabel("Длит, дн", { exact: true }).fill(values.duration);
    if (values.work) await dialog.getByLabel("Труд, ч", { exact: true }).fill(values.work);
    if (values.progress) await dialog.getByLabel("Прогресс, %", { exact: true }).fill(values.progress);
    await dialog.getByRole("button", { name: "Создать", exact: true }).click();
  }, {
    readback: (model) => expect(taskByTitle(model, values.title)).toBeTruthy(),
    reload: async () => expect(page.getByText(values.title, { exact: true }).first()).toBeVisible()
  });
  return taskByTitle(await getReadModel(page, projectId), values.title)!;
}

async function quickCreateTask(page: Page, projectId: string, title: string, key: "Enter" | "Tab") {
  const textbox = page.getByRole("textbox", { name: "Создать задачу (Enter; Tab — подзадачей)" }).last();
  await planningWrite(page, projectId, "single", async () => {
    await textbox.fill(title);
    await textbox.press(key);
  }, {
    readback: (model) => expect(taskByTitle(model, title)).toBeTruthy(),
    reload: async () => expect(page.getByText(title, { exact: true }).first()).toBeVisible()
  });
  return taskByTitle(await getReadModel(page, projectId), title)!;
}

async function inlineEdit(page: Page, projectId: string, taskId: string, cell: number, value: string, key: "Enter" | "Tab" | "Shift+Tab", reloadAfter = true) {
  const before = await getReadModel(page, projectId);
  const synchronizesAssignment = (cell === 4 || cell === 5) && before.authored.assignments.some((item) => item.taskId === taskId);
  const kind = synchronizesAssignment ? "batch" : "single";
  await planningWrite(page, projectId, kind, async () => {
    const target = rowById(page, taskId).locator("td").nth(cell);
    await target.dblclick();
    const input = target.locator("input");
    await input.fill(value);
    await input.press(key);
  }, {
    reloadAfter,
    readback: (model) => expect(taskById(model, taskId)).toBeTruthy(),
    reload: async () => expect(rowById(page, taskId)).toBeVisible()
  });
}

async function stageInlineEdit(page: Page, taskId: string, cell: number, value: string) {
  const target = rowById(page, taskId).locator("td").nth(cell);
  await target.dblclick();
  const input = target.locator("input");
  await input.fill(value);
  await input.press("Enter");
}

async function editDateCell(page: Page, projectId: string, taskId: string, cell: number, iso: string, title = "Начало задачи") {
  await planningWrite(page, projectId, cell === 8 ? "batch" : "single", async () => {
    await rowById(page, taskId).locator("td").nth(cell).getByRole("button").first().click();
    const popover = page.getByText(title, { exact: true }).locator("..");
    await popover.locator("input[type=date]").fill(iso);
    await popover.getByRole("button", { name: "Применить", exact: true }).click();
  }, {
    readback: (model) => expect(taskById(model, taskId)).toBeTruthy(),
    reload: async () => expect(rowById(page, taskId)).toBeVisible()
  });
}

async function baselineCapture(page: Page, projectId: string, label: string) {
  await planningWrite(page, projectId, "single", async () => {
    await page.getByRole("button", { name: "Зафиксировать базовый план", exact: true }).click();
    await page.getByPlaceholder("Название снимка").fill(label);
    await page.getByRole("button", { name: "Зафиксировать", exact: true }).click();
  }, {
    readback: (model) => expect(model.baselineComparison?.label).toBe(label),
    reload: async () => expect(page.getByText(label, { exact: true })).toBeVisible()
  });
}

type WriteOptions = {
  beforeVersion?: number;
  expectedVersionDelta?: number;
  reloadAfter?: boolean;
  readback: (model: ReadModel) => void | Promise<void>;
  reload: () => Promise<void>;
};

async function planningWrite(page: Page, projectId: string, kind: "single" | "batch", trigger: () => Promise<unknown>, options: WriteOptions) {
  const before = await getReadModel(page, projectId);
  if (options.beforeVersion !== undefined) expect(before.planVersion).toBe(options.beforeVersion);
  const previewEndpoint = kind === "single" ? "preview-command" : "preview-command-batch";
  const applyEndpoint = kind === "single" ? "apply-command" : "apply-command-batch";
  const previewPromise = waitForPlanningResponse(page, projectId, previewEndpoint);
  await trigger();
  const preview = await previewPromise;
  expect(preview.status(), `${previewEndpoint} must accept the UI command`).toBe(200);
  const applyPromise = waitForPlanningResponse(page, projectId, applyEndpoint);
  await confirmPlanningPreview(page);
  const apply = await applyPromise;
  expect(apply.status(), `${applyEndpoint} must persist the preview`).toBe(200);
  const appliedBody = await responseJson<Record<string, unknown>>(apply);
  const version = responseVersion(appliedBody);
  const after = await getReadModel(page, projectId);
  expect(after.planVersion).toBe(version);
  expect(after.planVersion - before.planVersion).toBe(options.expectedVersionDelta ?? 1);
  await options.readback(after);
  await assertConcurrentReplay(page, projectId, apply, version, after);
  if (options.reloadAfter !== false) {
    await page.reload();
    await options.reload();
    const reloaded = await getReadModel(page, projectId);
    expectStableReadModel(reloaded, after);
  }
  return { before, after, apply, appliedBody };
}

async function pointerPlanningWrite(page: Page, projectId: string, kind: "single" | "batch", trigger: () => Promise<unknown>, taskId: string) {
  return planningWrite(page, projectId, kind, trigger, {
    readback: (model) => expect(taskById(model, taskId)).toBeTruthy(),
    reload: async () => expect(rowById(page, taskId)).toBeVisible()
  });
}

async function assertConcurrentReplay(page: Page, projectId: string, apply: Response, version: number, after: ReadModel) {
  const body = apply.request().postDataJSON() as Record<string, unknown> | null;
  expect(body, "Schedule apply request must carry a JSON envelope").toBeTruthy();
  const idempotencyKey = body?.idempotencyKey;
  expect.soft(typeof idempotencyKey === "string" && idempotencyKey.length > 0, "every exercised Schedule write must carry an idempotency key").toBe(true);
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) return;
  const pathname = new URL(apply.url()).pathname;
  const [left, right] = await Promise.all([
    directApiJson<Record<string, unknown>>(page, pathname, { method: "POST", body: JSON.stringify(body) }),
    directApiJson<Record<string, unknown>>(page, pathname, { method: "POST", body: JSON.stringify(body) })
  ]);
  expect(left.status).toBe(200);
  expect(right.status).toBe(200);
  expect(responseVersion(left.body)).toBe(version);
  expect(responseVersion(right.body)).toBe(version);
  expect(stableReadModel(await getReadModel(page, projectId))).toEqual(stableReadModel(after));
}

function stableReadModel(value: ReadModel): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, field) => key === "calculatedAt" ? undefined : field)
  );
}

async function planningReject(page: Page, projectId: string, trigger: () => Promise<void>) {
  const before = await getReadModel(page, projectId);
  const preview = waitForPlanningResponse(page, projectId, "preview-command");
  await trigger();
  const response = await preview;
  if (response.status() === 200) {
    const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  }
  expectStableReadModel(await getReadModel(page, projectId), before);
  return response;
}

function waitForPlanningResponse(page: Page, projectId: string, endpoint: "preview-command" | "preview-command-batch" | "apply-command" | "apply-command-batch") {
  return page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/workspace/projects/${projectId}/planning/${endpoint}`);
}

function waitForRevertResponse(page: Page, projectId: string) {
  return page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === `/api/workspace/projects/${projectId}/planning/revert-last`
  );
}

async function confirmPlanningPreview(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Применить изменения", exact: true }).click();
}

async function countPlanningPosts(page: Page, action: () => Promise<unknown>) {
  let count = 0;
  const listener = (request: { method(): string; url(): string }) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.includes("/planning/")) count += 1;
  };
  page.on("request", listener);
  try {
    await action();
    await page.waitForTimeout(250);
    return count;
  } finally {
    page.off("request", listener);
  }
}

async function cleanupTasks(page: Page, projectId: string, ids: Set<string>) {
  for (const taskId of [...ids].reverse()) {
    const response = await browserFetch(page, `/api/workspace/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
      headers: { "x-kiss-pm-action": "same-origin" }
    });
    if (![200, 404].includes(response.status)) throw new Error(`cleanup_failed:${projectId}:${taskId}:${response.status}`);
  }
}

async function cleanupSavedView(page: Page, projectId: string, viewId: string) {
  const response = await browserFetch(page, `/api/workspace/projects/${projectId}/planning/saved-views/${encodeURIComponent(viewId)}`, {
    method: "DELETE",
    headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
    body: JSON.stringify({ clientRequestId: `saved-view-cleanup-${viewId}-${Date.now()}` })
  });
  if (![200, 404].includes(response.status)) throw new Error(`saved_view_cleanup_failed:${response.status}`);
}


async function focusLinkLagEditor(page: Page) {
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll<HTMLElement>("div")]
      .find((node) => node.textContent?.trim() === "Связь — тип и лаг");
    const select = heading?.parentElement?.querySelector<HTMLSelectElement>("select");
    if (!select) throw new Error("link_lag_editor_select_missing");
    select.focus();
  });
}

async function linkLagEditorValues(page: Page) {
  return page.evaluate(() => {
    const heading = [...document.querySelectorAll<HTMLElement>("div")]
      .find((node) => node.textContent?.trim() === "Связь — тип и лаг");
    const root = heading?.parentElement;
    const select = root?.querySelector<HTMLSelectElement>("select");
    const input = root?.querySelector<HTMLInputElement>('input[aria-label="Лаг, дней"]');
    if (!select || !input) throw new Error("link_lag_editor_controls_missing");
    return { type: select.value, lag: input.value };
  });
}
async function dragBy(page: Page, locator: ReturnType<Page["locator"]>, dx: number, dy: number, anchorRatio = 0.5, steps = 5) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width * anchorRatio;
  await page.mouse.move(startX, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.waitForTimeout(50);
  await page.mouse.move(startX + dx, box!.y + box!.height / 2 + dy, { steps });
  await page.waitForTimeout(50);
  await page.mouse.up();
}

async function pointerHitTitle(locator: ReturnType<Page["locator"]>, anchorRatio = 0.5) {
  return locator.evaluate((node, ratio) => {
    const rect = node.getBoundingClientRect();
    return (document.elementFromPoint(rect.x + rect.width * ratio, rect.y + rect.height / 2) as HTMLElement | null)?.closest<HTMLElement>("[title]")?.title ?? null;
  }, anchorRatio);
}
async function dragTo(page: Page, locator: ReturnType<Page["locator"]>, x: number, y: number) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.waitForTimeout(50);
  await page.mouse.move(x, y, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.up();
}

async function dragToElement(page: Page, source: ReturnType<Page["locator"]>, target: ReturnType<Page["locator"]>) {
  await source.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box).toBeTruthy();
  await dragTo(page, source, box!.x + box!.width / 2, box!.y + box!.height / 2);
}

async function axeCritical(page: Page, state: string) {
  const result = await new AxeBuilder({ page }).analyze();
  const critical = result.violations.filter((violation) => violation.impact === "critical");
  expect(critical, `${state}: critical axe violations`).toEqual([]);
  expect(result.passes.length, `${state}: axe must execute rules against the current document`).toBeGreaterThan(0);
}

function daysBetween(start: string | null | undefined, finish: string | null | undefined) {
  expect(start).toBeTruthy();
  expect(finish).toBeTruthy();
  return Math.round((Date.parse(`${finish}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function expectStableReadModel(actual: ReadModel, expected: ReadModel) {
  expect(actual.planVersion).toBe(expected.planVersion);
  expect(actual.project).toEqual(expected.project);
  expect(actual.authored).toEqual(expected.authored);
  expect(actual.baselineComparison).toEqual(expected.baselineComparison);
}

function responseVersion(body: Record<string, unknown>) {
  const value = body.newPlanVersion ?? body.planVersion;
  expect(value, "planning response must expose the authoritative version").toEqual(expect.any(Number));
  return value as number;
}

async function responseJson<T>(response: Response): Promise<T> {
  return JSON.parse(await response.text()) as T;
}

async function browserJson<T>(page: Page, path: string) {
  const response = await browserFetch(page, path);
  return { status: response.status, body: JSON.parse(response.text) as T };
}

async function browserFetch(page: Page, path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, { ...init, credentials: "include" });
    return { status: response.status, text: await response.text() };
  }, { path, init });
}

async function directApiJson<T>(page: Page, path: string, init: { method: string; body: string }) {
  const response = await page.request.fetch(`${API_ORIGIN}${path}`, {
    method: init.method,
    headers: {
      Origin: UI_ORIGIN,
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin"
    },
    data: JSON.parse(init.body) as unknown
  });
  return { status: response.status(), body: JSON.parse(await response.text()) as T };
}
