# Admin Write Race / Idempotency Extra Check — 2026-07-07

## Scope

Atomic area: `RISK-WRITE-FLOW-RACE-IDEMPOTENCY` for admin/security/settings write flows beyond already covered duplicate user/access role checks.

Touched production: no.
Touched e2e: no.
Touched reconciliation matrix: no.

## Behavior Spec

- AC1: Tenant security policy save is safe under duplicate concurrent PUTs of the same payload: both requests complete, readback is normalized, and the tenant has one persisted policy row.
- AC2: Workspace user deactivate/reactivate writes are repeatable: duplicate PATCHes leave a stable readback state; deactivate revokes the user's existing session; reactivate allows login again.
- Non-goals: broad route refactor, e2e coverage, docs matrix edits, production changes without a confirmed bug.

## Tests Added

File: `apps/api/src/app.db.test.ts`

- `keeps tenant security policy save idempotent under duplicate concurrent writes`
  - Sends two concurrent identical `PUT /api/tenant/current/security-policy` requests.
  - Verifies both return `200`.
  - Verifies domain allowlist normalization/deduplication in both responses and GET readback.
  - Verifies exactly one `tenant_security_policies` row for `tenant-alpha`.

- `keeps repeated user deactivate and reactivate writes stable with readback`
  - Creates a user and logs in as that user.
  - Sends two concurrent identical deactivate PATCHes.
  - Verifies both return `200`, session is revoked, readback is `inactive`, and login is denied with `user_inactive`.
  - Sends two concurrent identical reactivate PATCHes.
  - Verifies both return `200`, readback is `active`, and login succeeds.

## Verification

- `codegraph sync`
  - Passed before code/task exploration.

- `pnpm vitest run --config vitest.db.config.ts apps/api/src/app.db.test.ts`
  - Blocked before tests by pnpm install guard: `ERR_PNPM_IGNORED_BUILDS` for ignored build scripts.

- `node_modules/.bin/vitest.cmd run --config vitest.db.config.ts apps/api/src/app.db.test.ts`
  - First sandboxed run blocked by `spawn EPERM` while Vite/esbuild loaded config.
  - Escalated run executed Vitest, but all 30 tests in the file failed at DB setup with `PostgresError: password authentication failed for user "kiss_pm"`.
  - This affects pre-existing tests too, so the local DB credentials/state are the blocker.

- `node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json --noEmit --pretty false`
  - Passed.

- `git diff --check -- apps/api/src/app.db.test.ts`
  - Passed; only Git line-ending warning reported.

## Findings / Risks

No production bug was confirmed in this environment. Code review of the relevant flows suggests:

- Security policy save uses repository-level `insert ... onConflictDoUpdate` on tenant primary key, so duplicate concurrent saves should collapse to one row.
- User status update runs inside `runDataSourceTransaction`; repeated same-status PATCHes should be stable, and session revocation is already tied to status/access/email changes.

Residual risk: DB tests were not able to complete because the local Postgres auth did not match `DATABASE_URL` default/user. The new tests need one green run after DB credentials are fixed or the expected test database is started/reset.

## CodeGraph Notes

- Used CodeGraph before touching code:
  - `codegraph sync` completed.
  - `codegraph_status` showed 2165 indexed files, 23857 nodes, 51901 edges.
  - `codegraph_files` identified `apps/api/src/app.db.test.ts`, `workspaceConfigRoutes.ts`, `workspaceUserRoutes.ts`, `accessRoleRoutes.ts`, `app.ts` as relevant API files.
  - `codegraph_context`/`codegraph_explore` had limited precision and surfaced web/admin/worktree symbols, so I fell back to direct file reads after CodeGraph entry.

## Change Index

Files changed by this slice:

- `apps/api/src/app.db.test.ts`
  - Added DB/API regression coverage for tenant security policy duplicate concurrent save.
  - Added DB/API regression coverage for repeated user deactivate/reactivate writes.

Files created:

- `docs/qa/full-eval/agent-reports/admin-write-race-2026-07-07.md`
- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-write-flow-admin-extra-race-2026-07-07.json`

CodeGraph before/after:

- Before edits: index synced and queried as noted above.
- After edits: `codegraph sync` ran and reported `Already up to date`; `codegraph_status` stayed at 2165 files / 23857 nodes / 51901 edges. Effective code delta is test-only additions in `apps/api/src/app.db.test.ts`; no production route symbols changed.


## Orchestrator Verification

After the agent report, the orchestrator reran the targeted DB tests with the working local database URL (postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55433/kiss_pm). Result: passed; 1 file passed, 2 tests passed, 28 skipped. This upgrades the slice from DONE_WITH_CONCERNS to DONE for the targeted evidence scope.

