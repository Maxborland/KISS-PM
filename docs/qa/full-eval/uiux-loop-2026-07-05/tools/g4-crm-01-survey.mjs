// G4 CRM: обзорный проход по всем CRM-страницам, скриншоты + console errors.
import { launch, login, shot, USERS, BASE_URL } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const routes = [
  ["/crm/deals", "g4-crm-deals-list"],
  ["/crm/deals/opportunity-vektor-portal", "g4-crm-deal-vektor-portal"],
  ["/crm/deals/opportunity-vektor-audit", "g4-crm-deal-vektor-audit"],
  ["/crm/deals/opportunity-romashka-support", "g4-crm-deal-romashka"],
  ["/crm/clients", "g4-crm-clients"],
  ["/crm/contacts", "g4-crm-contacts"],
  ["/crm/products", "g4-crm-products"],
  ["/crm/deals/nonexistent-id-12345", "g4-crm-deal-invalid-id"],
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

for (const [route, name] of routes) {
  try {
    await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    console.log(`goto ${route} error: ${e.message}`);
  }
  await page.waitForTimeout(1500);
  await shot(page, name);
  console.log(`${route} -> ${name}.png | title="${await page.title()}" | h1="${await page.locator("h1").first().textContent().catch(() => "none")}"`);
}

writeFileSync(new URL("../evidence/g4-crm-console-survey.json", import.meta.url), JSON.stringify(consoleLog, null, 2));
console.log("console entries:", consoleLog.length);
await browser.close();
