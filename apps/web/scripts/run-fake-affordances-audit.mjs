import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const viewsDir = join(root, "src/views");
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

function walkTsx(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walkTsx(path, acc);
    else if (name.endsWith(".tsx")) acc.push(path);
  }
  return acc;
}

const files = walkTsx(viewsDir);
const violations = [];

for (const file of files) {
  const rel = file.slice(root.length + 1).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  if (/<button[^>]*className="segmented__btn"/.test(src) || /<button[^>]*className='segmented__btn'/.test(src)) {
    violations.push({ file: rel, rule: "raw-segmented-button" });
  }
  if (/onChange=\{\(\) => \{\}\}/.test(src)) {
    violations.push({ file: rel, rule: "segmented-noop-onChange" });
  }
}

const chromePath = "src/views/layout/workspace-chrome.tsx";
const chrome = readFileSync(join(root, chromePath), "utf8");
const topbarOk =
  chrome.includes('disabled title="Демо Storybook: экспорт подключится к API"') &&
  chrome.includes('disabled title="Демо Storybook: создание сущности в продукте"');

const audit = {
  batch: "13g",
  date: "2026-05-24",
  fix: "Segmented with useState; disabled WorkspaceChrome export/create; no raw segmented buttons",
  filesScanned: files.length,
  violations,
  workspaceChromeTopbarDisabled: topbarOk,
  pass: violations.length === 0 && topbarOk
};

const outPath = join(outDir, "batch13g-fake-affordances-evidence.json");
writeFileSync(outPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify(audit, null, 2));
process.exit(audit.pass ? 0 : 1);
