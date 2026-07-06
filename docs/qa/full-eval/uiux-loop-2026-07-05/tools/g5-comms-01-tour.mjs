// G5 Communications: обзорный тур по всем поверхностям под admin.
// Скриншот каждой страницы + console errors + failed requests.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const routes = [
  ["/communications/chat", "g5-comms-chat"],
  ["/communications/channels", "g5-comms-channels"],
  ["/communications/meetings", "g5-comms-meetings"],
  ["/communications/calls", "g5-comms-calls"],
  ["/communications/notifications", "g5-comms-notifications"]
];

const { browser, context } = await launch();
await login(context, USERS.admin);

// реальный roomId из API
const roomsResp = await context.request.get(`${BASE_URL}/api/workspace/call-rooms?entityType=project&entityId=project-vektor-portal`);
const roomsJson = await roomsResp.json().catch(() => null);
const realRoomId = roomsJson?.callRooms?.[0]?.roomId ?? null;
routes.push([`/calls/${realRoomId ?? "call-room-unknown"}`, "g5-comms-call-runtime-real"]);
routes.push(["/calls/not-a-real-room-id", "g5-comms-call-runtime-invalid"]);

const report = { realRoomId, pages: [] };

for (const [route, name] of routes) {
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 500)); });
  page.on("response", (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
  let error = null;
  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2500);
  } catch (e) { error = String(e).slice(0, 300); }
  const path = await shot(page, name);
  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 3000);
  report.pages.push({ route, screenshot: path, error, consoleErrors: consoleErrors.slice(0, 15), failedRequests: failedRequests.slice(0, 15), bodyText });
  await page.close();
}

writeFileSync(`${EVIDENCE_DIR}/g5-comms-tour-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.pages.map((p) => ({ route: p.route, error: p.error, ce: p.consoleErrors.length, fr: p.failedRequests })), null, 2));
await browser.close();
