# PROJ-028 planning getCommits permission evidence

Status: PASS

## Scope

Changed only:

- `apps/web/src/delivery/lib/planning-client.ts`
- `apps/web/src/delivery/lib/planning-client-commits-error.test.ts`
- `.superloopy/evidence/projects-2026-07-10/worker-navigation-commits-error.md`

The existing Overview surface and its test were not edited by this worker.

## Implementation

Removed the live `getCommits` catch that replaced every audit transport failure with plain `Error("audit_events_failed")`. The shared `createRequestJson` transport now propagates its original rejection:

- HTTP 403 remains `DomainApiError` with `status`, `code`, and `body` intact.
- Successful audit-event filtering, mapping, ordering, and latest-revert construction are unchanged.
- Network and other non-domain failures remain rejected errors and cannot become an empty successful history.

## Verification

PASS - focused client regression:

`pnpm --filter @kiss-pm/web test -- src/delivery/lib/planning-client-commits-error.test.ts`

Result: 1 file passed, 3 tests passed. Covers 403 DomainApiError evidence, successful mapping, and non-domain transport rejection.

PASS - existing Overview navigation/error contract:

`pnpm --filter @kiss-pm/web test -- src/delivery/overview/overview-navigation.test.tsx`

Result: 1 file passed, 4 tests passed. Confirms Overview distinguishes `status === 403` from generic errors and true empty history.

PASS - web typecheck:

`pnpm --filter @kiss-pm/web typecheck`

Result: `next typegen` and `tsc -p tsconfig.json --pretty false` completed successfully.

## CodeGraph change index

Pre-edit entry: `codegraph sync` completed; `codegraph_context` was consulted first. `codegraph_impact getCommits` returned `Symbol not found` because `getCommits` is an object property rather than an indexed standalone symbol, so focused file reads were used as the disclosed fallback.

Post-edit: `codegraph sync` completed and reported the index already up to date (watcher had consumed the edits). Manual-sync status remained 2,225 indexed files, 24,760 nodes, and 53,032 edges, so observed sync delta was nodes `24,760 -> 24,760`, edges `53,032 -> 53,032`.

Symbols changed:

- `createDeliveryPlanningClient`: live `getCommits` now preserves the request transport rejection.
- Added test suite `createDeliveryPlanningClient live getCommits` with three test cases.
- No symbols removed.

## Notes

The repository was already dirty with unrelated worker changes. None were reverted, edited, staged, or committed.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-commits-error.md
