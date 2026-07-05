// G1 Auth — шаг 2: интерактивные сценарии входа (неверный пароль, дизейбл-кнопка,
// успешный вход, двойной сабмит, deep-link, /login под сессией + логаут).
import { launch, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const out = {};

async function freshPage(context, key) {
  const page = await context.newPage();
  out[key] = out[key] ?? {};
  out[key].console = [];
  page.on("console", (m) => {
    if (m.type() === "error") out[key].console.push(m.text().slice(0, 400));
  });
  page.on("pageerror", (e) => out[key].console.push("pageerror: " + String(e).slice(0, 400)));
  return page;
}

// ---------- 1. Неверный пароль: текст ошибки + сохранение ввода ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "wrongPassword");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "uiux-eval-nobody@example.com");
  await page.fill('input[name="password"]', "definitely-wrong-1");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  out.wrongPassword.errorText = await page.evaluate(() => {
    const el = document.querySelector('[role="alert"], [data-slot="form-error"]');
    return el ? el.textContent : document.body.innerText.slice(0, 1500);
  });
  out.wrongPassword.emailPreserved = await page.inputValue('input[name="email"]');
  out.wrongPassword.passwordPreserved = (await page.inputValue('input[name="password"]')).length;
  await shot(page, "g1-auth-login-wrong-password");
  await browser.close();
}

// ---------- 2. Невалидный email → состояние кнопки, объяснение ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "invalidEmail");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "not-an-email");
  await page.fill('input[name="password"]', "whatever123");
  const btn = page.locator('button[type="submit"]');
  out.invalidEmail.buttonDisabled = await btn.isDisabled();
  // Есть ли хоть какое-то объяснение, почему кнопка неактивна?
  out.invalidEmail.bodyText = await page.evaluate(() => document.body.innerText);
  await shot(page, "g1-auth-login-invalid-email");
  await browser.close();
}

// ---------- 3. Успешный вход через UI + куда ведёт ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "successLogin");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', USERS.admin.email);
  await page.fill('input[name="password"]', USERS.admin.password);
  const t0 = Date.now();
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 }).catch(() => {});
  out.successLogin.finalUrl = page.url();
  out.successLogin.ms = Date.now() - t0;
  await page.waitForTimeout(2000);
  await shot(page, "g1-auth-login-success-landing");
  await browser.close();
}

// ---------- 4. Двойной клик по «Войти» → сколько POST /login ушло ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "doubleSubmit");
  let loginPosts = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/auth/login") && r.method() === "POST") loginPosts += 1;
  });
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', USERS.admin.email);
  await page.fill('input[name="password"]', USERS.admin.password);
  const btn = page.locator('button[type="submit"]');
  await btn.click();
  await btn.click({ force: true, timeout: 2000 }).catch(() => {});
  await btn.click({ force: true, timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(4000);
  out.doubleSubmit.loginPosts = loginPosts;
  await browser.close();
}

// ---------- 5. Deep-link: анонимом на защищённый маршрут → login → возврат? ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "deepLink");
  await page.goto(`${BASE_URL}/projects/project-vektor-portal`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1000);
  out.deepLink.afterGateUrl = page.url();
  // логинимся через форму, смотрим куда попали
  if (page.url().includes("/login")) {
    await page.fill('input[name="email"]', USERS.admin.email);
    await page.fill('input[name="password"]', USERS.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    out.deepLink.afterLoginUrl = page.url();
    await shot(page, "g1-auth-deeplink-after-login");
  }
  await browser.close();
}

// ---------- 6. /login под активной сессией: AuthedCard + логаут + повторный вход ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "authedLoginPage");
  // логин через UI
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', USERS.admin.email);
  await page.fill('input[name="password"]', USERS.admin.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  // снова на /login под сессией — что видим до редиректа? (редирект сработает, ловим скрин быстро)
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  out.authedLoginPage.snapshotUrl = page.url();
  out.authedLoginPage.bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500)).catch(() => "");
  await shot(page, "g1-auth-login-under-session");
  await browser.close();
}

writeFileSync(`${EVIDENCE_DIR}/g1-auth-login-flows.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
