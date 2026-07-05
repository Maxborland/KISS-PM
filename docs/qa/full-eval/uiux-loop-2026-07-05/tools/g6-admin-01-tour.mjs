// G6 Admin: обзорный тур по /admin* под admin. Скриншоты + console errors + текст страниц.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const routes = ["/admin", "/admin/users", "/admin/roles", "/admin/audit", "/admin/security"];

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();

const report = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    report.push({ kind: "console", type: msg.type(), url: page.url(), text: msg.text().slice(0, 500) });
  }
});
page.on("pageerror", (err) => report.push({ kind: "pageerror", url: page.url(), text: String(err).slice(0, 500) }));

for (const route of routes) {
  const resp = await page.goto(BASE_URL + route, { waitUntil: "networkidle" }).catch((e) => ({ err: String(e) }));
  await page.waitForTimeout(1500);
  const name = "g6-admin-tour" + route.replace(/\//g, "-");
  await shot(page, name);
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  report.push({
    kind: "route",
    route,
    finalUrl: page.url(),
    status: resp && resp.status ? resp.status() : resp?.err,
    title: await page.title(),
    textLen: text.length,
    text: text.slice(0, 4000)
  });
}

writeFileSync(`${EVIDENCE_DIR}/g6-admin-tour.json`, JSON.stringify(report, null, 2));
console.log("done, entries:", report.length);
await browser.close();
