# Phase 12 — Production SaaS Hardening and Market Release

## 1. Phase Objective

Prepare KISS PM for controlled market release by proving the complete operational loop, production-like deployment readiness, tenant isolation, permission enforcement, audit coverage, recovery behavior, operator readiness, and absence of live external-service dependencies on critical paths. Phase 12 is not a feature-polish phase; it is the release gate that turns the accepted P3-P11 product into a deployable, observable, supportable SaaS release candidate.

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
- `docs/phases/PHASE_11_INTEGRATIONS_MIGRATION.md`

## 2.1 Scope Lock

Scope status: `frozen`.

Implementation may start only after this contract, `docs/status/phase12-requirements-matrix.json`, and P12 verifier support pass tracking verification. Later scope changes must update this document before product code changes.

Canonical Phase 12 E2E IDs are `E2E-110..115` from `docs/04_MASTER_PHASE_PLAN.md` and `docs/e2e/E2E_SCENARIOS.md`. Older UX catalog references to `E2E-120..122` are treated as stale UX-screen references until a separate docs-sync task updates them; they are not the P12 phase gate IDs.

## 2.2 KISS PM Simplicity Target

Release readiness must feel like an operator checklist with evidence, not a pile of internal logs. The operator sees a clear readiness state, failing checks with recovery text, links to command evidence, and one primary next action: run readiness checks or open the blocker. Internally, Phase 12 must remain strict: no fake green, no skipped E2E, no live external dependency, no permission-only UI proof, and no release claim without audit, readback, reload, and cleanup evidence.

## 3. Functional Scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P12-001 | `docs`, deployment scripts/config | Production deployment and environment contract | Define repeatable production-like deployment, env variable contract, health checks, and secret-management rules | App/API can boot in production-like mode without development assumptions; missing required env is reported safely; secrets are not committed or exposed | E2E-113 | deploy smoke, typecheck/lint | No real cloud account provisioning or production credentials | Deployment docs, env example checks, smoke evidence |
| P12-002 | `apps/api`, `apps/web`, ops/readiness runtime | Observability, error monitoring, and release readiness read model | Expose release readiness/health evidence for logs, metrics where practical, error boundaries, dependency state, build/runtime version, and open blockers | Operator can run/read readiness checks; failed checks are typed and actionable; no sensitive data is logged or shown | E2E-113, E2E-115 | unit/API/UI/E2E | No paid observability vendor integration unless configured as inert adapter | Readiness API/UI evidence |
| P12-003 | `docs`, `apps/api`, recovery runtime | Backup/restore or deterministic recovery smoke | Define and prove a controlled recovery smoke appropriate for the in-memory/test runtime and future persistence path | Recovery command/check is permission-checked, audited, restores usable state, and documents production backup/restore requirements | E2E-114 | API/E2E/manual docs check | No real production database backup execution without credentials | Recovery smoke and policy evidence |
| P12-004 | `packages/access-control`, `apps/api`, docs/security | Security, privacy, and audit review fixes | Review release path for secrets, unsafe logs, tenant leakage, direct mutation bypass, and missing audit | Critical/Important findings are fixed; valid non-code risks become explicit blockers; security report is linked from matrix | E2E-111, E2E-112 | security review, tests | No external penetration test certification | Security/audit review evidence |
| P12-005 | `apps/api`, `apps/web`, `packages/access-control` | Full permission and tenant-isolation matrix smoke | Verify core roles across CRM, project, Gantt, resources, KPI, control actions, retrospectives, tenant config, integrations, and ops surfaces | UI visibility and direct API denial align; Tenant A cannot read/mutate Tenant B data across critical routes and surfaces | E2E-111, E2E-112 | API/UI/E2E | No exhaustive enterprise ABAC builder beyond existing access profiles | Permission/isolation smoke evidence |
| P12-006 | `apps/api`, `apps/web` | Operator release readiness surfaces and governed ops commands | Build `/ops/release-readiness`, `/ops/permission-smoke`, `/ops/tenant-isolation`, and `/ops/recovery-smoke` or equivalent operator surfaces | Russian UI shows loading/empty/error/denied/ready/failing states, audit/result evidence, and latest run after reload | E2E-113, E2E-114 | component/API/E2E | No generic DevOps console or CI runner replacement | Operator UI/API evidence |
| P12-007 | `docs`, `packages/shared-test-fixtures`, tenant config | Demo tenant, sample template pack, and onboarding/operator docs | Ship deterministic demo tenant/sample template pack plus tenant/operator onboarding docs | New tenant/admin can follow docs to understand first run; demo pack supports E2E-110 without live services | E2E-110 | fixture/doc tests, manual review | No industry-wide template marketplace | Demo fixture/docs evidence |
| P12-008 | `e2e`, `apps/api`, `apps/web` | Full critical journey orchestration without live services | Connect accepted P3-P11 flows into one release-critical journey from tenant config and CRM opportunity to closure and retrospective action | Journey uses UI plus API/domain readback, audit, reload, and cleanup; no live external service required | E2E-110, E2E-115 | Playwright E2E | No new domain capabilities outside blocker fixes | Critical journey evidence |
| P12-009 | `packages/shared-test-fixtures`, `e2e/tests/phase12` | Deterministic Phase 12 fixtures and E2E-110..115 | Seed release demo tenant, roles, permissions, cross-tenant data, ops smoke state, recovery state, and mock external services | E2E-110..115 prove full path, permission matrix, tenant isolation, deploy smoke, recovery smoke, no-live-dependency, audit/readback/reload/cleanup | E2E-110..115 | fixture tests, Playwright E2E | No skipped/flaky scenarios or live vendor dependencies | Fixture/E2E evidence |
| P12-010 | `docs/status`, `scripts` | Phase 12 verification matrix and market release exit gate | Track P12-001..P12-010 with structured evidence and strict verifier support | Strict verifier fails blocked rows, stale evidence, wrong E2E paths, placeholder blockers, missing cleanup, missing release E2E metadata, and phase exit without E2E-110..115 | E2E-110..115 | strict matrix verifier | No `--allow-blocked` release acceptance and no prose-only release claim | Passing strict matrix verifier and final command log |

## 4. Non-Scope

- Real cloud account provisioning, DNS, payment processor setup, or production credential handling in this repository.
- Enterprise marketplace, industry-wide template library, billing/licensing implementation, and AI autonomous decision-making.
- Full disaster-recovery automation against a live production database unless credentials and environment are explicitly supplied.
- External security certification or penetration-test report. Phase 12 performs internal release security review and records external-certification follow-up if required.
- New product-domain features that belong to P3-P11 unless they are blocker fixes required for the release gate.
- Replacing existing deterministic test-runtime architecture with a new persistence layer solely to pass P12.

## 5. Domain Model Changes

Entities, value objects, DTOs, and events:

- `ReleaseReadinessRun`
- `ReleaseReadinessCheck`
- `ReleaseBlocker`
- `OperationalHealthStatus`
- `DeploymentSmokeResult`
- `PermissionSmokeRun`
- `TenantIsolationSmokeRun`
- `RecoverySmokeRun`
- `OperatorAuditEvent`
- `DemoTenantTemplatePack`
- `ReleaseEvidenceArtifact`

Invariants:

- Every readiness, permission, tenant-isolation, and recovery run belongs to one tenant/operator context.
- Ops commands require backend/application permission such as `ops.read` or `ops.execute`.
- Readiness evidence must not expose secrets, raw credentials, private external payloads, or tenant B private data.
- A readiness check cannot be marked passed without fresh command, exit code or typed runtime result, timestamp, and evidence link/readback.
- Recovery smoke must be auditable and must prove usable state after recovery.
- Full critical journey must use mocked/stubbed external services only.
- Release accepted means P12 strict matrix passes without `--allow-blocked`; earlier phase green status alone is insufficient.

## 6. API Contracts

Minimum Phase 12 routes:

- `GET /api/ops/release-readiness`
- `POST /api/ops/release-readiness/run`
- `GET /api/ops/release-readiness/runs/:runId`
- `GET /api/ops/permission-smoke`
- `POST /api/ops/permission-smoke/run`
- `GET /api/ops/tenant-isolation`
- `POST /api/ops/tenant-isolation/run`
- `GET /api/ops/recovery-smoke`
- `POST /api/ops/recovery-smoke/run`
- `GET /api/ops/audit`

Minimum DTOs:

- readiness summary with status `not_run | running | passed | failed | blocked`;
- check result with id, category, expected, actual, status, severity, command/evidence, checkedAt, and recoveryText;
- deployment smoke result with API health, web shell reachability, build/runtime version, env validation, and live-external-dependency status;
- permission smoke result with role, surface/action/API path, expected UI state, expected API result, actual result, and failure details;
- tenant-isolation smoke result with source tenant, attempted target tenant/entity, UI/API/search path, and no-leak proof;
- recovery smoke result with before/after state, command, audit id, and reset/readback evidence;
- operator audit event with actor, permission, command, before/after summary, result, and timestamp.

Permission keys:

- `ops.read`
- `ops.execute`
- `ops.audit.read`
- `release.readiness.read`
- `release.readiness.execute`

Typed errors:

- `permission_denied`
- `tenant_mismatch`
- `readiness_run_not_found`
- `readiness_check_failed`
- `deployment_smoke_failed`
- `permission_smoke_failed`
- `tenant_isolation_failed`
- `recovery_smoke_failed`
- `external_service_dependency_detected`
- `secret_exposure_detected`
- `release_blocked`
- `stale_readiness_run`

## 7. UI Surfaces

- `/ops/release-readiness`:
  - release gate summary;
  - checklist grouped by deployment, observability, security, permissions, isolation, recovery, docs, E2E, and matrices;
  - one primary action: run readiness check;
  - evidence links, failures, recovery text, latest run after reload.

- `/ops/permission-smoke`:
  - core role/action matrix;
  - UI availability and direct API denial/pass evidence;
  - rerun failed checks.

- `/ops/tenant-isolation`:
  - Tenant A/B smoke scenarios;
  - API/control surface/search isolation evidence;
  - no-leak details without exposing private data.

- `/ops/recovery-smoke`:
  - recovery scenario list;
  - run recovery smoke;
  - before/after readback and operator audit.

Required states: loading, empty/not-run, running, ready, passed, failed, blocked, permission denied, API error, stale run, recovery succeeded.

User-facing copy must be Russian by default. These are operator control surfaces, not static release notes.

## 8. E2E Scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-110 | Full happy path from CRM opportunity to project closure | Multiple roles | Seed Tenant A release demo tenant | `e2e/tests/phase12/full-critical-journey.spec.ts` | planned |
| E2E-111 | Full permission matrix smoke across core roles | Operator admin plus core roles | Seed Tenant A role matrix | `e2e/tests/phase12/permission-matrix-smoke.spec.ts` | planned |
| E2E-112 | Tenant isolation smoke across control surfaces, actions, API, and search | Tenant A/B users | Seed Tenant A/B private data | `e2e/tests/phase12/tenant-isolation-full.spec.ts` | planned |
| E2E-113 | Production-like deployment smoke | Operator admin | Production-like seed | `e2e/tests/phase12/production-deploy-smoke.spec.ts` | planned |
| E2E-114 | Backup/restore or data recovery smoke | Operator admin | Recovery smoke seed | `e2e/tests/phase12/recovery-smoke.spec.ts` | planned |
| E2E-115 | No critical path depends on live external services | Multiple roles | Mock adapters only | `e2e/tests/phase12/no-live-external-dependency.spec.ts` | planned |

Required assertion pattern:

- User/operator sees starting state.
- Authorized actor executes the readiness/recovery/product action.
- Unauthorized or out-of-tenant actor is denied through UI and direct API where applicable.
- UI shows resulting state.
- API/domain readback proves changed state or non-mutation, as applicable.
- Audit/action evidence exists for management and ops commands.
- Related projections/control surfaces refresh.
- Reload keeps evidence and state.
- Cleanup/reset is verified.

## 9. Unit and Integration Tests

- Release readiness domain tests for status aggregation, stale evidence detection, blocker severity, and secret redaction.
- API tests for ops routes, env validation, readiness run readback, permission guards, tenant isolation, stale run handling, and typed errors.
- Permission-smoke tests covering core roles and direct API denial for representative P3-P11 mutation routes.
- Tenant-isolation tests covering core API/read models and control-surface/action paths.
- Recovery-smoke tests proving before/after readback, audit, no partial state, and reset.
- Web component tests for release readiness, permission smoke, tenant isolation, and recovery smoke surfaces.
- Matrix verifier regression tests for P12 rows, E2E-110..115 ids, paths, blocked-row freshness, placeholder blockers, cleanup, and strict structured E2E evidence.

## 10. Test Data and Fixtures

Seed Tenant A:

- operator admin, tenant admin, project manager, resource manager, executive, executor, read-only observer, integration admin;
- release demo opportunity, process template, project plan, tasks, resource load/overload, KPI thresholds, control signals, retrospective/closure data, integration mock payload, tenant configuration pack;
- ops readiness seed, permission-smoke matrix, recovery-smoke scenario, and mock external-service state.

Seed Tenant B:

- private opportunity/project/tasks/resources/KPI/control surfaces/mappings used only for no-leak isolation checks.

Reset rules:

- Phase 12 reset restores release readiness runs, permission smoke runs, tenant isolation smoke runs, recovery state, demo tenant release journey state, action executions, audits, imported mock adapter state, and created canonical entities.
- E2E must not depend on live external services, production credentials, random IDs, or order-dependent fixtures.
- Write-flow E2E must prove cleanup/readback or deterministic in-memory restoration.

## 11. Phase Exit Gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P12-001..P12-010 implemented.
- [ ] Mandatory E2E scenarios E2E-110..115 implemented and passing through `npm run test:e2e:phase -- --phase=12`.
- [ ] Full critical journey from tenant configuration and CRM opportunity to project closure, retrospective action, and audit passes.
- [ ] Permission matrix smoke proves UI visibility and direct API backend enforcement across core roles.
- [ ] Tenant isolation smoke proves no cross-tenant leakage across control surfaces, actions, API, and search/read models.
- [ ] Production-like deployment smoke passes with safe env/config validation and no committed secrets.
- [ ] Recovery smoke or documented recovery check passes for the supported environment.
- [ ] No critical path depends on live external services.
- [ ] Unit/integration/component tests pass for changed modules.
- [ ] Full `npm test`, `npm run typecheck`, and `npm run lint` pass.
- [ ] Security, permission, tenant isolation, audit, data retention, backup/recovery, observability, and onboarding docs are updated.
- [ ] `docs/status/phase12-requirements-matrix.json` passes strict verifier without `--allow-blocked`.
- [ ] Earlier phase strict matrices still pass or any regression is fixed before release acceptance.
- [ ] No unresolved Critical, Important, or Medium review findings remain in the release path.
- [ ] Docs, matrix, handoff, and agent-bus state are updated.

## 12. Risks and Decisions

- P12 uses `E2E-110..115` as the canonical phase gate ids. UX docs that mention `E2E-120..122` are stale and should be synchronized later without changing this phase gate.
- Production backup/restore is environment-dependent. In the current deterministic runtime, P12 must at minimum prove a controlled recovery smoke and document the production backup/restore strategy.
- Observability is implemented as practical local/readiness evidence unless external telemetry credentials are provided; vendor-specific exporters are future adapter/config work.
- Release acceptance is explicitly stricter than P3-P11 acceptance: P12 must prove the full end-to-end operational loop and market-release checklist, not only a new feature surface.
