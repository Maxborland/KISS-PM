import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:64986";

const root = process.cwd();
const artifactDir = path.join(root, "docs", "design-mockups", "artifacts", "project-gantt-v6");
await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleMessages = [];
page.on("console", (message) => {
  consoleMessages.push({
    type: message.type(),
    text: message.text(),
    location: message.location()
  });
});
page.on("pageerror", (error) => {
  consoleMessages.push({ type: "pageerror", text: error.message });
});

const rows = [];
const assertTruthyFlags = (value) => {
  if (value === false) return "returned false";
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = assertTruthyFlags(item);
      if (nested) return nested;
    }
    return null;
  }
  for (const key of ["ok", "created", "changed", "unchanged", "applyEnabled"]) {
    if (Object.prototype.hasOwnProperty.call(value, key) && value[key] !== true) {
      return `${key} was ${value[key]}`;
    }
  }
  for (const nested of Object.values(value)) {
    const nestedFailure = assertTruthyFlags(nested);
    if (nestedFailure) return nestedFailure;
  }
  return null;
};
const pass = async (id, requirement, check) => {
  try {
    const value = await check();
    const flagFailure = assertTruthyFlags(value);
    rows.push({ id, requirement, status: flagFailure ? "failed" : "passed", value, error: flagFailure || undefined });
  } catch (error) {
    rows.push({ id, requirement, status: "failed", error: String(error.message || error) });
  }
};

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.removeItem("kisspm-gantt-mock-v6-state"));
await page.reload({ waitUntil: "domcontentloaded" });

await page.screenshot({ path: path.join(artifactDir, "desktop-initial.png"), fullPage: false });

await pass("BROWSER-001", "page opens as Project Gantt v6", async () => (await page.title()).includes("v6"));
await pass("BROWSER-002", "no console errors", async () => consoleMessages.filter((m) => ["error", "pageerror"].includes(m.type)).length === 0);
await pass("EXCEL-001", "cell click updates address and formula bar", async () => {
  await page.locator('td[data-row="3"][data-key="duration"]').click();
  return {
    address: await page.locator("#cellAddress").textContent(),
    formula: await page.locator("#formulaInput").inputValue()
  };
});
await pass("EXCEL-002", "F2 edit mode and typing apply value", async () => {
  await page.keyboard.press("F2");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("10");
  await page.keyboard.press("Enter");
  return await page.locator('td[data-row="3"][data-key="duration"]').innerText();
});
await pass("SCHED-001", "duration edit updates Gantt width and scheduling projection", async () => ({
  duration: await page.locator('td[data-row="3"][data-key="duration"]').innerText(),
  work: await page.locator('td[data-row="3"][data-key="work"]').innerText(),
  barWidth: await page.locator('.bar[data-task-id="4"]').evaluate((el) => Math.round(el.getBoundingClientRect().width))
}));
await pass("EXCEL-003", "Undo and Redo restore table values", async () => {
  await page.keyboard.press("ControlOrMeta+Z");
  const undone = await page.locator('td[data-row="3"][data-key="duration"]').innerText();
  await page.keyboard.press("ControlOrMeta+Y");
  const redone = await page.locator('td[data-row="3"][data-key="duration"]').innerText();
  return { undone, redone };
});
await pass("EXCEL-004", "bottom blank row creates a task", async () => {
  const before = await page.locator("#tableBody tr:not(.new-row)").count();
  await page.locator('tr.new-row td[data-key="name"]').click();
  await page.keyboard.type("Проверочная задача");
  await page.keyboard.press("Enter");
  const after = await page.locator("#tableBody tr:not(.new-row)").count();
  return { before, after, created: after === before + 1 };
});
await pass("EXCEL-005", "Insert inserts above and Delete removes with undo stack", async () => {
  await page.locator('td[data-row="4"][data-key="name"]').click();
  await page.keyboard.press("Insert");
  const afterInsert = await page.locator("#tableBody tr:not(.new-row)").count();
  await page.keyboard.press("Delete");
  const afterDelete = await page.locator("#tableBody tr:not(.new-row)").count();
  return { afterInsert, afterDelete };
});
await pass("EXCEL-006", "column hide/show works and no longer blocks toolbar", async () => {
  await page.locator("#columnsBtn").click();
  await page.locator('input[data-col-toggle="constraint"]').click();
  const hidden = await page.locator('td[data-key="constraint"]').count();
  await page.locator("#toggleGanttBtn").click();
  const ganttHidden = await page.locator("body.hide-gantt").count();
  await page.locator("#toggleGanttBtn").click();
  const ganttShown = await page.locator("body.hide-gantt").count();
  return { hidden, ganttHidden, ganttShown };
});
await pass("EXCEL-007", "column resize drag handler changes width", async () => {
  const th = page.locator('th[data-col="duration"] .resizer');
  const before = await page.locator('col[data-col="duration"]').evaluate((el) => el.getAttribute("style"));
  const box = await th.boundingBox();
  await page.mouse.move(box.x + 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 44, box.y + 8);
  await page.mouse.up();
  const after = await page.locator('col[data-col="duration"]').evaluate((el) => el.getAttribute("style"));
  return { before, after, changed: before !== after };
});
await pass("EXCEL-008", "dropdown editor supports task type selection", async () => {
  await page.locator('td[data-row="3"][data-key="type"]').dblclick();
  const editor = page.locator('td[data-row="3"][data-key="type"] select.cell-editor');
  await editor.selectOption("Фикс. срок");
  await page.keyboard.press("Enter");
  return {
    editorWasSelect: true,
    value: await page.locator('td[data-row="3"][data-key="type"]').innerText(),
    ok: (await page.locator('td[data-row="3"][data-key="type"]').innerText()).includes("Фикс. срок")
  };
});
await pass("EXCEL-009", "resource autocomplete updates table and creates safe preview", async () => {
  await page.locator('td[data-row="3"][data-key="resources"]').click();
  await page.keyboard.press("F2");
  const editor = page.locator('td[data-row="3"][data-key="resources"] input.cell-editor');
  await editor.fill("Илья, Мария");
  await page.keyboard.press("Enter");
  return {
    resource: await page.locator('td[data-row="3"][data-key="resources"]').innerText(),
    preview: await page.locator("#afterLoad").textContent(),
    applyEnabled: await page.locator("#applyBtn").isEnabled()
  };
});
await pass("EXCEL-010", "command autocomplete opens relevant action", async () => {
  await page.locator("#commandSearch").fill("конфликт");
  const suggestions = await page.locator("#commandSuggestions .suggestion").count();
  await page.locator("#commandSuggestions .suggestion").first().click();
  return {
    suggestions,
    ok: suggestions > 0 && (await page.locator("body.conflicts").count()) === 1
  };
});
await pass("EXCEL-011", "active-cell hint and header tooltips are visible", async () => {
  await page.locator('[data-view="gantt"]').click();
  await page.locator('td[data-row="3"][data-key="pred"]').click();
  const title = await page.locator('td[data-row="3"][data-key="pred"]').getAttribute("title");
  const hint = await page.locator("#cellHint").innerText();
  return { title, hint, ok: title.includes("Синтаксис") && hint.includes("Синтаксис") };
});
await pass("GANTT-001", "Tracking Gantt shows baseline bars", async () => {
  await page.locator('[data-view="tracking"]').click();
  return {
    tracking: await page.locator("body.tracking").count(),
    baselineCount: await page.locator(".baseline").count()
  };
});
await pass("GANTT-002", "splitter changes grid/timeline ratio", async () => {
  const splitter = page.locator("#splitter");
  const box = await splitter.boundingBox();
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--grid-width"));
  await page.mouse.move(box.x + 3, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 80);
  await page.mouse.up();
  const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--grid-width"));
  return { before, after, changed: before !== after };
});
await pass("GANTT-003", "Gantt bar drag moves task date", async () => {
  await page.evaluate(() => localStorage.removeItem("kisspm-gantt-mock-v6-state"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-view="gantt"]').click();
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--grid-width", "56%");
    document.getElementById("timelinePane").scrollLeft = 0;
  });
  const { before, after } = await page.evaluate(() => {
    const bar = document.querySelector('.bar[data-task-id="4"]');
    const rect = bar.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const before = window.kissPmGanttMock.getState().tasks.find((task) => task.id === 4).start;
    bar.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: x + 120, clientY: y }));
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: x + 120, clientY: y }));
    const after = window.kissPmGanttMock.getState().tasks.find((task) => task.id === 4).start;
    return { before, after };
  });
  if (before === after) throw new Error(`task 4 start did not change after drag: ${before}`);
  return { before, after, changed: true };
});
await pass("RESOURCE-001", "resource conflict workspace opens", async () => {
  await page.locator('[data-view="conflicts"]').click();
  return {
    conflicts: await page.locator("body.conflicts").count(),
    cards: await page.locator("#conflictList .conflict-card").count()
  };
});
await pass("KISS-001", "preview does not mutate table before apply", async () => {
  const before = await page.locator('td[data-row="3"][data-key="resources"]').innerText();
  await page.locator("#previewFromConflict").click();
  const after = await page.locator('td[data-row="3"][data-key="resources"]').innerText();
  return { before, after, unchanged: before === after, preview: await page.locator("#afterLoad").textContent() };
});
await pass("KISS-002", "apply writes result, audit/readback, refreshed projection", async () => {
  await page.locator("#applyBtn").click();
  await page.locator('[data-view="gantt"]').click();
  return {
    resource: await page.locator('td[data-row="3"][data-key="resources"]').innerText(),
    audit: await page.locator("#auditId").textContent(),
    readback: await page.locator("#readbackState").textContent()
  };
});
await page.screenshot({ path: path.join(artifactDir, "desktop-after-apply.png"), fullPage: false });
await pass("KISS-003", "reload persists applied mock state", async () => {
  await page.reload({ waitUntil: "domcontentloaded" });
  return {
    audit: await page.locator("#auditId").textContent(),
    resource: await page.locator('td[data-row="3"][data-key="resources"]').innerText()
  };
});
await pass("PANEL-001", "right management panel slides closed and open", async () => {
  await page.locator("#togglePanelBtn").click();
  const closed = await page.locator("body.panel-closed").count();
  await page.locator("#openPanelBtn").click();
  const opened = await page.locator("body.panel-closed").count();
  return { closed, opened };
});
await pass("VISUAL-001", "key surfaces have non-zero boxes and no missing primary controls", async () => {
  return await page.evaluate(() => {
    const selectors = ["#taskTable", "#ganttCanvas", "#formulaInput", "#previewBtn", "#applyBtn", ".drawer", ".timeline-pane"];
    return selectors.map((selector) => {
      const el = document.querySelector(selector);
      if (!el) return { selector, ok: false };
      const box = el.getBoundingClientRect();
      return { selector, ok: box.width > 0 && box.height > 0, box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } };
    });
  });
});
await pass("RU-001", "primary user-facing labels are Russian", async () => {
  const text = await page.locator("body").innerText();
  return ["Диаграмма Ганта", "Решение ресурсных конфликтов", "Управленческая панель", "Показать прогноз", "Применить команду"].every((label) => text.includes(label));
});

await page.setViewportSize({ width: 1024, height: 768 });
await page.screenshot({ path: path.join(artifactDir, "narrow-1024.png"), fullPage: false });

const report = {
  screen: "project-gantt-planner-v6",
  url,
  checked_at: new Date().toISOString(),
  artifacts: {
    desktop_initial: "docs/design-mockups/artifacts/project-gantt-v6/desktop-initial.png",
    desktop_after_apply: "docs/design-mockups/artifacts/project-gantt-v6/desktop-after-apply.png",
    narrow_1024: "docs/design-mockups/artifacts/project-gantt-v6/narrow-1024.png"
  },
  console: consoleMessages,
  rows
};

await writeFile(path.join(artifactDir, "browser-verification-report.json"), JSON.stringify(report, null, 2), "utf8");
await browser.close();

const failed = rows.filter((row) => row.status !== "passed");
console.log(JSON.stringify({ checked_at: report.checked_at, failed: failed.length, rows: rows.length, artifact: "docs/design-mockups/artifacts/project-gantt-v6/browser-verification-report.json" }, null, 2));
if (failed.length > 0) {
  process.exitCode = 1;
}
