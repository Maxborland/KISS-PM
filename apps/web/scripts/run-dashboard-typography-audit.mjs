import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const port = process.env.SB_PORT ?? "6032";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/?path=/story/screens--dashboard&viewMode=story`, {
  waitUntil: "networkidle",
  timeout: 120000
});
const frame = page.frameLocator("#storybook-preview-iframe");
await frame.locator("body").waitFor({ timeout: 60000 });
await frame.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 120000 }).catch(() => undefined);
await frame.locator(".page-intro__title").first().waitFor({ timeout: 120000 });

const welcomeHeroTitle = await frame.locator(".welcome-hero__title").count();
const pageIntroTitle = await frame.locator(".page-intro__title").count();
const h1TypeH1 = await frame.locator("h1.type-h1").count();
const titleFontSize = await frame.locator(".page-intro__title").first().evaluate((el) =>
  getComputedStyle(el).fontSize
);

await frame.locator("body").screenshot({ path: join(outDir, "batch13d-dashboard-page-intro.png") });
await browser.close();

const audit = {
  batch: "13d",
  date: "2026-05-24",
  storyId: "screens--dashboard",
  welcomeHeroTitle,
  pageIntroTitle,
  h1TypeH1,
  pageIntroTitleFontSizePx: titleFontSize,
  pass: welcomeHeroTitle === 0 && pageIntroTitle >= 1,
  evidencePng: ".storybook-verify-tmp/batch13d-dashboard-page-intro.png"
};

writeFileSync(join(outDir, "batch13d-dashboard-typography-evidence.json"), JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));
if (!audit.pass) process.exit(1);
