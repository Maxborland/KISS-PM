# KISS PM: beta implementation backlog

Этот backlog связывает product contract с текущим runtime состоянием. Экран не считается `beta-ready`, пока нет runtime data contract, permission states, рабочих actions и QA proof.

## Статусы экранов

| Экран | Route | Stories | Статус | Главный разрыв | QA proof сейчас |
| --- | --- | --- | --- | --- | --- |
| Dashboard / attention | `/dashboard` | CEO-01, PM-02, CEO-03 | wired+attention | Нужны filters/actions, role proof и screenshot evidence после полного runtime QA | `runtime-dashboard-screen.test.ts`, `read-models.test.ts`, route smoke |
| Agent cockpit | `/agent` | AGENT-01, AGENT-02, PM-04, CEO-03 | wired | Нужно доказать grounded context answers шире seeded task proposal; нужны failure states/action audit hardening | `e2e/runtime/agent-confirmation.spec.ts` confirmation loop |
| My Work | `/my-work` | SPEC-01, SPEC-02 | wired/prototype | Нужны статус/owner/due/comment actions по contract (`docs/beta/task-action-contract.md`) | route smoke |
| Projects list | `/projects` | PM-01, CEO-01 | wired/prototype | Нужны filters, open project flow, realistic empty/no-results states | route smoke |
| Project detail | `/projects/demo` | PM-01, PM-02, LEAD-01 | prototype | Demo route; нужен runtime project detail by id, tasks, owners, blockers | нет beta proof |
| Planning / Gantt | `/projects/demo/gantt` | PM-03 | prototype | Demo route; нужен runtime timeline data/update proof | нет beta proof |
| Project resources | `/projects/demo/resources` | LEAD-01, HR-01, HR-02 | prototype | Demo route; нужен runtime workload/read-model proof | нет beta proof |
| Deals pipeline | `/deals` | CEO-02, SALES-02 | wired | Нужны stage mutation, next action, persistence proof | route smoke + read-model contract tests |
| Deal detail / handoff | `/deals/demo/DEAL-101` | SALES-03, FIN-01 | prototype | Demo route; нужен runtime deal detail and handoff flow | нет beta proof |
| Clients | `/directories/clients` | SALES-01 | hidden | Runtime route/data/actions не доказаны; скрыто из runtime-навигации до API-backed slice | `runtime-route-inventory.md` |
| Contacts | `/directories/contacts` | SALES-01 | hidden | Runtime usefulness не доказана; скрыто из runtime-навигации | `runtime-route-inventory.md` |
| Settings/Admin | `/settings`, `/admin` | ADMIN-01 | hidden | Settings/admin не считаются beta runtime, пока нет runtime data/action proof | `runtime-route-inventory.md` |
| Finance | TBD | FIN-01 | deferred | Активный beta scope не подтвержден; не блокировать если finance hidden/deferred явно | нет |

## P0 gaps

- Runtime QA локально сейчас не доказан в новом worktree: `pnpm qa:runtime` остановился на миграции, потому что Docker/Postgres недоступен (`127.0.0.1:55432` closed).
- `/dashboard` подключен к operations cockpit и показывает attention/workload/pipeline sections, но еще не beta-ready: нет role proof, filters/actions и свежего screenshot evidence полного runtime QA.
- `/projects/demo*` остаются prototype/demo routes; beta требует runtime project detail/planning/resource surfaces.
- Non-beta/demo routes больше не попадают в runtime-навигацию и не падают в Storybook fixture fallback, но сами runtime slices для project detail/planning/resources/clients/settings ещё не сделаны.
- `/my-work` не доказывает реальные mutations для contract-сигнатур: status/owner/due/comment; blocker требует отдельного backend gap.
- Agent safety partially proven: confirmation loop есть, но grounded context answer and failure/action audit coverage incomplete.
- В `docs/beta/task-action-contract.md` зафиксирован split: что есть, что отсутствует (`blocker` пока только как gap).

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
| My Work block | needs-adaptation | Нужны status/owner/due/comment actions по contract; blocker только как read-only gap/disabled reason |
| Demo project planning blocks | outdated-for-runtime | Можно использовать визуальные паттерны, но не как runtime data contract |

## QA proof required

| Screen | Required proof before beta-ready |
| --- | --- |
| `/dashboard` | Seeded risk/overdue/overload appears; no console/pageerror/API failures; desktop/narrow screenshots |
| `/agent` | Grounded answer references real entities; proposal has confirmation; apply mutates; audit/result visible; failure path |
| `/my-work` | Assigned task visible; status/owner/due/comment mutation persists; blocker gap shown without fake mutation; forbidden state |
| `/projects` | Projects and templates load without permission trap; filters/open project; empty/error/forbidden |
| Project detail | Open real project by id; add/update task; blocker visible; reload proof |
| Timeline | Task renders in date range; date/status update persists |
| `/deals` | Pipeline loads with only used catalogs; stage move persists; no hidden clients/projectTypes dependency |
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
   - Real `/projects/:id` route with tasks, owner, due date, status, blocker.
   - Evidence: add/update task persists after reload.

4. **My Work execution actions**
   - Contract-first: status/owner/due/comment по `docs/beta/task-action-contract.md`.
   - Evidence: specialist flow persists and appears in PM attention surface.

5. **Agent grounded context and audit hardening**
   - Agent reads current workspace/project/task context, proposes action, confirms, mutates, shows result/audit/failure.
   - Evidence: negative no-mutation-before-confirm and positive confirmed mutation proof.

## Текущий evidence snapshot

- `origin/design-v3`: includes Wave 1 route inventory and beta seed/reset slices.
- `docs/beta/runtime-route-inventory.md`: current beta runtime allowlist and hidden route list.
- `navigation-registry.test.ts`: non-beta routes are hidden from runtime navigation.
- `runtime-data-screen.test.ts`: non-beta routes render `Раздел не включён в beta` and do not fall back to fixture screens.
- `pnpm db:reset:dev`: resets only the documented compose dev database by default, then seeds and checks beta fixture counts.
- `pnpm qa:fast`: standardized as the default local PR gate for small beta slices.
- `pnpm qa:runtime`: remains the broader runtime+Storybook foundation gate.
- Existing runtime QA files are present: `e2e/runtime/runtimeQaFixtures.ts`, `runtime-foundation.spec.ts`, `agent-confirmation.spec.ts`, `storybook-visual-smoke.spec.ts`.
- Existing beta docs present before this slice: `screen-readiness-matrix.md`, `component-readiness.md`, `qa-gate.md`.
