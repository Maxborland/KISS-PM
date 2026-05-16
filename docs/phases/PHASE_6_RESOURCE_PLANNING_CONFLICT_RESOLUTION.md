# Phase 6 — Resource Planning and Conflict Resolution

## 1. Phase objective

Make resource planning operational after the Phase 5 Gantt foundation. A resource manager must be able to see planned load created from canonical task assignments and reservations, detect overloads by resource and period, open the overload from Resource Load Control, preview a deterministic resolution, apply a governed command, and verify changed plan/load plus audit evidence after reload.

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
- `docs/domain/RESOURCE_PLANNING_SPEC.md`
- `docs/domain/ACTION_ENGINE_SPEC.md`
- `docs/domain/CONTROL_SURFACE_ENGINE_SPEC.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/product/UX_SALES_QUALITY_GATE.md`
- `docs/phases/PHASE_5_SCHEDULING_GANTT_FOUNDATION.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document, `docs/status/phase6-requirements-matrix.json`, and the Phase 6 verifier contract pass tracking verification. Any scope expansion must reference a decision record and update this document before product code changes.

## 2.2 KISS PM simplicity target

The user workflow stays simple: open Resource Load Control, see the overload, inspect affected work, choose one recommended resolution path, preview before applying, confirm, and see refreshed load plus audit. Internally, capacity calendars, exceptions, load buckets, reservations, severity, permissions, dry-run effects, command execution, and audit must remain deterministic and testable outside the UI.

## 3. Functional scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P6-001 | `packages/resource-planning` | Resource profiles and capacity calendars | Define tenant-owned resources with role/team/skill metadata, base capacity calendar, and period capacity buckets | Resources and capacity are tenant-scoped, deterministic, reject invalid dates/hours, and support person/team/role planning without tenant-specific branches | E2E-050, E2E-051 | unit tests, typecheck | No external calendar sync, no HR master-data adapter, no optimal leveling | Unit evidence and matrix row update |
| P6-002 | `packages/resource-planning` | Availability exceptions | Support vacation, absence, reduced capacity, and manual capacity overrides as explicit exceptions | Exceptions affect load/capacity buckets reproducibly, are traceable by source, and cannot create negative capacity | E2E-050, E2E-051 | unit tests | No payroll/HR integration, no recurring exception builder beyond deterministic fixtures | Unit evidence and matrix row update |
| P6-003 | `packages/resource-planning`, `packages/project-core`, `packages/scheduling-engine` | Assignment load buckets from canonical tasks | Calculate day/week/month load buckets from canonical task participants, planned work, planned dates, and schedule projections | No separate resource task model is created; load links to project, task, participant role, assignment, and schedule fields; reload/API readback is stable | E2E-050 | unit/integration tests | No WDU triangle recalculation, no critical path changes | Unit/integration/E2E evidence and matrix row update |
| P6-004 | `packages/resource-planning`, `packages/crm-core`, `packages/project-core` | Reservations from CRM and project draft/active project | Convert capacity-feasibility reservations and project draft/active-project commitments into resource reservation buckets | Reservations include source type/id, role/resource, period, hours, status, and audit/source trace; conflicting reservations are visible in load | E2E-050, E2E-051 | unit/integration tests | No live CRM adapter dependency, no financial commitment model | Unit/integration/E2E evidence and matrix row update |
| P6-005 | `packages/resource-planning` | Overload detection and severity | Detect overloads by resource/user/team/role and period from capacity, exceptions, assignments, and reservations | Severity is deterministic from utilization/gap, source buckets are traceable, and Tenant B data cannot affect Tenant A load | E2E-051 | unit tests | No KPI engine ownership of resource overload logic in P6 | Unit/E2E evidence and matrix row update |
| P6-006 | `apps/api`, `packages/resource-planning`, `packages/action-engine` | Resource planning API and governed commands | Add API read models and command endpoints for load, overload detail, dry-run preview, apply resolution, reservations, and audit | Routes validate actor/tenant/permission/DTOs; read-only and cross-tenant attempts are denied; state-changing commands write audit/action evidence | E2E-050..055 | integration tests plus E2E | No production auth provider, no direct control-surface mutations | Integration/E2E evidence and matrix row update |
| P6-007 | `apps/web` | Resource Load Control surface | Add Russian Resource Load Control with heatmap/table/list, overload signals, filters, permission states, and resolution entry | User sees load buckets, capacity, assignments, reservations, overload severity, primary next action, empty/loading/error/denied states, and result feedback | E2E-050, E2E-051, E2E-052 | component tests plus E2E | No generic BI report, no decorative dashboard-only surface | Component/E2E evidence and matrix row update |
| P6-008 | `apps/web`, `apps/api`, `packages/resource-planning`, `packages/action-engine` | Overload resolution dry-run and apply flow | Support shift, split, reassign, accept risk, and escalate options with preview-before-apply for material mutations; reserve capacity remains a separate Resource Load reservation action and must not be reported as overload resolution when it adds demand | Preview shows before/after load, affected tasks/reservations/projects, blockers, permission requirements, and no mutation until confirm; apply refreshes load and audit | E2E-052, E2E-053, E2E-054, E2E-055 | unit/integration/component/E2E | No AI-only recommendations, no fully optimal resource leveling | Full write-flow evidence and matrix row update |
| P6-009 | `packages/shared-test-fixtures`, `e2e/` | Deterministic Phase 6 fixtures and E2E-050..055 | Extend seed data with resource profiles, calendars, exceptions, assignments, reservations, overloads, Tenant B private load, and reset rules | E2E proves UI, API/domain readback, permissions, audit/action log, related projection refresh, reload persistence, and cleanup/reset | E2E-050..055 | fixture tests plus E2E | No production data, random IDs, live external systems, or skipped/flaky scenarios | Fixture/E2E evidence and matrix row update |
| P6-010 | `docs/status`, `scripts` | Phase 6 verification matrix and exit gate | Track P6-001..P6-010 and require structured E2E evidence for Phase 6 exit | Strict verifier fails blocked rows, missing tests, missing cleanup, stale metadata, prose-only evidence, placeholder blockers, and missing E2E command/test_path/exit_code/checked_at | E2E-050..055 | `npm run verify:matrix -- docs/status/phase6-requirements-matrix.json` | No `--allow-blocked` phase exit, no stale logs, no planned E2E as evidence | Passing strict matrix verifier and final command log |

## 4. Non-scope

- Fully optimal resource leveling or automatic global schedule optimization.
- External HR/calendar sync, external CRM sync, or production integration adapters.
- KPI formula engine ownership of overloads; P7 may consume P6 overload outputs later.
- P8 generic control-surface builder or arbitrary action definition builder.
- Advanced MS Project Work/Duration/Units recalculation beyond the load projection needed for P6.
- Real-time multi-user load collaboration.
- Tenant-specific role, team, stage, or KPI labels in core logic.

## 5. Domain model changes

Entities and value objects:

- `ResourceProfile`
- `ResourceRoleCapability`
- `ResourceCapacityCalendar`
- `CapacityPeriodBucket`
- `AvailabilityException`
- `ResourceAssignment`
- `AssignmentLoadBucket`
- `ResourceReservation`
- `ResourceOverload`
- `ConflictSeverity`
- `ResolutionProposal`
- `ResolutionPreview`
- `ResourceResolutionCommand`
- `ResourceResolutionResult`
- `ResourceLoadControlProjection`
- `ResourceAuditReference`

Invariants:

- Every resource, calendar, exception, assignment, reservation, load bucket, overload, preview, and resolution result belongs to exactly one tenant.
- Load buckets must derive from canonical task/participant/schedule data or explicit reservations, not from a duplicate resource-task model.
- Capacity must never become negative after exceptions.
- Reservations and assignments must carry source references and status.
- Overloads must be reproducible from capacity, exceptions, assignments, reservations, and period rules.
- Conflict severity must be deterministic and explainable.
- Resolution previews must not mutate business state.
- Applied resolution commands must be permission-checked, auditable, and traceable to source overload/control surface row, actor, before/after load, target entity, and result.
- Read-only and cross-tenant actors must be denied by backend/application services, not only hidden UI buttons.

## 6. API contracts

Minimum Phase 6 routes:

- `GET /api/resources/load`
- `GET /api/resources/load/:bucketId`
- `GET /api/resources/overloads/:overloadId`
- `POST /api/resources/reservations`
- `POST /api/resources/overloads/:overloadId/preview`
- `POST /api/resources/overloads/:overloadId/apply`
- `GET /api/resources/audit`

Contracts:

- Read routes validate tenant, actor, scope, resource/project filters, and pagination/window parameters.
- Mutation routes require `resource:write` and any secondary permission implied by the command, such as `task:write`, `schedule:write`, or `risk:accept`.
- Dry-run preview returns before/after buckets, affected assignments/reservations/tasks/projects, blockers, warnings, and required permissions without writing state.
- Apply accepts a preview id or equivalent command fingerprint so stale previews cannot be applied silently.
- Apply writes action/audit evidence and returns readback ids for affected load buckets, tasks, reservations, and audit entries.
- Errors use typed codes, for example `permission_denied`, `tenant_mismatch`, `overload_not_found`, `stale_preview`, `resolution_precondition_failed`, and `capacity_conflict`.

## 7. UI surfaces

- `/resources/load` Resource Load Control:
  - heatmap/table/list over capacity, assignments, reservations, and overload buckets;
  - primary next action: open overload resolution;
  - secondary actions: filter by period/team/project/resource, reserve capacity, open project/Gantt only when the schedule project is available;
  - Russian loading/empty/error/denied states;
  - permission explanations for unavailable actions;
  - audit/result feedback after reservation or resolution.
- Overload resolution flow:
  - source overload summary and affected work;
  - options for shift, split, reassign, accept risk, and escalate;
  - `reserve_capacity` is not an overload-resolution apply command in P6 when it creates additional demand; use the reservation endpoint/action instead;
  - `PreviewBeforeApplyPanel` with before/after load and blockers;
  - confirm/apply result with audit id and refreshed projections;
  - reload keeps the resolved or accepted state.

UI components must render state and call API/application commands. They must not contain load formulas, severity rules, permission policy, or resource conflict algorithms.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-050 | Assigned work creates visible load in resource planning | Resource manager | Seed Tenant A Phase 6 resource fixture | `e2e/tests/phase6/resource-load.spec.ts` | planned |
| E2E-051 | Overload is detected for a user/period | Resource manager | Seed Tenant A overloaded assignment/reservation fixture | `e2e/tests/phase6/overload-detection.spec.ts` | planned |
| E2E-052 | User opens overload from control surface into resolution flow | Resource manager | Seed Tenant A overloaded bucket fixture | `e2e/tests/phase6/overload-resolution-entry.spec.ts` | planned |
| E2E-053 | User previews shift/split/reassign before applying | Resource manager | Seed Tenant A overloaded bucket fixture | `e2e/tests/phase6/resolution-dry-run.spec.ts` | planned |
| E2E-054 | Applied resolution changes plan/load and records audit | Resource manager | Seed Tenant A overloaded bucket fixture | `e2e/tests/phase6/resolution-apply-audit.spec.ts` | planned |
| E2E-055 | Unauthorized user can see permitted data but cannot resolve conflict | Read-only observer | Seed Tenant A read-only actor and Tenant B private load | `e2e/tests/phase6/resource-resolution-permissions.spec.ts` | planned |

Required assertion pattern:

- User sees starting resource load, capacity, assignments, reservations, and overload state.
- Authorized resource manager executes the action path.
- Unauthorized or out-of-scope user cannot execute resolution through UI and direct API denial is proven.
- UI shows resulting before/after state.
- API/domain readback proves state changed correctly for applied commands.
- Audit/action log exists with actor, source overload/control surface, command, before/after, result, and timestamp.
- Related Resource Load Control projection refreshes.
- Reload keeps the state.
- Cleanup/reset is verified or state is deterministic in-memory/test-only.

## 9. Unit and integration tests

- Resource profile, calendar, and exception validation tests.
- Capacity bucket derivation tests including partial windows, zero/negative prevention, and tenant isolation.
- Assignment load bucket tests from canonical task participant/schedule data.
- Reservation validation and conflict tests.
- Overload detection/severity tests by resource/user/team/role and period.
- Resolution preview tests proving no mutation and deterministic before/after effects.
- Resolution apply tests for shift, split, reassign, accept risk, and escalate where included in the UI flow; reserve-capacity regression tests must prove it cannot falsely resolve an overload when it adds demand.
- API integration tests for load read, overload detail, reservation create, preview, apply, permission denial, direct API denial, tenant isolation, audit readback, stale preview rejection, and no partial mutation on blockers.
- Web component tests for Russian Resource Load Control states and resolution flow states.
- Matrix verifier regression tests for Phase 6 required rows and mandatory E2E evidence.

## 10. Test data and fixtures

- Seed Tenant A:
  - resource manager, project manager, executor, read-only observer;
  - resource profiles for at least two users and one role/team aggregate;
  - base capacity calendar with day/week/month buckets;
  - availability exceptions for reduced capacity and absence;
  - active project with Phase 5 scheduled canonical tasks and participants;
  - assignment load that fits capacity;
  - assignment/reservation combination that creates a deterministic overload;
  - CRM/project-draft reservation that contributes to load;
  - accepted-risk or escalation target fixture where needed for resolution actions.
- Seed Tenant B:
  - private resource, project, assignment, reservation, and overload data for isolation checks.
- Reset rules:
  - E2E fixture reset must be deterministic and isolated by test profile.
  - No live external services, production data, random IDs, or order-dependent fixtures.
  - Applied resolution tests must prove cleanup/reset or use in-memory/test-only state reset.

## 11. Phase exit gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P6-001..P6-010 implemented.
- [ ] Mandatory E2E scenarios E2E-050..055 implemented and passing through `npm run test:e2e:phase -- --phase=6`.
- [ ] Earlier critical E2E scenarios still passing.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass where relevant.
- [ ] Permissions enforced at backend/application layer and proven by UI visibility plus direct API denial.
- [ ] Resolution preview is non-mutating and apply is governed.
- [ ] Resource reservations and applied resolutions are audited.
- [ ] Resource Load Control refreshes after commands and reload keeps state.
- [ ] Cleanup/reset is proven for write-flow E2E.
- [ ] `docs/status/phase6-requirements-matrix.json` passes without `--allow-blocked`.
- [ ] No unresolved Critical or Important review findings remain.
- [ ] Docs, matrix, handoff, and agent-bus state are updated.

## 12. Risks and decisions

- Phase 6 intentionally implements deterministic conflict resolution options, not globally optimal resource leveling. The removal condition is a later scheduling/resource-leveling decision.
- P6 overloads are resource-planning signals. P7 may convert them into KPI/control signals, but P6 must not wait for P7 to expose overload detection and resolution.
- P6 may use in-memory deterministic runtime state consistent with prior phases until a persistence architecture is finalized; any temporary persistence shortcut must be documented with cleanup/reset evidence.
- P6 should reuse Phase 5 canonical schedule/task identity and must not create duplicate resource-only task entities.
