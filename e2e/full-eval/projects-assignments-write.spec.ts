import { expect, test, type Page } from "@playwright/test";

type Task = {
  id: string;
  parentTaskId: string | null;
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

type ReadModel = {
  authored: {
    tasks: Task[];
    assignments: Assignment[];
  };
  planVersion: number;
};

type WorkspaceUser = {
  id: string;
  name: string;
};

type AssignmentFixture = {
  task: Task;
  user: WorkspaceUser;
};

type CommandEnvelope = {
  command: {
    type: string;
    payload: Record<string, unknown>;
  };
  clientPlanVersion: number;
  idempotencyKey?: string;
};

test.describe("Projects assignments write flows", () => {
  test("ADMIN adds and removes an assignment with API readback and reload", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, {
      email: "admin@kiss-pm.local",
      password: "admin12345"
    });
    const before = await getReadModel(page, projectId);
    const users = await getWorkspaceUsers(page);
    const fixture = selectFreeAssignmentFixture(before, users);
    let createdAssignmentId = "";

    try {
      const directoryResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === "GET" && url.pathname === "/api/workspace/users";
      });
      await page.goto(`/projects/${projectId}/assignments`);
      expect((await directoryResponsePromise).status()).toBe(200);
      const addButton = taskBlock(page, fixture.task.wbsCode).getByTitle(
        "Добавить исполнителя"
      );
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeEnabled();
      await addButton.click();

      const addDialog = page.getByRole("dialog", { name: "Добавить исполнителя" });
      await expect(addDialog).toContainText(fixture.task.title);
      await addDialog.getByRole("combobox", { name: "Ресурс", exact: true }).selectOption(fixture.user.id);
      await addDialog.getByRole("combobox", { name: "Роль", exact: true }).selectOption("observer");

      const createPreviewPromise = waitForPlanningResponse(
        page,
        projectId,
        "preview-command"
      );
      await addDialog.getByRole("button", { name: "Добавить", exact: true }).click();
      const createPreview = await createPreviewPromise;
      expect(createPreview.status()).toBe(200);

      const createPreviewEnvelope =
        createPreview.request().postDataJSON() as CommandEnvelope;
      expect(createPreviewEnvelope.command.type).toBe("assignment.upsert");
      expect(createPreviewEnvelope.command.payload.taskId).toBe(fixture.task.id);
      expect(createPreviewEnvelope.command.payload.resourceId).toBe(fixture.user.id);
      expect(createPreviewEnvelope.command.payload.role).toBe("observer");

      const createResponsePromise = waitForPlanningResponse(
        page,
        projectId,
        "apply-command"
      );
      await confirmPlanningPreview(page);
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(200);

      const createEnvelope = createResponse.request().postDataJSON() as CommandEnvelope;
      expect(createEnvelope.command).toEqual(createPreviewEnvelope.command);
      expect(createEnvelope.clientPlanVersion).toBe(createPreviewEnvelope.clientPlanVersion);
      expect(createEnvelope.idempotencyKey).toMatch(/^planning-apply-[0-9a-f-]{36}$/i);
      createdAssignmentId = String(createEnvelope.command.payload.id ?? "");
      expect(createdAssignmentId).toMatch(/^a-[0-9a-f-]{36}$/i);

      let readModel = await getReadModel(page, projectId);
      const created = readModel.authored.assignments.find(
        (assignment) => assignment.id === createdAssignmentId
      );
      expect(created).toMatchObject({
        taskId: fixture.task.id,
        resourceId: fixture.user.id,
        role: "observer",
        unitsPermille: 1000,
        workMinutes: 0
      });
      expect(readModel.planVersion).toBeGreaterThan(before.planVersion);
      const createdPlanVersion = readModel.planVersion;

      await page.reload();
      const createdRow = assignmentRow(page, fixture);
      await expect(createdRow).toHaveCount(1);
      await expect(createdRow).toContainText("Наблюдатель");
      await createdRow.click();

      await page
        .getByRole("button", { name: "Снять исполнителя", exact: true })
        .click();
      const removeDialog = page.getByRole("dialog", {
        name: `Снять исполнителя «${fixture.user.name}»?`
      });
      await expect(removeDialog).toContainText(
        "Назначение и его кривая распределения будут удалены."
      );

      const deletePreviewPromise = waitForPlanningResponse(
        page,
        projectId,
        "preview-command"
      );
      await removeDialog.getByRole("button", { name: "Снять", exact: true }).click();
      const deletePreview = await deletePreviewPromise;
      expect(deletePreview.status()).toBe(200);

      const deletePreviewEnvelope =
        deletePreview.request().postDataJSON() as CommandEnvelope;
      expect(deletePreviewEnvelope.command).toEqual({
        type: "assignment.delete",
        payload: { assignmentId: createdAssignmentId }
      });

      const deleteResponsePromise = waitForPlanningResponse(
        page,
        projectId,
        "apply-command"
      );
      await confirmPlanningPreview(page);
      const deleteResponse = await deleteResponsePromise;
      expect(deleteResponse.status()).toBe(200);

      const deleteEnvelope = deleteResponse.request().postDataJSON() as CommandEnvelope;
      expect(deleteEnvelope.command).toEqual(deletePreviewEnvelope.command);
      expect(deleteEnvelope.clientPlanVersion).toBe(deletePreviewEnvelope.clientPlanVersion);
      expect(deleteEnvelope.idempotencyKey).toMatch(/^planning-apply-[0-9a-f-]{36}$/i);

      readModel = await getReadModel(page, projectId);
      expect(
        readModel.authored.assignments.some(
          (assignment) => assignment.id === createdAssignmentId
        )
      ).toBe(false);
      expect(readModel.planVersion).toBeGreaterThan(createdPlanVersion);

      await page.reload();
      await expect(assignmentRow(page, fixture)).toHaveCount(0);
      createdAssignmentId = "";
    } finally {
      if (createdAssignmentId) {
        await cleanupAssignment(page, projectId, createdAssignmentId);
      }
    }
  });

  test("PLAN reader sees read-only assignments and direct preview is denied without apply", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, {
      email: "plan-reader-no-resources@kiss-pm.local",
      password: "reader12345"
    });
    const before = await getReadModel(page, projectId);
    const fixture = selectExistingLeafAssignment(before);

    await page.goto("/projects/" + projectId + "/assignments");
    await expect(
      taskBlock(page, fixture.task.wbsCode).getByTitle("Добавить исполнителя")
    ).toHaveCount(0);

    await existingAssignmentRow(page, fixture.task.wbsCode).click();
    await expect(page.getByLabel("Единицы %", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Кривая распределения", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Снять исполнителя", exact: true })
    ).toHaveCount(0);

    const applyPath = planningPath(projectId, "apply-command");
    let applyRequestCount = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === applyPath
      ) {
        applyRequestCount += 1;
      }
    });

    const deniedUnitsPermille =
      fixture.assignment.unitsPermille === 1000
        ? 990
        : fixture.assignment.unitsPermille + 10;
    const deniedEnvelope: CommandEnvelope = {
      command: {
        type: "assignment.upsert",
        payload: {
          id: fixture.assignment.id,
          taskId: fixture.assignment.taskId,
          resourceId: fixture.assignment.resourceId,
          role: fixture.assignment.role,
          unitsPermille: deniedUnitsPermille,
          workMinutes: fixture.assignment.workMinutes ?? 0
        }
      },
      clientPlanVersion: before.planVersion
    };
    const deniedResponse = await page.request.post(
      planningPath(projectId, "preview-command"),
      {
        headers: mutationHeaders(page),
        data: deniedEnvelope
      }
    );
    expect(deniedResponse.status()).toBe(403);
    expect(applyRequestCount).toBe(0);
    await expect(
      page.getByRole("dialog", { name: "Предпросмотр изменений" })
    ).toHaveCount(0);

    const after = await getReadModel(page, projectId);
    expect(after.planVersion).toBe(before.planVersion);
    expect(
      after.authored.assignments.find(
        (assignment) => assignment.id === fixture.assignment.id
      )
    ).toEqual(fixture.assignment);

    await page.reload();
    await expect(
      taskBlock(page, fixture.task.wbsCode).getByTitle("Добавить исполнителя")
    ).toHaveCount(0);
    const reloaded = await getReadModel(page, projectId);
    expect(reloaded.planVersion).toBe(before.planVersion);
    expect(
      reloaded.authored.assignments.find(
        (assignment) => assignment.id === fixture.assignment.id
      )
    ).toEqual(fixture.assignment);
  });
});

async function loginAndGetProject(
  page: Page,
  credentials: { email: string; password: string }
) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Пароль", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("**/dashboard");

  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { projects: Array<{ id: string }> };
  expect(body.projects.length).toBeGreaterThan(0);
  return body.projects[0]!.id;
}

async function getReadModel(page: Page, projectId: string): Promise<ReadModel> {
  const response = await page.request.get(
    `/api/workspace/projects/${encodeURIComponent(projectId)}/planning/read-model`
  );
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

function selectFreeAssignmentFixture(
  readModel: ReadModel,
  users: WorkspaceUser[]
): AssignmentFixture {
  const parentTaskIds = new Set(
    readModel.authored.tasks
      .map((task) => task.parentTaskId)
      .filter((taskId): taskId is string => taskId !== null)
  );
  const leafTasks = readModel.authored.tasks.filter(
    (task) => !parentTaskIds.has(task.id)
  );

  for (const task of leafTasks) {
    const assignedResourceIds = new Set(
      readModel.authored.assignments
        .filter((assignment) => assignment.taskId === task.id)
        .map((assignment) => assignment.resourceId)
    );
    const user = users.find((candidate) => !assignedResourceIds.has(candidate.id));
    if (user) return { task, user };
  }

  throw new Error("assignment_fixture_unavailable:no_free_leaf_task_resource_pair");
}

function selectExistingLeafAssignment(readModel: ReadModel) {
  const parentTaskIds = new Set(
    readModel.authored.tasks
      .map((task) => task.parentTaskId)
      .filter((taskId): taskId is string => taskId !== null)
  );
  const taskById = new Map(readModel.authored.tasks.map((task) => [task.id, task]));
  const assignment = readModel.authored.assignments.find((candidate) => {
    const task = taskById.get(candidate.taskId);
    return task && !parentTaskIds.has(task.id);
  });
  if (!assignment) {
    throw new Error("assignment_fixture_unavailable:no_existing_leaf_assignment");
  }
  return { assignment, task: taskById.get(assignment.taskId)! };
}

function taskBlock(page: Page, wbsCode: string) {
  return page.getByText(wbsCode, { exact: true }).first().locator("..").locator("..");
}

function assignmentRow(page: Page, fixture: AssignmentFixture) {
  return taskBlock(page, fixture.task.wbsCode)
    .getByRole("button")
    .filter({ hasText: fixture.user.name });
}

function existingAssignmentRow(page: Page, wbsCode: string) {
  return taskBlock(page, wbsCode)
    .locator('button:not([title="Добавить исполнителя"])')
    .first();
}

function planningPath(
  projectId: string,
  endpoint: "preview-command" | "apply-command"
) {
  return `/api/workspace/projects/${encodeURIComponent(
    projectId
  )}/planning/${endpoint}`;
}

function waitForPlanningResponse(
  page: Page,
  projectId: string,
  endpoint: "preview-command" | "apply-command"
) {
  const path = planningPath(projectId, endpoint);
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && url.pathname === path;
  });
}

async function confirmPlanningPreview(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Применить изменения", exact: true })
    .click();
}

async function cleanupAssignment(
  page: Page,
  projectId: string,
  assignmentId: string
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const readModel = await getReadModel(page, projectId);
    if (
      !readModel.authored.assignments.some(
        (assignment) => assignment.id === assignmentId
      )
    ) {
      return;
    }

    const response = await page.request.post(
      planningPath(projectId, "apply-command"),
      {
        headers: mutationHeaders(page),
        data: {
          command: {
            type: "assignment.delete",
            payload: { assignmentId }
          },
          clientPlanVersion: readModel.planVersion
        }
      }
    );
    if (response.status() === 200) return;
    if (response.status() !== 409) {
      throw new Error(`assignment_cleanup_failed:${assignmentId}:${response.status()}`);
    }
  }
  throw new Error(`assignment_cleanup_conflict:${assignmentId}`);
}

function mutationHeaders(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "x-kiss-pm-action": "same-origin"
  };
}
