// G4 CRM: создание сделки uiux-eval-, проверка появления без refresh, drag-n-drop канбана (разрешённый и запрещённый переход).
import { launch, login, shot, USERS, BASE_URL } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const consoleLog = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleLog.push({ url: page.url(), type: m.type(), text: m.text().slice(0, 400) }); });
page.on("pageerror", (e) => consoleLog.push({ url: page.url(), type: "pageerror", text: String(e).slice(0, 400) }));
const log = (...a) => console.log(...a);

await page.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });

// 1. Создание сделки
await page.getByRole("button", { name: /Сделка/ }).first().click();
await page.waitForTimeout(800);
const dialog = page.getByRole("dialog");
await dialog.getByPlaceholder(/Внедрение/).fill("uiux-eval-сделка-01");
// клиент
const selects = dialog.locator("select");
const nSelects = await selects.count();
log("selects in dialog:", nSelects);
await selects.nth(0).selectOption({ index: 1 }); // клиент
await page.waitForTimeout(600);
const contactOpts = await selects.nth(1).locator("option").allTextContents();
log("contact options:", contactOpts);
if (contactOpts.length > 1) await selects.nth(1).selectOption({ index: 1 });
const stageOpts = await selects.nth(2).locator("option").allTextContents();
log("stage options:", stageOpts);
await selects.nth(2).selectOption({ index: 1 });
await shot(page, "g4-crm-deal-create-filled2");
await dialog.getByRole("button", { name: /Создать/ }).click();
await page.waitForTimeout(2500);
await shot(page, "g4-crm-deal-created-board");
const created = await page.getByText("uiux-eval-сделка-01").count();
log("created deal visible on board without refresh:", created > 0);

// 2. Drag-n-drop: разрешённый переход Новая -> Квалификация
const card = page.locator("[draggable=true]", { hasText: "uiux-eval-сделка-01" }).first();
const cardExists = await card.count();
log("draggable card found:", cardExists);
// Найдём колонки
const colQual = page.getByText("Квалификация", { exact: true }).first();
if (cardExists) {
  const cb = await card.boundingBox();
  const qb = await colQual.boundingBox();
  if (cb && qb) {
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.mouse.down();
    await page.mouse.move(qb.x + 40, qb.y + 150, { steps: 15 });
    await page.waitForTimeout(300);
    await page.mouse.move(qb.x + 40, qb.y + 200, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(2000);
    await shot(page, "g4-crm-dnd-allowed");
  }
} else {
  // fallback: HTML5 dnd через dispatchEvent
  log("no draggable attr; dumping card html");
  const html = await page.locator("div", { hasText: "uiux-eval-сделка-01" }).last().evaluate((el) => el.outerHTML.slice(0, 800)).catch(() => "n/a");
  log(html);
}

// 3. Запрещённый переход: карточка из "Новая" сразу в "Готова к оценке" (условие feasibility)
const card2 = page.locator("[draggable=true]", { hasText: "Поддержка после внедрения" }).first();
if (await card2.count()) {
  const colReady = page.getByText("Готова к оценке", { exact: true }).first();
  const cb2 = await card2.boundingBox();
  const rb = await colReady.boundingBox();
  if (cb2 && rb) {
    await page.mouse.move(cb2.x + cb2.width / 2, cb2.y + cb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(rb.x + 40, rb.y + 150, { steps: 15 });
    await page.waitForTimeout(300);
    await page.mouse.move(rb.x + 40, rb.y + 250, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(2000);
    await shot(page, "g4-crm-dnd-forbidden");
  }
}

// 4. Клик по названию сделки в списке — открывается ли детальная?
await page.getByText("Список", { exact: true }).first().click();
await page.waitForTimeout(1000);
await page.getByText("uiux-eval-сделка-01").first().click();
await page.waitForTimeout(1500);
log("url after clicking deal title in list:", page.url());
await shot(page, "g4-crm-list-row-click");

writeFileSync(new URL("../evidence/g4-crm-console-create-dnd.json", import.meta.url), JSON.stringify(consoleLog, null, 2));
log("console entries:", consoleLog.length);
await browser.close();
