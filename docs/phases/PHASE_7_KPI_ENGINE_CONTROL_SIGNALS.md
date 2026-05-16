# Phase 7 — KPI Engine and Control Signals

## 1. Phase objective

Implement the configurable KPI engine that turns canonical project, schedule, resource, and workflow state into traceable KPI evaluations and control signals. A tenant admin must be able to publish a safe KPI definition and threshold version, the system must evaluate deterministic source data, users must see explainable KPI deviations, and unauthorized users must be denied by backend/application guards.

## 2. Source documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/01_PRD.md`
- `docs/02_UNIVERSAL_PROJECT_BP.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/KPI_ENGINE_SPEC.md`
- `docs/domain/ACTION_ENGINE_SPEC.md`
- `docs/domain/CONTROL_SURFACE_ENGINE_SPEC.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/product/UX_SALES_QUALITY_GATE.md`
- `docs/phases/PHASE_6_RESOURCE_PLANNING_CONFLICT_RESOLUTION.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document, `docs/status/phase7-requirements-matrix.json`, and P7 verifier support pass tracking verification. Any later scope change must reference a decision record and update this document before product code changes.

## 2.2 KISS PM simplicity target

The user workflow stays simple: configure a KPI with safe source bindings and thresholds, publish a version, let the engine evaluate project state, open the KPI deviation, see source/formula/threshold trace, and choose the next governed management path. Internally, formula safety, source binding validation, versioning, threshold severity, tenant isolation, permission checks, audit, historical immutability, and deterministic fixtures must remain testable outside the UI.

## 3. Functional scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P7-001 | `packages/kpi-engine`, `packages/tenant-config` | KPI definitions, formulas, thresholds, and versioning | Define tenant-owned `KpiDefinition`, `FormulaDefinition`, and `ThresholdRuleSet` models with active versions and immutable published history | Definitions are tenant-scoped, versioned, reject malformed config, and historical evaluations keep definition/formula/threshold versions | E2E-060, E2E-063, E2E-064 | unit tests, typecheck | No arbitrary JavaScript/SQL, no full P10 no-code builder | Unit/API/E2E evidence and matrix row update |
| P7-002 | `packages/kpi-engine` | Safe constrained formula evaluation | Evaluate formulas from named source bindings and a constrained function set | Formula execution is deterministic, finite, side-effect-free, rejects unknown bindings/functions, and cannot access runtime code/network/filesystem | E2E-060, E2E-061, E2E-062, E2E-063 | unit tests | No tenant-provided executable code, dynamic imports, or BI semantic layer | Unit/E2E evidence and matrix row update |
| P7-003 | `packages/kpi-engine`, `packages/project-core`, `packages/scheduling-engine`, `packages/resource-planning` | KPI source bindings and evaluation periods | Resolve canonical source data for project delay, work variance, progress variance, resource utilization, and stage/approval aging | Source traces include entity ids, source fields, period, snapshot time, and tenant; Tenant B source data cannot affect Tenant A evaluation | E2E-061, E2E-062 | unit/integration tests | No financial KPI if financial source data is not implemented yet | Unit/integration/E2E evidence and matrix row update |
| P7-004 | `packages/kpi-engine` | Threshold mapping and severity | Map evaluation values to `none`, `attention`, `warning`, or `critical` severity using versioned threshold rules | Severity is deterministic and explainable; threshold changes affect future evaluations only unless an explicit backfill command exists | E2E-061, E2E-062, E2E-063 | unit/integration tests | No tenant-specific severity labels in domain logic | Unit/integration/E2E evidence and matrix row update |
| P7-005 | `packages/kpi-engine`, `packages/action-engine` | ControlSignal / Deviation creation | Create or update KPI control signals from threshold breaches with status, recommendation keys, and traceability to evaluation | Signals are tenant-scoped, deduplicated by source/evaluation window where appropriate, and trace evaluation/source/threshold versions | E2E-061, E2E-062 | unit/integration tests | No full P8 action execution engine beyond required handoff payloads | Unit/integration/E2E evidence and matrix row update |
| P7-006 | `apps/api`, `packages/kpi-engine`, `packages/action-engine` | KPI API and governed configuration commands | Expose API routes for definitions, publish/retire, evaluation runs, deviations, and audit/readback | Routes validate DTOs, actor/tenant/permissions, deny read-only/cross-tenant mutation, write audit for config changes, and return typed errors | E2E-060, E2E-063, E2E-064 | API integration tests plus E2E | No production auth provider or direct UI mutation path | Integration/E2E evidence and matrix row update |
| P7-007 | `apps/web` | KPI Definition Admin MVP | Add Russian admin surface for creating/validating/publishing KPI definition and threshold versions | Tenant admin sees definitions, safe formula/source preview, validation, publish result, audit evidence, reload persistence, and permission states | E2E-060, E2E-063, E2E-064 | component tests plus E2E | No P10 generic builder, no raw scripting UI | Component/E2E evidence and matrix row update |
| P7-008 | `apps/web`, `packages/kpi-engine` | KPI Deviation Control read surface | Add KPI deviation surface that shows severity, source data, formula trace, threshold trace, owner, status, and recommended next action | User sees a management-control signal, not a passive chart; action buttons may hand off to P8 if action engine is not yet implemented | E2E-061, E2E-062 | component/API/E2E tests | No full Portfolio Control or corrective-action execution; that belongs to P8 | Component/API/E2E evidence and matrix row update |
| P7-009 | `packages/shared-test-fixtures`, `e2e/` | Deterministic Phase 7 fixtures and E2E-060..064 | Seed KPI definitions, project/schedule/resource source data, Tenant B private data, warning/critical deviations, and reset rules | E2E proves UI, API/domain readback, permission denial, audit/config history, version preservation, reload persistence, and cleanup/reset | E2E-060..064 | fixture tests plus E2E | No random IDs, live services, production data, skipped/flaky scenarios | Fixture/E2E evidence and matrix row update |
| P7-010 | `docs/status`, `scripts` | Phase 7 verification matrix and exit gate | Track P7-001..P7-010 and require structured E2E evidence for Phase 7 exit | Strict verifier fails blocked rows, missing tests, missing cleanup, stale metadata, prose-only evidence, placeholder blockers, wrong E2E paths, and missing E2E command/test_path/exit_code/checked_at | E2E-060..064 | `node scripts/verify-requirements-matrix.mjs docs/status/phase7-requirements-matrix.json` | No `--allow-blocked` phase exit and no planned E2E as evidence | Passing strict matrix verifier and final command log |

## 4. Non-scope

- Arbitrary JavaScript, SQL, dynamic imports, network calls, filesystem calls, or tenant-provided executable code in formulas.
- Full P10 no-code KPI builder or visual formula designer beyond the P7 admin MVP.
- Full P8 Portfolio Control, corrective-action creation, accept-risk execution, or generic action-engine builder.
- Predictive AI metrics or opaque automated decisions.
- Financial/margin KPI calculations unless deterministic financial source data already exists.
- Backfilling historical evaluations after threshold changes unless explicitly added by a later decision.
- Tenant-specific KPI labels, process names, roles, or threshold branches in core logic.

## 5. Domain model changes

Entities and value objects:

- `KpiDefinition`
- `FormulaDefinition`
- `SourceBindingDefinition`
- `FormulaExpression`
- `SafeFunctionSet`
- `ThresholdRuleSet`
- `ThresholdRule`
- `EvaluationPeriod`
- `KpiEvaluation`
- `KpiEvaluationTrace`
- `ThresholdEvaluationTrace`
- `ControlSignal`
- `DeviationStatus`
- `KpiDefinitionCommand`
- `KpiEvaluationCommand`
- `KpiAuditReference`

Invariants:

- Every KPI definition, formula, threshold rule set, evaluation, and control signal belongs to exactly one tenant.
- Published formula and threshold versions are immutable for historical evaluation traceability.
- Formula evaluation must be deterministic, finite, side-effect-free, and independent from UI components or route handlers.
- Source bindings must resolve from canonical domain models and include traceable entity/field/period references.
- Threshold severity must be explainable from the versioned rule that matched.
- Control signals must trace to the evaluation that produced them and keep source entity, severity, status, and recommendation keys.
- Read-only and cross-tenant actors must be denied by backend/application services, not only hidden UI buttons.
- KPI deviation handling must be ready to hand off to P8 governed actions without direct control-surface mutation.

## 6. API contracts

Minimum Phase 7 routes:

- `GET /api/kpi/definitions`
- `GET /api/kpi/definitions/:definitionId`
- `POST /api/kpi/definitions/preview`
- `POST /api/kpi/definitions`
- `POST /api/kpi/definitions/:definitionId/publish`
- `POST /api/kpi/definitions/:definitionId/retire`
- `POST /api/kpi/evaluations/run`
- `GET /api/kpi/evaluations/:evaluationId`
- `GET /api/kpi/deviations`
- `GET /api/kpi/deviations/:signalId`
- `GET /api/kpi/audit`

Contracts:

- Read routes validate tenant, actor, scope, entity filters, period filters, and pagination/window parameters.
- Configuration mutation routes require `kpi.config:write`.
- Evaluation run routes require `kpi.evaluate:execute` or an equivalent system/app command permission.
- Deviation read routes require `kpi:read`; any handling action is P8 scope unless P7 explicitly creates a safe handoff record.
- Preview validates formula/source/threshold impact without publishing a version or writing business state.
- Publish creates a new immutable config version and audit/action evidence.
- Evaluation returns value, severity, source trace, formula trace, threshold trace, and evaluation timestamp.
- Errors use typed codes, for example `permission_denied`, `tenant_mismatch`, `definition_not_found`, `formula_invalid`, `source_binding_unknown`, `threshold_invalid`, `evaluation_source_missing`, and `version_conflict`.

## 7. UI surfaces

- `/admin/kpi-definitions` KPI Definition Admin:
  - definition list and editor sheet;
  - safe source-binding selector, formula input/preview, threshold rule editor;
  - primary next action: publish definition version;
  - secondary actions: validate, duplicate, retire;
  - Russian loading/empty/error/denied states;
  - permission explanations for unavailable publish/retire actions;
  - audit/version result feedback after publish.
- `/kpi/deviations` KPI Deviation Control:
  - signal cards/table over KPI evaluations and deviations;
  - severity filters and source trace panel;
  - primary next action: open governed management path for P8 action execution;
  - visible formula, threshold, source data, period, owner, status, and recommended action keys;
  - Russian loading/empty/error/denied states;
  - reload keeps published versions, evaluations, and deviation state.

UI components must render state and call API/application commands. They must not contain KPI formulas, threshold logic, permission policy, or signal creation logic.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-060 | Admin defines KPI threshold for delay or work variance | Tenant admin | Seed Tenant A KPI definition fixture | `e2e/tests/phase7/kpi-threshold.spec.ts` | planned |
| E2E-061 | Project state creates warning/critical control signal | Project manager | Seed Tenant A delayed project/source data fixture | `e2e/tests/phase7/kpi-control-signal.spec.ts` | planned |
| E2E-062 | User opens KPI deviation and sees source/formula/threshold | Project manager | Seed Tenant A KPI deviation fixture | `e2e/tests/phase7/kpi-traceability.spec.ts` | planned |
| E2E-063 | Threshold change affects future evaluation without corrupting history | Tenant admin | Seed Tenant A versioned KPI fixture | `e2e/tests/phase7/kpi-versioning.spec.ts` | planned |
| E2E-064 | Unauthorized user cannot edit KPI definitions | Read-only observer | Seed Tenant A read-only actor and Tenant B private KPI fixture | `e2e/tests/phase7/kpi-permissions.spec.ts` | planned |

Required assertion pattern:

- User sees starting KPI config/source state.
- Authorized user validates or publishes KPI definition/threshold.
- Unauthorized or out-of-tenant user cannot mutate through UI or direct API.
- UI shows resulting definition/evaluation/deviation state.
- API/domain readback proves version/evaluation/signal state.
- Audit/action log exists for configuration changes and evaluation commands where applicable.
- Related KPI deviation projection refreshes.
- Reload keeps published definitions, historical evaluations, and signal trace.
- Cleanup/reset is verified or state is deterministic in-memory/test-only.

## 9. Unit and integration tests

- KPI definition and threshold validation tests.
- Safe formula parser/evaluator tests for allowed operators/functions and rejected unsafe constructs.
- Source binding resolver tests for project delay, work variance, progress variance, resource utilization, stage aging, and missing source data.
- Threshold mapping tests for none/attention/warning/critical severity and rule ordering.
- Versioning tests proving historical evaluations keep old formula/threshold versions.
- Control signal creation/update tests including deduplication and status transitions.
- Tenant isolation and permission tests for definitions, evaluations, deviations, and audit readback.
- API integration tests for definition preview/create/publish/retire, evaluation run, deviation read, typed errors, direct API denial, and no partial mutation on validation failures.
- Web component tests for Russian KPI Definition Admin and KPI Deviation Control states.
- Matrix verifier regression tests for Phase 7 required rows, E2E ids, and mandatory structured E2E evidence.

## 10. Test data and fixtures

- Seed Tenant A:
  - tenant admin, project manager, executive, read-only observer;
  - active project with Phase 5 schedule, baseline, progress, and work variance source data;
  - Phase 6 resource load source data for resource-utilization KPI;
  - KPI definition for schedule variance with warning and critical thresholds;
  - KPI definition draft for publish/versioning flow;
  - historical evaluation using an old threshold version;
  - current evaluation that creates a warning/critical control signal;
  - audit seed/readback support for config publish and evaluation actions.
- Seed Tenant B:
  - private KPI definition, private project/source data, and private deviation for isolation checks.
- Reset rules:
  - E2E fixture reset must be deterministic and isolated by test profile.
  - No live external services, production data, random IDs, or order-dependent fixtures.
  - Publish/evaluation tests must prove cleanup/reset or use in-memory/test-only state reset.

## 11. Phase exit gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P7-001..P7-010 implemented.
- [ ] Mandatory E2E scenarios E2E-060..064 implemented and passing through `npm run test:e2e:phase -- --phase=7`.
- [ ] Earlier critical E2E scenarios still passing.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass where relevant.
- [ ] Formula execution is safe, deterministic, finite, and has no UI/route-handler ownership.
- [ ] KPI definitions, formulas, thresholds, evaluations, and signals are tenant-isolated and versioned.
- [ ] Permissions enforced at backend/application layer and proven by UI visibility plus direct API denial.
- [ ] KPI config publish and relevant evaluation/control-signal commands are audited.
- [ ] KPI Deviation Control refreshes after evaluation/config changes and reload keeps traceability.
- [ ] Cleanup/reset is proven for write-flow E2E.
- [ ] `docs/status/phase7-requirements-matrix.json` passes without `--allow-blocked`.
- [ ] No unresolved Critical or Important review findings remain.
- [ ] Docs, matrix, handoff, and agent-bus state are updated.

## 12. Risks and decisions

- Phase 7 implements KPI engine and signal traceability, but P8 owns full control-surface/action-engine execution for corrective actions, accepted risk, and escalation.
- The E2E ledger and master plan assign Phase 7 to E2E-060..064. The existing P3-P12 UX screen matrix still references E2E-070 for P7 and E2E-060..062 for P10; this needs a follow-up docs-sync before P8/P10 gates.
- Formula customization is intentionally constrained. A later P10 builder may improve authoring UX, but it must not loosen P7 formula safety.
- P7 may use deterministic in-memory runtime state consistent with prior phases until a persistence architecture is finalized; any temporary persistence shortcut must be documented with cleanup/reset evidence.
