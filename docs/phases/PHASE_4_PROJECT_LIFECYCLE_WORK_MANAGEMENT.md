# Phase 4 — Project Lifecycle and Work Management

## 1. Phase objective

Build configurable project lifecycle templates and canonical work management on top of Phase 3 project drafts. A user must be able to create a managed project from a process template, move it through governed stages, satisfy artifact and approval checks, create canonical tasks with role-based participants, and operate those tasks through My Tasks and Kanban views without creating separate task models.

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
- `docs/domain/ACCESS_CONTROL_SPEC.md`
- `docs/domain/ACTION_ENGINE_SPEC.md`
- `docs/domain/TENANT_CUSTOMIZATION_SPEC.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/phases/PHASE_3_CRM_INTAKE_OPPORTUNITY_TO_PROJECT.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document, `docs/status/phase4-contract-matrix.json`, and `docs/status/phase4-requirements-matrix.json` are committed. Any scope expansion must reference a decision record and update this document before product code changes.

## 2.2 KISS PM simplicity target

Normal users should see a simple operational path: open a project, understand its current stage, complete required work or evidence, and move the work forward. The UI must not expose internal workflow machinery as a raw builder. Internally, stage transitions, task identity, participant roles, approvals, comments, status history, permissions, and audit must stay strict, traceable, and testable.

## 3. Functional scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P4-001 | `packages/project-core`, `packages/tenant-config` | Process and stage templates | Define tenant-owned `ProcessTemplate` and `StageTemplate` with stable system keys, labels, ordering, required artifact/approval/task templates, and versioned snapshots | Templates are tenant-owned, active/versioned, deterministic, and reject duplicate or tenant-mismatched stage/template references | E2E-030, E2E-031, E2E-032 | unit tests, typecheck | No advanced workflow builder, no arbitrary tenant scripting, no Gantt scheduling | Unit evidence and matrix row update |
| P4-002 | `packages/project-core`, `packages/workflow-engine` | Project lifecycle state machine | Convert a Phase 3 project draft into a managed project with lifecycle status, current stage, stage history, and allowed transitions | Project transition rules are deterministic; invalid lifecycle/stage transitions return safe typed errors and do not mutate state | E2E-030, E2E-031, E2E-032 | unit tests plus API integration | No active portfolio controls, no scheduling baseline, no resource leveling | Unit/integration evidence and matrix row update |
| P4-003 | `packages/project-core`, `packages/workflow-engine` | Stage gates, artifacts, and approval basics | Represent required artifacts/deliverables and approval requests needed to close a stage | A stage cannot close when required artifact or approval evidence is missing; blocker reasons are stable and Russian UI-safe | E2E-031, E2E-032 | unit tests plus API integration | No document storage, no complex approval routing, no e-signature | Unit/integration/E2E evidence and matrix row update |
| P4-004 | `packages/project-core` | Canonical task model and task templates | Implement one canonical `Task` model with project/stage ownership, status, due date, planned work, source template, and tenant ownership | Tasks are not duplicated per view; template-created tasks preserve source template version and remain valid without Kanban/Gantt-specific entities | E2E-030, E2E-033, E2E-034 | unit tests | No Gantt-specific task entity, no scheduling dependency engine | Unit evidence and matrix row update |
| P4-005 | `packages/project-core`, `packages/access-control` | Task participants and assignment roles | Add role-based task participation: executor, co-executor, requester, controller, approver, observer | Role assignments are tenant-owned, deduplicated per task/role/user, permission-safe, and queryable by relation | E2E-033 | unit tests plus API integration | No capacity/load calculation, no HR department hierarchy | Unit/integration evidence and matrix row update |
| P4-006 | `packages/project-core` | Task comments and status history | Add append-only task comments and status history for work management changes | Status changes and comments preserve actor, timestamp, before/after state, and correlation ID where applicable | E2E-034 | unit tests plus API integration | No rich text editor, attachments, notifications, or chat sync | Unit/integration evidence and matrix row update |
| P4-007 | `apps/api`, `packages/project-core`, `packages/workflow-engine` | Project lifecycle and work API endpoints | Add routes for template project creation, stage transition, artifact/approval evidence, task create/read/update, comments, My Tasks, and Kanban projections | Routes validate DTOs, enforce tenant and permission checks server-side, return stable DTOs, and write audit/action evidence for meaningful state changes | E2E-030..034 | integration tests plus E2E | No production auth provider, no external PM integration, no full no-code workflow API | Integration/E2E evidence and matrix row update |
| P4-008 | `apps/web` | Project lifecycle, My Tasks, and Kanban UI surfaces | Add Russian guided surfaces for project stage progress, gate blockers, task creation, My Tasks, controlled tasks, and Kanban status movement | UI drives real API state changes; denied actions are clear; reload preserves project/task state; same task id appears across project, My Tasks, and Kanban | E2E-030..034 | component tests plus E2E | No decorative dashboard, no drag-and-drop polish requirement, no Gantt UI | Component/E2E evidence and matrix row update |
| P4-009 | `packages/shared-test-fixtures`, `e2e/` | Deterministic Phase 4 fixtures and E2E suite | Extend seeded tenants with process templates, stage gates, artifacts, approvals, tasks, participants, and Tenant B private project/task data | Fixture reset is deterministic; E2E-030..034 prove state-changing UI/API flows, tenant isolation, permissions, audit, reload, and canonical task identity | E2E-030..034 | fixture tests plus E2E | No production data, random IDs, live external services, or fixture order dependence | Fixture/E2E evidence and matrix row update |
| P4-010 | `docs/status`, `scripts` | Phase 4 verification matrix | Track P4-001..P4-010 and require structured E2E evidence for Phase 4 exit | Matrix rows exist before implementation; final phase exit requires every row `verified`; mandatory E2E rows include structured evidence with ID, phase command, test path, exit code 0, status passed, and fresh timestamp/metadata | All Phase 4 | `npm run verify:matrix -- docs/status/phase4-requirements-matrix.json` | No prose-only completion, stale command evidence, skipped E2E, or unchecked cleanup | Passing matrix verifier output and final command log recorded in matrix |

## 4. Non-scope

- Full Gantt scheduling engine.
- Resource leveling, capacity load buckets, overload detection, or resolution flows.
- Advanced custom workflow builder.
- Arbitrary tenant-defined scripts, SQL, or JavaScript.
- External Jira/MS Project/Bitrix task synchronization.
- Full document management, file storage, e-signature, notifications, or chat.
- KPI/control-signal logic beyond data hooks needed for later phases.
- Separate task entities for Kanban, My Tasks, Gantt, corrective actions, or reports.

## 5. Domain model changes

Entities and value objects:

- `ProcessTemplate`
- `StageTemplate`
- `StageGateRequirement`
- `ArtifactTemplate`
- `ApprovalTemplate`
- `ManagedProject`
- `ProjectStage`
- `StageTransition`
- `ProjectArtifact`
- `ApprovalRequest`
- `Task`
- `TaskTemplate`
- `TaskParticipant`
- `TaskParticipantRole`
- `TaskComment`
- `TaskStatusHistoryEntry`
- `MyTasksProjection`
- `KanbanColumnProjection`

Invariants:

- Every project, stage, task, participant, artifact, approval, comment, and status event belongs to exactly one tenant.
- A managed project may originate from a Phase 3 project draft, but lifecycle/work management must not depend on an external CRM adapter.
- Stage logic must use stable system keys and tenant labels, not tenant-specific branches.
- A stage cannot close until required artifacts and approvals are satisfied.
- Task identity is canonical across project view, My Tasks, Kanban, later Gantt, control surfaces, and corrective actions.
- Task participation is role-based and cannot be reduced to one `assigneeId`.
- Status history and comments are append-oriented.
- Meaningful lifecycle and task actions are permission-checked and auditable.

## 6. API contracts

Minimum Phase 4 routes:

- `POST /api/projects/from-template`
- `GET /api/projects/:id`
- `POST /api/projects/:id/stages/:stageId/transition`
- `POST /api/projects/:id/stages/:stageId/artifacts`
- `POST /api/projects/:id/stages/:stageId/approvals`
- `GET /api/projects/:id/tasks`
- `POST /api/projects/:id/tasks`
- `PATCH /api/tasks/:taskId/status`
- `POST /api/tasks/:taskId/comments`
- `GET /api/my/tasks`
- `GET /api/kanban/projects/:projectId`
- `GET /api/audit?targetType=project|task|stage&targetId=:id`

Contracts:

- Requests validate tenant context, actor, permission, and DTO shape at the API boundary.
- Responses use stable English field names with Russian display labels supplied from tenant configuration.
- Stage transition and task status changes include safe blocker/error DTOs for invalid gates or denied permissions.
- Protected operations deny read-only and out-of-tenant actors at backend/application layer.
- Meaningful state-changing routes write audit/action evidence with actor, source entity, target entity, before/after state, result, and correlation ID.

## 7. UI surfaces

- Project lifecycle surface: project header, current stage, stage checklist, allowed transition action, and gate blockers.
- Project task list: canonical task rows with status, role participants, due dates, planned work, and source template info.
- Task create/edit panel: minimal template-driven task creation and participant assignment.
- My Tasks surface: role-specific work queue for executor and co-executor.
- Controlled Tasks surface: requester/controller/approver/observer relations.
- Kanban surface: project task columns over the same canonical task ids.
- Audit evidence view for stage transitions and task status changes.

UI copy must be Russian by default, while code identifiers, DTO fields, routes, and tests remain English.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-030 | User creates project from process template | Project manager | Seed Tenant A | `e2e/tests/phase4/project-from-template.spec.ts` | planned |
| E2E-031 | User moves project stage through required checks | Project principal | Seed Tenant A | `e2e/tests/phase4/stage-transition.spec.ts` | planned |
| E2E-032 | Stage cannot close when required artifact/approval is missing | Project principal | Seed Tenant A | `e2e/tests/phase4/stage-gate-block.spec.ts` | planned |
| E2E-033 | Task appears in My Tasks for executor and controlled tasks for controller/requester | Executor/controller | Seed Tenant A | `e2e/tests/phase4/my-tasks-relations.spec.ts` | planned |
| E2E-034 | Kanban status change updates the same canonical task | Executor | Seed Tenant A | `e2e/tests/phase4/kanban-canonical-task.spec.ts` | planned |

Required assertion pattern:

- User sees the starting project/task state.
- Authorized user executes the lifecycle or task action.
- Unauthorized or out-of-scope user cannot execute protected actions.
- UI shows resulting state and relevant gate/task/audit evidence.
- API/domain state changed correctly for state-changing scenarios.
- Audit/action log exists for lifecycle and task state changes.
- Reload keeps the state.
- The same canonical task id appears across project, My Tasks, and Kanban where applicable.
- Tenant B private project/task data is not visible to Tenant A actors.

## 9. Unit and integration tests

- Process/stage template validation tests.
- Project lifecycle state machine tests for allowed and denied transitions.
- Stage gate tests for missing artifacts/approvals and satisfied gates.
- Canonical task creation and task-template snapshot tests.
- Task participant role tests for executor, co-executor, requester, controller, approver, and observer.
- Task comment and status history append-only tests.
- API integration tests for validation, permissions, tenant isolation, stage transitions, task creation/status changes, My Tasks, Kanban projections, and audit readback.
- Web component smoke tests for Russian lifecycle/task states where practical.
- Matrix verifier regression tests for Phase 4 required rows and mandatory E2E evidence.

## 10. Test data and fixtures

- Seed Tenant A:
  - Project manager/project principal, executor, controller/requester, approver, read-only observer.
  - One Phase 3 project draft ready to become a managed project.
  - One process template with ordered stages, required artifact, required approval, and task templates.
  - One managed project with an open stage and seeded tasks/participants for My Tasks and Kanban checks.
  - One stage with missing gate evidence and one stage ready for transition.
- Seed Tenant B:
  - Private project/task/stage data for tenant-isolation checks.
- Reset rules:
  - E2E fixture reset must be deterministic and isolated by test profile.
  - No live external services, production data, random IDs, or order-dependent fixtures.

## 11. Phase exit gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P4-001..P4-010 implemented.
- [ ] Mandatory E2E scenarios E2E-030..034 implemented and passing through `npm run test:e2e:phase -- --phase=4`.
- [ ] Earlier critical E2E scenarios still passing.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass where relevant.
- [ ] Permissions enforced at backend/application layer.
- [ ] Stage transitions, task status changes, and meaningful work actions are audited.
- [ ] Canonical task identity is proven across project, My Tasks, and Kanban.
- [ ] `docs/status/phase4-requirements-matrix.json` passes without `--allow-blocked`.
- [ ] Docs updated.
- [ ] Risks and follow-ups recorded.

## 12. Risks and decisions

- Phase 4 intentionally creates lifecycle/work management without a Gantt engine. The removal condition is Phase 5 scheduling and Gantt foundation.
- Phase 4 intentionally creates role-based task participants without resource load calculations. The removal condition is Phase 6 resource planning.
- Approval basics are minimal evidence gates, not a full approval routing product.
- Kanban is a projection over canonical tasks, not a separate task model.
- If implementation reveals an irreversible lifecycle/workflow ambiguity, record it in `docs/decisions/` before expanding scope.
