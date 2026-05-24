import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { UI_VARIANT_ITEMS } from "@/stories/ui-variant-presets";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("design-v3 Storybook contract smoke (batch 10–15)", () => {
  it("keeps UI variant presets for every ui/*.stories.tsx stem", () => {
    expect(Object.keys(UI_VARIANT_ITEMS).length).toBeGreaterThanOrEqual(43);
    expect(UI_VARIANT_ITEMS.button.length).toBeGreaterThan(0);
  });

  it("dashboard uses PageIntro instead of welcome-hero title", () => {
    const source = read("src/views/blocks/dashboard-bento.tsx");
    expect(source).toContain("PageIntro");
    expect(source).not.toMatch(/welcome-hero__title/);
  });

  it("deals funnel uses Badge not legacy .badge BEM", () => {
    const source = read("src/views/blocks/deals-block.tsx");
    expect(source).toContain("<Badge");
    expect(source).not.toMatch(/badge badge--soft/);
  });

  it("state screens use bare variant in catalog", () => {
    const source = read("src/views/catalog.ts");
    expect(source).toContain('"state-empty"');
    expect(source).toMatch(/"state-empty":[\s\S]*variant: "bare"/);
  });

  it("catalog story uses domain CardPanel and DataTable", () => {
    const source = read("src/stories/catalog/ComponentCatalog.stories.tsx");
    expect(source).toContain("CardPanel");
    expect(source).toContain("DataTable");
    expect(source).not.toMatch(/from "@\/components\/ui\/card"/);
    expect(source).not.toMatch(/from "@\/components\/ui\/table"/);
  });

  it("views blocks avoid fake segmented and noop onChange (batch 13g)", () => {
    const blockFiles = [
      "src/views/blocks/projects-list-block.tsx",
      "src/views/blocks/deals-block.tsx",
      "src/views/blocks/settings-block.tsx",
      "src/views/blocks/gantt-slice-block.tsx",
      "src/views/blocks/my-work-block.tsx"
    ];
    for (const rel of blockFiles) {
      const source = read(rel);
      expect(source).not.toMatch(/<button[^>]*segmented__btn/);
      expect(source).not.toMatch(/onChange=\{\(\) => \{\}\}/);
      expect(source).toContain("onChange={");
    }
  });

  it("WorkspaceChrome default topbar actions are disabled with reason (batch 13g)", () => {
    const source = read("src/views/layout/workspace-chrome.tsx");
    expect(source).toMatch(/disabled title="Демо Storybook: экспорт подключится к API"/);
    expect(source).toMatch(/disabled title="Демо Storybook: создание сущности в продукте"/);
  });

  it("views have no welcome-hero and blocks use PageIntro (batch 14)", () => {
    const viewsDir = join(webRoot, "src/views");
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (name.endsWith(".tsx")) out.push(p);
      }
      return out;
    };
    for (const file of walk(viewsDir)) {
      const rel = file.replace(webRoot + "/", "").replace(/\\/g, "/");
      const source = readFileSync(file, "utf8");
      expect(source, rel).not.toMatch(/welcome-hero/);
    }
    const blocks = [
      "src/views/blocks/deals-block.tsx",
      "src/views/blocks/projects-list-block.tsx",
      "src/views/blocks/space-discipline-block.tsx"
    ];
    for (const rel of blocks) {
      const source = read(rel);
      expect(source).toContain("PageIntro");
      expect(source).not.toMatch(/welcome-hero__title/);
    }
    expect(read("src/views/blocks/space-discipline-block.tsx")).toContain('className="type-h3"');
    expect(read("src/views/blocks/deals-block.tsx")).toMatch(/<h3 className="deal-card__title"/);
  });

  it("deal-card title uses --text-h3 token (batch 14m)", () => {
    const css = read("src/styles/bem-supplement.css");
    expect(css).toMatch(/\.deal-card__title\s*\{[\s\S]*font-size:\s*var\(--text-h3\)/);
  });

  it("batch 15 build evidence records successful web build", () => {
    const evidence = JSON.parse(
      readFileSync(join(webRoot, ".storybook-verify-tmp/batch15-build-evidence.json"), "utf8")
    ) as { pass: boolean; exitCode: number };
    expect(evidence.pass).toBe(true);
    expect(evidence.exitCode).toBe(0);
  });

  it("batch 15c copy scan has zero EN dev-label failures", () => {
    const evidence = JSON.parse(
      readFileSync(join(webRoot, ".storybook-verify-tmp/batch15c-copy-scan-evidence.json"), "utf8")
    ) as { pass: boolean; failures: unknown[] };
    expect(evidence.pass).toBe(true);
    expect(evidence.failures).toHaveLength(0);
  });

  it("batch 16 CI gate script is wired in package.json", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["verify:storybook-contract"]).toBe("node scripts/run-storybook-contract-ci.mjs");
  });

  it("batch 16 CI evidence records successful pipeline", () => {
    const evidence = JSON.parse(
      readFileSync(join(webRoot, ".storybook-verify-tmp/batch16-ci-evidence.json"), "utf8")
    ) as { pass: boolean; steps: { name: string; pass: boolean }[] };
    expect(evidence.pass).toBe(true);
    expect(evidence.steps.find((s) => s.name === "copy-scan-106")?.pass).toBe(true);
  });
});
