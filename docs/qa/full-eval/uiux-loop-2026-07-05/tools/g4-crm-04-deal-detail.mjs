// G4 CRM: детальная карточка uiux-eval-сделки — клик по канбан-карточке, сохранение дат/полей, feasibility, комментарий, потеря дат при сохранении.
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

// 0. Клик по канбан-карточке — открывается ли детальная?
await page.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });
await page.locator("[draggable=true]", { hasText: "uiux-eval-сделка-01" }).first().click();
await page.waitForTimeout(1500);
log("url after kanban card click:", page.url());
await shot(page, "g4-crm-kanban-card-click");

// 1. Детальная страница напрямую
await page.goto(BASE_URL + "/crm/deals/" + DEAL, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await shot(page, "g4-crm-eval-deal-detail");

// Проверка: даты в форме пустые?
const startVal = await page.locator("input[type=date]").nth(0).inputValue();
const finishVal = await page.locator("input[type=date]").nth(1).inputValue();
log("date inputs values:", JSON.stringify({ startVal, finishVal }), "(API: 2026-05-01 / 2026-08-01)");

// 2. Сохраняем форму БЕЗ изменений — сотрутся ли даты?
await page.getByRole("button", { name: /Сохранить/ }).first().click();
await page.waitForTimeout(2000);
await shot(page, "g4-crm-eval-deal-saved-untouched");
const after = await (await context.request.get(BASE_URL + "/api/workspace/opportunities")).json();
const deal = after.opportunities.find((o) => o.id === DEAL);
log("after untouched save: plannedStart =", deal.plannedStart, "plannedFinish =", deal.plannedFinish);

// 3. Меняем название и сумму, сохраняем — есть ли toast?
await page.locator("input").first().fill("uiux-eval-сделка-01-ред");
await page.locator("input[inputmode], input[type=number]").first().fill("777777").catch(() => log("no number input"));
await page.getByRole("button", { name: /Сохранить/ }).first().click();
await page.waitForTimeout(1500);
await shot(page, "g4-crm-eval-deal-saved-edited");
const bodyText = await page.locator("body").innerText();
log("has 'Сохранено' text:", /сохранен/i.test(bodyText));

// 4. Проверка осуществимости
await page.getByRole("button", { name: /Проверить/ }).first().click();
await page.waitForTimeout(2500);
await shot(page, "g4-crm-eval-deal-feasibility");

// 5. Комментарий в ленту
await page.getByPlaceholder(/комментарий/i).fill("uiux-eval-комментарий");
await page.getByRole("button", { name: /Отправить/ }).click();
await page.waitForTimeout(1500);
await shot(page, "g4-crm-eval-deal-comment");

// 6. Двойной сабмит комментария (быстрые 2 клика)
await page.getByPlaceholder(/комментарий/i).fill("uiux-eval-дубль");
const btn = page.getByRole("button", { name: /Отправить/ });
await Promise.all([btn.click(), btn.click().catch(() => {})]);
await page.waitForTimeout(1500);
await shot(page, "g4-crm-eval-deal-comment-double");
const dupCount = (await page.locator("body").innerText()).split("uiux-eval-дубль").length - 1;
log("дубль-комментариев на странице:", dupCount);

// 7. Кнопки Выиграна / Проиграна — есть ли подтверждение?
await page.getByRole("button", { name: /Проиграна/ }).click();
await page.waitForTimeout(1500);
await shot(page, "g4-crm-eval-deal-lost-click");
const after2 = await (await context.request.get(BASE_URL + "/api/workspace/opportunities")).json();
const deal2 = after2.opportunities.find((o) => o.id === DEAL);
log("status after Проиграна click (был ли confirm?):", deal2?.status);

writeFileSync(new URL("../evidence/g4-crm-console-deal-detail.json", import.meta.url), JSON.stringify(consoleLog, null, 2));
log("console entries:", consoleLog.length);
await browser.close();
