# KISS PM Design-v3 Storybook Production-Grade Implementation Plan

> **For Cursor/Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not skip verification gates. Do not turn this into a broad redesign without completing the current phase acceptance first.

**Goal:** Merge Eva's Storybook visual audit with the Cursor production-grade brief into an atomic phased plan that turns design-v3 Storybook into a reliable production-grade visual baseline.

**Architecture:** Fix the current Storybook reliability and composition blockers first, then lock the design contract, then upgrade shared primitives and reusable widgets, then rebuild screens on typed fixtures/MSW scenarios, and only then add VRT/a11y gates. Reuse existing KISS PM components aggressively: Kanban, DatePicker, state components, shell, PageIntro, DataTable, Gantt, Funnel, ResourceMatrix.

**Tech Stack:** Next 16, React 19, TypeScript, Storybook 8, Vitest, Playwright, axe-core, Radix UI, lucide-react, dnd-kit, react-day-picker, existing CSS tokens/BEM architecture.

---

## Source Inputs

- Eva visual audit: `tmp/kiss-pm-storybook-visual-audit-2026-05-25.md`
- Cursor brief from Max: `design-v3 production-grade brief`
- KISS PM worktree: `E:\KISS-PM\.worktrees\design-v3-vh-split-pane`
- Running Storybook: `http://10.1.1.50:6006`
- Current audit artifacts: `output/playwright/storybook-visual-audit-20260525/`

## Non-Negotiable Rules

- UI/copy is Russian. API contracts, types, technical contracts and code identifiers are English.
- Product stories must look like finished app screens, not component demos.
- No product Storybook screen may render Storybook error UI.
- Do not add new visual systems before fixing reliability, route state, layout composition and copy leaks.
- Do not create new CSS islands in feature folders. Prefer `tokens.css`, shared BEM styles, existing widget styles and component-local patterns already used by the repo.
- Prefer existing dependencies. `framer-motion` from the brief is optional and should not be added in Phase 5 unless drag/zoom behavior cannot be made acceptable with existing CSS/dnd-kit. If added, make it an explicit dependency decision.
- Reuse before creating:
  - Kanban: `apps/web/src/widgets/kanban/*`
  - DatePicker: `apps/web/src/components/ui/date-picker.tsx`
  - States: `empty-state.tsx`, `error-state.tsx`, `forbidden-state.tsx`, `loading-state.tsx`, `illu-state.tsx`
  - Shell: `apps/web/src/shell/app-shell.tsx`, `app-sidebar.tsx`, `app-topbar.tsx`, `topbar-breadcrumbs.tsx`
  - Page surface: `page-intro.tsx`, `card-panel.tsx`, `data-table.tsx`, `form-layout.tsx`
  - Widgets: `gantt`, `funnel`, `resource-matrix`

## Current Blockers To Merge Into The Brief

From Eva's audit:

- Broken Storybook play stories:
  - `views-screens--my-work-kanban-dragging`: duplicate `В работе`
  - `views-screens--create-task-modal-validation`: duplicate `Участники`
  - `views-screens--deals-funnel-dragging`: duplicate `КП`
- Broken composition/layout quality:
  - product screens have white voids, sparse placeholders, inconsistent shell composition and debug-looking fragments;
  - Gantt and ResourceMatrix are overloaded while other screens are underfed;
  - state screens mix naked primitives and app-shell product states.
- Wrong active navigation:
  - deals highlights `Входящие`;
  - projects/gantt/resources often highlight `Отчёты`.
- Product screens leak English/technical text:
  - `UpdateTaskBody`, `PATCH /api/...`, `active`, `opportunity`, `Quick Daily`, `John Onboarding`, `SAAS · SELF-HOSTED · DESIGN-V3`.
- Gantt still needs visual stabilization around dependency geometry and toolbar priority.
- ResourceMatrix needs hierarchy: group rows, person rows, overload, weekends, selected day/month.

From Cursor brief:

- Production-grade direction: premium-industrial duotone, dense operational surfaces plus spacious decision surfaces.
- 8 Storybook sections: Foundations / Primitives / Composites / Widgets / Screens / Flows / Patterns / API Contract.
- Typed fixtures + MSW + scenario controls.
- State system with L1-L4 states, shimmer skeleton, error dictionary.
- Shell direction: icon rail + context sidebar + thin topbar.
- Verification: VRT, axe, health tests, contract tests.

## Phase Dependency Map

Serial gates:

- Phase 0 must complete first.
- Phase 1 must complete before broad visual polish.
- Phase 2 must complete before Phase 5/6.
- Phase 8 must complete before Phase 9.

Parallel-safe after Phase 2:

- States system can run beside shell work.
- Kanban/Funnel can run beside Gantt/ResourceMatrix if they do not touch shared widget contracts.
- Screen groups can run in parallel after shared fixtures/scenario API is stable.
- API Contract section can run beside screen production pass if it only adds MSW/fixtures and does not rewrite screens.

---

## Phase 0: Baseline Lock And Current Failure Gate

**Purpose:** Stop building on top of unreliable Storybook output.

**Files:**

- Modify: `docs/design-v3/PRODUCTION-GRADE-BRIEF.md`
- Modify: `docs/design-v3/DESIGN_CONTRACT.md`
- Modify: `docs/design-v3/TOKENS.md`
- Modify: `apps/web/src/views/screens/screens.stories.tsx`
- Modify: `apps/web/src/widgets/kanban/kanban.stories.tsx`
- Modify: `apps/web/src/widgets/funnel/funnel.stories.tsx`
- Test: `apps/web/.storybook/sidebarLabelsRu.test.ts`
- Test: existing Storybook contract script in `apps/web/scripts/run-storybook-contract-ci.mjs`

### Task 0.1: Commit the merged brief

1. Create `docs/design-v3/PRODUCTION-GRADE-BRIEF.md`.
2. Merge the Cursor brief with Eva audit blockers.
3. Add a section named `Current blockers before production-grade upgrade`.
4. Add explicit rule: product screens must pass finished-screen composition at 1440px before any premium polish.
5. Run:
   ```bash
   pnpm --filter @kiss-pm/web typecheck
   ```
6. Commit:
   ```bash
   git add docs/design-v3/PRODUCTION-GRADE-BRIEF.md
   git commit -m "docs: lock design v3 production brief"
   ```

### Task 0.2: Fix the three broken play stories

1. Open `apps/web/src/views/screens/screens.stories.tsx`, `apps/web/src/widgets/kanban/kanban.stories.tsx`, `apps/web/src/widgets/funnel/funnel.stories.tsx`.
2. Replace global `canvas.getByText(...)` selectors that match duplicate text with scoped selectors:
   - use `within(columnElement)` when selecting repeated column names;
   - use role/name selectors scoped to a known container;
   - use `getAllBy*` only where duplicates are expected and index choice is documented in code.
3. Run:
   ```bash
   pnpm --filter @kiss-pm/web verify:storybook-contract
   pnpm --filter @kiss-pm/web test
   ```
4. Open Storybook and verify these no longer show error UI:
   - `views-screens--my-work-kanban-dragging`
   - `views-screens--create-task-modal-validation`
   - `views-screens--deals-funnel-dragging`
5. Commit:
   ```bash
   git add apps/web/src/views/screens/screens.stories.tsx apps/web/src/widgets/kanban/kanban.stories.tsx apps/web/src/widgets/funnel/funnel.stories.tsx
   git commit -m "test: stabilize storybook interaction stories"
   ```

### Task 0.3: Add a no-error Storybook gate

1. Extend `apps/web/scripts/run-storybook-contract-ci.mjs` or add a focused test beside it.
2. Make the gate fail if any `Views/Screens` story renders Storybook error UI text.
3. Include known error markers:
   - `Error`
   - `Found multiple elements`
   - `TestingLibraryElementError`
4. Run:
   ```bash
   pnpm --filter @kiss-pm/web verify:storybook-contract
   ```
5. Commit:
   ```bash
   git add apps/web/scripts/run-storybook-contract-ci.mjs
   git commit -m "test: fail storybook contract on rendered errors"
   ```

**Phase 0 acceptance:**

- The three broken stories render normally.
- Storybook contract fails on rendered error pages.
- Brief explicitly contains Eva audit blockers and Cursor production-grade decisions.

---

## Phase 1: Design Contract, Tokens And Foundations

**Purpose:** Define the visual language before touching screens at scale.

**Files:**

- Modify: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles/tokens.planning.css`
- Modify: `docs/design-v3/DESIGN_CONTRACT.md`
- Modify: `docs/design-v3/TOKENS.md`
- Modify: `apps/web/src/stories/foundations/Colors.stories.tsx`
- Modify: `apps/web/src/stories/foundations/Typography.stories.tsx`
- Create or modify: `apps/web/src/stories/foundations/Density.stories.tsx`
- Create or modify: `apps/web/src/stories/foundations/Depth.stories.tsx`
- Create or modify: `apps/web/src/stories/foundations/Iconography.stories.tsx`

### Task 1.1: Patch tokens without repainting the app

1. Add token deltas only:
   - `--font-display: 'Inter Tight'`
   - `--text-display`
   - `--text-eyebrow`
   - `--brand-grad`
   - `--shadow-floating`
   - `--row-h-ultra`, `--row-h-compact`, `--row-h-cozy`
   - dark-ready stub under `@media (prefers-color-scheme: dark)`
2. Keep `#2563eb` as primary.
3. Do not apply brand gradient globally.
4. Run:
   ```bash
   pnpm --filter @kiss-pm/web test
   pnpm --filter @kiss-pm/web typecheck
   ```
5. Commit:
   ```bash
   git add apps/web/src/styles/tokens.css apps/web/src/styles/tokens.planning.css
   git commit -m "style: extend design v3 tokens"
   ```

### Task 1.2: Update docs to match tokens

1. Update `DESIGN_CONTRACT.md` with:
   - density tiers;
   - depth tiers;
   - brand gradient allowed surfaces only;
   - UI Russian/API English rule;
   - product Storybook finished-screen rule.
2. Update `TOKENS.md` with new tokens and intended usage.
3. Run:
   ```bash
   pnpm --filter @kiss-pm/web verify:storybook-contract
   ```
4. Commit:
   ```bash
   git add docs/design-v3/DESIGN_CONTRACT.md docs/design-v3/TOKENS.md
   git commit -m "docs: update design v3 contract and tokens"
   ```

### Task 1.3: Expand Foundation stories

1. Add or update Storybook stories:
   - Colors with contrast badges;
   - Typography with Inter/Inter Tight/JetBrains Mono;
   - Density with 24/32/40/free examples;
   - Depth with flat/resting/elevated/floating;
   - Iconography with lucide sizes and stroke width.
2. Use Russian labels in Storybook UI.
3. Run:
   ```bash
   pnpm --filter @kiss-pm/web verify:storybook-contract
   pnpm --filter @kiss-pm/web build-storybook
   ```
4. Commit:
   ```bash
   git add apps/web/src/stories/foundations docs/design-v3
   git commit -m "docs: expand design foundations stories"
   ```

**Phase 1 acceptance:**

- Tokens exist and are documented.
- Foundations stories explain the system with visual examples.
- No broad screen restyle has happened yet.

---

## Phase 2: Reusable Primitives And Domain Components

**Purpose:** Avoid one-off screen fixes by making the missing building blocks reusable.

**Files:**

- Modify: `apps/web/src/components/ui/*`
- Modify: `apps/web/src/components/domain/*`
- Modify: `apps/web/src/styles/bem.css` or existing shared style entrypoint if this repo uses another BEM file
- Reuse: `date-picker.tsx`, `badge.tsx`, `chip.tsx`, `avatar.tsx`, `progress.tsx` if present, `table.tsx`, `page-intro.tsx`
- Test/story files beside each component

### Task 2.1: Add minimal UI primitives only where missing

1. Check existing UI components before creating new ones.
2. Add or extend:
   - `StatusDot`
   - `AvatarGroup`
   - `ProgressBar`
   - `ProgressRing`
   - `TrendArrow`
   - `Sparkline`
   - `KbdShortcut`
   - `NumericValue`
   - `.icon-pill`
3. Use lucide icons with 14/16/20 sizes and stroke width 1.75.
4. Write stories and a11y checks for each.
5. Run:
   ```bash
   pnpm --filter @kiss-pm/web test
   pnpm --filter @kiss-pm/web typecheck
   pnpm --filter @kiss-pm/web verify:storybook-contract
   ```
6. Commit:
   ```bash
   git add apps/web/src/components/ui apps/web/src/styles
   git commit -m "feat: add reusable design v3 ui primitives"
   ```

### Task 2.2: Add domain components by wrapping primitives

1. Add or extend:
   - `KpiTile`
   - `HeatmapCell`
   - `GanttBar`
   - `DateRange`
   - `MoneyValue`
   - `CapacityBar`
   - `DependencyChip`
   - `ParticipantList`
2. `DateRange` must reuse `apps/web/src/components/ui/date-picker.tsx` or date formatting utilities, not implement a separate date picker.
3. `KpiTile`, `MoneyValue`, `NumericValue` must use tabular numbers.
4. `DependencyChip` must match Gantt terminology and predecessor text.
5. Run tests as in Task 2.1.
6. Commit:
   ```bash
   git add apps/web/src/components/domain apps/web/src/styles
   git commit -m "feat: add reusable design v3 domain components"
   ```

**Phase 2 acceptance:**

- Shared primitives exist before widget/screen rewrite.
- DatePicker is reused, not duplicated.
- Domain widgets can consume components instead of inventing local visuals.

---

## Phase 3: Scenario Fixtures, MSW And Storybook Structure

**Purpose:** Make visual states systematic and typed before multiplying screens.

**Files:**

- Modify: `apps/web/.storybook/main.ts`
- Modify: `apps/web/.storybook/preview.tsx`
- Create: `apps/web/.storybook/msw-handlers.ts`
- Create: `apps/web/.storybook/decorators/with-scenario.tsx`
- Create: `apps/web/src/lib/mock-data/scenarios.ts`
- Create or extend: `apps/web/src/lib/mock-data/*`
- Create: `apps/web/src/__health__/api-contract.health.test.ts`
- Reference: `apps/api/src/apiTypes.ts`
- Reference: `apps/web/src/lib/api-types/`

### Task 3.1: Define scenario model

1. Create `scenarios.ts` with scenario names:
   - `default`
   - `empty`
   - `loading`
   - `error`
   - `forbidden`
   - `overload`
   - `late`
2. Keep scenario state typed and serializable.
3. Run:
   ```bash
   pnpm --filter @kiss-pm/web test
   pnpm --filter @kiss-pm/web typecheck
   ```
4. Commit:
   ```bash
   git add apps/web/src/lib/mock-data/scenarios.ts
   git commit -m "feat: define storybook scenario fixtures"
   ```

### Task 3.2: Add MSW handlers and decorator

1. Add Storybook MSW support if package exists. If package is missing, first add dependency in its own commit.
2. Create `msw-handlers.ts` for current backend routes used by stories.
3. Create `with-scenario.tsx` decorator that provides scenario state to stories.
4. Add global `scenario` argType in `preview.tsx`.
5. Run:
   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @kiss-pm/web build-storybook
   ```
6. Commit:
   ```bash
   git add apps/web/.storybook apps/web/src/lib/mock-data package.json apps/web/package.json pnpm-lock.yaml
   git commit -m "feat: add storybook scenario msw support"
   ```

### Task 3.3: Add API contract health test

1. Add `api-contract.health.test.ts`.
2. Verify each mock fixture satisfies mirrored web API types.
3. Create coverage output mapping entity -> fixture -> route -> story.
4. Run:
   ```bash
   pnpm --filter @kiss-pm/web test -- api-contract.health.test.ts
   pnpm --filter @kiss-pm/web typecheck
   ```
5. Commit:
   ```bash
   git add apps/web/src/__health__/api-contract.health.test.ts apps/web/src/lib/mock-data
   git commit -m "test: add api contract fixture health check"
   ```

**Phase 3 acceptance:**

- Stories can switch scenarios consistently.
- Fixtures are typed.
- MSW route drift becomes visible.

---

## Phase 4: State System And Screen State Taxonomy

**Purpose:** Fix naked state screens and make loading/empty/error/forbidden production-grade.

**Files:**

- Modify: `apps/web/src/components/ui/empty-state.tsx`
- Modify: `apps/web/src/components/ui/error-state.tsx`
- Modify: `apps/web/src/components/ui/forbidden-state.tsx`
- Modify: `apps/web/src/components/ui/loading-state.tsx`
- Modify: `apps/web/src/components/ui/illu-state.tsx`
- Modify: `apps/web/src/views/blocks/state-screen-block.tsx`
- Modify: `apps/web/src/views/screens/screens.stories.tsx`
- Create: `docs/design-v3/STATES-CATALOG.md`

### Task 4.1: Split primitive states from product states

1. Keep component catalogue stories naked.
2. Make `Views/Screens` state stories render inside normal app shell.
3. Add L1-L4 size contract:
   - L1 inline;
   - L2 panel;
   - L3 page section;
   - L4 full product screen.
4. Run:
   ```bash
   pnpm --filter @kiss-pm/web verify:storybook-contract
   pnpm --filter @kiss-pm/web typecheck
   ```
5. Commit:
   ```bash
   git add apps/web/src/components/ui apps/web/src/views
   git commit -m "feat: normalize storybook state taxonomy"
   ```

### Task 4.2: Add skeleton and error dictionary

1. Add or extend reusable skeletons:
   - table skeleton;
   - bento skeleton;
   - Gantt skeleton;
   - drawer skeleton.
2. Use shimmer, not pulse.
3. Add error dictionary for 4xx/5xx/network with Russian copy, concrete CTA and `correlationId`.
4. Document in `STATES-CATALOG.md`.
5. Run tests/typecheck/contract.
6. Commit:
   ```bash
   git add apps/web/src/components/ui docs/design-v3/STATES-CATALOG.md
   git commit -m "feat: add production state system"
   ```

**Phase 4 acceptance:**

- Product state stories use product shell.
- States are reusable and documented.
- No screen has a huge accidental white canvas unless it is intentionally a spacious state screen.

---

## Phase 5: Shell And Navigation Consistency

**Purpose:** Remove the "stitched template" feeling.

**Files:**

- Modify: `apps/web/src/shell/app-shell.tsx`
- Modify or split: `apps/web/src/shell/app-sidebar.tsx`
- Modify: `apps/web/src/shell/app-topbar.tsx`
- Modify: `apps/web/src/shell/topbar-breadcrumbs.tsx`
- Create if useful: `apps/web/src/shell/app-icon-rail.tsx`
- Create if useful: `apps/web/src/shell/app-context-sidebar.tsx`
- Create: `apps/web/src/shell/tenant-switcher.tsx`
- Modify: `apps/web/src/components/ui/command-dialog.tsx` or command component used by the shell
- Modify: `apps/web/src/views/screens/screen-view.tsx`
- Modify: `apps/web/src/views/screens/screens.stories.tsx`

### Task 5.1: Define route metadata once

1. Create or centralize a route/screen metadata map.
2. Each product story must pass:
   - rail section;
   - context sidebar section;
   - breadcrumbs;
   - page title;
   - topbar actions.
3. Use Russian labels.
4. Run:
   ```bash
   pnpm --filter @kiss-pm/web test
   pnpm --filter @kiss-pm/web typecheck
   ```
5. Commit:
   ```bash
   git add apps/web/src/shell apps/web/src/views/screens
   git commit -m "feat: centralize storybook route metadata"
   ```

### Task 5.2: Rebuild shell incrementally

1. Add icon rail at 56px only if it improves route clarity without breaking current screens.
2. Add context sidebar at 232px for section-specific navigation.
3. Keep topbar thin at 56-60px.
4. Move create/export actions to `PageIntro` or local page actions where appropriate.
5. Add tenant switcher only as UI-layer state.
6. Run:
   ```bash
   pnpm --filter @kiss-pm/web verify:storybook-contract
   pnpm --filter @kiss-pm/web build-storybook
   ```
7. Commit:
   ```bash
   git add apps/web/src/shell apps/web/src/views apps/web/src/components/ui
   git commit -m "feat: align app shell and route state"
   ```

**Phase 5 acceptance:**

- Deals no longer highlight Inbox.
- Projects/Gantt/Resources no longer highlight Reports unless actually in Reports.
- Shell, breadcrumbs, page title and top actions agree.

---

## Phase 6: Widget Production Pass

**Purpose:** Upgrade complex widgets using shared primitives, not one-off CSS patches.

**Parallel-safe lanes after Phase 2 and Phase 5:**

- Lane A: Kanban + Funnel
- Lane B: Gantt
- Lane C: ResourceMatrix + Heatmap
- Lane D: Dashboard widgets

### Task 6A.1: Kanban reuse pass

**Files:**

- Modify: `apps/web/src/widgets/kanban/kanban.tsx`
- Modify: `apps/web/src/widgets/kanban/task-kanban-card.tsx`
- Modify: `apps/web/src/widgets/kanban/deal-kanban-card.tsx`
- Modify: `apps/web/src/widgets/kanban/kanban.stories.tsx`
- Reuse: `AvatarGroup`, `StatusDot`, `ProgressBar`, `ParticipantList`, `MoneyValue`

Steps:

1. Keep one generic Kanban layout.
2. Use profile/card renderers for task/deal variants.
3. Add column accent strip and card lift via shared tokens.
4. Ensure drag stories use scoped selectors.
5. Run:
   ```bash
   pnpm --filter @kiss-pm/web test
   pnpm --filter @kiss-pm/web verify:storybook-contract
   ```
6. Commit:
   ```bash
   git add apps/web/src/widgets/kanban
   git commit -m "feat: polish reusable kanban widget"
   ```

### Task 6A.2: Funnel refresh using Kanban/domain primitives

**Files:**

- Modify: `apps/web/src/widgets/funnel/deal-card.tsx`
- Modify: `apps/web/src/widgets/funnel/funnel-board.tsx`
- Modify: `apps/web/src/widgets/funnel/funnel.stories.tsx`

Steps:

1. Reuse Kanban card patterns where possible.
2. Add probability ring and trend arrow via primitives.
3. Keep money/date values from domain components.
4. Run tests and Storybook contract.
5. Commit:
   ```bash
   git add apps/web/src/widgets/funnel
   git commit -m "feat: polish funnel widget with shared components"
   ```

### Task 6B.1: Gantt geometry and hierarchy pass

**Files:**

- Modify: `apps/web/src/widgets/gantt/gantt-view.tsx`
- Modify: `apps/web/src/widgets/gantt/gantt-chart-bar.tsx`
- Modify: `apps/web/src/widgets/gantt/gantt-dependency-paths.ts`
- Modify: `apps/web/src/widgets/gantt/gantt-dependency-paths.test.ts`
- Modify: `apps/web/src/widgets/gantt/gantt.stories.tsx`
- Modify: `apps/web/src/styles/widgets/gantt.css`

Steps:

1. Add tests proving dependency endpoints align to bar rect coordinate space.
2. Fix dependency geometry before visual styling.
3. Reduce toolbar density and group actions.
4. Make selected row/bar/link relation obvious.
5. Defer framer-motion. Use existing CSS/dnd-kit first.
6. Run:
   ```bash
   pnpm --filter @kiss-pm/web test -- gantt
   pnpm --filter @kiss-pm/web typecheck
   ```
7. Capture screenshot of `views-screens--project-gantt`.
8. Commit:
   ```bash
   git add apps/web/src/widgets/gantt apps/web/src/styles/widgets/gantt.css
   git commit -m "feat: stabilize gantt visual geometry"
   ```

### Task 6C.1: ResourceMatrix hierarchy pass

**Files:**

- Modify: `apps/web/src/widgets/resource-matrix/resource-matrix.tsx`
- Modify: `apps/web/src/widgets/resource-matrix/cells.tsx`
- Modify: `apps/web/src/widgets/resource-matrix/legend.tsx`
- Modify: `apps/web/src/widgets/resource-matrix/stats.tsx`
- Modify: `apps/web/src/widgets/resource-matrix/mock-data.ts`
- Modify: `apps/web/src/views/blocks/project-resources-block.tsx`

Steps:

1. Define visual priority:
   - group rows;
   - person rows;
   - overload cells;
   - selected day/month;
   - weekends/non-working days.
2. Reduce competing color priority.
3. Make scroll affordance visible.
4. Reuse `HeatmapCell`, `CapacityBar`, `ParticipantList`.
5. Run tests/typecheck/Storybook contract.
6. Commit:
   ```bash
   git add apps/web/src/widgets/resource-matrix apps/web/src/views/blocks/project-resources-block.tsx
   git commit -m "feat: clarify resource matrix hierarchy"
   ```

### Task 6D.1: Dashboard/Bento widget pass

**Files:**

- Modify: `apps/web/src/views/blocks/dashboard-bento.tsx`
- Create or modify reusable widget components under existing views/components path

Steps:

1. Use `KpiTile`, `Sparkline`, `TrendArrow`, `NumericValue`.
2. Replace English demo data with Russian names and labels.
3. Keep layout dense but not card-heavy inside cards.
4. Run tests/typecheck/Storybook contract.
5. Commit:
   ```bash
   git add apps/web/src/views/blocks/dashboard-bento.tsx apps/web/src/components
   git commit -m "feat: polish dashboard bento widgets"
   ```

**Phase 6 acceptance:**

- Kanban is one reusable system, not duplicated per area.
- Date and money primitives are reused.
- Gantt dependencies visually align.
- ResourceMatrix has clear hierarchy.
- Dashboard no longer leaks English placeholders.

---

## Phase 7: Product Screens Production Pass

**Purpose:** Make every screen visually credible with realistic density and consistent scenarios.

**Files:**

- Modify: `apps/web/src/views/screens/screens.stories.tsx`
- Modify: `apps/web/src/views/screens/screen-view.tsx`
- Modify: `apps/web/src/views/blocks/*`
- Modify: `apps/web/src/lib/mock-data/*`

### Task 7.1: Define screen inventory and ownership

1. Create `docs/design-v3/STORYBOOK-STRUCTURE.md`.
2. List all sections:
   - Foundations
   - Primitives
   - Composites
   - Widgets
   - Screens
   - Flows
   - Patterns
   - API Contract
3. List each product screen and its scenarios.
4. Run docs-only review.
5. Commit:
   ```bash
   git add docs/design-v3/STORYBOOK-STRUCTURE.md
   git commit -m "docs: define storybook production structure"
   ```

### Task 7.2: Fix composition and density per screen group

Run this as separate commits per group:

1. Auth/Login.
2. Dashboard/My Work.
3. Planning/Projects list/Project overview.
4. Gantt/Baselines/Scenarios/Calendars/Conflicts.
5. CRM/Funnel/Deals/Entities/Templates.
6. Analytics/KPI/Signals/Corrective actions/Audit.
7. Admin/Settings.
8. Project creation wizard.

For each group:

1. Provide `default`, `empty`, `loading`, `error`, `forbidden` scenarios.
2. Ensure default scenario has enough data to prove layout.
3. Remove technical/English copy from product stories.
4. Reuse widgets and primitives from earlier phases.
5. Capture screenshot at 1440px.
6. Run:
   ```bash
   pnpm --filter @kiss-pm/web verify:storybook-contract
   pnpm --filter @kiss-pm/web typecheck
   ```
7. Commit:
   ```bash
   git add apps/web/src/views apps/web/src/lib/mock-data apps/web/src/widgets
   git commit -m "feat: polish storybook screens <group-name>"
   ```

**Phase 7 acceptance:**

- No screen looks like a placeholder in default scenario.
- No product screen leaks API/type/debug copy.
- Each product screen has consistent scenarios.
- Every screen passes a 1440px finished-screen visual check.

---

## Phase 8: Flows, Patterns And API Contract Section

**Purpose:** Turn the Storybook from screenshots into an operational design contract.

**Files:**

- Create: `docs/design-v3/API-CONTRACT-MAP.md`
- Create: `docs/design-v3/MOTION-CATALOG.md`
- Modify/Create flow stories under `apps/web/src/stories/flows/`
- Modify/Create pattern stories under `apps/web/src/stories/patterns/`
- Create API Contract stories under `apps/web/src/stories/api-contract/`

### Task 8.1: Add flow stories

Add six flow stories:

1. CRM to Project.
2. Project Wizard.
3. KPI Signal to Corrective Action.
4. Capacity Conflict.
5. Onboarding Tenant.
6. Audit Trail.

Each flow:

1. Uses scenario fixtures.
2. Uses MSW where route data is shown.
3. Has Russian UI labels.
4. Has interaction steps documented in story docs.
5. Runs Storybook contract.
6. Commits:
   ```bash
   git add apps/web/src/stories/flows
   git commit -m "feat: add design v3 flow stories"
   ```

### Task 8.2: Add patterns section

Add patterns:

- empty states;
- loading states;
- error states;
- forms: single, wizard, inline, drawer;
- drawer detail;
- filters toolbar;
- bulk actions;
- search/command.

Run:

```bash
pnpm --filter @kiss-pm/web verify:storybook-contract
```

Commit:

```bash
git add apps/web/src/stories/patterns docs/design-v3
git commit -m "feat: add storybook pattern catalog"
```

### Task 8.3: Add API Contract section

1. Create index story by entity.
2. Map each entity to:
   - fixture;
   - MSW route;
   - consuming story;
   - backend API type.
3. Document in `API-CONTRACT-MAP.md`.
4. Run:
   ```bash
   pnpm --filter @kiss-pm/web test -- api-contract.health.test.ts
   pnpm --filter @kiss-pm/web verify:storybook-contract
   ```
5. Commit:
   ```bash
   git add apps/web/src/stories/api-contract docs/design-v3/API-CONTRACT-MAP.md
   git commit -m "feat: add storybook api contract section"
   ```

**Phase 8 acceptance:**

- Storybook has 8 stable sections.
- Flows demonstrate product behavior, not isolated components only.
- API contract stories make backend/UI drift visible.

---

## Phase 9: Verification, VRT And Lockdown

**Purpose:** Make the new baseline enforceable.

**Files:**

- Modify: `apps/web/scripts/run-storybook-contract-ci.mjs`
- Create or modify: Playwright VRT config/tests
- Modify: `docs/design-v3/CHECKPOINT-2026-05-25.md` or create new checkpoint
- Modify: `docs/design-v3/DESIGN_CONTRACT.md`

### Task 9.1: Add VRT story coverage

1. Build Storybook.
2. Run Playwright over:
   - Widgets;
   - Screens;
   - Flows;
   - Patterns.
3. Save stable baseline screenshots.
4. Fail on missing/error-rendering stories.
5. Commit:
   ```bash
   git add apps/web tests docs/design-v3
   git commit -m "test: add storybook visual regression coverage"
   ```

### Task 9.2: Add axe and health gates

1. Run axe with 0 critical/serious target.
2. Add or extend health checks:
   - token contrast;
   - density tiers;
   - depth tiers;
   - BEM/no inline style/no random hex;
   - bundle budget.
3. Run:
   ```bash
   pnpm --filter @kiss-pm/web test
   pnpm --filter @kiss-pm/web test:a11y
   pnpm --filter @kiss-pm/web build
   pnpm --filter @kiss-pm/web build-storybook
   pnpm verify:storybook-contract
   ```
4. Commit:
   ```bash
   git add apps/web docs/design-v3
   git commit -m "test: lock design v3 storybook quality gates"
   ```

### Task 9.3: Final checkpoint

1. Update checkpoint doc with:
   - screenshots path;
   - pass/fail command outputs;
   - known follow-ups;
   - explicit "baseline ready" or "not ready" verdict.
2. Run full root checks:
   ```bash
   pnpm test
   pnpm typecheck
   pnpm build
   pnpm verify:storybook-contract
   ```
3. Commit:
   ```bash
   git add docs/design-v3
   git commit -m "docs: checkpoint design v3 storybook baseline"
   ```

**Phase 9 acceptance:**

- Full verification commands pass.
- Baseline screenshots exist.
- `DESIGN_CONTRACT.md` v2 is the locked source of truth.
- Remaining work is documented as follow-up, not hidden debt.

---

## Parallel Cursor Subagent Master Prompt

Use this when the phase is explicitly marked parallel-safe. Do not use it for Phase 0 or Phase 1.

```text
You are one of several Cursor subagents working in the same KISS PM design-v3 worktree.

Global context:
- Product: KISS PM, design-v3 Storybook.
- Goal: upgrade Storybook to production-grade visual baseline.
- Visible UI/copy must be Russian.
- API contracts, TypeScript types, event names, command names and code identifiers must stay English.
- Reuse existing components before creating new ones.
- Do not touch files outside your assigned ownership unless absolutely necessary; if necessary, stop and explain the dependency.
- Do not introduce new CSS architecture or feature-local CSS islands. Use existing tokens/BEM/widget styles.
- Do not add broad dependencies without explicit approval. framer-motion is not pre-approved.
- Do not rewrite unrelated screens.

Current source docs:
- docs/design-v3/PRODUCTION-GRADE-BRIEF.md
- docs/design-v3/DESIGN_CONTRACT.md
- docs/design-v3/TOKENS.md
- docs/design-v3/STORYBOOK-STRUCTURE.md, if present

Assigned lane:
[PASTE LANE NAME AND FILE OWNERSHIP HERE]

Required workflow:
1. Read the source docs and assigned files.
2. State a tiny implementation plan in 5-8 bullets.
3. Implement only your lane.
4. Add/update stories and tests for your lane.
5. Run the lane-specific commands:
   - pnpm --filter @kiss-pm/web test [lane-specific pattern if possible]
   - pnpm --filter @kiss-pm/web typecheck
   - pnpm --filter @kiss-pm/web verify:storybook-contract
6. Capture or request a Storybook screenshot for the affected stories.
7. Report:
   - changed files;
   - verification commands and results;
   - screenshots/story IDs checked;
   - risks or files that require coordinator attention.

Hard acceptance:
- No Storybook error UI.
- No wrong active nav.
- No English/technical copy in product screens.
- No placeholder-looking default scenario.
- Reused shared components are preferred over new local UI.
```

## Parallel Work Allocation

### Parallel Wave A: after Phase 2

Subagent A1: States

- Owns: `apps/web/src/components/ui/*state*`, `illu-state`, `state-screen-block`, `STATES-CATALOG.md`
- Must not touch shell or widgets.

Subagent A2: Shell

- Owns: `apps/web/src/shell/*`, `screen-view.tsx`, route metadata.
- Must not touch widget internals.

Subagent A3: API fixtures

- Owns: `.storybook/msw-handlers.ts`, `with-scenario.tsx`, `mock-data`, `api-contract.health.test.ts`
- Must not restyle UI.

### Parallel Wave B: after Phase 5

Subagent B1: Kanban + Funnel

- Owns: `widgets/kanban`, `widgets/funnel`.
- Must reuse shared primitives and not fork card visuals.

Subagent B2: Gantt

- Owns: `widgets/gantt`, `styles/widgets/gantt.css`.
- Must prove dependency endpoint alignment with tests before visual polish.

Subagent B3: ResourceMatrix

- Owns: `widgets/resource-matrix`, `project-resources-block.tsx`.
- Must define hierarchy and reduce color competition.

Subagent B4: Dashboard/Bento

- Owns: `dashboard-bento.tsx` and shared dashboard widgets.
- Must remove English mock names and use domain primitives.

### Parallel Wave C: after Phase 6

Subagent C1: Work/Tasks screens

- Owns: My Work, task card, task creation wizard, related scenarios.

Subagent C2: Planning/Projects screens

- Owns: Projects list, overview, baselines, scenarios, calendars, conflicts.

Subagent C3: CRM screens

- Owns: Deals, Funnel, clients/contacts/products/templates.

Subagent C4: Admin/Settings screens

- Owns: users, roles, permissions, custom fields, statuses, templates, org structure, absences, profile/theme/notifications.

Subagent C5: Analytics/Audit screens

- Owns: KPI, signals, corrective actions, audit.

Coordinator responsibility:

- Merge order.
- Resolve shared fixture/schema changes.
- Re-run full Storybook visual pass.
- Reject any lane that introduces one-off components where shared ones exist.

---

## Suggested Execution Order For Max

1. Run Phase 0 in one Cursor session. No parallel work.
2. Run Phase 1 in one Cursor session. No parallel work.
3. Run Phase 2 in one Cursor session focused on shared components.
4. Run Parallel Wave A.
5. Review screenshots and merge.
6. Run Parallel Wave B.
7. Review screenshots and merge.
8. Run Parallel Wave C in small batches, not all at once if merge conflicts become noisy.
9. Run Phase 8.
10. Run Phase 9 and lock baseline.

## Minimal Verification Checklist Per Commit

Run at least:

```bash
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/web verify:storybook-contract
```

For Storybook-affecting phases also run:

```bash
pnpm --filter @kiss-pm/web build-storybook
```

For final gates run:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm verify:storybook-contract
```

## Stop Conditions

Stop and ask for coordinator review if:

- a phase requires changing API/backend shape;
- a subagent needs files outside its ownership;
- adding `framer-motion` becomes necessary;
- two lanes change the same shared component differently;
- visual output improves one screen but breaks shell consistency elsewhere;
- Storybook contract passes but screenshots still look unfinished.

