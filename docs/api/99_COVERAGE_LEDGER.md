# API Coverage Ledger

## Current State

Implemented in this slice:

- Scalar UI at `GET /api/docs`.
- OpenAPI document at `GET /api/openapi.json`.
- Route inventory coverage for every implemented Hono route.
- Common auth, mutation guard, error and response conventions.
- Health test that fails when a backend route is added without an OpenAPI entry.
- Frontend screen recipes for the main app surfaces.
- Exact L2 schemas for Auth/Profile, workspace users/access profiles/positions,
  and CRM dictionaries: clients, contacts, products, project types, deal stages.
- Exact L2 schemas for workspace access roles, tenant org structure, workspace
  custom fields/project templates, audit events, opportunities/intake,
  task activity, CRM activity and control surfaces.
- Exact L2 schemas for project/task read surfaces, task create/update/archive/status
  transitions and tenant task status dictionaries.
- Exact L2 schemas for Planning/Gantt core read model, PlanningCommand envelopes,
  baselines, scenario proposals, saved views and persisted auto-solver runs.
- Exact L2 schemas for attachments, external-reference attach, file multipart
  upload, metadata search, project documents, document versions, decision log and
  knowledge action items.
- Exact L2 schemas for capacity tree/summary/drilldown, production calendar,
  resource absences, personal calendar events and unified occupancy windows.
- Exact L2 schemas for KPI definitions, control read/evaluate, management action
  preview/apply, control signal status, corrective actions and closure/
  retrospective/template-improvement surfaces.
- Exact L2 schemas for conversations, messages, reactions, read states,
  notifications, meetings, communication channels, sticker packs/assets,
  call rooms/sessions/join tokens/recordings/events, scheduled tasks and
  background job run/event/enqueue surfaces.

## Coverage Levels

`L1 Inventory`:
Route exists in OpenAPI with method, path, tag, auth expectation, path params,
common errors and generic success body.

`L2 Contract`:
Route has exact query/body/response schemas and examples.

`L3 Workflow`:
Route is linked from a frontend screen recipe with invalidation/conflict handling.

## Module Status

| Module | Current level | Next step |
|---|---:|---|
| Health/Auth/Profile | L2/L3 | Add health readiness object details and examples. |
| Workspace users/access/org/config | L2/L3 | Add examples for org replacement conflicts and config immutability errors. |
| CRM/intake/projects/tasks | L2/L3 | Add examples for opportunity activation and locked CRM activity errors. |
| Planning/Gantt/resources/solver | L2/L3 | Add examples and query parameter schemas for realtime/events once frontend wires them. |
| Capacity/calendar/occupancy | L2/L3 | Add examples for masked capacity contribution and private occupancy cases. |
| KPI/control/closure/control surfaces | L2/L3 | Add examples for governed action apply, surface publish validation and project-close conflicts. |
| Storage/search/documents | L2/L3 | Add examples and generated SDK samples once schema generation is wired. |
| Collaboration/meetings/calls/stickers | L2/L3 | Add examples for message mentions, sticker import and provider join-token expiry. Add self-hosted A/V media plane (`docs/46`): turn-credentials, egress start/stop/list, per-track recordings and the internal signature-verified LiveKit webhook receiver. Response examples must prove no secret serialization (no TURN cred, LiveKit api-secret, egress storage key or raw webhook Authorization). |
| Background jobs | L2/L3 | Add examples for retry/dead job lifecycle and operator enqueue flows. |

## Definition Of Done For The Active Goal

The full API documentation goal is complete only when every implemented route is
at least `L2 Contract`, important frontend screens are `L3 Workflow`, and CI proves
no undocumented backend routes can be added.
