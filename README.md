# KISS PM

**KISS PM** means **Keep It Simple, "Sonny" Project Manager**.

This repository contains the greenfield foundation for a SaaS project-control platform. The current implementation is Phase 1 only: a running monorepo skeleton with API health, a Russian web shell, deterministic demo fixtures, and smoke E2E coverage.

No CRM, project, KPI, resource, Gantt, control-surface, or business workflow feature is implemented yet.

## Stack

- TypeScript monorepo with npm workspaces.
- API: Bun + Hono.
- Web: React + Vite.
- Tests: Vitest for unit/integration smoke, Playwright for E2E.
- UI foundation: plain CSS shell for Phase 1; shadcn/ui remains available for later phases.

## Local setup

```bash
bun --version
npm install
npx playwright install chromium
```

`.env.example` contains variable names only. Phase 1 smoke mode does not require secrets, production credentials, Bitrix24, or any live external service.

## Development

```bash
npm run dev:api -- --host 127.0.0.1 --port 4173
$env:VITE_KISS_PM_ALLOW_FIXTURE_AUTH="true"
npm run dev:web -- --host 127.0.0.1 --port 5173
```

Open the shell in test mode:

```txt
http://127.0.0.1:5173/?testUser=project-manager-a
```

Without `testUser`, or without `VITE_KISS_PM_ALLOW_FIXTURE_AUTH=true`, the shell shows the Phase 1 test auth guard.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:e2e:smoke
npm run test:e2e:critical
npm run test:e2e:permissions
npm run verify:matrix
```

Playwright checks start fresh API/web servers on isolated test ports through `scripts/run-e2e.mjs`; local dev servers on `4173`/`5173` are not reused for phase-gate evidence. `test:e2e:permissions` currently runs the Phase 1 auth-guard permission smoke and must expand to Phase 2 E2E-010..014 when `e2e/tests/phase2` is implemented.

For pre-implementation matrices that intentionally contain blocked rows, use:

```bash
npm run verify:matrix -- --allow-blocked docs/status/phase2-requirements-matrix.json
```

The normal `npm run verify:matrix -- docs/status/phase2-requirements-matrix.json` command is the phase-exit gate and must fail until all Phase 2 rows are verified.

Current Phase 1 E2E smoke scenarios:

- `E2E-001`: API health responds and web shell renders.
- `E2E-002`: seeded demo tenant loads without external services and tenant context follows the fixture user.
- `E2E-003`: unauthenticated and unknown fixture users are blocked by test auth design.
- `E2E-004`: test user enters app shell and sees navigation placeholders.

## Dependency notes

- `hono` is the minimal API framework selected by the architecture docs.
- `react`, `react-dom`, `vite`, and `@vitejs/plugin-react` provide the Phase 1 web shell.
- `typescript`, `vitest`, Testing Library, ESLint, and Playwright provide deterministic verification from the foundation phase.
- `zod` is included for the planned API validation boundary, but Phase 1 does not yet implement product DTO validation.

Files:

- `AGENTS.md` — autonomous Codex/project-agent rules, phase discipline, and E2E verification protocol.
- `docs/00_PROJECT_GLOBAL_GOAL.md` — global product goal, final release journey, and product law.
- `docs/01_PRD.md` — product requirements document.
- `docs/02_UNIVERSAL_PROJECT_BP.md` — universalized project business process.
- `docs/03_START_PROMPT_FOR_CODEX.md` — starter prompts for Codex.
- `docs/04_MASTER_PHASE_PLAN.md` — finite phase plan from foundation to market release.
- `docs/05_E2E_TRUTH_CONTRACT.md` — mandatory E2E testing contract.
- `docs/06_PRODUCT_IDENTITY.md` — KISS PM naming and simplicity principles.
- `docs/templates/PHASE_BRIEF_TEMPLATE.md` — template for detailing each phase before implementation.
- `docs/templates/E2E_SCENARIO_TEMPLATE.md` — template for E2E scenario ledger entries.
- `docs/e2e/E2E_SCENARIOS.md` — initial E2E scenario ledger across all phases.
- `docs/backlog/FUTURE_SCOPE.md` — parking lot for future-scope ideas outside the active phase gate.
- `docs/architecture/ARCHITECTURE.md` — app/package/runtime boundary contract.
- `docs/domain/` — canonical domain and engine specs.
- `docs/phases/PHASE_1_PLATFORM_E2E_FOUNDATION.md` — frozen Phase 1 scope.

Phase discipline:

1. Do not start implementation for a phase until its phase-detail document exists.
2. Do not call a phase complete until mandatory E2E scenarios and exit gate pass.
3. Keep tenant-specific labels and process names in configuration, not domain logic.
4. Treat E2E as the operational truth contour for KISS PM.
