# Phase 11 — Integrations and Migration

## 1. Phase Objective

Add controlled integration and migration capability without letting external systems become the KISS PM domain core. Phase 11 must let an integration admin preview and apply deterministic imports from mocked adapters, preserve canonical CRM/project/task/resource behavior after import, track external mappings and idempotency, expose safe failure diagnostics, and prove the imported project can be operated after the adapter is disconnected.

## 2. Source Documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/01_PRD.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/USER_STORIES_P3_P12.md`
- `docs/product/ROLE_BASED_JOURNEYS.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/product/UX_SALES_QUALITY_GATE.md`
- `docs/phases/PHASE_8_CONTROL_SURFACES_ACTION_ENGINE.md`
- `docs/phases/PHASE_9_CLOSED_PORTFOLIO_RETROSPECTIVES.md`
- `docs/phases/PHASE_10_NO_CODE_TENANT_CUSTOMIZATION.md`

## 2.1 Scope Lock

Scope status: `frozen`.

Implementation may start only after this contract, `docs/status/phase11-requirements-matrix.json`, and P11 verifier support pass tracking verification. Any later scope change must update this document before product code changes.

## 2.2 KISS PM Simplicity Target

Integrations must feel like a guided import and diagnostics workspace, not a raw ETL console. The default path is: choose a configured adapter, preview imported canonical entities and validation issues, apply through a governed command, inspect mapping/audit evidence, and continue operating the project inside KISS PM even if the adapter is offline. Internally, imports remain tenant-scoped, idempotent, auditable, retry-aware, and isolated from canonical domain identity.

## 3. Functional Scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P11-001 | `packages/integrations`, `packages/access-control` | Integration adapter foundation and ExternalMapping model | Define adapter contracts, connection metadata, tenant-scoped `ExternalMapping`, idempotency keys, payload envelopes, sync audit events, and integration permissions | External IDs never become canonical IDs; every mapping belongs to one tenant/source/entity; idempotency keys are deterministic and reusable across preview/apply | E2E-100, E2E-101, E2E-104 | unit tests, verifier | No live vendor SDK or production credential storage | Domain tests and matrix evidence |
| P11-002 | `packages/integrations`, `packages/crm-core`, `packages/project-core` | Mock adapter canonical import preview | Mock adapter payloads map to canonical opportunity/project/task data through a non-mutating preview | Preview reports creates/updates/skips, validation issues, affected canonical entities, and no partial mutation | E2E-100 | unit tests | No Bitrix/Amo live calls or arbitrary file import formats | Preview readback evidence |
| P11-003 | `packages/integrations`, `apps/api` | Idempotent import apply and mapping persistence | Applying the same import batch twice updates/skips existing canonical records without duplicates | Repeated import reuses mappings, returns idempotent result, and exposes mapping diagnostics | E2E-101, E2E-104 | unit/API/E2E | No conflict-resolution UI beyond deterministic safe choices | Idempotency/mapping evidence |
| P11-004 | `packages/integrations`, `apps/api` | Sync audit, retry/rate-limit, and safe failure model | Adapter failures, rate limits, retries, and validation failures produce structured audit/diagnostic events without corrupting canonical state | Failure state is visible and recoverable; failed apply does not create partial canonical entities; retry metadata is tenant-scoped | E2E-102, E2E-104 | unit/API/E2E | No background worker infrastructure unless already present | Failure/audit evidence |
| P11-005 | `packages/integrations`, `apps/api` | Migration validation report and dry-run summary | Import preview returns a validation report with counts, issues, sample mappings, and unsafe-change blockers | Migration can be validated before apply; report includes expected creates/updates/skips/errors and recovery text | E2E-100, E2E-102 | unit/API tests | No production cutover tooling or backup/restore | Validation report evidence |
| P11-006 | `apps/api` | Integrations API and governed import commands | Expose adapter list, connections, import preview/apply, import batch readback, mapping readback, audit, and diagnostics routes | Preview is non-mutating; apply requires permission and fresh preview; read-only/out-of-tenant calls are denied without leakage; audit/action evidence exists | E2E-100, E2E-101, E2E-102, E2E-104 | API integration tests | No UI-only mutation path and no direct domain writes from control surfaces | API permission/readback evidence |
| P11-007 | `apps/web` | Integration Admin Diagnostics UI | Build Russian admin diagnostics surface for adapters, import preview/apply, mapping table, failure state, retry/recovery text, and audit evidence | UI uses API readback, shows loading/empty/error/denied/failure/success states, and never treats a toast as mutation proof | E2E-102, E2E-104 | component/E2E | No generic BI import dashboard or full marketplace | UI evidence |
| P11-008 | `apps/api`, `apps/web`, `packages/project-core` | Imported project works without adapter | Imported canonical project/task/opportunity data remains usable after the adapter is disconnected or failing | User can open and operate imported project through existing canonical project/task surfaces without live external dependency | E2E-103 | API/UI/E2E | No new project lifecycle feature beyond imported-source continuity | Canonical operation evidence |
| P11-009 | `packages/shared-test-fixtures`, `e2e/tests/phase11` | Deterministic Phase 11 fixtures and E2E-100..104 | Seed mock adapter payloads, tenant A/B users, import batches, mappings, failure modes, and reset hooks | E2E proves UI + API/domain readback, backend denial, audit evidence, reload persistence, adapter disconnect behavior, and cleanup/reset | E2E-100..104 | fixture tests, Playwright E2E | No random IDs, live services, skipped/flaky scenarios | Fixture/E2E evidence |
| P11-010 | `docs/status`, `scripts` | Phase 11 verification matrix and exit gate | Track P11-001..P11-010 with structured evidence and strict verifier support | Strict verifier fails blocked rows, missing rows, stale evidence, placeholder blockers, wrong E2E paths, missing cleanup, and phase exit without E2E-100..104 metadata | E2E-100..104 | strict matrix verifier | No `--allow-blocked` phase exit and no planned E2E as evidence | Passing strict matrix verifier and final command log |

## 4. Non-Scope

- Dependence on live production Bitrix24, AmoCRM, MS Project, Slack, email, calendar, or other external systems in E2E.
- Vendor-specific branches in canonical CRM, project, task, KPI, resource, control-surface, or action-engine domain logic.
- External IDs as primary internal identifiers.
- Arbitrary user-authored import scripts, SQL, JavaScript, or executable mapping code.
- Integration marketplace, OAuth production credential vault, background sync scheduler, billing, and production observability beyond the safe deterministic test/runtime architecture.
- Unsafe writes back to customer systems. If an export/write-back stub is introduced, it must be inert, previewed, confirmed, permission-checked, and audited.
- Full MS Project parity or MSPDI/XML round-trip. Phase 11 may document an import/export decision, but full scheduling interchange belongs to later explicit work unless required by P11 E2E.
- Production backup/restore, disaster recovery, and market-release hardening. Phase 12 owns those gates.

## 5. Domain Model Changes

Entities and value objects:

- `IntegrationAdapterDefinition`
- `IntegrationConnection`
- `IntegrationCapability`
- `ExternalPayloadEnvelope`
- `ExternalMapping`
- `ExternalMappingDiagnostic`
- `ImportBatch`
- `ImportPreview`
- `ImportValidationIssue`
- `ImportApplyResult`
- `MigrationValidationReport`
- `IdempotencyKey`
- `SyncAuditEvent`
- `AdapterFailure`
- `RetryPolicy`
- `RateLimitPolicy`
- `AdapterHealthStatus`

Invariants:

- Every integration object belongs to exactly one tenant.
- External IDs are stored only in mappings and adapter DTOs, not as canonical entity identity.
- Preview must not mutate canonical state, mappings, or audit events except for optional preview diagnostics explicitly marked temporary and resettable.
- Apply requires a fresh preview token, backend permission, actor, timestamp, idempotency key, and audit/action evidence.
- Repeated apply with the same adapter source, external ID, canonical entity type, and idempotency key must not duplicate canonical entities.
- Failed adapter calls and validation errors must not partially mutate canonical data.
- Canonical opportunity/project/task/resource operations must continue after adapter disconnect.
- Mapping diagnostics must not expose secrets, raw credentials, or private payload fields outside authorized admin diagnostics.

## 6. API Contracts

Minimum Phase 11 routes:

- `GET /api/integrations/adapters`
- `GET /api/integrations/connections`
- `GET /api/integrations/connections/:connectionId/health`
- `POST /api/integrations/imports/preview`
- `POST /api/integrations/imports/apply`
- `GET /api/integrations/imports/:batchId`
- `GET /api/integrations/mappings`
- `GET /api/integrations/mappings/:mappingId`
- `GET /api/integrations/audit`
- `GET /api/integrations/diagnostics`
- `POST /api/integrations/test-adapters/:adapterId/failure-mode`

Minimum DTOs:

- adapter/connection read model with capabilities and safe health status;
- import preview request with connection id, adapter source, payload fixture key, target entity set, and dry-run options;
- import preview response with preview id, validation report, create/update/skip/error counts, expected canonical references, mapping preview, and blockers;
- apply request with preview id, idempotency key, confirmation flag, and optional reason;
- apply result with batch id, canonical entity refs, mapping ids, audit/action ids, idempotent result status, warnings, and refresh hints;
- mapping diagnostics list with source system, external entity type/id, canonical entity type/id, last sync status, last batch id, and safe metadata;
- sync audit event with actor, tenant, adapter, command, before/after summary, result, failure reason, and timestamp.

Permission keys:

- `integration.read`
- `integration.preview`
- `integration.apply`
- `integration.mapping.read`
- `integration.audit.read`
- `integration.admin`

Typed errors:

- `permission_denied`
- `tenant_mismatch`
- `adapter_not_found`
- `connection_not_found`
- `adapter_unavailable`
- `adapter_rate_limited`
- `adapter_failure`
- `import_preview_required`
- `stale_preview`
- `invalid_payload`
- `mapping_conflict`
- `idempotency_conflict`
- `migration_validation_failed`
- `partial_import_rejected`
- `secret_not_exposed`

## 7. UI Surfaces

- `/admin/integrations` Integration Admin Diagnostics:
  - adapter/connection list with safe health status;
  - import preview wizard with one clear primary action;
  - validation report with creates/updates/skips/errors and recovery text;
  - apply governed import command and audit/result feedback;
  - external mapping diagnostics table;
  - failure state panel with retry/rate-limit context;
  - loading, empty, error, denied, stale-preview, mutation-pending, and mutation-success states.

- Existing canonical surfaces:
  - CRM Intake Control must show imported opportunity references without adapter-specific logic.
  - Project/Task surfaces must open imported canonical project/task data after adapter disconnect.
  - Admin diagnostics must link from mapping to canonical entity where existing routes allow it.

User-facing copy must be Russian by default. Diagnostics are operational admin tools, not passive reports or generic tables.

## 8. E2E Scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-100 | Mocked adapter imports data into canonical model | Integration admin | Mock adapter payload with opportunity, project, task, assignment seeds | `e2e/tests/phase11/adapter-import.spec.ts` | planned |
| E2E-101 | Repeated import is idempotent | Integration admin | Same mock adapter payload and idempotency key | `e2e/tests/phase11/adapter-idempotency.spec.ts` | planned |
| E2E-102 | Failed adapter call produces visible safe failure state | Integration admin | Mock failing/rate-limited adapter mode | `e2e/tests/phase11/adapter-failure.spec.ts` | planned |
| E2E-103 | Imported project works without adapter after import | Project manager | Imported canonical project and adapter disconnected | `e2e/tests/phase11/imported-project-canonical.spec.ts` | planned |
| E2E-104 | External mapping is visible in admin diagnostics | Integration admin | Applied import with mappings and audit events | `e2e/tests/phase11/external-mapping-diagnostics.spec.ts` | planned |

Required assertion pattern:

- User sees starting adapter/import state.
- Authorized integration admin previews import before apply.
- Preview does not mutate canonical entities or persistent mappings.
- Authorized user applies through governed API command.
- Unauthorized/read-only/out-of-tenant users cannot preview/apply/mutate through UI or direct API.
- UI shows import result, mapping diagnostics, audit/action evidence, and safe failure state where relevant.
- API/domain readback proves canonical opportunity/project/task data, mappings, idempotent behavior, and audit.
- Imported project continues to operate after adapter disconnect/failure.
- Reload keeps canonical state and diagnostics.
- Cleanup/reset is verified with deterministic fixture readback.

## 9. Unit and Integration Tests

- Adapter contract tests for capabilities, payload envelopes, typed failures, retry/rate-limit metadata, and deterministic fixture behavior.
- ExternalMapping tests for tenant isolation, source/entity uniqueness, idempotent lookup, no external-id canonical identity leakage, and diagnostics-safe metadata.
- Import preview tests for non-mutating create/update/skip/error reports and validation issues.
- Import apply tests for fresh preview requirement, idempotency, mapping persistence, canonical entity creation/update, audit/action evidence, and no partial mutation.
- API integration tests for adapter list, health, preview, apply, batch readback, mapping diagnostics, audit, permissions, Tenant B no-leak behavior, stale preview, invalid payload, and failure-mode recovery.
- Web component tests for Integration Admin Diagnostics loading/empty/error/denied states, preview-before-apply, apply via API readback, stale preview recovery, failure panel, mapping table, and audit/result feedback.
- Matrix verifier regression tests for P11 required rows, E2E ids, paths, placeholder blockers, cleanup, and strict structured E2E evidence.

## 10. Test Data and Fixtures

Seed Tenant A:

- integration admin, project manager, read-only observer;
- mock CRM/project adapter definition and connection;
- deterministic external opportunity, project, task, assignment, contact/account payloads;
- import preview samples for create/update/skip/error cases;
- idempotency key samples;
- mapping diagnostics samples after apply;
- adapter failure modes: unavailable, rate-limited, invalid payload;
- canonical project/task state proving post-import operation after adapter disconnect.

Seed Tenant B:

- separate mock connection, private external ids, private canonical entities, and mapping data for tenant-isolation tests.

Reset rules:

- Phase 11 reset restores adapter modes, import previews/batches, mappings, sync audit events, canonical entities created by P11 tests, and imported-project operation state.
- No live external services, production data, random IDs, order-dependent fixtures, or skipped/flaky E2E.
- Write-flow E2E must prove reset/readback or deterministic in-memory restoration.

## 11. Phase Exit Gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P11-001..P11-010 implemented.
- [ ] Mandatory E2E scenarios E2E-100..104 implemented and passing through `npm run test:e2e:phase -- --phase=11`.
- [ ] Earlier impacted critical E2E scenarios still passing.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass.
- [ ] External systems remain adapters and never become canonical domain identity.
- [ ] Import preview is non-mutating and required before apply.
- [ ] Apply is governed, permission-checked, idempotent, auditable, and refreshes read models.
- [ ] Adapter failure/rate-limit states are visible and do not corrupt canonical state.
- [ ] External mappings are tenant-scoped, diagnostic-safe, and visible to authorized admins.
- [ ] Imported projects/tasks remain operable without live adapter dependency.
- [ ] Permissions enforced at backend/application layer and proven by UI visibility plus direct API denial.
- [ ] API/domain readback, projection refresh, reload persistence, and cleanup/reset are proven for write flows.
- [ ] `docs/status/phase11-requirements-matrix.json` passes without `--allow-blocked`.
- [ ] No unresolved Critical or Important review findings remain.
- [ ] Docs, matrix, handoff, and agent-bus state are updated.

## 12. Risks and Decisions

- P11 E2E ids are E2E-100..104, following `docs/04_MASTER_PHASE_PLAN.md` and `docs/e2e/E2E_SCENARIOS.md`.
- The first executable adapter is deterministic/mock by default. A Bitrix24 adapter can be added only as an adapter-specific implementation behind the same contracts; it must not leak Bitrix-specific names into canonical models.
- `POST /api/integrations/test-adapters/:adapterId/failure-mode` is test/admin-runtime only and must be guarded so normal users cannot change adapter failure behavior.
- Migration validation is in scope; production data cutover, backup/restore, and release readiness are P12 concerns.
- If existing P3/P4 surfaces lack enough imported-source hints, implementation should add narrow source/mapping readback fields rather than rewrite CRM/project/task flows.
