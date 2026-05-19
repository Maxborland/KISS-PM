# CRM Intake Activity Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `task-workflow-orchestrator`, then `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** превратить CRM intake из паспорта сделки в рабочее окно сделки: устойчивый kanban, persisted чат/комментарии, deal follow-up задачи и entity-scoped аудит в одной карточке.

**Architecture:** `Opportunity` остается source entity сделки. Для CRM-коммуникаций и follow-up задач добавляется отдельный tenant-scoped `OpportunityActivity`, а audit остается отдельным evidence layer и подмешивается в read-model activity feed. UI делится на focused modules: kanban, detail facts, activity panel, forms and query hooks.

**Tech Stack:** Next.js App Router Client Components, TanStack Query, Hono API, Drizzle/PostgreSQL, pnpm, Playwright smoke.

---

## Architecture Decisions

1. **Deal workspace вместо passport-only detail.** `/opportunities/:id` становится рабочим окном сделки с правой activity panel.
2. **Deal tasks отдельно от project tasks.** CRM follow-up задачи живут в `OpportunityActivity`; project `Task` остается только для активного проекта.
3. **Audit не дублируется.** Activity feed объединяет persisted activity items и redacted system-event projection из filtered audit events. Raw audit details требуют `tenant.audit_events.read`.
4. **DnD не единственный путь.** Kanban stage transition получает устойчивый DnD и обязательный keyboard/select fallback.
5. **No fake affordances.** Видимая вкладка или кнопка появляется только если за ней есть persisted API, mutation или честное disabled/error состояние.

## Target Files

### Create

- `packages/persistence/src/opportunityActivityRepository.ts`
- `apps/api/src/opportunityActivityParsers.ts`
- `apps/api/src/opportunityActivityRoutes.ts`
- `apps/web/src/opportunityActivity.ts`
- `apps/web/src/OpportunityActivityPanel.tsx`
- `apps/web/src/DealsKanban.tsx`

### Modify

- `packages/persistence/src/schema.ts`
- `packages/persistence/src/index.ts`
- `packages/persistence/src/repositories.ts`
- `packages/persistence/src/repositories.db.test.ts`
- `apps/api/src/apiTypes.ts`
- `apps/api/src/app.ts`
- `apps/api/src/projectIntakeRoutes.ts` if audit source metadata needs normalization
- `apps/api/src/crmRoutes.db.test.ts`
- `apps/web/src/api.ts`
- `apps/web/src/workspaceQueries.ts`
- `apps/web/src/OpportunitiesView.tsx`
- `apps/web/src/OpportunityDetailView.tsx`
- `apps/web/src/crm.css`
- `e2e/smoke/single-workspace-auth-rbac.spec.ts`
- `docs/23_PHASE_3_1_CRM_FOUNDATION_DEAL_UX.md` or new phase/status doc to correct audit-in-card baseline

## Block 1. Spec, docs and characterization

- [x] Update Phase 3.1/phase status docs so audit-in-card is no longer marked as out of scope.
- [x] Add compact product spec for CRM activity workspace.
- [x] Add characterization tests around existing stage change and audit event source entity, before changing behavior.
- [x] Run:
  - `pnpm typecheck`
  - `pnpm test`
- [x] Commit: `docs: define crm activity workspace baseline` (`b770f66`).

## Block 2. Persistence model

- [x] Add `opportunity_activities` table:
  - composite tenant safety with `tenant_id`;
  - FK to `opportunities(tenant_id, id)`;
  - optional FK to assignee user if current schema supports it safely, otherwise validate assignee in application layer for first slice;
  - indexes on `(tenant_id, opportunity_id, created_at)` and `(tenant_id, assignee_user_id)`.
- [x] Add repository methods:
  - `listOpportunityActivities(tenantId, opportunityId)`;
  - `createOpportunityActivity(input)`;
  - `updateOpportunityActivity(input)` for task completion.
- [x] Add DB tests:
  - tenant isolation;
  - ordering by createdAt;
  - task update does not affect another tenant;
  - cross-tenant opportunity link is rejected.
- [x] Run:
  - `pnpm --filter @kiss-pm/persistence test`
  - `pnpm test:db`
- [x] Commit: `feat: add opportunity activity persistence` (`2a6269a`).

## Block 3. API/application service

- [x] Add parsers for:
  - create comment body `{ body }`;
  - create task body `{ title, body?, dueDate?, assigneeUserId? }`;
  - patch task body `{ status }`.
- [x] Register `opportunityActivityRoutes`.
- [x] Implement:
  - `GET /api/workspace/opportunities/:opportunityId/activity`;
  - `POST /api/workspace/opportunities/:opportunityId/comments`;
  - `POST /api/workspace/opportunities/:opportunityId/tasks`;
  - `PATCH /api/workspace/opportunities/:opportunityId/tasks/:activityId`.
- [x] Permission rules:
  - read requires `tenant.opportunities.read`;
  - redacted system events in feed require `tenant.opportunities.read`;
  - raw audit tab payload requires `tenant.audit_events.read`;
  - mutations require `tenant.opportunities.manage`;
  - missing opportunity returns `404`;
  - restricted direct mutation returns `403`.
- [x] Audit:
  - `opportunity.comment.created`;
  - `opportunity.task.created`;
  - `opportunity.task.completed`;
  - source entity is `{ type: "Opportunity", id: opportunityId }`.
- [x] API/DB tests:
  - create/list comment;
  - create/list/complete task;
  - activity feed includes same-opportunity redacted audit event;
  - activity feed excludes same-tenant audit events from other opportunities;
  - raw audit tab payload is hidden without `tenant.audit_events.read`;
  - restricted user gets `403`;
  - cross-tenant ID cannot leak activity.
- [x] Run:
  - `pnpm --filter @kiss-pm/api test`
  - `pnpm test:db`
- [x] Commit: `feat: expose opportunity activity api` (`48c0b6a`).

Review notes:

- Code review found strict date parsing gap for task `dueDate`; fixed with `YYYY-MM-DD` round-trip parser and parser tests.
- Security review found denied events polluted ordinary activity feed; fixed by showing denied events only in raw audit for audit readers.
- Security review found no-op/concurrent task completion audit risk; fixed by repository-level compare-and-swap transition and API audit only for actual status changes.

## Block 4. Kanban DnD hardening

- [x] Extract kanban from `OpportunitiesView.tsx` into `DealsKanban.tsx`.
- [x] Replace brittle native HTML5 DnD with a robust implementation.
  - Preferred: `@dnd-kit/core` with pointer + keyboard sensors.
  - If dependency install is blocked, implement explicit stage action fallback first and keep native DnD behind a visible tested affordance.
- [x] Keep stage select fallback for accessibility.
- [x] Add UI states:
  - dragging card;
  - active drop column;
  - pending stage update;
  - disabled reason for final/restricted deals.
- [x] Tests:
  - component/helper test for allowed target stages;
  - E2E drag or explicit move stage flow persists after reload.
- [x] Run:
  - `pnpm --filter @kiss-pm/web typecheck`
  - `pnpm test`
- [x] Commit: `fix: harden deals kanban stage movement`.

Review notes:

- TDD RED confirmed missing stage-move helpers in `apps/web/src/opportunityDisplay.test.ts`; GREEN added `canMoveOpportunityToStage` and disabled reason coverage.
- Bug Hunt found no Critical/Important findings after implementation.
- Code Review found two Important issues: whole-card fake drag cursor and disabled reason priority. Both fixed by moving drag affordance to the handle only and checking permission/pending reasons before target-stage availability.
- Security Review found no Critical/Important findings; minor archived-column copy issue fixed from `Только просмотр` to `Нельзя переносить сюда`.
- Browser smoke on `http://127.0.0.1:3001/opportunities` verified login, Kanban rendering, select fallback move to `Квалификация`, and persisted state after reload.
- Targeted E2E `e2e/smoke/deals-kanban.spec.ts` verifies real API-created deal movement through Kanban select fallback and persistence after reload.
- [x] Commit: `fix: harden deals kanban stage movement` (`eba2035`).

## Block 5. Deal activity UI

- [x] Add API client methods:
  - `fetchOpportunityActivity`;
  - `createOpportunityComment`;
  - `createOpportunityTask`;
  - `updateOpportunityTask`.
- [x] Add TanStack Query hooks and invalidation scoped to:
  - `["workspace", "opportunities", opportunityId, "activity"]`;
  - `["auditEvents"]` only where needed after mutation.
- [x] Add `OpportunityActivityPanel`:
  - tabs/segmented control: `Лента`, `Чат`, `Задачи`, `Аудит`;
  - loading/error/empty states per tab;
  - compact comment form;
  - compact task form;
  - task completion action;
  - filtered audit rows.
- [x] Refactor `OpportunityDetailView.tsx` into a two-column workspace:
  - left facts/actions;
  - right activity panel;
  - responsive narrow viewport stacks panel after facts.
- [x] UI tests/smoke:
  - create comment and see it in feed/chat;
  - create task and see it in feed/tasks;
  - complete task and see status update;
  - audit tab shows stage/action event.
- [x] Run:
  - `pnpm --filter @kiss-pm/web typecheck`
  - `pnpm --filter @kiss-pm/web build`
  - `pnpm test`

Review notes:

- TDD RED confirmed missing web API/query surface for opportunity activity; GREEN added API client methods, stable query key, mutation hooks and activity feed helper tests.
- Code Review found three Important issues: stale activity feed after existing deal actions, oversized activity panel and hardcoded light backgrounds. Fixed by invalidating opportunity activity after deal actions, splitting panel into focused feed/forms/audit modules and using `var(--panel)` / `var(--panel-subtle)` in the new activity UI.
- Bug Hunt found no Critical/Important findings after implementation and after fixes.
- Security Review found no Critical/Important findings; backend permission/audit boundaries remain enforced by existing activity routes.
- Targeted E2E `e2e/smoke/deal-activity.spec.ts` verifies resource check event appears immediately in the deal panel, comment/task create and task completion, audit rows and persistence after reload.
- [x] Commit: `feat: add deal activity workspace`.

## Block 6. End-to-end acceptance and UX polish

- [ ] Update E2E smoke:
  - login;
  - create/open deal;
  - move deal in kanban;
  - open deal detail;
  - add comment;
  - add and complete deal task;
  - verify audit/event appears in deal panel;
  - restricted user cannot mutate.
- [ ] Browser smoke on desktop and narrow viewport:
  - `/opportunities`;
  - `/opportunities/:id`;
  - kanban;
  - activity panel tabs.
- [ ] UI/UX review checklist:
  - dense Russian operational UI;
  - no fake controls;
  - no broken horizontal overflow;
  - visible focus states;
  - mutation errors near forms;
  - disabled reasons visible.
- [ ] Run final verification:
  - `pnpm typecheck`;
  - `pnpm test`;
  - `pnpm --filter @kiss-pm/web build`;
  - `pnpm test:db`;
  - `pnpm test:e2e:smoke`;
  - `git diff --check`;
  - `docker compose ps` with worktree ports.
- [ ] Commit: `test: cover crm intake activity workspace`.

## Review Gates

After each block:

- run Bug Hunt on changed scope;
- run Lead Architect review for data/API/UI boundary changes;
- run Requesting Code Review;
- run Security Best Practices for API/persistence blocks;
- process Critical/Important findings through Receiving Code Review;
- repeat verification if fixes were made.

## Non-goals

- external messenger integration;
- Bitrix24/amoCRM connector runtime;
- project WBS/task redesign;
- export/bulk actions;
- full notification system;
- SLA/automation engine.

## Open Risk Register

| Risk | Mitigation |
|---|---|
| Deal tasks duplicate future project tasks | Keep `OpportunityActivity` separate and name them CRM follow-up tasks |
| Activity feed becomes transport logic in UI | Combine feed in API/application read model; UI only renders typed items |
| DnD dependency increases frontend surface | Prefer small `@dnd-kit` package only if install succeeds and tests prove value |
| Audit filtering misses some actions | Normalize `sourceEntity` for opportunity actions and add API tests |
| Card becomes visually overloaded | Right panel uses tabs and compact density; mobile stacks below facts |
