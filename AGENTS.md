# AGENTS.md

## 0. Multi-agent coordination protocol

This repository uses `.agent-bus/` as the project-local coordination and memory layer for concurrent Codex agents. Every future agent must follow this protocol before editing project files.

Two-agent runs use an explicit Lead/Worker model:

- Agent A is the lead/orchestrator and owns task decomposition, process control, intervention, independent verification, and the final verdict.
- Agent B is the worker and owns assigned implementation blocks.
- Both agents may use subagents only inside the current objective. Delegated results are not accepted until the delegating agent verifies them, and final acceptance still belongs to Agent A.
- Agent A must maintain a shared run ledger under `.agent-bus/orchestration/runs/<run-id>.json` using `.agent-bus/orchestration/TEMPLATE.json`.
- Oral status is not source of truth. Progress, blockers, changed files, commands, exit codes, artifacts, interventions, and decisions must be written to the run ledger, handoff notes, task records, or events.

Mandatory startup routine:

1. Read this `AGENTS.md`.
2. Read `.agent-bus/README.md`.
3. Read `.agent-bus/state/CURRENT.md`.
4. Read `.agent-bus/queue.json` and `.agent-bus/ownership.json` when they exist.
5. Inspect `.agent-bus/tasks/` for backlog, active, blocked, and done tasks.
6. Inspect `.agent-bus/claims/` and `.agent-bus/locks/` for current ownership and risky-file locks.
7. Create or update a session note in `.agent-bus/sessions/` for the current run.
8. Claim exactly one task before editing project files.
9. Run `node scripts/agent-bus-guard.mjs --task <TASK_ID> --once` after claiming and locking. Do not edit project files if it fails.
10. For a two-agent run, read `.agent-bus/orchestration/README.md` and create or update the shared run ledger before implementation starts.

When working from a separate git worktree, use the shared bus path from `AGENT_BUS_ROOT` if it is set. If it is not set, use the `.agent-bus/` directory in the current checkout.

Task claiming rules:

- Claim files live in `.agent-bus/claims/`.
- Claim file names must match task ids, for example `.agent-bus/claims/0001-verify-agent-bus.claim.json`.
- Agents should claim only tasks marked `runnable` or otherwise unblocked in `.agent-bus/queue.json`.
- Agents must stay inside the task `write_scope` and avoid the task `forbidden` globs.
- An agent must not work on an already claimed task unless the claim is stale or explicitly abandoned in the claim file or a handoff note.
- A claim is stale when `heartbeat_at` is older than 4 hours and no matching active session or lock has been updated in that period.
- Before taking over a stale claim, write a handoff note explaining the takeover and preserve the old claim details in the new claim file `notes`.
- Keep `heartbeat_at` current during long tasks.

Locking rules:

- Before editing risky shared files, create a lock in `.agent-bus/locks/`.
- Risky files include `package.json`, package lockfiles, database schemas, migrations, global configs, CI configs, `AGENTS.md`, `.gitignore`, `docs/status/*`, and `.agent-bus/state/*`.
- Ownership groups and exclusive paths are documented in `.agent-bus/ownership.json`; follow that file when deciding whether a lock is required.
- Prefer atomic directory creation for locks, for example `mkdir .agent-bus/locks/AGENTS.md.lock`.
- A lock must contain an `owner.json` or short `README.md` with agent id, task id, locked paths, timestamp, and reason.
- Do not edit a locked risky file unless you own the lock, the lock is stale, or the previous owner explicitly handed it off.
- Remove only your own locks during completion.

Completion routine:

1. Run the narrowest relevant verification commands.
2. Run `node scripts/agent-bus-guard.mjs --task <TASK_ID> --once` before final handoff while your edits are still present.
3. For a two-agent run, update the shared ledger and run `node scripts/agent-bus-orchestration-check.mjs --ledger <RUN_LEDGER>`.
4. Agent A must run `node scripts/agent-bus-orchestration-check.mjs --ledger <RUN_LEDGER> --acceptance` before giving a final accepted verdict.
5. Update the task status and move or copy task notes to the appropriate task directory when useful.
6. Write a handoff note in `.agent-bus/handoff/`.
7. Update `.agent-bus/state/CURRENT.md` if the project state, phase, active work, blockers, or next recommended step changed.
8. Append an event to `.agent-bus/events/events.jsonl` when the task changes coordination state, completes, blocks, or hands off.
9. Remove your own locks.
10. Leave clear next steps and unresolved risks.

Verification rules:

- No task is considered done without tests, a documented verification command, or a clear explanation why testing was not possible.
- Do not claim success without fresh evidence.
- Document failed commands and unresolved issues in the task and handoff note.
- Do not weaken tests, skip phase-critical E2E, or mark partial behavior as complete.
- `scripts/agent-bus-guard.mjs` is the required coordination guard. It writes pass/fail events to `.agent-bus/events/events.jsonl`; a failure means the agent must stop, fix ownership/locks/scope, or hand off instead of continuing.
- `scripts/agent-bus-orchestration-check.mjs` is the required Lead/Worker ledger checker. A `blocked` block must include fresh reason, evidence, and parallel action. A `verified` block must be verified by Agent A with evidence. Final acceptance requires the `--acceptance` check to pass.

## 1. Project mission

We are building **KISS PM** — a greenfield SaaS platform for operational project control.

KISS PM means **Keep It Simple, "Sonny" Project Manager**. The name is a product rule, not only a brand. The system may be internally powerful, but the user-facing management loop must stay simple, guided, and action-oriented.

KISS PM is not a static reporting system and must not be designed as a collection of dashboards for passive review. The product is a management-control platform where CRM intake, project planning, resource capacity, KPI control, tasks, Gantt planning, portfolio control, and retrospective analytics form one closed operational loop:

```txt
CRM / Opportunity
  -> project intake
  -> demand and capacity assessment
  -> project plan and baseline
  -> execution through tasks, Gantt, resources, and statuses
  -> KPI/deviation detection
  -> governed management action
  -> replan / task / resource decision / escalation / accepted risk
  -> repeated control and retrospective learning
```

A report-like screen must be treated as a **management instrument** or **control surface**. A control surface must show operational data, detect a risk or decision point, expose governed actions for authorized users, and create an audit trail for every action.

## 2. Non-negotiable product principles

1. Treat the product as KISS PM: simple and clear for users, strict and verified underneath.
2. Do not model the product as a Bitrix-specific reporting app.
3. Do not use `report` as the primary product concept. Use `ControlSurface`, `ManagementInstrument`, `ControlSignal`, `ManagementAction`, and `CorrectiveAction` in domain language.
4. Do not hardcode one company's business process, roles, stage names, KPI labels, thresholds, or report layouts into domain logic.
5. All company-specific terminology must be represented as configurable tenant templates and labels.
6. CRM is the starting point of the project-control lifecycle, not a separate sales-only module.
7. Gantt, Kanban, resource planning, KPI control, and control surfaces must use the same canonical project/task/assignment model.
8. Bitrix24, AmoCRM, MS Project, Jira, Slack, email, or any external system must be modeled as integration adapters, not as the domain core.
9. Control surfaces must not mutate business state directly. They must execute governed commands through the application/action layer.
10. Every meaningful management action must be permission-checked, auditable, and traceable to the source entity, source control signal, and actor.
11. Closed-project analytics must use immutable snapshots where practical, so retrospective trends do not change silently after history is edited.

## 2.1 KISS PM simplicity rules

KISS PM must remain simple at the user-workflow level even when the platform becomes deep internally.

- Prefer guided workflows over raw configuration.
- Prefer one clear next action over many ambiguous buttons.
- Prefer safe presets over blank-slate builders.
- Prefer progressive disclosure over dense all-in-one screens.
- Prefer preview/dry-run before destructive or large state changes.
- Prefer explainable recommendations over opaque automation.
- Never use simplicity as an excuse for incomplete domain logic, missing verification, or weak E2E coverage.

A feature is not KISS-compliant if it is technically powerful but forces normal users to understand internal implementation concepts to make a routine decision.

## 3. Source-of-truth documents

Before implementing behavior, read the nearest relevant source documents. If documents conflict, resolve in this order:

1. `docs/00_PROJECT_GLOBAL_GOAL.md`
2. this `AGENTS.md`
3. `docs/06_PRODUCT_IDENTITY.md`
4. `docs/04_MASTER_PHASE_PLAN.md`
5. `docs/05_E2E_TRUTH_CONTRACT.md`
6. `docs/01_PRD.md`
7. `docs/02_UNIVERSAL_PROJECT_BP.md`
8. `docs/03_START_PROMPT_FOR_CODEX.md`
9. phase-detail documents under `docs/phases/`
10. future architecture, API, domain-model, and data-model docs
11. archived legacy process or prototype docs

Legacy BitrixReports materials are reference material only. They may inspire domain concepts, workflows, control surfaces, and acceptance criteria, but they must not force Bitrix-specific naming or implementation decisions into the greenfield SaaS core.

## 4. Expected repository shape

If the repository has no established structure yet, prefer this shape unless a newer architecture document overrides it:

```txt
apps/
  web/                 # React/Vite TypeScript UI
  api/                 # Bun/Hono TypeScript API

packages/
  domain-core/         # tenant, user, workspace, audit, shared primitives
  access-control/      # profiles, permissions, scopes, policy evaluation
  tenant-config/       # labels, custom fields, templates, feature flags
  crm-core/            # accounts, contacts, opportunities, project intake
  project-core/        # projects, stages, artifacts, approvals, tasks
  scheduling-engine/   # WBS, dependencies, calendars, baseline, critical path
  resource-planning/   # capacity, reservations, load, overloads
  kpi-engine/          # definitions, formulas, thresholds, evaluations
  control-surfaces/    # instrument definitions, views, widgets, actions
  action-engine/       # governed commands and action execution log
  workflow-engine/     # process transitions, approvals, stage gates
  notification-engine/ # notifications, subscriptions, reminders
  integrations/        # external adapters only

docs/
  00_PROJECT_GLOBAL_GOAL.md
  01_PRD.md
  02_UNIVERSAL_PROJECT_BP.md
  03_START_PROMPT_FOR_CODEX.md
  04_MASTER_PHASE_PLAN.md
  05_E2E_TRUTH_CONTRACT.md
  phases/
  e2e/
  templates/
  architecture/
  domain/
  specs/
  decisions/
```

Default implementation stack until an architecture document says otherwise:

- language: TypeScript;
- backend: Bun + Hono;
- frontend: React + Vite + TypeScript;
- UI: shadcn/ui + Tailwind CSS unless a design-system decision overrides it;
- server state: TanStack Query;
- database: PostgreSQL;
- schema validation: Zod;
- tests: unit tests for pure domain logic, integration tests for API behavior, and E2E tests as the primary acceptance truth for complete management-control flows.

Do not add production dependencies without explaining why the dependency is necessary, what alternatives were considered, and what risk it introduces.

## 5. Language and naming rules

- User-facing UI text must be Russian by default.
- Code identifiers, database fields, API routes, tests, and package names should be in English.
- Domain abbreviations are allowed only when defined in a glossary or tenant template.
- Prefer universal names in domain code: `ProjectPrincipal`, `StageLead`, `ResourceManager`, `Opportunity`, `ProjectIntake`, `ControlSurface`, `KpiDefinition`.
- Tenant-specific labels may display Russian terms such as `ГАП`, `РКГ`, `РПГ`, `НЧ`, `ГЗМПК`, `РДП`, but these labels must live in configuration, not in core logic.

## 6. Domain boundaries

Use these bounded contexts as the default mental model:

1. **Tenant and configuration** — tenants, labels, custom fields, templates, feature flags.
2. **Access control** — profiles, permissions, scopes, policy evaluation.
3. **CRM intake** — clients, contacts, opportunities, estimates, intake decisions.
4. **Project lifecycle** — projects, stages, stage gates, artifacts, approvals.
5. **Work management** — tasks, participants, roles in tasks, comments, statuses, Kanban.
6. **Scheduling** — WBS, Gantt, dependencies, duration, work, units, calendars, baseline, critical path.
7. **Resource planning** — capacity, assignments, load buckets, overload detection, reservations.
8. **KPI control** — KPI definitions, formulas, thresholds, evaluations, deviations/control signals.
9. **Control surfaces** — configurable management instruments with views, filters, widgets, actions.
10. **Action engine** — governed commands triggered from control surfaces or workflows.
11. **Retrospective analytics** — closed-project snapshots, trend analysis, lessons learned.
12. **Integrations** — external adapters and synchronization mappings.

Keep domain logic out of React components and route handlers. Route handlers should validate input, authorize, call application services, and return stable DTOs. UI components should render state and trigger commands; they must not contain KPI formulas, permission rules, scheduling algorithms, or resource-planning logic.

## 7. Core domain invariants

These invariants must be protected by code, tests, and data constraints where practical:

- Every tenant-owned entity belongs to exactly one tenant.
- Every project belongs to one tenant and has a lifecycle status.
- Every project may originate from a CRM opportunity, but a project must remain valid without an external CRM connection.
- Every task belongs to a project; a task may belong to a project stage and may appear in Gantt, Kanban, control surfaces, and user work queues.
- Do not create separate task entities for Gantt tasks, Kanban tasks, report tasks, and corrective tasks. Use one canonical task model with view-specific projections.
- Task participation is role-based. Do not reduce it to one `assigneeId`. Use participant/assignment roles such as executor, co-executor, requester, controller, approver, observer.
- Scheduling calculations must be deterministic and testable without UI or network dependencies.
- Resource overload calculations must be reproducible from assignments, capacity, calendars, and reservations.
- KPI evaluations must be traceable to a KPI definition, source data, formula version, threshold rule, period, and evaluation timestamp.
- A control signal/deviation must be traceable to the KPI/resource/schedule/project condition that produced it.
- A management action must be traceable to actor, source control surface, source row/card/widget when applicable, command type, before/after state, and result.
- Control surfaces never write directly to business state; they call action/application commands.
- Closed-project retrospective metrics should be based on snapshots, not mutable live project state, unless the document explicitly says otherwise.

## 8. SaaS customization rules

The system must be configurable by tenants without code changes.

Model configurable parts as data:

- `RoleTemplate`
- `ProcessTemplate`
- `StageTemplate`
- `ArtifactTemplate`
- `TaskTemplate`
- `ApprovalTemplate`
- `KpiDefinition`
- `FormulaDefinition`
- `ThresholdRule`
- `ControlSurfaceDefinition`
- `ActionDefinition`
- `CustomFieldDefinition`
- `AccessProfile`

Do not implement tenant-specific branches like:

```ts
if (tenant.name === 'Specific Company') { ... }
if (stage.name === 'ГЗМПК') { ... }
```

Use stable system keys and tenant labels instead:

```ts
stage.systemKey === 'concept_design'
stage.label === tenantConfiguredLabel
```

If a tenant-specific requirement appears, convert it into a generic template capability or document why it cannot be generalized.

## 9. Control-surface and action rules

A control surface is a governed operational workspace, not a passive report.

Every control surface definition should be able to describe:

- data source;
- entity type;
- view type: table, board, calendar, timeline, Gantt, heatmap, cards, dashboard, or hybrid;
- filters and groupings;
- visible fields/widgets;
- calculated KPI cards;
- control signals and severity rules;
- row/card/bulk/global actions;
- permission requirements;
- drill-down targets;
- audit behavior;
- saved views.

Every action must define:

- label and description;
- target entity type;
- preconditions;
- required permission;
- input schema;
- command binding;
- dry-run/preview behavior where risk is material;
- audit policy;
- post-action refresh/notification behavior.

Examples of allowed governed actions:

- create task;
- create corrective action;
- open project Gantt;
- create project from CRM opportunity;
- reserve capacity;
- reassign task/resource;
- shift task dates;
- split planned work;
- escalate;
- request explanation;
- accept risk/deviation with reason;
- create approval request;
- change lifecycle stage;
- update KPI target when authorized.

## 10. Phase delivery discipline

The project has a finite master delivery plan in `docs/04_MASTER_PHASE_PLAN.md`. Do not treat the project as an open-ended MVP.

Before implementing any product phase after Phase 0, create or update the phase-detail document:

```txt
docs/phases/PHASE_N_<name>.md
```

Use `docs/templates/PHASE_BRIEF_TEMPLATE.md`. Implementation for a phase may start only after the phase-detail document defines a finite closed backlog, acceptance criteria, test data, mandatory E2E scenarios, and an exit gate.

During an active phase:

- implement only the closed backlog, blocker fixes, and bugs required by the phase gate;
- do not expand scope because a useful adjacent feature appears;
- capture future ideas in `docs/backlog/FUTURE_SCOPE.md`;
- do not implement future-phase capabilities except as inert structural stubs explicitly required by architecture;
- do not mark the phase complete while phase-gate E2E tests are missing, skipped, flaky, or failing;
- do not replace E2E proof with screenshots, component tests, unit tests, or optimistic manual claims for critical management loops.

If a requested task conflicts with the master phase plan, document the conflict and choose the smallest safe action that keeps the phase gate coherent.

## 11. E2E truth protocol

E2E is the primary truth contour for this product because the product value is in complete management loops, not isolated functions.

A state-changing user flow is not accepted until E2E evidence proves the relevant journey works through UI, API/domain state, permissions, audit, and refreshed projections where applicable.

For every state-changing feature, prefer this E2E assertion pattern:

```txt
1. User sees the starting state.
2. Authorized user executes the action.
3. Unauthorized or out-of-scope user cannot execute it.
4. UI shows the resulting state.
5. Persisted/API state changed correctly.
6. Audit/action log was created.
7. Related control surface/view refreshes.
8. Reload keeps the state.
```

Do not accept tests that only click a button and check a toast for important flows.

E2E suites should be layered:

- `test:e2e:smoke` for critical smoke;
- `test:e2e:phase` for active phase acceptance;
- `test:e2e:regression` for full release/regression coverage.

If the repository is not initialized yet, P1 must create these commands or equivalent commands.

## 12. Autonomous work protocol

Work autonomously when the task can be completed safely from the available docs and code.

At the start of any non-trivial task:

1. Read relevant source-of-truth docs and nearby code.
2. Identify the bounded context and invariants involved.
3. Make a short implementation plan.
4. Prefer small, focused changes.
5. Add or update tests before or with behavior changes.
6. Run the narrowest meaningful verification commands.
7. Update docs if behavior, domain language, API contracts, or architecture changed.
8. Report what changed, what was verified, and what remains risky.

When information is missing, do not stop by default. Choose the safest reversible assumption, document it in `docs/decisions/`, implement the narrowest useful step, and clearly report the assumption. Ask for human input only when the missing information affects irreversible architecture, security, legal/compliance posture, production data deletion, pricing/business commitments, or external credentials.

## 13. Evidence-based delivery rules

A task is not complete merely because code was written.

A task can be called complete only when:

- behavior matches the relevant doc or the documented assumption;
- relevant unit/integration tests pass;
- required phase E2E scenarios pass for state-changing user flows;
- typecheck/lint pass when affected;
- UI changes have at least a targeted smoke check, component test, or E2E check depending on risk;
- state-changing flows have write-flow evidence, not read-only evidence;
- no known critical/important issue remains unhandled;
- docs and decision logs are updated when needed.

If a failing test, behavior mismatch, weak assertion, stale fixture, permission gap, audit gap, missing cleanup, or data-integrity issue is found during the task, treat it as active work in the current task unless it is demonstrably unrelated and non-blocking. Do not hide errors, weaken assertions, skip tests to pass, or mark partial behavior as complete.

## 14. Verification commands

Use repository scripts when available. If no scripts exist yet, create a minimal verification setup before implementing product features.

Default commands to prefer when relevant:

```bash
npm run typecheck
npm run lint
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:phase
npm run test:e2e:regression
```

Use the narrowest meaningful subset for small changes. For pure domain packages, run unit tests. For API changes, run route/service integration tests. For UI state and action flows, run component tests and the relevant smoke/E2E path. For scheduling, KPI, resource, access-control, formula, and action-engine logic, require deterministic unit tests. For complete user journeys and state-changing management actions, require E2E coverage according to `docs/05_E2E_TRUTH_CONTRACT.md`.

If a command cannot be run, report the exact reason and what evidence was collected instead.

## 15. Security, privacy, and data rules

- Never commit secrets, tokens, private keys, real customer data, or production credentials.
- `.env.example` may contain variable names only, never real values.
- Use tenant isolation in queries, services, policies, and tests.
- Treat external integration payloads as untrusted input.
- Validate inputs at API boundaries.
- Prefer auditability for management decisions and control actions.
- Avoid logging sensitive personal, commercial, or credential data.
- Do not use arbitrary user-provided JavaScript, SQL, or unsafe formula execution for no-code features.
- Formula/configuration engines must be constrained, validated, versioned, and testable.

## 16. Integration rules

External systems are adapters.

For each adapter, define:

- canonical internal entity;
- external entity mapping;
- sync direction;
- conflict strategy;
- idempotency key;
- retry behavior;
- rate-limit behavior;
- audit trail;
- failure mode.

Do not let integration-specific fields leak into core domain models except through explicit `ExternalMapping` or adapter DTOs.


## 17. Final destination guardrail

When making implementation decisions, preserve the final KISS PM release journey from `docs/00_PROJECT_GLOBAL_GOAL.md` and `docs/04_MASTER_PHASE_PLAN.md`:

```txt
CRM opportunity -> feasibility -> project draft -> active project -> Gantt/tasks/resources -> KPI/control signal -> governed action -> audit -> closure -> retrospective learning -> improved templates
```

Do not optimize only for the current MVP screen if that decision damages this final journey. If a shortcut is taken, it must be documented as a temporary decision with a removal condition.

## 18. Output report contract

When finishing a task, return a structured summary:

```txt
Status:
Changed:
Files:
Tests / verification:
Decisions / assumptions:
Risks / follow-up:
```

Do not return a vague `done`. Include exact commands and outcomes when commands were run.
