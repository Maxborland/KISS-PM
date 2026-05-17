# Release 2 — Depth and Hardening Roadmap

## 1. Purpose

Release 2 is the second product-development circle after the Phase 0-12 market-readiness loop. It exists to turn the first complete KISS PM control loop into a deeper, safer, more scalable product for serious production deployments.

Release 2 must not expand the active Phase 0-12 scope. The current plan still has one job: prove the full KISS PM operational loop end to end:

```txt
CRM opportunity
  -> intake and feasibility
  -> project draft / active project
  -> tasks, Gantt, resources, KPI
  -> control signal
  -> governed action
  -> audit
  -> closure
  -> retrospective learning
  -> template improvement
```

Release 2 begins only after that loop is implemented, verified, and stable enough to expose its real depth gaps.

## 2. Direction After Plancy Benchmark

Plancy is useful as a benchmark for SaaS breadth and tenant entity modeling: projects, tasks, people, teams, positions, absence types, reports, API keys, SSO/OAuth, MCP, desktop, docs, and operational settings. Its main lesson is that a modern project-operations SaaS must let customers model their organization without bespoke code.

KISS PM should not copy a broad-but-shallow delivery pattern. The healthy direction is:

- keep Plancy-level SaaS configurability as a minimum expectation for tenant modeling;
- keep MS Project desktop as the long-term scheduling semantics benchmark;
- keep BR2 as the self-written Gantt implementation reference;
- keep KISS PM's differentiator in the governed management-control loop, not in passive dashboards;
- require permissions, audit, versioning, validation, preview, migration, and E2E proof before calling a feature mature.

Release 2 should deepen the foundations instead of multiplying disconnected surfaces.

The implementation-level decomposition is tracked separately in `docs/roadmap/RELEASE_2_IMPLEMENTATION_DECOMPOSITION.md`. That file is a blocked future backlog, not active Phase 0-12 scope.

## 3. Entry Gates

Release 2 planning may happen before Phase 12. Release 2 implementation must not begin until all entry gates below are satisfied or a decision record explicitly narrows a pilot slice.

- Phase 0-12 source-of-truth docs remain coherent and are not replaced by this roadmap.
- Phase 12 full critical E2E journey passes without skipped or flaky phase-critical scenarios.
- Tenant isolation, access control, action audit, and configuration versioning are proven through API and UI paths.
- At least one real seeded tenant can complete the full control loop after fixture reset.
- Known Phase 0-12 critical bugs are closed or explicitly accepted with owner, risk, and removal condition.
- Product leadership chooses the first Release 2 track to execute; this roadmap is not a license to implement all tracks at once.

### Current Baseline Status - 2026-05-17

The repository-defined Phase 12 market-release exit gate is accepted on local `master` as the Release 1 / Phase 0-12 baseline for Release 2 planning.

Current gate interpretation:

- Satisfied for planning: Phase 0-12 implementation exists; strict phase matrices P3-P12 pass; P12 E2E-110..115 pass; P3-P11 release-path E2E and strict matrix sweep passed during P12 exit verification.
- Satisfied for planning: tenant isolation, backend authorization, action/audit evidence, reload persistence, fixture reset, mocked external-service operation, and deterministic critical journey evidence exist in the Phase 12 baseline.
- Still pending before implementation: a finite Release 2 detail document must choose the first slice, scope, non-scope, fixtures, commands, E2E gates, matrix/verifier policy, and acceptance criteria.
- Still pending as an explicit product/leadership decision: which Release 2 track starts first if customer or security evidence overrides the default priority order.
- Not completed by Phase 12 and not implied by this roadmap: real cloud account provisioning, production credentials, payment/billing setup, external security certification, and live production database backup execution. Treat these as Release 2 operational/enterprise candidates, not as accepted baseline facts.

If no stronger evidence or customer commitment exists, start with a foundation slice that hardens governed commands, audit, versioned migration, tenant configuration safety, API key lifecycle, and performance budgets before adding broad new product depth.

## 4. Pilot Slice Rules

A pilot slice is allowed only when the team needs to validate a narrow Release 2 risk before the full Release 2 gate. It is not a shortcut around the Phase 0-12 release contract.

A pilot decision record must define:

- exact task ids and files/surfaces in scope;
- the Phase 12 evidence that already exists and the evidence that is explicitly not yet available;
- non-bypassable gates: tenant isolation, backend authorization, audit for state changes, deterministic seed data, and rollback or removal condition;
- pilot owner, expiry date, customer or internal environment, and risk acceptance owner;
- minimum verification commands and minimum E2E or manual evidence required before merge;
- cleanup path if the pilot is not promoted into the full Release 2 plan.

Pilot slices may not:

- weaken Phase 0-12 E2E gates;
- introduce tenant-specific domain branches;
- bypass governed command/action layers for state changes;
- add production dependencies without an architecture/security decision;
- become a hidden permanent implementation without a Release 2 detail document.

## 5. Anti-Scope For Current Phase 0-12 Work

Do not pull Release 2 work into the active phase gate unless a phase document explicitly changes scope.

Out of current-cycle scope unless already stated by a phase contract:

- full MS Project parity;
- advanced dependency types, lag/lead, constraints, critical path, auto-rescheduling, and resource leveling;
- enterprise-grade no-code workflow language;
- plugin marketplace;
- arbitrary SQL, arbitrary JavaScript, or unsafe formula execution;
- production on-prem/private-cloud packaging beyond Phase 12 hardening;
- broad external integration ecosystem;
- analytics warehouse or advanced forecasting;
- full operator/support console maturity;
- compliance certification work.

Future scope must be recorded here or in `docs/backlog/FUTURE_SCOPE.md`, not smuggled into P5/P6/P7/P8 implementation tasks.

## 6. Phase 10 MVP Vs Release 2 Maturity Boundary

Phase 10 proves that tenant customization works without code changes. Release 2 makes that customization safe enough for repeated production administration.

| Area | Phase 10 MVP boundary | Release 2 maturity boundary |
| --- | --- | --- |
| Tenant taxonomy builders | Create and edit roles, teams, departments, positions, absence types, schedules, statuses, fields, KPI thresholds, saved views, and core layouts. | Versioned lifecycle, impacted-object preview, migration plans, import/export conflict handling, and sensitive-field audit policy. |
| Configuration validation | Reject invalid configuration and keep previous runtime behavior stable. | Explain blockers, show affected active objects, support replacement/deactivation policies, and prove tenant isolation across imports, search, reports, and integrations. |
| Control-surface configuration | Configure MVP layouts, saved views, and enabled actions. | Govern builder activation, action schema binding, bulk preview, availability diagnostics, and read-model refresh contracts. |
| KPI configuration | Create or edit thresholds and preserve historical traceability. | Version comparison, formula source binding editor, threshold dry-run scenarios, and lifecycle of produced control signals. |
| Admin UX | Provide basic admin preview mode and guided builder surfaces. | Provide progressive disclosure, safe presets, explainable impact analysis, and recovery states for failed activation. |

When a future task touches these areas, the implementation document must state which side of this boundary it belongs to.

## 7. Release 2 Tracks

### Track R2-SCH — Scheduling Depth

Goal: move from scheduling foundation toward serious planning semantics.

Candidate scope:

- multiple dependency types: Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish;
- lag/lead;
- calendars, exceptions, and non-working time;
- constraints and deadline dates;
- deterministic recalculation rules;
- critical path and float;
- multiple named baselines;
- baseline approval/update workflow;
- schedule comparison views;
- MS Project import/export decision and MVP if still strategically required.

Acceptance direction:

- schedule calculations are deterministic and unit-tested;
- Gantt UI executes commands through API/action layers;
- reload preserves schedule state;
- audit records schedule mutations;
- imported/exported schedules do not create a separate task model.

### Track R2-RES — Resource Planning Depth

Goal: make resource planning reliable enough for real portfolio decisions.

Candidate scope:

- skill/capability modeling;
- work calendars and availability exceptions;
- resource pools and team capacity;
- allocation scenarios;
- overload simulation and dry-run comparison;
- reservation lifecycle and approval;
- split/reassign/shift recommendations;
- workload heatmaps by role, person, team, department, and period;
- utilization history and forecast.

Acceptance direction:

- overloads are reproducible from assignments, reservations, calendars, and capacity;
- resolution actions are previewed before mutation;
- unauthorized users cannot execute resource actions through UI or direct API;
- reports and control surfaces refresh after resolution.

### Track R2-TEN — Tenant Customization Maturity

Goal: mature tenant configuration from builder MVP into a safe administration platform.

Candidate scope:

- guided setup wizard for first tenant configuration;
- template library for project-office operating models;
- departments, teams, positions, absence types, work schedules, project/task statuses, profile attributes, rates, taxes, and operation articles as versioned data;
- configuration preview and impacted-object analysis;
- activation, rollback-by-new-version, archive, restore, and migration commands;
- configuration import/export;
- saved view and control-surface layout versioning;
- field-level permissions and sensitive employee-profile audit policy.

Acceptance direction:

- tenant admins can configure operational taxonomies without code changes;
- risky changes show validation and preview before activation;
- active projects and historical reports stay stable after unrelated config changes;
- Tenant A cannot read or mutate Tenant B configuration through UI, API, reports, search, imports, or integrations.

### Track R2-KPI — KPI, Control Signals, and Analytics Depth

Goal: make KPI control explainable, versioned, and actionable at production depth.

Candidate scope:

- richer constrained formula language;
- formula/source binding editor with validation;
- KPI version comparison;
- threshold scenarios and dry-run evaluation;
- control-signal deduplication and lifecycle;
- accepted risk/deviation governance;
- closed-project trend analysis;
- template-improvement recommendations based on retrospective evidence.

Acceptance direction:

- no arbitrary code execution;
- every evaluation is traceable to formula, threshold, source data, period, and version;
- historical evaluations remain explainable after KPI changes;
- critical deviations expose only permitted governed actions.

### Track R2-CSF — Control Surfaces and Action Engine Depth

Goal: make management instruments configurable without turning them into unsafe report builders.

Candidate scope:

- builder for fields, filters, groupings, widgets, saved views, and actions;
- action-form configuration with constrained schemas;
- bulk-action preview;
- control-surface refresh contracts;
- drill-down consistency;
- action availability diagnostics;
- configurable but governed instrument presets.

Acceptance direction:

- control surfaces do not mutate business state directly;
- all actions go through action/application commands;
- action logs and audit records are complete;
- invalid layouts, unknown fields, and forbidden actions are rejected before activation.

### Track R2-ACT — Governed Commands And Audit Hardening

Goal: make state-changing operations consistent across scheduling, resources, tenant configuration, KPI, security, and control surfaces.

Candidate scope:

- common governed command contract;
- shared authorization, precondition, dry-run, execution, audit, and projection-refresh semantics;
- command result model for success, partial failure, validation failure, and permission denial;
- action/audit correlation ids across UI, API, background jobs, and events;
- action availability diagnostics reused by control surfaces and admin builders;
- audit retention/export contract for command evidence.

Acceptance direction:

- state-changing Release 2 features use the same application/action layer shape;
- direct business-state mutations from UI/control surfaces remain forbidden;
- audit entries are complete enough to reconstruct actor, tenant, source, command, before/after summary, and result;
- failed commands do not leave projections or read models in ambiguous states.

### Track R2-SEC — Security, Privacy, and SecOps

Goal: mature KISS PM from secure-by-default implementation into an enterprise-ready operating posture.

Candidate scope:

- CSP, frame-ancestors, HSTS decision, security.txt, and header baseline;
- rate limits and abuse controls;
- API key scopes, expiry policy, rotation, last-used, and revocation audit;
- SSO/OIDC/SAML maturity;
- session management, device/session list, and forced logout;
- admin/operator permission model;
- audit export and retention;
- sensitive-field logging rules;
- backup/restore and recovery drills;
- observability, alerting, error budgets, and incident runbooks.

Acceptance direction:

- security posture is verified by automated checks where practical;
- privileged admin/operator actions are audited;
- secrets are never exposed through browser storage, logs, or docs;
- recovery and audit export work against production-like data.

### Track R2-ENT — Enterprise Deployment and Operations

Goal: make deployment, migration, and support credible for larger customers.

Candidate scope:

- production deployment runbooks;
- private-cloud/on-prem decision and pilot packaging;
- migration tooling and validation reports;
- environment configuration validation;
- support/operator console with impersonation governance if allowed;
- billing/plan limits and entitlement enforcement;
- data retention and deletion workflows;
- release management and rollback runbooks.

Acceptance direction:

- deployment smoke passes against production-like environment;
- backup/restore or recovery smoke is documented and verified;
- operator actions are permission-checked and auditable;
- migration reports show counts, failures, and reconciliation evidence.

### Track R2-DATA — Versioned Data Migration And Reconciliation

Goal: prevent Release 2 configuration and operational depth from corrupting historical interpretation or active runtime data.

Candidate scope:

- versioned data migration protocol for tenant configuration and operational references;
- impacted-object reconciliation reports;
- rollback-by-new-version rules;
- historical interpretation checks for snapshots, KPI evaluations, audit logs, saved views, and control-surface layouts;
- migration fixtures with active projects, closed projects, cross-tenant data, and failed-import cases;
- cleanup and retry behavior for partial migration failure.

Acceptance direction:

- risky schema/config/data changes have preview, migration, rollback, and audit behavior;
- migration reports show counts, failures, skipped records, and reconciliation evidence;
- historical reports and closed-project snapshots remain explainable after configuration changes;
- migration tooling never bypasses tenant isolation or command/audit policy.

### Track R2-PERF — Performance and Scale

Goal: keep core workflows usable with large portfolios and dense plans.

Candidate scope:

- read models/projections for large control surfaces;
- pagination and virtualization for projects, tasks, Gantt, reports, and audit;
- background jobs for KPI/resource/schedule batch evaluation;
- cache invalidation strategy;
- load and stress tests for sanctioned environments;
- performance budgets for key user journeys.

Acceptance direction:

- large seeded portfolios remain interactive;
- state-changing actions refresh affected projections correctly;
- performance tests run only against controlled environments;
- no production-like stress testing happens without explicit authorization and target environment.

### Track R2-UX — Product Guidance and Polish

Goal: make the product feel simple despite internal depth.

Candidate scope:

- guided first setup;
- role-specific home surfaces;
- explainable recommendations;
- progressive-disclosure admin builders;
- better empty states and recovery states;
- consistent Russian operational copy;
- onboarding and help content tied to real workflows.

Acceptance direction:

- ordinary users see clear next actions, not internal engine concepts;
- admin users can understand configuration impact before activation;
- UI text does not hide missing domain logic or weak verification.

## 8. Candidate Release 2 E2E Gates

These are future gates, not current Phase 0-12 obligations.

- `R2-E2E-001`: imported or manually configured schedule preserves canonical task identity across Gantt, My Tasks, Kanban, and reports.
- `R2-E2E-002`: resource overload simulation previews multiple resolutions, applies one, audits it, and refreshes load views.
- `R2-E2E-003`: tenant admin edits an operational taxonomy in draft, previews affected active objects, activates it, and sees stable runtime behavior after reload.
- `R2-E2E-004`: invalid tenant configuration is rejected with actionable blockers and previous active configuration remains in force.
- `R2-E2E-005`: tenant A cannot read, import, export, search, or mutate tenant B configuration or configuration-derived runtime data.
- `R2-E2E-006`: configuration import validates conflicts, previews impact, activates a valid import, and reports skipped or failed rows.
- `R2-E2E-007`: KPI threshold dry-run explains changed future signals while old evaluations remain traceable.
- `R2-E2E-008`: KPI formula/source binding rejects unsafe or unknown references and preserves previous active KPI behavior.
- `R2-E2E-009`: control-surface builder rejects invalid action binding and accepts a valid governed action.
- `R2-E2E-010`: bulk control-surface action previews affected records and permission failures before execution.
- `R2-E2E-011`: a governed command records authorization, preconditions, dry-run when required, execution result, audit, and refreshed projection.
- `R2-E2E-012`: failed or unauthorized command does not mutate business state and leaves an auditable denial or validation result.
- `R2-E2E-013`: API key is created with scope and expiry, used once, last-used updates, then revocation blocks future use.
- `R2-E2E-014`: session/device management lists sessions and forced logout invalidates access with audit evidence.
- `R2-E2E-015`: security/admin audit export contains privileged actions without leaking sensitive field values.
- `R2-E2E-016`: large seeded portfolio remains usable within documented performance budgets.
- `R2-E2E-017`: backup/restore or recovery smoke restores a usable tenant state.
- `R2-E2E-018`: versioned data migration previews affected objects, executes, reports reconciliation counts, and preserves historical interpretation.
- `R2-E2E-019`: failed migration can be retried or rolled forward by new version without cross-tenant leakage.
- `R2-E2E-020`: full Release 2 regression journey passes after configuration migration.
- `R2-E2E-021`: production-like deployment smoke verifies environment validation, security headers where applicable, and no critical path depends on live external services.

## 9. Prioritization Rule

Release 2 should not start with the most impressive feature. It should start with the weakest production risk discovered by Phase 12 evidence.

Default priority order if no stronger evidence exists:

1. Security/SecOps risks that affect customer trust.
2. Governed command/audit consistency needed by all state-changing Release 2 work.
3. Tenant customization maturity and data migration safety needed for real deployments.
4. Scheduling/resource depth needed for the first target customer segment.
5. Performance/scaling risks found by E2E or pilots.
6. UX polish that improves completion of verified workflows.

## 10. Documentation Rules

When Release 2 becomes active:

- create a release-detail document before implementation starts;
- promote candidate tasks from `docs/roadmap/RELEASE_2_IMPLEMENTATION_DECOMPOSITION.md` only after entry gates pass or a decision record narrows a pilot slice;
- apply the pilot-slice rules above before any early implementation;
- split tracks into finite phase-like blocks with source docs, scope, non-scope, fixtures, E2E gates, and exit criteria;
- do not reuse Phase 0-12 status matrices for Release 2;
- preserve Phase 0-12 as the first release baseline;
- record rejected ideas in `docs/backlog/FUTURE_SCOPE.md`.
