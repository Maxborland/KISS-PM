# Release 2 UI/UX Specification

Updated: 2026-05-17

## 1. Purpose

Release 2 must not begin as a code-first feature push. Before implementation, KISS PM needs a polished UI/UX contract that turns the accepted P3-P12 product loop into a product that helps managers act, not just observe.

This document defines the Release 2 UI/UX baseline. It complements:

- `docs/product/DESIGN_SYSTEM.md`
- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/ROLE_BASED_JOURNEYS.md`
- `docs/roadmap/RELEASE_2_FOUNDATION_CONTRACT.md`

## 2. Product UX North Star

KISS PM UI must guide operational decisions:

```txt
signal or work state
  -> consequence and context
  -> recommended governed action
  -> preview before risky change
  -> apply through backend command
  -> audit/result evidence
  -> refreshed projection
  -> reload persistence
```

The UI is not a dashboard collection. Every major surface must be a management instrument: it shows the problem, suggests the next safe action, prevents unauthorized or risky shortcuts, and proves the result.

## 3. Component And Interaction Stack

Release 2 implementation stack:

- shadcn/ui as the default base component library;
- Radix primitives for dialogs, menus, popovers, sheets, tabs, tooltips, focus management, and accessibility behavior;
- custom KISS PM product components where the domain requires more than generic CRUD UI;
- Tailwind CSS with semantic tokens and restrained operational styling;
- TanStack Query for server state and TanStack Table where a headless table/grid is appropriate;
- custom timeline/Gantt logic for the project plan surface.

shadcn default appearance is not accepted by itself. Every primitive must be adapted to KISS PM:

- compact operational density;
- Russian copy;
- visible permission state;
- loading/error/empty/denied states;
- audit/readback/result area for state-changing actions;
- keyboard and focus behavior;
- semantic severity tokens.

## 4. Release 2 UX Rules

1. One clear primary next action per operational state.
2. Preview before any risky or broad mutation.
3. Permission denial must explain what is unavailable and why.
4. Read-only users must still understand current state and allowed drill-downs.
5. Toasts are supplemental only; they are not mutation evidence.
6. UI success must come from API/domain readback, not local optimistic state alone.
7. Empty states must guide setup or next action; they must not look like missing implementation.
8. Dense screens must remain scannable: stable columns, clear groups, no decorative clutter.
9. Russian operational copy is the default. Avoid marketing copy inside app surfaces.
10. Every control surface must link signal, recommended action, result, and audit.

## 5. Project Gantt Direction

The Project Gantt is the most important planning UX benchmark for Release 2. It must feel close in function and planner ergonomics to a serious MS Project-style desktop planning workspace while staying a KISS PM web control surface.

Required qualities:

- split WBS grid + timeline with synchronized selection;
- stable row heights and dense task rows;
- WBS hierarchy, summary tasks, milestones, task bars, dependencies, baseline overlay, today marker, and non-working days;
- fast inline editing for dates, duration, work, progress, participants, and status where permissions allow;
- clear validation for impossible dates, dependency loops, baseline conflicts, and permission denial;
- toolbar with create task, indent/outdent, dependency mode, baseline, today, zoom, filters, warnings, and view settings;
- side detail panel for canonical task, schedule fields, participants, dependencies, audit, and related views;
- contextual warnings linking to resource load, KPI deviations, lifecycle blockers, and portfolio control actions;
- API-backed persistence, audit trail, related projection refresh, and reload persistence.

Not accepted:

- a passive SVG/bar chart with no planning operations;
- a generic table next to an unrelated timeline;
- UI-only date changes;
- Gantt-specific task entities separate from canonical tasks;
- visual mockups without permission, audit, readback, and reload behavior.

## 6. Management Decision Support

Every Release 2 management surface should answer:

- What is happening?
- Why does it matter?
- Who is affected?
- What is the safest next action?
- What will change if I apply it?
- Who is allowed to do it?
- Where is the audit/result evidence?
- Did related views refresh?

Recommended surface structure:

1. Header with object context and current state.
2. Signal/health band with severity and explanation.
3. Main work area with dense but readable operational data.
4. Primary action area with recommended governed command.
5. Preview/result panel for risky changes.
6. Audit/readback footer or side panel.
7. Related-view drill-downs.

## 7. Modal, Sheet, And Panel Rules

Use:

- Dialog for focused low-risk forms.
- AlertDialog for destructive or irreversible confirmation.
- Sheet for object details, task editing, Gantt details, audit previews, and multi-field side work.
- Popover for compact filters, date helpers, and low-risk contextual controls.
- Command for scoped search/action launcher.

Every modal/sheet/panel spec must define:

- trigger;
- role/permission;
- inputs;
- validation;
- cancel/close behavior;
- preview/dry-run if risky;
- apply behavior;
- error recovery;
- stale preview handling;
- result/audit evidence;
- reload/readback expectations.

## 8. Release 2 Screen Spec Pack To Produce Next

This document is the baseline direction, not the full screen-by-screen pack. The next UX documentation task must produce:

- `docs/product/RELEASE_2_SCREEN_SPECS.md`
- `docs/product/RELEASE_2_INTERACTION_FLOWS.md`
- `docs/product/RELEASE_2_MODAL_DRAWER_PANEL_SPECS.md`
- `docs/product/RELEASE_2_CONTROL_SURFACE_ACTION_SPECS.md`
- `docs/status/release2-ui-ux-screen-matrix.json`
- verifier support for the matrix

No Release 2 UI implementation should be accepted without those specs or an explicit narrower decision record.
