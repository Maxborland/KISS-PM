# R2-UI-003 Resource Capacity Hardening

Status: active
Phase: R2
Aliases: R2-UI-003, R2-007, R2-008

## Scope

Implement the Release 2 Resource Load / Capacity Matrix and resource conflict resolution UI hardening slice.

Owned files:

- `apps/web/src/ResourceLoadControlSurface.tsx`
- `apps/web/src/ResourceLoadControlSurface.test.tsx`
- `apps/web/src/styles.css`
- `docs/status/release2-ui-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/handoff/**`
- `.agent-bus/events/events.jsonl`

## Acceptance

- Capacity matrix shows hierarchy rows, sticky time headers, crosshair, severity heatmap, reduced/non-working states, overload/free-capacity states, summary strip, and source-aware drilldown.
- Overload/conflict resolution keeps preview-before-apply, permission trace, warnings/blockers, audit result, API readback, and reload-safe evidence visible.
- Read-only state preserves context and explains disabled action reasons.
- No API, domain, package, or E2E production changes in this slice.

## Verification

- `npm test -- apps/web/src/ResourceLoadControlSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- `node scripts/agent-bus-guard.mjs --task R2-UI-003-resource-capacity-hardening --once`
