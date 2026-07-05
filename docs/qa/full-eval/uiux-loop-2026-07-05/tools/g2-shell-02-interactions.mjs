// G2: интерактив shell — поиск, аватар, серые пункты нав, 404-кнопка, сеть.
import { launch, login, shot, USERS } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = { network404: [], console: [] };
page.on("response", (r) => { if (r.status() >= 400) report.network404.push({ url: r.url(), status: r.status() }); });
page.on("console", (m) => { if (m.type() === "error") report.console.push({ url: page.url(), text: m.text().slice(0, 300) }); });

// 1. Глобальный поиск — input disabled (заглушка), фиксируем состояние
await page.goto("/dashboard", { waitUntil: "networkidle" });
report.searchState = await page.getByPlaceholder("Найти задачу или ресурс").evaluate((n) => ({
  disabled: n.disabled, title: n.title
}));

// 2. Меню аватара
await page.goto("/dashboard", { waitUntil: "networkidle" });
await page.locator("header button").last().click();
await page.waitForTimeout(1000);
await shot(page, "g2-shell-avatar-menu");
report.avatarMenu = await page.evaluate(() => {
  const menu = document.querySelector("[role='menu'], [class*='menu'], [class*='popover'], [class*='dropdown']");
  return menu ? menu.innerText.slice(0, 500) : null;
});

// 3. Серые пункты «Ресурсы» и «KPI»
for (const label of ["Ресурсы", "KPI"]) {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const el = page.locator("aside, nav").locator(`text="${label}"`).first();
  const info = await el.evaluate((n) => ({
    tag: n.tagName, href: n.closest("a")?.getAttribute("href") ?? null,
    title: n.getAttribute("title") || n.closest("[title]")?.getAttribute("title") || null,
    cursor: getComputedStyle(n).cursor
  })).catch((e) => ({ error: String(e) }));
  await el.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1200);
  report[`grayNav_${label}`] = { ...info, urlAfterClick: page.url() };
  await shot(page, `g2-shell-graynav-${label === "KPI" ? "kpi" : "resources"}`);
}

// 4. 404: кнопка «На главную»
await page.goto("/definitely-not-a-page-uiux-eval", { waitUntil: "networkidle" });
await page.getByText("На главную").click();
await page.waitForTimeout(1500);
report.notFoundHomeButton = { url: page.url() };

// 5. Виджеты дашборда — кликабельность задач и сделок
await page.goto("/dashboard", { waitUntil: "networkidle" });
report.dashboardTaskClick = {};
const taskRow = page.locator("text=Проверить результат импорта Gantt").first();
const rowInfo = await taskRow.evaluate((n) => ({
  insideLink: !!n.closest("a"), href: n.closest("a")?.getAttribute("href") ?? null, cursor: getComputedStyle(n.closest("div")).cursor
})).catch((e) => ({ error: String(e) }));
await taskRow.click().catch(() => {});
await page.waitForTimeout(1500);
report.dashboardTaskClick = { ...rowInfo, urlAfterClick: page.url() };
await shot(page, "g2-shell-dashboard-task-click");

// KPI-плитки
await page.goto("/dashboard", { waitUntil: "networkidle" });
const tile = page.locator("text=ОТКРЫТЫЕ СДЕЛКИ").first();
const tileInfo = await tile.evaluate((n) => ({ insideLink: !!n.closest("a"), href: n.closest("a")?.getAttribute("href") ?? null })).catch((e) => ({ error: String(e) }));
await tile.click().catch(() => {});
await page.waitForTimeout(1200);
report.dashboardTileClick = { ...tileInfo, urlAfterClick: page.url() };

writeFileSync("docs/qa/full-eval/uiux-loop-2026-07-05/evidence/g2-shell-interactions-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
