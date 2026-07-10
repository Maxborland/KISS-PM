# PROJ-025 / PROJ-028: Overview navigation evidence

Status: PASS

## Scope

Changed only:

- apps/web/src/delivery/overview/overview-surface.tsx
- apps/web/src/delivery/overview/overview-navigation.test.tsx
- .superloopy/evidence/projects-2026-07-10/worker-navigation-overview.md

No matrix, E2E, package, lockfile, or unrelated source changes were made. No commit was created.

## Implementation

- Preserved and contract-tested all five overview signal actions:
  - deadline slip -> /projects/:projectId/schedule
  - resource overload -> /projects/:projectId/scenarios
  - baseline variance -> /projects/:projectId/baseline
  - overdue tasks -> /projects/:projectId/schedule
  - critical path -> /projects/:projectId/schedule
- Contract-tested the Все footer action -> /projects/:projectId/commits.
- Replaced the implicit commits=[] presentation with explicit loading, ready, forbidden, and error states.
- История пуста. is now rendered only after a successful commits response containing zero events.
- A 403-shaped rejection renders the permission-specific state; another rejection renders an alert error. Neither can render the empty message.
- Added cancellation protection so a stale commits request cannot overwrite state after dependency change/unmount.

## Verification

Focused test:

pnpm --filter @kiss-pm/web test -- src/delivery/overview/overview-navigation.test.tsx

Result: PASS, 1 test file and 4 tests passed.

Covered contracts:

1. Every rendered signal CTA uses the supplied project id and the correct schedule/scenarios/baseline route.
2. Все uses the project-specific commits route.
3. Successful empty audit history is visibly empty.
4. Generic audit rejection and 403 rejection are not masked as empty.

Web typecheck:

pnpm --filter @kiss-pm/web typecheck

Result: PASS (next typegen and tsc -p tsconfig.json --pretty false).

## CodeGraph change index

Pre-edit:

- codegraph sync: index already current.
- Overview directory: 4 indexed files.
- overview-surface.tsx: 29 symbols.
- ProjectOverview impact radius: 4 symbols (the source file and component in the main workspace plus the indexed parallel worktree duplicate).

Post-edit:

- codegraph sync: current after watcher ingestion.
- Overview directory: 5 indexed files.
- overview-surface.tsx: 31 symbols.
- overview-navigation.test.tsx: 11 symbols.
- Net indexed nodes in this directory: +13.
- Added surface nodes: CommitsState, isForbiddenCommitError.
- Changed node: ProjectOverview.
- Added test nodes include renderOverview, unmount, and anchor; the four Vitest cases are indexed with the new test file.
- Added call edge: ProjectOverview -> isForbiddenCommitError.
- ProjectOverview impact radius remained 4 -> 4; no external production caller edge was added or removed.
- No symbols or edges were removed.

CodeGraph's first natural-language context query did not surface the target TSX component. Per the allowed fallback, the exact target file and existing neighboring tests were read directly; impact was still checked before edits and the post-edit graph was synchronized and inspected.

## Residual note

The current live commits adapter normalizes audit transport failures, including an upstream 403, to Error("audit_events_failed"). Therefore a live normalized 403 follows the explicit error branch rather than the permission-specific copy, but it is no longer presented as empty. The component also honors a preserved status: 403 or code: "forbidden" rejection as forbidden without requiring changes outside the permitted scope.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-overview.md
