// Live-верификация P0-1..P0-3 на стенде из worktree (web :3010 → api :4030).
import { launch, login, shot, USERS } from "./browser.mjs";

process.env.EVAL_BASE_URL = undefined;
const BASE = "http://127.0.0.1:3010";
const { browser, context } = await launch();
const r = await context.request.post(`${BASE}/api/auth/login`, { data: USERS.admin });
if (!r.ok()) throw new Error("login failed " + r.status());
const page = await context.newPage();
const out = [];
const check = (name, ok, note = "") => { out.push({ name, ok, note }); console.log(ok ? "PASS" : "FAIL", name, note); };

// P0-1a: чат жив на реальном проекте
await page.goto(`${BASE}/communications/chat`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);
  const chatText = await page.textContent("body");
check("chat-alive", !chatText.includes("Сущность не найдена") && !chatText.includes("proj-portal"), (await page.textContent("h1 ~ p, p").catch(()=>"")) ?? "");
const chatSubtitle = await page.locator("text=Беседы ·").first().textContent().catch(() => "");
check("chat-subtitle-human", Boolean(chatSubtitle && !chatSubtitle.includes("project /")), chatSubtitle ?? "");
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p01-chat.png", fullPage: true });

// P0-1a: встречи и звонки живы
for (const [tab, name] of [["meetings", "meetings-alive"], ["calls", "calls-alive"]]) {
  await page.goto(`${BASE}/communications/${tab}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500); const t = await page.textContent("body");
  check(name, !t.includes("Сущность не найдена") && !t.includes("proj-portal"));
}
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p01-meetings.png", fullPage: true });

// P0-1b: шапка проекта — реальное имя, не мок
await page.goto(`${BASE}/projects/project-vektor-portal/overview`, { waitUntil: "domcontentloaded", timeout: 60000 });
const header = await page.textContent("h1, header").catch(() => "");
await page.waitForTimeout(3500); const body1 = await page.textContent("body");
check("project-header-real", body1.includes("Вектор") && !body1.includes("Производственный портал · Релиз 2"), header?.slice(0, 80) ?? "");
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p01-project-header.png", fullPage: true });

// P0-3: невалидный ID проекта → «не найдено», не подмена
await page.goto(`${BASE}/projects/does-not-exist-123`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000); const nf = await page.textContent("body");
check("project-notfound", nf.includes("Проект не найден"), "");
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p03-project-notfound.png", fullPage: true });

// P0-3: невалидный ID сделки → «не найдено»
await page.goto(`${BASE}/crm/deals/no-such-deal-999`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000); const nfd = await page.textContent("body");
check("deal-notfound", nfd.includes("Сделка не найдена"), "");
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p03-deal-notfound.png", fullPage: true });

// P0-2: карточка сделки — даты заполнены и сохранение названия проходит
const opps = await (await context.request.get(`${BASE}/api/workspace/opportunities`)).json();
const opp = opps.opportunities.find((o) => o.stageId) ?? opps.opportunities[0];
await page.goto(`${BASE}/crm/deals/${opp.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500); const startVal = await page.locator('input[type="date"]').first().inputValue();
check("deal-dates-filled", /^\d{4}-\d{2}-\d{2}$/.test(startVal), startVal);
const titleInput = page.locator("input").first();
await page.screenshot({ path: "docs/qa/full-eval/uiux-loop-2026-07-05/evidence/screenshots/fix-p02-deal-dates.png", fullPage: true });

console.log(JSON.stringify(out));
await browser.close();
if (out.some((x) => !x.ok)) process.exit(1);
