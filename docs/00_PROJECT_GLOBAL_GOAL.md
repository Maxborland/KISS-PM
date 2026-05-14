# 00 — KISS PM Global Goal

## 1. Project name

**KISS PM** means **Keep It Simple, "Sonny" Project Manager**.

The name defines the product philosophy: the system must make complex project control feel simple for the user without simplifying away the management rigor underneath. The UI should help a manager, project lead, resource manager, executor, or tenant admin understand what matters, decide what to do, act safely, and verify the result.

KISS PM is not a static reporting product and not a generic task tracker. It is a project-control platform where every important operational signal should lead to a clear next step.

## 2. One-sentence global goal

Build a market-ready SaaS platform for operational project control that turns CRM opportunities, project plans, resource capacity, KPI signals, tasks, Gantt views, portfolio state, and retrospectives into one configurable management loop where users can detect issues, make governed decisions, execute actions, and improve future planning without custom development for each client.

## 3. Expanded goal

KISS PM must evolve into a configurable SaaS system that helps project-oriented organizations manage the full lifecycle from commercial opportunity to project closure and retrospective learning.

The system must not be a passive reporting layer. It must be an operational control platform. Its central promise is that every important management surface is actionable: a user should be able to identify a deviation, understand context, open the relevant project plan, create or adjust tasks, resolve resource overloads, change schedules, request approvals, escalate, accept risk with reason, and verify the result in the next control cycle.

The product must stay simple at the user level. A user should not need to understand internal architecture, formulas, scheduling algorithms, or integration mechanics to perform the next correct action. The complexity belongs inside the domain model, verification system, action engine, KPI engine, scheduling engine, resource-planning engine, and E2E acceptance suite.

## 4. Strategic end state

A client organization can use KISS PM to:

1. capture an incoming opportunity in CRM;
2. estimate expected project demand by stage, role, hours, and dates;
3. check whether the organization has capacity to deliver;
4. create a project draft and project plan;
5. manage execution through Gantt, Kanban, tasks, artifacts, approvals, and resource planning;
6. monitor configurable KPI and control signals;
7. act directly from management instruments, not just read dashboards;
8. close projects with immutable retrospective snapshots;
9. use retrospective data to improve future estimates, processes, and KPI thresholds;
10. customize roles, stages, fields, KPI, control surfaces, and actions without rewriting the product.

## 5. Final product destination

The first full market-ready version of KISS PM is reached only when the product supports this complete operational loop end-to-end:

```txt
Tenant configuration
  -> CRM opportunity
  -> intake readiness and demand estimation
  -> capacity feasibility
  -> project draft
  -> active project from process template
  -> project plan / Gantt / baseline
  -> tasks and assignments
  -> executor work through My Tasks / Kanban
  -> resource load and overload detection
  -> dry-run resolution and governed resource action
  -> KPI evaluation and control signal
  -> corrective action from control surface
  -> audited decision/action trail
  -> project closure
  -> closed-project snapshot
  -> retrospective insight
  -> template/process/KPI improvement
```

This is the final release journey. If this journey cannot be proven by E2E tests, the product is not ready for market release.

## 6. What success looks like

KISS PM is successful when a new tenant can configure its project lifecycle, role names, KPI, fields, control surfaces, and integrations through product settings instead of asking for bespoke development.

KISS PM is successful when managers stop using “reports” as static status pictures and start using management instruments as the place where operational decisions are made, executed, audited, and rechecked.

KISS PM is successful when CRM decisions are connected to delivery reality: the organization can know before committing to a project whether it has capacity, which stages will create risk, and which resources will become overloaded months ahead.

KISS PM is successful when project execution data and closed-project retrospectives improve future planning instead of remaining historical archive data.

KISS PM is successful when the product stays simple for users while remaining strict in the backend: permissions, audit, tenant isolation, formulas, scheduling, resource planning, and E2E verification must remain disciplined.

## 7. Product law

All architecture and implementation decisions must support this product law:

```txt
Every important signal in the system should be traceable, actionable, auditable, and useful for future planning.
```

A feature that only displays information without enabling understanding, decision, action, or learning is incomplete unless it is explicitly marked as read-only by product design.

## 8. Execution law

KISS PM must not degrade into an endless MVP.

The product is delivered through the finite master phase plan in `docs/04_MASTER_PHASE_PLAN.md`. Each phase must be detailed immediately before implementation. Each phase must have closed tasks, non-scope, E2E scenarios, fixtures, acceptance criteria, and an exit gate.

A phase is not complete when code is written. A phase is complete when its mandatory E2E scenarios pass and the phase exit gate is satisfied.

## 9. Architectural implications

- Use canonical internal domain models. External systems are adapters.
- Keep project, task, resource, KPI, and control-surface data connected.
- Avoid duplicated task models for different views.
- Keep tenant-specific names and processes in configuration.
- Keep formulas and thresholds in a safe configurable KPI engine.
- Keep state-changing actions behind a governed action engine.
- Keep audit trails for management decisions.
- Keep closed-project snapshots for reliable retrospective analysis.
- Treat E2E as the main acceptance truth for user-facing management loops.

## 10. Anti-goals

The project must not become:

- a custom Bitrix reporting layer;
- a static dashboard product;
- a generic CRM clone;
- a generic BI constructor;
- a hardcoded architecture/design-studio process app;
- a collection of disconnected modules;
- a system where every client requires code-level customization;
- an endless MVP that keeps adding features without phase gates and E2E proof.
