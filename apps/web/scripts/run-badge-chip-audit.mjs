import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

function scanTsx(dir) {
  const hits = [];
  for (const file of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, file.name);
    if (file.isDirectory() && file.name !== "node_modules") {
      hits.push(...scanTsx(full));
    } else if (file.name.endsWith(".tsx") || file.name.endsWith(".ts")) {
      const text = readFileSync(full, "utf8");
      if (/className=["']badge |badge badge--/.test(text)) {
        hits.push(full.replace(root + "\\", "").replace(root + "/", ""));
      }
    }
  }
  return hits;
}

const staticHits = [
  ...scanTsx(join(root, "src/views")),
  ...scanTsx(join(root, "src/widgets"))
];

const port = process.env.SB_PORT ?? "6032";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/?path=/story/views-screens--deals&viewMode=story`, {
  waitUntil: "networkidle",
  timeout: 120000
});
const frame = page.frameLocator("#storybook-preview-iframe");
await frame.locator("body").waitFor({ timeout: 60000 });
await frame.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 120000 }).catch(() => undefined);
await frame.locator(".funnel").first().waitFor({ timeout: 120000 });

const legacyBadge = await frame.locator(".badge.badge--soft").count();
const uiBadge = await frame.locator('[data-slot="badge"]').count();
await frame.locator("body").screenshot({ path: join(outDir, "batch13e-deals-badge.png") });
await browser.close();

const audit = {
  batch: "13e",
  date: "2026-05-24",
  staticLegacyBadgeInViewsWidgets: staticHits,
  staticPass: staticHits.length === 0,
  storyId: "views-screens--deals",
  domLegacyBadge: legacyBadge,
  domUiBadge: uiBadge,
  domPass: legacyBadge === 0 && uiBadge >= 1,
  pass: staticHits.length === 0 && legacyBadge === 0 && uiBadge >= 1
};

writeFileSync(join(outDir, "batch13e-badge-chip-evidence.json"), JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));
if (!audit.pass) process.exit(1);
