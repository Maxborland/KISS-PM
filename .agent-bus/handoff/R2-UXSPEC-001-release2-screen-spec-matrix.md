# Handoff: R2-UXSPEC-001-release2-screen-spec-matrix

Status: accepted

Updated: 2026-05-17T12:05:00+07:00

## Summary

Created the Release 2 BP-driven screen-by-screen UI/UX planning pack. The pack uses `docs/02_UNIVERSAL_PROJECT_BP.md` as the S0-S8 spine and treats every report-like surface as an interactive management plane:

```txt
projection -> signal -> action -> preview -> result
```

No product implementation was changed.

## Files

- `docs/product/RELEASE_2_SCREEN_SPECS.md`
- `docs/product/RELEASE_2_INTERACTION_FLOWS.md`
- `docs/product/RELEASE_2_MODAL_DRAWER_PANEL_SPECS.md`
- `docs/product/RELEASE_2_CONTROL_SURFACE_ACTION_SPECS.md`
- `docs/product/RELEASE_2_UI_UX_SPEC.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/ROLE_BASED_JOURNEYS.md`
- `docs/product/USER_STORIES_P3_P12.md`
- `docs/status/release2-ui-ux-screen-matrix.json`
- `scripts/verify-release2-ui-ux-matrix.mjs`
- `scripts/verify-release2-ui-ux-matrix.test.ts`
- `docs/roadmap/RELEASE_2_FOUNDATION_CONTRACT.md`
- `docs/backlog/FUTURE_SCOPE.md`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`

## Verification

- `node scripts/agent-bus-guard.mjs --task R2-UXSPEC-001-release2-screen-spec-matrix --once` exit 0 at startup.
- `node scripts/verify-release2-ui-ux-matrix.mjs docs/status/release2-ui-ux-screen-matrix.json` exit 0: 19 screens verified.
- `npm test -- scripts/verify-release2-ui-ux-matrix.test.ts` exit 0: 1 file, 5 tests passed.
- `node -e "JSON.parse(require('fs').readFileSync('.agent-bus/queue.json','utf8')); JSON.parse(require('fs').readFileSync('docs/status/release2-ui-ux-screen-matrix.json','utf8')); console.log('json ok')"` exit 0.
- `node scripts/verify-ux-screen-matrix.mjs docs/status/p3-p12-ux-screen-matrix.json` exit 0: legacy P3-P12 UX screen matrix still parses.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task R2-UXSPEC-001-release2-screen-spec-matrix --once` exit 1 before lock cleanup because the done task still had local locks; removed only this task's locks.
- `node scripts/agent-bus-guard.mjs --task R2-UXSPEC-001-release2-screen-spec-matrix --once` exit 0 after lock cleanup.

## Review Notes

- Bug-hunt finding: previous product docs still referenced stale P12 E2E-120..122 ids.
- Fix: updated product docs to canonical P12 E2E-111..115 references where those operator/readiness stories are described.
- Code-review finding: matrix needed machine enforcement that report-like screens cannot be passive.
- Fix: added verifier checks for BP stage coverage, required cross-cutting screens, management_loop signal/action/preview/result, states, permissions, audit/readback/reload/cleanup, existing spec paths, and MS Project-like Gantt wording.

## Next

Next runnable task: `R2-ACT-001-governed-command-audit-contract-hardening`.

Use the accepted screen matrix when hardening the command/audit contract: it must support management planes embedded in schedule, project, portfolio, resource, KPI, retrospective, tenant configuration, integration, and operator surfaces.
