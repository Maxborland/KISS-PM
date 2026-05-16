# Phase 8 — Control Surfaces and Action Engine

## 1. Phase objective

Deliver the KISS PM management-control layer: operational control surfaces that expose governed actions and execute state-changing decisions through the action engine. Phase 8 turns existing CRM, project, resource, KPI, task, and Gantt capabilities into a connected management loop where a user sees a signal, chooses one clear next action, previews or confirms it, receives audited command evidence, and sees refreshed read models after reload.

## 2. Source documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/01_PRD.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/CONTROL_SURFACE_ENGINE_SPEC.md`
- `docs/domain/ACTION_ENGINE_SPEC.md`
- `docs/domain/KPI_ENGINE_SPEC.md`
- `docs/domain/RESOURCE_PLANNING_SPEC.md`
- `docs/domain/SCHEDULING_ENGINE_SPEC.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/ROLE_BASED_JOURNEYS.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/status/p3-p12-ux-screen-matrix.json`
- `docs/phases/PHASE_3_CRM_INTAKE_OPPORTUNITY_TO_PROJECT.md`
- `docs/phases/PHASE_4_PROJECT_LIFECYCLE_WORK_MANAGEMENT.md`
- `docs/phases/PHASE_5_SCHEDULING_GANTT_FOUNDATION.md`
- `docs/phases/PHASE_6_RESOURCE_PLANNING_CONFLICT_RESOLUTION.md`
- `docs/phases/PHASE_7_KPI_ENGINE_CONTROL_SIGNALS.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document, `docs/status/phase8-requirements-matrix.json`, and P8 verifier support pass tracking verification. Any later scope change must reference a decision record and update this document before product code changes.

## 2.2 KISS PM simplicity target

The ordinary user workflow stays simple: open the right control surface, inspect a visible signal, choose one recommended action, preview or confirm, and see audited result feedback. Internally, every action must be represented as a governed action definition and execution record, enforce backend permissions, validate preconditions, delegate mutation to the proper application command, and refresh affected projections. P8 must make control surfaces feel like management instruments, not generic dashboards or CRUD tables.

## 3. Functional scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P8-001 | `packages/control-surfaces`, `packages/tenant-config` | Control surface definition and view model foundation | Define tenant-owned `ControlSurfaceDefinition`, `ControlSurfaceView`, visible fields/widgets, saved-view basics, action slots, severity summary, drilldown targets, and permission requirements | Definitions are tenant-scoped, versioned, validate action slots and data sources, reject duplicate fields/actions, and can describe Portfolio, KPI Deviation, Resource Load, CRM Intake, and My Work surfaces without tenant-specific branches | E2E-070, E2E-074, E2E-075 | unit tests, verifier | No full P10 drag-and-drop builder or arbitrary layout language | Unit/API/E2E evidence and matrix row update |
| P8-002 | `packages/control-surfaces`, `apps/api` | Control surface data-source abstraction and read DTOs | Resolve surface data from existing canonical projections into stable rows/cards/widgets/actions with trace and pagination | Read models preserve tenant isolation, permission scope, severity, source ids, recommended actions, and drilldown refs; read-only users can read allowed data but cannot see executable mutation paths | E2E-070, E2E-074, E2E-075 | unit/integration tests plus E2E | No production search index or analytics warehouse | Integration/E2E evidence and matrix row update |
| P8-003 | `packages/action-engine` | Action definitions and execution log foundation | Implement generic `ActionDefinition`, command binding registry, `ActionExecutionLog`, permission/precondition traces, input summaries, and audit correlation | Every state-changing management action records actor, tenant, source surface/ref, target, before/after summary when material, result, audit ids, and correlation id | E2E-071, E2E-072, E2E-073, E2E-074, E2E-075 | unit/integration tests plus E2E | No arbitrary tenant-defined executable action code | Unit/API/E2E evidence and matrix row update |
| P8-004 | `packages/action-engine`, `apps/api` | Governed action execution API and dry-run/preview | Expose action read/preview/execute/audit routes and application service for action execution from control surfaces | Backend validates action definition, input schema, tenant, actor permission/scope, target preconditions, dry-run requirements, stale preview tokens, and no mutation on denied/invalid preview | E2E-072, E2E-073, E2E-074 | API integration tests plus E2E | No public workflow automation builder | Integration/E2E evidence and matrix row update |
| P8-005 | `apps/web`, `apps/api`, `packages/control-surfaces` | Portfolio Control surface MVP | Add `/control/portfolio` surface with project/resource/KPI signals, drilldown to Gantt, recommended action area, permission states, and action audit side panel | User can open Portfolio Control, see active project deviations, drill into the correct project Gantt, start corrective/accept-risk flows, and see refreshed rows after action readback | E2E-070, E2E-071, E2E-073, E2E-074, E2E-075 | component/API/E2E tests | No Phase 9 closed-portfolio retrospective trends | Component/E2E evidence and matrix row update |
| P8-006 | `packages/action-engine`, `packages/project-core`, `apps/api`, `apps/web` | Corrective action creation from KPI deviation | Create a canonical corrective task/action linked to a KPI deviation/control signal from KPI Deviation or Portfolio Control | Corrective task uses canonical Task model, source signal is linked, audit/action evidence exists, My Work/Kanban/projection refreshes, reload keeps the created task and signal action link | E2E-071, E2E-075 | unit/integration/component/E2E tests | No separate corrective-task entity and no P9 template-improvement workflow | Full write-flow evidence and matrix row update |
| P8-007 | `packages/action-engine`, `packages/resource-planning`, `apps/api`, `apps/web` | Resource overload action-engine binding | Route Resource Load Control resolution through generic action definitions/execution while preserving P6 preview/apply semantics | Reassign/shift/split/reserve/accept-risk options execute via action engine, keep dry-run before mutation, update resource load/read model, and write unified action/audit logs | E2E-072, E2E-075 | integration/component/E2E tests | No fully optimal resource leveling or AI-only resolution | Full write-flow evidence and matrix row update |
| P8-008 | `packages/action-engine`, `packages/kpi-engine`, `apps/api`, `apps/web` | Accept risk/deviation, escalation, and request explanation | Implement accepted-risk/deviation action with mandatory reason, expiry/context, escalation/request-explanation command records, and refreshed signal status | Missing reason blocks apply, read-only/direct API denial is enforced, accepted risk traces to signal, audit includes reason summary, and refreshed surfaces show handled status after reload | E2E-073, E2E-074, E2E-075 | unit/integration/component/E2E tests | No full notification delivery or P11 external messaging integration | Full write-flow evidence and matrix row update |
| P8-009 | `packages/shared-test-fixtures`, `e2e/tests/phase8` | Deterministic Phase 8 fixtures and E2E-070..075 | Seed Portfolio, KPI, resource, task, action, permission, Tenant B isolation, and reset data for Phase 8 | E2E proves UI, API/domain readback, direct backend denial, audit/action evidence, projection refresh, reload persistence, and reset cleanup for all P8 user-facing write flows | E2E-070..075 | fixture tests plus E2E | No random ids, live services, production data, skipped/flaky scenarios | Fixture/E2E evidence and matrix row update |
| P8-010 | `docs/status`, `scripts` | Phase 8 verification matrix and exit gate | Track P8-001..P8-010 and require structured E2E evidence for Phase 8 exit | Strict verifier fails blocked rows, missing rows, stale evidence, placeholder blockers, missing cleanup, wrong E2E paths, and phase exit without E2E-070..075 metadata | E2E-070..075 | `node scripts/verify-requirements-matrix.mjs docs/status/phase8-requirements-matrix.json` | No `--allow-blocked` phase exit and no planned E2E as evidence | Passing strict matrix verifier and final command log |

## 4. Non-scope

- Full P10 no-code control-surface builder, arbitrary drag-and-drop designer, or unlimited custom layout language.
- Arbitrary tenant-defined executable code, JavaScript, SQL, dynamic imports, or untrusted action scripts.
- Public marketplace or plugin system.
- Full P9 retrospective/closed-portfolio analytics.
- Full notification delivery to Slack/email/external systems; P8 may create escalation/request-explanation action records only.
- Production workflow automation language.
- New duplicate task, corrective-task, KPI, resource, or project domain models.
- Weakening P3-P7 behavior or bypassing existing P5/P6/P7 application commands.

## 5. Domain model changes

Entities and value objects:

- `ControlSurfaceDefinition`
- `ControlSurfaceView`
- `ControlSurfaceDataSource`
- `ControlSurfaceQuery`
- `ControlSurfaceResult`
- `ControlSurfaceRow`
- `ControlSurfaceWidget`
- `ControlSurfaceActionSlot`
- `ActionDefinition`
- `ActionInputSchema`
- `ActionCommandBinding`
- `ActionExecution`
- `ActionExecutionTrace`
- `PermissionTrace`
- `PreconditionTrace`
- `DryRunPreview`
- `AcceptedRiskRecord`
- `EscalationRecord`
- `ActionAuditReference`

Invariants:

- Every control surface definition, view, action definition, action execution, accepted risk, and escalation belongs to exactly one tenant.
- Control surface read models do not mutate business state.
- Control surfaces may expose actions only from action definitions whose permissions, target type, binding, and tenant config are valid.
- Hidden buttons are not authorization; the action engine remains authoritative.
- Every state-changing management action must have actor, tenant, source surface/ref, target, command type, result, and audit/action evidence.
- Risk/deviation acceptance must include a non-empty reason and trace to the source signal.
- Corrective work must use canonical Task, not a duplicate corrective-task model.
- Resource actions must preserve P6 dry-run before apply and refresh load projections.
- KPI actions must preserve P7 formula/threshold/evaluation traceability.

## 6. API contracts

Minimum Phase 8 routes:

- `GET /api/control/surfaces`
- `GET /api/control/surfaces/:surfaceId`
- `GET /api/control/surfaces/:surfaceId/view`
- `GET /api/control/surfaces/:surfaceId/actions`
- `POST /api/control/actions/:actionDefinitionId/preview`
- `POST /api/control/actions/:actionDefinitionId/execute`
- `GET /api/control/actions/:executionId`
- `GET /api/control/audit`

Minimum action DTOs:

- create corrective action from KPI/resource/schedule signal;
- open Gantt drilldown result;
- resource resolution binding to P6 preview/apply;
- accept risk/deviation with reason and optional expiry;
- escalate;
- request explanation.

Permission keys:

- `control:read`
- `control.surface:read`
- `control.action:write`
- `control.action:preview`
- `risk:accept`
- `audit.read`
- existing P5/P6/P7 permissions for delegated command bindings.

Errors use stable typed codes such as `permission_denied`, `tenant_mismatch`, `surface_not_found`, `action_not_found`, `binding_not_found`, `precondition_failed`, `dry_run_required`, `stale_preview`, `reason_required`, `target_not_found`, and `validation_failed`.

## 7. UI surfaces

- `/control/portfolio` Portfolio Control:
  - signals from schedule, resource, KPI, and project state;
  - one primary next action per selected signal;
  - Gantt drilldown;
  - corrective action dialog;
  - accept-risk dialog;
  - action audit side panel;
  - Russian loading/empty/error/denied states;
  - API readback and reload persistence.
- Corrective Action Dialog:
  - source signal context;
  - owner, due date, task title, expected result;
  - preview/confirmation where needed;
  - created canonical task/result/audit evidence.
- Accept Risk Dialog:
  - source signal, consequence, mandatory reason, optional expiry;
  - missing reason state;
  - result feedback and refreshed signal status.
- Action Audit side panel:
  - actor, command/action key, source surface, target, before/after summary, result, timestamp, audit id.
- Existing Resource Load and KPI Deviation surfaces:
  - must call P8 action engine for P8-scoped management actions rather than local mutation paths.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-070 | User opens Portfolio Control and drills into project Gantt | Project manager | Seed Tenant A active project with schedule/resource/KPI signals | `e2e/tests/phase8/portfolio-to-gantt.spec.ts` | planned |
| E2E-071 | User creates corrective task from KPI deviation control surface | Project manager | Seed Tenant A KPI deviation and task template defaults | `e2e/tests/phase8/kpi-corrective-task.spec.ts` | planned |
| E2E-072 | User resolves resource overload from Resource Load Control | Resource manager | Seed Tenant A resource overload and action definitions | `e2e/tests/phase8/resource-control-action.spec.ts` | planned |
| E2E-073 | User accepts risk/deviation with mandatory reason and audit record | Project manager | Seed Tenant A deviation/risk signal | `e2e/tests/phase8/accept-risk-audit.spec.ts` | planned |
| E2E-074 | Action availability changes by access profile and scope | Admin/read-only | Seed Tenant A roles and Tenant B private data | `e2e/tests/phase8/action-permissions.spec.ts` | planned |
| E2E-075 | Control surface refresh reflects result of executed action | Project manager | Seed Tenant A surface rows/actions and resettable state | `e2e/tests/phase8/control-surface-refresh.spec.ts` | planned |

Required assertion pattern:

- User sees the starting control surface or source signal state.
- Authorized user previews or executes the governed action.
- Unauthorized or out-of-tenant user cannot execute it through UI or direct API.
- UI shows resulting state only after API/domain readback.
- API/domain state changed correctly.
- Action execution log and audit evidence exist.
- Related control surface projection refreshes.
- Reload keeps the result.
- Cleanup/reset is verified or state is deterministic in-memory/test-only.

## 9. Unit and integration tests

- Control surface definition validation tests.
- Control surface read DTO/data-source tests for Portfolio, KPI deviation, Resource Load, CRM Intake, and My Work.
- ActionDefinition validation tests for permissions, command bindings, input schemas, and dry-run policy.
- ActionExecution tests for permission denial, precondition failure, dry-run no mutation, execution success, audit correlation, before/after summaries, and tenant isolation.
- Corrective action tests proving canonical Task creation and source signal linking.
- Resource action binding tests proving P6 preview/apply semantics are preserved behind generic action execution.
- Accept-risk tests proving mandatory reason, direct API denial, accepted status readback, and audit reason summary.
- API integration tests for read/preview/execute/audit routes.
- Web component tests for Portfolio Control, Corrective Action dialog, Accept Risk dialog, Action Audit panel, permission states, stale preview recovery, and reload/refetch behavior.
- Matrix verifier regression tests for P8 required rows, E2E ids, and mandatory structured E2E evidence.

## 10. Test data and fixtures

Seed Tenant A:

- project with schedule state and Gantt drilldown target;
- KPI deviation/control signal from P7;
- resource overload from P6;
- canonical task templates/defaults for corrective action;
- portfolio surface definition/view/action slots;
- action definitions for open Gantt, corrective action, resource resolution, accept risk, escalate, and request explanation;
- project manager, resource manager, executive, controller, and read-only observer;
- existing audit/action readback support.

Seed Tenant B:

- private portfolio/project/signal/action data for no-leak tests.

Reset rules:

- Phase 8 E2E fixture reset must restore action executions, accepted risks, escalations, corrective tasks, resource load, and signal statuses.
- No live external services, production data, random IDs, or order-dependent fixtures.
- Write-flow E2E must prove reset/readback or deterministic in-memory state restoration.

## 11. Phase exit gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P8-001..P8-010 implemented.
- [ ] Mandatory E2E scenarios E2E-070..075 implemented and passing through `npm run test:e2e:phase -- --phase=8`.
- [ ] Earlier critical E2E scenarios still passing.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass where relevant.
- [ ] Control surfaces expose operational signals and one clear primary next action.
- [ ] No control surface mutates business state directly.
- [ ] All state-changing actions route through the action engine/application layer.
- [ ] Permissions enforced at backend/application layer and proven by UI visibility plus direct API denial.
- [ ] Audit/action execution evidence exists for every meaningful management action.
- [ ] API/domain readback, projection refresh, reload persistence, and cleanup/reset are proven for write flows.
- [ ] Corrective actions use canonical Task identity.
- [ ] Accepted risk/deviation requires a reason and traces to the source signal.
- [ ] `docs/status/phase8-requirements-matrix.json` passes without `--allow-blocked`.
- [ ] No unresolved Critical or Important review findings remain.
- [ ] Docs, matrix, handoff, and agent-bus state are updated.

## 12. Risks and decisions

- P8 should reuse P3-P7 capabilities through application/action bindings. If a prior phase has a local command path, P8 may wrap it but must not bypass existing domain invariants.
- P8 intentionally does not build the P10 no-code builder. Definitions can be data-shaped and seeded, but ordinary users should see guided actions rather than raw configuration.
- Escalation and request-explanation may be action records without external notification delivery until P11 integration work.
- Portfolio Control in P8 covers active operational control only. Closed-project portfolio and retrospective learning belongs to P9.
- The accepted P7 E2E ids are E2E-060..064. P8 owns E2E-070..075; do not relabel P8 as complete using P7 scenarios.
