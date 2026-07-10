# Worker 09: Schedule permission controls

## Scope

- Updated `apps/web/src/delivery/schedule/schedule-surface.tsx`.
- Added `apps/web/src/delivery/schedule/schedule-permission-worker09.test.tsx`.
- No database or API files were used by the focused test.

## Permission contract

- Live Schedule write access requires `tenant.project_plan.manage` from the authenticated session permission list.
- The decision does not inspect role names or role IDs.
- Non-live Storybook/mock behavior remains editable, matching the existing frontend runtime convention.
- Read-only users keep Schedule viewing, zoom, selection, inspector, column sizing, and Baseline navigation.
- Write toolbar actions, row menus, cell/date/resource/dependency editors, inline create rows, Gantt drag/link handles, batch actions, and mutation dialogs are not mounted without the capability.
- `applyCmd`, `runBatch`, `applyStaged`, and `undo` also reject calls without the capability.

## Red/green evidence

Red command:

```text
.\node_modules\.bin\vitest.cmd run apps/web/src/delivery/schedule/schedule-permission-worker09.test.tsx
```

Before the fix: 1 failed. The read-only render unexpectedly contained `>Пакет<` and the bottom create control.

Green result: 1 test file passed, 1 test passed. The read-only permission set hides write controls and preserves Baseline; the manage permission set retains write controls.

## Web typecheck

```text
apps/web/node_modules/.bin/next.cmd typegen
node_modules/.bin/tsc.cmd -p apps/web/tsconfig.json --pretty false
```

Both commands completed with exit code 0. The first sandboxed `next typegen` attempt stalled without output and was terminated; the successful rerun used `NEXT_TELEMETRY_DISABLED=1` outside the restricted process sandbox.

## CodeGraph change index

- Pre-change: Schedule directory 5 indexed files; `schedule-surface.tsx` 47 symbols; `ProjectSchedule` impact set 4 symbols.
- Post-change: Schedule directory 6 indexed files; `schedule-surface.tsx` 53 symbols; focused test 5 symbols; `ProjectSchedule` impact set remains 4 symbols.
- Added nodes: `canManageScheduleControls`, `ScheduleRowMenu`, and focused test symbols.
- Changed node: `ProjectSchedule` now consumes session permissions and gates write rendering/mutation entry points.
- Removed nodes: none.
- External impact edges: 4 -> 4; no blast-radius expansion. CodeGraph parsed the new helper nodes, but its caller/callee query did not materialize the local helper edge.
