// G1 Auth — шаг 4: цикл логаут→повторный вход через UI + пустые сабмиты reset-форм.
import { launch, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const out = {};

// ---------- 1. Логин → логаут через меню аватара → повторный вход ----------
{
  const { browser, context } = await launch();
  const page = await context.newPage();
  out.logoutCycle = { console: [] };
  page.on("console", (m) => { if (m.type() === "error") out.logoutCycle.console.push(m.text().slice(0, 300)); });
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', USERS.admin.email);
  await page.fill('input[name="password"]', USERS.admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  // ищем меню аватара (кнопка с инициалами) и пункт «Выйти»
  const avatarBtn = page.locator("header button, aside button").filter({ hasText: /^[А-ЯA-Z]{1,2}[А-ЯA-Z]?$/ }).last();
  let loggedOutVia = null;
  try {
    await avatarBtn.click({ timeout: 4000 });
    await page.waitForTimeout(600);
    await shot(page, "g1-auth-avatar-menu-open");
    const exitItem = page.getByText(/Выйти|Выход/).first();
    await exitItem.click({ timeout: 4000 });
    loggedOutVia = "avatar-menu";
  } catch {
    // fallback: логаут API-запросом
    await context.request.post(`${BASE_URL}/api/auth/logout`);
    await page.goto(`${BASE_URL}/dashboard`);
    loggedOutVia = "api-fallback";
  }
  await page.waitForTimeout(2500);
  out.logoutCycle.afterLogoutUrl = page.url();
  out.logoutCycle.loggedOutVia = loggedOutVia;
  await shot(page, "g1-auth-after-logout");
  // повторный вход
  if (!page.url().includes("/login")) await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', USERS.admin.email);
  await page.fill('input[name="password"]', USERS.admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 }).catch(() => {});
  out.logoutCycle.reloginUrl = page.url();
  await browser.close();
}

// ---------- 2. Пустой сабмит /password-reset ----------
{
  const { browser, context } = await launch();
  const page = await context.newPage();
  out.resetEmptySubmit = { console: [] };
  page.on("console", (m) => { if (m.type() === "error") out.resetEmptySubmit.console.push(m.text().slice(0, 300)); });
  await page.goto(`${BASE_URL}/password-reset`, { waitUntil: "networkidle" });
  await page.fill("#reset-email", "");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  out.resetEmptySubmit.errorText = await page.evaluate(() => document.querySelector('[role="alert"]')?.textContent?.trim() ?? null);
  out.resetEmptySubmit.nativeMsg = await page.evaluate(() => document.querySelector("#reset-email")?.validationMessage ?? null);
  await shot(page, "g1-auth-reset-empty-submit");
  await browser.close();
}

// ---------- 3. Пустой сабмит /password-reset/confirm ----------
{
  const { browser, context } = await launch();
  const page = await context.newPage();
  out.confirmEmptySubmit = { console: [] };
  page.on("console", (m) => { if (m.type() === "error") out.confirmEmptySubmit.console.push(m.text().slice(0, 300)); });
  await page.goto(`${BASE_URL}/password-reset/confirm`, { waitUntil: "networkidle" });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  out.confirmEmptySubmit.errorText = await page.evaluate(() => document.querySelector('[role="alert"]')?.textContent?.trim() ?? null);
  out.confirmEmptySubmit.nativeMsg = await page.evaluate(() => document.querySelector("#reset-token")?.validationMessage ?? null);
  await shot(page, "g1-auth-reset-confirm-empty-submit");
  await browser.close();
}

writeFileSync(`${EVIDENCE_DIR}/g1-auth-logout-empty.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
