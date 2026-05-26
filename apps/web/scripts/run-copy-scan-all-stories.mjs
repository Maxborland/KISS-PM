import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const staticRoot = join(root, "storybook-static");
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

const isStatic = process.env.STORYBOOK_STATIC === "1";
/** Chunked serve avoids EMFILE on Windows when scanning 150+ stories. */
const manageServe = isStatic && process.env.COPY_SCAN_EXTERNAL_SERVE !== "1";
const chunkSize = Number(process.env.COPY_SCAN_CHUNK_SIZE ?? "40");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const addr = probe.address();
      const free = typeof addr === "object" && addr ? addr.port : 0;
      probe.close((err) => (err ? reject(err) : resolve(free)));
    });
    probe.on("error", reject);
  });
}

function startStaticServe(listenPort) {
  return spawn(
    "pnpm",
    ["exec", "serve", staticRoot, "-s", "-l", String(listenPort)],
    { cwd: root, shell: true, stdio: "ignore" }
  );
}

async function waitForHttpRoot(listenPort) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${listenPort}/`);
      if (res.ok) return true;
    } catch {
      /* serve ещё не слушает */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function readPreviewText(frame, staticMode) {
  if (!staticMode) {
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

async function scanStory(page, id, port, staticMode) {
  const storyUrl = `http://127.0.0.1:${port}/?path=/story/${id}&viewMode=story`;
  let navigated = false;
  for (let attempt = 0; attempt < 3 && !navigated; attempt += 1) {
    try {
      await page.goto(storyUrl, {
        waitUntil: staticMode ? "load" : "networkidle",
        timeout: 120000
      });
      navigated = true;
    } catch (err) {
      if (attempt === 2) {
        return {
          id,
          hasNoPreview: true,
          hasEnDev: false,
          hasCyrillic: false,
          hasScreenError: true,
          screenErrorMarkers: [String(err instanceof Error ? err.message : err)],
          pass: false
        };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  await page.locator("#storybook-preview-iframe").waitFor({ state: "attached", timeout: 120000 });
  const frame = page.frameLocator("#storybook-preview-iframe");

  let text = "";
  try {
    text = await readPreviewText(frame, staticMode);
  } catch (err) {
    return {
      id,
      hasNoPreview: true,
      hasEnDev: false,
      hasCyrillic: false,
      hasScreenError: true,
      screenErrorMarkers: [String(err instanceof Error ? err.message : err)],
      pass: false
    };
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

  return { id, hasNoPreview, hasEnDev, hasCyrillic, hasScreenError, screenErrorMarkers, pass };
}

async function scanIds(page, ids, port, staticMode) {
  const chunkResults = [];
  for (const id of ids) {
    chunkResults.push(await scanStory(page, id, port, staticMode));
  }
  return chunkResults;
}

const storyResults = [];
const browser = await chromium.launch();

if (manageServe) {
  for (let offset = 0; offset < storyIds.length; offset += chunkSize) {
    const chunk = storyIds.slice(offset, offset + chunkSize);
    const port = await getFreePort();
    const server = startStaticServe(port);
    const ready = await waitForHttpRoot(port);
    if (!ready) {
      server.kill("SIGTERM");
      for (const id of chunk) {
        storyResults.push({
          id,
          hasNoPreview: true,
          hasEnDev: false,
          hasCyrillic: false,
          hasScreenError: true,
          screenErrorMarkers: ["static-serve-not-ready"],
          pass: false
        });
      }
      continue;
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    storyResults.push(...(await scanIds(page, chunk, port, true)));
    await page.close();
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 800));
  }
} else {
  const port = process.env.SB_PORT ?? "6026";
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  storyResults.push(...(await scanIds(page, storyIds, port, isStatic)));
  await page.close();
}

await browser.close();

const failures = storyResults.filter((r) => !r.pass);
const audit = {
  batch: "15c",
  date: "2026-05-26",
  storiesChecked: storyIds.length,
  chunkedServe: manageServe,
  chunkSize: manageServe ? chunkSize : null,
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
