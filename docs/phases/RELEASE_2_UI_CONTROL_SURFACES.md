# Release 2 UI Control Surfaces

Status: planned release contract
Type: cross-phase UI/product hardening release
Branch dependency: stacked on the clean-room BR2 pattern-transfer branch until PR #1 is merged

## Product-app reset blocker

Release 2 control-surface components are merged, but app-level SaaS readiness is not accepted. Release 2 implementation is blocked until `RELEASE_2_APP_FOUNDATION_RESET` is implemented and product-owner smoke E2E passes.

This document and `docs/status/release2-ui-requirements-matrix.json` now describe reusable control-surface foundation, not product-owner acceptance of a runnable SaaS application. `E2E-R2-001..010` are not sufficient app-readiness evidence unless they prove real routes/pages/session/profile/settings/demo seed/readback.

Standard app UI must use shadcn/Radix primitives by default. Custom UI is reserved for Gantt, Capacity Matrix, WBS/timeline, and similar domain instruments.

Release 2 is not a new domain phase and not visual polish. It is the closed implementation contract that turns the already planned P3-P10 surfaces into mature KISS PM management instruments:

```text
data -> signal / risk / decision point -> next governed action
  -> preview / confirmation -> command execution
  -> audit/result feedback -> refreshed projection -> reload/readback proof
```

No production React, API, or domain implementation is authorized by this document alone. Implementation starts only through the finite matrix rows in `docs/status/release2-ui-requirements-matrix.json`.

## 1. Release Objective

Release 2 hardens key P3-P10 user surfaces so a manager sees the object, risk, next action, permission state, preview/result, audit evidence, and readback state without interpreting a passive table or dashboard.

Release 2 must preserve KISS PM language:

- `ControlSurface`
- `ManagementInstrument`
- `ControlSignal`
- `ManagementAction`
- `ActionExecution`
- `AuditEvent`
- `SchedulePlan`
- `ResourceLoadBucket`
- `KpiEvaluation`
- `ProjectSnapshot`

The word "report" may appear only as a legacy or compatibility label in user-facing Russian copy. It is not the primary product/domain concept.

## 2. Source Documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/01_PRD.md`
- `docs/02_UNIVERSAL_PROJECT_BP.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/CONTROL_SURFACE_ENGINE_SPEC.md`
- `docs/domain/ACTION_ENGINE_SPEC.md`
- `docs/domain/SCHEDULING_ENGINE_SPEC.md`
- `docs/domain/RESOURCE_PLANNING_SPEC.md`
- `docs/domain/KPI_ENGINE_SPEC.md`
- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/CONTROL_SURFACE_INTERACTION_PATTERNS.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/product/ROLE_BASED_JOURNEYS.md`
- `docs/product/UX_SALES_QUALITY_GATE.md`
- `docs/status/p3-p12-ux-screen-matrix.json`
- `docs/decisions/0003-br2-control-surface-pattern-transfer.md`

## 3. Scope Lock

Release 2 scope is exactly the finite `R2-001..R2-012` set in `docs/status/release2-ui-requirements-matrix.json`.

Every implementation PR must claim one row or one adjacent row bundle from that matrix, update status/evidence, and prove the relevant behavior with tests. Adjacent ideas go to `docs/backlog/FUTURE_SCOPE.md`.

## 4. KISS PM Simplicity Target

Release 2 succeeds when the UI feels dense, calm, operational, and guided:

- each important screen identifies object, risk, and next action within 5 seconds;
- normal users see one clear primary action before advanced options;
- risky mutations show preview before apply;
- read-only or denied users see useful context plus disabled reasons;
- mutation success is visible as result/audit/readback, not toast-only feedback;
- Gantt feels like a serious planning workspace, not a decorative chart.

## 5. Functional Scope

- Shared operational surface shell and navigation state.
- Configurable operational grid foundation.
- KPI strip and signal summary pattern.
- Portfolio Control UI hardening.
- Project Gantt planning and tracking hardening.
- Resource Load / Capacity Matrix hardening.
- Resource conflict resolution with preview-before-apply.
- KPI Deviation action hardening.
- Closed Portfolio / Retrospective control hardening.
- Tenant Admin saved views/layout/runtime preview hardening.
- Release 2 E2E, fixtures, sales-demo quality gate, and exit evidence.

## 6. Non-Scope

- Production implementation in this contract PR.
- Full marketplace.
- Arbitrary SQL/JavaScript formulas or arbitrary user-defined actions.
- Full drag-and-drop control-surface builder beyond constrained saved-view/layout editing.
- Real-time multi-user Gantt collaboration.
- Full MS Project clone or proprietary UI copy.
- Packaged Gantt widget as product architecture.
- External production integrations.
- AI autonomous actions without human confirmation.

## 7. Affected Domain Entities

Release 2 surfaces render and act on existing canonical entities. They must not create duplicate UI-specific models:

- `Opportunity`, `ProjectIntake`, `DemandProjection`, `CapacityAssessment`
- `Project`, `ProjectStage`, `Task`, `TaskParticipant`, `CorrectiveAction`
- `SchedulePlan`, `WbsNode`, `ScheduleDependency`, `BaselineSnapshot`
- `ResourceProfile`, `ResourceReservation`, `ResourceAssignment`, `ResourceLoadBucket`, `ResourceOverload`, `ResolutionPreview`
- `KpiDefinition`, `KpiEvaluation`, `ControlSignal`, `Deviation`, `ManagementDecision`
- `ControlSurfaceDefinition`, `ControlSurfaceView`, `ControlSurfaceWidget`, `SavedView`
- `ActionDefinition`, `ActionExecution`, `AuditEvent`
- `ProjectSnapshot`, `RetrospectiveInsight`, `TemplateImprovementAction`

## 8. Affected API Contracts

Release 2 implementation PRs may refine UI-facing DTO contracts only where needed by the row they claim. Expected contract families:

- surface read DTOs with freshness, state, permitted actions, disabled reasons, and trace refs;
- saved-view/layout DTOs with column order, widths, grouping, scope, preview, and version;
- action preview DTOs with before/after summary, blockers, warnings, permission trace, audit policy, and confirmation availability;
- action result DTOs with `ActionExecution`, `AuditEvent`, changed/skipped/failed targets, recalculation timestamp, and readback refs;
- Gantt schedule DTOs with WBS, timeline bars, baselines, dependencies, validation, conflicts, dirty/readback support;
- capacity DTOs with hierarchy rows, time buckets, overload/free-capacity state, source refs, and resolution previews;
- KPI/retrospective DTOs with formula/source/version trace and stable snapshot references.

No implementation PR may bypass the action engine for state-changing behavior.

## 9. Affected UI Screens

- `UX-P5-PROJECT-GANTT`
- `UX-P5-GANTT-TASK-PANEL`
- `UX-P5-BASELINE-PANEL`
- `UX-P6-RESOURCE-LOAD`
- `UX-P6-OVERLOAD-RESOLUTION`
- `UX-P7-KPI-DEVIATION`
- `UX-P8-PORTFOLIO-CONTROL`
- `UX-P8-CORRECTIVE-ACTION`
- `UX-P8-ACCEPT-RISK`
- `UX-P9-CLOSED-PORTFOLIO`
- `UX-P9-RETROSPECTIVE-TRENDS`
- `UX-P10-SAVED-VIEWS`
- `UX-P10-TENANT-LABELS`
- `UX-P10-CUSTOM-FIELDS`
- `UX-P10-KPI-THRESHOLDS`

## 10. Common Product Components To Implement Or Refine

- `OperationalSurfaceShell`
- `OperationalDataGrid`
- `ConfigurableColumnLayout`
- `KPIStrip`
- `SignalSummaryBar`
- `CapacityMatrix`
- `GanttPlanningSurface`
- `GanttTrackingOverlay`
- `ResourceConflictResolutionPanel`
- `PreviewBeforeApplyPanel`
- `ActionAuditPreview`
- `PermissionDeniedInline`
- `RuntimeConfigPreview`

Each component must implement loading, empty, error, readonly/permission, dirty/pending, preview/result, audit/readback, keyboard, and accessibility behavior described in `docs/product/DESIGN_SYSTEM.md`.

## 11. Mandatory E2E Scenarios

Release 2 adds a new scenario id family because it is a cross-phase product hardening release rather than a numbered master-plan phase. Existing phase ids remain unchanged.

- `E2E-R2-001` Portfolio Control: signal to governed action to audit/readback.
- `E2E-R2-002` Project Gantt: Excel-like edit persists, audit appears, reload keeps state.
- `E2E-R2-003` Project Gantt tracking: baseline remains stable, live changes show variance.
- `E2E-R2-004` Resource Capacity Matrix: overload cell opens affected work and resolution flow.
- `E2E-R2-005` Resource conflict resolution: preview shift/split/reassign, apply, audit, reload.
- `E2E-R2-006` KPI Deviation: source trace to corrective action or accepted risk.
- `E2E-R2-007` Closed Portfolio: snapshot/trend to template-improvement action.
- `E2E-R2-008` Tenant Admin layout/saved view affects runtime surface after reload.
- `E2E-R2-009` Read-only user sees disabled reasons and backend denies mutation.
- `E2E-R2-010` Sales demo path: first 5 minutes surface clarity and no dead-end screen.

## 12. Unit, Integration, And Component Test Requirements

- Shared shell/grid/KPI primitives: component tests for states, permissions, keyboard focus, layout reset, and stale/readback display.
- Gantt: unit tests for edit-state reducers and validation; integration/API tests for schedule save/readback; E2E for persistence, baseline stability, readonly denial, and reload.
- Resource matrix/resolution: unit tests for cell state mapping; API/integration tests for preview DTO and apply result; E2E for overload drilldown, preview, apply, audit, and reload.
- Portfolio/KPI/retrospective: component tests for signal/action state and trace sheets; integration tests for action result refresh; E2E for corrective action, accepted risk, and template improvement.
- Tenant Admin: component tests for layout/config preview; integration tests for versioned config save; E2E for runtime effect after reload.

## 13. Test Fixtures

Release 2 fixtures must be deterministic and free of real customer data:

- Tenant A with PM, Executive, ResourceManager, TenantAdmin, Executor, and ReadOnlyObserver.
- Tenant B for isolation smoke where relevant.
- One active project with WBS tasks, dependencies, assignments, baseline, and live variance.
- One overloaded resource period with source tasks and at least one previewable resolution.
- One KPI deviation with source trace, formula/threshold versions, and accepted-risk path.
- One closed project snapshot set with current and previous comparable periods.
- Saved-view/config fixtures for column layout, tenant labels, custom fields, and KPI thresholds.
- Mocked external systems only; no live Bitrix24 or customer data.

## 14. Acceptance Criteria

- `docs/status/release2-ui-requirements-matrix.json` has finite `R2-001..R2-012` rows.
- Every row has owner, owned scope, E2E, acceptance, non-scope, verification, dependencies, risks, and evidence slots.
- UI tasks are behavior + state + E2E contracts, not aesthetic wishes.
- Existing phase E2E ids are not renumbered.
- Release 2 scenarios are documented and mapped to matrix rows.
- No production code is changed by this contract PR.
- No Bitrix-specific domain assumptions are introduced.
- Future scope is explicit.
- `git diff --check` and JSON parse verification pass.
- Any unsupported matrix verifier output is documented.

## 15. Release Exit Gate

Release 2 can be called complete only when:

- all `R2-001..R2-012` rows are `done`;
- each required `E2E-R2-*` scenario is implemented and passing or has an approved replacement id;
- read-only denial is proven in UI and backend/action path;
- every state-changing screen shows preview/result/audit/readback;
- Gantt edit, baseline/tracking, resource conflict, KPI deviation, retrospective, and tenant config runtime effects survive reload;
- sales-demo quality gate passes for the first 5-minute path;
- the release evidence links to commits, PRs, tests, screenshots only where useful, and audit/readback proof.

## 16. Risks And Decisions

- Decision: use `E2E-R2-*` ids for Release 2 because this is cross-phase hardening. Existing numeric phase ids remain the master-plan truth.
- Decision: start with shared operational primitives before hardening individual surfaces.
- Decision: Project Gantt remains a custom KISS PM planning workspace over canonical tasks, not a packaged Gantt widget.
- Risk: generic `verify:matrix` may not support the new Release 2 matrix shape; JSON parse is mandatory and verifier support can be added in `R2-012`.
- Risk: this branch is stacked on the open BR2 clean-room pattern-transfer PR; merge order should keep BR2 transfer first.

## 17. Implementation Sequence

1. `R2-001/R2-002/R2-003`: shared operational shell, grid, KPI/signal primitives.
2. `R2-005/R2-006`: Project Gantt planning plus tracking/baseline UI hardening.
3. `R2-007/R2-008`: Resource Load plus conflict resolution preview/apply.
4. `R2-004/R2-009`: Portfolio Control and KPI Deviation surfaces.
5. `R2-010`: Closed Portfolio / Retrospectives.
6. `R2-011`: Tenant Admin saved views/config preview.
7. `R2-012`: Release 2 E2E, fixtures, sales-demo gate, final exit evidence.

## 18. PR Slicing Plan

| PR slice | Matrix rows | Owned files/modules | Acceptance | E2E | Tests | Non-scope | Done evidence |
|---|---|---|---|---|---|---|---|
| Shared operational primitives | `R2-001`, `R2-002`, `R2-003` | `apps/web` shared surface/grid/KPI primitives; surface DTO helpers if needed | shell shows context/freshness/action/result; grid persists layout; KPI strip maps severity/signals | `E2E-R2-010`, partial `E2E-R2-009` | component tests, focused API DTO tests if touched | Gantt/resource-specific behavior | passing tests, story/smoke evidence, matrix evidence |
| Gantt planning hardening | `R2-005`, `R2-006` | Gantt UI modules, schedule API contracts only as needed | grid/timeline share state; inline edit validates/saves; baseline/tracking stable; audit/readback visible | `E2E-R2-002`, `E2E-R2-003`, `E2E-R2-009` | unit reducer tests, component tests, API/integration where changed | full MS Project clone, realtime collaboration | passing tests, reload proof, audit/readback evidence |
| Resource capacity hardening | `R2-007`, `R2-008` | Resource Load UI, resolution panel, resource/action DTO contracts as needed | matrix drilldown; preview shift/split/reassign; apply updates load; before/after and audit visible | `E2E-R2-004`, `E2E-R2-005`, `E2E-R2-009` | component, integration, resource/action tests | production capacity commitment engine | passing tests, recalculation/readback proof |
| Portfolio and KPI control | `R2-004`, `R2-009` | Portfolio/KPI surfaces, corrective/accept-risk panels | signal -> action -> preview/result -> refresh; source traces visible | `E2E-R2-001`, `E2E-R2-006`, `E2E-R2-009` | component, action/API integration | arbitrary formulas/actions | passing tests, handled signal readback |
| Retrospective control | `R2-010` | Closed Portfolio and Retrospective surfaces | snapshot/trend view; template-improvement preview/action; immutable source proof | `E2E-R2-007` | component, action/API integration | live mutable analytics as source | passing tests, snapshot stability evidence |
| Tenant admin runtime config | `R2-011` | Saved views, labels, custom fields, KPI thresholds config UI | preview before publish; runtime surface uses config after reload; audit visible | `E2E-R2-008`, `E2E-R2-009` | component, config integration | full drag-and-drop builder | passing tests, runtime readback evidence |
| Release exit evidence | `R2-012` | E2E fixtures/tests, matrix verifier support if needed, docs/status evidence | all R2 scenarios passing; sales-demo gate documented | `E2E-R2-001..010` | phase E2E and narrow regression | new feature scope | final matrix evidence, PR links, guard output |
