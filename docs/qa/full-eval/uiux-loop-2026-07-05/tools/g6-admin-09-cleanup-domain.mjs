// G6 Admin: откат мусорного домена "это не домен!!" из security policy.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
await page.goto(BASE_URL + "/admin/security", { waitUntil: "networkidle" });
await page.waitForTimeout(600);

// найти чип с мусорным доменом и его кнопку удаления
const removed = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll("main *")).filter(
    (e) => e.childElementCount <= 2 && e.textContent.trim().startsWith("это не домен!!") && e.textContent.trim().length < 30
  );
  for (const el of els) {
    const btn = el.querySelector("button") || el.closest("span,div")?.querySelector("button");
    if (btn) { btn.click(); return true; }
  }
  return false;
});
await page.waitForTimeout(500);
const still = await page.locator("text=это не домен!!").count();
if (!still) {
  await page.getByRole("button", { name: /Сохранить/ }).click();
  await page.waitForTimeout(1200);
}
await shot(page, "g6-admin-security-cleanup");
const s = await context.request.get(BASE_URL + "/api/tenant/current/security-policy");
const body = await s.text();
writeFileSync(`${EVIDENCE_DIR}/g6-admin-cleanup.json`, JSON.stringify({ removedClick: removed, chipStill: still, policy: body }, null, 2));
console.log("removedClick:", removed, "chipStill:", still, "policy:", body);
await browser.close();
