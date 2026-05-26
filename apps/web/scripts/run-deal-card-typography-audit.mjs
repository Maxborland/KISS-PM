import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const port = process.env.SB_PORT ?? "6026";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/?path=/story/screens--deals&viewMode=story`, {
  waitUntil: "networkidle",
  timeout: 120000
});
const frame = page.frameLocator("#storybook-preview-iframe");
await frame.locator(".deal-card__title").first().waitFor({ timeout: 120000 });
const fontSize = await frame.locator(".deal-card__title").first().evaluate((el) => getComputedStyle(el).fontSize);
await browser.close();

const audit = {
  batch: "14m",
  date: "2026-05-24",
  storyId: "screens--deals",
  dealCardTitleFontSizePx: fontSize,
  cssToken: "var(--text-h3) → 18px",
  pass: fontSize === "18px"
};

writeFileSync(join(outDir, "batch14m-deal-card-typography-evidence.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify(audit, null, 2));
process.exit(audit.pass ? 0 : 1);
