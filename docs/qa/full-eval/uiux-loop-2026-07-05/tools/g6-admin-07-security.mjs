// G6 Admin: /admin/security — состояние кнопки Сохранить, валидация тайм-аута, персистентность, домены.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = [];
page.on("console", (m) => { if (m.type() === "error" && !m.location()?.url?.includes("favicon")) report.push({ kind: "console", text: m.text().slice(0, 300) }); });
page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) report.push({ kind: "http", status: r.status(), url: r.url(), method: r.request().method() }); });
const bodyText = () => page.evaluate(() => document.body.innerText);
const saveBtn = () => page.getByRole("button", { name: /Сохранить/ });

await page.goto(BASE_URL + "/admin/security", { waitUntil: "networkidle" });

// 0. Исходное состояние
const timeoutInput = page.locator("input[type=number], input").filter({ hasNot: page.locator("[placeholder='company.com']") }).first();
const numInput = page.locator("input").nth(0); // уточним по факту
const allInputs = await page.locator("main input").all();
const inputsInfo = [];
for (const el of allInputs) inputsInfo.push({ type: await el.getAttribute("type"), value: await el.inputValue().catch(() => null), placeholder: await el.getAttribute("placeholder") });
report.push({ kind: "initial", inputsInfo, saveDisabled: await saveBtn().isDisabled(), text: (await bodyText()).slice(400, 1400) });

const num = page.locator("main input[type=number]").first();
const hasNum = await num.count();
report.push({ kind: "info", numberInputCount: hasNum });
const target = hasNum ? num : page.locator("main input").first();
const orig = await target.inputValue();

// 1. Невалидный тайм-аут 0
await target.fill("0");
await page.waitForTimeout(400);
report.push({ kind: "step", step: "timeout-0", saveDisabled: await saveBtn().isDisabled() });
if (!(await saveBtn().isDisabled())) {
  await saveBtn().click();
  await page.waitForTimeout(1200);
  await shot(page, "g6-admin-security-timeout0-save");
  report.push({ kind: "step", step: "timeout-0-saved", tail: (await bodyText()).slice(-900) });
}

// 2. 99999 (за пределом 8760)
await target.fill("99999");
await page.waitForTimeout(400);
if (!(await saveBtn().isDisabled())) {
  await saveBtn().click();
  await page.waitForTimeout(1200);
  await shot(page, "g6-admin-security-timeout99999-save");
  report.push({ kind: "step", step: "timeout-99999-saved", tail: (await bodyText()).slice(-900) });
}

// 3. Валидное значение 8, сохранить, перезагрузить, проверить персистентность
await target.fill("8");
await page.waitForTimeout(300);
await saveBtn().click();
await page.waitForTimeout(1500);
await shot(page, "g6-admin-security-timeout8-saved");
report.push({ kind: "step", step: "timeout-8-saved", tail: (await bodyText()).slice(-700) });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
const numAfter = page.locator("main input[type=number]").first();
const afterVal = await (hasNum ? numAfter : page.locator("main input").first()).inputValue();
report.push({ kind: "step", step: "after-reload", timeoutValue: afterVal, persisted: afterVal === "8" });

// 4. Невалидный домен
const domInput = page.locator("main input[placeholder='company.com']");
if (await domInput.count()) {
  await domInput.fill("это не домен!!");
  await page.getByRole("button", { name: /Добавить/ }).click();
  await page.waitForTimeout(700);
  await shot(page, "g6-admin-security-bad-domain");
  report.push({ kind: "step", step: "bad-domain-chip", tail: (await bodyText()).slice(-800) });
  // валидный домен uiux-eval
  await domInput.fill("uiux-eval.example");
  await page.getByRole("button", { name: /Добавить/ }).click();
  await page.waitForTimeout(500);
  report.push({ kind: "step", step: "good-domain-chip", tail: (await bodyText()).slice(-800) });
  // не сохраняем домены — уберём чипы
  const chips = page.locator("main [class*=chip], main span", { hasText: "uiux-eval.example" });
  // просто перезагрузим без сохранения
}

// 5. Вернуть тайм-аут как был
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
const tgt = page.locator(hasNum ? "main input[type=number]" : "main input").first();
await tgt.fill(orig);
await page.waitForTimeout(300);
await saveBtn().click();
await page.waitForTimeout(1200);
report.push({ kind: "step", step: "restored", value: await tgt.inputValue(), tail: (await bodyText()).slice(-400) });

writeFileSync(`${EVIDENCE_DIR}/g6-admin-security.json`, JSON.stringify(report, null, 2));
console.log("done");
await browser.close();
