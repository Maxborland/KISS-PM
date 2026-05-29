# Cursor Prompt — KISS PM design-v3 Interaction Remediation (Master)

## Context

KISS PM, design-v3 Storybook reboot. Worktree: `E:\KISS-PM\.worktrees\design-v3-vh-split-pane`.

Two existing audits confirm: most screens are visual mocks with enabled-looking dead controls. This master prompt routes work into 6 atomic batches (B1–B6) + an existing Gantt prompt. Each batch has its own child prompt (copy/paste separately).

Baseline audits:

```txt
docs/design-v3/STORYBOOK-INTERACTION-AUDIT-2026-05-25.md
```

Plus per-cluster sub-audits aggregated in this prompt.

## Goal

Bring every product screen to the **Storybook interaction contract**:

> Any visible enabled control must perform real frontend interaction on local controlled state, emit a documented callback/action, or be visibly disabled with a Russian `title` reason. Static visual-only examples are allowed **only** in the component catalog.

Backend wiring is out of scope. Catalog/showcase screens stay visual.

## Inventory (by file, severity)

| File | P0 | P1 | Batch |
|---|---|---|---|
| `apps/web/src/views/blocks/my-work-block.tsx` | 2 | 0 | B1 |
| `apps/web/src/views/blocks/dashboard-bento.tsx` | 0 | 6 | B1 |
| `apps/web/src/widgets/kanban/kanban-card.tsx` | 1 | 0 | B1 |
| `apps/web/src/widgets/kanban/kanban-board.tsx` | 0 | 1 | B1 |
| `apps/web/src/views/blocks/deals-block.tsx` | 0 | 4 | B2 |
| `apps/web/src/views/blocks/entities-block.tsx` | 4 | 0 | B2 |
| (new) `apps/web/src/widgets/funnel/*` | — | — | B2 |
| `apps/web/src/views/blocks/projects-list-block.tsx` | 1 | 4 | B3 |
| `apps/web/src/views/blocks/task-create-modal-block.tsx` | 2 | 6 | B3 |
| `apps/web/src/views/blocks/entity-detail-block.tsx` | 0 | 7 | B3 |
| `apps/web/src/views/blocks/state-screen-block.tsx` | 0 | 1 | B3 |
| `apps/web/src/views/blocks/admin-block.tsx` | 3 | 4 | B4 |
| `apps/web/src/views/blocks/settings-block.tsx` | 1 | 8 | B4 |
| `apps/web/src/views/blocks/avatar-menu-block.tsx` | 0 | 6 | B5 |
| `apps/web/src/shell/app-sidebar.tsx` | 0 | ~10 | B5 |
| `apps/web/src/shell/app-topbar.tsx` | 0 | 1 | B5 |
| `apps/web/src/shell/topbar-breadcrumbs.tsx` | 0 | 1 | B5 |
| `apps/web/src/shell/command-palette.tsx` | 0 | 3 | B5 |
| `apps/web/src/views/blocks/project-resources-block.tsx` | 3 | 0 | B6 |
| `apps/web/src/widgets/resource-matrix/*` | 0 | 1 | B6 |
| `apps/web/src/views/blocks/project-baseline-block.tsx` | 2 | 0 | B6 |
| `apps/web/src/views/blocks/project-scenarios-block.tsx` | 4 | 0 | B6 |
| `apps/web/src/views/blocks/project-kpi-block.tsx` | 0 | 1 | B6 |
| `apps/web/src/views/blocks/project-audit-block.tsx` | 0 | 2 | B6 |
| `apps/web/src/views/blocks/project-calendars-block.tsx` | 3 | 4 | B6 |
| `apps/web/src/views/blocks/gantt-slice-block.tsx` + `widgets/gantt/*` | (covered) | (covered) | **Gantt PROD-GRADE prompt** |

## Universal acceptance contract (applies to ALL batches)

For every targeted file, ALL of these must be true:

1. **No enabled-looking dead controls.** Every `<Button>`, `<IconButton>`, `<DropdownMenuItem>`, `<a href="#">`, clickable card/row that is visible and not visually disabled MUST:
   - Have a real `onClick` / `onSelect` / `onChange` that mutates local state OR emits a documented Storybook action, OR
   - Be `disabled={true}` with Russian `title="Демо Storybook: <reason>"` matching the workspace pattern from `workspace-chrome.tsx` L30–37.
2. **No uncontrolled-only product forms.** Inputs with `defaultValue`/`defaultChecked` standing alone in a form pretending to be persistable: lift to `useState`, add `onChange`, add dirty/save contract.
3. **Search inputs filter their data.** `SearchPill` rendered above a list must drive a local `useMemo` filter, or be `disabled` with reason.
4. **Segments that hide/show data must show different data.** No segmented switch that reveals the same table for "Active" / "Archive" / "Templates".
5. **Drag affordances require DnD or removal.** `cursor: grab`, draggable cards, draggable funnel/kanban → wire `@dnd-kit` (already in deps), OR remove the cursor/visual cue until implemented.
6. **Forms with footer buttons (`Отмена` / `Назад` / `Далее` / `Сохранить`)** must wire those buttons or `disabled` them with explicit `title`. No silent noop on primary CTA.
7. **Existing patterns reused.** Use already-working patterns from the codebase:
   - `DropdownMenu` (`@/components/ui/dropdown-menu`) for row/column overflow.
   - `Sheet` / `Dialog` for create stubs.
   - `Segmented`, `SwitchRow`, `Combobox`, `DatePicker`, `TagsInput` controlled variants.
   - `sonner` toast for action acknowledgement.
   - `cn` for class merge.
8. **design-v3 lockdown** (AGENTS.md §10): UI imports only from `components/ui|domain`, `widgets/*`, `shell/*`. No inline `style={{}}` (except SVG attrs), no hex/rgba in TSX. New BEM in `styles/bem.css` or `styles/widgets/<name>.css`.
9. **shadcn first.** Before writing a custom primitive: check if it exists in `@/components/ui/*`; if not, scaffold via shadcn registry (AGENTS.md §7.4).

## Execution order (recommended)

| Order | Batch | Why first |
|---|---|---|
| 1 | **B3 Projects/Forms** | Highest user-facing pain (task wizard broken, entity detail × 3 screens) |
| 2 | **B1 Work surfaces** | Kanban is the second-most-visible workflow; dashboard is landing |
| 3 | **B6 Project tools** | Biggest P0 cluster (12 P0); largest surface count |
| 4 | **B2 CRM** | Funnel widget extraction is real new work; do after team has rhythm |
| 5 | **B4 Admin/Settings** | Lower visibility; persistent settings less critical for design review |
| 6 | **B5 Shell/Nav** | Polish; affects all screens but each fix is small |

Run **one batch per PR**. Each batch ships its own evidence JSON + health-test.

## Shared per-batch verification gate

For each batch:

```bash
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/web lint
pnpm --filter @kiss-pm/web build
pnpm --filter @kiss-pm/web verify:storybook-contract
```

Plus, per the pattern in `apps/web/.storybook-verify-tmp/batch1{5,6}-*-evidence.json`, write:

```txt
apps/web/.storybook-verify-tmp/interaction-batch-<id>-evidence.json
```

```json
{
  "pass": true,
  "batch": "B3",
  "filesChanged": ["..."],
  "deadControlsRemoved": 26,
  "deadControlsLabeledDisabled": 4,
  "newStoriesAdded": ["..."]
}
```

Add a guarding test in `apps/web/src/__health__/storybook-contract.health.test.ts`:

```ts
it("interaction batch <id> evidence is green", () => {
  const evidence = JSON.parse(read(".storybook-verify-tmp/interaction-batch-<id>-evidence.json"));
  expect(evidence.pass).toBe(true);
  expect(evidence.deadControlsRemoved).toBeGreaterThan(0);
});
```

## Detection helper (run before each batch + at end)

Add or run `apps/web/scripts/find-dead-controls.mjs` (create if missing) — simple AST/regex scan that flags:

- `<Button` enabled (no `disabled`) without `onClick`
- `<IconButton` enabled without `onClick`
- `<DropdownMenuItem` without `onSelect`
- `<a href="#"` (acceptable only with `aria-disabled`)
- `defaultValue=` on `<Input>` inside `<form>` (smell)
- `cursor: grab` selector in any `widgets/*.css` not paired with `data-dnd-active` or similar

Output JSON list; batch must reduce the count for its files to zero.

## Hard NOT-to-do

- НЕ внедрять реальные API/persistence (Storybook остаётся mock-контрактом).
- НЕ менять API доменных типов в `@/widgets/*` или `@/components/domain/*` без обновления потребителей.
- НЕ переименовывать BEM-классы (health-тесты завязаны).
- НЕ удалять существующие stories — добавлять новые рядом.
- НЕ ломать `views-screens--project-gantt` (отдельный prompt активен).
- НЕ менять `apps/api/**`.

## Final report format (per batch)

```txt
Batch: B<id>
Status:
Files changed:
Dead controls removed:
Dead controls labeled disabled:
New stories:
Tests / verification:
  - vitest:
  - typecheck:
  - lint:
  - build:
  - verify:storybook-contract:
  - find-dead-controls.mjs (before → after):
Evidence: apps/web/.storybook-verify-tmp/interaction-batch-<id>-evidence.json
CodeGraph: (sync до / sync после; status: nodes/edges)
Decisions / assumptions:
Risks / follow-up:
```

## Child prompts (separate copy-paste docs)

Sibling files in `docs/design-v3/`:

```txt
INTERACTION-B1-WORK-SURFACES-CURSOR-PROMPT.md
INTERACTION-B2-CRM-CURSOR-PROMPT.md
INTERACTION-B3-PROJECTS-FORMS-CURSOR-PROMPT.md
INTERACTION-B4-ADMIN-SETTINGS-CURSOR-PROMPT.md
INTERACTION-B5-SHELL-NAV-CURSOR-PROMPT.md
INTERACTION-B6-PROJECT-TOOLS-CURSOR-PROMPT.md
```

Do NOT mix batches within a single PR.
