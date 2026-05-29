# Cursor Prompt — Batch B1: Work Surfaces (Kanban + Dashboard)

Inherit all rules from `INTERACTION-REMEDIATION-MASTER-CURSOR-PROMPT.md`.

## Files in scope

```txt
apps/web/src/views/blocks/my-work-block.tsx
apps/web/src/views/blocks/dashboard-bento.tsx
apps/web/src/widgets/kanban/kanban-board.tsx
apps/web/src/widgets/kanban/kanban-card.tsx
apps/web/src/views/screens/screens.stories.tsx  (add variants only)
apps/web/src/styles/bem.css                     (only `.kanban-card { cursor }` cleanup)
```

## P0 fixes (must)

1. `widgets/kanban/kanban-card.tsx` L34–68 — card has `cursor: grab` (bem.css L1082) but NO DnD/open. Add props:
   ```ts
   onOpen?: (id: string) => void;
   draggable?: boolean;
   ```
   Wire `@dnd-kit/core` `useDraggable` when `draggable`. Add `role="button"`, `tabIndex={0}`, `onClick={onOpen}`, `onKeyDown` Enter/Space.
2. `views/blocks/my-work-block.tsx` — list mode (L28) is placeholder text. Build a real list view using `DataTable` from `@/components/domain` with same `CARDS` data; toggle by `mode === "list"`.

## P1 fixes (must)

3. `widgets/kanban/kanban-board.tsx` L22–24 — column overflow button: replace with `DropdownMenu`; items `Переименовать` / `Лимит WIP` / `Добавить карточку` either wire to local toast or `disabled title="Демо Storybook"`.
4. `my-work-block.tsx` — lift `cards` + `columns` to `useState`; add `DndContext` from `@dnd-kit/core` + `SortableContext` per column; `onDragEnd` moves card.
5. `my-work-block.tsx` — clicking card opens `Sheet` stub with task name + status.
6. `dashboard-bento.tsx` L92–94 (`Месяц`), L132 (`Календарь`), L142–144, L155–157 (`Открыть`), L168–171 (`Вся работа`), L236–239 (`Открыть управленческую поверхность`) — wire each to either:
   - `useState`-based local panel state, OR
   - `disabled title="Демо Storybook: ..."` with Russian reason.
7. `dashboard-bento.tsx` table rows L185–210: add `onClick` opening `Sheet` stub `Карточка задачи` (or `disabled`).

## P2

8. `screens.stories.tsx` — add stories: `MyWorkListMode`, `MyWorkKanbanDragging` (Storybook `play` simulates drag), `DashboardEmptyState`.

## Acceptance criteria

- `find-dead-controls.mjs` reports 0 issues in scoped files.
- Storybook story `views-screens--my-work` allows drag, open card, list/kanban switch — no console errors.
- Dashboard 6 buttons either work locally OR show disabled state with title.

## Verification

Per master `Shared per-batch verification gate`. Write evidence `interaction-batch-1-evidence.json`.
