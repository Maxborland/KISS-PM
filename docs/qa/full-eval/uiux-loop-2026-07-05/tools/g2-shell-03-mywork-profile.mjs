// G2: /my-work (список/канбан/выполнение), /profile (редактирование/тема), /settings (табы), root "/".
import { launch, login, shot, USERS } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = { console: [] };
page.on("console", (m) => { if (m.type() === "error") report.console.push({ url: page.url(), text: m.text().slice(0, 300) }); });

// 0. Root "/"
await page.goto("/", { waitUntil: "networkidle" });
await shot(page, "g2-shell-root-page");

// 1. /my-work: канбан — горизонтальный скролл?
await page.goto("/my-work", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
report.kanbanScroll = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll("main *")).filter((e) => e.scrollWidth > e.clientWidth + 10);
  return els.slice(0, 3).map((e) => ({ cls: (e.className || "").toString().slice(0, 80), overflowX: getComputedStyle(e).overflowX, scrollW: e.scrollWidth, clientW: e.clientW || e.clientWidth }));
});
// клик по карточке — открывается ли деталка?
await page.locator("text=Тестирование портала").first().click();
await page.waitForTimeout(1500);
report.kanbanCardClick = { url: page.url(), dialog: await page.locator("[role='dialog']").count() };
await shot(page, "g2-shell-mywork-card-click");

// 2. Список
await page.goto("/my-work", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Список" }).click().catch(async () => { await page.locator("text=Список").first().click(); });
await page.waitForTimeout(1200);
await shot(page, "g2-shell-mywork-list");
report.listControls = await page.evaluate(() => ({
  selects: Array.from(document.querySelectorAll("main select")).map((s) => Array.from(s.options).map((o) => o.text).join("|")),
  inputs: Array.from(document.querySelectorAll("main input")).map((i) => ({ type: i.type, placeholder: i.placeholder })),
  buttons: Array.from(document.querySelectorAll("main button")).map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 40)
}));

// отметить задачу выполненной из списка (если есть контрол)
const doneControl = page.locator("main").locator("input[type='checkbox'], button:has-text('Выполнено'), button:has-text('Завершить')").first();
report.doneControlCount = await page.locator("main").locator("input[type='checkbox'], button:has-text('Выполнено'), button:has-text('Завершить')").count();

// 3. /profile: редактирование имени + телефона, сохранение, reload
await page.goto("/profile", { waitUntil: "networkidle" });
const phone = page.getByPlaceholder("+7 999 000-00-00");
await phone.fill(`+7 999 ${String(Date.now()).slice(-3)}-44-55`);
await page.waitForTimeout(500);
await shot(page, "g2-shell-profile-dirty");
report.profileSaveHint = await page.locator("text=Нет изменений").count();
await page.getByRole("button", { name: "Сохранить" }).click();
await page.waitForTimeout(2000);
await shot(page, "g2-shell-profile-saved");
report.profileAfterSave = {
  toast: await page.locator("[class*='toast'], [role='status'], [role='alert']").allTextContents(),
};
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
report.profilePhoneAfterReload = await page.getByPlaceholder("+7 999 000-00-00").inputValue();
await shot(page, "g2-shell-profile-reload");

// 4. Тема: Тёмная + сохранить
await page.getByRole("button", { name: "Тёмная", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Сохранить" }).click();
await page.waitForTimeout(1500);
report.themeAfterSave = await page.evaluate(() => ({
  htmlClass: document.documentElement.className, dataTheme: document.documentElement.getAttribute("data-theme"),
  bg: getComputedStyle(document.body).backgroundColor
}));
await shot(page, "g2-shell-profile-theme-dark");
// применяется ли тема на других страницах?
await page.goto("/dashboard", { waitUntil: "networkidle" });
report.themeOnDashboard = await page.evaluate(() => ({ dataTheme: document.documentElement.getAttribute("data-theme"), bg: getComputedStyle(document.body).backgroundColor }));
await shot(page, "g2-shell-dashboard-after-dark");

// вернуть светлую
await page.goto("/profile", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Светлая", exact: true }).click();
await page.getByRole("button", { name: "Сохранить" }).click().catch(() => {});
await page.waitForTimeout(1000);

// cleanup: вернуть телефон в пустое значение
await page.goto("/profile", { waitUntil: "networkidle" });
await page.getByPlaceholder("+7 999 000-00-00").fill("");
await page.getByRole("button", { name: /Сохранить/ }).click().catch(() => {});
await page.waitForTimeout(1000);

// 5. /settings табы
await page.goto("/settings", { waitUntil: "networkidle" });
for (const tab of ["Уведомления", "Интеграции", "Оплата"]) {
  await page.getByRole("button", { name: tab }).click().catch(async () => { await page.locator(`text=${tab}`).first().click(); });
  await page.waitForTimeout(1200);
  await shot(page, `g2-shell-settings-${tab === "Уведомления" ? "notifications" : tab === "Интеграции" ? "integrations" : "billing"}`);
}

writeFileSync("docs/qa/full-eval/uiux-loop-2026-07-05/evidence/g2-shell-mywork-profile-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
