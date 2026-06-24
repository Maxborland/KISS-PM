import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

  it("WorkspaceChrome default topbar actions are disabled with reason (batch 13g)", () => {
    const source = read("src/views/layout/workspace-chrome.tsx");
    expect(source).toMatch(/disabled title="Демо Storybook: экспорт подключится к API"/);
    expect(source).toMatch(/disabled title="Демо Storybook: создание сущности в продукте"/);
  });

  it("views have no welcome-hero and surviving blocks use PageIntro (batch 14)", () => {
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
    // Уцелевшие блоки-прототипы всё ещё используют общий PageIntro-заголовок.
    const blocks = ["src/views/blocks/space-discipline-block.tsx", "src/views/blocks/dashboard-bento.tsx"];
    for (const rel of blocks) {
      const source = read(rel);
      expect(source).toContain("PageIntro");
      expect(source).not.toMatch(/welcome-hero__title/);
    }
    expect(read("src/views/blocks/space-discipline-block.tsx")).toContain('className="type-h3"');
  });

  it("superseded static screens are deleted and screen-view no longer imports them", () => {
    // Контракт «переделать или удалить»: статические блоки, у которых есть функциональный
    // surface-аналог, удалены, а роутер screen-view.tsx больше их не импортирует. Это заменяет
    // прежние текстовые пины на удаляемую разметку (deals/projects-list/my-work/…).
    const deletedBlocks = [
      "src/views/blocks/my-work-block.tsx",
      "src/views/blocks/deals-block.tsx",
      "src/views/blocks/projects-list-block.tsx",
      "src/views/blocks/entities-block.tsx",
      "src/views/blocks/entity-detail-block.tsx",
      "src/views/blocks/admin-block.tsx",
      "src/views/blocks/gantt-slice-block.tsx",
      "src/views/blocks/project-resources-block.tsx",
      "src/views/blocks/project-baseline-block.tsx",
      "src/views/blocks/project-scenarios-block.tsx",
      "src/views/blocks/project-audit-block.tsx",
      "src/views/blocks/project-calendars-block.tsx",
      "src/views/blocks/avatar-menu-block.tsx",
      "src/views/blocks/settings-block.tsx",
      "src/views/screens/login-screen-view.tsx"
    ];
    for (const rel of deletedBlocks) {
      expect(existsSync(join(webRoot, rel)), `${rel} must be deleted`).toBe(false);
    }
    const screenView = read("src/views/screens/screen-view.tsx");
    const forbiddenImports = [
      "my-work-block",
      "deals-block",
      "projects-list-block",
      "entities-block",
      "entity-detail-block",
      "admin-block",
      "gantt-slice-block",
      "project-resources-block",
      "project-baseline-block",
      "project-scenarios-block",
      "project-audit-block",
      "project-calendars-block",
      "avatar-menu-block",
      "settings-block",
      "login-screen-view"
    ];
    for (const mod of forbiddenImports) {
      expect(screenView, `screen-view must not import ${mod}`).not.toContain(mod);
    }
  });

  it("each deleted static screen has a functional surface successor on disk", () => {
    // Каждый удалённый статический экран заменён контракт-обоснованной поверхностью.
    const successors = [
      "src/workspace/my-work/my-work-surface.tsx",
      "src/workspace/projects/projects-list-surface.tsx",
      "src/workspace/project-detail/project-detail-surface.tsx",
      "src/delivery/inspector/task-inspector-surface.tsx",
      "src/crm/deals/deals-surface.tsx",
      "src/crm/deals/deal-card-surface.tsx",
      "src/crm/clients/clients-surface.tsx",
      "src/crm/contacts/contacts-surface.tsx",
      "src/crm/products/products-surface.tsx",
      "src/admin/users/users-surface.tsx",
      "src/admin/roles/roles-surface.tsx",
      "src/delivery/schedule/schedule-surface.tsx",
      "src/delivery/resources/resources-surface.tsx",
      "src/delivery/baseline/baseline-surface.tsx",
      "src/delivery/scenarios/scenarios-surface.tsx",
      "src/delivery/commits/commits-surface.tsx",
      "src/delivery/calendars/calendars-surface.tsx",
      "src/auth/login/login-surface.tsx",
      "src/auth/avatar-menu/avatar-menu-surface.tsx",
      "src/workspace/settings/settings-surface.tsx"
    ];
    for (const rel of successors) {
      expect(existsSync(join(webRoot, rel)), `${rel} must exist`).toBe(true);
    }
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
