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

function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...cssFiles(p));
      continue;
    }
    if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

/** Файлы-владельцы токенов: единственное место, где живут hex-значения и :root. */
const TOKEN_OWNERS = new Set(["styles/tokens.css", "styles/tokens.planning.css"]);

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

  // ---- CSS-слой: ratchet-гейты (убывать можно, расти нельзя) ----
  const allCss = cssFiles(srcRoot);

  it("defines :root only in the token owner files", () => {
    const offenders = allCss
      .filter((f) => !TOKEN_OWNERS.has(rel(f)))
      // Определение токен-блока (`:root {` / `:root,` — в т.ч. с отступом внутри @layer),
      // но не селекторы-квалификаторы вида `:root:not(...)` (reduced-motion гарды).
      .filter((f) => /^\s*:root\s*[{,]/m.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders, `новые :root вне styles/tokens*.css запрещены — токены живут в одном месте:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("does not grow raw hex literals in the CSS layer (ratchet)", () => {
    // Baseline 2026-07-12 (унификация владельца токенов). Новые цвета — только токеном
    // в styles/tokens.css. Уменьшение baseline при миграции файла — ожидаемо и желательно.
    const HEX_BASELINE: Record<string, number> = {
      "app/globals.css": 15, // dark-map поверхностей до PR11
      "styles/bem.css": 38,
      "styles/bem-supplement.css": 12,
      "styles/kiss-v4.css": 2, // #ffffff внутри color-mix gantt-баров
      "styles/widgets/gantt.css": 9,
      "styles/widgets/landing-agent-demo.css": 18, // маркетинговый остров, де-айленд в PR5
      "styles/widgets/resource-matrix.css": 15,
    };
    const offenders: string[] = [];
    for (const f of allCss) {
      const key = rel(f);
      if (TOKEN_OWNERS.has(key)) continue;
      const count = (readFileSync(f, "utf8").match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
      const limit = HEX_BASELINE[key] ?? 0;
      if (count > limit) offenders.push(`${key}: hex ${count} > baseline ${limit}`);
    }
    expect(offenders, `raw hex в CSS-слое вырос — новые цвета только через var(--*) из tokens.css:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("does not grow literal 10-12px font sizes in the CSS layer (ratchet)", () => {
    const FS_BASELINE: Record<string, number> = {
      "styles/bem.css": 11,
      "styles/bem-supplement.css": 6,
      "styles/kiss-v4.css": 1, // .msgrid td — документированное техническое исключение
      "styles/widgets/gantt.css": 7,
      "styles/widgets/landing-agent-demo.css": 1,
      "styles/widgets/resource-matrix.css": 6,
    };
    const offenders: string[] = [];
    for (const f of allCss) {
      const key = rel(f);
      const count = (readFileSync(f, "utf8").match(/font-size:\s*1[0-2]px/g) ?? []).length;
      const limit = FS_BASELINE[key] ?? 0;
      if (count > limit) offenders.push(`${key}: font-size 10-12px ${count} > baseline ${limit}`);
    }
    expect(offenders, `литеральные 10-12px выросли — используйте var(--text-2xs|xs|sm):\n${offenders.join("\n")}`).toEqual([]);
  });

  it("freezes the BEM layer (no new top-level classes)", () => {
    // Форвард-путь — components/ui + components/domain (AGENTS.md §10, DESIGN.md).
    // BEM-слой заморожен: правки существующих классов допустимы, новые классы — нет.
    const BEM_BASELINE: Record<string, number> = {
      "styles/bem.css": 343,
      "styles/bem-supplement.css": 123,
    };
    const offenders: string[] = [];
    for (const [file, limit] of Object.entries(BEM_BASELINE)) {
      const css = readFileSync(join(srcRoot, file), "utf8");
      const classes = new Set<string>();
      for (const m of css.matchAll(/^\.([a-zA-Z][\w-]*)/gm)) {
        if (m[1]) classes.add(m[1]);
      }
      if (classes.size > limit) offenders.push(`${file}: ${classes.size} top-level классов > baseline ${limit}`);
    }
    expect(offenders, `BEM-слой заморожен — новые классы в components/ui|domain:\n${offenders.join("\n")}`).toEqual([]);
  });
});
