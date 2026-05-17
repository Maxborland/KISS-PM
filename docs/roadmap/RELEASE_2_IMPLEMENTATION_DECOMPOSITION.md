# Release 2 Implementation Decomposition

> For future agentic workers: this is a planning backlog, not a runnable implementation plan. Release 2 candidate tasks must stay blocked until the Release 2 entry gates in `docs/roadmap/RELEASE_2_DEPTH_HARDENING.md` are satisfied or a decision record explicitly narrows a pilot slice.

**Goal:** Decompose the Release 2 depth and hardening roadmap into stable candidate tasks that can later become finite phase-like implementation blocks.

**Architecture:** Release 2 deepens the Phase 0-12 baseline instead of replacing it. Each track preserves the same canonical project/task/assignment/action/audit model, and each future task must prove state-changing behavior through UI, API/domain state, permissions, audit, and refreshed projections where applicable.

**Tech Stack:** TypeScript, Bun/Hono API, React/Vite UI, Zod validation, PostgreSQL, deterministic package-level tests, integration tests, and E2E gates.

---

## 1. Status And Execution Rules

This document is a future backlog. It must not make Release 2 implementation runnable by itself. Use `docs/roadmap/RELEASE_2_FOUNDATION_CONTRACT.md` as the current operational contract for promoting the first Release 2 implementation tasks.

Use these statuses when promoting items into a later release-detail document:

- `future-blocked`: candidate is known but cannot start before Release 2 entry gates.
- `ready-for-release2-planning`: candidate can be converted into a finite implementation block after entry gates pass.
- `candidate-slice`: candidate is a plausible first slice if product leadership narrows Release 2.
- `needs-decision`: candidate requires a product, architecture, security, or commercial decision before implementation.

Before implementing any candidate task:

1. Create a Release 2 detail document with finite scope, non-scope, fixtures, required commands, and E2E gates.
2. Add the task to `.agent-bus/queue.json` only after it becomes truly runnable.
3. Claim exactly one task and pass `node scripts/agent-bus-guard.mjs --task <TASK_ID> --once`.
4. Write or update tests before or with behavior changes.
5. Treat E2E as the acceptance truth for complete state-changing management loops.
6. If the task is an early pilot, satisfy the `Pilot Slice Rules` in `docs/roadmap/RELEASE_2_DEPTH_HARDENING.md`.

### Current Planning Surface Status - 2026-05-17

This backlog has been restored as the Release 2 planning surface after the repository-defined Phase 12 gate was accepted on local `master`.

Current interpretation:

- Phase 0-12 is the baseline to deepen, not a plan to rewrite.
- No Release 2 candidate below is automatically runnable. Each candidate still needs a finite contract section and a queue task before implementation.
- Candidate statuses in this file are planning statuses, not completion statuses.
- The current foundation contract is `docs/roadmap/RELEASE_2_FOUNDATION_CONTRACT.md`; it merges the actionable audit findings into the main implementation plan and preserves all planned future functionality.

## 2. Dependency Map From Phase 0-12

Release 2 should start from evidence, not assumptions.

| Release 2 track | Depends on Phase 0-12 evidence | Reason |
| --- | --- | --- |
| R2-SCH | Phase 5 scheduling and Gantt foundation, Phase 10 workflow integration, Phase 12 regression | Advanced scheduling must extend canonical tasks and audited schedule commands. |
| R2-RES | Phase 6 resource planning, Phase 8 action engine, Phase 12 performance/security | Resource simulations must be reproducible from assignments, calendars, capacity, and reservations. |
| R2-TEN | Phase 0 tenant foundation, Phase 3 tenant configuration, Phase 8 control surfaces, Phase 12 security | Tenant customization is cross-cutting and can break active projects if not versioned and previewed. |
| R2-KPI | Phase 7 KPI engine, Phase 8 control surfaces, Phase 11 retrospective analytics | KPI depth must preserve historical explainability after formula and threshold changes. |
| R2-CSF | Phase 8 control surfaces/action engine, Phase 10 workflow, Phase 12 regression | Configurable surfaces must remain governed instruments, not unsafe report builders. |
| R2-ACT | Phase 8 action engine, Phase 12 audit/security evidence | State-changing Release 2 features need one governed command/audit contract. |
| R2-SEC | Phase 0 access baseline, Phase 8 actions/audit, Phase 12 production hardening | Production trust issues should be prioritized over feature depth when evidence shows risk. |
| R2-ENT | Phase 12 deployment/operations | Enterprise operations require proof from production-like setup and recovery evidence. |
| R2-DATA | Phase 10 configuration, Phase 11 migration, Phase 12 recovery evidence | Versioned configuration and migrations must preserve active runtime data and historical interpretation. |
| R2-PERF | Phase 5-8 projections and Phase 12 regression | Scale work should target real slow journeys and projection refresh contracts. |
| R2-UX | Verified Phase 0-12 workflows | UX polish should simplify real flows, not mask missing domain logic. |

## 3. Recommended First Planning Slate

If Phase 12 evidence does not expose a stronger blocker, start Release 2 planning with these slices:

0. `R2-FND-000` Release 2 foundation contract: finite scope, non-scope, matrix/verifier policy, fixtures, E2E gates, write scopes, rollback/cleanup/readback rules, and promotion criteria for the first slice.
1. `R2-SEC-001` API key scopes, expiry, rotation, last-used, and revocation audit.
2. `R2-ACT-001` governed command and audit contract hardening.
3. `R2-TEN-001` configuration lifecycle core.
4. `R2-TEN-004` impacted-object preview and migration planning for configuration activation.
5. `R2-DATA-001` versioned data migration protocol.
6. `R2-SCH-001` calendar model and non-working time.
7. `R2-PERF-001` large portfolio fixture and performance budgets.

This slate hardens trust, governed state changes, tenant configurability, migration safety, and schedule correctness before adding broad UI surface area.

`R2-FND-000` creates the closed Release 2 foundation contract and does not implement product behavior. The next recommended implementation-planning task is `R2-ACT-001-governed-command-audit-contract-hardening`, because the selected foundation/security-first slice depends on consistent command, audit, denial, preview, execution, and projection-refresh semantics. All track candidates below remain planned unless explicitly superseded by a decision record; do not remove them just because the first slice is narrower.

## 4. Track R2-SCH - Scheduling Depth

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-SCH-001 | candidate-slice | Calendar model and non-working time | P5 scheduling foundation | Tasks recalculate deterministically across working days, weekends, tenant calendars, and exceptions. | R2-E2E-001 |
| R2-SCH-002 | future-blocked | Dependency type expansion | R2-SCH-001 | FS, SS, FF, and SF dependencies validate without creating a second task model. | R2-E2E-001 |
| R2-SCH-003 | future-blocked | Lag and lead offsets | R2-SCH-002 | Positive and negative offsets are validated, audited, and reflected after reload. | R2-E2E-001 |
| R2-SCH-004 | future-blocked | Constraints and deadlines | R2-SCH-001 | Constraint conflicts produce explainable warnings instead of silent schedule drift. | R2-E2E-001 |
| R2-SCH-005 | future-blocked | Critical path and float | R2-SCH-002, R2-SCH-003 | Critical path and total/free float are deterministic and covered by package tests. | R2-E2E-001 |
| R2-SCH-006 | future-blocked | Multiple named baselines | P5 baseline foundation | Users can create, compare, approve, and audit named baselines. | R2-E2E-001 |
| R2-SCH-007 | needs-decision | MS Project import/export decision spike | R2-SCH-001 through R2-SCH-006 | Decision record defines format, scope, unsupported fields, and canonical task mapping. | R2-E2E-001 |
| R2-SCH-008 | future-blocked | Schedule comparison and variance view | R2-SCH-006 | Variance view explains planned, baseline, actual, and forecast differences. | R2-E2E-001 |

## 5. Track R2-RES - Resource Planning Depth

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-RES-001 | future-blocked | Resource calendars and availability exceptions | P6 resource foundation, R2-SCH-001 | Load calculations use resource calendars, tenant calendars, absences, and reservations. | R2-E2E-002 |
| R2-RES-002 | future-blocked | Skills and capability model | P6 resource foundation, R2-TEN-002 | Skills can be configured by tenant and used without hardcoded role names. | R2-E2E-002 |
| R2-RES-003 | future-blocked | Allocation scenarios | R2-RES-001 | Users can compare scenario effects before applying changes to active assignments. | R2-E2E-002 |
| R2-RES-004 | future-blocked | Overload dry-run simulator | R2-RES-001, R2-RES-003 | System previews split, reassign, shift, and reserve options without mutating state. | R2-E2E-002 |
| R2-RES-005 | future-blocked | Reservation lifecycle and approval | R2-RES-001, P8 action engine | Reservation requests, approvals, denials, and cancellations are permission-checked and audited. | R2-E2E-002 |
| R2-RES-006 | future-blocked | Workload heatmaps and history | R2-RES-001, R2-PERF-003 | Heatmaps stay responsive and reproduce historical load from snapshots or versioned inputs. | R2-E2E-016 |

## 6. Track R2-TEN - Tenant Customization Maturity

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-TEN-001 | candidate-slice | Configuration lifecycle core | Phase 3 tenant config, Phase 12 security, R2-ACT-001 | Draft, validate, activate, archive, restore, and version configuration changes through governed commands. | R2-E2E-003 |
| R2-TEN-002 | future-blocked | Operational taxonomy builders | R2-TEN-001 | Departments, teams, positions, absence types, statuses, rates, taxes, and operation articles are configurable tenant data. | R2-E2E-003 |
| R2-TEN-003 | future-blocked | Employee profile attributes and field-level permissions | R2-TEN-001, R2-SEC-006 | Sensitive fields have read/write policy, audit policy, and tenant isolation tests. | R2-E2E-015 |
| R2-TEN-004 | candidate-slice | Impacted-object preview and migration plan | R2-TEN-001, R2-DATA-001 | Risky activation shows affected active projects, templates, reports, users, and actions before mutation. | R2-E2E-003 |
| R2-TEN-005 | future-blocked | Configuration import/export | R2-TEN-001, R2-TEN-004, R2-DATA-003 | Import validates conflicts, previews impact, and never bypasses tenant isolation. | R2-E2E-006 |
| R2-TEN-006 | future-blocked | Saved views and control-surface layout versioning | R2-TEN-001, R2-CSF-001 | Layout changes are versioned and historical audit remains explainable. | R2-E2E-009 |
| R2-TEN-007 | future-blocked | Guided setup and template library | R2-TEN-001, R2-UX-001 | Tenant admins can start from safe presets without needing internal engine concepts. | R2-E2E-003 |

## 7. Track R2-KPI - KPI, Signals, And Analytics Depth

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-KPI-001 | future-blocked | Formula source binding editor | P7 KPI foundation, R2-TEN-001 | Formula inputs are constrained, validated, versioned, and cannot execute arbitrary code. | R2-E2E-008 |
| R2-KPI-002 | future-blocked | Threshold scenario dry-run | R2-KPI-001 | Admins can preview changed future signals before activating threshold changes. | R2-E2E-007 |
| R2-KPI-003 | future-blocked | KPI version comparison and history | R2-KPI-001 | Historical evaluations stay explainable after formula or threshold changes. | R2-E2E-007 |
| R2-KPI-004 | future-blocked | Control signal lifecycle and deduplication | P7 KPI foundation, P8 action engine, R2-ACT-001 | Signals can be opened, acknowledged, linked to action, accepted as risk, resolved, and audited. | R2-E2E-011 |
| R2-KPI-005 | future-blocked | Retrospective template-improvement recommendations | Phase 11 retrospective analytics, R2-KPI-003, R2-ACT-001 | Recommendations cite closed-project evidence and require governed approval before changing templates. | R2-E2E-020 |

## 8. Track R2-CSF - Control Surfaces And Action Engine Depth

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-CSF-001 | future-blocked | Control-surface builder activation lifecycle | P8 control surfaces, R2-TEN-001, R2-ACT-001 | Invalid fields, forbidden actions, and unknown data sources are rejected before activation. | R2-E2E-009 |
| R2-CSF-002 | future-blocked | Action form schema builder | R2-CSF-001, R2-ACT-001 | Form schemas bind to governed command input schemas and cannot bypass validation. | R2-E2E-009 |
| R2-CSF-003 | future-blocked | Bulk action preview | R2-CSF-002 | Bulk actions show affected records, failures, permission gaps, and audit behavior before execution. | R2-E2E-010 |
| R2-CSF-004 | future-blocked | Action availability diagnostics | R2-CSF-001, R2-ACT-002 | Users see explainable reasons for unavailable actions without exposing forbidden data. | R2-E2E-012 |
| R2-CSF-005 | candidate-slice | Refresh and read-model contract | R2-CSF-001, R2-PERF-003, R2-ACT-001 | After a command, affected surfaces refresh deterministically and reload preserves state. | R2-E2E-011 |

## 9. Track R2-ACT - Governed Commands And Audit Hardening

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-ACT-001 | candidate-slice | Governed command and audit contract hardening | P8 action engine, Phase 12 audit/security evidence | Commands share authorization, precondition, dry-run, execution, audit, and projection-refresh semantics. | R2-E2E-011 |
| R2-ACT-002 | future-blocked | Command denial and validation diagnostics | R2-ACT-001 | Permission denials and validation failures are auditable and explainable without leaking forbidden data. | R2-E2E-012 |
| R2-ACT-003 | future-blocked | Command result and partial-failure model | R2-ACT-001 | Bulk and background commands report success, skipped records, failed records, and retry policy consistently. | R2-E2E-010 |
| R2-ACT-004 | future-blocked | Cross-surface action correlation ids | R2-ACT-001 | UI, API, jobs, audit events, and read-model refreshes can be correlated for one management action. | R2-E2E-011 |
| R2-ACT-005 | future-blocked | Audit export contract for command evidence | R2-ACT-001, R2-SEC-005 | Audit export preserves command evidence and redacts sensitive values by policy. | R2-E2E-015 |

## 10. Track R2-SEC - Security, Privacy, And SecOps

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-SEC-001 | candidate-slice | API key scopes, expiry, rotation, last-used, and revocation audit | Phase 12 security baseline, R2-ACT-001 | Created keys are scoped, expiring, auditable, revocable, and blocked after revocation. | R2-E2E-013 |
| R2-SEC-002 | future-blocked | Session and device management | Phase 12 auth baseline | Users can review sessions/devices and force logout with audit evidence. | R2-E2E-014 |
| R2-SEC-003 | needs-decision | SSO/OIDC/SAML maturity | R2-SEC-002 | Decision record defines provider scope, tenant mapping, failure modes, and audit needs. | R2-E2E-020 |
| R2-SEC-004 | future-blocked | Security header baseline and security.txt | Phase 12 deployment | CSP, frame-ancestors, HSTS decision, referrer policy, and security.txt are verified by automated checks where practical. | R2-E2E-021 |
| R2-SEC-005 | future-blocked | Audit export and retention | P8 audit/action log, R2-ACT-005 | Privileged exports include required actions and exclude sensitive field leakage. | R2-E2E-015 |
| R2-SEC-006 | future-blocked | Admin/operator permissions and impersonation governance | R2-SEC-005 | Operator access is scoped, time-bounded when applicable, justified, and audited. | R2-E2E-015 |
| R2-SEC-007 | future-blocked | Backup, restore, and recovery drills | Phase 12 operations | Recovery smoke restores a usable tenant state with documented evidence. | R2-E2E-017 |
| R2-SEC-008 | future-blocked | Observability and incident runbooks | Phase 12 operations, R2-ACT-004 | Critical errors, auth failures, job failures, and action failures produce actionable signals. | R2-E2E-020 |

## 11. Track R2-ENT - Enterprise Deployment And Operations

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-ENT-001 | future-blocked | Deployment runbooks and environment validation | Phase 12 deployment | Production-like environment validation fails fast for missing secrets, bad config, and unsafe defaults. | R2-E2E-021 |
| R2-ENT-002 | needs-decision | Private-cloud/on-prem pilot decision | R2-ENT-001, R2-SEC-007 | Decision record defines supported topology, unsupported operations, and support burden. | R2-E2E-021 |
| R2-ENT-003 | future-blocked | Migration tooling and reconciliation reports | R2-TEN-005, R2-DATA-003, R2-ENT-001 | Migration reports show counts, failures, retries, and reconciliation evidence. | R2-E2E-018 |
| R2-ENT-004 | future-blocked | Support/operator console | R2-SEC-006 | Operator actions are permission-checked, justified, and auditable. | R2-E2E-015 |
| R2-ENT-005 | future-blocked | Billing, plan limits, and entitlement enforcement | R2-TEN-001 | Feature access and limits are enforced server-side and reflected in UI. | R2-E2E-020 |
| R2-ENT-006 | future-blocked | Data retention and deletion workflows | R2-SEC-005, R2-ACT-001 | Retention/deletion actions have preview, authorization, audit, and rollback limits documented. | R2-E2E-020 |

## 12. Track R2-DATA - Versioned Data Migration And Reconciliation

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-DATA-001 | candidate-slice | Versioned data migration protocol | Phase 10 configuration, Phase 11 migration, R2-ACT-001 | Risky config/data changes define preview, execution, reconciliation, audit, retry, and rollback-by-new-version behavior. | R2-E2E-018 |
| R2-DATA-002 | future-blocked | Historical interpretation guard | R2-DATA-001 | Closed snapshots, KPI evaluations, audit logs, and saved views remain explainable after config changes. | R2-E2E-018 |
| R2-DATA-003 | future-blocked | Reconciliation report format | R2-DATA-001 | Reports show affected, changed, skipped, failed, retried, and tenant-isolated counts. | R2-E2E-018 |
| R2-DATA-004 | future-blocked | Failed migration retry and roll-forward path | R2-DATA-001 | Failed migration can be retried or rolled forward by a new compatible version without hidden partial state. | R2-E2E-019 |
| R2-DATA-005 | future-blocked | Migration fixture suite | R2-DATA-001 | Fixtures cover active projects, closed projects, cross-tenant data, invalid imports, and partial failures. | R2-E2E-019 |

## 13. Track R2-PERF - Performance And Scale

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-PERF-001 | candidate-slice | Large portfolio fixture and performance budgets | Phase 12 regression | Seeded data represents real portfolio density and defines budgets for key journeys. | R2-E2E-016 |
| R2-PERF-002 | future-blocked | Gantt virtualization and interaction performance | R2-PERF-001, R2-SCH-001 | Large plans remain interactive without dropping canonical task identity. | R2-E2E-016 |
| R2-PERF-003 | future-blocked | Control-surface projections and read models | R2-PERF-001, R2-CSF-001 | Read models refresh correctly after state-changing actions and after reload. | R2-E2E-016 |
| R2-PERF-004 | future-blocked | Background job strategy | R2-PERF-003, R2-KPI-001, R2-RES-001, R2-ACT-004 | Batch schedule/resource/KPI work is idempotent, observable, and recoverable. | R2-E2E-020 |
| R2-PERF-005 | future-blocked | Cache invalidation contract | R2-PERF-003 | Cached control surfaces never show stale state after governed actions complete. | R2-E2E-011 |

## 14. Track R2-UX - Product Guidance And Polish

| ID | Status | Candidate task | Depends on | Acceptance signal | Future E2E |
| --- | --- | --- | --- | --- | --- |
| R2-UX-001 | future-blocked | Guided first setup | R2-TEN-001 | New tenant admins can configure a usable model through safe presets and previews. | R2-E2E-003 |
| R2-UX-002 | future-blocked | Role-specific home surfaces | Phase 12 verified workflows, R2-CSF-001 | Each role sees a clear next action backed by permission-checked data. | R2-E2E-020 |
| R2-UX-003 | future-blocked | Explainable recommendations | R2-KPI-004, R2-RES-004 | Recommendations explain source evidence and require governed user action before mutation. | R2-E2E-002 |
| R2-UX-004 | future-blocked | Builder progressive disclosure | R2-TEN-001, R2-CSF-001 | Admin builders expose advanced controls without forcing routine users to understand engine internals. | R2-E2E-003 |
| R2-UX-005 | future-blocked | Workflow help and recovery states | Phase 12 verified workflows | Help content is tied to real blocked states and does not claim unsupported behavior. | R2-E2E-020 |

## 15. Promotion Checklist For Any Candidate Task

Before moving a candidate from this document into `.agent-bus/queue.json` as runnable, the lead must record:

- the exact Release 2 detail document section that authorizes the scope;
- source-of-truth docs read before implementation;
- write scope and forbidden paths;
- fixtures and tenant data needed for deterministic tests;
- unit, integration, E2E, lint, and typecheck commands;
- required audit and permission assertions;
- rollback or migration behavior if data shape changes;
- pilot-slice decision record when entry gates are narrowed;
- expected artifacts, including screenshots or traces only when they prove UI behavior;
- owner and final acceptance criteria.

## 16. Commit And Review Discipline

Future Release 2 tasks should use small logical commits:

- one commit for contract/test scaffolding when useful;
- one commit for domain/API implementation;
- one commit for UI/E2E integration when applicable;
- one commit for docs/status updates.

Do not mark a task complete while critical or important review findings remain open. If a candidate is partially implemented for a pilot, document the removed scope and the condition required before general release.
