#!/usr/bin/env node
// Detects "dead" enabled-looking controls in scoped TSX files.
// Heuristic regex scan; not a parser. Designed to fail CI for the
// interaction-remediation batches (B1..B6).

import { readFileSync, readdirSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const DEFAULT_SCOPE = [
  "src/views/blocks/my-work-block.tsx",
  "src/views/blocks/dashboard-bento.tsx",
  "src/widgets/kanban/kanban-board.tsx",
  "src/widgets/kanban/kanban-card.tsx"
];

const argScope = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const scope = argScope.length > 0 ? argScope : DEFAULT_SCOPE;
const scopeSet = new Set(scope.map((p) => p.replace(/\\/g, "/")));

function readFile(rel) {
  try {
    return readFileSync(join(root, rel), "utf8");
  } catch {
    return null;
  }
}

function listTagBlocks(src, tagPattern) {
  // tagPattern matches an opening JSX tag start, e.g. /<Button\b/.
  // Walks character by character to capture balanced JSX attribute brace
  // groups so we can correctly read full `<Tag ...>` headers.
  const out = [];
  const re = new RegExp(tagPattern.source, tagPattern.flags.includes("g") ? tagPattern.flags : `${tagPattern.flags}g`);
  let match;
  while ((match = re.exec(src)) != null) {
    const start = match.index;
    let i = start;
    let depth = 0;
    let inString = null;
    let inExpr = 0;
    while (i < src.length) {
      const ch = src[i];
      if (inString) {
        if (ch === inString && src[i - 1] !== "\\") inString = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
      } else if (ch === "{") {
        inExpr += 1;
        depth += 1;
      } else if (ch === "}") {
        inExpr = Math.max(0, inExpr - 1);
        depth = Math.max(0, depth - 1);
      } else if (ch === ">" && inExpr === 0) {
        out.push({ start, end: i + 1, header: src.slice(start, i + 1) });
        break;
      }
      i += 1;
    }
  }
  return out;
}

function lineOf(src, idx) {
  return src.slice(0, idx).split(/\r?\n/).length;
}

const ELEMENT_RULES = [
  { tag: "Button", rule: "button-no-onClick", checkBody: true },
  { tag: "IconButton", rule: "icon-button-no-onClick", checkBody: false },
  { tag: "DropdownMenuItem", rule: "dropdown-item-no-onSelect", attr: "onSelect" }
];

function findEnabledWithoutHandler(src, tag, attr = "onClick") {
  const blocks = listTagBlocks(src, new RegExp(`<${tag}\\b`));
  const issues = [];
  for (const block of blocks) {
    const header = block.header;
    if (/\bdisabled\b/.test(header)) continue;
    if (/\basChild\b/.test(header)) continue;
    if (new RegExp(`\\b${attr}=`).test(header)) continue;
    // Skip when the element is a slot child of a Radix Trigger asChild
    const before = src.slice(Math.max(0, block.start - 200), block.start);
    if (/Trigger\s+asChild\s*>\s*$/.test(before)) continue;
    issues.push({ line: lineOf(src, block.start), snippet: header.slice(0, 160) });
  }
  return issues;
}

const violations = [];

for (const rel of scope) {
  const src = readFile(rel);
  if (src == null) {
    violations.push({ file: rel, rule: "file-missing" });
    continue;
  }

  for (const rule of ELEMENT_RULES) {
    const attr = rule.attr ?? "onClick";
    const issues = findEnabledWithoutHandler(src, rule.tag, attr);
    for (const issue of issues) {
      violations.push({ file: rel, rule: rule.rule, ...issue });
    }
  }

  // <a href="#"> without aria-disabled
  const anchorBlocks = listTagBlocks(src, /<a\b/);
  for (const block of anchorBlocks) {
    if (/href=["']#["']/.test(block.header) && !/aria-disabled/.test(block.header)) {
      violations.push({
        file: rel,
        rule: "anchor-hash-without-aria-disabled",
        line: lineOf(src, block.start),
        snippet: block.header.slice(0, 160)
      });
    }
  }

  // defaultValue= on <Input> inside <form>
  const inputBlocks = listTagBlocks(src, /<Input\b/);
  for (const block of inputBlocks) {
    if (/defaultValue=/.test(block.header) && /<form\b/.test(src.slice(0, block.start))) {
      violations.push({
        file: rel,
        rule: "input-default-value-in-form",
        line: lineOf(src, block.start),
        snippet: block.header.slice(0, 160)
      });
    }
  }
}

// Cursor:grab in widget CSS not paired with data-dnd-active.
const outOfScope = [];
function scanCursorGrab() {
  const widgetsDir = join(root, "src/styles/widgets");
  let cssFiles = [];
  try {
    cssFiles = readdirSync(widgetsDir)
      .filter((n) => n.endsWith(".css"))
      .map((n) => `src/styles/widgets/${n}`.replace(/\\/g, "/"));
  } catch {
    cssFiles = [];
  }
  cssFiles.push("src/styles/bem.css");
  for (const rel of cssFiles) {
    const src = readFile(rel);
    if (src == null) continue;
    const re = /([.#][\w-]+(?:[^{};\n]*)?\{[^}]*cursor:\s*grab[^}]*\})/g;
    let m;
    while ((m = re.exec(src)) != null) {
      const block = m[1];
      if (/data-dnd-active|data-dragging|--draggable|--grabbing/.test(block)) continue;
      const entry = {
        file: rel,
        rule: "cursor-grab-without-dnd-affordance",
        line: lineOf(src, m.index),
        snippet: block.slice(0, 200)
      };
      if (scopeSet.has(rel)) violations.push(entry);
      else outOfScope.push(entry);
    }
  }
}

scanCursorGrab();

// Stat output by file for an easy "before/after" comparison.
const byFile = {};
for (const v of violations) byFile[v.file] = (byFile[v.file] ?? 0) + 1;

const report = {
  scope,
  scannedAt: new Date().toISOString(),
  pass: violations.length === 0,
  count: violations.length,
  byFile,
  violations,
  outOfScope
};

const outPath = join(outDir, "find-dead-controls-report.json");
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
