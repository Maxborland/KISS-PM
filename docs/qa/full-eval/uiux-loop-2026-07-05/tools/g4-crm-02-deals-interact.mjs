// G4 CRM: интерактив на /crm/deals — вкладки Список/Прогноз, модалка создания, пустой сабмит, создание uiux-eval-сделки.
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

// 1. Вкладка "Список"
await page.getByRole("button", { name: "Список" }).click().catch(async () => {
  await page.getByText("Список", { exact: true }).click();
});
await page.waitForTimeout(1200);
await shot(page, "g4-crm-deals-view-list");
log("list view done");

// 2. Вкладка "Прогноз"
await page.getByText("Прогноз", { exact: true }).first().click();
await page.waitForTimeout(1200);
await shot(page, "g4-crm-deals-view-forecast");
log("forecast view done");

// 3. Назад в канбан, модалка "+ Сделка"
await page.getByText("Канбан", { exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Сделка/ }).first().click();
await page.waitForTimeout(1000);
await shot(page, "g4-crm-deal-create-modal");

// 4. Пустой сабмит в модалке
const submitBtn = page.getByRole("button", { name: /Создать|Сохранить|Добавить/ }).last();
const submitText = await submitBtn.textContent().catch(() => "not found");
log("submit button:", submitText);
await submitBtn.click({ timeout: 5000 }).catch((e) => log("empty submit click failed:", e.message));
await page.waitForTimeout(1200);
await shot(page, "g4-crm-deal-create-empty-submit");
log("after empty submit url:", page.url());

// Дамп текста модалки для анализа валидации
const modal = page.locator("[role=dialog], .modal, [class*=modal]").first();
const modalText = await modal.innerText().catch(() => "(модалка не найдена)");
writeFileSync(new URL("../evidence/g4-crm-deal-create-modal-text.txt", import.meta.url), modalText);

// 5. Заполнить и создать uiux-eval-сделку
const nameInput = modal.locator("input[type=text], input:not([type])").first();
await nameInput.fill("uiux-eval-сделка-01").catch((e) => log("fill name failed:", e.message));
await page.waitForTimeout(300);
await shot(page, "g4-crm-deal-create-filled");
await submitBtn.click().catch((e) => log("submit failed:", e.message));
await page.waitForTimeout(2000);
await shot(page, "g4-crm-deal-create-after-submit");
log("after create url:", page.url());

writeFileSync(new URL("../evidence/g4-crm-console-deals-interact.json", import.meta.url), JSON.stringify(consoleLog, null, 2));
log("console entries:", consoleLog.length, JSON.stringify(consoleLog.slice(0, 10), null, 1));
await browser.close();
