// G3 Projects: список повторно (4-й проект?), роль plan-reader на вкладках, ресурсы/сценарии деградация.
import { launch, login, shot, USERS, BASE_URL, EVIDENCE_DIR } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const out = [];
let phase = "list-recheck";
const note = (s) => { out.push(`[${phase}] ${s}`); console.log(`[${phase}] ${s}`); };

{
  const { browser, context } = await launch();
  await login(context, USERS.admin);
  const page = await context.newPage();
  await page.goto(BASE_URL + "/projects", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  note("строк: " + (await page.locator("table tbody tr").count()));
  note("есть uiux-eval-сделка-02: " + (await page.getByText("uiux-eval-сделка-02").count()));
  await shot(page, "g3-projects-list-recheck");
  await browser.close();
}

phase = "plan-reader";
{
  const { browser, context } = await launch();
  await login(context, USERS.planReader);
  const page = await context.newPage();
  const con = [];
  page.on("console", (m) => { if (m.type() === "error") con.push(m.text().slice(0, 200)); });
  for (const [r, n] of [
    ["/projects/project-vektor-portal/schedule", "g3-projects-reader-schedule"],
    ["/projects/project-vektor-portal/resources", "g3-projects-reader-resources"],
    ["/projects/project-vektor-portal/scenarios", "g3-projects-reader-scenarios"],
    ["/projects/project-vektor-portal/settings", "g3-projects-reader-settings"]
  ]) {
    await page.goto(BASE_URL + r, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, n);
  }
  note("console errors plan-reader: " + JSON.stringify(con.slice(0, 6)));
  await browser.close();
}

writeFileSync(`${EVIDENCE_DIR}/g3-projects-roles.json`, JSON.stringify({ notes: out }, null, 2));
