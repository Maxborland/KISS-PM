import { expect, test } from "@playwright/test";

import {
  deactivateStaleSmokeOpportunityFields,
  getRequiredOpportunityCustomFieldValues,
  loginToWorkspace,
  logoutThroughUserMenu
} from "./smokeHelpers";

test("deal detail shows persisted feed and tasks in one CRM activity rail", async ({
  page
}) => {
  const suffix = Date.now().toString(36);
  const opportunityId = `activity-e2e-${suffix}`;
  const title = `Активность сделки ${suffix}`;
  const comment = `Комментарий по сделке ${suffix}`;
  const taskTitle = `Контрольная задача ${suffix}`;

  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
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
  const metricGrid = page.getByLabel("Ключевые показатели сделки");
  await expect(metricGrid.getByText("Экономика проекта")).toBeVisible();
  await expect(metricGrid.getByText("Плановые часы")).toBeVisible();
  await expect(page.getByRole("region", { name: "Обзор сделки" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Компания" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Контакт" })).toBeVisible();
  const activityPanel = page.getByLabel("Активность: сделка");
  await expect(activityPanel.getByRole("heading", { name: "Активность", exact: true })).toBeVisible();
  await expect(
    activityPanel.getByRole("tablist", { name: "Разделы активности: сделка" })
  ).toBeVisible();
  await expect(activityPanel.getByRole("tab", { name: /Лента/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(activityPanel.getByRole("tab", { name: /Файлы/ })).toBeVisible();
  await expect(activityPanel.getByLabel("Написать сообщение или добавить активность")).toBeVisible();

  await page.getByRole("button", { name: "Проверить ресурсы" }).click();
  await expect(
    activityPanel.getByText("Ресурсная проверка сделки выполнена")
  ).toBeVisible();

  await activityPanel.getByLabel("Написать сообщение или добавить активность").fill(comment);
  await activityPanel.getByRole("button", { name: "Отправить сообщение" }).click();
  await expect(activityPanel.getByText(comment)).toBeVisible();
  await expect(activityPanel.getByText("Сегодня")).toBeVisible();
  await expect(activityPanel.getByRole("tab", { name: /Лента/ })).toBeVisible();

  await activityPanel.getByRole("tab", { name: /Задачи/ }).click();
  await activityPanel.getByLabel("Новая задача").fill(taskTitle);
  await activityPanel.getByLabel("Описание").fill("Подготовить следующий контакт");
  await activityPanel.getByLabel("Срок").fill("2031-03-10");
  await activityPanel
    .getByLabel("Ответственный")
    .selectOption({ label: "Анна Администратор" });
  await activityPanel.getByRole("button", { name: "Создать задачу" }).click();
  await expect(activityPanel.getByText(taskTitle)).toBeVisible();
  await expect(activityPanel.getByRole("tab", { name: /Задачи 1 элемент/ })).toBeVisible();

  await activityPanel.getByRole("tab", { name: /Задачи/ }).click();
  const taskRow = activityPanel.locator(".activity-row").filter({ hasText: taskTitle });
  await expect(taskRow).toBeVisible();
  await expect(activityPanel.getByRole("tab", { name: /Задачи 1 элемент/ })).toBeVisible();
  await taskRow.getByRole("button", { name: "Выполнить" }).click();
  await expect(taskRow.getByText("Выполнена")).toBeVisible();

  await activityPanel.getByRole("tab", { name: /Лента/ }).click();
  await expect(activityPanel.getByText(comment)).toBeVisible();
  await expect(activityPanel.getByText(taskTitle)).toBeVisible();
  await expect(activityPanel.getByText("crm_activity.opportunity.comment.created")).toBeVisible();
  await expect(
    activityPanel.getByText("Ресурсная проверка сделки выполнена")
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByLabel("Активность: сделка").getByText(comment)).toBeVisible();
  await expect(page.getByLabel("Активность: сделка").getByText(taskTitle)).toBeVisible();

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
  await loginToWorkspace(page, { password: "admin12345" });
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
      await page.request.post(`/api/workspace/crm/opportunity/${opportunityId}/comments`, {
        data: { body: comment },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(201);
  const taskResponse = await page.request.post(
    `/api/workspace/crm/opportunity/${opportunityId}/tasks`,
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
  const activityPanel = page.getByLabel("Активность: сделка");
  await expect(activityPanel.getByText(comment)).toBeVisible();
  await expect(
    activityPanel.getByText("Только чтение: нужно право tenant.opportunities.manage.")
  ).toBeVisible();

  await expect(activityPanel.getByLabel("Написать сообщение или добавить активность")).toBeDisabled();
  await expect(activityPanel.getByRole("button", { name: "Отправить сообщение" })).toBeDisabled();
  await expect(
    activityPanel.getByText("Только чтение: нужно право tenant.opportunities.manage.")
  ).toBeVisible();
  await activityPanel.getByRole("tab", { name: /Задачи/ }).click();
  const taskRow = activityPanel.locator(".activity-row").filter({
    hasText: `Задача для чтения ${suffix}`
  });
  await expect(taskRow).toBeVisible();
  await expect(taskRow.getByRole("button", { name: "Выполнить" })).toBeDisabled();
  await expect(activityPanel.getByLabel("Новая задача")).toBeDisabled();
  await expect(activityPanel.getByRole("button", { name: "Создать задачу" })).toBeDisabled();

  expect(
    (
      await page.request.post(`/api/workspace/crm/opportunity/${opportunityId}/comments`, {
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
        `/api/workspace/crm/opportunity/${opportunityId}/tasks/${taskId}`,
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
      await page.request.post(`/api/workspace/crm/opportunity/${opportunityId}/tasks`, {
        data: { title: `Запрещенная задача ${suffix}` },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  const activityResponse = await page.request.get(
    `/api/workspace/crm/opportunity/${opportunityId}/activity`
  );
  expect(activityResponse.status()).toBe(200);
  const activityPayload = await activityResponse.json();
  expect(activityPayload).toMatchObject({
    canReadRawAudit: false,
    auditEvents: null
  });
});

test("client, contact and product detail pages use persisted CRM activity", async ({
  page
}) => {
  const suffix = Date.now().toString(36);
  const clientComment = `Комментарий клиента ${suffix}`;
  const contactTask = `Задача контакта ${suffix}`;
  const productFile = `Файл услуги ${suffix}`;

  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });

  expect(
    (
      await page.request.post("/api/workspace/crm/client/client-romashka/comments", {
        data: { body: clientComment },
        headers: { "x-kiss-pm-action": "same-origin" }
      })
    ).status()
  ).toBe(201);
  expect(
    (
      await page.request.post("/api/workspace/crm/contact/contact-irina/tasks", {
        data: { title: contactTask, body: "Уточнить вводные по проекту" },
        headers: { "x-kiss-pm-action": "same-origin" }
      })
    ).status()
  ).toBe(201);
  expect(
    (
      await page.request.post(
        "/api/workspace/crm/product/product-kiss-pm-implementation/files",
        {
          data: {
            title: productFile,
            fileUrl: "https://example.test/kiss-pm-service.pdf",
            fileSizeBytes: 4096,
            mimeType: "application/pdf"
          },
          headers: { "x-kiss-pm-action": "same-origin" }
        }
      )
    ).status()
  ).toBe(201);

  await page.goto("/clients/client-romashka");
  await expect(page.getByRole("region", { name: "Клиент" })).toContainText("ООО Ромашка");
  await expect(page.getByLabel("Активность: клиент").getByText(clientComment)).toBeVisible();

  await page.goto("/contacts/contact-irina");
  await expect(page.getByRole("region", { name: "Контакт" })).toContainText("Ирина Клиент");
  const contactActivity = page.getByLabel("Активность: контакт");
  await contactActivity.getByRole("tab", { name: /Задачи/ }).click();
  await expect(contactActivity.getByText(contactTask)).toBeVisible();

  await page.goto("/products/product-kiss-pm-implementation");
  await expect(page.getByRole("region", { name: "Товар или услуга" })).toContainText("Внедрение KISS PM");
  const productActivity = page.getByLabel("Активность: товар");
  await productActivity.getByRole("tab", { name: /Файлы/ }).click();
  const productFileRow = productActivity.getByRole("article").filter({ hasText: productFile });
  await expect(productFileRow).toBeVisible();
  await expect(productFileRow.getByRole("link", { name: "Открыть" })).toBeVisible();
});
