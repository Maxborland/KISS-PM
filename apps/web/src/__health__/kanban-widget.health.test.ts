import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("kanban widget (generic)", () => {
  it("exports generic Kanban from barrel without legacy re-exports", () => {
    const barrel = read("src/widgets/kanban/index.ts");
    expect(barrel).toContain('export { Kanban } from "@/widgets/kanban/kanban"');
    expect(barrel).toContain("TaskKanbanCard");
    expect(barrel).toContain("DealKanbanCard");
    expect(barrel).toContain("KanbanCardViewMenu");
    expect(barrel).toContain("useKanbanOrderedItems");
    expect(barrel).not.toMatch(/\bKanbanBoard\b/);
    expect(barrel).not.toMatch(/\bKanbanColumn\b/);
    expect(barrel).not.toMatch(/\/kanban-board/);
    expect(barrel).not.toMatch(/\/kanban-card"/);
    expect(barrel).not.toMatch(/@deprecated/);
  });

  it("kanban.tsx defines render-prop API without domain fields", () => {
    const source = read("src/widgets/kanban/kanban.tsx");
    expect(source).toContain("renderCard:");
    expect(source).toContain("SortableContext");
    expect(source).toContain("useSortable");
    expect(source).not.toMatch(/\bpriority\b/);
    expect(source).not.toMatch(/\bassignees\b/);
  });

  it("types.ts defines KanbanItem and KanbanProps generics", () => {
    const source = read("src/widgets/kanban/types.ts");
    expect(source).toContain("export type KanbanItem");
    expect(source).toContain("export type KanbanProps");
    expect(source).toContain("onItemReorder");
    expect(source).toContain("KanbanColumnSortKey");
    expect(source).toContain("KanbanCardViewProfile");
    expect(source).toContain("KanbanBoardVariant");
    expect(source).toContain("visibleFields");
  });

  it("my-work-block uses Kanban<TaskKanbanItem> with sort + card view", () => {
    const source = read("src/views/blocks/my-work-block.tsx");
    expect(source).toContain("Kanban<CardModel, ColumnId>");
    expect(source).toContain("TaskKanbanCard");
    expect(source).toContain("KanbanCardViewMenu");
    expect(source).toContain("TASK_KANBAN_SORT_OPTIONS");
    expect(source).toContain("useKanbanOrderedItems");
    expect(source).not.toMatch(/<KanbanBoard\b/);
    expect(source).not.toMatch(/<KanbanColumn\b/);
  });

  it("deals-block uses the same Kanban widget with funnel variant", () => {
    const source = read("src/views/blocks/deals-block.tsx");
    expect(source).toContain('boardVariant="funnel"');
    expect(source).toContain("DealKanbanCard");
    expect(source).toContain("DEAL_KANBAN_SORT_OPTIONS");
    expect(source).toContain("KanbanCardViewMenu");
    expect(source).not.toMatch(/<FunnelBoard\b/);
  });

  it("bem.css contains core kanban BEM classes", () => {
    const css = read("src/styles/bem.css");
    expect(css).toMatch(/\.kanban\s*\{/);
    expect(css).toMatch(/\.kanban-col\s*\{/);
    expect(css).toMatch(/\.kanban-card\s*\{/);
    expect(css).toMatch(/\.kanban-col__body\s*\{/);
    expect(css).toMatch(/\.kanban-col__empty\s*\{/);
  });

  it("widgets/kanban.css defines funnel board variant", () => {
    const css = read("src/styles/widgets/kanban.css");
    expect(css).toMatch(/\.kanban--funnel\s*\{/);
    expect(css).toMatch(/repeat\(5/);
  });

  it("kanban widget uses DragOverlay for cross-column drag affordance", () => {
    const source = read("src/widgets/kanban/kanban.tsx");
    expect(source).toContain("DragOverlay");
    expect(source).toContain("onDragOver");
    expect(source).toContain("overColumnId");
  });

  it("kanban widget has single Widgets/Kanban catalog story", () => {
    const stories = read("src/widgets/kanban/kanban.stories.tsx");
    expect(stories).toContain('title: "Widgets/Kanban"');
    expect(stories).toContain("KanbanWidgetDemo");
    expect(stories).not.toContain("NeutralBoard");
    expect(stories).not.toContain("WithSortable");
  });

  it("kanban-widget-demo is the shared reference implementation", () => {
    const demo = read("src/widgets/kanban/kanban-widget-demo.tsx");
    expect(demo).toContain("export function KanbanWidgetDemo");
    expect(demo).toContain("renderCard=");
    expect(demo).toContain("TaskKanbanCard");
    expect(demo).toContain("KanbanCardViewMenu");
    expect(demo).toContain("useKanbanOrderedItems");
  });

  it("task + deal profiles expose sort options and view profiles", () => {
    const tasks = read("src/widgets/kanban/task-kanban-profiles.ts");
    expect(tasks).toContain("TASK_KANBAN_SORT_OPTIONS");
    expect(tasks).toContain("TASK_KANBAN_VIEW_PROFILE");
    expect(tasks).toContain('"due-asc"');
    expect(tasks).toContain('"priority-desc"');
    const deals = read("src/widgets/kanban/deal-kanban-profiles.ts");
    expect(deals).toContain("DEAL_KANBAN_SORT_OPTIONS");
    expect(deals).toContain("DEAL_KANBAN_VIEW_PROFILE");
    expect(deals).toContain('"amount-desc"');
    expect(deals).toContain('"client-asc"');
  });

  it("column menu renders Сортировка submenu when sortOptions provided", () => {
    const source = read("src/widgets/kanban/kanban.tsx");
    expect(source).toContain("DropdownMenuSub");
    expect(source).toContain("DropdownMenuRadioGroup");
    expect(source).toContain("Сортировка");
  });
});
