# PROJ-004: staged Schedule navigation guard

## Verdict

PASS. Navigation from Schedule no longer silently drops an optimistic staged batch.

## Implemented behavior

- Clean Schedule tabs remain real native links and do not prompt.
- A normal primary click with staged commands opens an explicit browser confirmation.
- Cancel prevents navigation and preserves the staged commands and optimistic read model.
- Leave restores the batch base read model, clears staged/error state, and allows the clicked link exact href.
- Modified clicks keep native link behavior.
- beforeunload prevents reload/close only while staged.length > 0.
- The existing delivery-frame-navigation.test.tsx contract is unchanged.

## Verification

- pnpm --filter @kiss-pm/web exec vitest run src/delivery/schedule/schedule-navigation-guard.test.tsx src/delivery/ui/delivery-frame-navigation.test.tsx
  - PASS: 2 files, 9 tests.
  - Covers clean navigation, Cancel/preserve, Leave/discard/exact href, and beforeunload.
- pnpm --filter @kiss-pm/web typecheck
  - PASS: Next route type generation and TypeScript compilation.
- No matrix, E2E, unrelated files, commit, or staging operation was performed.

## Change index

Scoped files:

- apps/web/src/delivery/ui/delivery-frame.tsx
  - Added DeliveryNavigationGuard.
  - Changed DeliveryFrame to accept an optional pre-navigation guard while retaining next/link.
- apps/web/src/delivery/schedule/schedule-surface.tsx
  - Changed ProjectSchedule.
  - Added local resetStagedReadModel and confirmStagedNavigation behavior.
  - Added staged-only beforeunload subscription.
- apps/web/src/delivery/schedule/schedule-navigation-guard.test.tsx
  - Added focused integration coverage and its render/staging helpers.
- .superloopy/evidence/projects-2026-07-10/worker-navigation-unsaved-guard.md
  - Added this evidence report.

Symbols removed: none.

CodeGraph global index before -> after:

- Files: 2222 -> 2224
- Nodes: 24718 -> 24755
- Edges: 52848 -> 53042

The global delta includes concurrent workspace activity; the scoped symbol list above is the task-owned change index. codegraph sync completed before and after the code work. CodeGraph did not resolve ProjectSchedule from the initial natural-language lookup, so exact-file reading was used only after the required context/impact pass.

## Tooling note

The built-in Windows apply_patch wrapper failed before file access, and its CLI wrapper was denied by WindowsApps. The same scoped unified diffs were therefore applied with git apply; no direct product-file overwrite was used.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-unsaved-guard.md
