// G5: деградация звонка — сеть при join, чат звонка в degraded-режиме, кнопки управления.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const net = [];
page.on("response", async (r) => {
  const url = r.url();
  if (url.includes("/api/")) {
    let body = "";
    try { body = (await r.text()).slice(0, 300); } catch {}
    net.push({ status: r.status(), method: r.request().method(), url: url.replace(BASE_URL, ""), body });
  }
});
const report = { steps: [], net };
const log = (s, d) => { report.steps.push({ step: s, detail: d }); console.log(s, "|", d); };

const rooms = (await (await context.request.get(`${BASE_URL}/api/workspace/call-rooms?entityType=project&entityId=project-vektor-portal`)).json()).callRooms;
const roomId = rooms[0].roomId;
await page.goto(`${BASE_URL}/calls/${roomId}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Присоединиться" }).click();
await page.waitForTimeout(4000);

// чат звонка в degraded
const composer = page.getByPlaceholder("Написать сообщение…").first();
if (await composer.isVisible().catch(() => false)) {
  await composer.fill("uiux-eval-чат-при-ошибке");
  await page.getByRole("button", { name: "Отправить" }).click();
  await page.waitForTimeout(2000);
  await shot(page, "g5-comms-call-degraded-chat-send");
  const panel = await page.locator("aside").first().innerText().catch(() => "");
  log("degraded-chat-send", panel.slice(0, 300));
}
// кнопки Микрофон/Камера/Экран — реагируют?
for (const name of ["Микрофон", "Камера", "Экран", "Фон"]) {
  const b = page.getByRole("button", { name }).first();
  if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(400); }
}
await shot(page, "g5-comms-call-degraded-controls");
// Завершить — что происходит?
const endBtn = page.getByRole("button", { name: "Завершить" });
if (await endBtn.isVisible().catch(() => false)) {
  await endBtn.click();
  await page.waitForTimeout(2500);
  await shot(page, "g5-comms-call-degraded-end");
  log("end-call", `url after end: ${page.url()}`);
}

writeFileSync(`${EVIDENCE_DIR}/g5-comms-call-degraded-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(net.filter((n) => n.status >= 400 || n.url.includes("join") || n.url.includes("session")), null, 2));
await browser.close();
