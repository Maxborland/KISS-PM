# E2E Scenarios Ledger

This ledger is the living index of KISS PM E2E scenarios. Status values:

```txt
planned | implemented | passing | failing | quarantined | retired
```

Each implemented scenario must define concrete steps and expected results in its test file or a scenario detail document. This ledger keeps the stable acceptance contract across phases.

## Fixture baseline

- Seed Tenant A: admin, project manager/project principal, resource manager, executor, read-only observer, demo opportunity, demo project, tasks/assignments, resource capacity, KPI definitions when the phase supports them.
- Seed Tenant B: admin, normal user, private opportunity/project data for tenant-isolation checks.
- External systems: mocked, stubbed, or deterministic test adapters only.

## Phase 1 — Repository, platform, and E2E foundation

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-001 | Application boots, health route responds, web shell renders | Test user | Seed Tenant A | API health returns ok; web shell renders Russian navigation placeholders | platform | PRD 8.1, 13 | `e2e/tests/phase1/app-boot.spec.ts` | passing |
| E2E-002 | Seeded demo tenant can be loaded without external services | Tenant admin | Seed Tenant A/B | Demo tenant loads from deterministic fixtures; no live external service is required; Tenant B fixture user resolves to Tenant B shell | platform, tenant-config | PRD 10.1, 13 | `e2e/tests/phase1/seeded-tenant.spec.ts` | passing |
| E2E-003 | Unauthenticated or unknown test user is redirected or blocked according to auth design | Anonymous / unknown test user | None | Anonymous user and unknown fixture user cannot enter protected shell | platform, access-control | PRD 10.2, 13 | `e2e/tests/phase1/auth-guard.spec.ts` | passing |
| E2E-004 | Test user can enter app shell and see navigation placeholders | Project manager | Seed Tenant A | Test actor enters shell and sees placeholders for future modules | platform | PRD 8.1 | `e2e/tests/phase1/app-shell.spec.ts` | passing |

## Phase 2 — SaaS tenant core and access control

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-010 | Tenant A user cannot see tenant B data | Tenant A user | Seed Tenant A/B | Cross-tenant URL/API/view attempt is denied or empty without leaking details | tenant, access-control | PRD 10.1, 10.2 | `e2e/tests/phase2/tenant-isolation.spec.ts` | passing |
| E2E-011 | Admin can create or edit an access profile | Tenant admin | Seed Tenant A | Access profile change persists and affects later policy evaluation | access-control | PRD 10.2 | `e2e/tests/phase2/access-profile.spec.ts` | passing |
| E2E-012 | Read-only user can open a page but cannot execute a mutation | Read-only observer | Seed Tenant A | UI blocks mutation and backend/action path denies direct attempt | access-control, audit | PRD 10.2 | `e2e/tests/phase2/read-only-permissions.spec.ts` | passing |
| E2E-013 | Tenant label change is reflected in UI without code changes | Tenant admin | Seed Tenant A | Runtime UI uses updated tenant label after save/reload | tenant-config | PRD 10.1 | `e2e/tests/phase2/tenant-labels.spec.ts` | passing |
| E2E-014 | Auditable action records actor, tenant, timestamp, and result | Tenant admin | Seed Tenant A | State-changing admin action creates audit evidence | audit, action-engine | PRD 10.2, 10.10 | `e2e/tests/phase2/audit-basics.spec.ts` | passing |

## Phase 3 — CRM intake and opportunity-to-project

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-020 | User creates an opportunity with required fields | CRM user | Seed Tenant A | Opportunity is saved and visible in CRM Intake Control | crm-core | PRD 10.3 | `e2e/tests/phase3/opportunity-create.spec.ts` | passing |
| E2E-021 | Opportunity with missing fields shows readiness blockers | CRM user | Seed Tenant A | Missing data produces explainable blockers and allowed next action | crm-core, control-surfaces | PRD 10.3 | `e2e/tests/phase3/intake-readiness.spec.ts` | passing |
| E2E-022 | User runs demand/capacity feasibility analysis | Resource manager | Seed Tenant A | Demand and capacity assessment appears with traceable assumptions | crm-core, resource-planning | PRD 10.3, 10.7 | `e2e/tests/phase3/feasibility-analysis.spec.ts` | passing |
| E2E-023 | User creates a project draft from a qualified opportunity | Project manager | Seed Tenant A | Project draft is created, linked to opportunity, and audited | crm-core, project-core, action-engine | PRD 10.3, 10.4 | `e2e/tests/phase3/project-draft-from-opportunity.spec.ts` | passing |
| E2E-024 | Created project draft remains valid without external CRM adapter | Project manager | Seed Tenant A | Disconnect/mock adapter state does not break canonical project draft | crm-core, integrations, project-core | PRD 10.3, 10.12 | `e2e/tests/phase3/project-draft-canonical.spec.ts` | passing |

## Phase 4 — Project lifecycle and work management

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-030 | User creates project from process template | Project manager | Seed Tenant A | Project stages/tasks are instantiated from template version | project-core, tenant-config | PRD 10.4 | `e2e/tests/phase4/project-from-template.spec.ts` | implemented |
| E2E-031 | User moves project stage through required checks | Project principal | Seed Tenant A | Valid stage transition persists and records evidence | project-core, workflow-engine, audit | PRD 10.4 | `e2e/tests/phase4/stage-transition.spec.ts` | implemented |
| E2E-032 | Stage cannot close when required artifact/approval is missing | Project principal | Seed Tenant A | Missing gate requirement blocks closure with clear reason | project-core, workflow-engine | PRD 10.4 | `e2e/tests/phase4/stage-gate-block.spec.ts` | implemented |
| E2E-033 | Task appears in My Tasks for executor and controlled tasks for controller/requester | Executor/controller | Seed Tenant A | Same task appears in role-specific queues | project-core | PRD 10.5 | `e2e/tests/phase4/my-tasks-relations.spec.ts` | implemented |
| E2E-034 | Kanban status change updates the same canonical task | Executor | Seed Tenant A | Kanban move updates canonical task and reload keeps state | project-core | PRD 10.5 | `e2e/tests/phase4/kanban-canonical-task.spec.ts` | implemented |

## Phase 5 — Scheduling and Gantt foundation

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-040 | User opens project Gantt from project/portfolio entry | Project manager | Seed Tenant A | Gantt opens for the selected canonical project plan | scheduling-engine, project-core | PRD 10.6 | `e2e/tests/phase5/open-gantt.spec.ts` | passing |
| E2E-041 | User creates schedule-backed tasks and sees canonical task identity across Gantt/My Tasks/Kanban | Project manager/executor | Seed Tenant A | UI-created Gantt task is same canonical task in project tasks and Kanban; participant-backed schedule-created task appears in My Tasks | scheduling-engine, project-core | PRD 10.5, 10.6 | `e2e/tests/phase5/gantt-task-cross-view.spec.ts` | passing |
| E2E-042 | User changes task dates in Gantt and plan persists after reload | Project manager | Seed Tenant A | Date change is saved, audited, and visible after reload | scheduling-engine, action-engine | PRD 10.6, 10.10 | `e2e/tests/phase5/gantt-date-persist.spec.ts` | passing |
| E2E-043 | User creates a dependency and schedule view reflects it | Project manager | Seed Tenant A | Dependency is persisted and schedule validation reflects it | scheduling-engine | PRD 10.6 | `e2e/tests/phase5/gantt-dependency.spec.ts` | passing |
| E2E-044 | Baseline values are visible and stable when live dates change | Project manager | Seed Tenant A | Live date edits do not silently mutate baseline values | scheduling-engine, audit | PRD 10.6 | `e2e/tests/phase5/baseline-stability.spec.ts` | passing |

## Phase 6 — Resource planning and conflict resolution

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-050 | Assigned work creates visible load in resource planning | Resource manager | Seed Tenant A | Task assignments produce period load buckets | resource-planning, project-core | PRD 10.7 | `e2e/tests/phase6/resource-load.spec.ts` | passing |
| E2E-051 | Overload is detected for a user/period | Resource manager | Seed Tenant A | Overcapacity bucket creates overload/control signal | resource-planning, kpi-engine | PRD 10.7 | `e2e/tests/phase6/overload-detection.spec.ts` | passing |
| E2E-052 | User opens overload from control surface into resolution flow | Resource manager | Seed Tenant A | Resource Load Control drills into affected work and actions | resource-planning, control-surfaces | PRD 10.7, 10.9 | `e2e/tests/phase6/overload-resolution-entry.spec.ts` | passing |
| E2E-053 | User previews shift/split/reassign before applying | Resource manager | Seed Tenant A | Dry-run shows before/after load and blockers | resource-planning, action-engine | PRD 10.7, 10.10 | `e2e/tests/phase6/resolution-dry-run.spec.ts` | passing |
| E2E-054 | Applied resolution changes plan/load and records audit | Resource manager | Seed Tenant A | Confirmed action updates state and audit/action logs | resource-planning, scheduling-engine, audit | PRD 10.7, 10.10 | `e2e/tests/phase6/resolution-apply-audit.spec.ts` | passing |
| E2E-055 | Unauthorized user cannot resolve conflict | Read-only observer | Seed Tenant A | Resolution action is denied even if attempted directly | access-control, action-engine | PRD 10.2, 10.7 | `e2e/tests/phase6/resource-resolution-permissions.spec.ts` | passing |

## Phase 7 — KPI engine and control signals

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-060 | Admin defines KPI threshold for delay or work variance | Tenant admin | Seed Tenant A | KPI definition/threshold saves as versioned config | kpi-engine, tenant-config | PRD 10.8 | `e2e/tests/phase7/kpi-threshold.spec.ts` | passing |
| E2E-061 | Project state creates warning/critical control signal | Project manager | Seed Tenant A | Evaluation creates traceable control signal | kpi-engine, project-core | PRD 10.8 | `e2e/tests/phase7/kpi-control-signal.spec.ts` | passing |
| E2E-062 | User opens KPI deviation and sees source/formula/threshold | Project manager | Seed Tenant A | Deviation detail explains source data and rule | kpi-engine, control-surfaces | PRD 10.8, 10.9 | `e2e/tests/phase7/kpi-traceability.spec.ts` | passing |
| E2E-063 | Threshold change affects future evaluation without corrupting history | Tenant admin | Seed Tenant A | Historical evaluation keeps old version; new evaluation uses new version | kpi-engine | PRD 10.8 | `e2e/tests/phase7/kpi-versioning.spec.ts` | passing |
| E2E-064 | Unauthorized user cannot edit KPI definitions | Read-only observer | Seed Tenant A | Edit attempt is denied at UI/API path | access-control, kpi-engine | PRD 10.2, 10.8 | `e2e/tests/phase7/kpi-permissions.spec.ts` | passing |

## Phase 8 — Control surfaces and action engine

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-070 | User opens Portfolio Control and drills into project Gantt | Project manager | Seed Tenant A | Surface row opens correct project Gantt without duplicate state | control-surfaces, scheduling-engine | PRD 10.9 | `e2e/tests/phase8/portfolio-to-gantt.spec.ts` | planned |
| E2E-071 | User creates corrective task from KPI deviation control surface | Project manager | Seed Tenant A | Action creates canonical task linked to deviation and audit | control-surfaces, action-engine, project-core | PRD 10.8, 10.10 | `e2e/tests/phase8/kpi-corrective-task.spec.ts` | planned |
| E2E-072 | User resolves resource overload from Resource Load Control | Resource manager | Seed Tenant A | Surface action routes through action engine and updates load | control-surfaces, action-engine, resource-planning | PRD 10.7, 10.9, 10.10 | `e2e/tests/phase8/resource-control-action.spec.ts` | planned |
| E2E-073 | User accepts risk/deviation with mandatory reason and audit record | Project manager | Seed Tenant A | Missing reason blocks action; confirmed reason writes audit | action-engine, audit, kpi-engine | PRD 10.10 | `e2e/tests/phase8/accept-risk-audit.spec.ts` | planned |
| E2E-074 | Action availability changes by access profile and scope | Admin/read-only | Seed Tenant A | Same surface shows different action state by permission and execution denies unauthorized | access-control, control-surfaces | PRD 10.2, 10.9 | `e2e/tests/phase8/action-permissions.spec.ts` | planned |
| E2E-075 | Control surface refresh reflects result of executed action | Project manager | Seed Tenant A | After action, surface read model refreshes and reload keeps result | control-surfaces, action-engine | PRD 10.9, 10.10 | `e2e/tests/phase8/control-surface-refresh.spec.ts` | planned |

## Phase 9 — Closed portfolio and retrospectives

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-080 | User closes project with required closure data | Project manager | Seed Tenant A | Closure workflow completes only with required data | project-core, workflow-engine | PRD 10.11 | `e2e/tests/phase9/project-closure.spec.ts` | planned |
| E2E-081 | Closed project snapshot remains stable after later changes | Project manager | Seed Tenant A | Snapshot metrics do not silently change after live/template edits | project-core | PRD 10.11 | `e2e/tests/phase9/closed-snapshot-stability.spec.ts` | planned |
| E2E-082 | User opens closed portfolio and sees trend metrics | Executive | Seed Tenant A | Retrospective surface shows plan/fact/trend summary | control-surfaces, retrospective | PRD 10.11 | `e2e/tests/phase9/closed-portfolio-trends.spec.ts` | planned |
| E2E-083 | User creates template-improvement action from retrospective finding | Executive/admin | Seed Tenant A | Action creates governed improvement item with audit | action-engine, tenant-config, retrospective | PRD 10.11 | `e2e/tests/phase9/template-improvement-action.spec.ts` | planned |

## Phase 10 — No-code tenant customization

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-090 | Admin renames roles/stages and runtime UI changes | Tenant admin | Seed Tenant A | New labels appear in runtime project/task views without code change | tenant-config | PRD 10.1, 10.4 | `e2e/tests/phase10/labels-runtime.spec.ts` | planned |
| E2E-091 | Admin adds custom project field and uses it in a control surface | Tenant admin | Seed Tenant A | Field is saved, used in project data, and appears in configured surface | tenant-config, control-surfaces | PRD 10.1, 10.9 | `e2e/tests/phase10/custom-field-control-surface.spec.ts` | planned |
| E2E-092 | Admin edits KPI threshold and sees effect in evaluation | Tenant admin | Seed Tenant A | Future evaluation reflects new threshold; history stays traceable | tenant-config, kpi-engine | PRD 10.8, 10.10 | `e2e/tests/phase10/kpi-builder-effect.spec.ts` | planned |
| E2E-093 | Admin configures a control surface layout and saves it | Tenant admin | Seed Tenant A | Layout change persists and reloads for target scope | tenant-config, control-surfaces | PRD 10.9, 10.10 | `e2e/tests/phase10/control-surface-layout-builder.spec.ts` | planned |
| E2E-094 | Invalid configuration is rejected with actionable validation | Tenant admin | Seed Tenant A | Invalid builder input is blocked with clear reason | tenant-config | PRD 10.1, 10.10 | `e2e/tests/phase10/config-validation.spec.ts` | planned |
| E2E-095 | Runtime remains stable after unrelated configuration change | Tenant admin | Seed Tenant A | Existing projects/views remain stable when unrelated config changes | tenant-config, project-core | PRD 10.1 | `e2e/tests/phase10/config-regression.spec.ts` | planned |

## Phase 11 — Integrations and migration

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-100 | Mocked adapter imports data into canonical model | Integration admin | Mock adapter fixture | Import creates canonical opportunity/project/task records | integrations, crm-core, project-core | PRD 10.12 | `e2e/tests/phase11/adapter-import.spec.ts` | planned |
| E2E-101 | Repeated import is idempotent | Integration admin | Mock adapter fixture | Re-running same import does not duplicate canonical entities | integrations | PRD 10.12 | `e2e/tests/phase11/adapter-idempotency.spec.ts` | planned |
| E2E-102 | Failed adapter call produces visible safe failure state | Integration admin | Mock failing adapter | Failure is visible, recoverable, and does not corrupt canonical state | integrations | PRD 10.12 | `e2e/tests/phase11/adapter-failure.spec.ts` | planned |
| E2E-103 | Imported project works without adapter after import | Project manager | Mock adapter fixture | Canonical project remains operable after adapter disconnect | integrations, project-core | PRD 10.12 | `e2e/tests/phase11/imported-project-canonical.spec.ts` | planned |
| E2E-104 | External mapping is visible in admin diagnostics | Integration admin | Mock adapter fixture | Admin can inspect mapping without leaking secrets | integrations | PRD 10.12, 13 | `e2e/tests/phase11/external-mapping-diagnostics.spec.ts` | planned |

## Phase 12 — Production SaaS hardening and market release

| ID | Scenario | Role | Fixture | Preconditions / expected result | Domain modules | PRD refs | Test path | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-110 | Full happy path from CRM opportunity to project closure | Multiple roles | Seed Tenant A | Critical journey passes from opportunity to retrospective action and audit | all core modules | PRD 3, 12, 14 | `e2e/tests/phase12/full-critical-journey.spec.ts` | planned |
| E2E-111 | Full permission matrix smoke across core roles | Multiple roles | Seed Tenant A | Core read/action permissions behave by role/scope | access-control, action-engine | PRD 10.2 | `e2e/tests/phase12/permission-matrix-smoke.spec.ts` | planned |
| E2E-112 | Tenant isolation smoke across control surfaces, actions, API, and search | Tenant A/B users | Seed Tenant A/B | Cross-tenant data and actions are denied across surfaces/API/search | tenant, access-control, control-surfaces | PRD 10.1, 10.2 | `e2e/tests/phase12/tenant-isolation-full.spec.ts` | planned |
| E2E-113 | Production-like deployment smoke | Operator | Production-like seed | Deployment boots, health checks pass, app shell reachable | platform | PRD 13 | `e2e/tests/phase12/production-deploy-smoke.spec.ts` | planned |
| E2E-114 | Backup/restore or data recovery smoke if supported | Operator | Production-like seed | Recovery process restores usable state or documented recovery check passes | platform, persistence | PRD 13 | `e2e/tests/phase12/recovery-smoke.spec.ts` | planned |
| E2E-115 | No critical path depends on live external services | Multiple roles | Mock adapters only | Full core journey runs with mocked/stubbed external systems | integrations, all core modules | PRD 10.12, 14 | `e2e/tests/phase12/no-live-external-dependency.spec.ts` | planned |
