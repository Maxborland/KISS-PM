// E2E: правка ТОЛЬКО названия сделки сохраняется без 400 «Неверные даты» (G4-01).
import { launch, USERS } from "./browser.mjs";
const BASE = "http://127.0.0.1:3010";
const { browser, context } = await launch();
await context.request.post(`${BASE}/api/auth/login`, { data: USERS.admin });
const opps = await (await context.request.get(`${BASE}/api/workspace/opportunities`)).json();
const opp = opps.opportunities.find((o) => o.status === "open" || !o.status) ?? opps.opportunities[0];
const page = await context.newPage();
await page.goto(`${BASE}/crm/deals/${opp.id}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const title = page.locator('label:has-text("Название") input').first();
const stamp = ` uiux-eval-${Math.floor(Math.random() * 1e5)}`;
await title.fill((await title.inputValue()).replace(/ uiux-eval-\d+/g, "") + stamp);
const [resp] = await Promise.all([
  page.waitForResponse((r) => r.url().includes("/opportunities/") && r.request().method() === "PATCH", { timeout: 15000 }),
  page.locator('button:has-text("Сохранить")').first().click()
]);
console.log("PATCH status:", resp.status());
await page.waitForTimeout(1200);
const bodyText = await page.textContent("body");
console.log(bodyText.includes("Сделка сохранена") ? "PASS save-ok" : "FAIL save: " + (bodyText.match(/Отклонено[^<]{0,80}/)?.[0] ?? "no notice"));
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p02-deal-save.png", fullPage: true });
await browser.close();
if (resp.status() !== 200 || !bodyText.includes("Сделка сохранена")) process.exit(1);
