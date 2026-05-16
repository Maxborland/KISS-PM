# Phase 9 — Closed Portfolio and Retrospectives

## 1. Phase objective

Make closed projects useful for future planning without silently rewriting history. Phase 9 adds the closure workflow, immutable closed-project snapshots, closed portfolio trend read models, lessons learned, and governed template-improvement actions. The user loop must stay simple: close a project with required evidence, inspect stable plan/fact outcomes, see retrospective trends, create one governed improvement action, and verify audit/readback/reload behavior.

## 2. Source documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/01_PRD.md`
- `docs/02_UNIVERSAL_PROJECT_BP.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/ACTION_ENGINE_SPEC.md`
- `docs/domain/CONTROL_SURFACE_ENGINE_SPEC.md`
- `docs/domain/KPI_ENGINE_SPEC.md`
- `docs/domain/TENANT_CUSTOMIZATION_SPEC.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/USER_STORIES_P3_P12.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/ROLE_BASED_JOURNEYS.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/status/p3-p12-ux-screen-matrix.json`
- `docs/phases/PHASE_8_CONTROL_SURFACES_ACTION_ENGINE.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document, `docs/status/phase9-requirements-matrix.json`, and P9 verifier support pass tracking verification. Any later scope change must update this document before product code changes.

## 2.2 KISS PM simplicity target

The ordinary workflow is not a reporting warehouse. A project manager closes a project through a guided checklist. An executive opens a closed portfolio surface, sees stable outcomes and trends, and creates a governed improvement action. Internally, closure, snapshots, trend calculations, template-improvement proposals, permissions, audit, and reset/readback must be strict and deterministic.

## 3. Functional scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P9-001 | `packages/project-core`, `packages/workflow-engine` | Closure checklist and closure workflow domain | Define required closure data, closure readiness, final KPI/quality/client satisfaction inputs, lesson capture, and close-project preconditions | Project can close only when required closure data exists or an authorized override/risk is audited; open critical tasks/blockers prevent closure unless accepted through governed path | E2E-080 | unit tests, integration tests, E2E | No full document-management or billing workflow | Domain/API/E2E evidence and matrix row update |
| P9-002 | `packages/retrospectives`, `packages/project-core`, `packages/scheduling-engine`, `packages/resource-planning`, `packages/kpi-engine` | ClosedProjectSnapshot model and snapshot creation | Capture tenant-scoped closure snapshot of project lifecycle, stages, tasks, schedule/baseline, resource summary, KPI values, deviations, corrective actions, closure data, and lessons | Snapshot is deterministic, versioned, read-only after creation, and traceable to source project/template versions | E2E-080, E2E-081 | unit/integration tests, E2E | No mutable live analytics warehouse | Snapshot tests and E2E stability evidence |
| P9-003 | `packages/retrospectives`, `apps/api` | Snapshot stability and readback API | Expose closed snapshot readback and prove later live project/template edits do not rewrite closed metrics | Snapshot read API returns stable values after live/project-template changes; attempted mutation is denied; Tenant B cannot read Tenant A snapshots | E2E-081, E2E-082 | integration tests, E2E | No manual snapshot editing UI | API/E2E evidence and matrix row update |
| P9-004 | `packages/retrospectives` | Plan/fact metrics and trend engine | Calculate plan vs fact, variance, recurring delay/overload/KPI drift, and grouping by project type/template/client/period | Trend results are deterministic from snapshots, trace source snapshot ids, and do not use mutable live project state as the source of truth | E2E-082, E2E-083 | unit tests, E2E | No advanced forecasting, ML, or benchmark analytics | Unit/E2E evidence and matrix row update |
| P9-005 | `packages/retrospectives`, `packages/action-engine` | Lessons learned and retrospective insight model | Store lessons and derive actionable retrospective insights with source snapshot/trend trace | Insights have severity/recommendation/source refs, can be marked handled only by governed action, and remain tenant-scoped | E2E-082, E2E-083 | unit/integration tests, E2E | No free-form public knowledge base | Insight tests and action evidence |
| P9-006 | `apps/api`, `packages/control-surfaces`, `packages/retrospectives` | Closed portfolio and trends API/read models | Expose closed portfolio/trends read models for `/retrospectives/closed-portfolio` and `/retrospectives/trends` | API returns closed snapshots, plan/fact summaries, trend signals, allowed actions, permission states, pagination/filter basics, and no executable mutation URLs for read-only users | E2E-082 | API integration tests, E2E | No P10 custom surface builder | API/E2E evidence and matrix row update |
| P9-007 | `apps/web` | Closed portfolio and retrospective trends UI | Implement management-control UI for closed snapshots, trend signals, snapshot drilldown, and improvement action entry | UI shows loading/empty/error/denied states, stable snapshot metrics, trend explanation, one clear next action, API readback, and reload persistence | E2E-082 | component tests, E2E | No generic BI dashboard | UI/E2E evidence and matrix row update |
| P9-008 | `packages/action-engine`, `packages/tenant-config`, `apps/api`, `apps/web` | Template-improvement governed action | Create governed improvement action from retrospective finding with preview, preconditions, permission checks, audit, and future-template-version effect | Authorized user previews and applies improvement; read-only/direct API denial works; audit links source trend/snapshot; future drafts use new template version without rewriting closed snapshots | E2E-083 | unit/API/component/E2E tests | No full P10 no-code builder or arbitrary template scripting | Full write-flow evidence and matrix row update |
| P9-009 | `packages/shared-test-fixtures`, `e2e/tests/phase9` | Deterministic P9 fixtures and E2E-080..083 | Seed closable active project, closed snapshots, later live/template changes, trends, improvement actions, users, Tenant B isolation, and reset data | E2E proves UI, API/domain readback, backend denial, audit/action evidence, snapshot stability, projection refresh, reload persistence, and cleanup/reset for all P9 flows | E2E-080..083 | fixture tests plus E2E | No random ids, live services, production data, skipped/flaky scenarios | Fixture/E2E evidence and matrix row update |
| P9-010 | `docs/status`, `scripts` | Phase 9 verification matrix and exit gate | Track P9-001..P9-010 and require structured E2E evidence for Phase 9 exit | Strict verifier fails blocked rows, missing rows, stale evidence, placeholder blockers, wrong E2E paths, missing cleanup, and phase exit without E2E-080..083 metadata | E2E-080..083 | strict matrix verifier | No `--allow-blocked` phase exit and no planned E2E as evidence | Passing strict matrix verifier and final command log |

## 4. Non-scope

- Full data warehouse, OLAP cube, or public benchmark analytics.
- Advanced forecasting, machine learning, or predictive estimation.
- Full P10 no-code builder, arbitrary template scripting, arbitrary formulas, or user-authored executable code.
- Editing closed snapshots after creation.
- Billing, payment collection, or contract administration closure.
- External integration import/export for historical projects; P11 owns integrations and migration.
- Replacing active Portfolio Control from P8. P9 owns closed portfolio and retrospectives only.

## 5. Domain model changes

Entities and value objects:

- `ClosureChecklist`
- `ClosureRequirement`
- `ClosureData`
- `ProjectClosureDecision`
- `ClosedProjectSnapshot`
- `ClosedSnapshotVersion`
- `SnapshotSourceRef`
- `PlanFactMetric`
- `RetrospectiveTrend`
- `RetrospectiveInsight`
- `LessonLearned`
- `TemplateImprovementAction`
- `TemplateImprovementPreview`
- `TemplateImprovementAuditRef`

Invariants:

- Every closure entity, snapshot, trend, insight, lesson, and improvement action belongs to exactly one tenant.
- Closing a project is a governed workflow command, not a local UI mutation.
- Closed snapshots are immutable after creation; later live project/task/template changes do not silently rewrite snapshot values.
- Snapshot metrics must trace to source project/task/schedule/resource/KPI/control-signal versions or source refs.
- Closed portfolio trends use snapshots as the source of truth.
- Template-improvement actions must trace to the source trend/insight/snapshot and create audit/action evidence.
- Template updates affect future runtime objects only through versioned configuration; closed snapshots stay stable.
- Read-only and out-of-tenant users cannot mutate closure state or improvement actions through UI or direct API.

## 6. API contracts

Minimum Phase 9 routes:

- `GET /api/projects/:projectId/closure`
- `POST /api/projects/:projectId/closure/preview`
- `POST /api/projects/:projectId/closure/apply`
- `GET /api/retrospectives/snapshots`
- `GET /api/retrospectives/snapshots/:snapshotId`
- `GET /api/retrospectives/closed-portfolio`
- `GET /api/retrospectives/trends`
- `GET /api/retrospectives/insights/:insightId`
- `POST /api/retrospectives/insights/:insightId/template-improvement/preview`
- `POST /api/retrospectives/insights/:insightId/template-improvement/apply`
- `GET /api/retrospectives/audit`

Minimum DTOs:

- closure readiness and missing requirements;
- closure preview with snapshot summary and blockers;
- close-project result with snapshot id and audit/action ids;
- closed snapshot read model;
- closed portfolio row read model;
- retrospective trend read model;
- template-improvement preview and apply result;
- audit/action evidence readback.

Permission keys:

- `project.close`
- `project.closure.read`
- `retrospective.read`
- `retrospective.write`
- `retrospective.improvement.write`
- `tenant.config.write`
- `audit.read`

Typed errors:

- `permission_denied`
- `tenant_mismatch`
- `project_not_found`
- `project_not_closable`
- `closure_requirement_missing`
- `closure_preview_required`
- `stale_preview`
- `snapshot_not_found`
- `snapshot_immutable`
- `trend_not_found`
- `insight_not_found`
- `template_improvement_not_allowed`
- `validation_failed`

## 7. UI surfaces

- `/projects/:projectId/closure` Closure Control:
  - readiness checklist;
  - required closure data form;
  - final KPI/quality/client satisfaction and lessons;
  - preview snapshot before close;
  - apply close command;
  - audit/result feedback and snapshot link;
  - denied/read-only/error/retry states.
- `/retrospectives/closed-portfolio` Closed Portfolio Control:
  - closed snapshot table/cards;
  - plan/fact summary;
  - filters by project type/template/client/period;
  - snapshot drilldown;
  - trend signal entry;
  - stable reload readback.
- `/retrospectives/trends` Retrospective Trends:
  - recurring delay/overload/KPI drift trends;
  - source snapshots;
  - recommended template-improvement action;
  - handled/unhandled states and audit side panel.
- Template Improvement flow:
  - evidence from insight/trend/snapshots;
  - proposed template/process/KPI change;
  - dry-run preview for future drafts;
  - apply governed action;
  - audit/result feedback.

User-facing copy must be Russian by default.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-080 | User closes project with required closure data | Project manager | Seed Tenant A active closable project with required closure checklist | `e2e/tests/phase9/project-closure.spec.ts` | planned |
| E2E-081 | Closed project snapshot remains stable after later changes | Project manager | Seed Tenant A closed snapshot plus live/template change path | `e2e/tests/phase9/closed-snapshot-stability.spec.ts` | planned |
| E2E-082 | User opens closed portfolio and sees trend metrics | Executive | Seed Tenant A closed snapshots with plan/fact variance trends | `e2e/tests/phase9/closed-portfolio-trends.spec.ts` | planned |
| E2E-083 | User creates template-improvement action from retrospective finding | Executive/admin | Seed Tenant A retrospective insight and versioned template target | `e2e/tests/phase9/template-improvement-action.spec.ts` | planned |

Required assertion pattern:

- User sees the starting closure/retrospective state.
- Authorized user previews and executes the governed action when state changes.
- Unauthorized or out-of-tenant user cannot execute through UI or direct API.
- UI shows resulting state only after API/domain readback.
- API/domain state changed correctly, or dry-run proves no mutation.
- Snapshot stability is proven after later live/template changes.
- Action execution log and audit evidence exist.
- Related closed portfolio/trend projections refresh.
- Reload keeps the result.
- Cleanup/reset is verified or state is deterministic in-memory/test-only.

## 9. Unit and integration tests

- Closure readiness/checklist domain tests.
- Close-project command tests for required data, blockers, permission denial, and audit trace.
- ClosedProjectSnapshot tests for deterministic capture, versioning, immutability, and source refs.
- Snapshot readback API tests for tenant isolation and mutation denial.
- Plan/fact metric and trend calculation tests.
- RetrospectiveInsight tests for source snapshot/trend trace and handled state.
- Closed portfolio/trends API tests for permissions, read-only action visibility, pagination/filter basics, and Tenant B no-leak.
- Web component tests for Closure Control, Closed Portfolio, Retrospective Trends, Template Improvement flow, loading/empty/error/denied states, preview/apply, audit feedback, and reload/refetch.
- Matrix verifier regression tests for P9 required rows, E2E ids, test paths, and strict structured E2E evidence.

## 10. Test data and fixtures

Seed Tenant A:

- active project ready for closure;
- active project with missing closure data for blocker assertions;
- process/template version used by the closing project;
- baseline/schedule/task/resource/KPI/control-signal data from earlier phases;
- closure checklist requirements;
- closure data for quality/client satisfaction/lessons;
- closed snapshots with plan/fact deltas;
- retrospective trend/insight candidates;
- template target for improvement action;
- project manager, executive, tenant admin, and read-only observer users.

Seed Tenant B:

- private active/closed project and retrospective data for no-leak tests.

Reset rules:

- Phase 9 reset restores project closure status, snapshots, lessons, insights, template-improvement actions, template versions, action executions, and audit records.
- No live external services, production data, random ids, or order-dependent fixtures.
- Write-flow E2E must prove reset/readback or deterministic in-memory state restoration.

## 11. Phase exit gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P9-001..P9-010 implemented.
- [ ] Mandatory E2E scenarios E2E-080..083 implemented and passing through `npm run test:e2e:phase -- --phase=9`.
- [ ] Earlier critical E2E scenarios still passing where impacted.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass where relevant.
- [ ] Project closure requires closure data and governed command execution.
- [ ] ClosedProjectSnapshot is immutable and stable after later live/template changes.
- [ ] Closed portfolio/trends use snapshot-based source data.
- [ ] Template-improvement actions require permission, preview, preconditions, audit, and API/domain readback.
- [ ] Permissions enforced at backend/application layer and proven by UI visibility plus direct API denial.
- [ ] API/domain readback, projection refresh, reload persistence, and cleanup/reset are proven for write flows.
- [ ] `docs/status/phase9-requirements-matrix.json` passes without `--allow-blocked`.
- [ ] No unresolved Critical or Important review findings remain.
- [ ] Docs, matrix, handoff, and agent-bus state are updated.

## 12. Risks and decisions

- P9 E2E ids are E2E-080..083, following `docs/04_MASTER_PHASE_PLAN.md` and `docs/e2e/E2E_SCENARIOS.md`. Some older product-screen catalog entries list P9 surfaces with E2E-090..092, but Phase 10 owns E2E-090..095; P9 implementation must use E2E-080..083 unless the master ledger changes.
- P9 may introduce a `packages/retrospectives` package if implementation needs a bounded context separate from `project-core`.
- Template-improvement actions in P9 should be narrow governed actions over existing template/version primitives. Full no-code customization remains P10 scope.
- Snapshot stability is more important than live accuracy after closure. If later correction is required, create a new snapshot version or audited correction record rather than mutating existing closed snapshot metrics.
