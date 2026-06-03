# KISS PM: beta implementation backlog

Этот backlog связывает product contract с текущим runtime состоянием. Экран не считается `beta-ready`, пока нет runtime data contract, permission states, рабочих actions и QA proof.

## Статусы экранов

| Экран | Route | Stories | Статус | Главный разрыв | QA proof сейчас |
| --- | --- | --- | --- | --- | --- |
| Dashboard / attention | `/dashboard` | CEO-01, PM-02, CEO-03 | wired+attention+visual | Operations attention, workload and pipeline pressure render from live read-model; pipeline clickthrough and desktop/narrow screenshots are proven; remaining gap is role-specific filters/actions | `runtime-dashboard-screen.test.ts`, `read-models.test.ts`, `dashboard-pipeline-clickthrough.spec.ts`, `pnpm qa:screenshots -- --routes /dashboard` |
| Agent cockpit | `/agent` | AGENT-01, AGENT-02, PM-04, CEO-03 | wired+grounded+failure-audit | Global workspace agent has grounded project focus proof, no-mutation-before-confirm, confirmed apply/result/audit, forbidden read failure and denied apply audit proof; remaining gap is broader grounded Q&A beyond create-task proposal | `agent-focused-context.spec.ts`, `agent-confirmation.spec.ts`, `agent-no-mutation-before-confirm.spec.ts`, `agent-forbidden.spec.ts`, `agent-apply-forbidden.spec.ts` |
| My Work | `/my-work` | SPEC-01, SPEC-02 | wired+actions+blocker-gap+readonly-proof | Status, owner, due date and comment actions are runtime-proven; blocker is explicitly disabled as backend gap without fake mutation; project-team participant read-only fields/comment flow is proven | route smoke, `my-work-block.test.tsx`, `runtime-data-screen.test.ts`, `my-work-status-action.spec.ts`, `my-work-task-fields.spec.ts`, `my-work-task-comments.spec.ts`, `my-work-blocker-gap.spec.ts`, `my-work-readonly-participant.spec.ts`, `pnpm qa:fast` |
| Projects list | `/projects` | PM-01, CEO-01 | wired+filters+visual | Runtime projects list filters live data, opens runtime detail, shows honest no-results state and passes desktop/narrow screenshots; remaining gap is create/edit flow | `projects-list-runtime.spec.ts`, `projects-list-block.test.ts`, `runtime-data-screen.test.ts`, `pnpm qa:screenshots -- --routes /projects` |
| Project detail | `/projects/:id` | PM-01, PM-02, LEAD-01 | wired/task-actions+activity+audit-proof+visual | Create task, status, owner, due date, comment, blocker-gap UX, task activity refresh, scoped task-audit projection and desktop/narrow visual pass are runtime-proven | `read-models.test.ts`, `runtime-data-screen.test.ts`, `project-detail-create-task.spec.ts`, `project-detail-task-actions.spec.ts`, `project-detail-task-owner.spec.ts`, `project-detail-task-fields.spec.ts`, `project-detail-task-comments.spec.ts`, `project-detail-blocker-gap.spec.ts`, `project-detail-task-audit.spec.ts`, `pnpm qa:screenshots -- --routes /projects/project-beta-school-renovation`, `pnpm qa:fast` route smoke |
| Planning / Gantt | `/projects/:id/timeline` | PM-03 | wired/date-action+visual | Live timeline renders real project tasks, zoom works, critical indicators are visible, due-date update persists to project detail, and desktop/narrow screenshots pass; dependency editing remains future scope | `project-timeline.spec.ts`, `project-timeline-date-action.spec.ts`, `pnpm qa:screenshots -- --routes /projects/project-beta-school-renovation/timeline`, `pnpm qa:fast` route smoke |
| Project resources | `/projects/:id/resources` | LEAD-01, HR-01, HR-02 | wired/read-only+visual | Runtime ResourceMatrix uses live project tasks/users/demand; missing role, high-load cells, disabled assignment reason and desktop/narrow screenshots are proven; true overload/conflict action remains pending | `project-resources.spec.ts`, `project-resources.test.ts`, `project-resources-runtime-block.test.tsx`, `pnpm qa:screenshots -- --routes /projects/project-beta-school-renovation/resources`, `pnpm qa:fast` route smoke |
| Deals pipeline | `/deals` | CEO-02, SALES-02 | wired+stage-action | Stage move persists; нужны create/edit/client flows, filters/empty states и role-specific polish | `deal-stage-mutation.spec.ts`, route smoke + read-model contract tests |
| Deal detail / handoff | `/deals/:id` | SALES-03, FIN-01 | wired+handoff | Runtime detail и handoff есть; нужны client/deal create/edit, better failure UX и screenshots | `runtime-data-screen.test.ts`, route smoke |
| Clients | `/directories/clients` | SALES-01 | wired/read-only | Runtime list есть; нужны create/update/duplicate/validation flows | `pnpm qa:fast` route smoke |
| Contacts | `/directories/contacts` | SALES-01 | wired/read-only | Runtime list есть; нужны create/update/link-to-client flows | `pnpm qa:fast` route smoke |
| Admin | `/admin/users`, `/admin/roles`, `/admin/audit` | ADMIN-01 | wired+mutations+visual | User deactivate/reactivate persists, role permission mutation changes runtime access and audit, admin desktop/narrow screenshots pass; remaining gap is deeper role matrix/user filters | `admin-user-status.spec.ts`, `admin-role-permissions.spec.ts`, `pnpm qa:screenshots -- --routes /admin/users,/admin/roles,/admin/audit`, `pnpm qa:fast` route smoke |
| Finance | TBD | FIN-01 | deferred | Активный beta scope не подтвержден; не блокировать если finance hidden/deferred явно | нет |

## P0 gaps

- Fast runtime QA доказан на `design-v3` `ce5c58c`: `pnpm qa:fast` pass. Полный `pnpm qa:runtime` остается broader/nightly gate, не per-PR blocker.
- `/dashboard` подключен к operations cockpit и показывает attention/workload/pipeline sections из live read-model; pipeline clickthrough and desktop/narrow screenshot evidence are proven. Остаются role-specific filters/actions.
- `/projects/:id`, `/projects/:id/timeline` и `/projects/:id/resources` теперь runtime routes; mutation depth и screenshot proof still required.
- Non-beta/demo routes больше не попадают в runtime-навигацию и не падают в Storybook fixture fallback; settings/profile and deeper create/edit flows ещё не сделаны.
- `/my-work` доказывает status/owner/due-date/comment mutations: PR #73 gates status DnD by `tenant.projects.manage` or task roles `requester/executor/co_executor/controller`; `my-work-task-fields.spec.ts` proves owner+due date persistence; `my-work-task-comments.spec.ts` proves comment activity persistence; `my-work-blocker-gap.spec.ts` proves blocker is an explicit disabled backend gap without fake mutation; `my-work-readonly-participant.spec.ts` proves project-team participants see PM-owned fields as read-only but can still add activity comments.
- Agent safety partially proven: confirmation loop есть, но grounded context answer and failure/action audit coverage incomplete.
- В `docs/beta/task-action-contract.md` зафиксирован split: что есть, что отсутствует (`blocker` пока только как gap).

## P1 gaps

- Deals create/edit/client flows не доказаны; stage-change persistence закрыт PR #98.
- Empty/no-results/filter states неполные для core screens.
- Role-specific forbidden/read-only states покрыты слабо.
- Demo/task names and fake affordances нужно зачистить перед visual readiness gate.

## P2 gaps

- Finance можно оставить deferred, если явно скрыть/описать scope.
- Narrow screenshots есть только для foundation, не для каждого beta-ready workflow.
- Component readiness пока `visual-smoke`, не approval.

## Component readiness

| Component/surface | Статус | Решение |
| --- | --- | --- |
| Runtime shell / navigation | approved-for-foundation | Использовать, но проверить fake/dead side nav items перед beta |
| Dashboard block | needs-adaptation | Нужна operational attention hierarchy, не только summary |
| Agent cockpit block | needs-adaptation | Хорошая база; нужно grounded context, failure/result audit polish |
| Deals block | needs-adaptation | Stage persistence и handoff foundation есть; нужны create/edit/client flows, filters/empty states и polished failure UX |
| Projects list block | needs-adaptation | Runtime detail path подключен; нужны API-backed filters/create/edit and realistic empty states |
| Project detail block | needs-adaptation | Runtime status action persists after reload; нужны create task, owner/due/comment/blocker/activity and planning/resources links |
| My Work block | needs-adaptation | Status action есть и gated by participant role/manage permission; нужны owner/due/comment actions по contract; blocker только как read-only gap/disabled reason |
| Project planning/resources blocks | needs-adaptation | Runtime read-only routes есть; нужны planning/resource mutations, conflict actions и screenshot proof |

## QA proof required

| Screen | Required proof before beta-ready |
| --- | --- |
| `/dashboard` | Seeded risk/overdue/overload appears; pipeline pressure links to deal detail; no console/pageerror/API failures; desktop/narrow screenshots |
| `/agent` | Grounded project focus references real entities; proposal has confirmation; no mutation before apply; apply mutates and shows result/audit; forbidden read and denied apply write audit |
| `/my-work` | Assigned task visible; status mutation persists with role-gated DnD; owner/due/comment mutation persists; blocker gap shown without fake mutation; participant read-only state proven |
| `/projects` | Projects and templates load without permission trap; search filters live list; open project routes to runtime detail; honest no-results state; desktop/narrow screenshots |
| Project detail | Open real project by id; task list visible without fixture fallback; create task persists; status/owner/due/comment persist; status mutation appears in task activity before/after reload and in scoped audit projection; blocker gap shown without fake mutation; desktop/narrow screenshots pass |
| Timeline | Live tasks render in date range; day/week/month zoom works; critical indicators visible; due-date update persists to project detail; desktop/narrow screenshots pass; dependency editing remains future scope |
| `/deals` | Pipeline loads with only used catalogs; stage move persists; read-only CRM users do not see broken DnD; no hidden clients/projectTypes dependency |
| Clients/create | Client/deal create, duplicate/validation/save error |
| Resources | Live resource matrix renders seeded project people, high-load cells and missing role; assignment change is honestly disabled; desktop/narrow screenshots pass; true overload/conflict action remains required |

## Implementation slices

1. **Runtime QA environment hardening**
   - Status: Wave 1 foundation split into fast PR gate and full runtime QA.
   - Evidence: `pnpm qa:fast` is the local PR-sized CI-equivalent; `docs/beta/local-artifact-policy.md` documents GitHub billing blocker and local artifact policy.

2. **Dashboard attention cockpit**
   - Status: seeded-risk route assertion, workload/pipeline sections, pipeline clickthrough and desktop/narrow screenshot evidence are proven.
   - Evidence: `RuntimeDashboardScreen` renders operations attention, workload and pipeline pressure from `/api/workspace/operations-cockpit`; `dashboard-pipeline-clickthrough.spec.ts`; `pnpm qa:screenshots -- --routes /dashboard`.

3. **Project detail + task mutations**
   - Status: runtime project detail task action matrix is proven for create/status/owner/due/comment plus blocker-gap UX; task activity refresh, scoped audit projection and desktop/narrow screenshot evidence are proven.
   - Evidence now: project detail API/query tests, runtime route tests, `/projects/project-beta-school-renovation` in `pnpm qa:fast`, `project-detail-create-task.spec.ts`, `project-detail-task-actions.spec.ts`, `project-detail-task-owner.spec.ts`, `project-detail-task-fields.spec.ts`, `project-detail-task-comments.spec.ts`, `project-detail-blocker-gap.spec.ts`, `project-detail-task-audit.spec.ts`, `pnpm qa:screenshots -- --routes /projects/project-beta-school-renovation`.
   - Beta evidence still required: none for Project detail; continue timeline/resources foundations.

4. **Timeline / Gantt foundation**
   - Status: runtime timeline renders live project tasks, supports day/week/month zoom, shows critical indicators, persists due-date changes back to project detail and has desktop/narrow screenshot evidence.
   - Evidence now: `project-timeline.spec.ts`, `project-timeline-date-action.spec.ts`, `pnpm qa:screenshots -- --routes /projects/project-beta-school-renovation/timeline`.
   - Beta evidence still required: dependency editing/conflict action beyond visible critical indicators.

5. **Resources / workload foundation**
   - Status: runtime resources route uses the shared Storybook `ResourceMatrix` core with live project data. Missing role, high-load cells, disabled assignment reason and desktop/narrow screenshots are proven.
   - Evidence now: `project-resources.spec.ts`, `project-resources.test.ts`, `project-resources-runtime-block.test.tsx`, `pnpm qa:screenshots -- --routes /projects/project-beta-school-renovation/resources`.
   - Beta evidence still required: true overload/conflict/action proof beyond high-load/missing-role foundation.

6. **My Work execution actions**
   - Contract-first: status/owner/due/comment по `docs/beta/task-action-contract.md`.
   - Status: status action done in PR #73; owner/due date/comment are runtime-proven by targeted Playwright specs; blocker gap UX is proven without fake mutation; project-team participant read-only fields/comment flow is proven.
   - Evidence: `my-work-status-action.spec.ts`, `my-work-task-fields.spec.ts`, `my-work-task-comments.spec.ts`, `my-work-blocker-gap.spec.ts`, `my-work-readonly-participant.spec.ts`, `my-work-block.test.tsx`.

7. **Agent grounded context and audit hardening**
   - Status: global workspace agent reads focused project context without becoming project-specific, requires confirmation before mutation, shows applied result/audit, handles forbidden read and denied apply audit.
   - Evidence: `agent-focused-context.spec.ts`, `agent-confirmation.spec.ts`, `agent-no-mutation-before-confirm.spec.ts`, `agent-forbidden.spec.ts`, `agent-apply-forbidden.spec.ts`.

8. **Admin mutations and audit surfaces**
   - Status: runtime admin users/roles/audit routes have live mutation proof and desktop/narrow screenshot evidence.
   - Evidence now: `admin-user-status.spec.ts`, `admin-role-permissions.spec.ts`, `pnpm qa:screenshots -- --routes /admin/users,/admin/roles,/admin/audit`.
   - Beta evidence still required: deeper role matrix/user filters and extra failure-state polish.

9. **Projects list runtime evidence**
   - Status: runtime projects list filters live data, opens runtime project detail, shows honest no-results state in read-only mode and has desktop/narrow screenshot evidence.
   - Evidence now: `projects-list-runtime.spec.ts`, `projects-list-block.test.ts`, `runtime-data-screen.test.ts`, `pnpm qa:screenshots -- --routes /projects`.
   - Beta evidence still required: create/edit flow and richer filter set.

## Текущий evidence snapshot

- `dashboard-pipeline-clickthrough.spec.ts`: dashboard renders seeded attention/workload/pipeline sections and opens the live school renovation deal detail route.
- `pnpm qa:screenshots -- --routes /dashboard`: dashboard desktop and narrow screenshots pass.
- `origin/design-v3` `846434f`: includes Wave 1 route inventory, beta seed/reset, fast gate, deal stage mutation, PR #73 My Work status action, owner/due/comment proof and blocker-gap proof slices.
- `docs/beta/runtime-route-inventory.md`: current beta runtime allowlist and hidden route list.
- `navigation-registry.test.ts`: non-beta routes are hidden from runtime navigation.
- `runtime-data-screen.test.ts`: non-beta routes render `Раздел не включён в beta` and do not fall back to fixture screens.
- `runtime-data-screen.test.ts`: `/projects/:id` loads project/tasks from runtime read-model and does not fall back to Storybook fixtures.
- `projects-list-runtime.spec.ts`: runtime `/projects` filters live project rows, opens the school renovation project detail route and shows an honest read-only no-results state.
- `pnpm qa:screenshots -- --routes /projects`: projects list desktop and narrow screenshots pass.
- `project-detail-task-actions.spec.ts`: seeded project task status changes through the runtime project detail UI, appears in task activity and remains changed after reload.
- `project-detail-task-audit.spec.ts`: project detail status mutation appears in scoped `/api/tenant/current/audit-events?projectId=...` task audit projection and in the visible admin audit route.
- `project-detail-create-task.spec.ts`: seeded project detail task create flow saves title and due date and remains visible after reload.
- `project-detail-task-owner.spec.ts`, `project-detail-task-fields.spec.ts`, `project-detail-task-comments.spec.ts`, `project-detail-blocker-gap.spec.ts`: project detail owner/due/comment mutations and blocker-gap UX are covered by targeted Playwright specs.
- `pnpm qa:screenshots -- --routes /projects/project-beta-school-renovation`: project detail desktop and narrow screenshots pass; narrow task/activity tables render as labeled cards instead of squeezed columns.
- `project-timeline.spec.ts`: timeline renders live project tasks without demo fallback, switches day/week/month zoom, opens task context and shows critical indicators for seeded overdue/waiting tasks.
- `project-timeline-date-action.spec.ts`: timeline due-date update for the seeded survey task persists after reload and appears in project detail.
- `pnpm qa:screenshots -- --routes /projects/project-beta-school-renovation/timeline`: timeline desktop and narrow screenshots pass; narrow Gantt stacks WBS and chart sections without page overflow.
- `project-resources.spec.ts`: project resources route renders live missing role demand, high-load matrix cells, disabled assignment action with reason and no demo fallback.
- `pnpm qa:screenshots -- --routes /projects/project-beta-school-renovation/resources`: resources desktop and narrow screenshots pass using shared ResourceMatrix core.
- `pnpm qa:fast`: opens `/projects/project-beta-school-renovation` and checks the seeded project detail route for blank/error/overflow regressions.
- `deal-stage-mutation.spec.ts`: seeded deal stage changes through runtime `/deals` DnD and remains changed after reload.
- `admin-user-status.spec.ts`: admin deactivates a workspace user, status persists after reload, and action remains reversible.
- `admin-role-permissions.spec.ts`: admin removes `tenant.projects.read` from the project-team role, architect loses `/projects` access after relogin, and audit captures the permission update.
- `pnpm qa:screenshots -- --routes /admin/users,/admin/roles,/admin/audit`: admin users, roles, and audit routes pass desktop and narrow screenshot capture.
- `agent-focused-context.spec.ts`: `/agent?projectId=...` remains the global workspace agent while grounding proposal context in the real school renovation project.
- `agent-confirmation.spec.ts`: agent proposal does not mutate before human confirmation; applying creates a task, result link and audit marker.
- `agent-apply-forbidden.spec.ts`: denied apply does not create a task and writes `workspace.agent_action.denied` audit with `permission_missing`.
- `agent-forbidden.spec.ts`: project-team user without project read permission sees forbidden state and denied audit.
- `runtime-data-screen.test.ts`: read-only `/deals` users do not receive the stage mutation handler unless they have `tenant.opportunities.manage`.
- `pnpm db:reset:dev`: resets only the documented compose dev database by default, then seeds and checks beta fixture counts.
- `my-work-block.test.tsx`: status DnD is exposed only for transition-capable roles or `tenant.projects.manage`; `approver`/`observer` cards remain visible but not draggable.
- `runtime-data-screen.test.ts`: My Work receives the current user and project manage permission flag for task status actions.
- `my-work-task-fields.spec.ts`: seeded My Work task owner and due date change through runtime UI and remain changed after reload.
- `my-work-task-comments.spec.ts`: seeded My Work task comment is created through runtime UI and remains visible in task activity after reload.
- `my-work-blocker-gap.spec.ts`: My Work blocker control is disabled with explicit data-contract gap copy; waiting-status task shows attention copy instead of fake blocker mutation.
- `my-work-readonly-participant.spec.ts`: project-team participant opens an assigned task, sees status/owner/due fields as read-only without project-manage permission, adds a comment and sees it after reload.
- `pnpm qa:fast`: standardized as the default local PR gate for small beta slices; pass on current `origin/design-v3` `846434f`.
- `pnpm qa:runtime`: remains the broader runtime+Storybook foundation gate.
- Existing runtime QA files are present: `e2e/runtime/runtimeQaFixtures.ts`, `runtime-foundation.spec.ts`, `agent-confirmation.spec.ts`, `storybook-visual-smoke.spec.ts`.
- Existing beta docs present before this slice: `screen-readiness-matrix.md`, `component-readiness.md`, `qa-gate.md`.
