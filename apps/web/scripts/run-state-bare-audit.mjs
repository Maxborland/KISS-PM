import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const port = process.env.SB_PORT ?? "6028";
const stateStories = [
  "views-screens--state-empty",
  "views-screens--state-error",
  "views-screens--state-forbidden",
  "views-screens--state-loading"
];
const controlStory = "views-screens--dashboard";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function probeStory(storyId) {
  await page.goto(`http://127.0.0.1:${port}/?path=/story/${storyId}&viewMode=story`, {
    waitUntil: "networkidle",
    timeout: 120000
  });
  const frame = page.frameLocator("#storybook-preview-iframe");
  await frame.locator("body").waitFor({ timeout: 60000 });
  await frame
    .locator(".sb-preparing-story")
    .waitFor({ state: "hidden", timeout: 120000 })
    .catch(() => undefined);
  await frame.locator(".app-canvas").first().waitFor({ timeout: 120000 });
  const sidebarCount = await frame.locator(".app-sidebar").count();
  const barePanelCount = await frame.locator(".app-canvas__panel--bare").count();
  const workspacePanelCount = await frame.locator(".app-canvas__panel:not(.app-canvas__panel--bare)").count();
  return { storyId, sidebarCount, barePanelCount, workspacePanelCount };
}

const results = [];
for (const id of stateStories) {
  results.push(await probeStory(id));
}
const control = await probeStory(controlStory);
await browser.close();

const statePass = results.every(
  (r) => r.sidebarCount === 0 && r.barePanelCount === 1 && r.workspacePanelCount === 0
);
const controlPass = control.sidebarCount === 1 && control.barePanelCount === 0 && control.workspacePanelCount >= 1;

const audit = {
  batch: "13a",
  date: "2026-05-24",
  stateStories: results,
  control,
  statePass,
  controlPass,
  pass: statePass && controlPass
};

writeFileSync(join(outDir, "batch13a-state-bare-evidence.json"), JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));
if (!audit.pass) process.exit(1);
