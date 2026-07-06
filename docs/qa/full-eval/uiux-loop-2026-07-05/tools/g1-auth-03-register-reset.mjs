// G1 Auth — шаг 3: регистрация (слабый пароль, занятый email, кривой email, успех,
// двойной сабмит) + сброс пароля (запрос, невалидный email, невалидный токен, слабый пароль).
import { launch, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const out = {};
const failed404 = new Set();

async function freshPage(context, key) {
  const page = await context.newPage();
  out[key] = out[key] ?? {};
  out[key].console = [];
  page.on("console", (m) => {
    if (m.type() === "error") out[key].console.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => out[key].console.push("pageerror: " + String(e).slice(0, 300)));
  page.on("response", (r) => {
    if (r.status() === 404) failed404.add(r.url());
  });
  return page;
}

const errorText = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[role="alert"]');
    return el ? el.textContent.trim() : null;
  });

const stamp = Date.now();

// ---------- 1. Регистрация: слабый пароль ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "regWeakPassword");
  await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
  await page.fill('input[autocomplete="name"]', "uiux-eval Тестов");
  await page.fill('input[type="email"]', `uiux-eval-weak-${stamp}@example.com`);
  await page.fill('input[autocomplete="new-password"]', "short12");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  out.regWeakPassword.errorText = await errorText(page);
  out.regWeakPassword.nameKept = await page.inputValue('input[autocomplete="name"]');
  out.regWeakPassword.emailKept = await page.inputValue('input[type="email"]');
  await shot(page, "g1-auth-register-weak-password");
  await browser.close();
}

// ---------- 2. Регистрация: занятый email ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "regEmailTaken");
  await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
  await page.fill('input[autocomplete="name"]', "uiux-eval Дубль");
  await page.fill('input[type="email"]', USERS.admin.email);
  await page.fill('input[autocomplete="new-password"]', "password-12345");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  out.regEmailTaken.errorText = await errorText(page);
  await shot(page, "g1-auth-register-email-taken");
  await browser.close();
}

// ---------- 3. Регистрация: кривой email (клиент не валидирует формат) ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "regBadEmail");
  await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
  await page.fill('input[autocomplete="name"]', "uiux-eval Кривой");
  await page.fill('input[type="email"]', "uiux-eval-bad-email");
  await page.fill('input[autocomplete="new-password"]', "password-12345");
  const btnEnabled = await page.locator('button[type="submit"]').isEnabled();
  out.regBadEmail.buttonEnabledWithBadEmail = btnEnabled;
  await page.click('button[type="submit"]').catch(() => {});
  await page.waitForTimeout(2000);
  out.regBadEmail.errorText = await errorText(page);
  out.regBadEmail.nativeValidation = await page.evaluate(() => {
    const el = document.querySelector('input[type="email"]');
    return el ? el.validationMessage : null;
  });
  await shot(page, "g1-auth-register-bad-email");
  await browser.close();
}

// ---------- 4. Регистрация: успех + двойной сабмит ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "regSuccess");
  let regPosts = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/auth/register") && r.method() === "POST") regPosts += 1;
  });
  await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
  await page.fill('input[autocomplete="name"]', "uiux-eval Успех");
  await page.fill('input[type="email"]', `uiux-eval-ok-${stamp}@example.com`);
  await page.fill('input[autocomplete="new-password"]', "uiux-eval-pass-1");
  const btn = page.locator('button[type="submit"]');
  await btn.click();
  await btn.click({ force: true, timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(1200);
  out.regSuccess.midText = await page.evaluate(() => document.body.innerText.slice(0, 900));
  await shot(page, "g1-auth-register-success-screen");
  await page.waitForTimeout(4000);
  out.regSuccess.finalUrl = page.url();
  out.regSuccess.regPosts = regPosts;
  out.regSuccess.email = `uiux-eval-ok-${stamp}@example.com`;
  await shot(page, "g1-auth-register-after-redirect");
  await browser.close();
}

// ---------- 5. Сброс: запрос для зарегистрированного uiux-eval email ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "resetRequest");
  await page.goto(`${BASE_URL}/password-reset`, { waitUntil: "networkidle" });
  out.resetRequest.prefilledEmail = await page.inputValue("#reset-email");
  await page.fill("#reset-email", `uiux-eval-ok-${stamp}@example.com`);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  out.resetRequest.bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1600));
  out.resetRequest.hasDevToken = await page.evaluate(() => document.body.innerText.includes("токен ниже"));
  await shot(page, "g1-auth-reset-request-sent");
  await browser.close();
}

// ---------- 6. Сброс: кривой email ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "resetBadEmail");
  await page.goto(`${BASE_URL}/password-reset`, { waitUntil: "networkidle" });
  await page.fill("#reset-email", "uiux-eval-bad");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  out.resetBadEmail.errorText = await errorText(page);
  out.resetBadEmail.nativeValidation = await page.evaluate(
    () => document.querySelector("#reset-email")?.validationMessage ?? null
  );
  await shot(page, "g1-auth-reset-bad-email");
  await browser.close();
}

// ---------- 7. Confirm: невалидный 64-hex токен ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "confirmBadToken");
  await page.goto(`${BASE_URL}/password-reset/confirm`, { waitUntil: "networkidle" });
  await page.fill("#reset-token", "a".repeat(64));
  await page.fill("#reset-password", "uiux-eval-pass-2");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  out.confirmBadToken.errorText = await errorText(page);
  out.confirmBadToken.tokenKept = (await page.inputValue("#reset-token")).length;
  await shot(page, "g1-auth-reset-confirm-bad-token");
  await browser.close();
}

// ---------- 8. Confirm: слабый пароль (короткий токен тоже) ----------
{
  const { browser, context } = await launch();
  const page = await freshPage(context, "confirmWeakPassword");
  await page.goto(`${BASE_URL}/password-reset/confirm`, { waitUntil: "networkidle" });
  await page.fill("#reset-token", "b".repeat(64));
  await page.fill("#reset-password", "short");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  out.confirmWeakPassword.errorText = await errorText(page);
  await shot(page, "g1-auth-reset-confirm-weak-password");
  await browser.close();
}

out.responses404 = [...failed404];
writeFileSync(`${EVIDENCE_DIR}/g1-auth-register-reset.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
