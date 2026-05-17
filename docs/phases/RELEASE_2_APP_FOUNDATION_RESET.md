# Release 2 App Foundation Reset

Status: planned reset contract
Type: blocking product-app foundation reset

Release 2 control-surface components are merged, but app-level SaaS readiness is not accepted. Before further Release 2 implementation, KISS PM must complete `RELEASE_2_APP_FOUNDATION_RESET`.

This contract is closed around `R2R-001..R2R-015`. No row is done at contract creation time.

## Product verdict

The app is not acceptable if it opens as a long component catalog, requires fixture ids in URLs, lacks profile/account and settings areas, lacks real routes/deep links, uses query-param login without dev-auth boundary, requires manual Gantt seeding, or passes only stitched surface evidence.

## UI foundation rule

Standard app UX = shadcn/Radix primitives. Domain instrument UX = custom surface, composed from standard primitives where possible.

Use standard primitives for `Button`, `Input`, `Textarea`, `Select`, `Tabs`, `Dialog`, `Sheet`, `DropdownMenu`, `Popover`, `Tooltip`, `Command`, `Table`, DataTable pattern, `Badge`, `Alert`, Toast/Sonner, `Form`, `Calendar`, `Separator`, `Sidebar`, `Breadcrumb`, `Avatar`, and NavigationMenu/app-sidebar patterns.

Custom UI is reserved for Project Gantt planning, WBS grid/timeline sync, Capacity Matrix/resource heatmap, timeline overlays, portfolio control composition, and KPI/action/audit panels where they are domain instruments.

## Required E2E

`E2E-R2R-001 Product owner smoke`:

```txt
login/dev-user select
-> role landing
-> navigate real pages
-> open profile/account menu
-> open admin settings
-> configure KPI threshold through preview
-> publish/readback/audit
-> open seeded project Gantt without manual API seeding
-> inspect resource/portfolio signal
-> reload/deep link/back-forward proof
-> read-only user denial proof
```

`E2E-R2-001..010` are not sufficient app-readiness evidence unless they prove real app navigation, page/session behavior, profile/account, settings, seed/readback, reload/deep links, and permission-denial paths.

## Blocks

### R2R-001 — App routing foundation

- User-facing goal: replace anchor-only navigation with real app routes.
- Current gap: direct paths render the same long shell.
- Owned files/modules: app route tree, route guards, shell navigation.
- Required shadcn/Radix primitives: Sidebar, Breadcrumb, NavigationMenu, Button.
- Required API/domain support: session/tenant readback.
- Required UI behavior: route selection, protected pages, deep-link target pages.
- Acceptance criteria: route, reload/readback, and permission state work on protected pages.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: route checks after fixture reset.
- Non-scope: feature expansion beyond app foundation.
- Done evidence: passing route smoke and matrix evidence.

### R2R-002 — Login/dev-auth/session boundary

- User-facing goal: choose/sign in as a demo user without knowing fixture ids.
- Current gap: `?testUser=` is the session boundary.
- Owned files/modules: login page, dev-auth selector, session state.
- Required shadcn/Radix primitives: Button, Select/Command, Form, Alert, Avatar.
- Required API/domain support: current tenant/user/session readback.
- Required UI behavior: sign in, sign out, switch user in fixture mode.
- Acceptance criteria: route, reload/readback, and permission state survive session changes.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: dev session reset/readback.
- Non-scope: production SSO.
- Done evidence: login/dev-auth smoke.

### R2R-003 — Role-based landing/dashboard

- User-facing goal: land on a role-appropriate operational dashboard.
- Current gap: every user sees the same long surface stack.
- Owned files/modules: dashboard pages and role landing rules.
- Required shadcn/Radix primitives: Card only for repeated items, Button, Badge, Table.
- Required API/domain support: role/access profile readback.
- Required UI behavior: admin, PM, resource manager, and read-only landing states.
- Acceptance criteria: route, reload/readback, permission, and next action are role-specific.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: fixture reset returns default landing.
- Non-scope: BI dashboard.
- Done evidence: role landing smoke.

### R2R-004 — Real page shell and navigation

- User-facing goal: app shell feels like a SaaS product, not a test wall.
- Current gap: sidebar anchors and placeholder targets.
- Owned files/modules: topbar/sidebar, breadcrumbs, selected nav.
- Required shadcn/Radix primitives: Sidebar, Breadcrumb, DropdownMenu, Tooltip, Separator.
- Required API/domain support: tenant/user context.
- Required UI behavior: selected nav follows route; back/forward works.
- Acceptance criteria: route, reload/readback, and permission state are visible per page.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: nav state after reload.
- Non-scope: marketing landing page.
- Done evidence: browser route screenshots and E2E.

### R2R-005 — Demo tenant seed/readback/reset flow

- User-facing goal: reset demo data from product UI and prove readback.
- Current gap: fixture state is hidden in tests/API.
- Owned files/modules: demo reset route/action, readback panels.
- Required shadcn/Radix primitives: Button, Dialog, Alert, Toast/Sonner, Table.
- Required API/domain support: deterministic seed/reset/readback endpoint.
- Required UI behavior: preview/reset/readback with safe confirmation.
- Acceptance criteria: route, reload/readback, permission, and cleanup evidence are deterministic.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: reset returns known demo state.
- Non-scope: production data deletion.
- Done evidence: reset/readback E2E.

### R2R-006 — KPI setup page flow

- User-facing goal: configure KPI threshold through a real product page.
- Current gap: KPI setup is embedded among demo panels.
- Owned files/modules: `/app/kpi/settings`, KPI threshold flow.
- Required shadcn/Radix primitives: Form, Input, Select, Table, Dialog/Sheet, Alert, Badge.
- Required API/domain support: preview/publish/audit/readback.
- Required UI behavior: edit threshold, preview, publish, audit, reload.
- Acceptance criteria: route, reload/readback, permission, preview, and audit are proven.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: threshold resets to seed.
- Non-scope: arbitrary formulas.
- Done evidence: KPI settings E2E.

### R2R-007 — Project/Gantt page flow without manual API seeding

- User-facing goal: open a seeded project Gantt from product navigation.
- Current gap: Gantt is an anchor surface and can require hidden seed knowledge.
- Owned files/modules: `/app/projects/:projectId/gantt`, project selector/readback.
- Required shadcn/Radix primitives: Breadcrumb, Button, Tooltip, Sheet around custom Gantt.
- Required API/domain support: seeded project schedule readback.
- Required UI behavior: open demo project, edit/readonly state, reload.
- Acceptance criteria: route, reload/readback, permission, and no manual API seeding.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: seeded Gantt project exists after reset.
- Non-scope: full MS Project clone.
- Done evidence: seeded Gantt smoke.

### R2R-008 — Resource capacity page flow

- User-facing goal: inspect capacity and overloads on a real `/app/resources` page.
- Current gap: resource surface is embedded in the long page.
- Owned files/modules: resource page, capacity matrix page shell.
- Required shadcn/Radix primitives: Tabs, Table/DataTable, Sheet, Button, Badge.
- Required API/domain support: resource load and overload readback.
- Required UI behavior: open overload, preview action, readonly denial.
- Acceptance criteria: route, reload/readback, permission, and next action are visible.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: load buckets reset/read back.
- Non-scope: automatic leveling.
- Done evidence: resource page E2E.

### R2R-009 — Portfolio/KPI action flow

- User-facing goal: act on portfolio/KPI signals from real pages.
- Current gap: component evidence exists without full app flow.
- Owned files/modules: `/app/portfolio`, `/app/kpi`, action preview/result.
- Required shadcn/Radix primitives: Table/DataTable, Sheet, Dialog, Badge, Alert.
- Required API/domain support: action preview/apply/audit/readback.
- Required UI behavior: signal -> action -> result -> refreshed projection.
- Acceptance criteria: route, reload/readback, permission, and audit are proven.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: signal handling resets.
- Non-scope: passive dashboard.
- Done evidence: portfolio/KPI smoke.

### R2R-010 — Read-only user experience and backend denial proof

- User-facing goal: readonly users understand state and cannot mutate.
- Current gap: prior evidence is split across surfaces.
- Owned files/modules: route guards, disabled reasons, direct denial tests.
- Required shadcn/Radix primitives: Alert, Tooltip, Badge, Button disabled state.
- Required API/domain support: backend/action denial.
- Required UI behavior: disabled reason and useful read-only drilldown.
- Acceptance criteria: route, reload/readback, permission, and backend denial are proven.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: failed mutation does not change state.
- Non-scope: hiding all forbidden UI.
- Done evidence: UI/API denial proof.

### R2R-011 — Product-owner smoke E2E

- User-facing goal: prove the SaaS app journey end to end.
- Current gap: Release 2 green gates checked surfaces, not the app.
- Owned files/modules: `e2e/tests/release2-app-foundation/**`.
- Required shadcn/Radix primitives: all page primitives as encountered.
- Required API/domain support: reset, readback, audit.
- Required UI behavior: complete product-owner smoke journey.
- Acceptance criteria: real routes, reload/readback, permission denial, profile/account, settings, KPI, Gantt, resource, portfolio.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: scenario resets data before/after.
- Non-scope: screenshots-only acceptance.
- Done evidence: E2E command output.

### R2R-012 — Release 2 resume gate

- User-facing goal: prevent false green Release 2 readiness.
- Current gap: current status implies too much readiness.
- Owned files/modules: reset matrix, status docs, verifier.
- Required shadcn/Radix primitives: not applicable except as documented rule.
- Required API/domain support: none beyond evidence refs.
- Required UI behavior: no further R2 implementation until gate passes.
- Acceptance criteria: Release 2 is blocked until all reset rows and product-owner smoke pass.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: final reset evidence bundle.
- Non-scope: accepting component demo as product app.
- Done evidence: matrix all done and verifier passes.

### R2R-013 — User profile/account menu and personal preferences shell

- User-facing goal: user sees account identity and preferences.
- Current gap: only test-user chip is visible.
- Owned files/modules: account dropdown, profile page/dialog, preferences shell.
- Required shadcn/Radix primitives: Avatar, DropdownMenu, Dialog/Sheet, Form, Select, Separator.
- Required API/domain support: user/role/tenant readback; optional preferences placeholder.
- Required UI behavior: avatar/name/current role, profile, tenant/workspace, preferences, sign out/switch.
- Acceptance criteria: route, reload/readback, permission, profile/account/preferences state are clear.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: preferences reset or disabled reason persists.
- Non-scope: complete personal settings engine.
- Done evidence: profile/account E2E.

### R2R-014 — Tenant admin settings area

- User-facing goal: admin settings are one coherent SaaS settings area.
- Current gap: settings are scattered demo panels.
- Owned files/modules: `/app/settings`, settings subroutes.
- Required shadcn/Radix primitives: Sidebar/Tabs, Table/DataTable, Form, Dialog, Sheet, Badge, Alert, Toast/Sonner.
- Required API/domain support: preview/publish/audit/readback for configuration.
- Required UI behavior: users/access, labels, process templates, custom fields, KPI thresholds, saved views, actions, integrations.
- Acceptance criteria: route, reload/readback, permission, settings/admin, shadcn, preview, and audit are proven.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: config reset/readback.
- Non-scope: one-page component pile.
- Done evidence: settings admin E2E.

### R2R-015 — Real app routes/deep links/page layout

- User-facing goal: required app URLs represent pages.
- Current gap: Vite fallback renders same shell everywhere.
- Owned files/modules: `/login`, `/app`, `/app/*`, `/app/settings/*`.
- Required shadcn/Radix primitives: Sidebar, Breadcrumb, NavigationMenu, Tabs.
- Required API/domain support: route guard session/permission readback.
- Required UI behavior: back-forward, direct deep link, reload, selected nav, guarded denial.
- Acceptance criteria: route, deep links, back-forward, reload/readback, route guards, and permission state work.
- Required E2E: `E2E-R2R-001`.
- Cleanup/reset evidence: direct links work after reset.
- Non-scope: anchors as routes.
- Done evidence: deep-link E2E.

## Exit gate

Release 2 implementation may resume only when `R2R-012` is done and `scripts/verify-release2-app-foundation-reset.mjs docs/status/release2-app-foundation-reset-matrix.json` passes against all rows marked done with fresh evidence.
