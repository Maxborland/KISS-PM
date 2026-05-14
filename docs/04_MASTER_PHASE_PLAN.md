# 04 — KISS PM Master Phase Plan

## 1. Purpose

This document is the finite execution plan for **KISS PM**, the greenfield SaaS project-control platform.

It exists to prevent the project from degrading into an endless MVP, an unstable prototype, or a pile of disconnected features. Codex and any other implementation agent must treat this document as the long-range delivery contract.

The plan is intentionally phase-based. Each phase has a clear objective, mandatory outputs, E2E proof requirements, exit gates, and anti-scope rules. A later phase may be refined before it starts, but the project must not lose the final destination.

## 2. End-state product to reach

The final product is **KISS PM** — a market-ready SaaS platform for operational project control.

At the end of the full plan, the product must support this closed management loop:

```txt
CRM opportunity
  -> project intake and feasibility analysis
  -> project draft / active project
  -> configurable lifecycle stages
  -> canonical tasks and assignments
  -> Gantt / schedule / resource planning
  -> KPI evaluation and control signals
  -> interactive control surfaces
  -> governed management actions
  -> audit trail and repeated control
  -> project closure and retrospective learning
  -> improved templates and future planning
```

The final product must not be a custom-coded reporting app. It must be configurable by tenant through templates, labels, custom fields, KPI definitions, control-surface definitions, access profiles, process templates, and action definitions.

## 3. Delivery laws

### 3.1 Finite plan, detailed phases

The whole project follows the phases in this document. A phase may not start implementation until a phase-detail document exists.

For phase `N`, create:

```txt
docs/phases/PHASE_N_<name>.md
```

That document must contain:

- phase objective;
- KISS PM simplicity assumptions and UX principles for the phase;
- exact functional scope;
- exact non-scope;
- domain entities affected;
- API contracts affected;
- UI screens affected;
- mandatory E2E scenarios;
- unit/integration test requirements;
- data fixtures;
- acceptance criteria;
- phase exit gate;
- risks and decisions.

Codex may autonomously draft and refine this phase-detail document. Codex must not implement product code for a phase until the phase-detail document exists.

### 3.2 E2E is the operational truth

Unit and integration tests are necessary but not sufficient. Because this product is a complex operational system, E2E tests are the main proof that the product works as a user-facing management loop.

Every phase after Phase 1 must include mandatory E2E scenarios. A phase cannot be complete if its required E2E scenarios are missing, skipped, flaky, or merely superficial.

### 3.3 No phase can silently expand forever

Each phase has anti-scope. Anti-scope items must not be implemented inside the phase unless the phase-detail document explicitly reclassifies them and explains the tradeoff.

If a feature is important but not required for the current phase gate, record it in:

```txt
docs/backlog/FUTURE_SCOPE.md
```

Do not let future scope block the current phase unless it invalidates the architecture.

### 3.4 No direct jump to UI polish

UI polish cannot substitute for missing domain rules, permissions, audit, or E2E proof. A management instrument must first be correct, governed, and testable. Visual refinement comes after behavior is proven.

### 3.5 No feature without a control loop

For any major feature, define:

```txt
Input -> Decision / Signal -> Action -> Audit -> Verification -> Learning
```

If a feature only displays data and cannot support decision-making or future planning, document why it belongs in this product.

### 3.6 Phase contract protocol

Every phase must move through this protocol:

```txt
1. Phase detail drafted
2. Scope and non-scope frozen
3. E2E scenarios and fixtures defined
4. Closed implementation tasks created
5. Implementation work performed
6. Required verification run
7. Phase exit gate reviewed
8. Follow-up and future scope recorded
```

Codex may work autonomously inside a frozen phase contract. Codex must not silently change the phase objective, remove E2E proof, weaken assertions, or move unfinished phase-gate work into future scope just to claim completion.

## 4. Global phase overview

| Phase | Name | Primary outcome |
|---|---|---|
| 0 | Product and architecture contract | Shared source of truth before code |
| 1 | Repository, platform, and E2E foundation | Running skeleton with reliable verification |
| 2 | SaaS tenant core and access control | Multi-tenant base, permissions, audit |
| 3 | CRM intake and opportunity-to-project | CRM becomes the project starting point |
| 4 | Project lifecycle and work management | Configurable project process, tasks, Kanban |
| 5 | Scheduling and Gantt foundation | Canonical tasks become a usable project plan |
| 6 | Resource planning and conflict resolution | Capacity, overloads, reservations, fixes |
| 7 | KPI engine and control signals | Configurable metrics produce deviations |
| 8 | Control surfaces and action engine | Management instruments execute governed actions |
| 9 | Closed portfolio and retrospectives | Finished projects generate learning and trends |
| 10 | No-code tenant customization | Client can configure without development |
| 11 | Integrations and migration | External systems are adapters, not core |
| 12 | Production SaaS hardening and market release | Secure, observable, deployable, sellable product |

## 5. Phase 0 — Product and architecture contract

### Objective

Create the non-negotiable product, architecture, and delivery contract before implementation begins.

### Mandatory deliverables

- `AGENTS.md` finalized.
- `docs/00_PROJECT_GLOBAL_GOAL.md` finalized.
- `docs/01_PRD.md` finalized.
- `docs/02_UNIVERSAL_PROJECT_BP.md` finalized.
- `docs/04_MASTER_PHASE_PLAN.md` finalized.
- `docs/05_E2E_TRUTH_CONTRACT.md` finalized.
- `docs/architecture/ARCHITECTURE.md`.
- `docs/domain/DOMAIN_MODEL.md`.
- `docs/domain/CONTROL_SURFACE_ENGINE_SPEC.md`.
- `docs/domain/ACTION_ENGINE_SPEC.md`.
- `docs/domain/KPI_ENGINE_SPEC.md`.
- `docs/domain/CRM_INTAKE_SPEC.md`.
- `docs/domain/SCHEDULING_ENGINE_SPEC.md`.
- `docs/domain/RESOURCE_PLANNING_SPEC.md`.
- `docs/domain/TENANT_CUSTOMIZATION_SPEC.md`.
- `docs/domain/ACCESS_CONTROL_SPEC.md`.
- `docs/decisions/0001-initial-greenfield-architecture.md`.

### Mandatory E2E proof

No product E2E yet. Phase 0 must define the E2E strategy, scenario ledger format, test-data strategy, and commands that will exist in Phase 1.

### Exit gate

Phase 0 is complete only when the source-of-truth docs define the end-state product, the phase plan, the domain boundaries, and the verification strategy. Codex must be able to answer “what are we building toward?” from docs alone.

### Anti-scope

- No production UI.
- No business-feature implementation.
- No real external integrations.

## 6. Phase 1 — Repository, platform, and E2E foundation

### Objective

Create a running monorepo skeleton with deterministic verification, including E2E from the beginning.

### Mandatory deliverables

- Monorepo structure.
- Apps: `apps/web`, `apps/api`.
- Packages scaffolded according to architecture.
- TypeScript setup.
- Lint, typecheck, unit, integration, and E2E scripts.
- API health route.
- Web shell route.
- Test database or deterministic fixture strategy.
- Playwright or equivalent E2E runner.
- Seeded demo tenant fixture.
- `data-testid` conventions for critical UI controls.
- CI-ready verification commands.

### Mandatory E2E scenarios

- `E2E-001`: application boots, health route responds, web shell renders.
- `E2E-002`: seeded demo tenant can be loaded without external services.
- `E2E-003`: unauthenticated user is redirected or blocked according to auth design.
- `E2E-004`: test user can enter the app shell and see navigation placeholders.

### Exit gate

The repository must have repeatable verification. `typecheck`, unit smoke, API smoke, and E2E smoke must pass locally. E2E must run without Bitrix24, production credentials, or live customer data.

### Anti-scope

- No CRM features.
- No project management features.
- No KPI/control-surface features.
- No Gantt implementation beyond placeholders.

## 7. Phase 2 — SaaS tenant core and access control

### Objective

Build the multi-tenant foundation, access profiles, scopes, custom labels, audit primitives, and safe configuration storage.

### Mandatory deliverables

- Tenant/workspace model.
- User model.
- AccessProfile model.
- Permission and scope evaluator.
- Tenant label configuration.
- Basic custom field registry.
- Audit event primitives.
- Tenant isolation in API and data access.
- Admin diagnostics for permission evaluation.

### Mandatory E2E scenarios

- `E2E-010`: tenant A user cannot see tenant B data.
- `E2E-011`: admin can create or edit an access profile.
- `E2E-012`: read-only user can open a page but cannot execute a mutation.
- `E2E-013`: tenant label change is reflected in UI without code changes.
- `E2E-014`: an auditable action records actor, tenant, timestamp, and result.

### Exit gate

All later domain entities can rely on tenant isolation, access checks, labels, and audit. Permission tests must prove enforcement at backend/application level, not only hidden buttons.

### Anti-scope

- Full no-code builder.
- Complex process templates.
- Full CRM pipeline.

## 8. Phase 3 — CRM intake and opportunity-to-project

### Objective

Make CRM intake the starting point of the project-control lifecycle.

### Mandatory deliverables

- Clients/accounts.
- Contacts.
- Opportunities.
- Opportunity stages.
- Opportunity readiness checks.
- Typology/category/custom fields.
- Process-template matching draft.
- Demand-estimation draft.
- Capacity-feasibility draft using deterministic seeded resources.
- Project draft creation from qualified opportunity.
- Opportunity-to-project audit trail.

### Mandatory E2E scenarios

- `E2E-020`: user creates an opportunity with required fields.
- `E2E-021`: opportunity with missing fields shows readiness blockers.
- `E2E-022`: user runs a demand/capacity feasibility analysis.
- `E2E-023`: user creates a project draft from a qualified opportunity.
- `E2E-024`: created project draft remains valid without an external CRM adapter.

### Exit gate

A user can move from CRM opportunity to project draft through an audited, tested flow. The flow must not depend on Bitrix24 or any external CRM.

### Anti-scope

- Full CRM replacement.
- Billing, marketing automation, telephony, email campaigns.
- Full historical template learning.

## 9. Phase 4 — Project lifecycle and work management

### Objective

Build configurable project lifecycle templates and canonical work management.

### Mandatory deliverables

- ProcessTemplate.
- StageTemplate.
- Project lifecycle state machine.
- Project stages.
- Artifacts/deliverables.
- Approval basics.
- Canonical Task.
- TaskParticipant / Assignment roles.
- Task comments and status history.
- My Tasks.
- Kanban by relation: executor, co-executor, requester, controller, approver, observer.
- Task creation from template.

### Mandatory E2E scenarios

- `E2E-030`: user creates project from process template.
- `E2E-031`: user moves a project stage through required checks.
- `E2E-032`: stage cannot close when required artifact/approval is missing.
- `E2E-033`: task appears in My Tasks for executor and in controlled tasks for controller/requester.
- `E2E-034`: Kanban status change updates the same canonical task, not a duplicate model.

### Exit gate

A project can be created, structured by stages, populated with tasks, and operated through a user work queue. Canonical task identity must be proven across project, Kanban, and user views.

### Anti-scope

- Full Gantt scheduling engine.
- Resource leveling.
- Advanced custom workflow builder.

## 10. Phase 5 — Scheduling and Gantt foundation

### Objective

Turn canonical tasks into a usable project plan with basic Gantt behavior.

### Mandatory deliverables

- WBS/tree structure.
- Planned start/finish.
- Duration.
- Basic work estimate.
- Basic dependency model, at minimum Finish-to-Start.
- Progress.
- Baseline draft.
- Gantt UI MVP.
- Inline task editing where safe.
- Project schedule save flow.
- Scheduling package with deterministic unit tests.

### Mandatory E2E scenarios

- `E2E-040`: user opens project Gantt from project/portfolio entry.
- `E2E-041`: user creates a task in Gantt and sees it in My Tasks/Kanban.
- `E2E-042`: user changes task dates in Gantt and the project plan persists after reload.
- `E2E-043`: user creates a dependency and schedule view reflects it.
- `E2E-044`: baseline values are visible and do not silently change when live dates change.

### Exit gate

The same task model supports Gantt and Kanban. Schedule changes persist, reload, and are covered by E2E. Scheduling calculations must be deterministic and isolated from UI.

### Anti-scope

- Full MS Project clone.
- Advanced Work/Duration/Units behavior unless explicitly detailed.
- MSPDI/XML import/export.
- Real-time collaboration.

## 11. Phase 6 — Resource planning and conflict resolution

### Objective

Make resource capacity, load, reservations, overload detection, and conflict resolution operational.

### Mandatory deliverables

- Resource profile.
- Capacity calendar.
- Availability exceptions.
- Assignment load buckets.
- Resource reservations from CRM/project draft.
- Overload detection.
- Conflict severity.
- Conflict center control surface draft.
- Resolution proposals: shift, split, reassign, reserve, accept risk.
- Dry-run preview before applying resolution.
- Applied resolution audit trail.

### Mandatory E2E scenarios

- `E2E-050`: assigned work creates visible load in resource planning.
- `E2E-051`: overload is detected for a user/period.
- `E2E-052`: user opens overload from control surface into resolution flow.
- `E2E-053`: user previews shift/split/reassign before applying.
- `E2E-054`: applied resolution changes plan/load and records audit.
- `E2E-055`: unauthorized user can see permitted data but cannot resolve conflict.

### Exit gate

Resource overloads can be detected and resolved through governed actions with dry-run and audit. E2E must prove before/after state.

### Anti-scope

- Fully optimal resource leveling.
- AI-only recommendations without deterministic explanation.
- External calendar sync.

## 12. Phase 7 — KPI engine and control signals

### Objective

Implement configurable KPI definitions, formulas, thresholds, evaluations, and deviations/control signals.

### Mandatory deliverables

- KpiDefinition.
- FormulaDefinition using constrained safe expressions.
- ThresholdRule.
- Evaluation periods.
- Formula versioning.
- Metric source references.
- KPI evaluation service.
- ControlSignal/Deviation entity.
- KPI history.
- KPI admin configuration MVP.

### Mandatory E2E scenarios

- `E2E-060`: admin defines KPI threshold for project delay or work variance.
- `E2E-061`: project state creates warning/critical control signal.
- `E2E-062`: user opens KPI deviation and sees source data/formula/threshold.
- `E2E-063`: changing threshold changes future evaluation without corrupting historical evaluations.
- `E2E-064`: unauthorized user cannot edit KPI definitions.

### Exit gate

KPI signals are traceable, reproducible, versioned, and visible in the UI. KPI formulas must not live in UI components.

### Anti-scope

- Arbitrary JavaScript or SQL formulas.
- Full BI-style semantic layer.
- Predictive AI metrics.

## 13. Phase 8 — Control surfaces and action engine

### Objective

Deliver the product's central idea: management instruments that expose governed actions.

### Mandatory deliverables

- ControlSurfaceDefinition.
- ControlSurfaceView.
- Widgets/cards/table/board/Gantt entry representations.
- Control surface data-source abstraction.
- ActionDefinition.
- Action command binding.
- ActionExecutionLog.
- Permission checks for actions.
- Dry-run support where applicable.
- Control surfaces for:
  - CRM Intake Control;
  - Portfolio Control;
  - Resource Load Control;
  - KPI Deviation Control;
  - My Work Control.
- Actions:
  - create task;
  - open Gantt;
  - request explanation;
  - create corrective action;
  - reassign resource;
  - shift/split work;
  - reserve capacity;
  - escalate;
  - accept risk/deviation with reason.

### Mandatory E2E scenarios

- `E2E-070`: user opens Portfolio Control and drills into project Gantt.
- `E2E-071`: user creates corrective task from KPI deviation control surface.
- `E2E-072`: user resolves resource overload from Resource Load Control.
- `E2E-073`: user accepts risk/deviation with mandatory reason and audit record.
- `E2E-074`: action availability changes by access profile and scope.
- `E2E-075`: control surface refresh reflects result of executed action.

### Exit gate

At least five management instruments must be operational, and actions must go through the action engine. No control surface may directly mutate domain state.

### Anti-scope

- Full drag-and-drop instrument builder.
- Arbitrary user-defined actions.
- Public marketplace.

## 14. Phase 9 — Closed portfolio and retrospectives

### Objective

Make closed projects useful for retrospective analytics and future planning.

### Mandatory deliverables

- Project closure workflow.
- Closure checklist.
- ClosedProjectSnapshot.
- Snapshot versioning.
- Plan/fact metrics.
- Retrospective KPI trends.
- Lessons learned.
- Template-improvement action.
- Closed Portfolio Control.

### Mandatory E2E scenarios

- `E2E-080`: user closes project with required closure data.
- `E2E-081`: closed project snapshot remains stable after live/project template changes.
- `E2E-082`: user opens closed portfolio and sees trend metrics.
- `E2E-083`: user creates template-improvement action from retrospective finding.

### Exit gate

Closed projects feed learning and future planning. Retrospective data must be snapshot-based where practical and cannot silently mutate.

### Anti-scope

- Full data warehouse.
- Advanced statistical forecasting.
- Public benchmark analytics.

## 15. Phase 10 — No-code tenant customization

### Objective

Enable clients to configure the system without custom development for common differences.

### Mandatory deliverables

- Role/label builder.
- Process template builder MVP.
- Custom field builder MVP.
- KPI builder MVP.
- Control surface layout builder MVP.
- Saved views.
- Action enable/disable and action-form configuration.
- Configuration versioning and validation.
- Admin preview mode.
- Configuration export/import.

### Mandatory E2E scenarios

- `E2E-090`: admin renames roles/stages and sees tenant labels in runtime UI.
- `E2E-091`: admin adds custom project field and uses it in a control surface.
- `E2E-092`: admin creates or edits KPI threshold and sees effect in evaluation.
- `E2E-093`: admin configures a control surface layout and saves it.
- `E2E-094`: invalid configuration is rejected with actionable validation.
- `E2E-095`: previous runtime behavior remains stable after unrelated configuration change.

### Exit gate

A tenant can adapt roles, stages, custom fields, KPI thresholds, saved views, and core control-surface layouts without code changes.

### Anti-scope

- Arbitrary SQL/JS.
- Plugin marketplace.
- Unlimited workflow language.

## 16. Phase 11 — Integrations and migration

### Objective

Add external systems as adapters and support controlled migration from prototype/legacy systems.

### Mandatory deliverables

- Integration adapter interface.
- ExternalMapping model.
- Bitrix24 adapter if selected as first production adapter.
- CRM import adapter or manual import if external CRM is not first.
- MS Project import/export decision and MVP if required.
- Migration scripts and validation reports.
- Idempotency keys.
- Sync audit.
- Rate-limit/retry strategy.
- Failure-mode UI.

### Mandatory E2E scenarios

- `E2E-100`: mocked adapter imports opportunity/project/task data into canonical model.
- `E2E-101`: repeated import is idempotent.
- `E2E-102`: failed adapter call produces visible safe failure state.
- `E2E-103`: imported project can be operated without adapter after import.
- `E2E-104`: external mapping is visible in admin diagnostics.

### Exit gate

External systems remain adapters. Canonical domain operations work without live external systems. Migration can be validated before production use.

### Anti-scope

- Dependence on live production external systems in E2E.
- Integration-specific domain branching.
- Unsafe writes to customer systems without confirmation and audit.

## 17. Phase 12 — Production SaaS hardening and market release

### Objective

Prepare the system for production customers, not just internal use.

### Mandatory deliverables

- Production deployment pipeline.
- Environment configuration and secret management.
- Observability: logs, metrics, traces where practical.
- Error monitoring.
- Backup/restore strategy.
- Tenant isolation verification.
- Security review.
- Permission review.
- Data retention policy.
- Audit review.
- Performance/load baseline.
- Admin onboarding flow.
- Demo tenant and sample template pack.
- Documentation for tenants and operators.
- Release checklist.
- Beta customer readiness.

### Mandatory E2E scenarios

- `E2E-110`: full happy path from CRM opportunity to project closure in seeded demo tenant.
- `E2E-111`: full permission matrix smoke across core roles.
- `E2E-112`: tenant isolation smoke across control surfaces, actions, API, and search.
- `E2E-113`: production-like deployment smoke.
- `E2E-114`: backup/restore or data recovery smoke if supported in environment.
- `E2E-115`: no critical path depends on live external services.

### Exit gate

The product is ready for controlled market release only if core E2E regression passes, security/tenant isolation risks are addressed, production deployment is repeatable, and the customer onboarding path is documented.

### Anti-scope

- Enterprise marketplace.
- Unlimited customization.
- Industry-wide template library.
- AI autonomous decision-making without human governed action.

## 18. Phase-detail rule

Before starting any phase after Phase 0, Codex must create or update the corresponding phase-detail document using:

```txt
docs/templates/PHASE_BRIEF_TEMPLATE.md
```

The phase-detail document must contain closed tasks. A task is closed only if it has:

- owner/module;
- exact expected behavior;
- acceptance criteria;
- E2E scenario reference where relevant;
- verification command;
- non-scope;
- done evidence.

Open-ended tasks like “improve UI”, “make reports better”, “finish CRM”, or “add integrations” are not valid implementation tasks.

## 19. Regression policy

The E2E suite grows over time. A later phase must keep earlier phase E2E scenarios passing unless a documented product decision intentionally changes behavior and updates the scenario.

When a production-grade bug is found, add a regression test at the right level. If the bug is a broken user workflow or cross-module behavior, add or update an E2E scenario.

## 20. Final release definition

The first market release is not complete until:

- Phase 12 exit gate is passed;
- full core E2E suite passes;
- tenant isolation is proven by E2E and integration tests;
- access control is enforced at backend/application layer;
- control surfaces execute governed actions only;
- audit trail exists for management actions;
- tenant customization works for labels, roles, stages, fields, KPI thresholds, and saved control-surface views;
- CRM intake can create project drafts;
- resource overloads can be detected and resolved;
- KPI deviations can produce corrective actions;
- closed projects produce stable retrospective snapshots;
- external systems are adapters, not core dependencies.
