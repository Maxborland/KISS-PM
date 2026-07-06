// G4 CRM: продукт (-500, создание, архив), смена стадии из списка, кнопка "Воронка", пустые состояния Beta, вьюпорт 1280x800.
import { launch, login, shot, USERS, BASE_URL } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const consoleLog = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleLog.push({ url: page.url(), type: m.type(), text: m.text().slice(0, 300) }); });
page.on("dialog", (dg) => { console.log("NATIVE DIALOG:", dg.type(), "|", dg.message()); dg.accept(); });
const log = (...a) => console.log(...a);

// ===== ПРОДУКТ: -500 =====
await page.goto(BASE_URL + "/crm/products", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Продукт/ }).first().click();
await page.waitForTimeout(700);
const pdlg = page.getByRole("dialog");
const pin = pdlg.locator("input, textarea");
await pin.nth(0).fill("uiux-eval-продукт-01");
await pin.nth(2).fill("-500");
await page.waitForTimeout(400);
await shot(page, "g4-crm-product-negative-price");
const createBtn = pdlg.getByRole("button", { name: /Создать/ });
log("кнопка Создать при цене -500 disabled:", !(await createBtn.isEnabled()));
log("текст модалки при -500:", (await pdlg.innerText()).replace(/\n/g, " | ").slice(0, 500));
// нормальная цена
await pin.nth(2).fill("12345");
await pin.nth(1).fill("шт");
await createBtn.click();
await page.waitForTimeout(1500);
await shot(page, "g4-crm-product-created");
log("продукт появился:", (await page.getByText("uiux-eval-продукт-01").count()) > 0);
// клик по продукту — редактирование?
await page.getByText("uiux-eval-продукт-01").first().click();
await page.waitForTimeout(1000);
log("url после клика по продукту:", page.url(), "| модалка открылась:", await page.getByRole("dialog").isVisible().catch(() => false));
// архив продукта
const prow = page.locator("tr, [class*=row]", { hasText: "uiux-eval-продукт-01" }).last();
await prow.locator("button").last().click();
await page.waitForTimeout(1200);
await shot(page, "g4-crm-product-archived");

// ===== СПИСОК СДЕЛОК: смена стадии из селекта + кнопка Воронка =====
await page.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });
await page.getByText("Список", { exact: true }).first().click();
await page.waitForTimeout(1000);
// строка с uiux-eval-сделка-01 (Квалификация) — попробуем запрещённый переход в "Готова к оценке"
const evalRow = page.locator("tr, [class*=row]", { hasText: "uiux-eval-сделка-01" }).last();
const rowSel = evalRow.locator("select").first();
if (await rowSel.count()) {
  await rowSel.selectOption({ label: "Готова к оценке" }).catch((e) => log("select stage failed:", e.message));
  await page.waitForTimeout(1500);
  await shot(page, "g4-crm-list-stage-forbidden");
  const bt = await page.locator("body").innerText();
  log("низ страницы после запрещённой смены стадии из списка:", bt.split("\n").filter(Boolean).slice(-1)[0]);
  log("селект вернулся на:", await rowSel.inputValue());
}
// кнопка "Воронка"
await evalRow.getByText("Воронка").click().catch((e) => log("воронка click failed:", e.message));
await page.waitForTimeout(1000);
await shot(page, "g4-crm-list-pipeline-transfer");

// ===== BETA: пустые состояния =====
const { browser: b2, context: c2 } = await launch();
await login(c2, USERS.beta);
const p2 = await c2.newPage();
for (const [r, n] of [["/crm/deals", "g4-crm-beta-deals-empty"], ["/crm/clients", "g4-crm-beta-clients-empty"], ["/crm/products", "g4-crm-beta-products-empty"]]) {
  await p2.goto(BASE_URL + r, { waitUntil: "networkidle" });
  await p2.waitForTimeout(1000);
  await shot(p2, n);
}
await b2.close();

// ===== 1280x800 =====
const { browser: b3, context: c3 } = await launch({ viewport: { width: 1280, height: 800 } });
await login(c3, USERS.admin);
const p3 = await c3.newPage();
await p3.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });
await p3.waitForTimeout(1200);
await shot(p3, "g4-crm-deals-1280");
const hasHScroll = await p3.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
log("горизонтальный скролл body на 1280:", hasHScroll);
await b3.close();

writeFileSync(new URL("../evidence/g4-crm-console-product-misc.json", import.meta.url), JSON.stringify(consoleLog, null, 2));
log("console entries:", consoleLog.length);
await browser.close();
