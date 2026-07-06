// G4 CRM (продолжение): правка названия -> сохранение -> проверка потери дат; feasibility; комментарий; двойной сабмит; Проиграна без подтверждения.
import { launch, login, shot, USERS, BASE_URL } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const DEAL = "opportunity-9c71f48a-fa3b-4c45-9392-6bb856e04703";
const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const consoleLog = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleLog.push({ url: page.url(), type: m.type(), text: m.text().slice(0, 400) }); });
page.on("pageerror", (e) => consoleLog.push({ url: page.url(), type: "pageerror", text: String(e).slice(0, 400) }));
const log = (...a) => console.log(...a);

await page.goto(BASE_URL + "/crm/deals/" + DEAL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Есть ли ссылки на карточку из канбана? Проверим DOM карточки на /crm/deals
// (отдельно ниже). Сначала: правим название и сохраняем.
const nameInput = page.locator("input:not([disabled])").first();
await nameInput.fill("uiux-eval-сделка-01-ред");
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Сохранить/ }).first().click();
await page.waitForTimeout(2000);
await shot(page, "g4-crm-eval-deal-saved-edited");
let d = (await (await context.request.get(BASE_URL + "/api/workspace/opportunities")).json()).opportunities.find((o) => o.id === DEAL);
log("after title edit+save: plannedStart =", d.plannedStart, "plannedFinish =", d.plannedFinish, "title =", d.title);
const bodyText = await page.locator("body").innerText();
log("feedback text present:", /сохранен|обновлен|успешн/i.test(bodyText));

// Feasibility
await page.getByRole("button", { name: /Проверить/ }).first().click();
await page.waitForTimeout(2500);
await shot(page, "g4-crm-eval-deal-feasibility");

// Комментарий
await page.getByPlaceholder(/комментарий/i).fill("uiux-eval-комментарий");
await page.getByRole("button", { name: /Отправить/ }).click();
await page.waitForTimeout(1500);
await shot(page, "g4-crm-eval-deal-comment");

// Двойной сабмит
await page.getByPlaceholder(/комментарий/i).fill("uiux-eval-дубль");
const btn = page.getByRole("button", { name: /Отправить/ });
await Promise.all([btn.click({ timeout: 3000 }).catch(() => {}), btn.click({ timeout: 3000 }).catch(() => {})]);
await page.waitForTimeout(1800);
await shot(page, "g4-crm-eval-deal-comment-double");
const dupCount = (await page.locator("body").innerText()).split("uiux-eval-дубль").length - 1;
log("дубль-комментариев в ленте:", dupCount);

// Проиграна — подтверждение?
page.on("dialog", (dg) => { log("native dialog:", dg.type(), dg.message()); dg.dismiss(); });
await page.getByRole("button", { name: /Проиграна/ }).click();
await page.waitForTimeout(1800);
await shot(page, "g4-crm-eval-deal-lost-click");
d = (await (await context.request.get(BASE_URL + "/api/workspace/opportunities")).json()).opportunities.find((o) => o.id === DEAL);
log("status after Проиграна click:", d?.status);

// Канбан: анатомия карточки — есть ли ссылка на деталку?
await page.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });
const cardHtml = await page.locator("[draggable=true]").first().evaluate((el) => el.outerHTML.slice(0, 1500));
writeFileSync(new URL("../evidence/g4-crm-kanban-card-html.txt", import.meta.url), cardHtml);
log("card has <a>:", cardHtml.includes("<a "));
// listrow anatomy
await page.getByText("Список", { exact: true }).first().click();
await page.waitForTimeout(1000);
const rowHtml = await page.locator("table tr, [class*=row]").nth(1).evaluate((el) => el.outerHTML.slice(0, 1500)).catch(() => "n/a");
writeFileSync(new URL("../evidence/g4-crm-list-row-html.txt", import.meta.url), rowHtml);
log("list row has <a>:", rowHtml.includes("<a "));

writeFileSync(new URL("../evidence/g4-crm-console-deal-detail.json", import.meta.url), JSON.stringify(consoleLog, null, 2));
log("console entries:", consoleLog.length);
await browser.close();
