# Release 2 Product App Reality Audit

Date: 2026-05-17
Status: app-level SaaS readiness not accepted

## 1. Executive verdict

Release 2 control-surface components are merged, but app-level SaaS readiness is not accepted. Before further Release 2 implementation, KISS PM must complete `RELEASE_2_APP_FOUNDATION_RESET`.

The current merged state can show many operational surfaces, but it still opens as a long demo/component/control-surface page. It is not acceptable for investor or product-owner acceptance as a runnable SaaS application.

## 2. What was expected

The expected product state is a simple KISS PM app journey:

```txt
open app -> choose/sign in as demo user -> role landing -> real pages
  -> profile/account -> admin settings -> KPI preview/publish/readback/audit
  -> seeded project Gantt -> resource/portfolio signal -> reload/deep-link/back-forward
  -> read-only denial proof
```

## 3. What actually runs locally

Local runtime was checked on 2026-05-17 using:

```bash
npm run dev:api -- --host 127.0.0.1 --port 4173
$env:VITE_KISS_PM_ALLOW_FIXTURE_AUTH="true"
$env:PW_API_PORT="4173"
npm run dev:web -- --host 127.0.0.1 --port 5173
```

Observed:

- `http://127.0.0.1:5173/` shows a minimal auth guard with `Открыть smoke-shell`.
- `http://127.0.0.1:5173/?testUser=tenant-admin-a` renders a single long shell containing many admin/control/demo surfaces.
- Navigation links are anchors such as `#portfolio-control`, `#gantt-workspace`, `#resource-load-control`, and `#phase-1-placeholder`.
- Direct paths such as `/app/dashboard?testUser=tenant-admin-a` and `/app/settings/kpi-thresholds?testUser=tenant-admin-a` render the same long shell, with no selected route state.
- Hash targets exist, but browser evidence showed targets far below the viewport after render for several surface anchors, so the anchor model is not reliable page/deep-link UX.

## 4. Product gaps

- No normal SaaS login/session flow.
- No product user chooser; the user must know fixture ids such as `tenant-admin-a`.
- No role-based landing dashboard.
- No account/profile menu with avatar, role, tenant, or preferences.
- Admin settings are scattered through demo panels.
- Gantt and control surfaces are not presented as product pages.
- Release 2 evidence proved surface behavior, not app-level product readiness.

## 5. Technical gaps

- `apps/web/src/App.tsx` uses query-param fixture auth via `?testUser=`.
- Routing is not implemented as a route tree.
- Navigation uses anchors and placeholder targets.
- Page selection is not route-derived.
- Direct deep links depend on Vite fallback and render the same shell.
- The web dev server reported port `5173` already in use and started a second server on `5174`; existing local server state may affect manual runs.

## 6. UX/navigation gaps

- The user is dropped into a long stack of surfaces instead of a coherent workflow.
- The left navigation does not create product pages.
- Browser back/forward cannot represent page-level product flow.
- Several nav items point to `#phase-1-placeholder`.
- Hash-based navigation is not acceptable as the Release 2 page model.

## 7. Authentication/session gaps

- Root is an auth guard, not a login/dev-auth page.
- Fixture auth is gated by env plus `?testUser=`.
- The app does not provide safe sign out or switch user in product UI.
- Session state is not represented as a product boundary.

## 8. Routing/page model gaps

Required routes do not exist as meaningful pages:

```txt
/login
/app
/app/dashboard
/app/portfolio
/app/projects
/app/projects/:projectId
/app/projects/:projectId/gantt
/app/resources
/app/kpi
/app/kpi/settings
/app/retrospectives
/app/integrations
/app/settings/*
```

Direct URLs render the same shell rather than page-specific layouts.

## 9. User profile/account gaps

The shell shows a user chip and role chip, but no real account dropdown, avatar, profile page/dialog, preferences shell, sign out, or dev switch-user flow. Text matching may find `Профили доступа`, but that is access-profile administration, not a personal account menu.

## 10. Tenant admin settings gaps

Tenant labels, process templates, custom fields, KPI thresholds, saved views, action availability, integration diagnostics, and configuration overview exist as separate embedded surfaces. They are not organized under a dedicated `/settings` route with settings navigation, shadcn/Radix forms/tables/dialogs/sheets, preview-before-apply, audit/readback, and admin-only guards.

## 11. Demo data / fixture gaps

The app depends on fixture ids and query params. Product-owner flow does not expose reset/readback as a normal product action. Gantt must open from a seeded product route without manual API calls or hidden query knowledge.

## 12. E2E evidence gaps

`E2E-R2-001..010` are valuable control-surface evidence, but they are not sufficient app-readiness evidence when they rely on pre-seeded/test-only component surfaces and do not prove real app navigation, page routes, session boundary, profile/account, settings area, demo reset, seeded Gantt page, and product-owner smoke.

The next required app-readiness scenario is:

```txt
E2E-R2R-001 Product owner smoke:
login/dev-user select -> role landing -> navigate real pages -> open profile/account menu
-> open admin settings -> configure KPI threshold through preview -> publish/readback/audit
-> open seeded project Gantt without manual API seeding -> inspect resource/portfolio signal
-> reload/deep link/back-forward proof -> read-only user denial proof
```

## 13. shadcn/standard UI primitive gaps

Release 2 used custom operational components heavily. For standard app UX, the rule must be stricter:

```txt
Standard app UX = shadcn/Radix primitives.
Domain instrument UX = custom surface, composed from standard primitives where possible.
```

Standard routes, settings, profile, forms, tables, dialogs, sheets, dropdowns, tabs, breadcrumbs, sidebar, avatar, tooltip, toast/sonner, and command palette must use shadcn/Radix/Tailwind primitives by default.

## 14. What existing Release 2 work can be reused

- Operational control-surface primitives.
- Gantt planning surface behavior.
- Capacity matrix/resource-load concepts.
- Portfolio/KPI/retrospective action/audit/readback patterns.
- Tenant configuration preview/publish/readback patterns.
- Existing API/domain command and audit foundations.
- Existing component and E2E evidence as component/control-surface foundation.

## 15. What must be reclassified from release-ready to component/control-surface foundation

The merged Release 2 UI stack must be treated as reusable foundation, not as accepted SaaS app readiness. Old green gates prove operational surfaces and evidence contracts; they do not prove a normal product app.

## 16. Required reset before Release 2 implementation continues

Implement `docs/phases/RELEASE_2_APP_FOUNDATION_RESET.md` and close `R2R-001..R2R-015`, including product-owner smoke E2E, before continuing Release 2 implementation.

## 17. Screenshots / browser evidence

Evidence artifacts:

- `.agent-bus/artifacts/screenshots/release2-app-reset/root.png`
- `.agent-bus/artifacts/screenshots/release2-app-reset/tenant-admin-a.png`
- `.agent-bus/artifacts/screenshots/release2-app-reset/project-manager-a-gantt.png`
- `.agent-bus/artifacts/screenshots/release2-app-reset/resource-manager-a.png`
- `.agent-bus/artifacts/screenshots/release2-app-reset/readonly-observer-a.png`
- `.agent-bus/artifacts/screenshots/release2-app-reset/browser-evidence.json`
- `.agent-bus/artifacts/screenshots/release2-app-reset/route-evidence.json`

Browser evidence summary:

- Root: auth guard only, no user chip, no profile menu.
- Tenant admin / PM / resource / read-only URLs: app shell renders, but as one long page with 200+ test ids and anchor navigation.
- Direct `/app/*` URLs: same shell, no selected route state.
- Console errors: none captured in browser logs during checks.
- Product-relevant blocker: the API dev command recorded `EADDRINUSE` on port `4173` because a server was already running; web dev command found `5173` in use and started `5174`.

## 18. Commands and exit codes

```bash
node scripts/agent-bus-guard.mjs --task R2-RESET-001-product-app-reality-audit-and-foundation-contract --once
```

Initial sandbox run failed because `git status` could not spawn. Escalated rerun passed.

```bash
npm test -- scripts/verify-release2-app-foundation-reset.test.ts
```

RED run failed as expected before verifier/matrix existed. Final run passed after verifier implementation.

```bash
Invoke-WebRequest http://127.0.0.1:4173/health
```

Returned `{"status":"ok","service":"kiss-pm-api"}`.
