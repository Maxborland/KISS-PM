// G6 Admin: создание пользователя (домен вне allow-list -> ожидание ошибки), затем валидный, edit, role-assign icon.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const ts = Date.now();
const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = [];
page.on("console", (m) => { if (m.type() === "error") report.push({ kind: "console", url: page.url(), text: m.text().slice(0, 300), loc: m.location() }); });
page.on("response", (r) => { if (r.status() >= 400) report.push({ kind: "http", status: r.status(), url: r.url(), method: r.request().method() }); });

const bodyText = () => page.evaluate(() => document.body.innerText);

await page.goto(BASE_URL + "/admin/users", { waitUntil: "networkidle" });

async function openCreate() {
  await page.getByRole("button", { name: /Создать пользователя/ }).click();
  await page.waitForTimeout(500);
}
async function fill(email, name, pass) {
  const dlg = page.locator("[role=dialog], .modal").last();
  const scope = (await dlg.count()) ? dlg : page;
  await scope.locator("input[type=email]").fill(email);
  await scope.locator("input[type=email]").press("Tab");
  await scope.locator("input:not([type=email]):not([type=password])").first().fill(name);
  await scope.locator("input[type=password]").fill(pass);
}

// 1. Домен вне allow-list (kiss-pm.local не в списке — там only-audit.example)
await openCreate();
await fill(`uiux-eval-g6-bad-${ts}@kiss-pm.local`, `uiux-eval-g6-bad-${ts}`, "password123");
await shot(page, "g6-admin-users-filled-bad-domain");
await page.getByRole("button", { name: /^\+?\s*Создать$/ }).last().click();
await page.waitForTimeout(1500);
await shot(page, "g6-admin-users-bad-domain-result");
report.push({ kind: "step", step: "bad-domain-submit", text: (await bodyText()).slice(0, 2500) });

// Если модалка ещё открыта — исправляем email на разрешённый домен, проверяем сохранился ли ввод
const dlgOpen = await page.locator("[role=dialog], .modal").count();
report.push({ kind: "info", modalStillOpen: dlgOpen });
if (dlgOpen) {
  await page.locator("input[type=email]").fill(`uiux-eval-g6-${ts}@only-audit.example`);
  const nameVal = await page.locator("input:not([type=email]):not([type=password])").first().inputValue();
  const passVal = await page.locator("input[type=password]").inputValue();
  report.push({ kind: "input-preserved", nameVal, passLen: passVal.length });
  if (!nameVal) await page.locator("input:not([type=email]):not([type=password])").first().fill(`uiux-eval-g6-${ts}`);
  if (!passVal) await page.locator("input[type=password]").fill("password123");
  await page.getByRole("button", { name: /^\+?\s*Создать$/ }).last().click();
  await page.waitForTimeout(1500);
} else {
  await openCreate();
  await fill(`uiux-eval-g6-${ts}@only-audit.example`, `uiux-eval-g6-${ts}`, "password123");
  await page.getByRole("button", { name: /^\+?\s*Создать$/ }).last().click();
  await page.waitForTimeout(1500);
}
await shot(page, "g6-admin-users-created");
report.push({ kind: "step", step: "created", text: (await bodyText()).slice(0, 4000) });

// 2. Найти строку нового пользователя, кликнуть карандаш (edit)
const row = page.locator("tr", { hasText: `uiux-eval-g6-${ts}` }).first();
const rowExists = await row.count();
report.push({ kind: "info", newUserRowFound: rowExists });
if (rowExists) {
  const btns = row.locator("button");
  const bc = await btns.count();
  report.push({
    kind: "info",
    rowButtons: bc,
    titles: await Promise.all(Array.from({ length: bc }, (_, i) => btns.nth(i).getAttribute("title").catch(() => null))),
    aria: await Promise.all(Array.from({ length: bc }, (_, i) => btns.nth(i).getAttribute("aria-label").catch(() => null)))
  });
}
writeFileSync(`${EVIDENCE_DIR}/g6-admin-user-crud.json`, JSON.stringify(report, null, 2));
console.log("done");
await browser.close();
