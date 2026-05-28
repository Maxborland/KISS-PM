import { expect, type Locator, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Storybook index `title` is the section root only; filter by stable story `id` prefixes. */
export const VRT_STORY_ID_PREFIXES = ["widgets-", "screens-", "flows-", "patterns-"] as const;

/** Representative stories audited by `storybook-vrt-harness.spec.ts`. */
export const HARNESS_REPRESENTATIVE_STORY_IDS: Record<(typeof VRT_STORY_ID_PREFIXES)[number], string> = {
  "widgets-": "widgets-gantt-showcase--baseline-and-critical-path",
  "screens-": "screens-дашборд--dashboard",
  "flows-": "flows-crm-→-проект--default",
  "patterns-": "patterns-формы--single"
};

export type HarnessTargetRecord = {
  storyId: string;
  targetId: string | null;
  targetClass: string | null;
  targetTag: string;
  usedStorybookRootFallback: boolean;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  storybookChromeFound: false;
};

export type HarnessTargetsArtifact = {
  generatedAt: string;
  port: number | null;
  stories: HarnessTargetRecord[];
  pass: boolean;
};

export type VrtStoryEntry = {
  id: string;
  title: string;
  section: string;
};

type StorybookIndex = {
  entries: Record<string, { id: string; title?: string; name?: string; type?: string }>;
};

export const STORYBOOK_ROOT_ID = "#storybook-root";

/** First meaningful product surface inside `#storybook-root` (preferred VRT/a11y target). */
export const PRODUCT_SURFACE_SELECTOR = [
  ".app-shell",
  ".app-canvas",
  ".workspace-chrome",
  ".flow-story",
  ".pattern-story",
  ".catalog-section",
  ".screen-block-skeleton",
  ".kanban",
  ".gantt2",
  ".gantt2__shell",
  "[class*='gantt2']",
  ".rmatrix",
  ".illu-state",
  ".empty-state",
  ".error-state",
  ".forbidden-state",
  ".loading-state",
  "[role='table']"
].join(", ");

/** Selectors that must not appear inside the product screenshot/axe target. */
export const STORYBOOK_CHROME_SELECTORS = [
  "#storybook-explorer-tree",
  "#storybook-explorer-menu",
  "#storybook-preview-wrapper",
  "#storybook-preview-iframe",
  ".sb-bar",
  ".sb-addon-panel",
  ".sbdocs",
  ".sb-showmain",
  ".sb-preparing-story",
  ".sb-preparing-docs",
  ".sb-errordisplay",
  ".sb-nopreview",
  ".sb-unstyled"
] as const;

export const STORYBOOK_CHROME_TAB_NAMES = /^(Controls|Actions|Accessibility|Interactions)$/i;

const ERROR_MARKERS = [
  "Something went wrong",
  "Error fetching `/index.json`",
  "failed to render properly",
  "Couldn't find story matching id",
  "Couldn't render story",
  "No Preview",
  "Storybook Error",
  "Importing a module script failed",
  "Found multiple elements",
  "TestingLibraryElementError",
  "Unable to find an element",
  "The story failed to render"
] as const;

/** Isolated story canvas (no Storybook manager/explorer). */
export type StoryPreview = {
  page: Page;
  root: Locator;
};

export function loadVrtStories(webRoot = process.cwd()): VrtStoryEntry[] {
  const index = loadStorybookIndex(webRoot);

  return Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .filter((entry) => VRT_STORY_ID_PREFIXES.some((prefix) => entry.id.startsWith(prefix)))
    .map((entry) => ({
      id: entry.id,
      title: entry.name ? `${entry.title ?? ""}/${entry.name}`.replace(/^\//, "") : entry.id,
      section: VRT_STORY_ID_PREFIXES.find((prefix) => entry.id.startsWith(prefix))?.replace(/-$/, "") ?? "unknown"
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function loadStorybookIndex(webRoot: string): StorybookIndex {
  const indexPath = join(webRoot, "storybook-static/index.json");
  if (existsSync(indexPath)) {
    return JSON.parse(readFileSync(indexPath, "utf8")) as StorybookIndex;
  }
  throw new Error(
    `Storybook static index not found: ${indexPath}. Run pnpm --filter @kiss-pm/web build-storybook before VRT/a11y gates.`
  );
}

/** Story-only iframe path — resolved against Playwright `use.baseURL` (static serve, no manager). */
export function storyUrl(storyId: string): string {
  const params = new URLSearchParams({ id: storyId, viewMode: "story" });
  return `/iframe.html?${params.toString()}`;
}

const STORY_READY_RULES: ReadonlyArray<{ match: (storyId: string) => boolean; selector: string }> = [
  {
    match: (id) => id.startsWith("widgets-gantt-"),
    selector: "[aria-label^='Диаграмма Ганта']"
  },
  {
    match: (id) => id.startsWith("widgets-funnel-") || id.includes("сделки--deals"),
    selector: ".kanban--funnel"
  },
  { match: (id) => id === "patterns-формы--single", selector: ".form-grid--single" }
];

/** Story-specific readiness gate — avoids polling `#storybook-root` text for heavy widgets. */
export async function waitForStoryReady(page: Page, root: Locator, storyId: string): Promise<void> {
  const rule = STORY_READY_RULES.find((entry) => entry.match(storyId));
  if (!rule) {
    await waitForProductContent(page, root);
    return;
  }

  const ready = root.locator(rule.selector).first();
  await ready.waitFor({ state: "visible", timeout: 60_000 });
}

export async function gotoStory(page: Page, storyId: string): Promise<StoryPreview> {
  await page.goto(storyUrl(storyId), { waitUntil: "domcontentloaded", timeout: 120_000 });
  const root = page.locator(STORYBOOK_ROOT_ID);
  await root.waitFor({ state: "attached", timeout: 60_000 });
  await page.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
  await waitForStoryReady(page, root, storyId);
  return { page, root };
}

/** Waits until `#storybook-root` shows real product UI, not Storybook error/empty shell. */
export async function waitForProductContent(page: Page, root: Locator): Promise<void> {
  await root.waitFor({ state: "attached", timeout: 120_000 });

  for (let i = 0; i < 80; i += 1) {
    const text = await root.innerText().catch(() => "");
    const hasError = ERROR_MARKERS.some((marker) => text.includes(marker));
    const surfaceCount = await root.locator(PRODUCT_SURFACE_SELECTOR).count();
    const hasContent = text.trim().length > 8;

    if (!hasError && (surfaceCount > 0 || hasContent)) {
      if (surfaceCount > 0) {
        await root
          .locator(PRODUCT_SURFACE_SELECTOR)
          .first()
          .waitFor({ state: "visible", timeout: 10_000 })
          .catch(() => undefined);
      }
      return;
    }
    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for product content inside #storybook-root");
}

/**
 * Resolves the VRT/a11y capture target: first visible product surface in `#storybook-root`,
 * otherwise `#storybook-root` itself (never the document `body` wrapper).
 */
export async function resolveProductRoot(preview: StoryPreview): Promise<Locator> {
  const { root } = preview;
  await root.waitFor({ state: "visible", timeout: 120_000 });

  const surfaces = root.locator(PRODUCT_SURFACE_SELECTOR);
  const count = await surfaces.count();
  let best: Locator = root;
  let bestArea = 0;

  for (let i = 0; i < count; i += 1) {
    const candidate = surfaces.nth(i);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const box = await candidate.boundingBox();
    const area = (box?.width ?? 0) * (box?.height ?? 0);
    if (area > bestArea) {
      bestArea = area;
      best = candidate;
    }
  }

  if (bestArea > 0) return best;
  return root;
}

/** axe `include` chain scoped to the isolated story canvas. */
export async function productRootAxeInclude(preview: StoryPreview): Promise<string[]> {
  const target = await resolveProductRoot(preview);
  const innerSelector = await target.evaluate((el, rootId) => {
    const storyRoot = el.closest(rootId);
    if (!storyRoot || el === storyRoot) return null;
    if (el.id) return `#${el.id}`;
    for (const className of el.classList) {
      if (className && !className.startsWith("sb-")) return `.${className}`;
    }
    return null;
  }, STORYBOOK_ROOT_ID);

  const chain = [STORYBOOK_ROOT_ID];
  if (innerSelector && innerSelector !== STORYBOOK_ROOT_ID) {
    chain.push(innerSelector);
  }
  return chain;
}

/** Hard gate: target must be product canvas inside `#storybook-root`, not Storybook chrome or error UI. */
export async function assertNoStorybookChrome(preview: StoryPreview, target: Locator): Promise<void> {
  const { page, root } = preview;

  const insideRoot = await target.evaluate(
    (el, rootId) => !!el.closest(rootId),
    STORYBOOK_ROOT_ID
  );
  expect(insideRoot, "target must be inside #storybook-root").toBe(true);

  for (const selector of STORYBOOK_CHROME_SELECTORS) {
    expect(
      await target.locator(selector).count(),
      `Storybook chrome leaked into product target: ${selector}`
    ).toBe(0);
  }

  expect(await target.getByRole("tab", { name: STORYBOOK_CHROME_TAB_NAMES }).count()).toBe(0);

  const text = (await target.innerText()).trim();
  expect(text.length).toBeGreaterThan(8);
  for (const marker of ERROR_MARKERS) {
    expect(text, `Storybook error UI in product target: ${marker}`).not.toContain(marker);
  }

  const box = await target.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(120);
  expect(box?.height ?? 0).toBeGreaterThan(24);

  // Isolated iframe.html must not include manager/explorer at page level.
  for (const selector of ["#storybook-explorer-tree", ".sb-bar", "#storybook-preview-iframe"] as const) {
    expect(await page.locator(selector).count(), `page-level Storybook chrome: ${selector}`).toBe(0);
  }

  expect(await root.count()).toBe(1);
}

export async function assertStoryRendered(preview: StoryPreview): Promise<void> {
  const target = await resolveProductRoot(preview);
  await assertNoStorybookChrome(preview, target);
}

/** DOM identity of the resolved VRT/a11y capture target (for harness evidence). */
export async function describeProductTarget(target: Locator): Promise<{
  targetId: string | null;
  targetClass: string | null;
  targetTag: string;
  usedStorybookRootFallback: boolean;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}> {
  return target.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return {
      targetId: el.id || null,
      targetClass: el.className && typeof el.className === "string" ? el.className : null,
      targetTag: el.tagName.toLowerCase(),
      usedStorybookRootFallback: el.id === "storybook-root",
      boundingBox:
        box.width > 0 && box.height > 0
          ? { x: box.x, y: box.y, width: box.width, height: box.height }
          : null
    };
  });
}

/** Hard gate + auditable record for harness representative stories. */
export async function auditHarnessProductTarget(
  preview: StoryPreview,
  storyId: string
): Promise<HarnessTargetRecord> {
  const target = await resolveProductRoot(preview);
  const isDocumentBody = await target.evaluate((el) => el === document.body);
  expect(isDocumentBody, "document body must not be used as the product capture target").toBe(false);
  await assertNoStorybookChrome(preview, target);

  const identity = await describeProductTarget(target);
  expect(identity.boundingBox?.width ?? 0).toBeGreaterThan(120);
  expect(identity.boundingBox?.height ?? 0).toBeGreaterThan(24);

  return {
    storyId,
    ...identity,
    storybookChromeFound: false
  };
}

export function harnessTargetsPath(webRoot = process.cwd()): string {
  return (
    process.env.STORYBOOK_VRT_TARGETS_PATH ??
    join(webRoot, ".storybook-verify-tmp/storybook-vrt-targets.json")
  );
}

export function writeHarnessTargetsArtifact(
  stories: HarnessTargetRecord[],
  webRoot = process.cwd()
): HarnessTargetsArtifact {
  const artifact: HarnessTargetsArtifact = {
    generatedAt: new Date().toISOString(),
    port: process.env.STORYBOOK_CONTRACT_PORT ? Number(process.env.STORYBOOK_CONTRACT_PORT) : null,
    stories,
    pass: true
  };
  const path = harnessTargetsPath(webRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return artifact;
}
