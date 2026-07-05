// G3 Projects: полный CRUD задачи в одной сессии + вьюпорт 1280.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const net = [];
let phase = "init";
page.on("response", async (r) => {
  if (r.url().includes("/api/") && r.request().method() !== "GET") {
    let b = ""; try { b = (await r.text()).slice(0, 250); } catch {}
    net.push({ phase, m: r.request().method(), u: r.url().replace(BASE_URL, ""), s: r.status(), b });
  }
});
const out = [];
const note = (s) => { out.push(`[${phase}] ${s}`); console.log(`[${phase}] ${s}`); };

phase = "create";
await page.goto(BASE_URL + "/projects/project-vektor-portal/schedule", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /Задача/ }).first().click();
await page.waitForTimeout(1000);
await page.keyboard.type("uiux-eval-задача-2");
await page.keyboard.press("Enter");
await page.waitForTimeout(2000);
note("создана: " + (await page.getByText("uiux-eval-задача-2").count()));

phase = "edit";
const cell = page.getByText("uiux-eval-задача-2").first();
await cell.dblclick();
await page.waitForTimeout(800);
await shot(page, "g3-projects-task2-dblclick");
const inp = page.locator("input:focus");
if (await inp.count()) {
  await inp.fill("uiux-eval-задача-2-ред");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1800);
  note("переименована: " + (await page.getByText("uiux-eval-задача-2-ред").count()));
} else note("dblclick не открыл редактор");
await shot(page, "g3-projects-task2-edited");

phase = "context-menu";
await page.getByText(/uiux-eval-задача-2/).first().click({ button: "right" });
await page.waitForTimeout(900);
await shot(page, "g3-projects-task2-context-menu");
const menuItems = await page.locator("[role=menu] [role=menuitem], [role=menuitem]").allTextContents().catch(() => []);
note("пункты ПКМ: " + JSON.stringify(menuItems));
const del = page.getByText(/Удалить/).first();
if (await del.count()) {
  await del.click();
  await page.waitForTimeout(900);
  await shot(page, "g3-projects-task2-delete-step");
  const confirm = page.getByRole("button", { name: /Удалить|Да|Подтвердить/ }).first();
  if (await confirm.count()) { await confirm.click().catch(() => {}); await page.waitForTimeout(1500); note("было подтверждение"); }
  else note("удаление БЕЗ подтверждения");
  note("после удаления видна: " + (await page.getByText(/uiux-eval-задача-2/).count()));
  await shot(page, "g3-projects-task2-deleted");
} else { note("нет пункта Удалить в меню"); await page.keyboard.press("Escape"); }

phase = "undo";
// кнопка Откат в тулбаре
await page.getByRole("button", { name: /Откат/ }).first().click().catch(() => note("Откат не кликается"));
await page.waitForTimeout(1500);
await shot(page, "g3-projects-task2-undo");
note("после Отката задача видна: " + (await page.getByText(/uiux-eval-задача-2/).count()));

phase = "viewport-1280";
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(BASE_URL + "/projects/project-vektor-portal/schedule", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot(page, "g3-projects-schedule-1280");
await page.goto(BASE_URL + "/projects/project-vektor-portal/overview", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot(page, "g3-projects-overview-1280");

writeFileSync(`${EVIDENCE_DIR}/g3-projects-crud.json`, JSON.stringify({ notes: out, network: net }, null, 2));
console.log("net:", JSON.stringify(net, null, 1).slice(0, 2000));
await browser.close();
