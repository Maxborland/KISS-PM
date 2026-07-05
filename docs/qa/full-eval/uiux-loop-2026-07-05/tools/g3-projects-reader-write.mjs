// G3 Projects: plan-reader пробует писать (создание задачи, перенос дедлайна) — фейковые контролы?
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.planReader);
const page = await context.newPage();
const net = [];
let phase = "init";
page.on("response", async (r) => {
  if (r.url().includes("/api/") && r.request().method() !== "GET") {
    let b = ""; try { b = (await r.text()).slice(0, 200); } catch {}
    net.push({ phase, m: r.request().method(), u: r.url().replace(BASE_URL, ""), s: r.status(), b });
  }
});
const out = [];
const note = (s) => { out.push(`[${phase}] ${s}`); console.log(`[${phase}] ${s}`); };

phase = "reader-task-create";
await page.goto(BASE_URL + "/projects/project-vektor-portal/schedule", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const btn = page.getByRole("button", { name: /Задача/ }).first();
note("+Задача disabled=" + (await btn.isDisabled().catch(() => "?")));
await btn.click().catch(() => note("не кликается"));
await page.waitForTimeout(3000);
if (await page.locator("input:focus").count()) {
  await page.keyboard.type("uiux-eval-reader-задача");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
}
await shot(page, "g3-projects-reader-task-create");
note("создана: " + (await page.getByText("uiux-eval-reader-задача").count()));

phase = "reader-deadline";
await page.goto(BASE_URL + "/projects/project-vektor-portal/settings", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const ed = page.getByRole("button", { name: /Изменить/ }).first();
note("Изменить disabled=" + (await ed.isDisabled().catch(() => "?")));
await ed.click().catch(() => {});
await page.waitForTimeout(800);
const date = page.locator("input[type=date]");
if (await date.count()) {
  await date.fill("2026-07-15");
  await page.locator("input[type=text]:visible").last().fill("uiux-eval проверка прав").catch(() => {});
  await page.getByRole("button", { name: /Применить перенос/ }).click().catch(() => note("Применить не кликается"));
  await page.waitForTimeout(1500);
}
await shot(page, "g3-projects-reader-deadline");

writeFileSync(`${EVIDENCE_DIR}/g3-projects-reader-write.json`, JSON.stringify({ notes: out, network: net }, null, 2));
console.log(JSON.stringify(net, null, 1));
await browser.close();
