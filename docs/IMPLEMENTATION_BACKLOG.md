# KISS PM Implementation Backlog

This backlog is grouped by the finite master phases. It is not an open-ended wishlist. Active implementation must follow the current phase-detail document and its closed scope.

## Phase 0 — Product and architecture contract

- [x] Finalize product/global goal docs.
- [x] Finalize PRD, universal project BP, master phase plan, and E2E truth contract.
- [x] Create architecture contract.
- [x] Create domain model contract.
- [x] Create engine specs for control surfaces, actions, KPI, CRM intake, tenant customization, resource planning, scheduling, and access control.
- [x] Create Phase 0 and Phase 1 detail docs.
- [x] Create initial architecture decision record.
- [x] Create implementation backlog.

## Phase 1 — Repository, platform, and E2E foundation

- [x] Scaffold npm workspace and TypeScript configs.
- [x] Create `apps/api` with Bun/Hono health route.
- [x] Create `apps/web` with React/Vite Russian app shell.
- [x] Create package placeholders according to architecture.
- [x] Add `.env.example` with variable names only.
- [x] Add lint, typecheck, unit, integration, and E2E scripts.
- [x] Add deterministic seed fixture builders for Tenant A and Tenant B.
- [x] Add E2E smoke harness.
- [x] Implement E2E-001 through E2E-004.
- [x] Update README with local setup and verification commands.

## Phase 2 — SaaS tenant core and access control

- [ ] Implement tenant/workspace/user primitives.
- [ ] Implement access profiles, permissions, scope rules, and policy traces.
- [ ] Implement tenant label configuration.
- [ ] Implement audit primitives.
- [ ] Prove tenant isolation and permissions through E2E-010 through E2E-014.

## Phase 3 — CRM intake and opportunity-to-project

- [ ] Implement clients, contacts, and opportunities.
- [ ] Implement intake readiness blockers.
- [ ] Implement template-based demand projection draft.
- [ ] Implement capacity feasibility draft against deterministic resources.
- [ ] Implement project draft creation from qualified opportunity.
- [ ] Prove E2E-020 through E2E-024.

## Phase 4 — Project lifecycle and work management

- [ ] Implement process and stage templates.
- [ ] Implement project lifecycle state and stage gates.
- [ ] Implement artifacts and approval basics.
- [ ] Implement canonical task model and task participants.
- [ ] Implement My Tasks and Kanban projections over canonical tasks.
- [ ] Prove E2E-030 through E2E-034.

## Phase 5 — Scheduling and Gantt foundation

- [ ] Implement WBS and basic dependency model.
- [ ] Implement scheduling validation package.
- [ ] Implement baseline draft fields.
- [ ] Implement Gantt MVP over canonical tasks.
- [ ] Prove E2E-040 through E2E-044.

## Phase 6 — Resource planning and conflict resolution

- [ ] Implement resource profiles and capacity calendars.
- [ ] Implement assignments, reservations, load buckets, and overload detection.
- [ ] Implement resolution dry-run previews.
- [ ] Implement governed resolution actions and audit.
- [ ] Prove E2E-050 through E2E-055.

## Phase 7 — KPI engine and control signals

- [ ] Implement KPI definitions, formulas, thresholds, and versioning.
- [ ] Implement deterministic KPI evaluation.
- [ ] Implement control signal/deviation creation.
- [ ] Implement KPI admin MVP.
- [ ] Prove E2E-060 through E2E-064.

## Phase 8 — Control surfaces and action engine

- [ ] Implement control surface definitions and initial views.
- [ ] Implement action definitions and command bindings.
- [ ] Implement action execution log and audit integration.
- [ ] Implement initial CRM Intake, Portfolio, Resource Load, KPI Deviation, and My Work control surfaces.
- [ ] Prove E2E-070 through E2E-075.

## Phase 9 — Closed portfolio and retrospectives

- [ ] Implement project closure workflow.
- [ ] Implement immutable closed-project snapshots where practical.
- [ ] Implement closed portfolio/retrospective control surface.
- [ ] Implement template-improvement action.
- [ ] Prove E2E-080 through E2E-083.

## Phase 10 — No-code tenant customization

- [ ] Implement guided builders for labels, roles, stages, custom fields, KPI thresholds, saved views, and control-surface layouts.
- [ ] Implement configuration validation, preview, and versioning.
- [ ] Prove E2E-090 through E2E-095.

## Phase 11 — Integrations and migration

- [ ] Implement integration adapter contracts.
- [ ] Implement external mapping model.
- [ ] Implement selected first adapter or manual import.
- [ ] Implement idempotency, retry/rate-limit strategy, sync audit, and failure UI.
- [ ] Prove E2E-100 through E2E-104 using mocked adapters.

## Phase 12 — Production SaaS hardening and market release

- [ ] Implement production deployment pipeline.
- [ ] Implement observability, backup/restore strategy, and security review fixes.
- [ ] Complete tenant isolation and permission matrix verification.
- [ ] Document tenant/operator onboarding.
- [ ] Prove E2E-110 through E2E-115.
