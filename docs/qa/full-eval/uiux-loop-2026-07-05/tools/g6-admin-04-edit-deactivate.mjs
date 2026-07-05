// G6 Admin: редактирование пользователя (смена роли), деактивация (подтверждение? обратимость?).
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = [];
page.on("console", (m) => { if (m.type() === "error") report.push({ kind: "console", text: m.text().slice(0, 300), loc: m.location()?.url }); });
page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) report.push({ kind: "http", status: r.status(), url: r.url(), method: r.request().method() }); });
page.on("dialog", async (d) => { report.push({ kind: "native-dialog", type: d.type(), message: d.message() }); await d.accept(); });

const bodyText = () => page.evaluate(() => document.body.innerText);

await page.goto(BASE_URL + "/admin/users", { waitUntil: "networkidle" });

const row = page.locator("tr", { hasText: "uiux-eval-g6-bad-" }).first();
if (!(await row.count())) { console.log("no eval user row"); process.exit(1); }

// 1. Изменить (карандаш)
await row.locator("button[title='Изменить']").click();
await page.waitForTimeout(700);
await shot(page, "g6-admin-users-edit-modal");
report.push({ kind: "step", step: "edit-open", text: (await bodyText()).slice(-2500) });
// поля в модалке
const dlg = page.locator("[role=dialog], .modal").last();
const scope = (await dlg.count()) ? dlg : page;
const fields = [];
for (const el of await scope.locator("input, select").all()) {
  fields.push({
    tag: await el.evaluate((e) => e.tagName),
    type: await el.getAttribute("type"),
    value: await el.inputValue().catch(() => null),
    disabled: await el.isDisabled()
  });
}
report.push({ kind: "edit-fields", fields });
// закрыть модалку
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
report.push({ kind: "info", modalAfterEsc: await page.locator("[role=dialog], .modal").count() });
if (await page.locator("[role=dialog], .modal").count()) {
  await page.getByRole("button", { name: /Отмена|Close/ }).last().click().catch(() => {});
  await page.waitForTimeout(400);
}

// 2. Деактивировать — есть ли подтверждение?
await row.locator("button[title='Деактивировать']").click();
await page.waitForTimeout(1200);
await shot(page, "g6-admin-users-deactivate-clicked");
const t = await bodyText();
report.push({ kind: "step", step: "deactivate-clicked", confirmDialogText: t.includes("уверен") || t.includes("подтвер") || t.includes("Деактивировать пользователя"), tail: t.slice(-1500) });

// если модалка подтверждения есть — подтвердить
const confirmBtn = page.getByRole("button", { name: /Деактивировать|Подтвердить|Да/ }).last();
if (await page.locator("[role=dialog], .modal").count()) {
  await confirmBtn.click().catch(() => {});
  await page.waitForTimeout(1000);
}
await shot(page, "g6-admin-users-deactivated");
const t2 = await bodyText();
const m = t2.match(/uiux-eval-g6-bad[^\n]*\n?[^\n]*\n?[^\n]*/);
report.push({ kind: "step", step: "after-deactivate", rowArea: m?.[0], tail: t2.slice(-800) });

// 3. Обратимость: есть ли кнопка активировать?
const row2 = page.locator("tr", { hasText: "uiux-eval-g6-bad-" }).first();
if (await row2.count()) {
  const btns = row2.locator("button");
  const bc = await btns.count();
  report.push({
    kind: "info",
    afterDeactivateButtons: await Promise.all(Array.from({ length: bc }, (_, i) => btns.nth(i).getAttribute("title").catch(() => null)))
  });
  // реактивировать обратно, чтобы вернуть как было? Нет — это наш uiux-eval, оставим деактивированным? Лучше проверить реактивацию (обратимость CRUD).
  const actBtn = row2.locator("button[title*='ктивировать']").first();
  if (await actBtn.count()) {
    await actBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, "g6-admin-users-reactivated");
    const t3 = await bodyText();
    report.push({ kind: "step", step: "reactivate", tail: t3.slice(-800) });
  }
}

writeFileSync(`${EVIDENCE_DIR}/g6-admin-edit-deactivate.json`, JSON.stringify(report, null, 2));
console.log("done");
await browser.close();
