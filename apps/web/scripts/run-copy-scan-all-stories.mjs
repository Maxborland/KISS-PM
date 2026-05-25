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

/** Phase 0 — Storybook interaction/error UI must not appear on product screens. */
const SCREEN_ERROR_MARKERS = [
  /Found multiple elements/i,
  /TestingLibraryElementError/i,
  /Unable to find an element/i,
  /The story failed to render/i,
  /Storybook preview failed/i
];

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
  await frame.locator("body").waitFor({ state: "attached", timeout: 120000 }).catch(() => undefined);
  for (let i = 0; i < 80; i += 1) {
    await frame.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 3000 }).catch(() => undefined);
    const text = await frame.locator("body").innerText().catch(() => "");
    if (text.length > 5 && !text.includes("No Preview")) return text;
    await new Promise((r) => setTimeout(r, 500));
  }
  return frame.locator("body").innerText().catch(() => "");
}

const storyResults = [];

for (const id of storyIds) {
  const storyUrl = `http://127.0.0.1:${port}/?path=/story/${id}&viewMode=story`;
  let navigated = false;
  for (let attempt = 0; attempt < 3 && !navigated; attempt += 1) {
    try {
      await page.goto(storyUrl, {
        waitUntil: isStatic ? "load" : "networkidle",
        timeout: 120000
      });
      navigated = true;
    } catch (err) {
      if (attempt === 2) {
        storyResults.push({
          id,
          hasNoPreview: true,
          hasEnDev: false,
          hasCyrillic: false,
          hasScreenError: true,
          screenErrorMarkers: [String(err instanceof Error ? err.message : err)],
          pass: false
        });
      } else {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  if (!navigated) continue;

  await page.locator("#storybook-preview-iframe").waitFor({ state: "attached", timeout: 120000 });
  const frame = page.frameLocator("#storybook-preview-iframe");

  let text = "";
  try {
    text = await readPreviewText(frame);
  } catch (err) {
    storyResults.push({
      id,
      hasNoPreview: true,
      hasEnDev: false,
      hasCyrillic: false,
      hasScreenError: true,
      screenErrorMarkers: [String(err instanceof Error ? err.message : err)],
      pass: false
    });
    continue;
  }
  const hasNoPreview = text.includes("No Preview");
  const hasEnDev = EN_DEV.test(text);
  const hasCyrillic = CYRILLIC.test(text);
  const isProductScreen = id.startsWith("views-screens--");
  const screenErrorMarkers = isProductScreen
    ? SCREEN_ERROR_MARKERS.filter((re) => re.test(text)).map((re) => re.source)
    : [];
  const hasScreenError = screenErrorMarkers.length > 0;
  const pass = !hasNoPreview && hasCyrillic && !hasEnDev && !hasScreenError;

  storyResults.push({
    id,
    hasNoPreview,
    hasEnDev,
    hasCyrillic,
    hasScreenError,
    screenErrorMarkers,
    pass
  });
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

const screenStories = storyResults.filter((r) => r.id.startsWith("views-screens--"));
const screenErrorFailures = screenStories.filter((r) => r.hasScreenError);
writeFileSync(
  join(outDir, "phase0-screen-error-gate.json"),
  `${JSON.stringify(
    {
      batch: "phase0-screen-error-gate",
      date: "2026-05-26",
      storiesChecked: screenStories.length,
      passCount: screenStories.filter((r) => r.pass).length,
      failures: screenErrorFailures,
      pass: screenErrorFailures.length === 0
    },
    null,
    2
  )}\n`,
  "utf8"
);
console.log(JSON.stringify({ pass: audit.pass, checked: audit.storiesChecked, failures: failures.length }, null, 2));
if (failures.length > 0) {
  console.log("Failed ids:", failures.map((f) => f.id).join(", "));
}
process.exit(audit.pass ? 0 : 1);
