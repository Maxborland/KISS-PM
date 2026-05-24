import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { renderSidebarLabelRu } from "../.storybook/sidebarLabelsRu";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const unitCases = [
  { item: { name: "FOUNDATIONS", type: "root" }, expect: "Основы" },
  { item: { name: "Foundations", type: "group" }, expect: "Основы" },
  { item: { name: "Views", type: "group" }, expect: "Представления" },
  { item: { name: "Catalog", type: "group" }, expect: "Каталог" },
  { item: { name: "Colors", type: "group" }, expect: "Цвета" },
  { item: { name: "Button", type: "component" }, expect: "Кнопка" },
  { item: { name: "Docs", type: "docs" }, expect: "Документация" }
];

const unitResults = unitCases.map(({ item, expect }) => {
  const got = renderSidebarLabelRu(item);
  return { ...item, expect, got, pass: got === expect };
});

const port = process.env.SB_PORT ?? "6027";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 120000 });

const sidebar = page.locator("#storybook-explorer-menu");
await sidebar.waitFor({ timeout: 60000 });
const sidebarText = await sidebar.innerText();
await sidebar.screenshot({ path: join(outDir, "batch12-sidebar-ru.png") });

const forbiddenRoots = ["FOUNDATIONS", "Foundations", "Views", "Catalog"];
const forbiddenVisible = forbiddenRoots.filter((en) => {
  const re = new RegExp(`(^|\\n)${en}(\\n|$)`);
  return re.test(sidebarText);
});

await browser.close();

const audit = {
  batch: 12,
  date: "2026-05-24",
  fix: "renderSidebarLabelRu: SIDEBAR_ROOT_RU for type group + root",
  unitResults,
  unitPass: unitResults.every((r) => r.pass),
  sidebarForbiddenRootsVisible: forbiddenVisible,
  sidebarPass: forbiddenVisible.length === 0,
  evidencePng: ".storybook-verify-tmp/batch12-sidebar-ru.png"
};

writeFileSync(join(outDir, "batch12-sidebar-ru-evidence.json"), JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));
if (!audit.unitPass || !audit.sidebarPass) process.exit(1);
