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

  it("deals funnel migrated to Kanban widget with funnel boardVariant", () => {
    const dealsBlock = read("src/views/blocks/deals-block.tsx");
    expect(dealsBlock).toContain('boardVariant="funnel"');
    expect(dealsBlock).toContain("DealKanbanCard");
    expect(dealsBlock).not.toMatch(/<FunnelBoard\b/);
    expect(dealsBlock).not.toMatch(/badge badge--soft/);
    const kanban = read("src/widgets/kanban/kanban.tsx");
    expect(kanban).toContain("<Badge");
  });

  it("state screens use workspace shell in route registry (not bare canvas)", () => {
    const source = read("src/shell/navigation-registry.ts");
    expect(source).toContain('"state-empty"');
    expect(source).toMatch(/"state-empty":[\s\S]*contextActiveItem: "Моя работа"/);
    expect(source).toMatch(/"state-empty":[\s\S]*railSection: "tasks"/);
    expect(source).not.toMatch(/"state-empty":[\s\S]*variant: "bare"/);
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

  it("PageIntro demo actions are disabled with reason (batch 13g)", () => {
    const source = read("src/shell/page-intro-actions.tsx");
    expect(source).toMatch(/disabled title="Демо Storybook: экспорт подключится к API"/);
    expect(source).toMatch(/disabled title="Демо Storybook: создание сущности в продукте"/);
  });

  it("route metadata drives PageIntro actions via RoutePageIntro", () => {
    const routeIntro = read("src/views/layout/route-page-intro.tsx");
    expect(routeIntro).toContain("pageIntroActions");
    expect(routeIntro).toContain("PageIntroActions");
    expect(read("src/views/layout/workspace-chrome.tsx")).toContain("ScreenRouteProvider");
    const blocksWithRegistryIntro = [
      "src/views/blocks/dashboard-bento.tsx",
      "src/views/blocks/deals-block.tsx",
      "src/views/blocks/my-work-block.tsx",
      "src/views/blocks/projects-list-block.tsx",
      "src/views/blocks/gantt-slice-block.tsx"
    ];
    for (const rel of blocksWithRegistryIntro) {
      expect(read(rel)).toContain("RoutePageIntro");
    }
    expect(read("src/views/config/sidebar-nav.ts")).not.toContain("sidebarGroupsForActive");
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
  });

  it("legacy deal-card / funnel BEM removed after kanban unification", () => {
    const css = read("src/styles/bem-supplement.css");
    expect(css).not.toMatch(/\.deal-card\b/);
    expect(css).not.toMatch(/\.funnel__/);
    const funnelCss = read("src/styles/widgets/funnel.css");
    expect(funnelCss).not.toMatch(/\.deal-card\b/);
    expect(funnelCss).not.toMatch(/\.funnel__/);
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
    const copyStep = evidence.steps.find(
      (s) => s.name === "copy-scan-all-stories" || s.name === "copy-scan-106"
    );
    expect(copyStep?.pass).toBe(true);
  });

  it("interaction batch B1 evidence is green", () => {
    const evidence = JSON.parse(
      readFileSync(join(webRoot, ".storybook-verify-tmp/interaction-batch-1-evidence.json"), "utf8")
    ) as { pass: boolean; deadControlsRemoved: number; newStoriesAdded: string[] };
    expect(evidence.pass).toBe(true);
    expect(evidence.deadControlsRemoved).toBeGreaterThan(0);
    expect(evidence.newStoriesAdded.length).toBeGreaterThanOrEqual(3);
  });

  it("interaction batch B3 evidence is green", () => {
    const evidence = JSON.parse(
      readFileSync(join(webRoot, ".storybook-verify-tmp/interaction-batch-3-evidence.json"), "utf8")
    ) as { pass: boolean; newStoriesAdded: string[] };
    expect(evidence.pass).toBe(true);
    expect(evidence.newStoriesAdded.length).toBeGreaterThanOrEqual(5);
  });

  it("interaction batch B3: task wizard uses controlled step and Combobox value", () => {
    const source = read("src/views/blocks/task-create-modal-block.tsx");
    expect(source).toContain('"use client"');
    expect(source).toMatch(/useState<1 \| 2 \| 3>/);
    expect(source).toMatch(/value=\{projectScopeId\}/);
    expect(source).toMatch(/onValueChange=\{setProjectScopeId\}/);
    expect(source).toContain("validateCreateTaskInput");
  });

  it("task API contract layer mirrors projectWorkParsers", () => {
    const contract = read("src/views/domain/task-api/task-api-contract.ts");
    expect(contract).toContain("plannedWork");
    expect(contract).toContain("durationWorkingDays");
    expect(contract).toContain("participants");
    expect(contract).toContain("requiresAcceptance");
    expect(contract).toContain('"low", "normal", "high", "critical"');
    expect(contract).not.toMatch(/\burgent\b/);
    const validation = read("src/views/domain/task-api/task-api-validation.ts");
    expect(validation).toContain("invalid_task_title");
    expect(validation).toContain("task_executor_required");
    expect(validation).toContain("formatPlanDate");
    const payload = read("src/views/domain/task-api/task-api-payload.ts");
    expect(payload).toContain("buildCreateTaskBody");
    expect(payload).toContain("buildUpdateTaskBody");
    expect(payload).toContain("clientUpdatedAt");
  });

  it("task wizard removes fake affordances and adopts API priorities", () => {
    const source = read("src/views/blocks/task-create-modal-block.tsx");
    expect(source).not.toMatch(/SelectItem value="action">/);
    expect(source).not.toMatch(/SelectItem value="meeting">/);
    expect(source).not.toMatch(/value="urgent"/);
    expect(source).not.toMatch(/<TagsInput/);
    expect(source).toContain("requiresAcceptance");
    expect(source).toContain("plannedWork");
    expect(source).toContain("durationWorkingDays");
    expect(source).toContain("ParticipantsEditor");
  });

  it("entity detail variant=task wires UpdateTaskBody fields", () => {
    const source = read("src/views/blocks/entity-detail-block.tsx");
    expect(source).toContain('variant?: EntityDetailVariant');
    expect(source).toContain("buildUpdateTaskPreview");
    expect(source).toContain("validateUpdateTaskInput");
    expect(source).toContain("TaskAside");
    const drawer = read("src/views/blocks/task-detail-drawer.tsx");
    expect(drawer).toContain('variant="task"');
    const screen = read("src/views/screens/screen-view.tsx");
    expect(screen).toMatch(/"03-task-card"[\s\S]*variant="task"/);
  });

  it("interaction batch B3: projects list switches datasets and opens Sheet", () => {
    const source = read("src/views/blocks/projects-list-block.tsx");
    expect(source).toContain("archivedProjects");
    expect(source).toContain("templateProjects");
    expect(source).toContain("useScenarioFixtures");
    expect(source).toContain("SheetContent");
    expect(source).toMatch(/value=\{query\}/);
  });

  it("interaction batch B3: entity detail save dirty and feed compose", () => {
    const source = read("src/views/blocks/entity-detail-block.tsx");
    expect(source).toMatch(/const dirty =/);
    expect(source).toContain("setFeedItems");
    expect(source).toContain('type="file"');
  });

  it("interaction batch B3: state error passes onRetry", () => {
    const source = read("src/views/blocks/state-screen-block.tsx");
    expect(source).toContain("onRetry");
  });

  it("interaction batch B1: task kanban card is keyboard-capable; DnD in generic Kanban", () => {
    const card = read("src/widgets/kanban/task-kanban-card.tsx");
    expect(card).toMatch(/onOpen\?:/);
    expect(card).toMatch(/role=\{isInteractive \? "button" : undefined\}/);
    const board = read("src/widgets/kanban/kanban.tsx");
    expect(board).toContain("useSortable");
    expect(board).toContain("DndContext");
  });

  it("interaction batch B1: dashboard wires period segment and disables stubs with RU title", () => {
    const source = read("src/views/blocks/dashboard-bento.tsx");
    expect(source).toContain('name="dashboard-focus-period"');
    expect(source).toMatch(/disabled\s+title="Демо Storybook:/);
  });

  it("interaction batch B1: my-work uses generic Kanban and TaskDetailDrawer", () => {
    const source = read("src/views/blocks/my-work-block.tsx");
    expect(source).toContain("Kanban<CardModel, ColumnId>");
    expect(source).toContain("TaskKanbanCard");
    expect(source).toContain("TaskDetailDrawer");
    expect(source).toMatch(/initialMode\?: "kanban" \| "list"/);
  });

  it("interaction batch B1: TaskDetailDrawer renders 03 task-card content + open-as-page link", () => {
    const source = read("src/views/blocks/task-detail-drawer.tsx");
    expect(source).toContain("EntityDetailBlock");
    expect(source).toContain('size="xl"');
    expect(source).toContain("Открыть как страницу");
    expect(source).toContain("views-screens--task-card");
  });

  it("interaction batch B1: dashboard rows open TaskDetailDrawer", () => {
    const source = read("src/views/blocks/dashboard-bento.tsx");
    expect(source).toContain("TaskDetailDrawer");
  });

  it("interaction batch B1: sheet supports size variant", () => {
    const source = read("src/components/ui/sheet.tsx");
    expect(source).toContain('export type SheetSize');
    expect(source).toMatch(/xl:\s*"w-\[1080px\]/);
  });

  it("interaction batch B1: kanban column actions are DropdownMenu", () => {
    const source = read("src/widgets/kanban/kanban.tsx");
    expect(source).toContain("DropdownMenu");
    expect(source).toContain("Переименовать");
    expect(source).toContain("Лимит WIP");
    expect(source).toContain("Добавить карточку");
  });

  it("interaction batch B1: bem.css no longer applies default cursor:grab to .kanban-card", () => {
    const css = read("src/styles/bem.css");
    expect(css).toMatch(/\.kanban-card--draggable\s*\{\s*cursor:\s*grab/);
    expect(css).not.toMatch(/\.kanban-card\s*\{[^}]*cursor:\s*grab/);
  });

  it("interaction batch kanban evidence is green (sort + cardview + crm unify)", () => {
    const evidence = JSON.parse(
      readFileSync(join(webRoot, ".storybook-verify-tmp/interaction-batch-kanban-evidence.json"), "utf8")
    ) as {
      pass: boolean;
      batch: string;
      features: { columnSort: unknown; cardView: unknown; crmFunnelUnified: unknown };
      verification: { typecheck: string; vitest: string; build: string; storybookContract: string };
    };
    expect(evidence.pass).toBe(true);
    expect(evidence.batch).toBe("kanban-legacy-cleanup");
    expect(evidence.features.columnSort).toBeTruthy();
    expect(evidence.features.cardView).toBeTruthy();
    expect(evidence.features.crmFunnelUnified).toBeTruthy();
    expect(evidence.verification.typecheck).toBe("pass");
    expect(evidence.verification.storybookContract).toBe("pass");
  });

  it("Phase 7: product blocks use ScreenBlockGate instead of centered L3 ScenarioFetchGate", () => {
    const blocksDir = join(webRoot, "src/views/blocks");
    const violations: string[] = [];
    for (const name of readdirSync(blocksDir)) {
      if (!name.endsWith(".tsx")) continue;
      const source = read(`src/views/blocks/${name}`);
      if (source.includes("ScenarioFetchGate")) {
        violations.push(name);
      }
    }
    expect(violations, violations.join(", ")).toEqual([]);
  });

  it("Phase 7: entity detail product copy hides API paths", () => {
    const source = read("src/views/blocks/entity-detail-block.tsx");
    expect(source).not.toMatch(/PATCH \/api\//);
    expect(source).not.toContain("UpdateTaskBody");
  });

  it("field contract sync does not reintroduce known fake affordances", () => {
    const deals = read("src/views/blocks/deals-block.tsx");
    const entities = read("src/views/blocks/entities-block.tsx");

    expect(deals).not.toContain('<BemAvatar initials="ВВ"');
    expect(deals).not.toMatch(/owner:\s*\{\s*initials:\s*"ВЫ",\s*color:\s*"c2"/);
    expect(entities).not.toContain("12 событий · сегодня");
    expect(read("src/lib/mock-data/deals.ts")).toContain("satisfies Opportunity[]");
    expect(read("src/lib/mock-data/tasks.ts")).toContain("satisfies Task[]");
  });

  it("Gantt production-grade evidence is green", () => {
    const evidence = JSON.parse(
      readFileSync(join(webRoot, ".storybook-verify-tmp/gantt-production-grade-evidence.json"), "utf8")
    ) as { pass: boolean; phases: string[] };
    expect(evidence.pass).toBe(true);
    expect(evidence.phases).toEqual(
      expect.arrayContaining([
        "arrows-routing",
        "layering",
        "bar-semantic",
        "drawer",
        "toolbar",
        "playwright"
      ])
    );
  });
});
