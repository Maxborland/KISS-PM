// G4 CRM: прогноз с закрытыми сделками, тупик создания сделки у Beta (нет воронки), источник 404.
import { launch, login, shot, USERS, BASE_URL } from "./browser.mjs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const log = (...a) => console.log(...a);
page.on("response", (r) => { if (r.status() >= 400) log("HTTP", r.status(), r.url()); });

await page.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });
await page.getByText("Прогноз", { exact: true }).first().click();
await page.waitForTimeout(1200);
await shot(page, "g4-crm-forecast-after-closed");

// Канбан: есть ли внутренний скролл на 1280?
const { browser: b3, context: c3 } = await launch({ viewport: { width: 1280, height: 800 } });
await login(c3, USERS.admin);
const p3 = await c3.newPage();
await p3.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });
const boardScroll = await p3.evaluate(() => {
  const els = [...document.querySelectorAll("div")];
  return els.some((el) => el.scrollWidth > el.clientWidth + 10 && /auto|scroll/.test(getComputedStyle(el).overflowX));
});
log("канбан имеет внутренний h-scroll на 1280:", boardScroll);
await b3.close();

// Beta: модалка создания сделки без воронки/клиентов
const { browser: b2, context: c2 } = await launch();
await login(c2, USERS.beta);
const p2 = await c2.newPage();
await p2.goto(BASE_URL + "/crm/deals", { waitUntil: "networkidle" });
await p2.getByRole("button", { name: /Сделка/ }).first().click();
await p2.waitForTimeout(800);
await shot(p2, "g4-crm-beta-deal-create-modal");
const dlg = p2.getByRole("dialog");
const sels = dlg.locator("select");
for (let i = 0; i < (await sels.count()); i++) {
  log("beta select", i, "options:", await sels.nth(i).locator("option").allTextContents());
}
const btn = dlg.getByRole("button", { name: /Создать/ });
log("beta Создать enabled:", await btn.isEnabled().catch(() => "n/a"));
await b2.close();
await browser.close();
