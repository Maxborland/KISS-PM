// E2E: слайсы P1 — toast/confirm, permission-aware nav, 403-экраны, my-work, settings, тема.
import { launch, USERS } from "./browser.mjs";
const BASE = "http://127.0.0.1:3010";
const out = [];
const check = (n, ok, note = "") => { out.push({ n, ok }); console.log(ok ? "PASS" : "FAIL", n, note); };

// --- админ-контекст ---
const { browser, context } = await launch();
await context.request.post(`${BASE}/api/auth/login`, { data: USERS.admin });
const page = await context.newPage();

// P1-D: my-work — только задачи-исполнитель (12, а не 19), плитка дашборда согласована
const mw = await (await context.request.get(`${BASE}/api/workspace/my-work`)).json();
check("mywork-executor-only", (mw.tasks ?? []).length === 13, `count=${mw.tasks?.length}`);

// P1-A: тост при сохранении сделки (вместо строки внизу)
const opps = await (await context.request.get(`${BASE}/api/workspace/opportunities`)).json();
const openOpp = opps.opportunities.find((o) => o.status !== "won_closed" && o.status !== "lost_rejected");
await page.goto(`${BASE}/crm/deals/${openOpp.id}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const title = page.locator('label:has-text("Название") input').first();
await title.fill((await title.inputValue()).replace(/ uiux-eval-\d+/g, "") + ` uiux-eval-${Math.floor(Math.random() * 1e5)}`);
await page.locator('button:has-text("Сохранить")').first().click();
await page.waitForTimeout(1500);
const toastEl = await page.locator('[data-sonner-toast]').count();
check("deal-save-toast", toastEl > 0, `toasts=${toastEl}`);

// P1-A: confirm на «Проиграна» (отменяем, ничего не мутируем)
const lost = page.locator('button:has-text("Проиграна")').first();
if (await lost.count()) {
  await lost.click();
  await page.waitForTimeout(600);
  const dialogText = await page.textContent("body");
  const confirmShown = dialogText.includes("нельзя") && (await page.locator('div[role="dialog"]').count()) > 0;
  check("deal-close-confirm", confirmShown, "");
  await page.locator('div[role="dialog"] button:has-text("Отмена")').first().click().catch(() => {});
} else check("deal-close-confirm", false, "кнопка не найдена");
await page.waitForTimeout(500);

// P1-D: /settings достижим из меню пользователя
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.locator('button[aria-haspopup="menu"]').first().click();
await page.waitForTimeout(400);
const settingsLink = await page.locator('a[href="/settings"]:has-text("Настройки")').count();
check("settings-link-in-menu", settingsLink > 0, "");
await browser.close();

// --- plan-reader: навигация и /admin ---
const { browser: b2, context: c2 } = await launch();
await c2.request.post(`${BASE}/api/auth/login`, { data: USERS.planReader });
const p2 = await c2.newPage();
await p2.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(3500);
const navText = await p2.locator("aside").textContent();
check("nav-hides-admin-for-reader", !navText.includes("Администрирование"), "");
check("nav-no-dead-items", !navText.includes("Ресурсы") && !navText.includes("KPI"), "");
const bodyReader = await p2.textContent("body");
check("dashboard-reader-degrades", !bodyReader.includes("permission_missing"), "");
await p2.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p1-dashboard-planreader.png", fullPage: true });
await p2.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(2500);
const adminBody = await p2.textContent("body");
check("admin-forbidden-screen", adminBody.includes("Администрирование недоступно") && !adminBody.includes("Аудит"), "");
await p2.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p1-admin-forbidden.png", fullPage: true });
await b2.close();

// --- resource-reader: навигация не ведёт в 403 ---
const { browser: b3, context: c3 } = await launch();
await c3.request.post(`${BASE}/api/auth/login`, { data: USERS.resourceReader });
const p3 = await c3.newPage();
await p3.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await p3.waitForTimeout(3500);
const nav3 = await p3.locator("aside").textContent();
check("nav-resource-reader-minimal", !nav3.includes("Проекты") && !nav3.includes("Сделки") && !nav3.includes("Администрирование"), nav3.replace(/\s+/g, " ").slice(0, 80));
const body3 = await p3.textContent("body");
check("dashboard-rr-no-raw-code", !body3.includes("permission_missing"), "");
await p3.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p1-dashboard-resourcereader.png", fullPage: true });
await b3.close();

console.log(JSON.stringify(out));
if (out.some((x) => !x.ok)) process.exit(1);
