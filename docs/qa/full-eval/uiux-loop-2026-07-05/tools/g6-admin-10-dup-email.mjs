// G6 Admin: создание пользователя с существующим email — ошибка? где показана? ввод сохранён?
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = [];
page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) report.push({ kind: "http", status: r.status(), url: r.url(), method: r.request().method() }); });
const bodyText = () => page.evaluate(() => document.body.innerText);

await page.goto(BASE_URL + "/admin/users", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Создать пользователя/ }).click();
await page.waitForTimeout(600);
const dlg = page.locator("[role=dialog], .modal").last();
const scope = (await dlg.count()) ? dlg : page;
await scope.locator("input[type=email]").fill("admin@kiss-pm.local");
await scope.locator("input:not([type=email]):not([type=password])").first().fill("uiux-eval-g6-dup");
await scope.locator("input[type=password]").fill("password123");
await page.getByRole("button", { name: /^\+?\s*Создать$/ }).last().click();
await page.waitForTimeout(1500);
await shot(page, "g6-admin-users-dup-email");
const modalOpen = await page.locator("[role=dialog], .modal").count();
const emailVal = modalOpen ? await page.locator("input[type=email]").inputValue() : null;
report.push({ kind: "dup-email", modalOpen, emailVal, text: (await bodyText()).slice(-1200) });
writeFileSync(`${EVIDENCE_DIR}/g6-admin-dup-email.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1).slice(0, 1600));
await browser.close();
