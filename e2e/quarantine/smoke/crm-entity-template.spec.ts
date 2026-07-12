import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../../smoke/smokeHelpers";

test("CRM entity detail pages share workspace template and persisted inline editing", async ({
  page,
  request
}) => {
  const health = await request.get("/health");
  expect(health.status()).toBe(200);

  const suffix = Date.now().toString(36);
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });

  const clientsResponse = await page.request.get("/api/workspace/clients");
  expect(clientsResponse.status()).toBe(200);
  const clientsPayload = await clientsResponse.json();
  const client = clientsPayload.clients[0];
  expect(client?.id).toBeTruthy();

  await page.goto(`/clients/${client.id}`);
  await expect(page.getByRole("heading", { name: "О клиенте" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Редактировать поле Название клиента" }).first()
  ).toBeVisible();
  await expect(page.getByLabel("Активность: клиент")).toBeVisible();
  await page.getByRole("button", { name: "Редактировать поле Описание клиента" }).click();
  await page.getByLabel("Описание клиента").fill(`Описание клиента ${suffix}`);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText(`Описание клиента ${suffix}`)).toBeVisible();

  const contactsResponse = await page.request.get("/api/workspace/contacts");
  expect(contactsResponse.status()).toBe(200);
  const contactsPayload = await contactsResponse.json();
  const contact = contactsPayload.contacts[0];
  expect(contact?.id).toBeTruthy();

  await page.goto(`/contacts/${contact.id}`);
  await expect(page.getByRole("heading", { name: "О контакте" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Редактировать поле Имя контакта" }).first()
  ).toBeVisible();
  await expect(page.getByLabel("Активность: контакт")).toBeVisible();
  await page.getByRole("button", { name: "Редактировать поле Telegram контакта" }).click();
  await page.getByLabel("Telegram контакта").fill(`@crm_${suffix}`);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText(`@crm_${suffix}`)).toBeVisible();

  const productsResponse = await page.request.get("/api/workspace/products");
  expect(productsResponse.status()).toBe(200);
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products[0];
  expect(product?.id).toBeTruthy();

  await page.goto(`/products/${product.id}`);
  await expect(page.getByRole("heading", { name: "О позиции" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Редактировать поле Название позиции" }).first()
  ).toBeVisible();
  await expect(page.getByLabel("Активность: товар или услуга")).toBeVisible();
  await page.getByRole("button", { name: "Редактировать поле Артикул позиции" }).click();
  await page.getByLabel("Артикул позиции").fill(`SKU-${suffix}`);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText(`SKU-${suffix}`)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 900 });
  const widths = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
    rootScrollWidth: document.documentElement.scrollWidth
  }));
  expect(widths.rootScrollWidth).toBeLessThanOrEqual(widths.innerWidth);
  expect(widths.bodyScrollWidth).toBeLessThanOrEqual(widths.innerWidth);
});
