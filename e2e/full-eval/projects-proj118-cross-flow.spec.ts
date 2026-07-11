import { expect, test, type Page, type Response } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const DISPOSABLE_DATABASE_ENV = "KISS_PM_E2E_DISPOSABLE_DATABASE";
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_ROOT = resolve(
  TEST_DIR,
  "../../.superloopy/evidence/project-resources-assignments-2026-07-11"
);
const RECEIPT_PATH = resolve(EVIDENCE_ROOT, "proj-118-admin-receipt.json");
const WORK_HOURS = 240;

type Task = {
  id: string;
  parentTaskId: string | null;
  durationMinutes: number | null;
  wbsCode: string;
  title: string;
};

type Assignment = {
  id: string;
  taskId: string;
  resourceId: string;
  role: string;
  unitsPermille: number;
  workMinutes: number | null;
};

type Allocation = { assignmentId: string; date: string; workMinutes: number };
type Overload = {
  resourceId: string;
  date: string;
  granularity: string;
  overloadMinutes: number;
  taskIds: string[];
  assignmentIds: string[];
  accepted?: boolean;
};

type ReadModel = {
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
  resourceLoad: {
    buckets: Array<{
      resourceId: string;
      date: string;
      granularity: string;
      capacityMinutes: number;
    }>;
    overloads: Overload[];
    acceptedOverloads?: string[];
  };
  planVersion: number;
};

type WorkspaceUser = { id: string; name: string };
type Fixture = { projectId: string; task: Task; user: WorkspaceUser };
type CommandEnvelope = {
  command: { type: string; payload: Record<string, unknown> };
  clientPlanVersion: number;
  idempotencyKey?: string;
};
type ApplyResult = {
  previewEnvelope: CommandEnvelope;
  applyEnvelope: CommandEnvelope;
  applyResponse: Response;
};

test.describe.serial("PROJ-118 assignments/resources cross-flow", () => {
  test.beforeAll(() => mkdirSync(EVIDENCE_ROOT, { recursive: true }));

  test("ADMIN creates, accepts, reloads and resolves an exact overload", async ({
    page
  }) => {
    test.skip(
      process.env[DISPOSABLE_DATABASE_ENV] !== "1",
      `PROJ-118 mutates an immutable risk marker; set ${DISPOSABLE_DATABASE_ENV}=1 only for a disposable database`
    );
    test.setTimeout(180_000);

    const screenshots: string[] = [];
    const assertions: string[] = [];
    const details: Record<string, unknown> = {};
    let fixture: Fixture | undefined;
    let assignmentId = "";
    let failure: unknown;

    try {
      await login(page);
      fixture = await findFixture(page);
      const before = await getReadModel(page, fixture.projectId);

      await page.goto(`/projects/${fixture.projectId}/assignments`);
      await expect(page.getByText("Назначения", { exact: true })).toBeVisible();
      const addButton = taskBlock(page, fixture.task.wbsCode).getByTitle(
        "Добавить исполнителя"
      );
      await addButton.click();

      const addDialog = page.getByRole("dialog", { name: "Добавить исполнителя" });
      await addDialog
        .getByRole("combobox", { name: "Ресурс", exact: true })
        .selectOption(fixture.user.id);
      await addDialog
        .getByRole("combobox", { name: "Роль", exact: true })
        .selectOption("observer");

      const created = await runUiCommand(page, fixture.projectId, async () => {
        await addDialog.getByRole("button", { name: "Добавить", exact: true }).click();
      });
      expect(created.previewEnvelope.command.type).toBe("assignment.upsert");
      assignmentId = String(created.applyEnvelope.command.payload.id ?? "");
      expect(assignmentId).toMatch(/^a-[0-9a-f-]{36}$/i);
      details.createAssignment = commandEvidence(created);
      expect(created.applyEnvelope.idempotencyKey).toMatch(
        /^planning-apply-[0-9a-f-]{36}$/i
      );

      let model = await getReadModel(page, fixture.projectId);
      expect(model.planVersion).toBeGreaterThan(before.planVersion);
      expect(findAssignment(model, assignmentId)).toMatchObject({
        taskId: fixture.task.id,
        resourceId: fixture.user.id,
        role: "observer",
        workMinutes: 0
      });

      await page.reload();
      const row = page.getByTestId(`assignment-row-${assignmentId}`);
      await expect(row).toHaveCount(1);
      await row.click();
      const inspector = page.getByTestId("assignment-inspector");
      await expect(inspector).toBeVisible();

      const roleWrite = await runUiCommand(page, fixture.projectId, async () => {
        await inspector.getByTestId("assignment-role-select").selectOption("executor");
      });
      details.roleChange = commandEvidence(roleWrite);
      const workWrite = await runUiCommand(page, fixture.projectId, async () => {
        const work = inspector.getByTestId("assignment-work-input");
        await work.fill(String(WORK_HOURS));
        await work.press("Tab");
      });
      details.workChange = commandEvidence(workWrite);

      await expect(
        inspector.getByText("Кривая распределения", { exact: true })
      ).toBeVisible();
      const numberInputs = inspector.locator('[data-testid^="curve-day-"]');
      const inputCount = await numberInputs.count();
      expect(inputCount, "assignment needs at least one editable curve day").toBeGreaterThan(0);
      for (let index = 0; index < inputCount; index += 1) {
        await numberInputs.nth(index).fill(index === 0 ? String(WORK_HOURS) : "0");
      }

      const curve = await runUiCommand(page, fixture.projectId, async () => {
        await inspector
          .getByRole("button", { name: "Применить кривую", exact: true })
          .click();
      });
      expect(curve.applyEnvelope.command.type).toBe(
        "assignment.allocations.replace"
      );
      expect(curve.applyEnvelope.command.payload.assignmentId).toBe(assignmentId);
      details.curve = commandEvidence(curve);

      model = await getReadModel(page, fixture.projectId);
      const explicitAllocations = model.authored.assignmentAllocations.filter(
        (allocation) => allocation.assignmentId === assignmentId
      );
      expect(explicitAllocations).toHaveLength(1);
      expect(explicitAllocations[0]!.workMinutes).toBe(WORK_HOURS * 60);
      const overload = exactOverload(
        model,
        fixture.user.id,
        explicitAllocations[0]!.date,
        assignmentId
      );
      expect(overload.overloadMinutes).toBeGreaterThan(0);
      expect(overload.taskIds).toContain(fixture.task.id);
      assertions.push("UI-created assignment and explicit one-day curve produced the exact API overload");

      await openResources(page, fixture.projectId);
      const overloadCell = await resourceCell(
        page,
        fixture.user.name,
        overload.date,
        "ПЕРЕГРУЗ"
      );
      await expect(overloadCell).toBeVisible();
      await overloadCell.click();
      await expect(page.getByText(new RegExp(`Перегруз \\+${hours(overload.overloadMinutes)} ч`))).toBeVisible();
      screenshots.push(await screenshot(page, "overload-exact"));

      const accepted = await runUiCommand(page, fixture.projectId, async () => {
        await page
          .getByRole("button", { name: "Принять перегруз как риск", exact: true })
          .click();
      });
      const overloadId = `${fixture!.user.id}:${overload.date}`;
      expect(accepted.applyEnvelope.command).toMatchObject({
        type: "risk.accept_overload",
        payload: { overloadId }
      });
      expect(accepted.applyEnvelope.idempotencyKey).toMatch(
        /^planning-apply-[0-9a-f-]{36}$/i
      );
      const acceptedBody = await accepted.applyResponse.json();
      details.acceptOverload = { ...commandEvidence(accepted), responseBody: acceptedBody };

      const replay = await page.request.post(planningPath(fixture.projectId, "apply-command"), {
        headers: mutationHeaders(page),
        data: accepted.applyEnvelope
      });
      expect(replay.status()).toBe(200);
      expect(await replay.json()).toEqual(acceptedBody);

      const conflict = await page.request.post(
        planningPath(fixture.projectId, "apply-command"),
        {
          headers: mutationHeaders(page),
          data: {
            ...accepted.applyEnvelope,
            command: {
              ...accepted.applyEnvelope.command,
              payload: {
                ...accepted.applyEnvelope.command.payload,
                acceptedRiskReason: "PROJ-118 conflicting replay"
              }
            }
          }
        }
      );
      expect(conflict.status()).toBe(409);
      expect(await conflict.json()).toEqual({ error: "idempotency_key_conflict" });
      details.idempotency = {
        replayStatus: replay.status(),
        replayBody: acceptedBody,
        conflictingReplayStatus: conflict.status(),
        conflictingReplayBody: { error: "idempotency_key_conflict" }
      };
      assertions.push("Exact apply replay returned the original response; changed replay returned 409");

      model = await getReadModel(page, fixture.projectId);
      expect(model.resourceLoad.acceptedOverloads).toContain(overloadId);
      expect(
        exactOverload(model, fixture.user.id, overload.date, assignmentId).accepted
      ).toBe(true);
      await page.reload();
      await waitForResources(page);
      const acceptedCell = await resourceCell(
        page,
        fixture.user.name,
        overload.date,
        "перегруз принят"
      );
      await expect(acceptedCell).toHaveText("✓");
      expect((await getReadModel(page, fixture.projectId)).resourceLoad.acceptedOverloads).toContain(
        overloadId
      );
      details.acceptedReload = {
        reloaded: true,
        apiReadback: {
          acceptedMarkerPresent: true,
          overloadAccepted: true
        }
      };
      screenshots.push(await screenshot(page, "accepted-reload"));
      assertions.push("Accepted marker persisted in the API and rendered after a full Resources reload");

      await page.goto(`/projects/${fixture.projectId}/assignments`);
      await expect(page.getByText("Назначения", { exact: true })).toBeVisible();
      await page.getByTestId(`assignment-row-${assignmentId}`).click();
      await page
        .getByRole("button", { name: "Снять исполнителя", exact: true })
        .click();
      const removeDialog = page.getByRole("dialog", {
        name: `Снять исполнителя «${fixture.user.name}»?`
      });
      const removed = await runUiCommand(page, fixture.projectId, async () => {
        await removeDialog.getByRole("button", { name: "Снять", exact: true }).click();
      });
      details.removeAssignment = commandEvidence(removed);
      expect(removed.applyEnvelope.command).toEqual({
        type: "assignment.delete",
        payload: { assignmentId }
      });

      model = await getReadModel(page, fixture.projectId);
      expect(findAssignment(model, assignmentId)).toBeUndefined();
      expect(
        model.resourceLoad.overloads.some(
          (candidate) =>
            candidate.granularity === "day" &&
            candidate.resourceId === fixture!.user.id &&
            candidate.date === overload.date &&
            candidate.assignmentIds.includes(assignmentId)
        )
      ).toBe(false);
      expect(model.resourceLoad.acceptedOverloads).toContain(overloadId);
      details.cleanup = {
        assignmentDeleted: true,
        overloadRemoved: true,
        acceptedRiskMarkerRetainedInDisposableDatabase: true,
        finalApiReadback: {
          assignmentPresent: false,
          overloadPresent: false,
          acceptedMarkerPresent: true,
          planVersion: model.planVersion
        }
      };
      assignmentId = "";

      await openResources(page, fixture.projectId);
      const resolvedCell = await resourceCell(page, fixture.user.name, overload.date);
      await expect(resolvedCell).not.toHaveAttribute("title", /ПЕРЕГРУЗ|перегруз принят/);
      await expect(resolvedCell).not.toHaveText("✓");
      screenshots.push(await screenshot(page, "resolved-api-ui"));
      assertions.push("Deleting the assignment removed the overload from both API and Resources UI");
    } catch (error) {
      failure = error;
      try {
        screenshots.push(await screenshot(page, "failed"));
      } catch {
        // The receipt still records the failure if the page itself is unavailable.
      }
      throw error;
    } finally {
      if (fixture && assignmentId) {
        await cleanupAssignment(page, fixture.projectId, assignmentId);
      }
      writeFileSync(
        RECEIPT_PATH,
        JSON.stringify(
          {
            schemaVersion: 1,
            runId: `proj-118-${Date.now()}`,
            generatedAt: new Date().toISOString(),
            row: {
              scenarioId: "PROJ-118",
              role: "admin",
              key: "PROJ-118:admin",
              status: failure ? "fail" : "pass",
              assertions,
              details,
              screenshots,
              error: failure instanceof Error ? failure.message : failure ? String(failure) : null
            }
          },
          null,
          2
        ),
        "utf8"
      );
    }
  });
});

function commandEvidence(result: ApplyResult) {
  return {
    previewEnvelope: result.previewEnvelope,
    applyEnvelope: result.applyEnvelope,
    applyStatus: result.applyResponse.status()
  };
}
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Пароль", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

async function findFixture(page: Page): Promise<Fixture> {
  const usersResponse = await page.request.get("/api/workspace/users");
  expect(usersResponse.status()).toBe(200);
  const users = ((await usersResponse.json()) as { users: WorkspaceUser[] }).users;
  const projectsResponse = await page.request.get("/api/workspace/projects");
  expect(projectsResponse.status()).toBe(200);
  const projects = (await projectsResponse.json()) as { projects: Array<{ id: string }> };

  for (const project of projects.projects) {
    const model = await getReadModel(page, project.id);
    const parentIds = new Set(
      model.authored.tasks
        .map((task) => task.parentTaskId)
        .filter((id): id is string => id !== null)
    );
    const calculated = new Map(model.calculatedPlan.tasks.map((task) => [task.id, task]));
    for (const task of model.authored.tasks) {
      const dates = calculated.get(task.id);
      if (
        parentIds.has(task.id) ||
        task.durationMinutes === null ||
        !dates?.calculatedStart ||
        !dates.calculatedFinish
      ) {
        continue;
      }
      const assigned = new Set(
        model.authored.assignments
          .filter((assignment) => assignment.taskId === task.id)
          .map((assignment) => assignment.resourceId)
      );
      const user = users.find((candidate) => {
        if (assigned.has(candidate.id)) return false;
        const hasWorkingDay = model.resourceLoad.buckets.some(
          (bucket) =>
            bucket.granularity === "day" &&
            bucket.resourceId === candidate.id &&
            bucket.date >= dates.calculatedStart! &&
            bucket.date <= dates.calculatedFinish! &&
            bucket.capacityMinutes > 0
        );
        const hasExistingOverload = model.resourceLoad.overloads.some(
          (overload) =>
            overload.granularity === "day" &&
            overload.resourceId === candidate.id &&
            overload.date >= dates.calculatedStart! &&
            overload.date <= dates.calculatedFinish!
        );
        return hasWorkingDay && !hasExistingOverload;
      });
      if (user) return { projectId: project.id, task, user };
    }
  }
  throw new Error("proj118_fixture_unavailable:no_scheduled_leaf_with_free_resource");
}

async function getReadModel(page: Page, projectId: string): Promise<ReadModel> {
  const response = await page.request.get(
    `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/read-model`
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

async function runUiCommand(
  page: Page,
  projectId: string,
  trigger: () => Promise<void>
): Promise<ApplyResult> {
  const previewPromise = waitForPlanningResponse(page, projectId, "preview-command");
  await trigger();
  const previewResponse = await previewPromise;
  expect(previewResponse.status()).toBe(200);
  const previewEnvelope = previewResponse.request().postDataJSON() as CommandEnvelope;

  const applyPromise = waitForPlanningResponse(page, projectId, "apply-command");
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Применить изменения", exact: true })
    .click();
  const applyResponse = await applyPromise;
  expect(applyResponse.status()).toBe(200);
  const applyEnvelope = applyResponse.request().postDataJSON() as CommandEnvelope;
  expect(applyEnvelope.command).toEqual(previewEnvelope.command);
  expect(applyEnvelope.clientPlanVersion).toBe(previewEnvelope.clientPlanVersion);
  return { previewEnvelope, applyEnvelope, applyResponse };
}

function taskBlock(page: Page, wbsCode: string) {
  return page.getByText(wbsCode, { exact: true }).first().locator("..").locator("..");
}

function assignmentRow(page: Page, fixture: Fixture) {
  return taskBlock(page, fixture.task.wbsCode)
    .getByRole("button")
    .filter({ hasText: fixture.user.name });
}

function findAssignment(model: ReadModel, assignmentId: string) {
  return model.authored.assignments.find((assignment) => assignment.id === assignmentId);
}

function exactOverload(
  model: ReadModel,
  resourceId: string,
  date: string,
  assignmentId: string
) {
  const overload = model.resourceLoad.overloads.find(
    (candidate) =>
      candidate.granularity === "day" &&
      candidate.resourceId === resourceId &&
      candidate.date === date &&
      candidate.assignmentIds.includes(assignmentId)
  );
  expect(overload, `missing exact overload ${resourceId}:${date}`).toBeDefined();
  return overload!;
}

async function openResources(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}/resources`);
  await waitForResources(page);
}

async function waitForResources(page: Page) {
  await expect(page.getByRole("button", { name: "Отсутствие", exact: true })).toBeVisible();
}

async function resourceCell(
  page: Page,
  resourceName: string,
  date: string,
  marker?: string
) {
  const cells = page.locator("button[title]");
  const count = await cells.count();
  const prefix = `${resourceName} · ${date}`;
  for (let index = 0; index < count; index += 1) {
    const cell = cells.nth(index);
    const title = (await cell.getAttribute("title")) ?? "";
    if (title.startsWith(prefix) && (!marker || title.includes(marker))) return cell;
  }
  throw new Error(`proj118_resource_cell_missing:${prefix}:${marker ?? "any"}`);
}

function planningPath(
  projectId: string,
  endpoint: "preview-command" | "apply-command"
) {
  return `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/${endpoint}`;
}

function waitForPlanningResponse(
  page: Page,
  projectId: string,
  endpoint: "preview-command" | "apply-command"
) {
  const path = planningPath(projectId, endpoint);
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === path
  );
}

function mutationHeaders(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "x-kiss-pm-action": "same-origin"
  };
}

async function cleanupAssignment(page: Page, projectId: string, assignmentId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const model = await getReadModel(page, projectId);
    if (!findAssignment(model, assignmentId)) return;
    const response = await page.request.post(planningPath(projectId, "apply-command"), {
      headers: mutationHeaders(page),
      data: {
        command: { type: "assignment.delete", payload: { assignmentId } },
        clientPlanVersion: model.planVersion,
        idempotencyKey: `proj-118-cleanup-${assignmentId}-${attempt}`
      }
    });
    if (response.status() === 200) return;
    if (response.status() !== 409) {
      throw new Error(`proj118_cleanup_failed:${response.status()}:${await response.text()}`);
    }
  }
  throw new Error("proj118_cleanup_conflict");
}

async function screenshot(page: Page, state: string) {
  const name = `proj-118-admin-${state}.png`;
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, name), fullPage: true });
  return name;
}

function hours(minutes: number) {
  return (Math.round((minutes / 60) * 10) / 10).toLocaleString("ru-RU");
}
