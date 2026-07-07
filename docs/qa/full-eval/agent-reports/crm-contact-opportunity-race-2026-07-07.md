# CRM contact/opportunity duplicate/race evidence - 2026-07-07

Status: DONE - integrated by orchestrator

## Changed files

- `apps/api/src/projectIntakeService/createOpportunityCommand.ts`
  - Added `isPostgresUniqueViolation(error)` helper that walks `cause` chain up to 8 levels.
  - Changed opportunity duplicate create race handling to use the helper, so nested Postgres `23505` still maps to `{ error: "opportunity_id_taken" }` with HTTP 409.
- `apps/api/src/crmRoutes.db.test.ts`
  - Added API/DB write-flow evidence for concurrent duplicate opportunity id creates: one `201`, one `409`/`opportunity_id_taken`, plus DB readback proving exactly one opportunity row for the id.
  - Added API/DB write-flow evidence for concurrent duplicate contact email creates: one `201`, one `409`/`contact_email_taken`, plus DB readback proving exactly one row for the email.
  - Added API/DB write-flow evidence for concurrent contact email updates to the same email: one `200`, one `409`/`contact_email_taken`, plus DB readback proving exactly one row with the target email.

## Behavior fixed / evidenced

- Contact create/update duplicate email behavior already had route-level precheck plus transactional `23505` mapping. This batch adds concurrent write-flow API/DB evidence instead of read-only evidence.
- Opportunity create already had top-level `23505` mapping for duplicate ids. This batch hardens it for wrapped driver/ORM errors by walking `error.cause`, matching the CRM unique-conflict pattern used for contacts/products.
- Opportunity duplicate id race now has API/DB write-flow evidence via parallel POST requests.

## Failing-before evidence

- Not captured as a red DB test before the fix. The existing direct `23505` mapping likely already handles the common Postgres error shape; the production change closes the nested `cause` variant identified by code inspection.
- Targeted runtime DB test execution was blocked by local tooling/sandbox constraints (details below), so the new API/DB tests are added but not runtime-confirmed in this session.

## Commands / results

- `codegraph sync`
  - Result: passed, already up to date before exploration.
- CodeGraph context/explore
  - `codegraph_context`: entered CRM routes/repository/write-flow context and found `CrmRepository`, `crmRoutes.ts`, `projectIntakeService/createOpportunityCommand.ts`, `updateOpportunityCommand.ts`.
  - `codegraph_explore`: confirmed `createOpportunity -> authorizeOpportunityCreate -> normalizeDemandPositions -> resolveOpportunityLinks -> validateOpportunityCustomFieldValues`, plus existing duplicate id precheck and `23505` catch.
- `pnpm vitest run --config vitest.db.config.ts apps/api/src/crmRoutes.db.test.ts`
  - Result: failed before Vitest because pnpm ran dependency status/install and exited with `ERR_PNPM_IGNORED_BUILDS` for ignored build scripts (`better-sqlite3`, `esbuild`, `msw`, `sharp`, `unrs-resolver`).
- `./node_modules/.bin/vitest.cmd run --config vitest.db.config.ts apps/api/src/crmRoutes.db.test.ts`
  - Result: failed before tests while loading Vitest config: `Error: spawn EPERM` from esbuild startup.
- Escalated rerun of direct Vitest
  - Result: rejected by workspace policy; not bypassed.
- `./node_modules/.bin/tsc.cmd -b --pretty false`
  - Result: passed.
- `git diff --check -- apps/api/src/projectIntakeService/createOpportunityCommand.ts apps/api/src/crmRoutes.db.test.ts`
  - Result: passed.
- `codegraph sync`
  - Result: passed, already up to date after edits.

## CodeGraph change index

Before:
- `createOpportunity` existed in `apps/api/src/projectIntakeService/createOpportunityCommand.ts` and called `authorizeOpportunityCreate`, `normalizeDemandPositions`, `resolveOpportunityLinks`, `validateOpportunityCustomFieldValues`, `runDataSourceTransaction`, `createOpportunity`, `appendManagementAuditEvent`.
- No `isPostgresUniqueViolation` node in this file.
- `apps/api/src/crmRoutes.db.test.ts` had sequential duplicate contact email evidence, but no concurrent contact email create/update evidence and no concurrent duplicate opportunity id API/DB evidence.

After:
- Added node: `isPostgresUniqueViolation` in `apps/api/src/projectIntakeService/createOpportunityCommand.ts`.
- Changed node: `createOpportunity` now calls `isPostgresUniqueViolation` in its duplicate-create catch path.
- Added test cases in `apps/api/src/crmRoutes.db.test.ts`:
  - `returns one created opportunity and one 409 conflict for concurrent duplicate opportunity ids`
  - `keeps contact email writes conflict-safe under concurrent create and update`
- No repository schema/migration nodes changed.

## Remaining risks

- Runtime DB verification remains pending until local `pnpm approve-builds` / sandbox `spawn EPERM` issue is resolved.
- The concurrent tests assert final status pairs and conflict bodies, but they do not assert audit-event counts; this keeps the slice focused on duplicate/race/idempotency evidence.
- Workspace contains unrelated dirty files from other slices; this batch intentionally did not modify or reconcile them.
## Orchestrator verification after integration

- `cmd /c "set DATABASE_URL=postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55433/kiss_pm&& node_modules\.bin\vitest.cmd run --config vitest.db.config.ts apps/api/src/crmRoutes.db.test.ts -t \"concurrent duplicate|conflict-safe\""`
  - Result: passed; 1 file passed; 2 tests passed, 10 skipped.
  - Evidence includes DB readback counts for opportunity id, contact create email, and contact update email.
- `corepack pnpm --filter @kiss-pm/api typecheck`
  - Result: passed.
- `git diff --check -- apps/api/src/crmRoutes.db.test.ts apps/api/src/projectIntakeService/createOpportunityCommand.ts docs/qa/full-eval/agent-reports/crm-contact-opportunity-race-2026-07-07.md`
  - Result: passed.

Updated final status: runtime DB verification is no longer pending in the orchestrator workspace. Remaining risk is full write-flow matrix breadth, not this CRM contact/opportunity duplicate-race slice.