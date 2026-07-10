# PROJ-004: project surface tab bar

Status: PASS

## Scope

- `apps/web/src/delivery/ui/delivery-frame.tsx` inspected and left unchanged: the existing implementation already renders `next/link` links when `projectId` is present and static `span` elements otherwise.
- Added `apps/web/src/delivery/ui/delivery-frame-navigation.test.tsx`.
- No matrix, inventory, E2E, lockfile, or unrelated source files were edited.

## Acceptance evidence

- All nine `DELIVERY_TABS` render as anchors produced by the real Next `Link` component for `projectId="project-42"`.
- Exact hrefs are asserted from `/projects/project-42/overview` through `/projects/project-42/settings`.
- Every possible `activeTab` is exercised; exactly one link has `aria-current="page"`, and all other links omit the attribute.
- A, PR, and RR execute the same navigation assertion. `DeliveryFrame` has no approval-state input, so the test locks the intended approval-state-agnostic contract.
- Without `projectId`, the tab bar contains no anchor, button, `role="link"`, or `tabindex`; labels remain visible as static fallback content.

## Verification

- `pnpm --filter @kiss-pm/web exec vitest run src/delivery/ui/delivery-frame-navigation.test.tsx` -> PASS, 1 file / 5 tests.
- `pnpm --filter @kiss-pm/web typecheck` -> PASS (`next typegen` and `tsc -p tsconfig.json --pretty false`).

## CodeGraph change index

- Before: `delivery-frame-navigation.test.tsx` did not exist in the index (0 nodes); `delivery-frame.tsx` contained 13 indexed symbols. `DeliveryFrame` impact was limited to the main file plus the separately indexed `.claude` worktree duplicate (4 aggregate symbol/file entries), with no downstream production caller surfaced.
- After `codegraph sync`: `delivery-frame-navigation.test.tsx` is indexed with 9 symbols, including `PROJECT`, `EXPECTED_TABS`, and `renderFrame`; CodeGraph resolves `renderFrame` to the existing `DeliveryTab` type. `delivery-frame.tsx` remains at 13 symbols and its product graph is unchanged.
- Files touched by this lane: the new focused test and this evidence report. Product symbols added/changed/removed: 0 / 0 / 0. Test symbols added/changed/removed: 9 / 0 / 0.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-tabs.md
