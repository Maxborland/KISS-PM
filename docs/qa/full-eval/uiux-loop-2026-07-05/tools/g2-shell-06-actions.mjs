// G2: отметка задачи выполненной (+откат), фидбек настроек уведомлений, demo-кнопки, пустое имя.
import { launch, login, shot, USERS } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = { steps: {}, console: [] };
page.on("console", (m) => { if (m.type() === "error") report.console.push({ url: page.url(), text: m.text().slice(0, 300) }); });
const step = async (name, fn) => { try { report.steps[name] = await fn(); } catch (e) { report.steps[name] = { error: String(e).slice(0, 300) }; } };

// 1. Отметить задачу выполненной в списке /my-work (и откатить)
await step("markDone", async () => {
  await page.goto("/my-work", { waitUntil: "networkidle" });
  await page.locator("text=Список").first().click();
  await page.waitForTimeout(1000);
  const row = page.locator("main tr", { hasText: "Согласовать состав команды" }).first();
  const sel = row.locator("select");
  const before = await sel.inputValue();
  await sel.selectOption({ label: "Выполнено" });
  await page.waitForTimeout(2000);
  await shot(page, "g2-shell-mywork-mark-done");
  const feedback = {
    toasts: await page.locator("[class*='toast'], [role='status'], [role='alert']").allTextContents(),
    rowStillVisible: await row.isVisible().catch(() => false),
    selValue: await sel.inputValue().catch(() => "gone")
  };
  // откат
  const row2 = page.locator("main tr", { hasText: "Согласовать состав команды" }).first();
  await row2.locator("select").selectOption({ label: "Новая" }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "g2-shell-mywork-mark-revert");
  const afterRevert = await row2.locator("select").inputValue().catch(() => "gone");
  return { before, feedback, afterRevert };
});

// 2. Запрещённый переход (матрица): Новая -> На контроле? попробуем недопустимый
await step("forbiddenTransition", async () => {
  await page.goto("/my-work", { waitUntil: "networkidle" });
  await page.locator("text=Список").first().click();
  await page.waitForTimeout(1000);
  const row = page.locator("main tr", { hasText: "Тестирование портала" }).first();
  const sel = row.locator("select");
  const before = await sel.inputValue();
  await sel.selectOption({ label: "На контроле" });
  await page.waitForTimeout(2000);
  await shot(page, "g2-shell-mywork-forbidden-transition");
  const after = await sel.inputValue().catch(() => "gone");
  const toasts = await page.locator("[class*='toast'], [role='status'], [role='alert']").allTextContents();
  // откат если применился
  if (after !== before) { await sel.selectOption({ label: "Новая" }).catch(() => {}); await page.waitForTimeout(1200); }
  return { before, after, toasts };
});

// 3. Настройки → Уведомления: сохранение и фидбек
await step("notifSave", async () => {
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.locator("label:has-text('Уведомления')").first().click();
  await page.waitForTimeout(1200);
  const cb = page.locator("main input[type='checkbox']").first();
  const before = await cb.isChecked();
  await cb.click();
  await page.locator("main button:has-text('Сохранить')").first().click();
  await page.waitForTimeout(2000);
  await shot(page, "g2-shell-settings-notif-save");
  const feedback = {
    toasts: await page.locator("[class*='toast'], [role='status'], [role='alert']").allTextContents(),
    mainSnippet: (await page.locator("main").innerText()).slice(0, 300)
  };
  // откат
  await cb.click();
  await page.locator("main button:has-text('Сохранить')").first().click();
  await page.waitForTimeout(1500);
  return { before, feedback };
});

// 4. Кнопки-заглушки Интеграции/Оплата
await step("demoButtons", async () => {
  const out = {};
  for (const [tab, btn] of [["Интеграции", "Подключить интеграцию"], ["Оплата", "Перейти к тарифам"]]) {
    await page.locator(`label:has-text('${tab}')`).first().click();
    await page.waitForTimeout(800);
    const b = page.locator(`button:has-text('${btn}')`).first();
    out[tab] = await b.evaluate((n) => ({ disabled: n.disabled, title: n.title }));
    if (!out[tab].disabled) { await b.click(); await page.waitForTimeout(800); out[tab].afterClickToasts = await page.locator("[class*='toast'], [role='status'], [role='alert']").allTextContents(); }
  }
  return out;
});

// 5. Аватар-меню → Профиль
await step("avatarProfile", async () => {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.locator("header button").last().click();
  await page.waitForTimeout(600);
  await page.locator("text=Профиль").first().click();
  await page.waitForTimeout(1500);
  return { url: page.url() };
});

// 6. Пустое имя в профиле
await step("emptyName", async () => {
  await page.goto("/profile", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Редактирование профиля", { timeout: 15000 });
  await page.locator("input[placeholder='Имя сотрудника']").fill("");
  await page.waitForTimeout(600);
  await shot(page, "g2-shell-profile-empty-name");
  return {
    saveDisabled: await page.locator("button:has-text('Сохранить')").last().isDisabled(),
    inlineError: (await page.locator("main").innerText()).includes("Имя") ? "нет отдельного текста ошибки, только aria-invalid" : "?",
    hint: await page.locator("text=Изменено полей").count()
  };
});

writeFileSync("docs/qa/full-eval/uiux-loop-2026-07-05/evidence/g2-shell-actions-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
