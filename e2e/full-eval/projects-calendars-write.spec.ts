import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345" };
const PLAN_READER = {
  email: "plan-reader-no-resources@kiss-pm.local",
  password: "reader12345"
};
const APPLY_COMMAND_PATH = (projectId: string) =>
  `/api/workspace/projects/${projectId}/planning/apply-command`;

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
  project: { calendarId: string | null };
  calendars: Array<{
    id: string;
    workingMinutesPerDay: number;
  }>;
  calendarExceptions: CalendarException[];
  planVersion: number;
};

type CalendarCommandEnvelope = {
  command: {
    type: "calendar.exception.upsert";
    payload: CalendarException;
  };
  clientPlanVersion: number;
};

test.describe("Projects calendars write flows", () => {
  test("ADMIN creates and removes a project calendar exception with API readback and reload", async ({
    page
  }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, ADMIN);
    let created: CalendarException | undefined;

    try {
      await openProjectCalendar(page, projectId);

      const createPreviewPromise = waitForPlanningResponse(
        page,
        projectId,
        "preview-command"
      );
      await firstAvailableWorkingDay(page).click();
      const createPreviewResponse = await createPreviewPromise;
      expect(createPreviewResponse.status()).toBe(200);

      const createPreviewEnvelope =
        createPreviewResponse.request().postDataJSON() as CalendarCommandEnvelope;
      expect(createPreviewEnvelope.command.type).toBe("calendar.exception.upsert");

      const createResponsePromise = waitForPlanningResponse(
        page,
        projectId,
        "apply-command"
      );
      await confirmPlanningPreview(page);
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(200);

      const createEnvelope = createResponse.request().postDataJSON() as CalendarCommandEnvelope;
      expect(createEnvelope).toEqual(createPreviewEnvelope);
      expect(createEnvelope.command.type).toBe("calendar.exception.upsert");
      created = createEnvelope.command.payload;
      expect(created.resourceId).toBeNull();
      expect(created.workingMinutes).toBe(0);
      expect(created.reason).toBe("Праздник");

      const createdModel = await getReadModel(page, projectId);
      expect(findException(createdModel, created.id)).toEqual(created);
      expect(createdModel.planVersion).toBeGreaterThan(createEnvelope.clientPlanVersion);
      await expect(exceptionRow(page, created.date)).toContainText("праздник");

      await page.reload();
      await waitForCalendar(page);
      await expect(exceptionRow(page, created.date)).toContainText("праздник");

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

      const removeEnvelope = removeResponse.request().postDataJSON() as CalendarCommandEnvelope;
      expect(removeEnvelope).toEqual(removePreviewEnvelope);
      expect(removeEnvelope.command).toMatchObject({
        type: "calendar.exception.upsert",
        payload: {
          id: created.id,
          calendarId: created.calendarId,
          resourceId: null,
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
      await expect(exceptionDate(page, created.date)).toHaveCount(0);

      await page.reload();
      await waitForCalendar(page);
      await expect(exceptionDate(page, created.date)).toHaveCount(0);
    } finally {
      if (created) {
        await cleanupCalendarException(page, projectId, created);
      }
    }
  });

  test("PLAN reader sees a read-only calendar and direct preview is denied", async ({ page }) => {
    test.setTimeout(90_000);
    const projectId = await loginAndGetProject(page, PLAN_READER);
    const before = await getReadModel(page, projectId);
    expect(before.project.calendarId).toBeTruthy();

    await openProjectCalendar(page, projectId);
    await expect(firstAvailableWorkingDay(page)).toHaveCount(0);
    await expect(
      page.locator('button[title="Рабочий день"]:enabled')
    ).toHaveCount(0);

    let applyRequestCount = 0;
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      const pathname = new URL(request.url()).pathname;
      if (
        pathname === planningPath(projectId, "apply-command") ||
        pathname === planningPath(projectId, "apply-command-batch")
      ) {
        applyRequestCount += 1;
      }
    });

    const deniedId = "calendar-denied-" + Date.now();
    const deniedEnvelope: CalendarCommandEnvelope = {
      command: {
        type: "calendar.exception.upsert",
        payload: {
          id: deniedId,
          calendarId: before.project.calendarId!,
          resourceId: null,
          date: "2026-07-29",
          workingMinutes: 0,
          reason: "Праздник"
        }
      },
      clientPlanVersion: before.planVersion
    };
    const deniedResponse = await page.request.post(
      planningPath(projectId, "preview-command"),
      {
        data: deniedEnvelope,
        headers: sameOriginMutationHeaders(page)
      }
    );
    expect(deniedResponse.status()).toBe(403);
    expect(applyRequestCount).toBe(0);
    await expect(
      page.getByRole("dialog", { name: "Предпросмотр изменений" })
    ).toHaveCount(0);

    const after = await getReadModel(page, projectId);
    expect(after.planVersion).toBe(before.planVersion);
    expect(findException(after, deniedId)).toBeUndefined();

    await page.reload();
    await waitForCalendar(page);
    await expect(firstAvailableWorkingDay(page)).toHaveCount(0);
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

async function openProjectCalendar(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}/calendars`);
  await waitForCalendar(page);
}

async function waitForCalendar(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Календари проекта и ресурсов" })
  ).toBeVisible();
  await expect(page.getByText("Календарь проекта · базовый", { exact: true })).toBeVisible();
}

function firstAvailableWorkingDay(page: Page) {
  return page
    .locator('button[title="Рабочий день — клик: нерабочий"]:enabled')
    .first();
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
  const path = planningPath(projectId, endpoint);
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === path
  );
}

function planningPath(projectId: string, endpoint: PlanningEndpoint) {
  return `/api/workspace/projects/${projectId}/planning/${endpoint}`;
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

async function cleanupCalendarException(
  page: Page,
  projectId: string,
  created: CalendarException
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await getReadModel(page, projectId);
    if (!findActiveException(current, created.id)) return;
    const calendar = current.calendars.find((item) => item.id === created.calendarId);
    if (!calendar) throw new Error(`calendar_cleanup_missing_calendar:${created.calendarId}`);

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
      throw new Error(`calendar_cleanup_failed:${created.id}:${response.status()}`);
    }
  }
  throw new Error(`calendar_cleanup_conflict:${created.id}`);
}

function sameOriginMutationHeaders(page: Page) {
  return {
    Origin: new URL(page.url()).origin,
    "x-kiss-pm-action": "same-origin"
  };
}

function formatRuDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
