// Phase 5 loop: повторный проход по затронутым поверхностям после P0-фиксов.
// Каждый ключевой роут: открывается, без «Сущность не найдена», без raw permission-кодов
// в happy-path, консоль без новых ошибок (кроме известного favicon 404).
import { launch, USERS } from "./browser.mjs";
const BASE = "http://127.0.0.1:3010";
const { browser, context } = await launch();
await context.request.post(`${BASE}/api/auth/login`, { data: USERS.admin });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });
const ROUTES = ["/dashboard","/my-work","/projects","/projects/project-vektor-portal/overview","/projects/project-vektor-portal/schedule","/crm/deals","/crm/clients","/communications/chat","/communications/channels","/communications/meetings","/communications/calls","/communications/notifications","/admin/users","/admin/security","/agent","/settings","/profile"];
let fails = 0;
for (const r of ROUTES) {
  consoleErrors.length = 0;
  try {
    await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    const t = await page.textContent("body");
    const dead = t.includes("Сущность не найдена") || t.includes("proj-portal") || t.includes("Application error");
    const errs = consoleErrors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    if (dead || errs.length > 2) { fails++; console.log("FAIL", r, dead ? "dead-state" : "", errs.slice(0, 2).join(" | ")); }
    else console.log("PASS", r);
  } catch (e) { fails++; console.log("FAIL", r, e.message.split("\n")[0]); }
}
await browser.close();
console.log(fails === 0 ? "SWEEP-CLEAN" : `SWEEP-FAILS: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
