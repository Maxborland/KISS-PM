# Responsive authenticated traversal evidence

- Date: 2026-07-10 (Asia/Novosibirsk)
- Runtime: web `http://127.0.0.1:3180`, API `http://127.0.0.1:4180`
- Viewports: mobile `390x844` (`isMobile`, `hasTouch`), tablet `768x1024` (`hasTouch`)
- Roles: seeded admin `user-alpha-admin` / Анна Администратор; seeded limited reader `user-alpha-plan-reader-no-resources` / Никита Без Ресурсов
- Overall verdict: **FAIL**. Authenticated route content is broadly usable, but mobile application navigation is absent, the communications route corrupts the tablet sidebar paint, and multiple primary controls miss the 44x44 touch-target QA threshold.

## Environment precondition

The running API initially exposed only one unrelated temporary user through `/api/session/dev-users`; all standard seeded credentials returned `401 invalid_credentials`. The configured dev database was still available on `127.0.0.1:55432`. `pnpm db:seed:dev` was run with that explicit `DATABASE_URL`; the seed implementation is transaction + upsert and does not truncate/delete. The unrelated tenant remained present. Readback then showed the five expected seeded users plus the pre-existing temporary user, and admin/limited-reader login both returned `200`.

## Traversal results

PASS is used only where this run produced a fresh screenshot and a visible outcome.

| Status | Viewport / role | Route and action | Visible outcome and evidence |
|---|---|---|---|
| PASS | 390x844 admin | `/login` fill email/password, submit, redirect to `/dashboard` | Dashboard rendered 13 tasks, 3 open deals, 3 active projects, and 0 won deals; root width stayed `390/390`. [screenshot](responsive/01-390x844-admin-dashboard-after-login.png) |
| PASS | 390x844 limited reader | `/login` -> `/dashboard` | Dashboard rendered one task and three projects while CRM metrics explicitly displayed `нет доступа`; expected CRM API calls returned 403. [screenshot](responsive/01-390x844-plan-reader-no-resources-dashboard-after-login.png) |
| **FAIL** | 390x844 admin + limited reader | Attempt to open application navigation; then open the only visible avatar button | No navigation opener exists. Before avatar click, the only visible button is the avatar. Its menu contains only `Профиль`, `Настройки`, `Выйти`; no work/admin routes are reachable. [screenshot](responsive/02-390x844-admin-avatar-menu-open.png) |
| PASS | 390x844 admin | `/projects`, inspect table, move its horizontal container from `scrollLeft=0` to `530/530` | Three projects rendered; no root-page overflow (`390/390`). The local `overflow-x:auto` table exposes the rightmost plan/demand columns after scroll. [start](responsive/03-390x844-admin-projects.png), [end](responsive/03b-390x844-admin-projects-horizontal-end.png) |
| PASS | 390x844 admin | `/projects/project-vektor-portal`, inspect summary and task table, move horizontal container to `241/241` | Project summary rendered 7 tasks and contract/plan metrics; rightmost assignee/deadline/progress columns became visible after local scroll. [start](responsive/04-390x844-admin-project-detail.png), [end](responsive/04b-390x844-admin-project-detail-horizontal-end.png) |
| PASS | 390x844 admin | `/crm/deals`, inspect Kanban and move board container to `718/718` | Pipeline rendered start and final stages without root-page overflow; final-stage cards were visible at the scroll end. [start](responsive/05-390x844-admin-crm-deals.png), [end](responsive/05b-390x844-admin-crm-deals-horizontal-end.png) |
| PASS | 390x844 admin | `/admin/users`, inspect table and move it to `356/356` | Four tenant-alpha users rendered; rightmost status/action columns remained reachable in the local scroll container. [start](responsive/06-390x844-admin-users-table.png), [end](responsive/06b-390x844-admin-users-horizontal-end.png) |
| PASS | 390x844 admin | `/admin/users`, open create modal; fill unique marker `SLRESP-20260710-A7F3`; cancel with Escape | Modal stayed within the viewport and exposed Email, Name, Role, Position, Password, Create and Cancel. No submit occurred. Authenticated `/api/workspace/users` readback returned `markerMatches=0`, so no cleanup was needed. [empty](responsive/08-390x844-admin-admin-users-create-modal.png), [filled then cancelled](responsive/09-390x844-admin-admin-users-form-filled-cancelled.png) |
| PASS | 768x1024 admin | `/login` -> `/dashboard` | Tablet dashboard and persistent sidebar rendered without clipping. [screenshot](responsive/01b-768x1024-admin-dashboard-viewport.png) |
| PASS | 768x1024 admin | `/projects/project-vektor-portal` | Summary, seven-row task table, tabs and KPI cards rendered in the tablet layout. [screenshot](responsive/10-768x1024-admin-project-detail.png) |
| PASS | 768x1024 admin | `/crm/deals` | Sidebar, pipeline controls, Kanban columns and transition conditions rendered; no root-page overflow was detected. [screenshot](responsive/11-768x1024-admin-crm-deals.png) |
| PASS | 768x1024 admin | `/admin/users`, inspect table; open/fill/cancel create modal | Table and modal were visible; the same unique-marker readback remained zero. [table](responsive/12-768x1024-admin-users-table.png), [modal](responsive/08-768x1024-admin-admin-users-create-modal.png), [filled then cancelled](responsive/09-768x1024-admin-admin-users-form-filled-cancelled.png) |
| **FAIL** | 768x1024 admin | `/communications/channels` | Main channel list/composer renders, but multiple sidebar bands paint solid black and hide the logo/group labels/navigation links. Reproduced in both full-page and viewport-only captures. [viewport](responsive/13b-768x1024-admin-communications-channels-viewport.png), [full page](responsive/13-768x1024-admin-communications-channels.png) |
| PASS | 390x844 limited reader | Direct `/admin/users` | Explicit readable `Администрирование недоступно` state rendered; API access checks returned expected 403 responses. [screenshot](responsive/16-390x844-plan-reader-admin-users-direct.png) |
| **FAIL** | Both widths | Bounding-box audit of visible touch controls | Frequent targets are below the 44x44 QA threshold: avatar `32x32`; `+ Сделка` and `Создать пользователя` height `28`; table action icons `32x28`; modal fields/actions height `35` and close `31x31`; communications `Канал`/`Отправить` height `28`; sidebar links height `34`. Evidence: [mobile CRM](responsive/05-390x844-admin-crm-deals.png), [mobile users](responsive/06-390x844-admin-users-table.png), [mobile modal](responsive/09-390x844-admin-admin-users-form-filled-cancelled.png), [tablet communications](responsive/13b-768x1024-admin-communications-channels-viewport.png). |

## Notes

- Direct URL navigation was required after login because the mobile application navigation control is absent.
- Horizontal overflow checks used real rendered `overflow-x:auto` containers and captured both initial and maximum `scrollLeft` states. A physical finger swipe gesture was not synthesized.
- The first anonymous `/api/auth/me` 401 during each login is expected. Limited-reader 403s matched the visible `нет доступа`/admin-denied states. No unexpected admin route API failures were observed in the traversed rows.
- The unique marker was written only into client-side form fields and cancelled. No product entity was created, changed, deactivated, or deleted.

## Exact untested routes

The following app routes were not traversed in this slice:

`/`, `/register`, `/password-reset`, `/password-reset/confirm`, `/admin`, `/admin/audit`, `/admin/roles`, `/admin/security`, `/agent`, `/calls/:roomId`, `/communications/calls`, `/communications/chat`, `/communications/meetings`, `/communications/notifications`, `/crm/clients`, `/crm/contacts`, `/crm/deals/:id`, `/crm/products`, `/my-work`, `/profile`, `/settings`, `/projects/:id/assignments`, `/projects/:id/baseline`, `/projects/:id/calendars`, `/projects/:id/commits`, `/projects/:id/overview`, `/projects/:id/resources`, `/projects/:id/scenarios`, `/projects/:id/schedule`, `/projects/:id/settings`.

Also untested: mobile `/communications/channels`; tablet project list `/projects`; tablet direct RBAC-denied routes; a physical touch swipe; destructive/persistent create/update/delete flows; real call-room media; browser-console audit.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/lane-responsive-traversal.md
