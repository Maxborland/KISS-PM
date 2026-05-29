import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { STORYBOOK_APPROVED_ROOTS, extractMetaRoot } from "./storybook-approved-roots";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function walkStoryFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...walkStoryFiles(path));
      continue;
    }
    if (name.endsWith(".stories.tsx")) out.push(path);
  }
  return out;
}

export function collectStorybookRoots(): Set<string> {
  const srcDir = join(webRoot, "src");
  const roots = new Set<string>();
  for (const file of walkStoryFiles(srcDir)) {
    const rel = file.replace(webRoot + "\\", "").replace(webRoot + "/", "").replace(/\\/g, "/");
    const root = extractMetaRoot(read(rel));
    if (root) roots.add(root);
  }
  return roots;
}

describe("Storybook Phase 8 — ровно 8 корневых секций", () => {
  it("exposes only approved sidebar roots", () => {
    const roots = collectStorybookRoots();
    const approved = new Set<string>(STORYBOOK_APPROVED_ROOTS);

    expect([...roots].sort()).toEqual([...approved].sort());
  });

  it("forbids legacy Catalog, UI, Views roots in meta titles", () => {
    const srcDir = join(webRoot, "src");
    const banned: string[] = [];
    for (const file of walkStoryFiles(srcDir)) {
      const rel = file.replace(webRoot + "\\", "").replace(webRoot + "/", "").replace(/\\/g, "/");
      const source = read(rel);
      const root = extractMetaRoot(source);
      if (root === "Catalog" || root === "UI" || root === "Views") {
        banned.push(rel);
      }
    }
    expect(banned, banned.join(", ")).toEqual([]);
  });

  it("preview storySort lists approved roots in order", () => {
    const preview = read(".storybook/preview.tsx");
    for (const root of STORYBOOK_APPROVED_ROOTS) {
      expect(preview).toContain(`"${root}"`);
    }
    expect(preview).not.toMatch(/"Catalog"/);
    expect(preview).not.toMatch(/"Views"/);
    expect(preview).not.toContain('"UI"');
  });

  it("main.ts includes flows, patterns, api-contract globs", () => {
    const main = read(".storybook/main.ts");
    expect(main).toContain("../src/stories/flows/");
    expect(main).toContain("../src/stories/patterns/");
    expect(main).toContain("../src/stories/api-contract/");
  });
});
