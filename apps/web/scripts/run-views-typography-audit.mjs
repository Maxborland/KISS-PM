import { chromium } from "@playwright/test";
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const index = JSON.parse(readFileSync(join(root, "storybook-static/index.json"), "utf8"));

const VIEW_SCREEN_STORIES = Object.keys(index.entries)
  .filter((id) => id.startsWith("screens--"))
  .sort();

const LOGIN_ID = "screens--login";

function walkTsx(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkTsx(path, acc);
    else if (name.endsWith(".tsx")) acc.push(path);
  }
  return acc;
}

const staticViolations = [];
for (const file of walkTsx(join(root, "src/views"))) {
  const rel = file.slice(root.length + 1).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  if (
    rel !== "src/views/screens/login-screen-view.tsx" &&
    /<h1/.test(src) &&
    !src.includes("page-intro__title") &&
    !src.includes("login-card__title")
  ) {
    staticViolations.push({ file: rel, rule: "h1-outside-page-intro" });
  }
  if (/welcome-hero/.test(src)) {
    staticViolations.push({ file: rel, rule: "welcome-hero" });
  }
}

const port = process.env.SB_PORT ?? "6026";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const storyResults = [];

for (const id of VIEW_SCREEN_STORIES) {
  await page.goto(`http://127.0.0.1:${port}/?path=/story/${id}&viewMode=story`, {
    waitUntil: "networkidle",
    timeout: 120000
  });
  const frame = page.frameLocator("#storybook-preview-iframe");
  await frame.locator("body").waitFor({ timeout: 60000 });
  await frame.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 120000 }).catch(() => undefined);

  const welcomeHero = await frame.locator(".welcome-hero__title").count();
  const pageIntro = await frame.locator(".page-intro__title").count();
  const loginTitle = await frame.locator(".login-card__title").count();

  let h1FontSizePx = null;
  let buttonFontSizePx = null;

  if (id === LOGIN_ID) {
    if (loginTitle < 1) {
      storyResults.push({ id, pass: false, reason: "missing-login-card-title" });
      continue;
    }
    h1FontSizePx = await frame.locator(".login-card__title").first().evaluate((el) => getComputedStyle(el).fontSize);
  } else if (pageIntro < 1) {
    storyResults.push({ id, pass: false, reason: "missing-page-intro-title" });
    continue;
  } else {
    h1FontSizePx = await frame.locator(".page-intro__title").first().evaluate((el) => getComputedStyle(el).fontSize);
    const btn = frame.locator("button").filter({ hasText: /./ }).first();
    if ((await btn.count()) > 0) {
      buttonFontSizePx = await btn.evaluate((el) => getComputedStyle(el).fontSize);
    }
  }

  const pass =
    welcomeHero === 0 &&
    (id === LOGIN_ID ? loginTitle >= 1 : pageIntro >= 1 && h1FontSizePx === "32px");

  storyResults.push({
    id,
    pass,
    welcomeHero,
    pageIntro,
    loginTitle,
    h1FontSizePx,
    buttonFontSizePx,
    reason: pass ? null : id === LOGIN_ID ? "login-not-h2-card" : "h1-not-32px-or-welcome-hero"
  });
}

await browser.close();

const playwrightPass = storyResults.every((r) => r.pass);
const audit = {
  batch: "14",
  date: "2026-05-24",
  fix: "Views/Screens: PageIntro h1 32px on all workspace stories; login uses login-card__title; no welcome-hero",
  storiesChecked: VIEW_SCREEN_STORIES.length,
  staticViolations,
  storyResults,
  staticPass: staticViolations.length === 0,
  playwrightPass,
  pass: staticViolations.length === 0 && playwrightPass
};

writeFileSync(join(outDir, "batch14-views-typography-evidence.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify(audit, null, 2));
process.exit(audit.pass ? 0 : 1);
