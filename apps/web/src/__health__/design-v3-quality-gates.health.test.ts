import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { contrastBadge, contrastRatio } from "@/stories/foundations/contrast";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkTsx(full, acc);
    } else if (entry.name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

const SCAN_ROOTS = [
  "src/app",
  "src/features",
  "src/views",
  "src/shell",
  "src/widgets",
  "src/components"
].map((p) => join(webRoot, p));

describe("design-v3 quality gates (Phase 9 lockdown)", () => {
  it("defines density tier tokens in tokens.css", () => {
    const tokens = read("src/styles/tokens.css");
    for (const token of ["--row-h-ultra", "--row-h-compact", "--row-h-cozy", "--row-h:"]) {
      expect(tokens).toContain(token);
    }
  });

  it("defines depth tier shadow tokens in tokens.css", () => {
    const tokens = read("src/styles/tokens.css");
    for (const token of ["--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-floating"]) {
      expect(tokens).toContain(token);
    }
  });

  it("meets AA contrast for core text on canvas and panel", () => {
    const pairs: Array<[string, string, string]> = [
      ["#0f172a", "#eef0f4", "text on canvas"],
      ["#0f172a", "#ffffff", "text on panel"],
      ["#64748b", "#ffffff", "muted on panel"]
    ];
    for (const [fg, bg, label] of pairs) {
      const ratio = contrastRatio(fg, bg);
      expect(contrastBadge(ratio), label).not.toBe("—");
    }
  });

  it("keeps inline style / hex violations within frozen Phase 9 allowlist", () => {
    const offenders: string[] = [];
    const hexRe = /#[0-9a-fA-F]{3,8}\b/;
    const inlineStyleRe = /\bstyle=\{\{/;

    for (const root of SCAN_ROOTS) {
      if (!existsSync(root)) continue;
      for (const file of walkTsx(root)) {
        const rel = file.slice(webRoot.length + 1).replace(/\\/g, "/");
        const source = readFileSync(file, "utf8");
        if (inlineStyleRe.test(source)) offenders.push(`${rel}: inline style={{`);
        if (hexRe.test(source)) offenders.push(`${rel}: raw hex literal`);
      }
    }

    const allowlist = new Set([
      "src/widgets/gantt/gantt-chart-bar.tsx: inline style={{",
      "src/widgets/gantt/gantt-context-menu.tsx: inline style={{",
      "src/widgets/gantt/gantt-view.tsx: inline style={{",
      "src/widgets/resource-matrix/resource-matrix.tsx: inline style={{",
      "src/components/domain/capacity-bar.tsx: inline style={{",
      "src/components/domain/gantt-bar-demo.tsx: inline style={{",
      "src/components/ui/badge.tsx: raw hex literal",
      "src/components/ui/button.tsx: raw hex literal",
      "src/components/ui/progress-bar.tsx: inline style={{",
      "src/components/ui/sheet.tsx: inline style={{"
    ]);

    const unexpected = offenders.filter((o) => !allowlist.has(o));
    const resolved = [...allowlist].filter((o) => !offenders.includes(o));
    expect(unexpected, `new violations:\n${unexpected.join("\n")}`).toEqual([]);
    expect(resolved, `remove from allowlist:\n${resolved.join("\n")}`).toEqual([]);
    expect(offenders.length).toBeLessThanOrEqual(allowlist.size);
  });

  it("has no inline style or raw hex in views and app layers", () => {
    const strictRoots = [join(webRoot, "src/views"), join(webRoot, "src/app")].filter(existsSync);
    const hexRe = /#[0-9a-fA-F]{3,8}\b/;
    const inlineStyleRe = /\bstyle=\{\{/;
    const offenders: string[] = [];

    for (const root of strictRoots) {
      for (const file of walkTsx(root)) {
        const rel = file.slice(webRoot.length + 1).replace(/\\/g, "/");
        const source = readFileSync(file, "utf8");
        if (inlineStyleRe.test(source)) offenders.push(`${rel}: inline style`);
        if (hexRe.test(source)) offenders.push(`${rel}: hex`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps Storybook static bundle within budget after build-storybook", () => {
    const assetsDir = join(webRoot, "storybook-static/assets");
    const files = readdirSync(assetsDir).filter((name) => name.endsWith(".js"));
    const largestKb = Math.max(
      ...files.map((name) => statSync(join(assetsDir, name)).size / 1024)
    );
    expect(largestKb).toBeLessThan(950);
  });

  it("ships Playwright VRT + a11y specs for Storybook", () => {
    expect(read("tests/e2e/storybook-vrt.spec.ts")).toContain("@vrt");
    expect(read("tests/e2e/storybook-a11y.spec.ts")).toContain("@a11y");
    expect(read("tests/e2e/storybook-vrt-utils.ts")).toContain("VRT_STORY_ID_PREFIXES");
  });
});
