# Worker Scenarios permission report

Status: PASS

## Scope

- apps/web/src/delivery/scenarios/scenarios-surface.tsx
- apps/web/src/delivery/scenarios/scenarios-permission.test.tsx
- e2e/full-eval/projects-scenarios-write.spec.ts

## Capability inventory

| Capability | Backend permission | UI behavior |
| --- | --- | --- |
| Preview scenario proposals | tenant.planning_scenarios.preview | Auto-preview, refresh and target selection are available only with preview permission. |
| Apply a persisted proposal | tenant.planning_scenarios.apply | Apply buttons and accepted-risk reason input are available only with apply permission. |
| Compare a proposal | Preview result, no write | Remains available to preview-only users and does not call apply. |

No role names are used for authorization. Both preview and apply handlers contain early permission guards.

## Findings fixed

- The surface previously auto-posted scenario preview for every plan reader and always rendered Apply controls, while the API enforced two independent permissions.
- The first live ADMIN E2E exposed an async-session race: permissions arrived after the first render, but auto-preview did not rerun. Adding `canPreviewScenarios` to the effect dependencies fixed it.
- PLAN now sees a read-only permission state and no preview, compare, apply, or risk-reason controls.

## Verification

- Focused Vitest: `1 passed`.
- Live Chromium E2E against web `3180` / API `4191`: `2 passed`.
- ADMIN: preview -> compare -> apply -> readback -> reload -> compensating assignment restore -> reload.
- PLAN: controls absent; direct preview 403; direct apply 403; no UI apply; plan version, assignments and target overload unchanged before/after/reload.
- Machine-readable Playwright evidence: `.superloopy/evidence/projects-2026-07-10/projects-scenarios-permission-playwright.json`.
- `git diff --check` passed for the owned product and E2E files.
- Full web typecheck remains externally blocked by `settings-permission.test.ts` importing a not-yet-exported `canManageProjectSettings`; no Scenarios TypeScript error was reported before that blocker.

## Residual notes

Scenario preview intentionally persists scenario-run records and an audit event even though it does not mutate the plan. The ADMIN cleanup restores mutable assignment/overload business state; plan versions, audits, and applied scenario-run history remain append-only by design.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-scenarios-permission.md
