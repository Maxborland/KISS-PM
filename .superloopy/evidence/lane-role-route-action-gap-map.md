# Full Product Evaluation: role x route x action x state gap map

Generated: 2026-07-10
Mode: read-only navigator; no browser run and no product/reconciliation/evidence edits
Map verification: **PASS** (all discovered current routes and test personas are accounted for; every non-covered atom below has an executable action/state and evidence requirement)
Full Product Evaluation clean-pass: **NOT ACHIEVED** (`RISK-FULL-BROWSER-TRAVERSAL` remains open)

## Source of truth and precedence

1. Current route structure: CodeGraph after `codegraph sync`, filtered to `apps/web/src/app/**/page.tsx` (37 page files), plus current `proxy.ts`, `workspace-shell.tsx`, `admin-index-redirect.tsx`, and `scripts/seed-dev.ts`.
2. Current-truth status: `docs/qa/full-eval/reconciliation-matrix-2026-07-07.json` and `reconciliation-2026-07-07.md`.
3. Literal action/state inventory: the six files under `docs/qa/full-eval/inventory/` (334 rows; 152 rows were historically non-pass). Historical failures are test ideas, not current-open bugs unless fresh evidence reconfirms them.
4. Fresh browser evidence dated 2026-07-07 through 2026-07-09, including the untracked LiveKit reconnect artifact. API/unit-only evidence narrows an action but does not count as literal browser coverage.

Evidence aliases used below:

| Alias | Artifact |
|---|---|
| `E-CORE` | `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-full-browser-core-traversal-2026-07-07.json` |
| `E-AUTH` | `docs/qa/full-eval/evidence/reconciliation-2026-07-07/auth-shell-browser-2026-07-07.json` and `auth-shell-extra-browser-2026-07-07.json` |
| `E-PROFILE` | `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-shell-11-profile-after-fix-browser-2026-07-07.json` |
| `E-ADMIN` | `docs/qa/full-eval/evidence/browser-admin-direct-denied-readable-2026-07-08/risk-full-browser-admin-direct-denied-readable-2026-07-08.json` |
| `E-COMMS` | `docs/qa/full-eval/evidence/browser-comms-admin-readonly-q3m9-2026-07-08/admin-communications-readonly-traversal-2026-07-08.json` |
| `E-CRM-RO` | `docs/qa/full-eval/evidence/browser-crm-readonly-write-denied-2026-07-08/risk-full-browser-traversal-crm-readonly-write-denied-2026-07-08.json` |
| `E-CRM-LIM` | `docs/qa/full-eval/evidence/browser-limited-crm-write-denied-2026-07-08/risk-full-browser-limited-crm-write-denied-2026-07-08.json` |
| `E-AGENT` | the four `browser-agent-*-2026-07-08` JSON artifacts plus `agent-tools-per-role-2026-07-08/risk-agent-per-role-tools-matrix-2026-07-08.json` |
| `E-MEDIA` | `browser-media-livekit-self-hosted-2026-07-08`, `browser-media-livekit-multiuser-2026-07-08`, and `browser-media-livekit-physical-camera-2026-07-09` JSON artifacts |
| `E-RECONNECT` | `docs/qa/full-eval/evidence/browser-media-livekit-reconnect-2026-07-09/risk-media-livekit-reconnect-2026-07-09.json` (failed before active call; no screenshots) |
| `E-RESET` | `docs/qa/full-eval/evidence/auth-email-reset-live-delivery-2026-07-08/risk-auth-email-reset-live-delivery-2026-07-08.json` (real SMTP/API, not full browser) |
| `E-MATRIX` | `docs/qa/full-eval/reconciliation-matrix-2026-07-07.json` |

## Roles/personas

| Key | Persona | Discovery/accounting |
|---|---|---|
| `ANON` | no session | Runbook persona; public and redirect behavior. |
| `AADM` | alpha admin (`admin@kiss-pm.local`) | Seeded full tenant-admin profile. `tenant-admin-control` in `E-ADMIN` is this control shape. |
| `EADM` | alpha engineer (`engineer@kiss-pm.local`) | Separate actor/project identity, but current seed assigns `access-profile-alpha-admin` (61 permissions). This conflicts with runbook wording "limited admin" and must not be treated as a lower-privilege role. |
| `PLAN` | alpha plan reader, no resources | Seeded permissions: `tenant.projects.read`, `tenant.project_plan.read`. |
| `RES` | alpha resource reader | Seeded permission: `tenant.project_resources.read`. |
| `BADM` | beta admin (`beta@kiss-pm.local`) | Full admin in tenant-beta; required isolation/empty-state persona. |
| `LPR` | ephemeral limited `profile.read` user | Created by `E-CORE`; not a stable seed. Accounted only where evidence names it. |
| `CRMRO` | ephemeral CRM read-only profile | Created for `E-CRM-RO`; not a stable seed. |
| `SECRO` | security-readonly profile | Mentioned as missing in `E-ADMIN`; no seeded login exists, so browser execution is blocked until a fixture is created outside this read-only lane. |

Product roles are permission bundles, not a closed enum. Assignment roles (`executor`, `controller`, etc.) and channel/meeting roles are domain data, not login personas, and are exercised as action variants rather than added to the route Cartesian product.

## Route inventory ambiguities

- CodeGraph reports 37 current `page.tsx` routes. This map uses those routes, not stale sidebar text.
- `/` has a static source page, but current `proxy.ts` intercepts it and redirects to `/login` or `/dashboard`; the static page is normally unreachable.
- `/admin` is a real page with a client-side permission-based redirect, not a content surface. It may land on users, roles, security, or audit.
- `/projects/[id]` is its own project-card surface; it is not an alias of `/projects/[id]/overview`.
- The projects inventory uses shorthand `/schedule`, `/resources`, `/assignments`, etc. These are normalized here to `/projects/[id]/...`.
- Historical `/resources` and `/kpi` sidebar targets have no current App Router page. They are excluded from the 37 routes; direct navigation belongs to not-found regression, not route coverage.
- Dynamic fixtures must be recorded in evidence (`project-vektor-portal`, a real deal id, and a created call room id). A literal `[id]` URL is not executable evidence.
- `not-found.tsx`, `error.tsx`, and Storybook-only shell chrome are states, not routes. They are covered by state lanes `STATE-01..03`.

## Complete route x canonical-role accounting

Legend: `C` = covered for the named load/access atom by fresh browser evidence; `P` = partial current evidence, with remaining actions assigned below; `M` = missing literal browser evidence; `B` = fixture/provider blocked. A `C` never implies that every action on the route is covered.

| Route | ANON | AADM | EADM | PLAN | RES | BADM | Primary remaining lane |
|---|---:|---:|---:|---:|---:|---:|---|
| `/` | C | C | M | M | M | M | `AUTH-ROOT` |
| `/login` | C | C | C | C | C | P | `AUTH-LOGIN` |
| `/register` | P | M | M | M | M | M | `AUTH-REGISTER` |
| `/password-reset` | P | M | M | M | M | M | `AUTH-RESET` |
| `/password-reset/confirm` | P | M | M | M | M | M | `AUTH-RESET` |
| `/dashboard` | M | C | M | P | P | M | `SHELL-DASH` |
| `/my-work` | M | P | M | M | M | M | `SHELL-MYWORK` |
| `/settings` | M | M | M | M | M | M | `SHELL-SETTINGS` |
| `/profile` | M | C | M | C | M | M | `SHELL-PROFILE` |
| `/agent` | C | C | P | P | P | P | `AGENT-ROLE` |
| `/projects` | M | M | M | M | M | M | `PROJ-LIST` |
| `/projects/[id]` | M | M | M | M | M | M | `PROJ-DETAIL` |
| `/projects/[id]/overview` | M | P | M | M | M | M | `PROJ-OVERVIEW` |
| `/projects/[id]/schedule` | M | M | M | M | M | M | `PROJ-SCHEDULE-*` |
| `/projects/[id]/resources` | M | M | M | M | M | M | `PROJ-RESOURCE` |
| `/projects/[id]/assignments` | M | M | M | M | M | M | `PROJ-ASSIGN` |
| `/projects/[id]/calendars` | M | M | M | M | M | M | `PROJ-CALENDAR` |
| `/projects/[id]/scenarios` | M | M | M | M | M | M | `PROJ-SCENARIO` |
| `/projects/[id]/baseline` | M | P | M | M | M | M | `PROJ-BASELINE` |
| `/projects/[id]/commits` | M | M | M | M | M | M | `PROJ-COMMIT` |
| `/projects/[id]/settings` | M | M | M | M | M | M | `PROJ-SETTINGS` |
| `/crm/clients` | M | C | M | M | M | M | `CRM-MASTER` |
| `/crm/contacts` | M | C | M | M | M | M | `CRM-MASTER` |
| `/crm/products` | M | C | M | M | M | M | `CRM-MASTER` |
| `/crm/deals` | M | C | M | M | M | M | `CRM-DEALS` |
| `/crm/deals/[id]` | M | P | M | M | M | M | `CRM-DEAL` |
| `/communications/channels` | M | P | M | M | M | M | `COMMS-CHANNEL` |
| `/communications/chat` | M | P | M | M | M | M | `COMMS-CHAT` |
| `/communications/meetings` | M | P | M | M | M | M | `COMMS-MEETING` |
| `/communications/notifications` | M | P | M | M | M | M | `COMMS-NOTIFY` |
| `/communications/calls` | M | P | M | M | M | M | `MEDIA-LIST` |
| `/calls/[roomId]` | M | P | C | M | M | M | `MEDIA-RUNTIME-*` |
| `/admin` | M | C | M | C | C | M | `ADMIN-INDEX` |
| `/admin/users` | M | C | M | C | C | M | `ADMIN-USERS` |
| `/admin/roles` | M | C | M | C | C | M | `ADMIN-ROLES` |
| `/admin/security` | M | C | M | C | C | M | `ADMIN-SECURITY` |
| `/admin/audit` | M | C | M | C | C | M | `ADMIN-AUDIT` |

Auxiliary persona accounting: `LPR` is covered only for login, dashboard/restricted shell, direct `/crm/deals`, and `/admin/users` in `E-CORE`/`E-CRM-LIM`; all other routes are missing. `CRMRO` is covered only for login plus `/crm/deals` kanban/list/forecast and denied writes in `E-CRM-RO`; all other routes are missing. `SECRO` is blocked on every protected route because no login fixture exists. These bounded profiles should not silently replace the six canonical personas.

## Covered action/state atoms

| Role | Route | Action/state | Current evidence | Status | Suggested independent execution lane |
|---|---|---|---|---|---|
| `ANON` | `/`, `/agent` | Direct navigation redirects to `/login` with correct return path. | `E-AUTH` | covered | regression-only `auth-anon-redirect` |
| `AADM` | `/login` -> `/dashboard` | UI login succeeds and establishes session. | `E-CORE`, `E-COMMS` | covered | regression-only `auth-admin-login` |
| `AADM` | `/dashboard`, `/crm/{deals,clients,contacts,products}`, `/admin/users` | Route load/headings and core shell hrefs. | `E-CORE` | covered | regression-only `admin-core-read` |
| `AADM` | `/crm/deals` | Stage update through UI, API readback, reload persistence, kanban readback. | `E-CORE` | covered | regression-only `crm-stage-persist` |
| `LPR` | `/dashboard`, `/crm/deals`, `/admin/users` | Restricted navigation and readable forbidden/403 state. | `E-CORE`, `E-CRM-LIM` | covered | regression-only `limited-core-deny` |
| `CRMRO` | `/crm/deals` | Kanban/list/forecast read; no drag/write affordance; direct create/stage writes 403 with unchanged readback. | `E-CRM-RO` | covered | regression-only `crm-readonly-deny` |
| `AADM` | `/profile` | Editable state and dirty-save enablement. | `E-PROFILE` | covered | regression-only `profile-admin-edit` |
| `PLAN` | `/profile` | Inputs/theme/save disabled with explicit permission warning. | `E-PROFILE` | covered | regression-only `profile-plan-deny` |
| `PLAN`, `RES` | `/admin`, `/admin/{users,roles,security,audit}` | Direct routes settle to readable denial without raw error; shell hides admin entry. | `E-ADMIN` | covered | regression-only `admin-seeded-deny` |
| `AADM` | `/admin`, `/admin/{users,roles,security,audit}` | Index redirect and route loads without raw error. | `E-ADMIN` | covered | regression-only `admin-route-load` |
| `AADM` | `/communications/{channels,chat,meetings,calls,notifications}` | Read-only route load with screenshot and route-specific 200 network evidence. | `E-COMMS` | covered | regression-only `comms-admin-read` |
| `AADM` | `/agent` | Live OpenRouter proposal/apply/readback for task comment, CRM client, and communication channel; clear no-provider degraded state. | `E-AGENT` | covered | regression-only `agent-admin-live` |
| `EADM` | `/calls/[roomId]` | Two-user LiveKit join, remote participant, leave/rejoin/reload, synthetic audio/video publication. | `E-MEDIA` | covered | regression-only `media-multiuser` |
| `AADM` | `/calls/[roomId]` | LiveKit active stage and microphone publication; camera failure degrades to camera-off without dropping call. | `E-MEDIA` | covered | regression-only `media-admin-active` |
| all five seeded users | `/agent` backend tool catalog | Per-role `/agent/tools` allowed/denied matrix. This is API evidence only. | `E-AGENT` | covered | prerequisite-only `agent-tools-api` |
| `ANON` | `/password-reset*` external flow | Real SMTP delivery, token confirm, old/new login, reused-token policy. This is API/mail evidence only. | `E-RESET` | covered | prerequisite-only `auth-reset-provider` |

## Missing and blocked executable atoms

Every row is independently assignable. A passing artifact must name role credentials/profile, exact URL/fixture ids, browser + viewport, ordered steps, expected/actual, screenshot(s), relevant request/response statuses, console errors, and persistence/unchanged readback for writes/denials.

| ID | Role | Route | Concrete browser action/state | Current evidence | Status | Suggested independent execution lane / required evidence |
|---|---|---|---|---|---|---|
| `AUTH-ROOT` | `EADM`, `PLAN`, `RES`, `BADM` | `/` | Navigate with a valid session; assert final `/dashboard`, no static design-v3 page, and tenant/user identity remains correct. | Only generic logged-in root in `E-AUTH`. | missing | `auth-root-personas`: per-persona URL trace + screenshot + `/api/auth/me`. |
| `AUTH-LOGIN` | `ANON`, `BADM` | `/login` | Exercise invalid email, invalid password, rate-limit message, password reveal, Enter submit, success redirect, refresh, logout, and retry after injected `/api/auth/me` 5xx. | Happy login covered; inventory error/retry and beta UI not fresh. | missing | `auth-login-edge`: DOM/a11y states, network statuses, final URLs, screenshot per state. |
| `AUTH-REGISTER` | `ANON` | `/register` | Register unique user; validate empty/invalid/duplicate inputs; verify success redirect/session and login link; refresh readback. | Real register exists only in provider/API chain; historical browser inventory is stale. | missing | `auth-register-browser`: POST + `/me` + duplicate conflict + screenshots. |
| `AUTH-AUTHED-PUBLIC` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/login`, `/register`, `/password-reset`, `/password-reset/confirm` | Directly open each public auth route with a live session; record intended redirect or explicit authenticated state and ensure no accidental registration/reset. | Not a fresh per-role matrix. | missing | `auth-authenticated-public`: one isolated context per persona, URL/DOM/network transcript. |
| `AUTH-RESET` | `ANON` | `/password-reset`, `/password-reset/confirm` | Request through UI, follow delivered link in browser, confirm password, click login CTA, sign in with new password; repeat token; invalid/expired token; request/confirm 5xx retry. | `E-RESET` proves provider/API, not end-to-end browser mechanics. | missing | `auth-reset-browser`: mailbox/log token provenance + screenshots + old/new login statuses. |
| `AUTH-PROTECTED` | `ANON` | every protected route in the 32-row list above | Iterate each exact route (with real ids for dynamic routes); assert `/login?from=<encoded pathname>` before protected UI/API data appears. | `/agent` and representative routes only. | missing | `auth-anon-all-routes`: machine JSON with one row per exact URL, final URL, screenshot hash, protected API count. |
| `AUTH-LOGOUT` | `EADM`, `PLAN`, `RES`, `BADM` | any protected route + `/profile` | Use user menu logout; assert cookie invalidation, `/login`, back/refresh cannot restore protected data, then re-login. | Admin/profile loopback covered only. | missing | `auth-logout-personas`: network logout + `/me` 401 + back-navigation screenshot. |
| `SHELL-NAV` | all six canonical personas | all protected routes | Verify settled permission-aware sidebar, active item, real href navigation, global search result navigation, avatar identity, profile/logout menu. | Core hrefs and admin-link hiding are partial. | missing | `shell-desktop-role-nav`: per-role nav snapshot + click URLs + search network/result screenshot. |
| `SHELL-MOBILE` | all six canonical personas | representative protected route per domain | At 390x844 open/close drawer by button/scrim/Escape, navigate, rotate/resize, ensure no overlap or trapped focus. | Matrix explicitly says no mobile/responsive traversal. | missing | `shell-mobile-role-nav`: screenshots before/open/after + focus/viewport log. |
| `SHELL-DASH` | `ANON`, `EADM`, `PLAN`, `RES`, `BADM` | `/dashboard` | Assert role-correct full/partial/forbidden dashboard, KPI values, empty beta state, and no cross-tenant alpha data; inject one source 5xx and retry. | Admin load; PLAN/RES only shell/admin-link observations. | missing | `dashboard-role-state`: API fixtures + KPI assertions + 403/empty/error screenshots. |
| `SHELL-MYWORK` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/my-work` | Verify role-specific rows/names/project labels, filters/tabs, task status change if allowed, no write controls if denied, empty beta, 5xx retry, reload persistence. | Agent readback is not route coverage. | missing | `mywork-role-actions`: screenshots + PATCH/403 + task/activity readback. |
| `SHELL-SETTINGS` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/settings` | Load settings; exercise allowed save(s), denied read/write state, dirty/cancel/success/reload, invalid input, 409/5xx retry, beta isolation. | No fresh literal browser evidence. | missing | `workspace-settings-role`: write/deny network + audit/readback + screenshots. |
| `SHELL-PROFILE` | `EADM`, `RES`, `BADM` | `/profile` | Verify edit permission shape; save name/contact/theme/accent; clear nullable fields; invalid hex; reload application of theme; 5xx retry. | Admin and PLAN permission states only. | missing | `profile-remaining-personas`: PATCH/403 + `/me` readback + DOM theme screenshot. |
| `PROJ-LIST` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects` | Load/search/sort supported controls; open project; create project where allowed; denied/empty beta states; refresh and tenant isolation. | Source fix/tests only; no fresh browser route traversal. | missing | `projects-list-role`: route screenshots + create/readback or 403 + empty beta. |
| `PROJ-DETAIL` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]` | Open real id, switch project and assert URL/data; open invalid/cross-tenant id and assert not-found/no fallback; verify assignment-sensitive identity. | No fresh literal browser evidence. | missing | `project-detail-routing`: URL before/after + project GETs + invalid/cross-tenant screenshots. |
| `PROJ-OVERVIEW` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]/overview` | Validate KPIs/milestones/key tasks/commit permission state; click all action links; check PLAN read view, RES denial, beta empty/not-found. | Admin status and links partial in `E-MATRIX`. | missing | `project-overview-role`: computed API values + click destinations + role screenshots. |
| `PROJ-SCHEDULE-READ` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]/schedule` | Load WBS/Gantt; zoom day/week/month; collapse summary; filter/columns only if real; inspect task; verify current/project date origin and role-specific denied/empty states. | Targeted tests only. | missing | `schedule-read-role`: DOM row model + screenshots at each zoom + 403/empty network. |
| `PROJ-SCHEDULE-EDIT` | `AADM`, `EADM` | `/projects/[id]/schedule` | Create task/subtask, inline edit title/start/duration/work/progress, Enter/Escape/Tab behavior, make milestone, delete subtree, reload. | Inventory rows PROJ-032..048 remain without fresh browser proof. | missing | `schedule-grid-edit`: mutation sequence + planVersion/read-model after every step + screenshots. |
| `PROJ-SCHEDULE-DEPENDENCY` | `AADM`, `EADM` | `/projects/[id]/schedule` | Add/change/delete predecessor with all four dependency types and lag; reject cycle/invalid relation with visible validation. | No fresh browser proof. | missing | `schedule-dependencies`: before/after plan JSON + error state + reload. |
| `PROJ-SCHEDULE-GANTT` | `AADM`, `EADM` | `/projects/[id]/schedule` | Drag bar, resize both edges, drag progress, create link by endpoints; verify exact persisted dates/duration/progress/dependency after reload. | Matrix calls drag-and-drop limited. | missing | `schedule-gantt-dnd`: pointer trace/video + read-model + screenshots. |
| `PROJ-SCHEDULE-RACE` | `AADM` in two contexts | `/projects/[id]/schedule` | Edit same task concurrently; assert deterministic conflict/current version, recover/reload, no duplicate commit/audit. | DB/API idempotency covered, not browser conflict UX. | missing | `schedule-browser-race`: two-context timestamps + 409 UI + final plan/audit. |
| `PROJ-RESOURCE` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]/resources` | Verify matrix/drilldown/overload values; allowed resolve/assign/absence actions; PLAN and RES permission semantics; beta empty; 5xx retry. | Historical role crawl is stale. | missing | `project-resources-role`: value reconciliation + mutations/403 + reload screenshots. |
| `PROJ-ASSIGN` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]/assignments` | Add/remove/re-role assignee, inspect curves/hours, deny read/write correctly, verify names under `/users` 403, reload. | No current browser action evidence. | missing | `project-assignments-role`: planning readback + user-name degradation + screenshots. |
| `PROJ-CALENDAR` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]/calendars` | Navigate months, switch project/resource view, add/edit/delete exception where allowed, validate date origin and denied/empty/error states. | Date helper tests only. | missing | `project-calendar-role`: calendar API/readback + month labels + 403/empty screenshots. |
| `PROJ-SCENARIO` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]/scenarios` | Generate all profiles, inspect deltas/overloads, apply one, cancel one, verify zero-overload empty state, denied role and stale-version conflict. | Planning API/race evidence only. | missing | `project-scenarios-role`: generated scenario ids + apply/readback + conflict screenshot. |
| `PROJ-BASELINE` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]/baseline` | Capture named baseline, verify label/zero deltas, modify plan, verify deltas/overlay link, denied/empty/error states and reload. | Label fixed by DB/test evidence; browser remains partial. | missing | `project-baseline-role`: screenshot + baseline/read-model + plan mutation + reload. |
| `PROJ-COMMIT` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]/commits` | Verify commit actor/changes, allowed rollback and compensating commit, denied role is explicit not empty, empty/error states. | Backend rollback/idempotency does not cover browser route. | missing | `project-commits-role`: before/after commit list + rollback network/audit + screenshots. |
| `PROJ-SETTINGS` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/projects/[id]/settings` | Edit allowed project fields/calendar/status, dirty/cancel/save/reload; denied read/write; invalid/cross-tenant project; 409/5xx. | No fresh browser evidence. | missing | `project-settings-role`: PATCH/403 + project readback + audit/screenshot. |
| `CRM-MASTER` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM`, `CRMRO` | `/crm/clients`, `/crm/contacts`, `/crm/products` | For each route: load/search/select; create/edit/archive allowed records; duplicate client/contact/product conflicts; denied controls and direct 403; empty beta and 5xx retry. | Admin route load only; targeted/API fixes are not browser coverage. | missing | `crm-masterdata-role`: one JSON row per role/route/action + readback/unchanged proof. |
| `CRM-DEALS` | `EADM`, `PLAN`, `RES`, `BADM` | `/crm/deals` | Kanban/list/forecast; pipeline switch; create deal; drag valid/invalid stage; denied controls; beta empty/isolation; reload. | Admin stage and ephemeral CRMRO slices only. | missing | `crm-deals-role`: drag trace + POST/PATCH/403 + forecast values + screenshots. |
| `CRM-DEAL` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/crm/deals/[id]` | Open real/legacy/invalid/cross-tenant ids; edit all fields/stage; comment/activity; verify legacy pipeline options, reload, forbidden/not-found. | Admin stage calculation targeted/partial; no complete browser card traversal. | missing | `crm-deal-card-role`: exact ids + select options + PATCH/readback + not-found screenshots. |
| `COMMS-ROLE-READ` | `EADM`, `PLAN`, `RES`, `BADM` | all five `/communications/*` routes | Load each route with real project scope; assert content or explicit permitted denial/empty state, no raw ids/errors, tenant isolation. | Only AADM read-only cluster is fresh. | missing | `comms-role-read`: 4 personas x 5 routes, screenshot + route-specific network. |
| `COMMS-CHANNEL` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/communications/channels` | Create/rename/archive channel, send message, member add/remove/role, system-channel guards, denied action UI/403, reload. | Agent-created channel and admin read load do not cover route controls. | missing | `channels-role-actions`: POST/PATCH/403 + list/conversation readback + screenshots. |
| `COMMS-CHAT` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/communications/chat` | Send/edit/delete message, reaction toggle, pin/unpin, mark read, sticker, DM create, presence/realtime update, forbidden and reconnect/error states. | Admin read load only. | missing | `chat-role-actions`: two contexts + SSE/network + message/read-state readback + screenshots. |
| `COMMS-MEETING` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/communications/meetings` | Create/edit/cancel meeting; participants; notes; external links; action-item create/status; duplicate submit; denied/empty/error/reload. | Admin read load and backend action-item idempotency only. | missing | `meetings-role-actions`: mutation/readback/audit + 403/empty screenshots. |
| `COMMS-NOTIFY` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/communications/notifications` | Filter all/unread/read, mark one/all, click source route, edit delivery preferences, duplicate read, denied/empty/error/reload. | Admin read load; API idempotency only. | missing | `notifications-role-actions`: before/after unread summary + navigation URL + screenshots. |
| `MEDIA-LIST` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM` | `/communications/calls` | Load/create room, start/end session, connect handoff, disabled-provider state, denied/empty/error, persisted room list. | AADM read plus provider-specific create/connect slices; other roles absent. | missing | `calls-list-role`: room/session network + role 403 + screenshots. |
| `MEDIA-INVALID` | `AADM`, `EADM`, `PLAN`, `RES`, `BADM`, `ANON` | `/calls/[roomId]` | Open invalid, ended, cross-tenant, and unauthorized room ids; assert login/forbidden/not-found/ended state without token issuance. | Not covered as a complete state matrix. | missing | `call-runtime-negative`: exact room fixtures + join-token count + screenshots. |
| `MEDIA-RECONNECT` | `AADM`, `EADM` | `/calls/[roomId]` | Reach active LiveKit call, interrupt websocket/network, observe reconnecting, restore transport, assert same session/participants/tracks and no duplicate token/event. | `E-RECONNECT` failed before active state with websocket establishment error and no screenshots. | missing | `media-livekit-reconnect-rerun`: transport fault log + video/screenshots + API/LiveKit event readback. |
| `MEDIA-JITSI` | `AADM`, `EADM` | `/calls/[roomId]` | Join Jitsi external media with two participants, grant mic/camera, verify remote media, leave/rejoin. | External moderator/auth gate prevented media pass. | blocked | `media-jitsi-external`: requires controllable Jitsi room/auth; browser video + participant evidence. |
| `MEDIA-CAMERA` | `AADM` | `/calls/[roomId]` | Publish a physical/OBS camera track and verify remote rendering while audio remains active. | Chrome `NotReadableError`; synthetic camera already passes. | blocked | `media-physical-camera`: requires working OS/Chrome camera source; track/server log + remote screenshot. |
| `ADMIN-INDEX` | `EADM`, `BADM`, `SECRO`, `ANON` | `/admin` | Assert permission-selected redirect target; anonymous login redirect; beta tenant target; security-only target `/admin/security`. | AADM/PLAN/RES only. | blocked | `admin-index-personas`: `SECRO` needs seeded fixture; others can run independently with URL trace. |
| `ADMIN-USERS` | `AADM`, `EADM`, `BADM`, `SECRO` | `/admin/users` | Create/edit/deactivate/reactivate user; duplicate email; self guards; role assignment; denied/empty/error/retry; beta isolation. | Route load and limited-profile visibility only. | missing | `admin-users-actions`: mutation/readback/audit + 403/conflict + screenshots. |
| `ADMIN-ROLES` | `AADM`, `EADM`, `BADM`, `SECRO` | `/admin/roles` | Create/edit/delete unassigned role; assigned-role delete guard; duplicate id/name; permission groups; denied/empty/error/retry. | Route load and backend conflicts only. | missing | `admin-roles-actions`: role/user/audit readback + conflict/confirm screenshots. |
| `ADMIN-SECURITY` | `AADM`, `EADM`, `BADM`, `SECRO` | `/admin/security` | Read/save policy, dirty/cancel/reload, duplicate submit, invalid/5xx, read-only controls, beta isolation; explicitly distinguish incomplete 2FA/SSO copy. | AADM route load; API concurrency only; `SECRO` absent. | blocked | `admin-security-actions`: seed `SECRO`, then PUT/403/readback/audit + screenshots. |
| `ADMIN-AUDIT` | `AADM`, `EADM`, `BADM`, `SECRO` | `/admin/audit` | Verify actor/action/object labels after known mutation, filters/pagination/detail if present, empty beta, forbidden and 5xx retry. | Route load only. | blocked | `admin-audit-role`: `SECRO` fixture plus known mutation marker, screenshot, audit API reconciliation. |
| `AGENT-ROLE` | `EADM`, `PLAN`, `RES`, `BADM` | `/agent` | With live provider, submit allowed and denied goals; inspect review selection/edit/reject; apply only allowed action; verify denied/no-safe-action UI and tenant-scoped readback. | Per-role tool catalog is API-only; admin browser flow only. | missing | `agent-browser-role`: one allowed + one denied prompt per persona, SSE transcript + apply/readback/unchanged proof. |
| `AGENT-UI-EDGE` | `AADM` | `/agent` | Reject all, edit proposal, partial execute failure, reset conversation, reload/history, SSE interruption/retry, very long goal, verify applied/recorded count copy. | Fresh evidence observed 5 proposals/1 applied but misleading "4 recorded" copy; edge states absent. | missing | `agent-ui-edge`: intercepted SSE/execute faults + screenshots + audit/readback. |
| `AGENT-PROVIDER` | `AADM` | `/agent` | Run configured provider variant(s) intentionally supported besides OpenRouter, or record product decision to scope them out. | OpenRouter and no-provider covered; Anthropic-direct variant absent. | blocked | `agent-provider-matrix`: requires provider credentials/config; redacted provider status + SSE/browser evidence. |
| `TENANT-BETA` | `BADM` | every protected route | Traverse all 32 protected routes; assert no alpha names/ids/counts/network payloads; exercise one write per mutable domain and confirm tenant-beta readback only. | Per-role agent API and historical screenshots are not a fresh route matrix. | missing | `beta-full-isolation`: route/action JSON + response tenant-id scan + screenshots/readbacks. |
| `ROLE-ENGINEER` | `EADM` | every protected route | Repeat full route/action traversal as engineer actor; separate permission behavior from assignment/ownership behavior and record that access profile equals admin. | Only LiveKit and API tool catalog are fresh. | missing | `engineer-full-traversal`: route matrix + actor-sensitive project/task/comms evidence. |
| `ROLE-PLAN` | `PLAN` | every non-admin protected route | Traverse allowed project-plan surfaces and explicit denials elsewhere; attempt only inventory-listed participant-governed mutations and verify backend preflight. | Profile/admin deny and API tool catalog only. | missing | `plan-reader-full-traversal`: per-route screenshot/network + allowed mutation/403 unchanged readback. |
| `ROLE-RESOURCE` | `RES` | every non-admin protected route | Traverse resource-facing surfaces; distinguish readable resource data from project-plan denial; verify no broad mutation leakage. | Admin deny and API tool catalog only. | missing | `resource-reader-full-traversal`: per-route screenshot/network + resource values + denied writes. |
| `ROLE-LPR` | `LPR` | all routes except its four covered atoms | Recreate exact limited profile fixture, traverse each route, assert settled nav/forbidden and no write affordances. | Ephemeral fixture and narrow core evidence only. | missing | `limited-profile-full-traversal`: fixture manifest + route JSON + 403/unchanged proof. |
| `ROLE-CRMRO` | `CRMRO` | all routes except `/crm/deals` | Recreate exact CRM read-only fixture; cover CRM master/detail reads, non-CRM navigation, direct denied writes. | Only deals route covered. | missing | `crm-readonly-full-traversal`: fixture manifest + route/action screenshots + 403 readback. |
| `ROLE-SECRO` | `SECRO` | all protected routes | Create stable security-readonly user and verify `/admin` selects security, security controls are read-only, other admin routes deny, shell nav is coherent. | `E-ADMIN` explicitly says this role was not covered. | blocked | `security-readonly-fixture-and-browser`: prerequisite fixture then full route matrix. |
| `STATE-01` | applicable allowed/denied roles | every data route | Force loading then one route-specific 5xx/network failure; assert stable skeleton/error copy, Retry performs a new request, recovery reaches ready state. | Inventory repeatedly marks these states untested; read-only route loads are insufficient. | missing | `failure-state-injection-by-domain`: deterministic request interception + before/error/recovered screenshots. |
| `STATE-02` | `BADM` or isolated tenant fixture | every collection route | Produce genuine empty dataset; assert intentional empty CTA, no false forbidden/error, and allowed CTA behavior. | Beta supplies some empty data but has no full fresh traversal. | missing | `empty-state-by-domain`: fixture counts + screenshots + CTA network result. |
| `STATE-03` | all six canonical personas | representative route in every domain | Desktop + mobile not-found/error/accessibility smoke: invalid id/path, runtime error boundary retry, keyboard traversal, focus return after modal, no overlap. | Not covered as fresh matrix; Storybook-only rows are not substitutes. | missing | `global-state-a11y-responsive`: screenshots, axe/keyboard log, error reset trace. |

## Independent execution order

The lanes do not need to be serialized except where they mutate shared seed data. Use isolated databases or unique marker prefixes.

1. `auth-anon-all-routes`, `shell-desktop-role-nav`, and `failure-state-injection-by-domain` are read-heavy and can run in parallel.
2. Split projects into `schedule-grid-edit`, `schedule-gantt-dnd`, `project-resources-role`, and `project-planning-role`; each needs its own project fixture.
3. Split CRM into `crm-masterdata-role` and `crm-deals-role`; use unique tenant-scoped names.
4. Split communications into `channels-role-actions`, `chat-role-actions`, and `meetings-notifications-role`; do not share channel/meeting markers.
5. Run `admin-users-actions`, `admin-roles-actions`, and `admin-security-actions` against isolated tenants because they alter access.
6. Run `agent-browser-role`, `media-livekit-reconnect-rerun`, and external-provider lanes only after provider health preflight.
7. Finish with `beta-full-isolation`, mobile/responsive, and a generated completeness check that joins the 37-route list to all canonical roles and rejects any absent status row.

## Verification result

**PASS for this navigator deliverable.** Accounted inventory: 37/37 current source routes; 6/6 canonical runbook personas; 3/3 auxiliary evidence personas. Every `missing` or `blocked` row above specifies a concrete browser action/state and required artifact shape. Exact remaining product gap: no fresh complete role x route x action matrix exists; the largest untouched surfaces are project schedule/resource/planning actions, non-admin role traversals, beta isolation, mobile/responsive/error/empty states, admin CRUD, communications mutations, and media reconnect/Jitsi/physical-camera variants.

CodeGraph change index: pre-edit index was synced and used for route/role discovery. Product symbols/nodes/edges changed: **0**. Only this Markdown evidence report was added; it is outside the source symbol graph.
