// G4 CRM: запрещённая смена стадии из списка на живой сделке + UI переноса в другую воронку.
import { launch, login, shot, USERS, BASE_URL } from "./browser.mjs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
page.on("dialog", (dg) => { console.log("NATIVE DIALOG:", dg.type(), "|", dg.message()); dg.dismiss(); });
const log = (...a) => console.log(...a);

await page.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });
await page.getByText("Список", { exact: true }).first().click();
await page.waitForTimeout(1000);

const row = page.locator("tr, [class*=row]", { hasText: "Поддержка после внедрения" }).last();
const sel = row.locator("select").first();
log("стадия до:", await sel.inputValue());
await sel.selectOption({ label: "Готова к оценке" });
await page.waitForTimeout(1800);
await shot(page, "g4-crm-list-stage-forbidden2");
const bt = await page.locator("body").innerText();
const lines = bt.split("\n").filter(Boolean);
log("низ страницы:", lines.slice(-1)[0]);
log("селект после отклонения:", await sel.inputValue());

// Кнопка Воронка на живой сделке
await row.getByRole("button", { name: /Воронка/ }).click();
await page.waitForTimeout(1000);
await shot(page, "g4-crm-list-pipeline-transfer");
const dlgVisible = await page.getByRole("dialog").isVisible().catch(() => false);
log("окно переноса воронки открылось:", dlgVisible);
if (dlgVisible) {
  log("текст окна:", (await page.getByRole("dialog").innerText()).replace(/\n/g, " | ").slice(0, 600));
  await page.keyboard.press("Escape");
}
await browser.close();
