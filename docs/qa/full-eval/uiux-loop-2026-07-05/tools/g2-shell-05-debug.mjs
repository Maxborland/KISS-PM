// G2 debug: что реально на /profile, /settings, /my-work
import { launch, login, shot, USERS } from "./browser.mjs";

const { browser, context } = await launch();
await login(context, USERS.admin);
const page = await context.newPage();

for (const [path, name] of [["/profile", "profile"], ["/settings", "settings"], ["/my-work", "mywork"]]) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => ({
    buttons: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 30),
    tabs: Array.from(document.querySelectorAll("[role='tab'], a")).map((t) => (t.textContent || "").trim()).filter(Boolean).slice(0, 30),
    mainText: (document.querySelector("main")?.innerText || document.body.innerText).slice(0, 400)
  }));
  console.log("=== " + path + " ===");
  console.log(JSON.stringify(info, null, 2));
  await shot(page, `g2-shell-debug-${name}`);
}
await browser.close();
