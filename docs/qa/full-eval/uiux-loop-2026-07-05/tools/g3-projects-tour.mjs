// G3 Projects: обзорный тур по всем вкладкам + консольные ошибки. Запуск из корня worktree.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const routes = [
  ["/projects", "g3-projects-list"],
  ["/projects/project-vektor-portal", "g3-projects-detail-root"],
  ["/projects/project-vektor-portal/overview", "g3-projects-overview"],
  ["/projects/project-vektor-portal/schedule", "g3-projects-schedule"],
  ["/projects/project-vektor-portal/resources", "g3-projects-resources"],
  ["/projects/project-vektor-portal/assignments", "g3-projects-assignments"],
  ["/projects/project-vektor-portal/baseline", "g3-projects-baseline"],
  ["/projects/project-vektor-portal/calendars", "g3-projects-calendars"],
  ["/projects/project-vektor-portal/commits", "g3-projects-commits"],
  ["/projects/project-vektor-portal/scenarios", "g3-projects-scenarios"],
  ["/projects/project-vektor-portal/settings", "g3-projects-settings"],
  ["/projects/does-not-exist-123", "g3-projects-invalid-id"],
  ["/projects/does-not-exist-123/schedule", "g3-projects-invalid-id-schedule"]
];

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();
const log = [];
let current = null;
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    log.push({ route: current, type: msg.type(), text: msg.text().slice(0, 500) });
  }
});
page.on("pageerror", (err) => log.push({ route: current, type: "pageerror", text: String(err).slice(0, 500) }));

const results = [];
for (const [route, name] of routes) {
  current = route;
  try {
    const resp = await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    const path = await shot(page, name);
    results.push({ route, status: resp?.status(), finalUrl: page.url(), title: await page.title(), shot: path });
  } catch (e) {
    results.push({ route, error: String(e).slice(0, 300) });
    try { await shot(page, name + "-error"); } catch {}
  }
}
writeFileSync(`${EVIDENCE_DIR}/g3-projects-tour.json`, JSON.stringify({ results, console: log }, null, 2));
console.log(JSON.stringify(results.map(r => ({ route: r.route, status: r.status, finalUrl: r.finalUrl })), null, 2));
console.log("console entries:", log.length);
await browser.close();
