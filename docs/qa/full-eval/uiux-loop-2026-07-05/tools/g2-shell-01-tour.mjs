// G2 shell tour: обзор /dashboard, /my-work, /profile, /settings, 404 под логином.
import { launch, login, shot, USERS } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const routes = [
  { path: "/dashboard", name: "g2-shell-tour-dashboard" },
  { path: "/my-work", name: "g2-shell-tour-my-work" },
  { path: "/profile", name: "g2-shell-tour-profile" },
  { path: "/settings", name: "g2-shell-tour-settings" },
  { path: "/definitely-not-a-page-uiux-eval", name: "g2-shell-tour-404" }
];

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const consoleLog = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    consoleLog.push({ route: page.url(), type: m.type(), text: m.text().slice(0, 500) });
  }
});
page.on("pageerror", (e) => consoleLog.push({ route: page.url(), type: "pageerror", text: String(e).slice(0, 500) }));

const report = {};
for (const r of routes) {
  await page.goto(r.path, { waitUntil: "networkidle" }).catch((e) => consoleLog.push({ route: r.path, type: "goto-fail", text: String(e) }));
  await page.waitForTimeout(1500);
  await shot(page, r.name);
  report[r.path] = {
    finalUrl: page.url(),
    title: await page.title(),
    h1: await page.locator("h1").allTextContents().catch(() => []),
  };
}

// Инвентаризация сайдбара и топбара на /dashboard
await page.goto("/dashboard", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
report.nav = await page.evaluate(() => {
  const items = [];
  document.querySelectorAll("nav a, aside a, nav button, aside button, [class*='sidebar'] a, [class*='sidebar'] button").forEach((el) => {
    items.push({
      tag: el.tagName,
      text: (el.textContent || "").trim().slice(0, 80),
      href: el.getAttribute("href"),
      disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
      cls: (el.className || "").toString().slice(0, 120)
    });
  });
  return items;
});
report.header = await page.evaluate(() => {
  const h = document.querySelector("header");
  if (!h) return null;
  return {
    text: (h.textContent || "").trim().slice(0, 400),
    buttons: Array.from(h.querySelectorAll("button, a")).map((b) => ({
      tag: b.tagName, text: (b.textContent || "").trim().slice(0, 60), aria: b.getAttribute("aria-label"), href: b.getAttribute("href")
    })),
    inputs: Array.from(h.querySelectorAll("input")).map((i) => ({ placeholder: i.placeholder, type: i.type }))
  };
});
report.console = consoleLog;
writeFileSync("docs/qa/full-eval/uiux-loop-2026-07-05/evidence/g2-shell-tour-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ routes: Object.keys(report), consoleErrors: consoleLog.length }, null, 2));
await browser.close();
