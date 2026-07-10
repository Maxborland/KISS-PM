# Project identity/detail code review

## Verdict

**APPROVE**

Scope: recheck of the current `project-chrome.ts` diff, `project-chrome.test.tsx`, existing `ProjectDetailSurface`, `project-detail-identity.test.tsx`, and `projects-detail-identity.spec.ts` only.

## Findings

No actionable findings remain in the bounded scope.

## Resolved findings

### Tenant/auth identity reuse: resolved

- The module-global identity cache is gone. `useProjectBase` keeps only instance-local state tagged with `projectId` (`apps/web/src/delivery/lib/project-chrome.ts:39-42`).
- A project change cannot render the previous identity because the current identity is accepted only when `loaded.projectId === projectId`.
- Effect cleanup prevents a late response for the previous project from committing after a switch (`project-chrome.ts:44-62`).
- Initial, denied, malformed and unavailable detail states render neutral metadata (`Проект`, `…`, `—`) rather than mock or previously cached identity (`project-chrome.ts:74-75`).
- The focused remount regression uses the same tenant-scoped project ID twice, returns `ok: false` on the second request, proves two network calls, and proves that the first identity is not reused (`project-chrome.test.tsx:76-98`).

### Status contract/mock honesty: resolved

- The implementation now documents the detail endpoint as active-only and narrows `ProjectIdentity.status` to the literal `"active"` (`project-chrome.ts:23-32`).
- Runtime accepts identity only when the response status is exactly `active`; the visible label is correspondingly fixed to `В работе` (`project-chrome.ts:53-71`).
- Unreachable `closed`/`draft` mocks and assertions were removed. The focused test now models the production endpoint with `status: "active"` (`project-chrome.test.tsx:56-74`).
- The live E2E remains honest for its contract: active-project headers, canonical selector/reload/back/forward behavior, explicit 404, distinct 403, and empty-list behavior. Aggregate failure collection still terminates the test via `expect(failures).toEqual([])`.

## Permission and error semantics

- API `getProjectDetail` checks `canReadProjects` first and returns 403 for missing permission; an inaccessible/non-active tenant project returns 404.
- `useResource` maps 403 to `forbidden`, while `ProjectDetailSurface` keeps forbidden distinct from not-found and generic load error.
- The refreshed live evidence records the real resource-reader 403 and both admin/plan-reader/beta not-found cases without route substitution.

## Verification

- `codegraph sync`: PASS before recheck.
- `pnpm vitest run apps/web/src/delivery/lib/project-chrome.test.tsx apps/web/src/workspace/project-detail/project-detail-identity.test.tsx`: PASS, 2 files / 8 tests.
- `pnpm --filter @kiss-pm/web typecheck`: PASS.
- Fresh live artifact: `.superloopy/evidence/projects-2026-07-10/projects-detail-identity.json`, generated at `2026-07-10T08:21:49.924Z`, after the reviewed `project-chrome.ts` and focused-test writes; 16/16 PASS and 0 failures.
- E2E was not rerun by this reviewer because the spec rewrites JSON/screenshots and the task permits editing only this report; the supplied fresh artifact was inspected directly.

## Change index

Product/test changes made by this review: none. Only this verdict artifact was updated.

Reviewed current changes:
- Changed: `PROJECT_FALLBACK`, `ProjectIdentity`, `useProjectBase`.
- Removed from the rejected revision: module-global `projectIdentityCache`, `PROJECT_STATUS_META`, unreachable closed/draft behavior.
- Added/updated focused coverage: `Harness`, `renderIdentity`, same-ID remount/denied regression, stale-project transition regression.
- Existing behavior rechecked: `ProjectDetailSurface`, `ProjectSwitcher`, `useProjectDetail`, `useProjects`, `useResource`, API `getProjectDetail`, `findActiveProject`, E2E `runCheck`, `exerciseCanonicalSelection`, `exerciseNotFound`.

CodeGraph before this report update: 2,228 files, 24,825 nodes, 53,167 edges. Compared with the rejected revision (24,827 nodes / 53,170 edges), the identity/status-cache revision removed 2 indexed nodes and 3 edges. No product nodes or edges were changed by this read-only recheck.
