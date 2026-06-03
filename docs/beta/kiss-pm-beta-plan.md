# KISS PM — Founder-Beta Execution Plan

> **For Claude/Cursor/subagents:** execute this plan task-by-task. Do not widen scope. Do not ship demo/runtime placeholders. Every task must end with evidence: tests, screenshots, or a documented blocker.

**Date:** 2026-06-02  
**Target:** founder-beta by 2026-06-07 if executed with parallel agents and tight integration control.  
**Estimate:** ~18 slices realistic; 15 minimum if existing PR/worktrees are reusable; 24 with integration/QA churn.  
**Product goal:** a working project-operations cockpit for an architecture bureau: dashboard → deals/clients → projects/tasks → Gantt/timeline → resources/workload → My Work → global agent proposals with confirmation/audit → admin/users/roles/audit.

---

## 0. Review of the previous draft — what was fixed

The previous plan was useful as a scope map, but not good enough as the plan of record. Problems fixed in this version:

1. **Too broad task cards.** Some cards were still 1-2 day chunks. This version splits them into smaller implementation cards with explicit DoD.
2. **Weak integration governance.** Added branch/worktree rules, merge train, artifacts, and local-gate policy while GitHub CI is blocked.
3. **Unsafe CI wording.** Removed casual `merge --no-verify`. PR #73 or any beta PR can only be merged with either working CI or explicit manual override backed by local artifacts.
4. **Missing product DoD.** Added route-level and feature-level Definition of Done.
5. **Verification was underspecified.** Added fast PR gate vs nightly/pre-beta full gate, exact evidence per task, screenshot matrix, and no-placeholder checks.
6. **Agent risk underdefined.** Added strict global-agent contract: no project-specific agent, no mutation without confirmation, audit/result required, failure paths mandatory.
7. **Gantt/resources were accidentally framed as optional earlier.** They are now marked non-negotiable founder-beta foundations.
8. **Admin was too vague.** Added minimal real RBAC/admin requirements and acceptance.
9. **No merge order.** Added waves and dependency locks so subagents can work in parallel without trampling each other.
10. **No final release checklist.** Added beta cut checklist and abort criteria.

---

## 1. Non-negotiables

### Product non-negotiables

- No runtime placeholders on beta routes.
- No fake/demo hardcoded data on beta routes.
- No dead controls. A control either works, is hidden, or is disabled with a clear reason.
- Gantt/timeline is a real working planning screen, not a decorative chart.
- Resources/workload is a real working capacity/conflict surface, not a static table.
- Pixel-polished core routes are mandatory on desktop and narrow viewport.
- The AI agent is optional acceleration. The app must be fully usable without it.
- The agent is **global workspace agent only**, not project-specific.
- Agent mutations require confirmation and create audit/result records.
- Admin/users/roles/audit must be real enough to affect product behavior.

### Engineering non-negotiables

- Every task starts from current tests or adds a failing test first where practical.
- Every task ends with evidence: command output, screenshot, trace, or documented blocker.
- No broad blind merges from worktrees.
- No large PRs combining unrelated lanes.
- No full Storybook/VRT gate on every PR.
- Full Storybook/VRT/a11y runs nightly or pre-beta only.
- Local evidence must be archived while GitHub CI billing is blocked.

---

## 2. Current critical blocker

**GitHub CI does not start because of billing/spending limit.**

Implications:

- PR #73 (`My Work status actions`) cannot be considered cleanly mergeable solely from GitHub.
- Local green tests are useful evidence, not a replacement for CI unless Max explicitly approves a manual override.
- Until billing is fixed, every PR needs a local artifact bundle:
  - git SHA / branch name;
  - commands run;
  - test output summary;
  - screenshots/traces path;
  - known skipped checks;
  - reviewer decision.

Allowed paths:

1. **Preferred:** fix GitHub billing/spending limit → CI starts → merge normally.
2. **Temporary:** continue development in integration branch with local gates and artifacts; merge to main only after CI returns.
3. **Manual override:** only if Max explicitly approves; must include local artifact bundle and reviewer sign-off.

---

## 3. Beta route scope

### Beta routes that must work

- `/` or `/dashboard` — dashboard attention cockpit.
- `/deals` — deals pipeline/list.
- `/deals/:id` — deal detail and next action.
- `/clients` or client section inside deals — minimal client context required for handoff.
- `/projects` — project list.
- `/projects/:id` — project detail by real ID.
- `/projects/:id/tasks` or tasks section — task CRUD/status/owner/due/blocker.
- `/projects/:id/timeline` or Gantt section — deep enough planning screen.
- `/projects/:id/resources` or resources section — workload/capacity/conflicts.
- `/my-work` — current user work queue/actions.
- `/agent` and embedded panel — global workspace agent.
- `/admin/users` — users.
- `/admin/roles` — minimal roles/permissions.
- `/admin/audit` — audit log.
- `/settings/workspace` — minimal workspace settings if already present; otherwise hide.

### Non-beta routes

Any route outside the list above must be one of:

- hidden from navigation;
- protected behind explicit beta-disabled state;
- removed from runtime shell;
- or clearly marked unavailable without fake controls.

Do not expose decorative/demo sections in runtime navigation.

---

## 4. Definition of Done

### Per task DoD

A task is done only when all are true:

- Acceptance behavior works from UI or API.
- Data persists after reload when mutation is involved.
- No new console errors on touched route.
- No mock/demo/runtime placeholder introduced.
- Targeted tests pass.
- Screenshot is captured if the task affects visible UI.
- Audit entry exists for mutation if the feature is auditable.
- Task notes include files changed, commands run, and remaining risks.

### Per lane DoD

A lane is done only when:

- All lane task cards pass.
- Lane route has desktop and narrow screenshots.
- Lane route works from seeded data.
- Lane route survives reload.
- Lane has at least one route smoke/e2e test.
- Reviewer checked no dead controls/placeholders/demo data.

### Founder-beta DoD

Founder-beta is done only when:

- Main walkthrough passes: dashboard → risk/deal/project → task mutation → Gantt/resource check → My Work → agent proposal → confirm → audit.
- All beta routes have screenshots.
- All beta routes have no visible placeholders/dead controls/demo data.
- Admin role change affects UI/API behavior.
- Agent never mutates without confirmation.
- Gantt and resources are usable without the agent.
- Full pre-beta gate has passed or each skipped item has explicit Max-approved waiver.

---

## 5. Verification strategy

### Fast PR gate — every small PR

Use this on each task/slice PR:

```bash
pnpm typecheck
pnpm test -- --changed
pnpm test:e2e -- --grep @affected
pnpm qa:route-smoke -- --routes <touched-routes>
pnpm qa:screenshots -- --routes <touched-routes>
```

If these exact scripts do not exist yet, Foundation/QA lane must create equivalent scripts or document current alternatives.

Rules:

- Run affected Storybook stories only if a shared visual component changed.
- Do not run full Storybook/VRT on every PR.
- Do not block a My Work or API PR on unrelated full visual matrix.

### Nightly / pre-beta full gate

Run at end of day and before beta cut:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm storybook:test
pnpm qa:visual
pnpm qa:a11y
pnpm qa:no-placeholders
pnpm qa:screenshots -- --routes beta
```

If a command does not exist, create it in F0 tasks or replace with documented equivalent.

### Required screenshots

Desktop and narrow viewport for:

- dashboard;
- deals list;
- deal detail;
- project list;
- project detail/tasks;
- Gantt/timeline;
- resources/workload;
- My Work;
- global agent;
- admin users;
- admin roles;
- admin audit.

---

## 6. Branch and parallel work policy

### Base policy

- Create a clean integration branch from latest `origin/master` or current agreed beta base.
- Do not use dirty local state as the beta base.
- Treat existing worktrees/branches as patch sources only.
- Before applying a patch, inspect diff and run targeted tests.

### Suggested branch names

- `beta/foundation-qa`
- `beta/my-work-actions`
- `beta/project-detail-tasks`
- `beta/gantt-runtime`
- `beta/resources-workload`
- `beta/deals-dashboard`
- `beta/admin-rbac-audit`
- `beta/global-agent`
- `beta/ui-cleanup`

### Merge train

1. Foundation/QA base.
2. Seed/read-model contracts.
3. Project Detail/Tasks.
4. My Work.
5. Deals/Dashboard.
6. Gantt.
7. Resources.
8. Admin.
9. Global Agent.
10. UI cleanup/review.
11. Final beta gate.

Global Agent starts after task/deal/project contracts are stable enough to target.

---

## 7. Parallel lanes and task cards

Each card is sized for one focused subagent pass. If a card grows beyond half a day, split it before continuing.

### Lane F0 — Foundation / QA / Seed

#### F0.1 — Establish beta base and route inventory

**Goal:** define exact beta routes and hide non-beta routes.

**Steps:**
1. Create/checkout clean beta integration branch.
2. List all runtime routes and navigation entries.
3. Mark each route as `beta`, `hidden`, or `disabled`.
4. Remove non-beta entries from primary navigation.
5. Add route smoke list for beta routes.

**Acceptance:** beta navigation exposes only beta routes; direct non-beta routes do not show fake product surfaces.

**Verification:** route smoke over beta route list + manual nav check.

**Evidence:** route inventory in docs or PR description.

---

#### F0.2 — Create beta seed/reset

**Goal:** one stable architecture-bureau dataset.

**Seed must include:**
- 2-3 clients;
- 4-6 deals across stages;
- 3-4 projects;
- project stages/phases;
- 20-40 tasks;
- 5-8 users with roles;
- workload allocations;
- at least one overload;
- at least one missing role;
- at least one overdue task;
- at least one blocked task;
- audit history.

**Acceptance:** reset + seed produces deterministic IDs or stable test selectors.

**Verification:** seed command + API checks for clients/deals/projects/tasks/users/workload/audit.

**Evidence:** seed output + fixture summary.

---

#### F0.3 — Fast PR gate scripts

**Goal:** create/standardize fast checks.

**Acceptance:** one command runs targeted gate for changed/touched routes in under ~5 minutes for normal slice PR.

**Verification:** run against an existing small change.

**Evidence:** command output.

---

#### F0.4 — No-placeholder/no-demo-data checker

**Goal:** prevent beta regressions.

**Forbidden examples:** `ScreenPlaceholderBlock`, `TODO runtime`, `Coming soon`, `demo switching`, `John Onboarding`, `Sales deck`, `DataHub`, fake UUID labels shown to users, dead `onClick={() => {}}` controls.

**Acceptance:** checker fails on known forbidden tokens in runtime beta routes.

**Verification:** run checker and show pass/fail behavior.

**Evidence:** command output.

---

#### F0.5 — Product screenshot harness

**Goal:** screenshot beta routes without Storybook overhead.

**Acceptance:** one command captures desktop + narrow screenshots for selected routes.

**Verification:** screenshots generated for at least dashboard and My Work.

**Evidence:** screenshot artifact paths.

---

#### F0.6 — Founder-beta walkthrough skeleton

**Goal:** create failing/partial E2E skeleton for final workflow.

**Workflow:** dashboard → at-risk item → project → task update/blocker → Gantt/resources check → My Work → agent proposal → confirmation → audit.

**Acceptance:** test exists and can run; it may initially fail at missing features with clear steps.

**Verification:** run test and document current first failure.

---

### Lane MW — My Work / PR #73

#### MW0 — Review PR #73

**Goal:** determine what PR #73 already solves and what remains.

**Steps:**
1. Inspect PR #73 diff.
2. Map diff to MW cards below.
3. Run local tests if possible.
4. Record blockers: CI billing, conflicts, missing tests, UX gaps.

**Acceptance:** clear reuse/merge decision.

**Evidence:** PR review note with commands and result.

---

#### MW1 — My Work real task source

**Goal:** My Work loads current user's real tasks from API/read-model.

**Acceptance:** no hardcoded task list; empty/loading/error states exist.

**Verification:** route smoke + API fixture check.

---

#### MW2 — Status action

**Goal:** user can change task status from My Work.

**Acceptance:** status updates, persists after reload, updates dashboard/project read models if applicable.

**Verification:** Playwright: open My Work → change status → reload → verify.

**Screenshot:** My Work after status change.

---

#### MW3 — Comment action

**Goal:** user can add comment from My Work.

**Acceptance:** comment persists and appears in task/project activity.

**Verification:** Playwright: add comment → open project/task activity → verify.

---

#### MW4 — Blocker action

**Goal:** user can mark/unmark blocker from My Work.

**Acceptance:** blocker state persists and appears on dashboard/project attention surfaces.

**Verification:** Playwright: set blocker → reload → verify My Work + dashboard/project marker.

---

#### MW5 — Owner/due action via safe full update

**Goal:** update owner/due without partial inconsistent PATCH behavior.

**Acceptance:** owner and due date update atomically or fail cleanly; stale update handled.

**Verification:** Playwright: update owner/due → reload → verify; stale/failure test if supported.

---

### Lane P — Project Detail / Tasks

#### P1 — Project route by real ID

**Goal:** `/projects/:id` uses real project ID from seed/API.

**Acceptance:** project page loads real title/client/status/owner/dates; unknown ID gives not-found.

**Verification:** Playwright for real ID + unknown ID.

---

#### P2 — Project overview read-model

**Goal:** overview shows status, phase, risk, owner, dates, next milestone, blockers.

**Acceptance:** all values come from API/read-model; loading/error states exist.

**Verification:** API contract test + route smoke.

---

#### P3 — Task list read-model

**Goal:** project tasks list is live data.

**Acceptance:** filter/sort/group enough for beta; no mock arrays.

**Verification:** API contract + Playwright list assertions.

---

#### P4 — Create task

**Goal:** create task inside project.

**Acceptance:** title, owner, due date, phase/status saved; new task visible after reload.

**Verification:** Playwright create → reload → verify.

---

#### P5 — Update task status/owner/due/blocker

**Goal:** common task updates from project page.

**Acceptance:** each mutation persists and records activity/audit.

**Verification:** Playwright mutation matrix on one seeded task.

---

#### P6 — Project activity/audit panel

**Goal:** project page shows relevant manual and agent actions.

**Acceptance:** task create/update/blocker/comment appear in activity/audit.

**Verification:** perform mutation → verify activity entry.

---

#### P7 — Project page visual pass

**Goal:** project page is polished and usable.

**Acceptance:** desktop/narrow screenshots have no placeholders, no demo labels, no broken layout.

**Verification:** screenshot review + no-placeholder checker.

---

### Lane G — Gantt / Timeline

#### G1 — Timeline data model

**Goal:** build timeline from real project phases/tasks/dependencies.

**Acceptance:** phases/tasks/dates/dependencies returned by API/read-model.

**Verification:** contract test with seeded project.

---

#### G2 — Timeline rendering

**Goal:** render phases/tasks across time with readable scale.

**Acceptance:** tasks align to dates; phases group tasks; today marker exists.

**Verification:** visual screenshot + DOM assertions for seeded tasks.

---

#### G3 — Zoom and navigation

**Goal:** day/week/month or equivalent zoom is usable.

**Acceptance:** user can change scale without layout break; current project remains visible.

**Verification:** Playwright zoom interactions + screenshot.

---

#### G4 — Dependencies and critical/conflict indicators

**Goal:** dependencies and critical/conflicting items are visible.

**Acceptance:** dependency lines/markers render; overdue/conflict states are visually distinct.

**Verification:** seeded dependency/conflict assertions + screenshot.

---

#### G5 — Date update interaction

**Goal:** user can change task dates from Gantt.

**Acceptance:** change persists, updates task/project views, handles invalid dates cleanly.

**Verification:** Playwright update date → reload → verify Gantt + task detail.

---

#### G6 — Gantt visual polish

**Goal:** Gantt is founder-beta quality.

**Acceptance:** desktop/narrow screenshots are clean, readable, non-demo.

**Verification:** screenshot review + no-placeholder checker.

---

### Lane R — Resources / Workload

#### R1 — Workload data model

**Goal:** workload by user/role/project/time comes from real data.

**Acceptance:** API/read-model includes allocation, capacity, role, project, overload flags.

**Verification:** contract test with seed overload and missing role.

---

#### R2 — Workload matrix rendering

**Goal:** visual matrix shows people/roles/projects/time.

**Acceptance:** readable matrix; loading/empty/error states; no mock data.

**Verification:** route smoke + screenshot.

---

#### R3 — Overload and conflict states

**Goal:** overload/conflicts are visible and actionable.

**Acceptance:** overload > capacity highlighted; date conflict/absence highlighted.

**Verification:** Playwright assertions on seeded overload/conflict.

---

#### R4 — Missing role / unassigned work

**Goal:** missing role or unassigned task is visible.

**Acceptance:** unfilled role appears in resources and dashboard attention if relevant.

**Verification:** seeded missing role assertions.

---

#### R5 — Assignment/change action

**Goal:** beta supports changing assignment/capacity if backend exists; otherwise honest read-only mode.

**Acceptance:** either mutation persists, or control is disabled with clear reason and no fake click.

**Verification:** Playwright mutation or disabled-state test.

---

#### R6 — Resources visual polish

**Goal:** resources screen is founder-beta quality.

**Acceptance:** desktop/narrow screenshots clean, readable, non-demo.

**Verification:** screenshot review + no-placeholder checker.

---

### Lane D — Deals / Clients / Dashboard

#### D1 — Deals live pipeline

**Goal:** deals list/pipeline loads real deals.

**Acceptance:** stage, client, owner, value/status/next action shown from API.

**Verification:** route smoke + API contract.

---

#### D2 — Deal stage mutation

**Goal:** stage changes persist.

**Acceptance:** stage update survives reload and records activity/audit if applicable.

**Verification:** Playwright change stage → reload → verify.

---

#### D3 — Deal next action

**Goal:** next action can be set/changed.

**Acceptance:** next action persists and appears on dashboard attention if overdue/missing.

**Verification:** Playwright set next action → dashboard assertion.

---

#### D4 — Deal detail and client context

**Goal:** deal detail has enough client/contact context for handoff.

**Acceptance:** client/contact/source/notes visible from real data.

**Verification:** route smoke.

---

#### D5 — Deal to project handoff

**Goal:** create project from deal with copied context.

**Acceptance:** project created, linked to deal/client, visible in project list/detail.

**Verification:** Playwright handoff → open project → verify link/context.

---

#### DB1 — Dashboard attention read-model

**Goal:** dashboard shows operational risks.

**Must include:** overdue tasks, blocked tasks, overloaded people, missing roles, deals without next action, at-risk projects.

**Acceptance:** cards link to real entities.

**Verification:** API contract + Playwright click-through.

---

#### DB2 — Dashboard visual polish

**Goal:** dashboard is cockpit-quality.

**Acceptance:** clean desktop/narrow screenshots, no demo/dead surfaces.

**Verification:** screenshots + no-placeholder checker.

---

### Lane A — Admin / RBAC / Audit

#### A1 — Users list

**Goal:** admin users page loads real users.

**Acceptance:** users come from API; loading/error/empty states exist.

**Verification:** API contract + route smoke.

---

#### A2 — Create/edit/deactivate user

**Goal:** basic user lifecycle works.

**Acceptance:** create/edit/deactivate persists; deactivated user is visually distinct.

**Verification:** Playwright CRUD flow.

---

#### A3 — Roles and permissions

**Goal:** minimal RBAC affects product behavior.

**Acceptance:** role changes alter at least one protected UI/API capability.

**Verification:** Playwright: change role → verify allowed/forbidden behavior.

---

#### A4 — Audit page

**Goal:** audit page shows manual and agent actions.

**Acceptance:** entries show actor, action, entity, timestamp, result.

**Verification:** perform mutation → verify audit entry.

---

#### A5 — Forbidden/read-only states

**Goal:** permission failures are explicit and polished.

**Acceptance:** user sees forbidden/read-only state, not broken buttons or silent failure.

**Verification:** Playwright forbidden-state scenario.

---

### Lane AG — Global Workspace Agent

#### AG1 — Agent context contract

**Goal:** agent receives grounded workspace context.

**Context must include:** user, role, route, selected entity, visible read-model summary, allowed actions, relevant risks.

**Acceptance:** context differs correctly across dashboard/project/deal/my-work routes.

**Verification:** contract tests.

---

#### AG2 — Proposal schema

**Goal:** proposal is structured and reviewable.

**Proposal must include:** title, summary, target entity, action type, diff, risk, required permission, confirmation requirement.

**Acceptance:** UI can render proposal without parsing free text.

**Verification:** unit/contract tests.

---

#### AG3 — Confirmation gate

**Goal:** no mutation happens before user confirms.

**Acceptance:** proposal alone creates no DB mutation; confirm applies exactly one mutation.

**Verification:** Playwright no-confirm/no-mutation + confirm/mutation.

---

#### AG4 — Task action

**Goal:** agent can propose and apply task update.

**Acceptance:** status/owner/due/blocker update applies, result shown, audit recorded.

**Verification:** Playwright proposal → confirm → verify task + audit.

---

#### AG5 — Deal/project action

**Goal:** agent can propose and apply deal/project action.

**Acceptance:** e.g. next action, stage change, or project handoff draft applies with confirmation.

**Verification:** Playwright proposal → confirm → verify target + audit.

---

#### AG6 — Failure paths

**Goal:** agent failures are safe and legible.

**Acceptance:** forbidden, stale entity, API error show clear result; no partial silent mutation.

**Verification:** mocked/seeded failure scenarios.

---

#### AG7 — Agent UI polish

**Goal:** agent panel/page is useful but not dominant.

**Acceptance:** can be ignored; core workflow remains usable; proposals/results readable.

**Verification:** screenshot + walkthrough.

---

### Lane U — UI Cleanup / Runtime Polish

#### U1 — Remove runtime placeholders

**Goal:** no placeholder components on beta routes.

**Acceptance:** checker and visual review pass.

**Verification:** no-placeholder checker + screenshots.

---

#### U2 — Remove demo/fake data from runtime

**Goal:** runtime uses beta seed/API only.

**Acceptance:** forbidden demo names/tokens absent from beta routes.

**Verification:** grep/checker + visual review.

---

#### U3 — Dead control audit

**Goal:** no clickable dead ends.

**Acceptance:** every visible button/link either works or has explicit disabled reason.

**Verification:** Playwright interaction audit on beta routes.

---

#### U4 — Desktop visual pass

**Goal:** core screens are founder-beta polished.

**Acceptance:** screenshots are visually coherent and production-like.

**Verification:** screenshot review checklist.

---

#### U5 — Narrow viewport visual pass

**Goal:** core screens remain usable on narrow viewport.

**Acceptance:** no broken layout or hidden critical actions.

**Verification:** screenshot review checklist.

---

#### U6 — Copy and terminology pass

**Goal:** product language matches architecture bureau operations.

**Acceptance:** no debug/API jargon in user-facing runtime; consistent Russian/English choice per product direction.

**Verification:** manual copy review.

---

## 8. Execution waves

### Wave 1 — Stabilize base, 0.5 day

Parallelism: low. Everyone needs same base.

- F0.1 beta route inventory.
- F0.2 seed/reset.
- F0.3 fast gate.
- MW0 PR #73 review.

Exit criteria:

- clean beta branch exists;
- seed works;
- route list fixed;
- PR #73 decision recorded;
- fast gate command/equivalent exists.

### Wave 2 — Core data surfaces, 0.5-1 day

Parallelism: high.

- P1-P3 project route/read-model/tasks list.
- D1-D4 deals/client surfaces.
- R1-R2 resources read-model/rendering.
- G1-G2 timeline model/rendering.
- A1 users list.
- MW1 real My Work source.

Exit criteria:

- all core routes show real seeded data;
- no route depends on hardcoded demo arrays.

### Wave 3 — Mutations and persistence, 1 day

Parallelism: high but contracts must be coordinated.

- MW2-MW5.
- P4-P6.
- D2-D5.
- R3-R5.
- G3-G5.
- A2-A5.

Exit criteria:

- task/deal/project/resource/admin mutations persist;
- Gantt/resources are actually usable;
- dashboard can reflect changed state.

### Wave 4 — Global agent, 0.5-1 day

Parallelism: medium.

- AG1-AG6.
- Agent must target existing task/deal/project APIs.

Exit criteria:

- no mutation without confirmation;
- result + audit visible;
- failure paths safe.

### Wave 5 — UI polish and beta proof, 0.5-1 day

Parallelism: medium.

- F0.4-F0.6.
- DB1-DB2 final dashboard.
- G6, R6, P7.
- U1-U6.
- final walkthrough.

Exit criteria:

- founder-beta DoD satisfied;
- screenshots archived;
- final blocker list is empty or explicitly waived by Max.

---

## 9. Reviewer checklist for every PR

Reviewer must answer:

1. Does this PR touch only one lane/card scope?
2. Does it remove or avoid mock/demo data on beta routes?
3. Does mutation persist after reload?
4. Are loading/error/empty/forbidden states handled if relevant?
5. Are there dead controls?
6. Does it create/maintain audit entries for auditable actions?
7. Are screenshots included for UI changes?
8. Did fast PR gate run?
9. Does it create conflicts with another active lane?
10. Is any skipped check documented?

If any answer is bad, do not merge into beta integration branch.

---

## 10. Final beta cut checklist

- [ ] GitHub billing/CI fixed, or Max explicitly approved local-artifact beta cut.
- [ ] PR #73 reviewed and either merged, cherry-picked, or superseded.
- [ ] Clean beta integration branch.
- [ ] Seed/reset deterministic.
- [ ] Fast gate passes.
- [ ] Full pre-beta gate passes or waivers recorded.
- [ ] Founder walkthrough passes.
- [ ] Dashboard screenshots desktop/narrow.
- [ ] Deals screenshots desktop/narrow.
- [ ] Project detail screenshots desktop/narrow.
- [ ] Gantt screenshots desktop/narrow.
- [ ] Resources screenshots desktop/narrow.
- [ ] My Work screenshots desktop/narrow.
- [ ] Agent screenshots desktop/narrow.
- [ ] Admin screenshots desktop/narrow.
- [ ] No-placeholder/no-demo checker passes.
- [ ] Dead control audit passes.
- [ ] Agent confirmation/audit proof passes.
- [ ] RBAC forbidden/read-only proof passes.
- [ ] Known blockers list reviewed by Max.

---

## 11. Abort / pause criteria

Pause and re-plan if any of these happen:

- Gantt date mutation requires large backend redesign.
- Resources workload model is missing core entities and cannot be patched safely.
- Task/deal/project APIs are inconsistent enough to break agent contract.
- CI remains blocked and local gates become flaky/untrustworthy.
- More than two lanes modify the same core model differently.
- Runtime UI still depends on mock/demo arrays after Wave 2.

---

## 12. Handoff prompt for subagents

Use this template for each card:

```md
You are implementing KISS PM founder-beta task <ID>: <Title>.

Plan of record: /home/moltadmin/.openclaw/workspace/kiss-pm-beta-plan.md
Scope: only this card. Do not widen scope.

Goal:
<copy card goal>

Acceptance:
<copy card acceptance>

Verification:
<copy exact commands/scenario>

Rules:
- no runtime placeholders;
- no hardcoded demo data;
- no dead controls;
- persistence after reload for mutations;
- screenshots for visible UI changes;
- record audit for auditable mutation;
- report files changed, commands run, screenshots/artifacts, and blockers.

Before coding:
1. Inspect existing implementation.
2. Identify exact files/routes/API.
3. Add or update failing test where practical.

After coding:
1. Run targeted verification.
2. Capture screenshot if UI changed.
3. Summarize risk and next dependencies.
```

---

## 13. Recommended first three actions

1. Fix or confirm workaround for GitHub billing/CI blocker.
2. Review PR #73 and map it to MW0-MW5.
3. Execute F0.1-F0.3 before sending parallel agents into feature lanes.

Only after these three should parallel lane execution begin.
