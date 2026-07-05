// G8: plan-reader пытается создать канал — оформлен ли отказ (toast/inline или silent fail).
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const out = { network: [], notes: [] };
const { browser, context } = await launch();
await login(context, USERS.planReader);
const page = await context.newPage();
page.on("response", async (r) => {
  if (r.url().includes("/api/") && (r.request().method() !== "GET" || r.status() >= 400)) {
    let b = ""; try { b = (await r.text()).slice(0, 200); } catch {}
    out.network.push({ m: r.request().method(), u: r.url().replace(BASE_URL, ""), s: r.status(), b });
  }
});
await page.goto(BASE_URL + "/communications/channels", { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(1500);
const btn = page.getByRole("button", { name: /Канал/ }).first();
out.notes.push("кнопка +Канал видна: " + await btn.count() + ", disabled: " + await btn.isDisabled().catch(() => "?"));
await btn.click().catch(e => out.notes.push("click err: " + e.message.slice(0, 100)));
await page.waitForTimeout(1000);
await shot(page, "g8-roles-planReader-channel-create-modal");
const modalText = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, "\n").trim());
out.notes.push("после клика текст (хвост): " + modalText.slice(-500));
// если открылась форма — заполнить и сабмитнуть
const nameInput = page.locator('[role="dialog"] input, form input').first();
if (await nameInput.count()) {
  await nameInput.fill("uiux-eval-g8-канал").catch(() => {});
  const submit = page.getByRole("button", { name: /Создать|Сохранить/ }).first();
  if (await submit.count()) {
    await submit.click().catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, "g8-roles-planReader-channel-create-after");
    out.notes.push("после сабмита: " + (await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, "\n").trim())).slice(-600));
  } else out.notes.push("кнопка сабмита не найдена");
} else out.notes.push("инпут формы не найден");
await browser.close();
writeFileSync(`${EVIDENCE_DIR}/g8-roles-channel-create.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
