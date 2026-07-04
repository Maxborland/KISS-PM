import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(webRoot, "src");

const productRoots = [join(srcRoot, "app"), join(srcRoot, "delivery")];
const storyOnlyFixtures = new Set(["delivery/resources/portfolio-resources.tsx"]);
const mockBackendModuleReferences = [
  /import\s+(?:type\s+)?[\s\S]*?\sfrom\s+["'][^"']*mock-[^"']*-backend["']/g,
  /import\s+["'][^"']*mock-[^"']*-backend["']/g,
  /import\s*\(\s*["'][^"']*mock-[^"']*-backend["']\s*\)/g,
  /export\s+(?:type\s+)?[\s\S]*?\sfrom\s+["'][^"']*mock-[^"']*-backend["']/g
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...sourceFiles(p));
      continue;
    }
    if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function rel(file: string): string {
  return relative(srcRoot, file).replace(/\\/g, "/");
}

function isFixture(file: string): boolean {
  const r = rel(file);
  return (
    r.includes("/mock-") ||
    r.endsWith(".test.ts") ||
    r.endsWith(".test.tsx") ||
    r.endsWith(".stories.ts") ||
    r.endsWith(".stories.tsx") ||
    r.endsWith(".demo.ts") ||
    r.endsWith(".demo.tsx") ||
    storyOnlyFixtures.has(r)
  );
}

function mockBackendReferences(source: string): string[] {
  return mockBackendModuleReferences.flatMap((pattern) => source.match(pattern) ?? []);
}

describe("production runtime does not import mock backends", () => {
  const files = productRoots.flatMap(sourceFiles).filter((file) => !isFixture(file));

  it("keeps app/delivery routes, hooks and surfaces off mock backend modules", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const matches = mockBackendReferences(readFileSync(file, "utf8"));
      if (matches.length > 0) offenders.push(`${rel(file)}: ${[...new Set(matches)].join(" | ")}`);
    }

    expect(offenders, `mock backend imports belong in tests/stories/demo fixtures:\n${offenders.join("\n")}`).toEqual([]);
  });
});