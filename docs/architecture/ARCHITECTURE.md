# KISS PM Architecture

## 1. Purpose

This document defines the initial greenfield architecture contract for KISS PM. It is intentionally product-oriented: the architecture must preserve the closed operational loop from CRM intake to project execution, KPI/control signals, governed action, audit, closure, and retrospective learning.

Phase 0 does not implement application code. Phase 1 will create the repository skeleton that follows this contract.

## 2. Architecture principles

- The domain core is independent from UI, HTTP, database adapters, and external integrations.
- UI and API layers orchestrate behavior; they do not own KPI formulas, scheduling calculations, resource-load logic, permission decisions, or business invariants.
- Control surfaces are read/action workspaces. They never mutate business state directly.
- State-changing behavior flows through application services and the action engine.
- External systems are adapters. Bitrix24, AmoCRM, Jira, Slack, email, MS Project, and similar systems do not define the canonical domain model.
- Tenant-specific labels, stages, roles, KPI thresholds, fields, control-surface layouts, and action availability are configuration data.
- E2E tests are first-class architecture artifacts because product value appears in complete management loops.

## 3. Target repository layout

```txt
apps/
  web/
  api/

packages/
  domain-core/
  access-control/
  tenant-config/
  crm-core/
  project-core/
  scheduling-engine/
  resource-planning/
  kpi-engine/
  control-surfaces/
  action-engine/
  workflow-engine/
  notification-engine/
  integrations/
  shared-test-fixtures/

e2e/
  tests/
  fixtures/
  support/

docs/
  architecture/
  domain/
  e2e/
  phases/
  decisions/
  backlog/
  templates/
```

## 4. Runtime apps

### apps/web

React, Vite, TypeScript, Tailwind CSS, and shadcn/ui unless a later design decision changes this. The web app renders Russian user-facing text by default and calls stable API DTOs. It must use `data-testid` values for critical controls that appear in E2E scenarios.

The web app may:

- render project, task, Gantt, resource, KPI, and control-surface views;
- trigger application/action commands through API calls;
- show permission-aware UI state;
- show optimistic UI only when the API/action contract can safely reconcile it.

The web app must not:

- calculate canonical KPI results;
- calculate canonical resource overloads;
- own scheduling algorithms;
- bypass the action engine for state-changing management actions;
- hardcode tenant-specific labels or process names into domain decisions.

### apps/api

Bun, Hono, TypeScript, Zod validation, and PostgreSQL access through a repository/data-access layer selected in a later decision. Route handlers validate input, establish tenant and actor context, authorize or delegate authorization, call application services, and return DTOs.

The API owns:

- HTTP contracts;
- request validation;
- tenant/actor context extraction;
- application service invocation;
- persistence boundaries;
- integration adapter entrypoints;
- audit/event persistence.

The API must not place business invariants directly in route handlers when those invariants belong in domain packages.

## 5. Package boundaries

### domain-core

Shared primitives and invariant helpers: entity IDs, tenant-owned entity base contracts, actor context, audit primitives, domain errors, result types, dates/periods, money/units where needed.

Depends on: no other KISS PM package.

### access-control

Access profiles, permissions, scope rules, policy evaluation, and permission traces. This package must be deterministic and testable without UI or network dependencies.

Depends on: `domain-core`.

### tenant-config

Tenant labels, custom fields, templates, feature flags, configuration versioning, validation, and preview support.

Depends on: `domain-core`, `access-control`.

### crm-core

Clients, contacts, opportunities, intake readiness, demand projection contracts, capacity-assessment requests, intake decisions, and project-draft creation commands.

Depends on: `domain-core`, `tenant-config`, `access-control`.

### project-core

Projects, lifecycle stages, artifacts, approvals, canonical tasks, task participants, task status history, comments, task projections, project snapshots, and closure primitives.

Depends on: `domain-core`, `tenant-config`, `access-control`.

### scheduling-engine

WBS, task dependencies, planned dates, duration, work estimates, baseline fields, scheduling validations, and future advanced scheduling behavior.

Depends on: `domain-core`, `project-core`.

### resource-planning

Resource profiles, capacity calendars, reservations, assignments, load buckets, overload detection, and resolution previews.

Depends on: `domain-core`, `project-core`, `scheduling-engine`.

### kpi-engine

KPI definitions, formula definitions, threshold rules, evaluation results, formula/threshold versioning, control-signal creation, and traceability.

Depends on: `domain-core`, `project-core`, `resource-planning`, `scheduling-engine`.

### control-surfaces

Control surface definitions, view definitions, data-source contracts, widgets, filters, saved views, action exposure rules, and read-model DTO contracts.

Depends on: `domain-core`, `access-control`, `tenant-config`, `kpi-engine`, `resource-planning`, `project-core`, `crm-core`.

### action-engine

Action definitions, command bindings, preconditions, dry-run contracts, action execution logs, audit requirements, and post-action refresh/event contracts.

Depends on: `domain-core`, `access-control`, `tenant-config`, `project-core`, `crm-core`, `resource-planning`, `kpi-engine`.

### workflow-engine

Lifecycle transitions, stage gates, approvals, and process-state validation.

Depends on: `domain-core`, `tenant-config`, `access-control`, `project-core`, `action-engine`.

### notification-engine

Notification rules, subscriptions, delivery intent events, and reminders. Actual channel delivery is adapter-owned.

Depends on: `domain-core`, `tenant-config`, `action-engine`, `workflow-engine`.

### integrations

External adapter interfaces and implementations. External mappings live here or in adapter-owned persistence models, not in core domain entities except through explicit `ExternalMapping` references.

Depends on: `domain-core`, target domain packages through public application contracts.

### shared-test-fixtures

Deterministic seed data builders for unit, integration, and E2E tests. Fixtures must not include real customer data or live credentials.

Depends on: domain packages only as needed.

## 6. Dependency direction

```txt
apps/web
  -> API DTOs and generated/handwritten client contracts

apps/api
  -> application services
  -> domain packages
  -> persistence adapters

control-surfaces
  -> read-model/data-source contracts
  -> action-engine command references

action-engine
  -> domain application commands
  -> access-control
  -> audit

domain packages
  -> domain-core
```

Forbidden directions:

- Domain packages must not import React, Hono, Playwright, database clients, or external SDKs.
- `project-core` must not depend on integrations.
- `kpi-engine`, `resource-planning`, and `scheduling-engine` must not depend on UI.
- Control surfaces must not import persistence adapters directly.

## 7. Application service pattern

State-changing operations should use this flow:

```txt
HTTP route or UI command
  -> validate DTO
  -> establish TenantContext and ActorContext
  -> check permission or delegate to action engine
  -> load required aggregates/read state
  -> run domain/application command
  -> persist result transactionally where practical
  -> write audit/action log
  -> emit domain event or refresh projection
  -> return stable DTO
```

## 8. Persistence boundary

PostgreSQL is the target database. The exact ORM/query tool is not locked in Phase 0. Until selected, docs and skeleton code must use repository interfaces and deterministic in-memory/test adapters where practical.

Persistence rules:

- every tenant-owned table/model carries `tenantId`;
- tenant isolation is enforced in repositories/application services, not only UI filters;
- action logs and audit events are append-oriented;
- configuration objects that affect runtime behavior are versioned;
- closed-project retrospective snapshots are immutable where practical.

## 9. E2E architecture

Phase 1 must create Playwright or equivalent E2E infrastructure with:

- deterministic seed/reset support;
- smoke, phase, permission, and regression command groups;
- API and UI verification helpers;
- test users for tenant admin, project manager/principal, resource manager, executor, read-only observer, and cross-tenant denial;
- no dependency on live external systems.

## 10. Open architecture decisions

- PostgreSQL ORM/query and migration tool.
- Auth/session strategy for Phase 1 and production.
- API contract generation strategy.
- CI provider and deployment target.
- Whether shadcn/ui remains the long-term UI system or only the foundation default.

