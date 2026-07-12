import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// CWD-независимо: корень apps/web от расположения теста (как storybook-contract.health.test.ts).
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(webRoot, "src");

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...tsxFiles(p));
      continue;
    }
    // Сторис исключаем — это демо/пресеты, где допустимы наглядные литералы.
    if (name.endsWith(".tsx") && !name.endsWith(".stories.tsx")) out.push(p);
  }
  return out;
}

const rel = (f: string) => relative(srcRoot, f).replace(/\\/g, "/");

/**
 * Design-v3 lockdown (AGENTS.md §10) — реальный гейт, фиксирующий унификацию:
 *  - один канонический индиго `:root` (kiss-v4 промоутнут, scope-остров убран);
 *  - в className НЕТ raw-px шрифтов (только --text-* токены);
 *  - в className-arbitrary НЕТ хардкод brand-hex/rgba (только токены/color-mix;
 *    белый/чёрный альфа-инсет допустим как нейтральный).
 * Без этого гейта система дрейфует обратно к «BEM-мешанине» + off-token литералам.
 */
describe("design-v3 enforcement (Phase 16)", () => {
  const files = tsxFiles(srcRoot);

  it("scans a meaningful number of TSX surfaces/primitives", () => {
    expect(files.length).toBeGreaterThan(80);
  });

  it("uses --text-* tokens, not raw px font sizes, in className", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const m = readFileSync(f, "utf8").match(/text-\[\d+px\]/g);
      if (m) offenders.push(`${rel(f)}: ${[...new Set(m)].join(", ")}`);
    }
    expect(offenders, `raw px font sizes — use var(--text-*):\n${offenders.join("\n")}`).toEqual([]);
  });

  it("uses tokens/color-mix, not hardcoded hex/rgba brand colors, in className arbitrary values", () => {
    // Утилита-arbitrary вида bg-[…]/text-[…]/shadow-[…] с brand-hex (#rrggbb) или цветным rgba().
    // Разрешено: белый/чёрный альфа (rgba(255,255,255,…)/rgba(0,0,0,…)) и color-mix(...).
    const re =
      /(?:bg|text|border|ring|fill|stroke|shadow|from|via|to|outline|decoration|divide|accent)-\[[^\]]*(?:#[0-9a-fA-F]{6}|rgba?\(\s*(?!255\s*,\s*255\s*,\s*255)(?!0\s*,\s*0\s*,\s*0)\d)[^\]]*\]/g;
    const offenders: string[] = [];
    for (const f of files) {
      const m = readFileSync(f, "utf8").match(re);
      if (m) offenders.push(`${rel(f)}: ${[...new Set(m)].slice(0, 4).join(" | ")}`);
    }
    expect(offenders, `hardcoded brand hex/rgba — use tokens/color-mix:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("has a single canonical token owner: tokens.css; kiss-v4.css is utilities-only", () => {
    const kissV4 = readFileSync(join(srcRoot, "styles/kiss-v4.css"), "utf8");
    expect(kissV4, "kiss-v4.css must not define tokens — owner is styles/tokens.css").not.toContain(":root");
    expect(kissV4, "kiss-v4 scope island must be gone").not.toContain(".kiss-v4");
    const tokens = readFileSync(join(srcRoot, "styles/tokens.css"), "utf8");
    expect(tokens, "tokens.css must be the :root owner").toContain(":root {");
    expect(tokens, "canonical indigo accent must live in tokens.css").toContain("--accent: #5b5bd6");
    expect(tokens, "--text-2xs micro token must exist").toContain("--text-2xs");
  });
});
