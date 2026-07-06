import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// CWD-независимо: корень apps/web от расположения теста (как design-v3-enforcement).
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
    // Сторис — демо-контекст, там плашки уместны всегда.
    if (name.endsWith(".tsx") && !name.endsWith(".stories.tsx") && !name.endsWith(".test.tsx")) out.push(p);
  }
  return out;
}

const rel = (f: string) => relative(srcRoot, f).replace(/\\/g, "/");

// Маркеры допустимого гейта в пределах окна строк над рендером плашки:
// prototypeNotesEnabled (флаг сборки Storybook/демо) либо mock-режим рантайма (!live / live ?).
const GATE_MARKERS = /prototypeNotesEnabled|!live|live\s*\?/;
const GATE_WINDOW_LINES = 25;

/**
 * Прототип-гейт (BUG-014, G5-10 из UI/UX-loop 2026-07-05): плашки «Прототип»
 * с dev-жаргоном НЕ должны рендериться в прод-сборке. Гейт prototypeNotesEnabled
 * существовал с pre-prod hardening, но подключался вручную и без контроля —
 * на master 56 файлов рендерили плашку, из них загейчено было только 17.
 * Этот тест — статический замок: каждый рендер строки «Прототип/ПРОТОТИП» в TSX
 * обязан находиться под prototypeNotesEnabled либо mock-гейтом (!live) в пределах
 * GATE_WINDOW_LINES строк выше. Новая плашка мимо гейта = красный тест.
 */
describe("prototype-gate enforcement", () => {
  const files = tsxFiles(srcRoot);

  it("каждая плашка «Прототип» в TSX стоит под prototypeNotesEnabled или mock-гейтом", () => {
    const offenders: string[] = [];
    for (const f of files) {
      // Сам модуль гейта — определение, не рендер.
      if (rel(f).includes("views/lib/")) continue;
      const lines = readFileSync(f, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        // Интересуют только JSX-рендеры бейджа (>Прототип< / >ПРОТОТИП…<),
        // а не упоминания слова в комментариях или строках-подсказках.
        if (!/>\s*(Прототип|ПРОТОТИП)/.test(lines[i]!)) continue;
        const from = Math.max(0, i - GATE_WINDOW_LINES);
        const window = lines.slice(from, i + 1).join("\n");
        if (!GATE_MARKERS.test(window)) {
          offenders.push(`${rel(f)}:${i + 1}`);
        }
      }
    }
    expect(
      offenders,
      `плашка «Прототип» рендерится без гейта (prototypeNotesEnabled / !live) — dev-заметки утекут в прод:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
