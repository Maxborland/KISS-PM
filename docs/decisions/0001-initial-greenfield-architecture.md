# Decision 0001: Initial Greenfield Architecture

Date: 2026-05-14

## Status

Accepted for Phase 0 and Phase 1 planning.

## Context

KISS PM is a greenfield SaaS platform for operational project control. The product must not inherit a Bitrix-specific reporting architecture or become a passive dashboard collection. It must support a finite release journey from CRM opportunity to project execution, KPI/resource/schedule control, governed action, audit, closure, and retrospective learning.

## Decision

Use a TypeScript monorepo with:

- `apps/web` for React/Vite UI;
- `apps/api` for Bun/Hono API;
- domain packages under `packages/`;
- Playwright or equivalent E2E from Phase 1;
- PostgreSQL as the target database;
- Zod for API/schema validation;
- shadcn/ui and Tailwind CSS as the default UI foundation until superseded by a later design decision.

Use package boundaries that keep domain logic out of route handlers and UI components. External systems are integration adapters only. Control surfaces expose actions but delegate mutation to the action engine/application layer.

## Rationale

TypeScript across web/API/domain packages gives one language for early product velocity while preserving testable boundaries. Bun/Hono is a small API foundation suitable for a greenfield skeleton. React/Vite keeps the web app simple to scaffold. E2E from Phase 1 supports the product rule that complete management loops are the acceptance truth.

## Alternatives considered

### Full-stack framework first

Rejected for now because it can blur API/domain/UI boundaries too early. A later decision may adopt a full-stack framework if boundaries remain explicit.

### Backend-heavy service split

Rejected for Phase 1 because the product needs clear contracts before distributed-service complexity. Package boundaries are enough until runtime scale demands more.

### Copy BitrixReports architecture

Rejected because KISS PM is a greenfield SaaS product, not a Bitrix-specific reporting app.

## Consequences

- Phase 1 must create the monorepo skeleton and verification scripts before product features.
- Domain packages must remain free of React, Hono, database clients, and external SDKs.
- Control surfaces and action engine must become explicit packages/contracts before action-heavy product work.
- ORM, auth, CI/deploy, and API contract generation remain open decisions.

## Assumptions

- Node/npm tooling is acceptable for the workspace.
- PostgreSQL is the production database target, but Phase 1 may use deterministic fixtures before schema work.
- Russian is the default user-facing UI language.
- E2E must not depend on live external systems or real customer data.

## Removal or revision conditions

Revise this decision if:

- architecture docs select a different runtime stack;
- auth/deployment constraints require a different app shape;
- package boundaries fail to preserve domain invariants;
- a later phase proves Bun/Hono, React/Vite, or the monorepo approach blocks verification or product delivery.

