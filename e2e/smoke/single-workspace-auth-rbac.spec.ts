import { expect, test } from "@playwright/test";

import { loginToWorkspace, logoutThroughUserMenu } from "./smokeHelpers";

test("single-workspace auth and RBAC scaffold works from the browser", async ({ page, request }) => {
  const health = await request.get("/health");
  expect(health.status()).toBe(200);

  const suffix = Date.now().toString(36);
  const limitedRoleId = `limited-core-role-${suffix}`;
  const limitedUserId = `limited-core-user-${suffix}`;
  const limitedEmail = `limited-core-${suffix}@kiss-pm.local`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();
  await loginToWorkspace(page, { password: "admin12345" });

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
  const sidebar = page.getByRole("complementary");
  await expect(sidebar.getByRole("link", { name: "Мои задачи" })).toHaveAttribute("href", "/my-work");
  await expect(sidebar.getByRole("link", { name: "Проекты" })).toHaveAttribute("href", "/projects");
  await expect(sidebar.getByRole("link", { name: "Сделки" })).toHaveAttribute("href", "/crm/deals");
  await expect(sidebar.getByRole("link", { name: "Дашборд" })).toHaveAttribute("href", "/dashboard");
  await expect(sidebar.getByRole("link", { name: "Коммуникации" })).toHaveAttribute("href", "/communications/chat");
  await expect(sidebar.getByRole("link", { name: "Администрирование" })).toHaveAttribute("href", "/admin");

  for (const route of ["/crm/deals", "/crm/clients", "/crm/contacts", "/crm/products"] as const) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByRole("heading", { name: "Продажи и клиенты" })).toBeVisible();
  }

  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: "Администрирование" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Пользователи" })).toHaveAttribute("href", "/admin/users");
  await expect(page.getByRole("button", { name: "Создать пользователя" })).toBeVisible();

  expect(
    (
      await page.request.post("/api/tenant/current/access-profiles", {
        data: {
          id: limitedRoleId,
          name: `Core limited ${suffix}`,
          permissions: ["profile.read"]
        },
        headers: { "x-kiss-pm-action": "same-origin" }
      })
    ).status()
  ).toBe(201);
  expect(
    (
      await page.request.post("/api/workspace/users", {
        data: {
          id: limitedUserId,
          email: limitedEmail,
          name: `Core limited ${suffix}`,
          accessProfileId: limitedRoleId,
          positionId: null,
          password: "limited12345"
        },
        headers: { "x-kiss-pm-action": "same-origin" }
      })
    ).status()
  ).toBe(201);

  await logoutThroughUserMenu(page);
  await loginToWorkspace(page, { email: limitedEmail, password: "limited12345" });
  await expect(page.getByRole("banner").getByRole("button").last()).toBeVisible();
  await expect(page.getByRole("complementary").getByRole("link", { name: "Администрирование" })).toHaveCount(0);
  await expect(page.getByRole("complementary").getByRole("link", { name: "Сделки" })).toHaveCount(0);

  await page.goto("/crm/deals");
  await expect(
    page.getByText(/Доступ к сделкам ограничен|Дашборд/).first()
  ).toBeVisible();
  await page.goto("/admin/users");
  await expect(
    page.getByText(/Доступ ограничен|Дашборд/).first()
  ).toBeVisible();

  expect((await page.request.get("/api/workspace/opportunities")).status()).toBe(403);
  expect((await page.request.get("/api/workspace/clients")).status()).toBe(403);
  expect((await page.request.get("/api/workspace/contacts")).status()).toBe(403);
  expect((await page.request.get("/api/workspace/products")).status()).toBe(403);
  expect((await page.request.get("/api/tenant/current/audit-events")).status()).toBe(403);
});