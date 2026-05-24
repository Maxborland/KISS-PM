import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const catalogSrc = readFileSync(join(root, "src/stories/catalog/ComponentCatalog.stories.tsx"), "utf8");

const staticChecks = {
  importsCardPanel: catalogSrc.includes('from "@/components/domain/card-panel"'),
  importsDataTable: catalogSrc.includes('from "@/components/domain/data-table"'),
  noShadcnCardImport: !/from "@\/components\/ui\/card"/.test(catalogSrc),
  noShadcnTableImport: !/from "@\/components\/ui\/table"/.test(catalogSrc),
  usesCardPanelJsx: /<CardPanel[\s>]/.test(catalogSrc),
  usesDataTableJsx: /<DataTable[\s>]/.test(catalogSrc)
};

const port = process.env.SB_PORT ?? "6031";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/?path=/story/catalog-all-components--for-approval&viewMode=story`, {
  waitUntil: "networkidle",
  timeout: 120000
});
const frame = page.frameLocator("#storybook-preview-iframe");
await frame.locator("body").waitFor({ timeout: 60000 });
await frame.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 120000 }).catch(() => undefined);
await frame.locator(".card").first().waitFor({ timeout: 120000 });
const cardCount = await frame.locator(".card").count();
const tableWrapCount = await frame.locator(".table-wrap").count();
const shadcnTableCount = await frame.locator('[data-slot="table"]').count();
await frame.locator("body").screenshot({ path: join(outDir, "batch13b-catalog-domain.png") });
await browser.close();

const staticPass = Object.values(staticChecks).every(Boolean);
const domPass = cardCount >= 1 && tableWrapCount >= 1 && shadcnTableCount === 0;

const audit = {
  batch: "13b",
  date: "2026-05-24",
  staticChecks,
  staticPass,
  dom: { cardCount, tableWrapCount, shadcnTableCount },
  domPass,
  pass: staticPass && domPass,
  evidencePng: ".storybook-verify-tmp/batch13b-catalog-domain.png"
};

writeFileSync(join(outDir, "batch13b-catalog-domain-evidence.json"), JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));
if (!audit.pass) process.exit(1);
