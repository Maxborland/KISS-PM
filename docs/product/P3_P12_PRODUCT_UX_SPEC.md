# P3-P12 Product UX Spec

## Product UX North Star

KISS PM must feel like a mature operational project-control system: strict, calm, dense, clear, and action-oriented. Each screen must expose the management problem, the signal or decision point, one primary next action, permission feedback, persisted result feedback, and audit evidence.

The product is not a set of CRUD pages. The release journey is:

`CRM opportunity -> feasibility -> project draft -> active project -> Gantt/tasks/resources -> KPI/control signal -> governed action -> audit -> closure -> retrospective learning -> improved templates`.

## UX Principles

- Guided workflows over raw configuration.
- One clear next action on every management surface.
- Preview before risky mutation.
- Progressive disclosure for deep configuration and diagnostics.
- Permission transparency: users see why an action is unavailable.
- Audit feedback after every meaningful state-changing action.
- No passive dashboard without management action.
- Russian UI copy by default.

## Product Information Architecture

- CRM Intake: opportunity capture, feasibility, readiness, project draft.
- Projects: overview, lifecycle, stage gates, approvals, artifacts.
- Project Gantt: custom planning workspace for canonical tasks and schedule projections.
- My Tasks: executor queue from canonical tasks.
- Kanban: execution board over the same task model.
- Resource Load: capacity, reservations, overload signals, resolution.
- KPI Deviations: definitions, evaluations, signal handling.
- Control Surfaces: governed management instruments with actions.
- Retrospectives: closed-project snapshots, trends, template improvements.
- Tenant Admin: labels, roles, taxonomies, custom fields, thresholds, saved views.
- Integrations/Admin Diagnostics: import, mapping, isolation, recovery, permission smoke.

## Navigation Model

Primary navigation groups work by operational loop: CRM, Projects, Work, Resources, KPI, Control, Retrospectives, Tenant Admin, Integrations, Operations. Contextual navigation links each object to its related views: opportunity detail to draft project, project overview to Gantt/Kanban/tasks/resources/KPI, KPI deviation to corrective action and audit. Breadcrumbs must show tenant, workspace, project, and object context. Command entry points live in toolbars, row actions, side panels, and guarded dialogs.

## Interaction Model

Every state-changing action follows:

1. Visible starting state.
2. Action trigger with permission state.
3. Preview or confirmation when risk is material.
4. Backend command through application/action layer.
5. Pending state while command executes.
6. Confirmed state only after readback or durable command result.
7. Audit/result feedback with actor, command, before/after, source surface, and result.
8. Reload/refetch behavior that preserves the persisted result.
9. Error recovery with clear next action.

## Screen Quality Bar

A screen is specified only when it has user goal, primary role, primary object, key data, primary next action, secondary actions, permissions, empty/loading/error states, mutation feedback, audit/result feedback, reload/refetch behavior, and E2E links.

## Management Surface Pattern

All control surfaces must follow:

`Operational data -> signal / deviation / decision point -> recommended governed action -> preview / confirmation -> command execution -> audit/result feedback -> refreshed projection -> drilldown / follow-up`.

A surface that only displays data is incomplete for KISS PM.

## Project Gantt Product Position

Project Gantt is a custom KISS PM planning surface built from product primitives. It may use TanStack Table as a headless grid foundation and shadcn/Radix primitives for toolbar, buttons, dialogs, sheets, popovers, dropdowns, command menus, tooltips, forms, badges, and feedback. It must not be specified as an embedded packaged Gantt widget.

Gantt tasks are canonical tasks/projections, not a separate entity. Gantt mutations go through API/application/action layer. Baseline values must not silently change when live dates change. Visual polish is not accepted without persistence, permissions, reload evidence, and audit.
