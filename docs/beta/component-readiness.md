# KISS PM Beta Component Readiness

Storybook is a component catalog, not an automatic source of truth. Runtime can use Storybook blocks only after they pass a readiness classification.

## Component Status Values

- `approved`: can be used in runtime as-is.
- `needs-adaptation`: visually or structurally useful, but needs a runtime-safe variant or missing states.
- `outdated`: do not use until redesigned or rewritten.
- `missing`: required component does not exist.
- `deferred`: not needed for beta.

## Component Gate

A reusable component is beta-approved only when:

1. Purpose is clear
   - It has a named operational use case.
   - It is not just a decorative demo block.

2. Data shape is typed
   - Props reflect runtime data contracts.
   - Empty/loading/error/permission variants are supported where relevant.

3. Interaction contract is real
   - Enabled controls either mutate local controlled state, call documented callbacks, or are disabled.
   - Fake buttons are not allowed in runtime.

4. Visual quality is production-grade
   - Layout density fits a real project-management application.
   - It works at desktop and narrow widths.
   - It does not rely on Storybook chrome or artificial canvas assumptions.

5. Runtime compatibility
   - No dependency on mocked-only globals.
   - No hardcoded demo-only text where runtime data is required.
   - No stale design-v2 assumptions if design-v3/runtime has moved on.

6. QA proof
   - Story exists for normal, empty, loading/error where relevant.
   - Component or runtime E2E proof exists for critical interactions.
   - Visual evidence targets the product root, not Storybook UI chrome.

## Initial Component Families

| Component family | Expected beta status | Runtime use | Gate notes |
| --- | --- | --- | --- |
| Runtime shell/navigation | approved/needs-adaptation TBD | All operational screens | Must be stable, dense, role-aware, no dead nav |
| Data table / task table | needs-adaptation TBD | Tasks, deals, resources | Must support empty/error/loading, sorting/filtering if visible |
| Kanban/deals board | needs-adaptation TBD | Deals pipeline | Stage move must persist; no fake drag/drop |
| Project attention/risk panel | missing/needs-adaptation TBD | CEO/PM dashboard, project detail | Critical beta block: overdue, blocked, overloaded, missing role |
| Timeline/Gantt | needs-adaptation TBD | Planning workspace | MVP acceptable, but it must prove real dates/status updates |
| Workload/resource widget | missing/needs-adaptation TBD | Resources, dashboard | Must avoid fake precision; show clear load hints |
| Agent chat panel | needs-adaptation TBD | Project and workspace context | Requires context, proposal diff, confirmation, result/audit |
| Forms and drawers | approved/needs-adaptation TBD | Create/edit flows | Validation and save/error states required |
| Empty/error states | missing/needs-adaptation TBD | All screens | Must be role/task-specific, not generic placeholder copy |
| Audit/activity trail | missing/needs-adaptation TBD | Agent and mutations | Required for trust in agent operations |

## Codex/Cursor Instruction Contract

When implementing a screen:

1. Search existing Storybook/runtime blocks first.
2. Classify each candidate as `approved`, `needs-adaptation`, `outdated`, or `missing`.
3. Use `approved` components directly.
4. For `needs-adaptation`, create a runtime-safe variant and update/add Storybook evidence.
5. For `outdated`, do not import into runtime until the adaptation is part of the slice.
6. For `missing`, build the smallest reusable component that satisfies the screen readiness gate.
7. Update this document or a linked component inventory with the decision.

## Minimum Component Inventory Entry

```md
### Component: ProjectAttentionPanel
- Status: approved
- Used by: Dashboard, ProjectDetail
- Stories: default, no-risks, loading, error
- Runtime props: risks, blockers, overloadedPeople, onOpenEntity
- QA proof: e2e/runtime/project-attention.spec.ts
- Visual evidence: storybook/product-root screenshot
- Notes: Finance risk hidden unless finance data is available
```

## Failure Examples

A component fails the gate if:

- Storybook shows a beautiful static card but runtime cannot pass real data into it.
- The block has active buttons with no callbacks.
- A route imports a generic table even though the workflow needs status grouping, risk priority, or timeline context.
- Visual tests capture Storybook chrome instead of the component/product root.
- The component looks acceptable in isolation but creates a sparse or broken operational screen composition.
### Component: PlanForecastPanel

- Status: missing / not beta-ready
- Used by: future Planning Workspace read-only forecast panel
- Runtime props: must be based on `PlanningForecastRunResponse`
- Required states: stable, watch, needs_decision, unstable, blocked, loading, error, permission denied, expired run
- Interaction contract: no auto-apply; action links only open existing governed planning flows when permission allows
- QA proof required: desktop and 390px runtime screenshots, console/page-error capture, and interaction evidence for any visible action link
- Notes: backend/API contract exists; runtime UI is not approved in this increment

