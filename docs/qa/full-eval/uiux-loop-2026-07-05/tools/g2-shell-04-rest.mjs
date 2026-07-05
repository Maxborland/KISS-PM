// G2: откат темы/телефона, settings-табы, my-work list/done, viewport 1280.
import { launch, login, shot, USERS } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const report = { steps: {}, console: [] };
page.on("console", (m) => { if (m.type() === "error") report.console.push({ url: page.url(), text: m.text().slice(0, 300) }); });
const step = async (name, fn) => { try { report.steps[name] = await fn(); } catch (e) { report.steps[name] = { error: String(e).slice(0, 300) }; } };

// 0. Откат темы и телефона через UI
await step("revert", async () => {
  await page.goto("/profile", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Редактирование профиля", { timeout: 15000 });
  await page.locator("button:text-is('Светлая')").click();
  await page.getByPlaceholder("+7 999 000-00-00").fill("");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Сохранить/ }).click();
  await page.waitForTimeout(1500);
  const me = await (await context.request.get("http://127.0.0.1:3000/api/auth/me")).json();
  return { theme: me.user.theme, phone: me.user.phone };
});

// 1. Settings табы
await page.goto("/settings", { waitUntil: "networkidle" });
for (const [tab, slug] of [["Уведомления", "notifications"], ["Интеграции", "integrations"], ["Оплата", "billing"]]) {
  await step(`settings-${slug}`, async () => {
    await page.locator(`label:has-text("${tab}"), button:has-text("${tab}")`).first().click();
    await page.waitForTimeout(1200);
    await shot(page, `g2-shell-settings-${slug}`);
    return { text: (await page.locator("main").innerText()).slice(0, 700) };
  });
}

// 2. My-work: канбан-скролл + клик по карточке
await step("kanban", async () => {
  await page.goto("/my-work", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const scroll = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("main *")).filter((e) => e.scrollWidth > e.clientWidth + 10);
    return els.slice(0, 3).map((e) => ({ cls: (e.className || "").toString().slice(0, 60), overflowX: getComputedStyle(e).overflowX }));
  });
  await page.locator("text=Тестирование портала").first().click();
  await page.waitForTimeout(1500);
  const res = { scroll, urlAfterCardClick: page.url(), dialogs: await page.locator("[role='dialog']").count() };
  await shot(page, "g2-shell-mywork-card-click");
  return res;
});

// 3. My-work список: контролы, отметка выполнения
await step("list", async () => {
  await page.goto("/my-work", { waitUntil: "networkidle" });
  await page.locator("text=Список").first().click();
  await page.waitForTimeout(1200);
  await shot(page, "g2-shell-mywork-list");
  return await page.evaluate(() => ({
    selects: Array.from(document.querySelectorAll("main select")).map((s) => Array.from(s.options).map((o) => o.text).join("|")),
    inputs: Array.from(document.querySelectorAll("main input")).map((i) => ({ type: i.type, placeholder: i.placeholder })),
    buttons: Array.from(document.querySelectorAll("main button")).map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 50),
    rowSample: (document.querySelector("main table, main [role='table'], main ul, main [class*='list']")?.innerText || "").slice(0, 500)
  }));
});

// 3б. клик по строке списка
await step("listRowClick", async () => {
  const row = page.locator("main").locator("text=Тестирование портала").first();
  await row.click();
  await page.waitForTimeout(1500);
  const r = { url: page.url(), dialogs: await page.locator("[role='dialog']").count() };
  await shot(page, "g2-shell-mywork-list-row-click");
  return r;
});

// 4. Viewport 1280x800
await step("viewport1280", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "g2-shell-dashboard-1280");
  await page.goto("/my-work", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "g2-shell-mywork-1280");
  return await page.evaluate(() => ({ bodyScrollX: document.body.scrollWidth > window.innerWidth }));
});

writeFileSync("docs/qa/full-eval/uiux-loop-2026-07-05/evidence/g2-shell-rest-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
