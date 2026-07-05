// G6 Admin: /admin/users — создание пользователя (пустой сабмит, валидный), редактирование, иконки действий.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = [];
page.on("console", (m) => { if (m.type() === "error") report.push({ kind: "console", url: page.url(), text: m.text().slice(0, 300) }); });
page.on("requestfailed", (r) => report.push({ kind: "requestfailed", url: r.url(), err: r.failure()?.errorText }));
page.on("response", (r) => { if (r.status() >= 400) report.push({ kind: "http", status: r.status(), url: r.url() }); });

await page.goto(BASE_URL + "/admin/users", { waitUntil: "networkidle" });

// 1. Открыть модалку создания
await page.getByRole("button", { name: /Создать пользователя/ }).click();
await page.waitForTimeout(800);
await shot(page, "g6-admin-users-create-modal");
report.push({ kind: "modal", step: "create-open", text: (await page.evaluate(() => document.body.innerText)).slice(0, 3000) });

// 2. Пустой сабмит
const submitBtn = page.getByRole("button", { name: /Создать|Сохранить|Добавить/ }).last();
await submitBtn.click().catch((e) => report.push({ kind: "err", step: "empty-submit", e: String(e) }));
await page.waitForTimeout(800);
await shot(page, "g6-admin-users-create-empty-submit");
report.push({ kind: "modal", step: "empty-submit", text: (await page.evaluate(() => document.body.innerText)).slice(0, 3000) });

// 3. Заполнить и создать (домен only-audit.example — вне allowed-домена возьмём kiss-pm.local чтобы проверить политику)
const inputs = page.locator(".modal input, [role=dialog] input, form input");
const n = await inputs.count();
report.push({ kind: "info", inputsCount: n });
const dump = [];
for (let i = 0; i < n; i++) {
  const el = inputs.nth(i);
  dump.push({ i, name: await el.getAttribute("name"), placeholder: await el.getAttribute("placeholder"), type: await el.getAttribute("type") });
}
// select-ы
const selects = page.locator(".modal select, [role=dialog] select, form select");
const ns = await selects.count();
for (let i = 0; i < ns; i++) {
  const el = selects.nth(i);
  dump.push({ select: i, name: await el.getAttribute("name"), options: await el.locator("option").allInnerTexts() });
}
report.push({ kind: "form-fields", dump });
writeFileSync(`${EVIDENCE_DIR}/g6-admin-users-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(dump, null, 2));
await browser.close();
