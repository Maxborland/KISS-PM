// G8 Роли и деградация: обход ключевых роутов под ограниченными ролями + пустой тенант Beta.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const ROUTES = [
  ["/dashboard", "dashboard"],
  ["/my-work", "my-work"],
  ["/projects", "projects"],
  ["/projects/project-vektor-portal/schedule", "schedule"],
  ["/crm/deals", "crm-deals"],
  ["/communications/chat", "chat"],
  ["/admin", "admin"],
  ["/agent", "agent"]
];

const report = {};

async function crawlUser(userKey, routes = ROUTES) {
  const { browser, context } = await launch();
  await login(context, USERS[userKey]);
  const page = await context.newPage();
  const consoleErrors = [];
  const apiFails = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400) apiFails.push({ url: r.url().replace(BASE_URL, ""), status: r.status() });
  });
  const userReport = { routes: {}, nav: [] };
  for (const [route, slug] of routes) {
    consoleErrors.length = 0;
    apiFails.length = 0;
    let gotoStatus = null;
    try {
      const resp = await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 25000 });
      gotoStatus = resp ? resp.status() : null;
    } catch (e) {
      userReport.routes[route] = { error: "goto: " + e.message.slice(0, 150) };
    }
    await page.waitForTimeout(1800);
    const finalUrl = page.url().replace(BASE_URL, "");
    const bodyText = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, "\n").trim()).catch(() => "");
    const spinners = await page.locator('[class*="spinner" i], [class*="loading" i], [role="progressbar"]').count().catch(() => -1);
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    await shot(page, `g8-roles-${userKey}-${slug}`);
    userReport.routes[route] = {
      gotoStatus, finalUrl, h1,
      spinners,
      textLen: bodyText.length,
      textHead: bodyText.slice(0, 700),
      consoleErrors: [...new Set(consoleErrors)].slice(0, 8),
      apiFails: apiFails.slice(0, 15)
    };
    console.log(`[${userKey}] ${route} -> ${finalUrl} status=${gotoStatus} textLen=${bodyText.length} conErr=${consoleErrors.length} apiFails=${apiFails.length}`);
  }
  // Снять пункты навигации (sidebar links) на /dashboard
  await page.goto(BASE_URL + "/dashboard", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1000);
  userReport.nav = await page.evaluate(() =>
    [...document.querySelectorAll("nav a, aside a")].map(a => ({ text: a.innerText.trim().replace(/\n/g, " "), href: a.getAttribute("href") })).filter(x => x.href)
  ).catch(() => []);
  await browser.close();
  return userReport;
}

for (const u of ["planReader", "resourceReader", "engineer"]) {
  report[u] = await crawlUser(u);
}
// Beta — пустой тенант: смотрим empty states на ключевых роутах
report.beta = await crawlUser("beta", [
  ["/dashboard", "dashboard"],
  ["/my-work", "my-work"],
  ["/projects", "projects"],
  ["/crm/deals", "crm-deals"],
  ["/communications/chat", "chat"]
]);

writeFileSync(`${EVIDENCE_DIR}/g8-roles-crawl.json`, JSON.stringify(report, null, 2));
console.log("DONE");
