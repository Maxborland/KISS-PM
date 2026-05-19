import { expect, test } from "@playwright/test";

import {
  deactivateStaleSmokeOpportunityFields,
  getRequiredOpportunityCustomFieldValues,
  loginToWorkspace,
  logoutThroughUserMenu
} from "./smokeHelpers";

test("deal detail shows persisted chat, tasks and audit in one workspace", async ({
  page
}) => {
  const suffix = Date.now().toString(36);
  const opportunityId = `activity-e2e-${suffix}`;
  const title = `Активность сделки ${suffix}`;
  const comment = `Комментарий по сделке ${suffix}`;
  const taskTitle = `Контрольная задача ${suffix}`;

  await page.goto("/");
  await loginToWorkspace(page, { password: "local-admin-password" });
  await deactivateStaleSmokeOpportunityFields(page);
  const customFieldValues = await getRequiredOpportunityCustomFieldValues(page);

  const createResponse = await page.request.post("/api/workspace/opportunities", {
    data: {
      id: opportunityId,
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-new",
      title,
      description: "E2E проверка рабочего окна сделки",
      plannedStart: "2031-03-01",
      plannedFinish: "2031-03-31",
      contractValue: 900000,
      plannedHourlyRate: 6000,
      probability: 50,
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 150 }],
      customFieldValues
    },
    headers: {
      "x-kiss-pm-action": "same-origin"
    }
  });
  expect(createResponse.status()).toBe(201);

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Рабочее окно сделки" })).toBeVisible();
  const activityPanel = page.getByLabel("Рабочая лента сделки");

  await page.getByRole("button", { name: "Проверить ресурсы" }).click();
  await expect(
    activityPanel.getByText("Ресурсная проверка сделки выполнена")
  ).toBeVisible();

  await activityPanel.getByRole("button", { name: "Чат" }).click();
  await activityPanel.getByLabel("Сообщение").fill(comment);
  await activityPanel.getByRole("button", { name: "Отправить" }).click();
  await expect(activityPanel.getByText(comment)).toBeVisible();

  await activityPanel.getByRole("button", { name: "Задачи" }).click();
  await activityPanel.getByLabel("Новая задача").fill(taskTitle);
  await activityPanel.getByLabel("Описание").fill("Подготовить следующий контакт");
  await activityPanel.getByLabel("Срок").fill("2031-03-10");
  await activityPanel
    .getByLabel("Ответственный")
    .selectOption({ label: "Анна Администратор" });
  await activityPanel.getByRole("button", { name: "Создать задачу" }).click();
  const taskRow = activityPanel.locator(".activity-row").filter({ hasText: taskTitle });
  await expect(taskRow).toBeVisible();
  await taskRow.getByRole("button", { name: "Выполнить" }).click();
  await expect(taskRow.getByText("Выполнена")).toBeVisible();

  await activityPanel.getByRole("button", { name: "Лента" }).click();
  await expect(activityPanel.getByText(comment)).toBeVisible();
  await expect(activityPanel.getByText(taskTitle)).toBeVisible();
  await expect(activityPanel.getByText("Комментарий по сделке создан")).toBeVisible();
  await expect(
    activityPanel.getByText("Ресурсная проверка сделки выполнена")
  ).toBeVisible();

  await activityPanel.getByRole("button", { name: "Аудит" }).click();
  await expect(
    activityPanel.getByText("Ресурсная проверка сделки выполнена")
  ).toBeVisible();
  await expect(activityPanel.getByText("Комментарий по сделке создан")).toBeVisible();
  await expect(activityPanel.getByText("Задача по сделке создана")).toBeVisible();
  await expect(activityPanel.getByText("Задача по сделке выполнена")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByLabel("Рабочая лента сделки").getByText(comment)).toBeVisible();
  await expect(page.getByLabel("Рабочая лента сделки").getByText(taskTitle)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const mobileWidths = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
    rootScrollWidth: document.documentElement.scrollWidth
  }));
  expect(mobileWidths.rootScrollWidth).toBeLessThanOrEqual(mobileWidths.innerWidth);
  expect(mobileWidths.bodyScrollWidth).toBeLessThanOrEqual(mobileWidths.innerWidth);
});

test("deal activity panel is read-only for users without manage and audit permissions", async ({
  page
}) => {
  const suffix = Date.now().toString(36);
  const opportunityId = `activity-readonly-${suffix}`;
  const roleId = `activity-readonly-role-${suffix}`;
  const userId = `activity-readonly-user-${suffix}`;
  const userEmail = `activity-readonly-${suffix}@kiss-pm.local`;
  const title = `Readonly activity ${suffix}`;
  const comment = `Видимый комментарий ${suffix}`;

  await page.goto("/");
  await loginToWorkspace(page, { password: "local-admin-password" });
  await deactivateStaleSmokeOpportunityFields(page);
  const customFieldValues = await getRequiredOpportunityCustomFieldValues(page);

  expect(
    (
      await page.request.post("/api/workspace/opportunities", {
        data: {
          id: opportunityId,
          clientId: "client-romashka",
          primaryContactId: "contact-irina",
          projectTypeId: "project-type-implementation",
          stageId: "deal-stage-new",
          title,
          description: "E2E проверка read-only панели активности",
          plannedStart: "2031-04-01",
          plannedFinish: "2031-04-30",
          contractValue: 600000,
          plannedHourlyRate: 6000,
          probability: 40,
          templateId: null,
          demand: [{ positionId: "position-engineer", requiredHours: 100 }],
          customFieldValues
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(201);
  expect(
    (
      await page.request.post(`/api/workspace/opportunities/${opportunityId}/comments`, {
        data: { body: comment },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(201);
  const taskResponse = await page.request.post(
    `/api/workspace/opportunities/${opportunityId}/tasks`,
    {
      data: { title: `Задача для чтения ${suffix}` },
      headers: {
        "x-kiss-pm-action": "same-origin"
      }
    }
  );
  expect(taskResponse.status()).toBe(201);
  const taskPayload = await taskResponse.json();
  const taskId = taskPayload.activity.id;
  expect(
    (
      await page.request.post("/api/tenant/current/access-profiles", {
        data: {
          id: roleId,
          name: `Чтение активности ${suffix}`,
          permissions: [
            "profile.read",
            "tenant.opportunities.read",
            "tenant.clients.read",
            "tenant.contacts.read",
            "tenant.project_types.read",
            "tenant.deal_stages.read",
            "tenant.positions.read"
          ]
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(201);
  expect(
    (
      await page.request.post("/api/workspace/users", {
        data: {
          id: userId,
          email: userEmail,
          name: `Читатель активности ${suffix}`,
          accessProfileId: roleId,
          positionId: null,
          password: "readonly12345"
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(201);

  await logoutThroughUserMenu(page);
  await loginToWorkspace(page, {
    email: userEmail,
    password: "readonly12345"
  });
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const activityPanel = page.getByLabel("Рабочая лента сделки");
  await expect(activityPanel.getByText(comment)).toBeVisible();

  await activityPanel.getByRole("button", { name: "Чат" }).click();
  await expect(activityPanel.getByLabel("Сообщение")).toBeDisabled();
  await expect(activityPanel.getByRole("button", { name: "Отправить" })).toBeDisabled();
  await activityPanel.getByRole("button", { name: "Задачи" }).click();
  const taskRow = activityPanel.locator(".activity-row").filter({
    hasText: `Задача для чтения ${suffix}`
  });
  await expect(taskRow).toBeVisible();
  await expect(taskRow.getByRole("button", { name: "Выполнить" })).toBeDisabled();
  await expect(activityPanel.getByLabel("Новая задача")).toBeDisabled();
  await expect(activityPanel.getByRole("button", { name: "Создать задачу" })).toBeDisabled();
  await activityPanel.getByRole("button", { name: "Аудит" }).click();
  await expect(activityPanel.getByText("Исходный аудит доступен только пользователям")).toBeVisible();

  expect(
    (
      await page.request.post(`/api/workspace/opportunities/${opportunityId}/comments`, {
        data: { body: `Запрещенный комментарий ${suffix}` },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  expect(
    (
      await page.request.patch(
        `/api/workspace/opportunities/${opportunityId}/tasks/${taskId}`,
        {
          data: { status: "done" },
          headers: {
            "x-kiss-pm-action": "same-origin"
          }
        }
      )
    ).status()
  ).toBe(403);
  expect(
    (
      await page.request.post(`/api/workspace/opportunities/${opportunityId}/tasks`, {
        data: { title: `Запрещенная задача ${suffix}` },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  const activityResponse = await page.request.get(
    `/api/workspace/opportunities/${opportunityId}/activity`
  );
  expect(activityResponse.status()).toBe(200);
  const activityPayload = await activityResponse.json();
  expect(activityPayload).toMatchObject({
    canReadRawAudit: false,
    auditEvents: null
  });
});
