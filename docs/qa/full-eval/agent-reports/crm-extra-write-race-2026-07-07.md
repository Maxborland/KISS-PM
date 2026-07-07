# CRM extra write-flow race/idempotency evidence - 2026-07-07

Status: DONE_WITH_CONCERNS - DB runtime verification blocked by local Postgres credentials

## Scope

Atomic area: CRM remaining write-flow race/idempotency beyond already covered contact duplicate email and opportunity duplicate-id.

Chosen flows:

- Client duplicate name create/update under concurrent writes.
- Product duplicate SKU/name create/update under concurrent writes.

Non-goals:

- No e2e/deals-kanban files touched.
- No reconciliation matrix JSON touched.
- No production code changed; this is a targeted evidence-only slice because existing route/repository behavior already maps unique conflicts to stable 409 responses.

## Changed files

- `apps/api/src/crmRoutes.db.test.ts`
  - Added `keeps client name writes conflict-safe under concurrent create and update`.
  - Added `keeps product SKU and name writes conflict-safe under concurrent create and update`.
  - Both tests assert stable HTTP status pairs, conflict response bodies, and DB readback counts proving only one row owns the duplicate value after the race.
- `docs/qa/full-eval/agent-reports/crm-extra-write-race-2026-07-07.md`
  - This report.
- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-write-flow-crm-extra-race-2026-07-07.json`
  - Machine-readable evidence summary for reconciliation.

## Behavior evidenced

- Concurrent client creates with the same `name` must produce exactly one `201` and one `409 { error: "client_name_taken" }`; DB readback must show exactly one matching client row.
- Concurrent client updates to the same `name` must produce exactly one `200` and one `409 { error: "client_name_taken" }`; DB readback must show exactly one matching client row.
- Concurrent product creates with the same `sku` must produce exactly one `201` and one `409 { error: "product_sku_taken" }`; DB readback must show exactly one matching product row.
- Concurrent product creates with the same `name` must produce exactly one `201` and one `409 { error: "product_name_taken" }`; DB readback must show exactly one matching product row.
- Concurrent product updates to the same `sku` must produce exactly one `200` and one `409 { error: "product_sku_taken" }`; DB readback must show exactly one matching product row.
- Concurrent product updates to the same `name` must produce exactly one `200` and one `409 { error: "product_name_taken" }`; DB readback must show exactly one matching product row.

## Commands / results

- `codegraph sync`
  - Result: passed, already up to date before exploration.
- CodeGraph
  - `codegraph_status`: index available; 2165 files, 23857 nodes, 51908 edges.
  - `codegraph_context`: entered CRM routes/services context.
  - `codegraph_files`: found CRM API route/test files under `apps/api/src`.
  - `codegraph_explore`: inspected `crmRoutes.ts`, `crmRoutes.db.test.ts`, `crm/clientCommandHandlers.ts` context for client/product duplicate handling.
- `pnpm vitest run --config vitest.db.config.ts apps/api/src/crmRoutes.db.test.ts`
  - Result: failed before Vitest because pnpm attempted dependency install/status check and exited with `ERR_PNPM_IGNORED_BUILDS` for ignored build scripts (`better-sqlite3`, `esbuild`, `msw`, `sharp`, `unrs-resolver`).
- `.\node_modules\.bin\vitest.cmd run --config vitest.db.config.ts apps/api/src/crmRoutes.db.test.ts`
  - Result: failed inside sandbox while loading config: `Error: spawn EPERM` from esbuild startup.
- Escalated `.\node_modules\.bin\vitest.cmd run --config vitest.db.config.ts apps/api/src/crmRoutes.db.test.ts`
  - Result: Vitest started; 1 file collected; all 14 tests failed at DB setup with `PostgresError: password authentication failed for user "kiss_pm"`. This indicates local DB credential/environment mismatch, not a test assertion failure.

## CodeGraph change index

Before:

- `apps/api/src/crmRoutes.db.test.ts` already contained sequential duplicate checks for client name and product SKU/name.
- Existing covered race/idempotency evidence in this file focused on contact duplicate email and opportunity duplicate-id.
- `apps/api/src/crm/clientCommandHandlers.ts` already mapped `clients_tenant_id_name_uidx` Postgres `23505` to `client_name_taken`.
- `apps/api/src/crmRoutes.ts` already mapped `products_tenant_id_sku_uidx` and `products_tenant_id_name_uidx` Postgres `23505` to `product_sku_taken` / `product_name_taken`.

After:

- Added tests in `apps/api/src/crmRoutes.db.test.ts`:
  - `keeps client name writes conflict-safe under concurrent create and update`
  - `keeps product SKU and name writes conflict-safe under concurrent create and update`
- No production symbols added/changed/removed.
- No route, parser, repository, schema, or migration nodes changed.
- Added documentation/evidence files outside the CodeGraph source symbol set.

## Remaining risks

- The new tests do not assert audit-event counts; they intentionally focus on HTTP conflict/idempotency semantics and final DB row uniqueness.
- Local working tree contains unrelated dirty files from other slices; this slice did not touch them.

## Orchestrator Verification

After the agent report, the orchestrator reran the targeted DB tests with the working local database URL (postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55433/kiss_pm). Result: passed; 1 file passed, 2 tests passed, 12 skipped. This upgrades the slice from DB-verification-blocked to done for client/product duplicate race coverage.
