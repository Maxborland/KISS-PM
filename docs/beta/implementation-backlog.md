# KISS PM: beta implementation backlog

Этот backlog связывает product contract с текущим runtime состоянием. Экран не считается `beta-ready`, пока нет runtime data contract, permission states, рабочих actions и QA proof.

## Статусы экранов

| Экран | Route | Stories | Статус | Главный разрыв | QA proof сейчас |
| --- | --- | --- | --- | --- | --- |
| Dashboard / attention | `/dashboard` | CEO-01, PM-02, CEO-03 | wired+attention | Нужны filters/actions, role proof и screenshot evidence после полного runtime QA | `runtime-dashboard-screen.test.ts`, `read-models.test.ts`, route smoke |
| Agent cockpit | `/agent` | AGENT-01, AGENT-02, PM-04, CEO-03 | wired | Нужно доказать grounded context answers шире seeded task proposal; нужны failure states/action audit hardening | `e2e/runtime/agent-confirmation.spec.ts` confirmation loop |
| My Work | `/my-work` | SPEC-01, SPEC-02 | wired+actions+blocker-gap+readonly-proof | Status, owner, due date and comment actions are runtime-proven; blocker is explicitly disabled as backend gap without fake mutation; project-team participant read-only fields/comment flow is proven | route smoke, `my-work-block.test.tsx`, `runtime-data-screen.test.ts`, `my-work-status-action.spec.ts`, `my-work-task-fields.spec.ts`, `my-work-task-comments.spec.ts`, `my-work-blocker-gap.spec.ts`, `my-work-readonly-participant.spec.ts`, `pnpm qa:fast` |
| Projects list | `/projects` | PM-01, CEO-01 | wired/read-only | Нужны filters, realistic empty/no-results states и create/edit flow; open project теперь ведёт в runtime detail | route smoke + `ProjectsListBlock` href regression |
| Project detail | `/projects/:id` | PM-01, PM-02, LEAD-01 | wired/task-actions+activity | Create task, status, owner, due date, comment, blocker-gap UX and task activity refresh are runtime-proven; remaining gap is raw audit projection proof | `read-models.test.ts`, `runtime-data-screen.test.ts`, `project-detail-create-task.spec.ts`, `project-detail-task-actions.spec.ts`, `project-detail-task-owner.spec.ts`, `project-detail-task-fields.spec.ts`, `project-detail-task-comments.spec.ts`, `project-detail-blocker-gap.spec.ts`, `pnpm qa:fast` route smoke |
| Planning / Gantt | `/projects/:id/timeline` | PM-03 | wired/read-only | Runtime timeline route есть; нужны planning mutations/date dependency proof и desktop/narrow screenshots | `pnpm qa:fast` route smoke |
| Project resources | `/projects/:id/resources` | LEAD-01, HR-01, HR-02 | wired/read-only | Runtime workload route есть; нужны conflict/resource actions, role proof и desktop/narrow screenshots | `pnpm qa:fast` route smoke |
| Deals pipeline | `/deals` | CEO-02, SALES-02 | wired+stage-action | Stage move persists; нужны create/edit/client flows, filters/empty states и role-specific polish | `deal-stage-mutation.spec.ts`, route smoke + read-model contract tests |
| Deal detail / handoff | `/deals/:id` | SALES-03, FIN-01 | wired+handoff | Runtime detail и handoff есть; нужны client/deal create/edit, better failure UX и screenshots | `runtime-data-screen.test.ts`, route smoke |
| Clients | `/directories/clients` | SALES-01 | wired/read-only | Runtime list есть; нужны create/update/duplicate/validation flows | `pnpm qa:fast` route smoke |
| Contacts | `/directories/contacts` | SALES-01 | wired/read-only | Runtime list есть; нужны create/update/link-to-client flows | `pnpm qa:fast` route smoke |
| Admin | `/admin/users`, `/admin/roles`, `/admin/audit` | ADMIN-01 | wired/read-only | Runtime lists есть; нужны mutations proving roles affect behavior and audit/admin screenshots | `pnpm qa:fast` route smoke |
| Finance | TBD | FIN-01 | deferred | Активный beta scope не подтвержден; не блокировать если finance hidden/deferred явно | нет |

## P0 gaps

- Fast runtime QA доказан на `design-v3` `ce5c58c`: `pnpm qa:fast` pass. Полный `pnpm qa:runtime` остается broader/nightly gate, не per-PR blocker.
- `/dashboard` подключен к operations cockpit и показывает attention/workload/pipeline sections, но еще не beta-ready: нет role proof, filters/actions и свежего screenshot evidence полного runtime QA.
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
| `/dashboard` | Seeded risk/overdue/overload appears; no console/pageerror/API failures; desktop/narrow screenshots |
| `/agent` | Grounded answer references real entities; proposal has confirmation; apply mutates; audit/result visible; failure path |
| `/my-work` | Assigned task visible; status mutation persists with role-gated DnD; owner/due/comment mutation persists; blocker gap shown without fake mutation; participant read-only state proven |
| `/projects` | Projects and templates load without permission trap; filters/open project; empty/error/forbidden |
| Project detail | Open real project by id; task list visible without fixture fallback; create task persists; status/owner/due/comment persist; status mutation appears in task activity before and after reload; blocker gap shown without fake mutation; raw audit projection proof still required |
| Timeline | Task renders in date range; date/status update persists; dependency/resource conflicts visible |
| `/deals` | Pipeline loads with only used catalogs; stage move persists; read-only CRM users do not see broken DnD; no hidden clients/projectTypes dependency |
| Clients/create | Client/deal create, duplicate/validation/save error |
| Resources | Seeded overload and missing role visible |

## Top 5 implementation slices

1. **Runtime QA environment hardening**
   - Status: Wave 1 foundation split into fast PR gate and full runtime QA.
   - Evidence: `pnpm qa:fast` is the local PR-sized CI-equivalent; `docs/beta/local-artifact-policy.md` documents GitHub billing blocker and local artifact policy.

2. **Dashboard attention cockpit**
   - Status: frontend read-model/UI slice done; remaining proof is full runtime QA screenshot and seeded-risk route assertion.
   - Evidence: `RuntimeDashboardScreen` renders operations attention, workload and pipeline pressure from `/api/workspace/operations-cockpit`.

3. **Project detail + task mutations**
   - Status: runtime project detail task action matrix is proven for create/status/owner/due/comment plus blocker-gap UX; task activity refresh after status mutation is proven.
   - Evidence now: project detail API/query tests, runtime route tests, `/projects/project-beta-school-renovation` in `pnpm qa:fast`, `project-detail-create-task.spec.ts`, `project-detail-task-actions.spec.ts`, `project-detail-task-owner.spec.ts`, `project-detail-task-fields.spec.ts`, `project-detail-task-comments.spec.ts`, `project-detail-blocker-gap.spec.ts`.
   - Beta evidence still required: raw audit projection proof after mutation.

4. **My Work execution actions**
   - Contract-first: status/owner/due/comment по `docs/beta/task-action-contract.md`.
   - Status: status action done in PR #73; owner/due date/comment are runtime-proven by targeted Playwright specs; blocker gap UX is proven without fake mutation; project-team participant read-only fields/comment flow is proven.
   - Evidence: `my-work-status-action.spec.ts`, `my-work-task-fields.spec.ts`, `my-work-task-comments.spec.ts`, `my-work-blocker-gap.spec.ts`, `my-work-readonly-participant.spec.ts`, `my-work-block.test.tsx`.

5. **Agent grounded context and audit hardening**
   - Agent reads current workspace/project/task context, proposes action, confirms, mutates, shows result/audit/failure.
   - Evidence: negative no-mutation-before-confirm and positive confirmed mutation proof.

## Текущий evidence snapshot

- `origin/design-v3` `846434f`: includes Wave 1 route inventory, beta seed/reset, fast gate, deal stage mutation, PR #73 My Work status action, owner/due/comment proof and blocker-gap proof slices.
- `docs/beta/runtime-route-inventory.md`: current beta runtime allowlist and hidden route list.
- `navigation-registry.test.ts`: non-beta routes are hidden from runtime navigation.
- `runtime-data-screen.test.ts`: non-beta routes render `Раздел не включён в beta` and do not fall back to fixture screens.
- `runtime-data-screen.test.ts`: `/projects/:id` loads project/tasks from runtime read-model and does not fall back to Storybook fixtures.
- `project-detail-task-actions.spec.ts`: seeded project task status changes through the runtime project detail UI, appears in task activity and remains changed after reload.
- `project-detail-create-task.spec.ts`: seeded project detail task create flow saves title and due date and remains visible after reload.
- `project-detail-task-owner.spec.ts`, `project-detail-task-fields.spec.ts`, `project-detail-task-comments.spec.ts`, `project-detail-blocker-gap.spec.ts`: project detail owner/due/comment mutations and blocker-gap UX are covered by targeted Playwright specs.
- `pnpm qa:fast`: opens `/projects/project-beta-school-renovation` and checks the seeded project detail route for blank/error/overflow regressions.
- `deal-stage-mutation.spec.ts`: seeded deal stage changes through runtime `/deals` DnD and remains changed after reload.
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
