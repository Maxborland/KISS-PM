# KISS PM Beta Screen Readiness Matrix

This document defines how a screen becomes beta-ready. A screen is not ready because it renders. It is ready when it proves a role-specific workflow with real data contracts, working actions, states, and QA evidence.

## Status Values

- `missing`: route/screen does not exist.
- `prototype`: renders but not production-grade.
- `wired`: uses real data/actions but has incomplete states or QA.
- `beta-ready`: passes the readiness gate below.
- `deferred`: consciously outside beta.

## Screen Readiness Gate

Every beta screen must satisfy:

1. Purpose
   - The screen has one clear operational job.
   - It maps to at least one user story in `user-stories.md`.

2. Role fit
   - The primary roles are named.
   - Permissions/read-only/hidden states are defined for roles that should not act.

3. Data contract
   - The screen uses typed runtime API/read-model data.
   - It does not request unused catalogs or permissions.
   - Seed/demo data matches architecture bureau reality.

4. Component source
   - Reusable UI blocks come from approved Storybook/runtime components.
   - Outdated Storybook blocks are not copied into runtime without adaptation.

5. Production-grade layout
   - Dense enough for real project work.
   - Responsive enough for narrow width checks.
   - No decorative landing-page layout for operational screens.
   - No one-off rushed table if a purpose-built block exists or is required.

6. States
   - Loading.
   - Empty.
   - Error.
   - Permission denied/read-only.
   - No results after filter/search.

7. Actions
   - Every visible enabled action works.
   - Pending actions are disabled or removed.
   - Mutations show success/failure state and persist after reload.

8. Agent context
   - For core screens, the agent receives entity context, role, route, visible data, and allowed actions.
   - Agent writes require confirmation.

9. QA proof
   - At least one Playwright/API/component test proves the primary flow.
   - Console/pageerror guard is active.
   - Screenshot evidence exists for desktop and narrow width when visual quality is relevant.

## Initial Runtime Screen Matrix

| Screen | Primary roles | Linked stories | Beta status | Required proof |
| --- | --- | --- | --- | --- |
| Workspace/Dashboard | CEO, PM | CEO-01, PM-02, AGENT-01 | prototype | Seeded risks appear; no console errors; agent can summarize context |
| Clients | Sales, PM, Admin | SALES-01 | missing/wired TBD | Create client, duplicate/empty state, permission state |
| Deals/Pipeline | Sales, CEO | SALES-02, CEO-02 | wired with known gap | Deals read model only requests used data; stage change persists |
| Deal Detail | Sales, PM, Finance | SALES-03, FIN-01 | missing/wired TBD | Handoff context visible; finance permission behavior |
| Projects List | PM, CEO, Lead | PM-01, CEO-01 | wired/prototype TBD | Create/open project, filters, empty state |
| Project Detail | PM, Lead, Specialist | PM-01, PM-02, LEAD-01 | prototype/wired TBD | Add task, update status, blocker visible |
| Planning / Timeline | PM, Lead | PM-03 | prototype TBD | Task renders on timeline; date/status updates persist |
| My Work | Specialist, Lead | SPEC-01, SPEC-02 | missing/wired TBD | Assigned task appears; blocker/status update persists |
| Resources / Workload | HR, PM, CEO | HR-01, HR-02, LEAD-01 | prototype/missing TBD | Overload and missing role signals from seed data |
| Finance | Finance, CEO, PM | FIN-01 | deferred unless existing data supports it | Permission test and visible payment/contract status |
| Agent Chat | PM, CEO, Sales, Lead | AGENT-01, AGENT-02, PM-04, CEO-03 | prototype TBD | Proposal -> confirm -> mutation -> audit; no mutation before confirm |
| Settings/Admin | Admin, CEO | ADMIN-01, permissions support | wired/prototype TBD | Permission/read-only state and no dead controls |

## Visual Quality Rubric

A screen fails visual readiness if:

- it looks like a demo table pasted into a route;
- primary actions and primary data are not visually prioritized;
- spacing creates sparse marketing-page composition on operational screens;
- critical status/risk signals are hidden in low-signal columns;
- cards are used as decoration instead of workflow containers;
- text overlaps, wraps badly, or changes layout on hover/loading;
- mobile/narrow width creates clipped actions or unreadable tables.

## Evidence Format

For each beta-ready screen, keep a short entry in this format:

```md
### Screen: /projects/:id
- Status: beta-ready
- Stories: PM-01, PM-02, LEAD-01, AGENT-01
- Data contracts: project detail read model, tasks, milestones, members
- Components: RuntimeShell approved, TaskTable approved, AttentionPanel approved
- QA: e2e/runtime/project-detail.spec.ts, API contract test
- Visual evidence: artifacts/project-detail-desktop.png, artifacts/project-detail-narrow.png
- Known exclusions: dependency editing deferred
```

