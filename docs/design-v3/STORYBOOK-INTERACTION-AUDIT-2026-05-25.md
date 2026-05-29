# Storybook Interaction Audit — 2026-05-25

Scope: design-v3 Storybook/frontend screens in `apps/web/src/views/blocks`, `apps/web/src/widgets`, `apps/web/src/views/screens`, and component catalog.

Principle used for this audit:

> If a Storybook element looks interactive, it should be interactive on local frontend state. Backend persistence/API may be mocked, but the frontend behavior must be real or the control must be disabled/labelled as pending.

## Executive summary

Aside from the new Gantt local controller work and a few primitive UI demos, most design-v3 screens are still visual mocks:

- static arrays rendered as cards/tables;
- uncontrolled inputs with `defaultValue` only;
- enabled buttons without handlers;
- no local mutation/navigation contract;
- no drag/drop for surfaces that visually imply drag/drop;
- limited Storybook state coverage for loading/error/pending/conflict/optimistic rollback.

This is fixable, but it is a real frontend interaction backlog, not just visual polish.

## Audit matrix

| Component / screen | Expected interactions | Current evidence | Severity | Suggested batch |
|---|---|---|---|---|
| `02-my-work` / Kanban | Drag cards, move between columns, reorder, open card, edit card, list/kanban switch | `my-work-block.tsx` has only segmented mode state; list mode is demo text. `kanban-card.tsx` is plain `<article>`. `kanban-board.tsx` column menu button has no handler. | High | B1 Kanban interaction contract |
| `05-deals` | Create deal, search/filter, drag deals across funnel, open deal, forecast view | Mode switch state exists, but filter is disabled as demo. Funnel cards have no click/drag. Forecast is placeholder text. | High | B2 CRM lists/funnel |
| `07-projects-list` | Create/open project, search/filter, row actions, archive/templates state | Segmented filter state only. Create/action buttons have no handlers. Filter is explicitly disabled. | High | B3 Projects list |
| `03/06/07b EntityDetailBlock` | Save fields, comment send, attach file, schedule action, persist selects/date/input | Dropdown opens but item has no action. Save has no handler. Textarea + attach/send have no handlers. Form fields are uncontrolled defaults. | High | B4 Entity detail/forms |
| `04-create-task-modal` | Stepper navigation, validation, create/cancel, tags/date/combobox persistence | No component state. Stepper hardcoded. Footer buttons no handlers. Fields are uncontrolled/default-only. | High | B5 Task creation wizard |
| `08-entities-*` | Import/add/search/filter/open row/row menu | Static data. Import/add/filter/action buttons have no handlers. | High | B2 CRM lists/funnel |
| `09-admin` | Invite user, user row actions, audit actions, policy persistence | Static users. Invite/actions/audit buttons no handlers. Switches are default UI only. | High | B6 Admin/settings persistence |
| `10-settings` | Save profile, tabs, notification/integration/billing settings | Tab switch works. Integrations/billing are demo text. Save no handler. Profile inputs/selects default-only. | Medium-High | B6 Admin/settings persistence |
| `11-avatar-menu` | Profile/settings/workspace/logout actions | Dropdown is forced open. Items have no handlers/navigation contract. | Medium | B7 Navigation/account actions |
| `01-dashboard` | Navigate from KPI/cards/meetings/tasks/signals, change period | Multiple buttons/icon buttons have no handlers: month, calendar, open, all work, management surface. | Medium | B7 Navigation/account actions |
| `12-project-gantt` | Editable Gantt, save/date/filter/backend scheduling | Strong local interaction work exists: edit cells, drag/link/undo. Backend apply is mock. Top date/save have no handlers. Filter disabled. | Medium | B8 Gantt toolbar + backend bridge later |
| `13-project-resources` / ResourceMatrix | Filter roles/month, assign, collapse groups, inspect allocations | Static mock matrix. Toolbar buttons no handlers. Collapse toggle button has no `onClick`. | High | B9 Resource matrix |
| `14-project-baseline` | Baseline snapshots, compare, restore/accept | Mostly static; action buttons no handlers. | High | B10 Project control surfaces |
| `15-project-scenarios` | Scenario create/compare/accept | Mostly static; scenario action buttons no handlers. | High | B10 Project control surfaces |
| `16-project-kpi` | KPI drilldown, period/filter changes | Mostly static; filter/action buttons no handlers. | High | B10 Project control surfaces |
| `17-project-audit` | Audit search/filter/open item/export | Mostly static; filter buttons no handlers. | High | B10 Project control surfaces |
| `18-project-calendars` | Save/add/remove/template calendars | Mostly static. Save/add/template buttons no handlers. Remove has optional handler, but rows pass none. | High | B10 Project control surfaces |
| `ComponentCatalog.stories.tsx` | UI kit primitive demos | Some primitives are functional: segmented, overlays, toast, combobox. Many sample buttons are intentionally actionless visual examples. | Low | Keep as visual catalog; label non-action examples if needed |

## Recommended batches

### B1 — Kanban interaction contract

Target: `02-my-work`, `widgets/kanban`.

Must include:

- local controlled board state;
- drag cards between columns;
- reorder within a column;
- open card drawer/modal;
- edit card fields locally;
- optimistic/error/rollback stories;
- keyboard fallback for moving cards.

### B2 — CRM lists/funnel contract

Target: `05-deals`, `08-entities-*`.

Must include:

- working search/filter local state;
- open row/card;
- create drawer stub with local add;
- row/menu actions;
- deal funnel drag between stages;
- empty/loading/error states.

### B3 — Projects list contract

Target: `07-projects-list`.

Must include:

- search/filter/sort;
- open project action;
- create project drawer stub;
- archive/templates local state;
- row actions.

### B4 — Entity detail/forms contract

Target: task/deal/project detail.

Must include:

- controlled fields;
- dirty state;
- save/cancel;
- validation;
- comments composer;
- attachment placeholder state;
- timeline/action menu callbacks.

### B5 — Task creation wizard

Target: `04-create-task-modal`.

Must include:

- real stepper state;
- required-field validation;
- controlled assignee/date/tags;
- create/cancel callbacks;
- success/error stories.

### B6 — Admin/settings persistence contract

Target: `09-admin`, `10-settings`.

Must include:

- controlled switches/forms;
- invite flow stub;
- user row menu actions;
- save/cancel/dirty state;
- billing/integrations disabled or real local states.

### B7 — Navigation/account/dashboard actions

Target: `01-dashboard`, `11-avatar-menu`, shell/chrome.

Must include:

- action callbacks for cards/buttons;
- menu action states;
- disabled/coming-soon labels where behavior is intentionally absent.

### B8 — Gantt toolbar + backend bridge later

Target: `12-project-gantt`.

Current Gantt is closest to the desired Storybook standard, but still needs:

- toolbar buttons wired to local state;
- filter/date controls;
- clearer apply/preview state labels;
- later backend bridge to real planning API.

### B9 — Resource matrix interaction contract

Target: `13-project-resources`.

Must include:

- collapse/expand groups;
- filter month/role/local state;
- inspect allocation cell;
- edit/assign mock interaction;
- conflict/pending states.

### B10 — Project control surfaces

Target: baseline, scenarios, KPI, audit, calendars.

Must include local interaction contracts for each surface or disable controls until implemented.

## Rule to add to design contract

Add this rule to `docs/design-v3/DESIGN_CONTRACT.md` or a dedicated Storybook contract doc:

> Storybook screens are not static mockups. Any visible enabled control must either perform its frontend interaction on local controlled state, emit a documented callback/action, or be visibly disabled/marked as pending. Static visual-only examples are allowed only in the component catalog and must not masquerade as working product screens.

