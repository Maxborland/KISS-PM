#!/usr/bin/env node
// Screenshots all approved planning UI mockups at three viewports.
// Reads docs/references/planning-ui-approved/index.json, opens each HTML via
// file:// URL, snapshots desktop / laptop / narrow viewports and writes PNG
// files into docs/status/artifacts/2026-05-23-planning-ui/<viewport>/<screen>.png.

import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const mockupsDir = resolve(repoRoot, "docs", "references", "planning-ui-approved");
const indexFile = resolve(mockupsDir, "index.json");
const outRoot = resolve(repoRoot, "docs", "status", "artifacts", "2026-05-23-planning-ui");

async function main() {
  if (!existsSync(indexFile)) {
    throw new Error(`index.json not found at ${indexFile}`);
  }
  const index = JSON.parse(await readFile(indexFile, "utf8"));
  const { screens, viewports } = index;

  const browser = await chromium.launch();
  try {
    for (const vp of viewports) {
      const vpDir = join(outRoot, vp.id);
      await mkdir(vpDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      for (const screen of screens) {
        const file = resolve(mockupsDir, screen.file);
        if (!existsSync(file)) {
          console.warn(`! missing ${file}`);
          continue;
        }
        const url = pathToFileURL(file).href;
        await page.goto(url, { waitUntil: "load" });
        // give the layout a beat to settle (fonts, sticky)
        await page.waitForTimeout(220);

        const isNarrow = vp.width < 768;
        const outPath = join(vpDir, `${screen.id}.png`);
        if (isNarrow) {
          await page.screenshot({ path: outPath, fullPage: true });
        } else {
          await page.screenshot({
            path: outPath,
            clip: { x: 0, y: 0, width: vp.width, height: vp.height },
          });
        }
        console.log(`✓ ${vp.id} / ${screen.id} → ${outPath}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
