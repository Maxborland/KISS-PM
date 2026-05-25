/**
 * V-G evidence — Storybook dev (not static serve).
 * Gantt captures scroll .gantt2 so chart column / bars are in viewport.
 * Run from apps/web: node ../../docs/design-review/scripts/capture-evidence-visual-v-g.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const evidenceDir = join(scriptDir, "../evidence/visual-v-g-2026-05-24");
const port = Number(process.env.SB_DEV_PORT ?? "6006");
const base = `http://127.0.0.1:${port}`;

const SCREEN_STORIES = [
  { id: "views-screens--task-card", file: "audit-views-screens-task-card.png", kind: "screen" },
  { id: "views-screens--deals", file: "audit-views-screens-deals.png", kind: "screen" },
  { id: "views-screens--dashboard", file: "audit-views-screens-dashboard.png", kind: "screen" }
];

const GANTT_ZOOM = [
  {
    zoom: "day",
    expectedDayW: "28px",
    tableFile: "audit-views-screens-gantt-table.png",
    chartFile: "audit-views-screens-gantt-chart.png",
    legacyFullFile: "audit-views-screens-gantt.png"
  },
  {
    zoom: "month",
    expectedDayW: "12px",
    tableFile: null,
    chartFile: "audit-views-screens-gantt-chart-zoom-month.png",
    legacyFullFile: "audit-views-screens-gantt-zoom-month.png"
  }
];

const GANTT_STORY_ID = "views-screens--project-gantt";
const MIN_BYTES_SCREEN = 20_000;
const MIN_BYTES_GANTT_CHART = 10_000;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 200;

mkdirSync(evidenceDir, { recursive: true });

async function waitForStory(frame, kind) {
  await frame.locator("body").waitFor({ timeout: 120_000 });
  await frame.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => undefined);
  await frame.locator(".sb-loader").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => undefined);
  if (kind.startsWith("gantt") || kind === "gantt-setup") {
    await frame.locator(".gantt2").waitFor({ timeout: 120_000 });
    await frame.locator(".page-intro__title").waitFor({ timeout: 60_000 });
  } else {
    await frame.locator(".page-intro__title").waitFor({ timeout: 120_000 });
  }
}

async function readPngMeta(path) {
  const { readFileSync } = await import("node:fs");
  const buf = readFileSync(path);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) {
    return { width: 0, height: 0, bytes: buf.length, valid: false };
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: buf.length,
    valid: true
  };
}

/** DOM + viewport checks for Gantt bars; scrolls chart into view when needed. */
async function prepareGanttChartEvidence(frame) {
  const stats = await frame.locator(".gantt2").evaluate((root) => {
    const bars = [...root.querySelectorAll(".gbar, .gmile")];
    const ganttBarCount = bars.length;
    const nonZeroBars = bars.filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const rootRect = root.getBoundingClientRect();

    const countVisibleInRoot = () => {
      const rr = root.getBoundingClientRect();
      return bars.filter((b) => {
        const r = b.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const hOverlap = r.bottom > rr.top + 2 && r.top < rr.bottom - 2;
        const vIn = r.right > rr.left + 8 && r.left < rr.right - 8;
        return hOverlap && vIn;
      }).length;
    };

    let visibleGanttBarCount = countVisibleInRoot();
    let chartScrolledIntoView = visibleGanttBarCount > 0;
    const scrollBefore = root.scrollLeft;

    if (visibleGanttBarCount === 0 && nonZeroBars.length > 0) {
      const anchor =
        nonZeroBars.find((b) => b.classList.contains("gbar")) ?? nonZeroBars[0];
      const chartCell = anchor.closest(".gantt2__cell--chart");
      if (chartCell) {
        const target =
          chartCell.offsetLeft - Math.max(80, root.clientWidth * 0.35);
        root.scrollLeft = Math.max(
          0,
          Math.min(target, root.scrollWidth - root.clientWidth)
        );
      } else {
        root.scrollLeft = root.scrollWidth - root.clientWidth;
      }
      visibleGanttBarCount = countVisibleInRoot();
      chartScrolledIntoView = visibleGanttBarCount > 0;
    }

    if (visibleGanttBarCount === 0 && root.scrollWidth > root.clientWidth) {
      root.scrollLeft = root.scrollWidth - root.clientWidth;
      visibleGanttBarCount = countVisibleInRoot();
      chartScrolledIntoView = visibleGanttBarCount > 0;
    }

    const dayW = getComputedStyle(root).getPropertyValue("--gantt-day-w").trim();
    const chartDaysVisible = root.querySelectorAll(
      ".gantt2__chart-day, .gantt2__chart-month"
    ).length;
    const chartCellsVisible = [...root.querySelectorAll(".gantt2__cell--chart")].filter(
      (c) => {
        const r = c.getBoundingClientRect();
        const rr = root.getBoundingClientRect();
        return r.width > 0 && r.right > rr.left + 40 && r.left < rr.right - 8;
      }
    ).length;

    return {
      ganttBarCount,
      nonZeroGanttBarCount: nonZeroBars.length,
      visibleGanttBarCount,
      chartScrolledIntoView,
      scrollLeft: root.scrollLeft,
      scrollBefore,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      ganttDayW: dayW,
      chartDaysVisible,
      chartCellsVisible
    };
  });

  if (stats.ganttBarCount === 0) {
    throw new Error("Gantt: no .gbar / .gmile elements in DOM");
  }
  if (stats.nonZeroGanttBarCount === 0) {
    throw new Error("Gantt: all bars have zero bounding box");
  }

  return stats;
}

async function scrollGanttToTable(frame) {
  await frame.locator(".gantt2").evaluate((root) => {
    root.scrollLeft = 0;
  });
}

function evaluateGanttPass(stats, expectedDayW, meta) {
  const nonStub =
    meta.valid &&
    meta.bytes >= MIN_BYTES_GANTT_CHART &&
    meta.width >= MIN_WIDTH &&
    meta.height >= MIN_HEIGHT;

  return (
    nonStub &&
    stats.ganttBarCount > 0 &&
    stats.visibleGanttBarCount > 0 &&
    stats.chartScrolledIntoView === true &&
    stats.ganttDayW === expectedDayW &&
    stats.chartDaysVisible > 0
  );
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const captures = [];

async function captureGanttZoom(zoomSpec) {
  const url = `${base}/?path=/story/${GANTT_STORY_ID}&viewMode=story`;
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  const frame = page.frameLocator("#storybook-preview-iframe");
  await waitForStory(frame, "gantt-setup");

  if (zoomSpec.zoom === "month") {
    await frame.locator('input[name="gantt-zoom"][value="month"]').click({ force: true });
    await frame.locator('[data-gantt-zoom="month"]').waitFor({ timeout: 30_000 });
  } else {
    await frame.locator('[data-gantt-zoom="day"]').waitFor({ timeout: 30_000 });
  }

  if (zoomSpec.tableFile) {
    await scrollGanttToTable(frame);
    const tablePath = join(evidenceDir, zoomSpec.tableFile);
    await frame.locator(".gantt2").screenshot({ path: tablePath });
    const tableMeta = await readPngMeta(tablePath);
    const tableStats = await frame.locator(".gantt2").evaluate((root) => ({
      scrollLeft: root.scrollLeft,
      ganttBarCount: root.querySelectorAll(".gbar, .gmile").length
    }));
    captures.push({
      storyId: GANTT_STORY_ID,
      file: zoomSpec.tableFile,
      kind: `gantt-${zoomSpec.zoom}-table`,
      view: "table-left",
      requiredForSignoff: false,
      ...tableMeta,
      ...tableStats,
      chartScrolledIntoView: false,
      visibleGanttBarCount: 0,
      pass: tableMeta.valid && tableMeta.bytes >= MIN_BYTES_GANTT_CHART && tableStats.scrollLeft === 0
    });
  }

  const stats = await prepareGanttChartEvidence(frame);

  const chartPath = join(evidenceDir, zoomSpec.chartFile);
  await frame.locator(".gantt2").screenshot({ path: chartPath });
  const chartMeta = await readPngMeta(chartPath);
  const chartPass = evaluateGanttPass(stats, zoomSpec.expectedDayW, chartMeta);
  captures.push({
    storyId: GANTT_STORY_ID,
    file: zoomSpec.chartFile,
    kind: `gantt-${zoomSpec.zoom}-chart`,
    view: "chart-scrolled",
    requiredForSignoff: true,
    expectedDayW: zoomSpec.expectedDayW,
    ...stats,
    ...chartMeta,
    nonStub:
      chartMeta.valid &&
      chartMeta.bytes >= MIN_BYTES_GANTT_CHART &&
      chartMeta.width >= MIN_WIDTH &&
      chartMeta.height >= MIN_HEIGHT,
    pass: chartPass
  });

  if (zoomSpec.legacyFullFile) {
    const fullPath = join(evidenceDir, zoomSpec.legacyFullFile);
    await frame.locator("body").screenshot({ path: fullPath });
    const fullMeta = await readPngMeta(fullPath);
    captures.push({
      storyId: GANTT_STORY_ID,
      file: zoomSpec.legacyFullFile,
      kind: `gantt-${zoomSpec.zoom}-full`,
      view: "full-page-after-chart-scroll",
      requiredForSignoff: false,
      note: "Alias path for parity-matrix; sign-off uses *-chart.png with visible bars",
      ...stats,
      ...fullMeta,
      pass: chartPass
    });
  }

  return chartPass;
}

for (const zoomSpec of GANTT_ZOOM) {
  await captureGanttZoom(zoomSpec);
}

for (const story of SCREEN_STORIES) {
  const url = `${base}/?path=/story/${story.id}&viewMode=story`;
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  const frame = page.frameLocator("#storybook-preview-iframe");
  await waitForStory(frame, story.kind);

  const outPath = join(evidenceDir, story.file);
  await frame.locator("body").screenshot({ path: outPath });
  const meta = await readPngMeta(outPath);
  const nonStub =
    meta.valid && meta.bytes >= MIN_BYTES_SCREEN && meta.width >= 800 && meta.height >= 400;

  captures.push({
    storyId: story.id,
    file: story.file,
    kind: story.kind,
    ...meta,
    nonStub,
    pass: nonStub
  });
}

await browser.close();

const manifest = {
  batch: "visual-v-g-signoff-v2",
  capturedAt: new Date().toISOString(),
  storybookMode: "dev",
  port,
  ganttEvidenceNote:
    "Chart PNGs screenshot .gantt2 after horizontal scroll; manifest requires visibleGanttBarCount > 0",
  captures,
  allPass: captures.every((c) => (c.requiredForSignoff === false ? true : c.pass))
};

writeFileSync(join(evidenceDir, "capture-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify(manifest, null, 2));
process.exit(manifest.allPass ? 0 : 1);
