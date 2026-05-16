# Phase 5 — Scheduling and Gantt Foundation

## 1. Phase objective

Build the first scheduling layer over the canonical project and task model created in Phase 4. A user must be able to open a project Gantt, see a deterministic WBS/tree plan, create or edit schedule-safe task fields, persist planned dates and Finish-to-Start dependencies, and compare live plan dates with a stable baseline draft without creating a separate Gantt task model.

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
- `docs/domain/SCHEDULING_ENGINE_SPEC.md`
- `docs/domain/ACTION_ENGINE_SPEC.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/phases/PHASE_4_PROJECT_LIFECYCLE_WORK_MANAGEMENT.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document, `docs/status/phase5-contract-matrix.json`, `docs/status/phase5-requirements-matrix.json`, and the Phase 5 verifier contract are committed. Any scope expansion must reference a decision record and update this document before product code changes.

## 2.2 KISS PM simplicity target

Normal users should see a simple project schedule workspace: open the project plan, understand task order and dates, make a safe date or dependency change, and see whether the plan is still valid. The UI must not expose scheduling internals as a raw planning engine. Internally, WBS identity, dates, dependencies, validation, baseline stability, permissions, and audit must stay strict, traceable, and deterministic.

## 2.3 Benchmark hierarchy

The long-term scheduling benchmark is **Microsoft Project desktop (MS Project desktop)**. KISS PM should phase toward its scheduling concepts where they are product-relevant: WBS, task hierarchy, planned dates, work/duration/units, dependency types, calendars, constraints, baselines, critical path, resource assignments, and deterministic recalculation. Phase 5 intentionally implements only the verified foundation listed below; any missing MS Project behavior is phased scope, not accidental omission.

**BR2** is the internal reference for a self-written Gantt surface. Use it to evaluate UI implementation mechanics such as timeline scale, tree rows, scroll synchronization, drag/resize behavior, dependency drawing, and state persistence boundaries. BR2 is not allowed to override KISS PM domain invariants.

**Plancy** is a SaaS/product reference for configurable operational entities and tenant customization depth, not the scheduling benchmark. Its relevant lessons are canonical tasks shared across list/board/Gantt, configurable teams/positions/absence-like taxonomies, user-defined profile or entity attributes, saved views, and simple Russian operational UX around projects, people, time, and reports.

## 3. Functional scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P5-001 | `packages/scheduling-engine` | Scheduling package model and primitives | Define tenant-owned `SchedulePlan`, `WbsNode`, `ScheduleDependency`, schedule date fields, progress, planned work, validation issues, and baseline snapshot value objects | Schedule primitives are deterministic, immutable where practical, tenant/project scoped, and reject invalid ranges, duplicate WBS ids, cross-tenant/project references, and malformed dependency endpoints | E2E-040..044 | unit tests, typecheck | No resource leveling, critical path, multiple dependency types, lag/lead, calendars, or MS Project import/export | Unit evidence and matrix row update |
| P5-002 | `packages/scheduling-engine`, `packages/project-core` | WBS/tree projection over canonical project tasks | Build a Gantt/WBS projection from managed project stages and canonical tasks without creating Gantt-only task entities | Each WBS node maps to a canonical project stage or task id; ordering is stable; task identity matches My Tasks/Kanban; Tenant B data is excluded | E2E-040, E2E-041 | unit tests plus package integration | No separate Gantt task table, no arbitrary nesting builder beyond phase needs | Unit/integration evidence and matrix row update |
| P5-003 | `packages/scheduling-engine` | Planned dates, duration, work, and progress validation | Support planned start/finish, derived duration, planned work hours, progress percentage, and schedule validation | Invalid date ranges, missing required schedule fields, invalid progress, and negative work return safe typed issues without mutating source state | E2E-042 | unit tests | No WDU scheduling triangle, calendars, non-working days, auto-leveling, or constraint solver | Unit evidence and matrix row update |
| P5-004 | `packages/scheduling-engine` | Basic Finish-to-Start dependency model | Create and validate Finish-to-Start dependencies between canonical task-backed WBS nodes | Dependencies reject self-links, unknown nodes, cross-project links, duplicates, and cycles; successor-before-predecessor conflicts are reported as typed validation issues | E2E-043 | unit tests plus API integration | No SS/FF/SF dependency types, no lag/lead, no automatic date propagation beyond deterministic validation | Unit/integration evidence and matrix row update |
| P5-005 | `packages/scheduling-engine` | Baseline draft snapshots | Capture visible baseline start/finish/duration/progress values separately from live plan dates | Baseline values are immutable until an explicit baseline update command; live date changes do not silently mutate baseline fields | E2E-044 | unit tests plus API integration | No multiple named baselines, baseline approval workflow, or earned-value analytics | Unit/integration evidence and matrix row update |
| P5-006 | `apps/api`, `packages/scheduling-engine`, `packages/project-core`, `packages/action-engine` | Schedule and Gantt API endpoints | Add routes to read a project schedule, create schedule-backed tasks, update schedule fields, create dependencies, capture baseline draft, and read audit/action evidence | Routes validate DTOs, tenant, actor, permissions, canonical task references, dependency rules, and baseline stability; state-changing routes write audit/action evidence | E2E-040..044 | integration tests plus E2E | No production auth provider, no external scheduler adapter, no direct control-surface mutation | Integration/E2E evidence and matrix row update |
| P5-007 | `apps/web` | Gantt UI MVP and entrypoint | Add Russian guided Gantt workspace reachable from project and portfolio/project-list entrypoints | User can open selected project Gantt, see WBS rows, planned dates, progress, baseline columns, validation warnings, and safe empty/loading/denied states | E2E-040 | component tests plus E2E | No full drag-and-drop scheduling polish, no chart virtualization requirement, no advanced timeline zoom presets | Component/E2E evidence and matrix row update |
| P5-008 | `apps/web` | Gantt task creation and inline schedule edits | Add safe UI actions for creating a canonical task from Gantt, editing planned dates/progress/work, creating FS dependency, and viewing baseline stability | UI actions call API commands; denied actions are clear; reload preserves changes; the same canonical task appears in Gantt, My Tasks, and Kanban | E2E-041..044 | component tests plus E2E | No direct local-only mutation, no hidden auto-reschedule, no resource capacity editing | Component/E2E evidence and matrix row update |
| P5-009 | `packages/shared-test-fixtures`, `e2e/` | Deterministic Phase 5 fixtures and E2E suite | Extend seeded tenants with schedule-ready managed projects, WBS rows, schedule dates, dependencies, baseline values, and Tenant B private schedule data | Fixture reset is deterministic; E2E-040..044 prove UI/API/domain state, permissions, audit, reload, tenant isolation, dependency validation, and baseline stability | E2E-040..044 | fixture tests plus E2E | No production data, random IDs, live external services, or fixture order dependence | Fixture/E2E evidence and matrix row update |
| P5-010 | `docs/status`, `scripts` | Phase 5 verification matrix | Track P5-001..P5-010 and require structured E2E evidence for Phase 5 exit | Matrix rows exist before implementation; final phase exit requires every row `verified`; mandatory E2E rows include structured evidence with ID, phase command, test path, exit code 0, status passed, and fresh timestamp/metadata | All Phase 5 | `npm run verify:matrix -- docs/status/phase5-requirements-matrix.json` | No prose-only completion, stale command evidence, skipped E2E, or unchecked cleanup | Passing matrix verifier output and final command log recorded in matrix |

## 4. Non-scope

- Resource leveling, capacity buckets, overload detection, or conflict-resolution workflows.
- KPI/control-signal evaluation for schedule deviations.
- Critical path, free/total float, lag/lead, SS/FF/SF dependencies, constraints, calendars, exceptions, or automatic rescheduling engine.
- Multiple named baselines, baseline approvals, earned-value analytics, or retrospective trend learning.
- MS Project, Jira, Bitrix24, XML/MPP, or other external scheduler import/export.
- Separate task entities for Gantt, Kanban, My Tasks, reports, or corrective actions.
- No-code Gantt builder or tenant scripting.

## 5. Domain model changes

Entities and value objects:

- `SchedulePlan`
- `WbsNode`
- `ScheduleDependency`
- `DependencyType`
- `ScheduleDateRange`
- `ScheduleValidationIssue`
- `ScheduleBaselineSnapshot`
- `ScheduleTaskCommand`
- `GanttProjection`
- `ScheduleAuditReference`

Invariants:

- Every schedule plan, WBS node, dependency, and baseline snapshot belongs to exactly one tenant and one project.
- Gantt rows for work items must reference canonical Phase 4 task ids; stage rows may reference canonical project stage ids.
- Gantt task creation creates a canonical `Task`, not a Gantt-only entity.
- Planned dates, duration, work, progress, dependencies, and baseline fields must be deterministic and testable without UI or network dependencies.
- Finish-to-Start dependencies must not create cycles or cross-project links.
- Baseline fields must remain stable until an explicit baseline update command.
- Schedule changes must be permission-checked and auditable through the application/action layer.
- Gantt UI must render projections and execute governed commands; it must not contain scheduling formulas or permission rules.

## 6. API contracts

Minimum Phase 5 routes:

- `GET /api/projects/:projectId/schedule`
- `POST /api/projects/:projectId/schedule/tasks`
- `PATCH /api/projects/:projectId/schedule/tasks/:taskId`
- `POST /api/projects/:projectId/schedule/dependencies`
- `POST /api/projects/:projectId/schedule/baseline`
- `GET /api/projects/:projectId/schedule/audit`

Contracts:

- Requests validate tenant context, actor, permission, DTO shape, project id, canonical task id, dependency endpoints, and baseline command preconditions.
- Responses use stable English field names with Russian display labels supplied by UI/tenant configuration where needed.
- Invalid schedule commands return safe blocker/error DTOs instead of mutating partial state.
- Protected operations deny read-only and out-of-tenant actors at backend/application layer.
- Meaningful state-changing routes write audit/action evidence with actor, source entity, target entity, before/after state, result, and correlation ID.

## 7. UI surfaces

- Project Gantt entrypoint from project work surface and project/portfolio list.
- Gantt workspace with WBS rows, planned start/finish, duration, planned work, progress, dependencies, baseline columns, and validation warnings.
- Minimal task creation panel for Gantt-created canonical tasks.
- Safe inline schedule edit controls for planned dates, progress, work, and dependency creation.
- Baseline visibility panel that distinguishes live plan values from baseline values.
- Audit/action evidence view for schedule changes.

UI copy must be Russian by default, while code identifiers, DTO fields, routes, and tests remain English.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-040 | User opens project Gantt from project/portfolio entry | Project manager | Seed Tenant A | `e2e/tests/phase5/open-gantt.spec.ts` | planned |
| E2E-041 | User creates a task in Gantt and sees it in My Tasks/Kanban | Project manager/executor | Seed Tenant A | `e2e/tests/phase5/gantt-task-cross-view.spec.ts` | planned |
| E2E-042 | User changes task dates in Gantt and plan persists after reload | Project manager | Seed Tenant A | `e2e/tests/phase5/gantt-date-persist.spec.ts` | planned |
| E2E-043 | User creates a dependency and schedule view reflects it | Project manager | Seed Tenant A | `e2e/tests/phase5/gantt-dependency.spec.ts` | planned |
| E2E-044 | Baseline values are visible and stable when live dates change | Project manager | Seed Tenant A | `e2e/tests/phase5/baseline-stability.spec.ts` | planned |

Required assertion pattern:

- User sees the starting project schedule state.
- Authorized user executes the schedule or Gantt action.
- Unauthorized or out-of-scope user cannot execute protected actions.
- UI shows resulting WBS/date/dependency/baseline state and any validation blockers.
- API/domain state changed correctly for state-changing scenarios.
- Audit/action log exists for schedule and baseline changes.
- Reload keeps the state.
- Gantt-created or Gantt-edited work remains the same canonical task in My Tasks and Kanban where applicable.
- Tenant B private schedule data is not visible to Tenant A actors.

## 9. Unit and integration tests

- Schedule plan and WBS validation tests.
- Canonical task/WBS projection tests.
- Planned date, duration, work, and progress validation tests.
- Finish-to-Start dependency validation tests for duplicates, missing endpoints, self-links, cycles, and schedule conflicts.
- Baseline snapshot stability tests.
- API integration tests for schedule read, task create, schedule update, dependency create, baseline capture, permissions, tenant isolation, and audit readback.
- Web component smoke tests for Russian Gantt states where practical.
- Matrix verifier regression tests for Phase 5 required rows and mandatory E2E evidence.

## 10. Test data and fixtures

- Seed Tenant A:
  - Project manager/project principal, executor, controller/requester, approver, read-only observer.
  - One Phase 4 managed project with ordered stages and canonical tasks.
  - One schedule plan with WBS rows linked to stages and canonical tasks.
  - Planned start/finish dates, planned work, progress, one valid Finish-to-Start dependency, and one validation-conflict fixture.
  - Baseline draft values for at least two task rows.
  - One schedule-ready project that can create a new task from Gantt and show it in My Tasks/Kanban.
- Seed Tenant B:
  - Private managed project, task, schedule plan, dependency, and baseline data for tenant-isolation checks.
- Reset rules:
  - E2E fixture reset must be deterministic and isolated by test profile.
  - No live external services, production data, random IDs, or order-dependent fixtures.

## 11. Phase exit gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P5-001..P5-010 implemented.
- [ ] Mandatory E2E scenarios E2E-040..044 implemented and passing through `npm run test:e2e:phase -- --phase=5`.
- [ ] Earlier critical E2E scenarios still passing.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass where relevant.
- [ ] Permissions enforced at backend/application layer.
- [ ] Schedule task creation, date edits, dependencies, and baseline changes are audited.
- [ ] Canonical task identity is proven across Gantt, My Tasks, and Kanban.
- [ ] Baseline stability is proven after live schedule changes.
- [ ] `docs/status/phase5-requirements-matrix.json` passes without `--allow-blocked`.
- [ ] Docs updated.
- [ ] Risks and follow-ups recorded.

## 12. Risks and decisions

- Phase 5 intentionally validates schedules but does not auto-reschedule successors. The removal condition is a later scheduling-engine decision for calendars, constraints, and dependency propagation.
- Phase 5 intentionally supports only Finish-to-Start dependencies. The removal condition is an explicit future scheduling scope for SS/FF/SF and lag/lead.
- Phase 5 intentionally exposes a Gantt MVP without resource load or leveling. The removal condition is Phase 6 resource planning.
- Phase 5 baseline is a single draft snapshot, not a multi-baseline governance workflow.
- If implementation reveals an irreversible scheduling ambiguity, record it in `docs/decisions/` before expanding scope.
