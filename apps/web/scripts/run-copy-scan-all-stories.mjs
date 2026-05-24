import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const index = JSON.parse(readFileSync(join(root, "storybook-static/index.json"), "utf8"));

/** Тот же паттерн, что batch 10 — EN dev-labels в видимом preview. */
const EN_DEV =
  /\b(Primary|Secondary|Outline|Ghost|Destructive|Default|Success|Warning|Danger|Dialog|Sheet|Popover|Menu|Toast)\b/;
const CYRILLIC = /[А-Яа-яЁё]/;

const storyIds = Object.values(index.entries)
  .filter((e) => e.type === "story")
  .map((e) => e.id)
  .sort();

const port = process.env.SB_PORT ?? "6026";
const isStatic = process.env.STORYBOOK_STATIC === "1";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function readPreviewText(frame) {
  if (!isStatic) {
    await frame.locator("body").waitFor({ timeout: 60000 });
    await frame.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 120000 }).catch(() => undefined);
    return frame.locator("body").innerText();
  }
  for (let i = 0; i < 40; i += 1) {
    await frame.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 3000 }).catch(() => undefined);
    const text = await frame.locator("body").innerText();
    if (text.length > 5 && !text.includes("No Preview")) return text;
    await new Promise((r) => setTimeout(r, 500));
  }
  return frame.locator("body").innerText();
}

const storyResults = [];

for (const id of storyIds) {
  await page.goto(`http://127.0.0.1:${port}/?path=/story/${id}&viewMode=story`, {
    waitUntil: isStatic ? "load" : "networkidle",
    timeout: 120000
  });
  const frame = page.frameLocator("#storybook-preview-iframe");
  await frame.locator("body").waitFor({ timeout: 60000 });

  const text = await readPreviewText(frame);
  const hasNoPreview = text.includes("No Preview");
  const hasEnDev = EN_DEV.test(text);
  const hasCyrillic = CYRILLIC.test(text);
  const pass = !hasNoPreview && hasCyrillic && !hasEnDev;

  storyResults.push({ id, hasNoPreview, hasEnDev, hasCyrillic, pass });
}

await browser.close();

const failures = storyResults.filter((r) => !r.pass);
const audit = {
  batch: "15c",
  date: "2026-05-24",
  storiesChecked: storyIds.length,
  enDevPattern: EN_DEV.source,
  passCount: storyResults.filter((r) => r.pass).length,
  failures,
  pass: failures.length === 0
};

writeFileSync(join(outDir, "batch15c-copy-scan-evidence.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ pass: audit.pass, checked: audit.storiesChecked, failures: failures.length }, null, 2));
if (failures.length > 0) {
  console.log("Failed ids:", failures.map((f) => f.id).join(", "));
}
process.exit(audit.pass ? 0 : 1);
