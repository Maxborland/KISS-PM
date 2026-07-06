// G2: разрешённый переход В работе→Выполнено (+откат), сохранение настроек уведомлений.
import { launch, login, shot, USERS } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = { steps: {}, console: [] };
page.on("console", (m) => { if (m.type() === "error") report.console.push({ url: page.url(), text: m.text().slice(0, 200) }); });
const step = async (name, fn) => { try { report.steps[name] = await fn(); } catch (e) { report.steps[name] = { error: String(e).slice(0, 300) }; } };

await step("markDoneAllowed", async () => {
  await page.goto("/my-work", { waitUntil: "networkidle" });
  await page.locator("text=Список").first().click();
  await page.waitForTimeout(1000);
  const row = page.locator("main tr", { hasText: "Подготовить ресурсную оценку" }).first();
  const sel = row.locator("select");
  const before = await sel.inputValue();
  await sel.selectOption({ label: "Выполнено" });
  await page.waitForTimeout(2000);
  await shot(page, "g2-shell-mywork-done-allowed");
  const after = await sel.inputValue().catch(() => "gone");
  const bottomMsg = (await page.locator("main").innerText()).split("\n").slice(-3);
  // откат
  await sel.selectOption({ label: "В работе" }).catch(() => {});
  await page.waitForTimeout(1500);
  const reverted = await sel.inputValue().catch(() => "gone");
  return { before, after, bottomMsg, reverted };
});

await step("notifControls", async () => {
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.locator("label:has-text('Уведомления')").first().click();
  await page.waitForTimeout(1500);
  const counts = await page.evaluate(() => ({
    switches: document.querySelectorAll("main [role='switch']").length,
    checkboxes: document.querySelectorAll("main input[type='checkbox']").length,
    selects: document.querySelectorAll("main select").length,
    buttons: Array.from(document.querySelectorAll("main button")).map((b) => ({ text: (b.textContent || "").trim(), role: b.getAttribute("role"), ariaChecked: b.getAttribute("aria-checked"), disabled: b.disabled })).slice(0, 10)
  }));
  return counts;
});

await step("notifSave", async () => {
  const sw = page.locator("main [role='switch'], main button[aria-checked]").first();
  const before = await sw.getAttribute("aria-checked");
  await sw.click();
  await page.waitForTimeout(500);
  await page.locator("main button:has-text('Сохранить')").first().click();
  await page.waitForTimeout(2000);
  await shot(page, "g2-shell-settings-notif-save");
  const text = (await page.locator("main").innerText()).slice(0, 250);
  // откат
  await sw.click();
  await page.locator("main button:has-text('Сохранить')").first().click();
  await page.waitForTimeout(1500);
  const after = await sw.getAttribute("aria-checked");
  return { before, textAfterSave: text, revertedTo: after };
});

writeFileSync("docs/qa/full-eval/uiux-loop-2026-07-05/evidence/g2-shell-done-notif-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
