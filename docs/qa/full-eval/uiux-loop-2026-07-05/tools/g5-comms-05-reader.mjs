// G5: как выглядят comms-поверхности под plan-reader (внятность forbidden/empty состояний).
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const { browser, context } = await launch();
await login(context, USERS.planReader);
const report = [];
for (const [route, name] of [
  ["/communications/channels", "g5-comms-reader-channels"],
  ["/communications/notifications", "g5-comms-reader-notifications"]
]) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await shot(page, name);
  report.push({ route, body: (await page.locator("body").innerText()).slice(0, 800) });
  await page.close();
}
writeFileSync(`${EVIDENCE_DIR}/g5-comms-reader-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
