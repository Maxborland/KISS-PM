import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const index = JSON.parse(readFileSync(join(root, "storybook-static/index.json"), "utf8"));

const REFERENCE_STORIES = [
  { id: "foundations-colors--palette", ref: "foundations-colors" },
  { id: "foundations-typography--type-scale", ref: "foundations-typography" },
  { id: "views-screens--dashboard", ref: "views-screens-dashboard" },
  { id: "views-screens--task-card", ref: "views-screens-task-card" },
  { id: "views-screens--project-gantt", ref: "views-screens-gantt" },
  { id: "views-screens--project-resources", ref: "views-screens-resources" },
  { id: "catalog-all-components--for-approval", ref: "catalog-all-components" }
];

const EN_DEV = /\b(Primary|Secondary|Outline|Ghost|Destructive|Default|Success|Warning|Danger|Dialog|Sheet|Popover|Menu|Toast)\b/;
const CYRILLIC = /[А-Яа-яЁё]/;

const port = process.env.SB_PORT ?? "6026";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const storyResults = [];

for (const { id, ref } of REFERENCE_STORIES) {
  await page.goto(`http://127.0.0.1:${port}/?path=/story/${id}&viewMode=story`, {
    waitUntil: "networkidle",
    timeout: 120000
  });
  const frame = page.frameLocator("#storybook-preview-iframe");
  await frame.locator("body").waitFor({ timeout: 60000 });
  const text = await frame.locator("body").innerText();
  const hasNoPreview = text.includes("No Preview");
  const hasEnDev = EN_DEV.test(text);
  const hasCyrillic = CYRILLIC.test(text);
  const welcomeHero = (await frame.locator(".welcome-hero__title").count()) > 0;
  const typeH1 = (await frame.locator("h1.type-h1").count()) > 0;
  const pageIntro = (await frame.locator(".page-intro__title").count()) > 0;

  await frame.locator("body").screenshot({ path: join(outDir, `audit-${ref}.png`) });

  storyResults.push({
    id,
    ref,
    hasNoPreview,
    hasEnDev,
    hasCyrillic,
    welcomeHero,
    typeH1,
    pageIntro,
    textLen: text.length,
    pass: !hasNoPreview && hasCyrillic && !hasEnDev
  });
}

await browser.close();

const dv2 = Object.values(index.entries).filter((e) => (e.importPath || "").includes("design-v2"));
const uiStories = Object.values(index.entries).filter((e) => (e.title || "").startsWith("UI/") && e.type === "story");
const uiWithOnlyShowcase = uiStories.filter((e) => e.name === "Витрина").length;

const audit = {
  batch: 10,
  date: "2026-05-24",
  storybookEntries: Object.keys(index.entries).length,
  designV2Entries: dv2.length,
  referenceStories: storyResults,
  referencePassCount: storyResults.filter((s) => s.pass).length,
  checklist: {
    screensFullscreenLayout: true,
    screensWorkspaceChromeExempt: false,
    noteChromeExempt: "state-* и 19-login: login без chrome OK; state-* сейчас в WorkspaceChrome (screen-view.tsx)",
    noDesignV2InIndex: dv2.length === 0,
    catalogUsesCardPanelDataTable: false,
    catalogUsesShadcnCardTable: true,
    uiVariantStatesBeyondShowcase: false,
    uiVitrinaOnlyCount: uiWithOnlyShowcase,
    legacyBadgeBemInViews: true,
    legacyBadgePath: "apps/web/src/views/blocks/deals-block.tsx"
  }
};

writeFileSync(join(outDir, "batch10-contract-audit.json"), JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));
