# Lane 2 - Auth route guards

- Verdict: **PASS**
- Generated: 2026-07-09T21:26:04.840Z
- Runtime: http://127.0.0.1:3180 (API through same-origin /api proxy)
- Command: `E2E_WEB_PORT=3180 E2E_API_PORT=4180 .\node_modules\.bin\playwright.cmd test e2e/full-eval/auth-route-guards.spec.ts --project=chromium --workers=1`
- Rows: 58 total, 58 passed, 0 failed, 0 blocked
- Known working call route: /calls/call-room-a49fd816-7590-437a-bfa6-2dfc810bf0e0
- Mutation scope: UI/API login sessions only; route traversal and all product-data probes are read-only.

## Coverage

- AUTH-ROOT: anonymous `/` -> `/login`; every seeded role `/` -> `/dashboard`.
- AUTH-AUTHED-PUBLIC: five seeded roles across `/login`, `/register`, `/password-reset`, and `/password-reset/confirm`, including reload and identity/tenant readback.
- AUTH-PROTECTED: anonymous traversal of every real protected App Router page. Dynamic routes use known working project, opportunity, and read-only discovered call-room IDs.
- Protected API leak means any non-`/api/auth/*` request emitted while the browser is anonymous. Expected: zero.

## Identity readback (CSV)

```csv
"role","loginStatus","meStatus","userId","email","tenantId","workspaceId","accessProfileId"
"admin","200","200","user-alpha-admin","admin@kiss-pm.local","tenant-alpha","tenant-alpha","access-profile-alpha-admin"
"beta","200","200","user-beta-admin","beta@kiss-pm.local","tenant-beta","tenant-beta","access-profile-beta-admin"
"engineer","200","200","user-alpha-engineer","engineer@kiss-pm.local","tenant-alpha","tenant-alpha","access-profile-alpha-admin"
"planReader","200","200","user-alpha-plan-reader-no-resources","plan-reader-no-resources@kiss-pm.local","tenant-alpha","tenant-alpha","access-profile-plan-reader-no-resources"
"resourceReader","200","200","user-alpha-resource-reader","resource-reader@kiss-pm.local","tenant-alpha","tenant-alpha","access-profile-resource-reader"
```

## Machine-readable route table (CSV)

Required columns are first: `role, route, finalUrl, protectedApiLeakCount, status`. Remaining columns preserve navigation status, readback, reload, and exact failure evidence.

```csv
"role","route","finalUrl","protectedApiLeakCount","status","expectedFinalUrl","reloadFinalUrl","protectedApiRequestCount","navigationStatus","reloadStatus","meStatus","reloadMeStatus","userId","tenantId","error"
"ANON","/","/login","0","PASS","/login","/login","0","/:307 > /login:200","/login:200","401","401","","",""
"ANON","/admin","/login?from=%2Fadmin","0","PASS","/login?from=/admin","/login?from=%2Fadmin","0","/admin:307 > /login?from=%2Fadmin:200","/login?from=%2Fadmin:200","401","401","","",""
"ANON","/admin/audit","/login?from=%2Fadmin%2Faudit","0","PASS","/login?from=/admin/audit","/login?from=%2Fadmin%2Faudit","0","/admin/audit:307 > /login?from=%2Fadmin%2Faudit:200","/login?from=%2Fadmin%2Faudit:200","401","401","","",""
"ANON","/admin/roles","/login?from=%2Fadmin%2Froles","0","PASS","/login?from=/admin/roles","/login?from=%2Fadmin%2Froles","0","/admin/roles:307 > /login?from=%2Fadmin%2Froles:200","/login?from=%2Fadmin%2Froles:200","401","401","","",""
"ANON","/admin/security","/login?from=%2Fadmin%2Fsecurity","0","PASS","/login?from=/admin/security","/login?from=%2Fadmin%2Fsecurity","0","/admin/security:307 > /login?from=%2Fadmin%2Fsecurity:200","/login?from=%2Fadmin%2Fsecurity:200","401","401","","",""
"ANON","/admin/users","/login?from=%2Fadmin%2Fusers","0","PASS","/login?from=/admin/users","/login?from=%2Fadmin%2Fusers","0","/admin/users:307 > /login?from=%2Fadmin%2Fusers:200","/login?from=%2Fadmin%2Fusers:200","401","401","","",""
"ANON","/agent","/login?from=%2Fagent","0","PASS","/login?from=/agent","/login?from=%2Fagent","0","/agent:307 > /login?from=%2Fagent:200","/login?from=%2Fagent:200","401","401","","",""
"ANON","/communications/calls","/login?from=%2Fcommunications%2Fcalls","0","PASS","/login?from=/communications/calls","/login?from=%2Fcommunications%2Fcalls","0","/communications/calls:307 > /login?from=%2Fcommunications%2Fcalls:200","/login?from=%2Fcommunications%2Fcalls:200","401","401","","",""
"ANON","/communications/channels","/login?from=%2Fcommunications%2Fchannels","0","PASS","/login?from=/communications/channels","/login?from=%2Fcommunications%2Fchannels","0","/communications/channels:307 > /login?from=%2Fcommunications%2Fchannels:200","/login?from=%2Fcommunications%2Fchannels:200","401","401","","",""
"ANON","/communications/chat","/login?from=%2Fcommunications%2Fchat","0","PASS","/login?from=/communications/chat","/login?from=%2Fcommunications%2Fchat","0","/communications/chat:307 > /login?from=%2Fcommunications%2Fchat:200","/login?from=%2Fcommunications%2Fchat:200","401","401","","",""
"ANON","/communications/meetings","/login?from=%2Fcommunications%2Fmeetings","0","PASS","/login?from=/communications/meetings","/login?from=%2Fcommunications%2Fmeetings","0","/communications/meetings:307 > /login?from=%2Fcommunications%2Fmeetings:200","/login?from=%2Fcommunications%2Fmeetings:200","401","401","","",""
"ANON","/communications/notifications","/login?from=%2Fcommunications%2Fnotifications","0","PASS","/login?from=/communications/notifications","/login?from=%2Fcommunications%2Fnotifications","0","/communications/notifications:307 > /login?from=%2Fcommunications%2Fnotifications:200","/login?from=%2Fcommunications%2Fnotifications:200","401","401","","",""
"ANON","/crm/clients","/login?from=%2Fcrm%2Fclients","0","PASS","/login?from=/crm/clients","/login?from=%2Fcrm%2Fclients","0","/crm/clients:307 > /login?from=%2Fcrm%2Fclients:200","/login?from=%2Fcrm%2Fclients:200","401","401","","",""
"ANON","/crm/contacts","/login?from=%2Fcrm%2Fcontacts","0","PASS","/login?from=/crm/contacts","/login?from=%2Fcrm%2Fcontacts","0","/crm/contacts:307 > /login?from=%2Fcrm%2Fcontacts:200","/login?from=%2Fcrm%2Fcontacts:200","401","401","","",""
"ANON","/crm/deals","/login?from=%2Fcrm%2Fdeals","0","PASS","/login?from=/crm/deals","/login?from=%2Fcrm%2Fdeals","0","/crm/deals:307 > /login?from=%2Fcrm%2Fdeals:200","/login?from=%2Fcrm%2Fdeals:200","401","401","","",""
"ANON","/crm/deals/opportunity-vektor-portal","/login?from=%2Fcrm%2Fdeals%2Fopportunity-vektor-portal","0","PASS","/login?from=/crm/deals/opportunity-vektor-portal","/login?from=%2Fcrm%2Fdeals%2Fopportunity-vektor-portal","0","/crm/deals/opportunity-vektor-portal:307 > /login?from=%2Fcrm%2Fdeals%2Fopportunity-vektor-portal:200","/login?from=%2Fcrm%2Fdeals%2Fopportunity-vektor-portal:200","401","401","","",""
"ANON","/crm/products","/login?from=%2Fcrm%2Fproducts","0","PASS","/login?from=/crm/products","/login?from=%2Fcrm%2Fproducts","0","/crm/products:307 > /login?from=%2Fcrm%2Fproducts:200","/login?from=%2Fcrm%2Fproducts:200","401","401","","",""
"ANON","/dashboard","/login?from=%2Fdashboard","0","PASS","/login?from=/dashboard","/login?from=%2Fdashboard","0","/dashboard:307 > /login?from=%2Fdashboard:200","/login?from=%2Fdashboard:200","401","401","","",""
"ANON","/my-work","/login?from=%2Fmy-work","0","PASS","/login?from=/my-work","/login?from=%2Fmy-work","0","/my-work:307 > /login?from=%2Fmy-work:200","/login?from=%2Fmy-work:200","401","401","","",""
"ANON","/profile","/login?from=%2Fprofile","0","PASS","/login?from=/profile","/login?from=%2Fprofile","0","/profile:307 > /login?from=%2Fprofile:200","/login?from=%2Fprofile:200","401","401","","",""
"ANON","/projects","/login?from=%2Fprojects","0","PASS","/login?from=/projects","/login?from=%2Fprojects","0","/projects:307 > /login?from=%2Fprojects:200","/login?from=%2Fprojects:200","401","401","","",""
"ANON","/projects/project-vektor-portal","/login?from=%2Fprojects%2Fproject-vektor-portal","0","PASS","/login?from=/projects/project-vektor-portal","/login?from=%2Fprojects%2Fproject-vektor-portal","0","/projects/project-vektor-portal:307 > /login?from=%2Fprojects%2Fproject-vektor-portal:200","/login?from=%2Fprojects%2Fproject-vektor-portal:200","401","401","","",""
"ANON","/projects/project-vektor-portal/assignments","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fassignments","0","PASS","/login?from=/projects/project-vektor-portal/assignments","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fassignments","0","/projects/project-vektor-portal/assignments:307 > /login?from=%2Fprojects%2Fproject-vektor-portal%2Fassignments:200","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fassignments:200","401","401","","",""
"ANON","/projects/project-vektor-portal/baseline","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fbaseline","0","PASS","/login?from=/projects/project-vektor-portal/baseline","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fbaseline","0","/projects/project-vektor-portal/baseline:307 > /login?from=%2Fprojects%2Fproject-vektor-portal%2Fbaseline:200","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fbaseline:200","401","401","","",""
"ANON","/projects/project-vektor-portal/calendars","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fcalendars","0","PASS","/login?from=/projects/project-vektor-portal/calendars","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fcalendars","0","/projects/project-vektor-portal/calendars:307 > /login?from=%2Fprojects%2Fproject-vektor-portal%2Fcalendars:200","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fcalendars:200","401","401","","",""
"ANON","/projects/project-vektor-portal/commits","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fcommits","0","PASS","/login?from=/projects/project-vektor-portal/commits","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fcommits","0","/projects/project-vektor-portal/commits:307 > /login?from=%2Fprojects%2Fproject-vektor-portal%2Fcommits:200","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fcommits:200","401","401","","",""
"ANON","/projects/project-vektor-portal/overview","/login?from=%2Fprojects%2Fproject-vektor-portal%2Foverview","0","PASS","/login?from=/projects/project-vektor-portal/overview","/login?from=%2Fprojects%2Fproject-vektor-portal%2Foverview","0","/projects/project-vektor-portal/overview:307 > /login?from=%2Fprojects%2Fproject-vektor-portal%2Foverview:200","/login?from=%2Fprojects%2Fproject-vektor-portal%2Foverview:200","401","401","","",""
"ANON","/projects/project-vektor-portal/resources","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fresources","0","PASS","/login?from=/projects/project-vektor-portal/resources","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fresources","0","/projects/project-vektor-portal/resources:307 > /login?from=%2Fprojects%2Fproject-vektor-portal%2Fresources:200","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fresources:200","401","401","","",""
"ANON","/projects/project-vektor-portal/scenarios","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fscenarios","0","PASS","/login?from=/projects/project-vektor-portal/scenarios","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fscenarios","0","/projects/project-vektor-portal/scenarios:307 > /login?from=%2Fprojects%2Fproject-vektor-portal%2Fscenarios:200","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fscenarios:200","401","401","","",""
"ANON","/projects/project-vektor-portal/schedule","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fschedule","0","PASS","/login?from=/projects/project-vektor-portal/schedule","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fschedule","0","/projects/project-vektor-portal/schedule:307 > /login?from=%2Fprojects%2Fproject-vektor-portal%2Fschedule:200","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fschedule:200","401","401","","",""
"ANON","/projects/project-vektor-portal/settings","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fsettings","0","PASS","/login?from=/projects/project-vektor-portal/settings","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fsettings","0","/projects/project-vektor-portal/settings:307 > /login?from=%2Fprojects%2Fproject-vektor-portal%2Fsettings:200","/login?from=%2Fprojects%2Fproject-vektor-portal%2Fsettings:200","401","401","","",""
"ANON","/settings","/login?from=%2Fsettings","0","PASS","/login?from=/settings","/login?from=%2Fsettings","0","/settings:307 > /login?from=%2Fsettings:200","/login?from=%2Fsettings:200","401","401","","",""
"ANON","/calls/call-room-a49fd816-7590-437a-bfa6-2dfc810bf0e0","/login?from=%2Fcalls%2Fcall-room-a49fd816-7590-437a-bfa6-2dfc810bf0e0","0","PASS","/login?from=/calls/call-room-a49fd816-7590-437a-bfa6-2dfc810bf0e0","/login?from=%2Fcalls%2Fcall-room-a49fd816-7590-437a-bfa6-2dfc810bf0e0","0","/calls/call-room-a49fd816-7590-437a-bfa6-2dfc810bf0e0:307 > /login?from=%2Fcalls%2Fcall-room-a49fd816-7590-437a-bfa6-2dfc810bf0e0:200","/login?from=%2Fcalls%2Fcall-room-a49fd816-7590-437a-bfa6-2dfc810bf0e0:200","401","401","","",""
"admin","/","/dashboard","0","PASS","/dashboard","/dashboard","22","/:307 > /dashboard:200","/dashboard:200","200","200","user-alpha-admin","tenant-alpha",""
"admin","/login","/dashboard","0","PASS","/dashboard","/dashboard","33","/login:200","/dashboard:200","200","200","user-alpha-admin","tenant-alpha",""
"admin","/register","/dashboard","0","PASS","/dashboard","/dashboard","33","/register:200","/dashboard:200","200","200","user-alpha-admin","tenant-alpha",""
"admin","/password-reset","/password-reset","0","PASS","/password-reset","/password-reset","0","/password-reset:200","/password-reset:200","200","200","user-alpha-admin","tenant-alpha",""
"admin","/password-reset/confirm","/password-reset/confirm","0","PASS","/password-reset/confirm","/password-reset/confirm","0","/password-reset/confirm:200","/password-reset/confirm:200","200","200","user-alpha-admin","tenant-alpha",""
"beta","/","/dashboard","0","PASS","/dashboard","/dashboard","20","/:307 > /dashboard:200","/dashboard:200","200","200","user-beta-admin","tenant-beta",""
"beta","/login","/dashboard","0","PASS","/dashboard","/dashboard","30","/login:200","/dashboard:200","200","200","user-beta-admin","tenant-beta",""
"beta","/register","/dashboard","0","PASS","/dashboard","/dashboard","30","/register:200","/dashboard:200","200","200","user-beta-admin","tenant-beta",""
"beta","/password-reset","/password-reset","0","PASS","/password-reset","/password-reset","0","/password-reset:200","/password-reset:200","200","200","user-beta-admin","tenant-beta",""
"beta","/password-reset/confirm","/password-reset/confirm","0","PASS","/password-reset/confirm","/password-reset/confirm","0","/password-reset/confirm:200","/password-reset/confirm:200","200","200","user-beta-admin","tenant-beta",""
"engineer","/","/dashboard","0","PASS","/dashboard","/dashboard","22","/:307 > /dashboard:200","/dashboard:200","200","200","user-alpha-engineer","tenant-alpha",""
"engineer","/login","/dashboard","0","PASS","/dashboard","/dashboard","33","/login:200","/dashboard:200","200","200","user-alpha-engineer","tenant-alpha",""
"engineer","/register","/dashboard","0","PASS","/dashboard","/dashboard","33","/register:200","/dashboard:200","200","200","user-alpha-engineer","tenant-alpha",""
"engineer","/password-reset","/password-reset","0","PASS","/password-reset","/password-reset","0","/password-reset:200","/password-reset:200","200","200","user-alpha-engineer","tenant-alpha",""
"engineer","/password-reset/confirm","/password-reset/confirm","0","PASS","/password-reset/confirm","/password-reset/confirm","0","/password-reset/confirm:200","/password-reset/confirm:200","200","200","user-alpha-engineer","tenant-alpha",""
"planReader","/","/dashboard","0","PASS","/dashboard","/dashboard","18","/:307 > /dashboard:200","/dashboard:200","200","200","user-alpha-plan-reader-no-resources","tenant-alpha",""
"planReader","/login","/dashboard","0","PASS","/dashboard","/dashboard","27","/login:200","/dashboard:200","200","200","user-alpha-plan-reader-no-resources","tenant-alpha",""
"planReader","/register","/dashboard","0","PASS","/dashboard","/dashboard","27","/register:200","/dashboard:200","200","200","user-alpha-plan-reader-no-resources","tenant-alpha",""
"planReader","/password-reset","/password-reset","0","PASS","/password-reset","/password-reset","0","/password-reset:200","/password-reset:200","200","200","user-alpha-plan-reader-no-resources","tenant-alpha",""
"planReader","/password-reset/confirm","/password-reset/confirm","0","PASS","/password-reset/confirm","/password-reset/confirm","0","/password-reset/confirm:200","/password-reset/confirm:200","200","200","user-alpha-plan-reader-no-resources","tenant-alpha",""
"resourceReader","/","/dashboard","0","PASS","/dashboard","/dashboard","18","/:307 > /dashboard:200","/dashboard:200","200","200","user-alpha-resource-reader","tenant-alpha",""
"resourceReader","/login","/dashboard","0","PASS","/dashboard","/dashboard","27","/login:200","/dashboard:200","200","200","user-alpha-resource-reader","tenant-alpha",""
"resourceReader","/register","/dashboard","0","PASS","/dashboard","/dashboard","27","/register:200","/dashboard:200","200","200","user-alpha-resource-reader","tenant-alpha",""
"resourceReader","/password-reset","/password-reset","0","PASS","/password-reset","/password-reset","0","/password-reset:200","/password-reset:200","200","200","user-alpha-resource-reader","tenant-alpha",""
"resourceReader","/password-reset/confirm","/password-reset/confirm","0","PASS","/password-reset/confirm","/password-reset/confirm","0","/password-reset/confirm:200","/password-reset/confirm:200","200","200","user-alpha-resource-reader","tenant-alpha",""
```

## Screenshots

- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/anon-root.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/anon-crm-deals-opportunity-vektor-portal.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/anon-dashboard.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/anon-projects-project-vektor-portal-schedule.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/anon-calls-call-room-a49fd816-7590-437a-bfa6-2dfc810bf0e0.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/admin-root.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/admin-password-reset.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/admin-password-reset-confirm.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/beta-root.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/beta-password-reset.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/beta-password-reset-confirm.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/engineer-root.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/engineer-password-reset.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/engineer-password-reset-confirm.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/planReader-root.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/planReader-password-reset.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/planReader-password-reset-confirm.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/resourceReader-root.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/resourceReader-password-reset.png`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/resourceReader-password-reset-confirm.png`

## Failures

- None.
