// G4 CRM: сделка-02 — ввод дат вручную + сохранение (успех/фидбек), конвертация в проект, повторная активация.
import { launch, login, shot, USERS, BASE_URL } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const consoleLog = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleLog.push({ url: page.url(), type: m.type(), text: m.text().slice(0, 300) }); });
const log = (...a) => console.log(...a);

// Создаём сделку-02 через UI
await page.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Сделка/ }).first().click();
await page.waitForTimeout(700);
const dialog = page.getByRole("dialog");
await dialog.getByPlaceholder(/Внедрение/).fill("uiux-eval-сделка-02");
const selects = dialog.locator("select");
await selects.nth(0).selectOption({ index: 1 });
await page.waitForTimeout(500);
await selects.nth(1).selectOption({ index: 1 });
await selects.nth(2).selectOption({ index: 1 });
await dialog.getByRole("button", { name: /Создать/ }).click();
await page.waitForTimeout(2000);
const opps = (await (await context.request.get(BASE_URL + "/api/workspace/opportunities")).json()).opportunities;
const deal = opps.find((o) => o.title === "uiux-eval-сделка-02");
log("deal2 id:", deal?.id);

await page.goto(BASE_URL + "/crm/deals/" + deal.id, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Вводим даты руками и сохраняем
await page.locator("input[type=date]").nth(0).fill("2026-08-01");
await page.locator("input[type=date]").nth(1).fill("2026-09-30");
await page.getByRole("button", { name: /Сохранить/ }).first().click();
await page.waitForTimeout(2000);
await shot(page, "g4-crm-deal2-save-with-dates");
const bt = await page.locator("body").innerText();
log("после сохранения с датами, низ страницы:", bt.split("\n").slice(-3).join(" | "));

// Feasibility
await page.getByRole("button", { name: /Проверить/ }).first().click();
await page.waitForTimeout(2500);

// Активировать в проект (с обоснованием риска, если требуется)
const risk = page.getByPlaceholder(/Почему запускаем/);
if (await risk.count()) await risk.fill("uiux-eval: тест активации при конфликте");
await shot(page, "g4-crm-deal2-before-activate");
await page.getByRole("button", { name: /Активировать в проект/ }).click();
await page.waitForTimeout(3000);
await shot(page, "g4-crm-deal2-after-activate");
log("url после активации:", page.url());
const bt2 = await page.locator("body").innerText();
log("низ страницы после активации:", bt2.split("\n").filter(Boolean).slice(-3).join(" | "));

// Проверяем состояние сделки и наличие проекта
const opps2 = (await (await context.request.get(BASE_URL + "/api/workspace/opportunities")).json()).opportunities;
const deal2 = opps2.find((o) => o.id === deal.id);
log("deal2 status:", deal2?.status);

// Повторная активация — доступна ли кнопка?
const actBtn = page.getByRole("button", { name: /Активировать в проект/ });
const btnCount = await actBtn.count();
const btnEnabled = btnCount ? await actBtn.first().isEnabled() : false;
log("кнопка активации после конвертации: count =", btnCount, "enabled =", btnEnabled);
if (btnCount && btnEnabled) {
  await actBtn.first().click();
  await page.waitForTimeout(2500);
  await shot(page, "g4-crm-deal2-double-activate");
  const bt3 = await page.locator("body").innerText();
  log("низ после повторной активации:", bt3.split("\n").filter(Boolean).slice(-2).join(" | "));
  const projCount = (bt3.match(/project-/g) || []).length;
  log("упоминаний project- на странице:", projCount);
}

writeFileSync(new URL("../evidence/g4-crm-console-activate.json", import.meta.url), JSON.stringify(consoleLog, null, 2));
log("console entries:", consoleLog.length);
await browser.close();
