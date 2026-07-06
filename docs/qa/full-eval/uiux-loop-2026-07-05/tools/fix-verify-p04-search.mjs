// E2E: глобальный поиск в шапке — ввод «вектор», результаты, переход на проект (G2-01).
import { launch, USERS } from "./browser.mjs";
const BASE = "http://127.0.0.1:3010";
const { browser, context } = await launch();
await context.request.post(`${BASE}/api/auth/login`, { data: USERS.admin });
const page = await context.newPage();
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const input = page.locator('input[aria-label="Глобальный поиск"]');
await input.click();
await input.fill("вектор");
await page.waitForTimeout(1200);
const panel = await page.textContent("body");
const hasResults = panel.includes("Портал подрядчиков Вектор");
console.log(hasResults ? "PASS search-results" : "FAIL search-results");
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p04-search-results.png", fullPage: false });
// клик по проектному результату → переход на страницу проекта
await page.locator('button:has-text("Портал подрядчиков Вектор")').first().click();
await page.waitForTimeout(2500);
const url = page.url();
const navigated = /\/(projects|crm\/deals)\//.test(url);
console.log(navigated ? "PASS search-navigate " + url : "FAIL search-navigate " + url);
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p04-search-navigate.png", fullPage: false });
await browser.close();
if (!hasResults || !navigated) process.exit(1);
