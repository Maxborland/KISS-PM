import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

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
      customFieldValues: {}
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
});
