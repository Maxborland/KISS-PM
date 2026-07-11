# Schedule commit-history robustness — franky executor

Status: PASS
Captured: 2026-07-10T18:09:54.2734307+07:00
Workspace: E:\KISS-PM
Branch: codex/pre-prod-hardening-on-master
Scope: access-control policy tests, CommitsSurface and narrow tests, planning OpenAPI schemas/document/tests.

## Result

- `planReader` test profile now has the minimum extra permission `tenant.audit_events.read`; project-plan manage remains denied.
- `ProjectCommits` has an explicit commit-history `loading | ready | error` lifecycle, renders load errors, exposes retry, and ignores stale/unmounted responses with a monotonically increasing request id.
- Post-revert history refresh goes through the same guarded/error-aware loader.
- Revert OpenAPI uses strict `PlanningRevertRequest`, `PlanningRevertResponse`, and `PlanningRevertErrorResponse` schemas. The success contract requires `reverted`; request and response objects disallow additional properties.
- Route-specific error docs cover route/parser/concurrency/media-type errors plus the global `same_origin_action_required` guard.
- Existing Saved View create/rename docs were preserved: `clientRequestId`, `PlanningSavedViewRenameRequest`, and PATCH `/planning/saved-views/:viewId`. A focused assertion now protects them.
- API route inventory was taught to resolve simple route path constants so the current Saved View route refactor is recognized without touching Saved View routes/repository.
- The already implemented `preview-command-batch` route was added to route docs because the inventory gate exposed it as undocumented.

## Files

- `packages/access-control/src/policy.test.ts`
- `apps/web/src/delivery/commits/commits-surface.tsx`
- `apps/web/src/delivery/commits/commits-permission.test.tsx`
- `apps/api/src/apiDocs/schemas/planning.ts`
- `apps/api/src/apiDocs/openApiDocument.ts`
- `apps/api/src/apiDocs/openApiDocument.test.ts`
- This evidence artifact

No worker edits were made to Saved View routes/repository, schedule-surface, TSV, matrix, or persistence code.

## Fresh verification

PASS:

```text
pnpm vitest run packages/access-control/src/policy.test.ts apps/web/src/delivery/commits/commits-permission.test.tsx apps/api/src/apiDocs/openApiDocument.test.ts apps/api/src/planning/planningRevertRoute.test.ts

Test Files  4 passed (4)
Tests       36 passed (36)
```

The revert atomic rollback test intentionally emits `injected_compensation_failure` to stderr while asserting rollback; the suite exits 0.

PASS:

```text
pnpm --filter @kiss-pm/access-control typecheck
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/api typecheck
```

All three commands exited 0 on the final state. Web `next typegen` also completed.

PASS:

```text
git diff --check -- <six scoped source/test files>
```

Exit 0. Git only reported the pre-existing CRLF-to-LF warning for the two API docs files.

## CodeGraph

Pre-edit `codegraph sync`: already up to date.

Before:
- files: 2237
- nodes: 25069
- edges: 53359

Post-edit `codegraph sync`: exit 0, already up to date via watcher.

After:
- files: 2238
- nodes: 25083
- edges: 53324

Global delta: files +1, nodes +14, edges -35. This workspace had concurrent dirty changes, so the global delta is not attributed solely to this worker.

Scoped change index:
- changed function: `ProjectCommits` — guarded commit-history lifecycle, retry, stale-response suppression.
- changed function: `responsesFor` — per-route error schema and documented 415 response.
- added function: `resolveRouteConstants` — API docs inventory support for static route constants.
- changed constant: `planningSchemas` — added strict revert request/response/error members; preserved Saved View rename members.
- changed type: `RouteDoc` — optional `errorSchema`.
- changed policy scenario: `planReader` explicitly passes `canReadAuditEvents` and still fails `canManageProjectPlan`.
- schema object keys are not emitted as separate CodeGraph nodes; `PlanningRevertResponse` and peers live under `planningSchemas`.

## Editing fallback

Manual edits were required through exact, assertion-guarded PowerShell replacements. `apply_patch` was attempted twice (absolute and relative paths) and both calls failed before touching files with:

```text
windows unelevated restricted-token sandbox cannot enforce split writable root sets directly; refusing to run unsandboxed
```

This is the technical fallback allowed by the assignment. Every replacement asserted the expected original block before writing.

## Notes

The first OpenAPI inventory run exposed `preview-command-batch` as missing docs. The next run exposed the test scanner's inability to see Saved View route constants. Both were corrected inside the allowed API docs/test scope; the final combined run is the evidence above.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/worker-commits-contract-final.md