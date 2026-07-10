import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const PLAN_READER_NO_RESOURCES = {
  email: "plan-reader-no-resources@kiss-pm.local",
  password: "reader12345"
};
const APPLY_COMMAND_PATH = (projectId: string) =>
  `/api/workspace/projects/${projectId}/planning/apply-command`;
const APPLY_COMMAND_BATCH_PATH = (projectId: string) =>
  `/api/workspace/projects/${projectId}/planning/apply-command-batch`;

type PlanningEndpoint =
  | "preview-command"
  | "preview-command-batch"
  | "apply-command"
  | "apply-command-batch";

type CalendarException = {
  id: string;
  calendarId: string;
  resourceId: string | null;
  date: string;
  workingMinutes: number;
  reason: string | null;
};

type ReadModel = {
  authored: {
    assignments: Array<{ resourceId: string }>;
  };
  project: {
    calendarId: string | null;
    plannedStart: string | null;
    plannedFinish: string | null;
  };
  calendars: Array<{
    id: string;
    workingWeekdays: number[];
    workingMinutesPerDay: number;
  }>;
  calendarExceptions: CalendarException[];
  planVersion: number;
};

type CalendarCommand = {
  type: "calendar.exception.upsert";
  payload: CalendarException;
};

type CalendarCommandEnvelope = {
  command: CalendarCommand;
  clientPlanVersion: number;
};

type CalendarCommandBatchEnvelope = {
  commands: CalendarCommand[];
  clientPlanVersion: number;
};

test.describe("Projects resources absence write flows", () => {
  test("ADMIN creates and removes a resource absence with API readback and reload", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, ADMIN);
    const before = await getReadModel(page, projectId);
    const absenceDate = chooseUnusedWorkingDate(before);
    let created: CalendarException | undefined;

    try {
      await openProjectResources(page, projectId);
      const dialog = await openAbsenceDialog(page);
      const resource = await selectedResource(dialog);
      await fillOneDayAbsence(dialog, absenceDate);

      const createPreviewPromise = waitForPlanningResponse(
        page,
        projectId,
        "preview-command-batch"
      );
      await dialog
        .getByRole("button", { name: "Добавить отсутствие", exact: true })
        .click();
      const createPreviewResponse = await createPreviewPromise;
      expect(createPreviewResponse.status()).toBe(200);

      const createPreviewEnvelope =
        createPreviewResponse.request().postDataJSON() as CalendarCommandBatchEnvelope;
      expect(createPreviewEnvelope.commands).toHaveLength(1);
      expect(createPreviewEnvelope.commands[0]?.type).toBe("calendar.exception.upsert");

      const createResponsePromise = waitForPlanningResponse(
        page,
        projectId,
        "apply-command-batch"
      );
      await confirmPlanningPreview(page);
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(200);

      const createEnvelope =
        createResponse.request().postDataJSON() as CalendarCommandBatchEnvelope;
      expect(createEnvelope).toEqual(createPreviewEnvelope);
      created = createEnvelope.commands[0]!.payload;
      expect(created).toMatchObject({
        resourceId: resource.id,
        date: absenceDate,
        workingMinutes: 0,
        reason: "Отпуск"
      });

      const createdModel = await getReadModel(page, projectId);
      expect(findException(createdModel, created.id)).toEqual(created);
      expect(findActiveException(createdModel, created.id)).toEqual(created);
      expect(createdModel.planVersion).toBeGreaterThan(createEnvelope.clientPlanVersion);

      await page.reload();
      await waitForResources(page);
      const reloadedCreatedModel = await getReadModel(page, projectId);
      expect(findActiveException(reloadedCreatedModel, created.id)).toEqual(created);

      await openResourceCalendar(page, projectId, resource.name);
      await expect(exceptionRow(page, created.date)).toContainText("Отпуск");

      const removePreviewPromise = waitForPlanningResponse(
        page,
        projectId,
        "preview-command"
      );
      await exceptionRow(page, created.date).getByTitle("Снять исключение").click();
      const removePreviewResponse = await removePreviewPromise;
      expect(removePreviewResponse.status()).toBe(200);

      const removePreviewEnvelope =
        removePreviewResponse.request().postDataJSON() as CalendarCommandEnvelope;
      const removeResponsePromise = waitForPlanningResponse(
        page,
        projectId,
        "apply-command"
      );
      await confirmPlanningPreview(page);
      const removeResponse = await removeResponsePromise;
      expect(removeResponse.status()).toBe(200);

      const removeEnvelope =
        removeResponse.request().postDataJSON() as CalendarCommandEnvelope;
      expect(removeEnvelope).toEqual(removePreviewEnvelope);
      expect(removeEnvelope.command).toMatchObject({
        type: "calendar.exception.upsert",
        payload: {
          id: created.id,
          calendarId: created.calendarId,
          resourceId: resource.id,
          date: created.date,
          reason: ""
        }
      });

      const removedModel = await getReadModel(page, projectId);
      const calendar = removedModel.calendars.find(
        (item) => item.id === created!.calendarId
      );
      expect(calendar).toBeTruthy();
      expect(findException(removedModel, created.id)?.workingMinutes).toBe(
        calendar!.workingMinutesPerDay
      );
      expect(findActiveException(removedModel, created.id)).toBeUndefined();
      expect(removedModel.planVersion).toBeGreaterThan(removeEnvelope.clientPlanVersion);

      await page.reload();
      await waitForCalendar(page);
      await selectCalendarResource(page, resource.name);
      await expect(exceptionDate(page, created.date)).toHaveCount(0);
      const reloadedRemovedModel = await getReadModel(page, projectId);
      expect(findActiveException(reloadedRemovedModel, created.id)).toBeUndefined();
    } finally {
      if (created) {
        await cleanupCalendarException(page, projectId, created);
      }
    }
  });

  test("PLAN reader without resource permission sees no absence write control and gets 403", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, PLAN_READER_NO_RESOURCES);
    const before = await getReadModel(page, projectId);
    const absenceDate = chooseUnusedWorkingDate(before);
    const resourceId = before.authored.assignments[0]?.resourceId;
    expect(resourceId).toBeTruthy();
    expect(before.project.calendarId).toBeTruthy();

    await page.goto(`/projects/${projectId}/resources`);
    await expect(
      page.getByText("Загрузка ресурсной загрузки…", { exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Отсутствие", exact: true })
    ).toHaveCount(0);

    let applyRequestCount = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === APPLY_COMMAND_BATCH_PATH(projectId)
      ) {
        applyRequestCount += 1;
      }
    });

    const deniedId = `absence-denied-${Date.now()}`;
    const deniedResponse = await page.request.post(
      `/api/workspace/projects/${projectId}/planning/preview-command-batch`,
      {
        headers: sameOriginMutationHeaders(page),
        data: {
          clientPlanVersion: before.planVersion,
          commands: [
            {
              type: "calendar.exception.upsert",
              payload: {
                id: deniedId,
                calendarId: before.project.calendarId,
                resourceId,
                date: absenceDate,
                workingMinutes: 0,
                reason: "Отпуск"
              }
            }
          ]
        }
      }
    );
    expect(deniedResponse.status()).toBe(403);
    expect(applyRequestCount).toBe(0);

    const after = await getReadModel(page, projectId);
    expect(after.planVersion).toBe(before.planVersion);
    expect(findException(after, deniedId)).toBeUndefined();

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Отсутствие", exact: true })
    ).toHaveCount(0);
    const reloaded = await getReadModel(page, projectId);
    expect(reloaded.planVersion).toBe(before.planVersion);
    expect(findException(reloaded, deniedId)).toBeUndefined();
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

async function openProjectResources(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}/resources`);
  await waitForResources(page);
}

async function waitForResources(page: Page) {
  await expect(page.getByRole("button", { name: "Отсутствие", exact: true })).toBeVisible();
}

async function openAbsenceDialog(page: Page) {
  await page.getByRole("button", { name: "Отсутствие", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Отсутствие сотрудника" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Сотрудник", exact: true }).locator("option")).not.toHaveCount(0);
  return dialog;
}

async function selectedResource(dialog: ReturnType<Page["getByRole"]>) {
  const select = dialog.getByRole("combobox", { name: "Сотрудник", exact: true });
  const id = await select.inputValue();
  const optionText = (await select.locator("option:checked").textContent())?.trim() ?? "";
  const name = optionText.split(" · ")[0]?.trim() ?? "";
  expect(id).not.toBe("");
  expect(name).not.toBe("");
  return { id, name };
}

async function fillOneDayAbsence(
  dialog: ReturnType<Page["getByRole"]>,
  absenceDate: string
) {
  await dialog.getByRole("button", { name: "Отпуск", exact: true }).click();
  await dialog.getByLabel("С", { exact: true }).fill(absenceDate);
  await dialog.getByLabel("По", { exact: true }).fill(absenceDate);
}

async function openResourceCalendar(
  page: Page,
  projectId: string,
  resourceName: string
) {
  await page.goto(`/projects/${projectId}/calendars`);
  await waitForCalendar(page);
  await selectCalendarResource(page, resourceName);
}

async function waitForCalendar(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Календари проекта и ресурсов" })
  ).toBeVisible();
}

async function selectCalendarResource(page: Page, resourceName: string) {
  const resourceButton = page
    .getByRole("button")
    .filter({ has: page.getByText(resourceName, { exact: true }) })
    .first();
  await expect(resourceButton).toBeVisible();
  await resourceButton.click();
  await expect(page.getByText(`${resourceName} · наследует календарь проекта`, { exact: true })).toBeVisible();
}

function exceptionDate(page: Page, isoDate: string) {
  return page.getByText(formatRuDate(isoDate), { exact: true });
}

function exceptionRow(page: Page, isoDate: string) {
  return exceptionDate(page, isoDate).locator("..");
}

function waitForPlanningResponse(
  page: Page,
  projectId: string,
  endpoint: PlanningEndpoint
) {
  const path = `/api/workspace/projects/${projectId}/planning/${endpoint}`;
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === path
  );
}

async function confirmPlanningPreview(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Применить изменения", exact: true })
    .click();
}

async function getReadModel(page: Page, projectId: string): Promise<ReadModel> {
  const response = await page.request.get(
    `/api/workspace/projects/${projectId}/planning/read-model`
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as ReadModel;
}

function findException(readModel: ReadModel, exceptionId: string) {
  return readModel.calendarExceptions.find((item) => item.id === exceptionId);
}

function findActiveException(readModel: ReadModel, exceptionId: string) {
  const item = findException(readModel, exceptionId);
  if (!item) return undefined;
  const calendar = readModel.calendars.find((candidate) => candidate.id === item.calendarId);
  return calendar && item.workingMinutes < calendar.workingMinutesPerDay ? item : undefined;
}

function chooseUnusedWorkingDate(readModel: ReadModel) {
  const calendar =
    readModel.calendars.find((item) => item.id === readModel.project.calendarId) ??
    readModel.calendars[0];
  if (!calendar) throw new Error("absence_test_calendar_missing");

  const start = parseIsoDate(readModel.project.plannedStart) ?? startOfUtcDay(new Date());
  const plannedFinish = parseIsoDate(readModel.project.plannedFinish);
  const finish =
    plannedFinish && plannedFinish >= start
      ? plannedFinish
      : shiftUtcDate(start, 370);
  const occupiedDates = new Set(readModel.calendarExceptions.map((item) => item.date));

  for (let date = start; date <= finish; date = shiftUtcDate(date, 1)) {
    const isoDate = date.toISOString().slice(0, 10);
    if (calendar.workingWeekdays.includes(date.getUTCDay()) && !occupiedDates.has(isoDate)) {
      return isoDate;
    }
  }
  throw new Error("absence_test_unused_working_date_missing");
}

async function cleanupCalendarException(
  page: Page,
  projectId: string,
  created: CalendarException
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await getReadModel(page, projectId);
    if (!findActiveException(current, created.id)) return;
    const calendar = current.calendars.find((item) => item.id === created.calendarId);
    if (!calendar) throw new Error(`absence_cleanup_missing_calendar:${created.calendarId}`);

    const response = await page.request.post(APPLY_COMMAND_PATH(projectId), {
      data: {
        command: {
          type: "calendar.exception.upsert",
          payload: {
            ...created,
            workingMinutes: calendar.workingMinutesPerDay,
            reason: ""
          }
        },
        clientPlanVersion: current.planVersion
      },
      headers: sameOriginMutationHeaders(page)
    });
    if (response.status() === 200) return;
    if (response.status() !== 409) {
      throw new Error(`absence_cleanup_failed:${created.id}:${response.status()}`);
    }
  }
  throw new Error(`absence_cleanup_conflict:${created.id}`);
}

function sameOriginMutationHeaders(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "x-kiss-pm-action": "same-origin"
  };
}

function parseIsoDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function shiftUtcDate(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatRuDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
