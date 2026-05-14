# Starter Prompt for Codex

Use this prompt as the first instruction in a new greenfield repository.

```txt
You are working on **KISS PM** — a greenfield SaaS platform for operational project control.

KISS PM means **Keep It Simple, "Sonny" Project Manager**. Treat this as a product rule: user workflows must stay simple, guided, and action-oriented even when internal engines are powerful.

Read these files first:
- AGENTS.md
- docs/00_PROJECT_GLOBAL_GOAL.md
- docs/06_PRODUCT_IDENTITY.md
- docs/01_PRD.md
- docs/02_UNIVERSAL_PROJECT_BP.md
- docs/04_MASTER_PHASE_PLAN.md
- docs/05_E2E_TRUTH_CONTRACT.md

Do not write application code yet.

Do not write product implementation code until Phase 0 outputs and the Phase 1 detail document exist.

Your task is to prepare the repository for clean, production-oriented development without losing the final target state.

Product framing:
- This is KISS PM, not a static reporting system.
- Reports are management instruments / control surfaces.
- A control surface must show operational data, detect a risk/deviation/decision point, expose governed actions, and create audit evidence.
- CRM intake is the start of the project-control lifecycle.
- Business processes must be generalized and tenant-configurable.
- KPI, control surfaces, roles, stages, fields, and actions must be configurable without code changes where practical.
- External systems such as Bitrix24 must be adapters, not the domain core.
- The project must follow the finite phase plan; do not optimize only for the first implementation.
- E2E is the operational truth for user-facing workflows and must exist from the platform foundation phase.

First deliverables:
1. Create or refine the documentation structure under docs/.
2. Create docs/architecture/ARCHITECTURE.md with proposed packages, apps, dependency direction, and runtime boundaries.
3. Create docs/domain/DOMAIN_MODEL.md with canonical entities and invariants.
4. Create docs/domain/CONTROL_SURFACE_ENGINE_SPEC.md.
5. Create docs/domain/ACTION_ENGINE_SPEC.md.
6. Create docs/domain/KPI_ENGINE_SPEC.md.
7. Create docs/domain/CRM_INTAKE_SPEC.md.
8. Create docs/domain/TENANT_CUSTOMIZATION_SPEC.md.
9. Create docs/domain/RESOURCE_PLANNING_SPEC.md.
10. Create docs/domain/SCHEDULING_ENGINE_SPEC.md with MVP and future scope separated.
11. Create docs/e2e/E2E_SCENARIOS.md with the initial scenario ledger based on docs/05_E2E_TRUTH_CONTRACT.md.
12. Create docs/phases/PHASE_0_PRODUCT_ARCHITECTURE_CONTRACT.md.
13. Create docs/phases/PHASE_1_PLATFORM_E2E_FOUNDATION.md with closed tasks and mandatory E2E scenarios.
14. Create docs/decisions/0001-initial-greenfield-architecture.md with assumptions and tradeoffs.
15. Create a first implementation backlog in docs/IMPLEMENTATION_BACKLOG.md, grouped by the master phases.

Rules:
- Follow AGENTS.md strictly.
- Do not hardcode tenant-specific process names, role names, KPI labels, or stage names into domain logic.
- Use universal domain names and configurable tenant labels.
- Do not create separate task models for Gantt, Kanban, reports/control surfaces, and corrective actions.
- Do not let UI components own KPI formulas, resource calculations, scheduling algorithms, or permission rules.
- Actions from control surfaces must be routed through an action/application command layer.
- Do not implement a phase until its phase-detail document exists.
- Every user-facing workflow task must reference an E2E scenario or explicitly document why E2E is not applicable.
- If information is missing, make the safest reversible assumption, document it in a decision record, and continue.
- Treat E2E as the primary acceptance truth for user-facing and state-changing management flows.
- Ask for human input only when the missing information affects irreversible architecture, security, production data, pricing/business commitments, or external credentials.

Output format:
- Summary of what you created.
- List of files created or changed.
- Key assumptions.
- Risks and unresolved questions.
- Recommended next implementation task.
```

## Second prompt — after Codex creates the architecture docs

Use this when the documentation foundation is ready.

```txt
Read AGENTS.md and all docs created in the previous step.

Now initialize the repository skeleton only. Do not implement product features yet.

Create the minimal monorepo structure according to docs/architecture/ARCHITECTURE.md.

Requirements:
- Add package/app folders.
- Add TypeScript configuration.
- Add basic lint/typecheck/test scripts.
- Add a minimal API health route if apps/api exists.
- Add a minimal web shell if apps/web exists.
- Add .env.example with variable names only.
- Add deterministic smoke tests for the skeleton.
- Add the E2E harness and at least the Phase 1 smoke E2E scenarios.
- Do not add CRM/project/KPI/business features yet.
- Update README.md with local setup and verification commands.
- Run the narrowest available checks and report exact commands/outcomes.
```

## Third prompt — first domain package

```txt
Read AGENTS.md and docs/domain/DOMAIN_MODEL.md.

Implement the first pure domain package only: tenant, project, task, task participant, and audit primitives.

Requirements:
- No UI.
- No external integrations.
- No database dependency unless architecture docs require it.
- Include domain types, invariants, and deterministic unit tests.
- Prove that one canonical task model can support Gantt, Kanban, corrective actions, and control-surface actions through projections/metadata instead of separate entities.
- Update docs if the model differs from the spec.
```


## Phase-detail prompt — before starting any implementation phase

Use this prompt before every phase after P0.

```txt
Read:
- AGENTS.md
- docs/00_PROJECT_GLOBAL_GOAL.md
- docs/01_PRD.md
- docs/02_UNIVERSAL_PROJECT_BP.md
- docs/04_MASTER_PHASE_PLAN.md
- docs/05_E2E_TRUTH_CONTRACT.md
- docs/06_PRODUCT_IDENTITY.md
- all existing architecture/domain/decision docs
- current code relevant to the phase

Do not implement code yet.

Prepare the phase-detail document for phase PX.

Create:
- docs/phases/PX_PHASE_NAME/PHASE_PLAN.md
- docs/phases/PX_PHASE_NAME/CLOSED_BACKLOG.md
- docs/phases/PX_PHASE_NAME/ACCEPTANCE_CRITERIA.md
- docs/phases/PX_PHASE_NAME/E2E_MATRIX.md
- docs/phases/PX_PHASE_NAME/DATA_FIXTURES.md
- docs/phases/PX_PHASE_NAME/RISKS_AND_DECISIONS.md
- docs/phases/PX_PHASE_NAME/RELEASE_GATE.md

Rules:
- The backlog must be finite and closed.
- Every task must have acceptance criteria.
- State-changing flows must have E2E scenarios.
- Define what is explicitly out of scope for this phase.
- Define exact verification commands expected at phase close.
- Do not add product code during phase planning.
- If a useful idea is out of phase scope, put it into future backlog, not the active phase.

Output:
- phase goal;
- closed task list;
- E2E acceptance matrix summary;
- risks and assumptions;
- go/no-go recommendation for starting implementation.
```
