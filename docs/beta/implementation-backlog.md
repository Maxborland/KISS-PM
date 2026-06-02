# KISS PM: beta implementation backlog

Этот backlog связывает product contract с текущим runtime состоянием. Экран не считается `beta-ready`, пока нет runtime data contract, permission states, рабочих actions и QA proof.

## Статусы экранов

| Экран | Route | Stories | Статус | Главный разрыв | QA proof сейчас |
| --- | --- | --- | --- | --- | --- |
| Dashboard / attention | `/dashboard` | CEO-01, PM-02, CEO-03 | wired | Нужны реальные risk/attention sections из operations context, filters/actions, role proof | `e2e/runtime/runtime-foundation.spec.ts` route smoke |
| Agent cockpit | `/agent` | AGENT-01, AGENT-02, PM-04, CEO-03 | wired | Нужно доказать grounded context answers шире seeded task proposal; нужны failure states/action audit hardening | `e2e/runtime/agent-confirmation.spec.ts` confirmation loop |
| My Work | `/my-work` | SPEC-01, SPEC-02 | wired/prototype | Нужны status/blocker/comment mutations и persistence proof | route smoke |
| Projects list | `/projects` | PM-01, CEO-01 | wired/prototype | Нужны filters, open project flow, realistic empty/no-results states | route smoke |
| Project detail | `/projects/demo` | PM-01, PM-02, LEAD-01 | prototype | Demo route; нужен runtime project detail by id, tasks, owners, blockers | нет beta proof |
| Planning / Gantt | `/projects/demo/gantt` | PM-03 | prototype | Demo route; нужен runtime timeline data/update proof | нет beta proof |
| Project resources | `/projects/demo/resources` | LEAD-01, HR-01, HR-02 | prototype | Demo route; нужен runtime workload/read-model proof | нет beta proof |
| Deals pipeline | `/deals` | CEO-02, SALES-02 | wired | Нужны stage mutation, next action, persistence proof | route smoke + read-model contract tests |
| Deal detail / handoff | `/deals/demo/DEAL-101` | SALES-03, FIN-01 | prototype | Demo route; нужен runtime deal detail and handoff flow | нет beta proof |
| Clients | `/directories/clients` | SALES-01 | prototype/wired TBD | Нужно проверить runtime route/data/actions; create flow не доказан | нет beta proof |
| Contacts | `/directories/contacts` | SALES-01 | prototype/wired TBD | Runtime usefulness не доказана | нет beta proof |
| Settings/Admin | `/settings`, `/admin` | ADMIN-01 | wired/prototype | Permissions/read-only and dead controls audit incomplete | Storybook/settings visual smoke only |
| Finance | TBD | FIN-01 | deferred | Активный beta scope не подтвержден; не блокировать если finance hidden/deferred явно | нет |

## P0 gaps

- Runtime QA локально сейчас не доказан в новом worktree: `pnpm qa:runtime` остановился на миграции, потому что Docker/Postgres недоступен (`127.0.0.1:55432` closed).
- `/dashboard` пока route-smoke, но не доказанный CEO attention cockpit: нет proof seeded risk/overdue/overload.
- `/projects/demo*` остаются prototype/demo routes; beta требует runtime project detail/planning/resource surfaces.
- `/my-work` не доказывает реальные mutations: status, blocker, comment.
- Agent safety partially proven: confirmation loop есть, но grounded context answer and failure/action audit coverage incomplete.

## P1 gaps

- `/deals` нужен stage-change flow с persistence proof.
- Clients/deals create and handoff не доказаны.
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
| Deals block | needs-adaptation | Нужны mutations/stage persistence и handoff affordances |
| Projects list block | needs-adaptation | Нужны filters/open/detail path and realistic empty states |
| My Work block | needs-adaptation | Нужны status/blocker/comment actions |
| Demo project planning blocks | outdated-for-runtime | Можно использовать визуальные паттерны, но не как runtime data contract |

## QA proof required

| Screen | Required proof before beta-ready |
| --- | --- |
| `/dashboard` | Seeded risk/overdue/overload appears; no console/pageerror/API failures; desktop/narrow screenshots |
| `/agent` | Grounded answer references real entities; proposal has confirmation; apply mutates; audit/result visible; failure path |
| `/my-work` | Assigned task visible; status/blocker/comment mutation persists; forbidden state |
| `/projects` | Projects and templates load without permission trap; filters/open project; empty/error/forbidden |
| Project detail | Open real project by id; add/update task; blocker visible; reload proof |
| Timeline | Task renders in date range; date/status update persists |
| `/deals` | Pipeline loads with only used catalogs; stage move persists; no hidden clients/projectTypes dependency |
| Clients/create | Client/deal create, duplicate/validation/save error |
| Resources | Seeded overload and missing role visible |

## Top 5 implementation slices

1. **Runtime QA environment hardening**
   - Make `pnpm qa:runtime` either start/check Postgres clearly or fail with an explicit actionable blocker.
   - Evidence: local pass or deterministic infra error message.

2. **Dashboard attention cockpit**
   - Use operations context/read-model for overdue, blockers, workload and pipeline pressure.
   - Evidence: seeded risk appears in `/dashboard` runtime QA.

3. **Project detail + task mutations**
   - Real `/projects/:id` route with tasks, owner, due date, status, blocker.
   - Evidence: add/update task persists after reload.

4. **My Work execution actions**
   - Status update, blocker reason, comment/action result.
   - Evidence: specialist flow persists and appears in PM attention surface.

5. **Agent grounded context and audit hardening**
   - Agent reads current workspace/project/task context, proposes action, confirms, mutates, shows result/audit/failure.
   - Evidence: negative no-mutation-before-confirm and positive confirmed mutation proof.

## Текущий evidence snapshot

- `origin/design-v3`: `7512510` includes PR #69 unified workspace agent cockpit UI.
- `pnpm qa:runtime`: blocked locally in this worktree by missing Postgres/Docker, not by runtime assertion failure.
- Existing runtime QA files are present: `e2e/runtime/runtimeQaFixtures.ts`, `runtime-foundation.spec.ts`, `agent-confirmation.spec.ts`, `storybook-visual-smoke.spec.ts`.
- Existing beta docs present before this slice: `screen-readiness-matrix.md`, `component-readiness.md`, `qa-gate.md`.
