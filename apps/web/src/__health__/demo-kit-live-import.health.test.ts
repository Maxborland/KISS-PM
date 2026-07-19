import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// CWD-независимо: корень apps/web от расположения теста (как prototype-gate/design-v3).
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(webRoot, "src");
const appRoot = join(srcRoot, "app");

const rel = (f: string) => relative(srcRoot, f).replace(/\\/g, "/");

// Кандидаты файлов модуля для одного специфайра (без явного расширения).
function resolveModule(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(srcRoot, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules / @kiss-pm/* / next / react и т.п. — вне графа src

  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx")
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

// Статические `import ... from "X"` и `export ... from "X"` — вытаскиваем специфайры.
const SPEC_RE = /(?:import|export)[^"']*?from\s*["']([^"']+)["']/g;
function importSpecs(source: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = SPEC_RE.exec(source)) !== null) out.push(m[1]!);
  return out;
}

// Импортирует ли файл именованный demoAction из @/views/lib/demo?
const DEMO_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*["']@\/views\/lib\/demo["']/g;
function importsDemoAction(source: string): boolean {
  let m: RegExpExecArray | null;
  DEMO_IMPORT_RE.lastIndex = 0;
  while ((m = DEMO_IMPORT_RE.exec(source)) !== null) {
    if (/\bdemoAction\b/.test(m[1]!)) return true;
  }
  return false;
}

// Все файлы-энтрипойнты под src/app (кроме сторис/тестов).
function appEntrypoints(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...appEntrypoints(p));
      continue;
    }
    if ((name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".stories.tsx") && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Д17 (guard импортов, честность блока 12): demoAction — storybook/демо-affordance
 * («Демо-прототип: … подключится к рабочему приложению»). На живых прод-роутах под
 * src/app такой текст врёт (это и есть рабочее приложение), поэтому demoAction обязан
 * быть НЕДОСТИЖИМ из графа импортов app/. Тест обходит граф от каждого файла src/app
 * по @/ и относительным импортам и падает, если какой-либо достижимый прод-файл
 * (не *.stories/*.test) импортирует demoAction. Живые поверхности используют реальный
 * контракт или честный empty-state/роадмап без псевдо-контролов.
 */
describe("demo-kit live-import guard", () => {
  it("demoAction недостижим из графа импортов src/app", () => {
    const visited = new Set<string>();
    const offenders: string[] = [];
    const queue = appEntrypoints(appRoot);

    while (queue.length > 0) {
      const file = queue.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      // Сторис/тесты — демо-контекст, не часть прод-графа.
      if (file.endsWith(".stories.tsx") || file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;

      const source = readFileSync(file, "utf8");
      if (importsDemoAction(source)) offenders.push(rel(file));

      for (const spec of importSpecs(source)) {
        const resolved = resolveModule(spec, file);
        if (resolved && !visited.has(resolved)) queue.push(resolved);
      }
    }

    expect(
      offenders,
      `demoAction (storybook-only) достижим из src/app — на живом роуте плашка «демо подключится к рабочему приложению» врёт:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
