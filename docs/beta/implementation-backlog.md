# KISS PM: beta implementation backlog

Этот backlog связывает product contract с текущим runtime состоянием. Экран не считается `beta-ready`, пока нет runtime data contract, permission states, рабочих actions и QA proof.

## Статусы экранов

| Экран | Route | Stories | Статус | Главный разрыв | QA proof сейчас |
| --- | --- | --- | --- | --- | --- |
| Dashboard / attention | `/dashboard` | CEO-01, PM-02, CEO-03 | wired/stronger | Attention cockpit теперь использует просроченные задачи, статус ожидания/блокера, capacity summary и реальные next-action links; нужны role-specific filters и более богатая модель portfolio risk | `pnpm qa:route-smoke`, `pnpm qa:visual`, `pnpm test:e2e:smoke` |
| Agent cockpit | `/agent` | AGENT-01, AGENT-02, PM-04, CEO-03 | wired/partial | Есть confirmation loop для task status; нужен grounded context answer, failure states/action audit hardening | `pnpm qa:route-smoke`, `pnpm qa:visual` |
| My Work | `/my-work` | SPEC-01, SPEC-02 | wired/stronger | Status, comment и blocker-as-waiting transition сохраняются; отдельная blocker domain entity и forbidden-state proof остаются gaps | `pnpm test:e2e:smoke` |
| Projects list | `/projects` | PM-01, CEO-01 | wired/partial | Нужны filters, templates/archive scopes, realistic empty/no-results states | route smoke + visual matrix |
| Project detail | `/projects/:id` | PM-01, PM-02, LEAD-01 | wired/stronger | Route id real; create task, status, comment и blocker actions сохраняются; owner/date editing и task detail остаются gaps | `pnpm test:e2e:smoke` |
| Planning / Gantt | `/projects/:id/schedule` | PM-03 | wired/stronger | Read-model real; preview/apply с planVersion доказан; stale-conflict UI и richer direct manipulation остаются gaps (route — `schedule`, не `timeline`: `apps/web/src/app/projects/[id]/schedule/page.tsx`) | `pnpm test:e2e:smoke` |
| Project resources | `/projects/:id/resources` | LEAD-01, HR-01, HR-02 | wired/stronger | Assignments, capacity summary и capacity/tree risk list реальные; full daily cell drilldown остается gap | route smoke + visual matrix |
| Deals pipeline | `/crm/deals` | CEO-02, SALES-02 | wired | Route живой (`apps/web/src/app/crm/deals/page.tsx`); нужны richer next actions and no-results states | route smoke + business smoke |
| Deal detail / handoff | `/crm/deals/:id` | SALES-03, FIN-01 | wired | Route id real (`apps/web/src/app/crm/deals/[id]/page.tsx`); нужна fuller handoff/activation evidence after reload | route smoke |
| Clients | `/crm/clients` | SALES-01 | wired | Живой route на боевом CRM API (`apps/web/src/app/crm/clients/page.tsx` → `CrmRuntimeProvider live` → GET/POST/PATCH `/api/workspace/clients`); в CRM-навигации (`crm/ui/crm-frame.tsx`). Ранее ошибочно значился «intentionally absent» | route smoke |
| Contacts | `/crm/contacts` | SALES-01 | wired | Живой route на боевом CRM API (`apps/web/src/app/crm/contacts/page.tsx` → GET/POST/PATCH `/api/workspace/contacts`); в CRM-навигации. Ранее ошибочно значился «intentionally absent» | route smoke |
| Settings/Admin | `/settings`, `/admin/users`, `/admin/roles`, `/admin/audit` | ADMIN-01 | wired/partial | Role mutation disabled until implemented; forbidden/read-only states need proof | route smoke + visual matrix |
| Finance | TBD | FIN-01 | deferred | Активный beta scope не подтвержден; не блокировать если finance hidden/deferred явно | нет |

## P0 gaps

- `pnpm qa:runtime`, `pnpm test:e2e:smoke`, `pnpm qa:route-smoke`, `pnpm qa:visual`, `pnpm qa:a11y`, `pnpm test:db`, `pnpm verify:storybook-contract` pass locally with `E2E_WEB_PORT=3000 CI=` when reusing the already-running Next dev server.
- `/dashboard` now shows an operational attention cockpit from real tasks and capacity summary, but role-specific filtering and portfolio-level risk modeling remain incomplete.
- `/projects/:id`, `/projects/:id/schedule`, `/projects/:id/resources`, and `/crm/deals/:id` use real route ids and invalid-id checks; project task create/comment/blocker and planning preview/apply have persistence proof.
- `/my-work` proves status, comment and blocker-as-waiting mutations; separate blocker entity/workflow is still missing.
- Agent safety is partially proven: confirmation loop exists, but grounded answer and failure/action audit coverage remain incomplete.

## P1 gaps

- `/crm/deals` нужен stage-change flow с persistence proof.
- Clients/deals create and handoff не доказаны (routes `/crm/clients`, `/crm/deals` живые, но write-flow QA нет).
- Empty/no-results/filter states неполные для core screens.
- Role-specific forbidden/read-only states покрыты слабо.
- Demo/task names and fake affordances нужно зачистить перед visual readiness gate.

## P2 gaps

- Finance remains deferred and hidden from runtime navigation.
- Narrow/desktop screenshots now cover production-critical runtime routes through `pnpm qa:visual`.
- Component readiness remains `needs-adaptation` unless the component has runtime interaction evidence.

## Deferred: коммуникации/AV (перенос §9 self-hosted-AV эпика)

Перенесено из `docs/plans/communications-self-hosted-av-epic.md` §9 (пробелы вне всех слайсов эпика). Все пункты — `deferred`, вне beta-scope, отнесены к Фазе 6 эпика / будущим эпикам. Медиа-control-plane и live-звонок реализованы (`/calls/:roomId`, `/communications/*`), но перечисленное ниже не закрыто:

| Пункт | Статус | Примечание (проверено по коду) |
| --- | --- | --- |
| Транскрипция / субтитры / AI-резюме звонков | deferred | Отдельный эпик; в рантайме нет |
| Mobile/responsive call-UI на 390px | deferred | Не покрыто |
| Тест NAT / symmetric-firewall relay-fallback | deferred | Ни один слайс не тестирует relay |
| Матрица браузеров (Safari VP9/setSinkId/getDisplayMedia) | deferred | Не подтверждено |
| a11y живого видео (не только статичной стори) | deferred | Только статичная стори покрыта |
| Load/scale/ёмкость (участников на комнату/хост) | deferred | Нет нагрузочных заметок |
| Janitor застрявших egress | **реализовано (не deferred)** | Обработчик `calls.recording_janitor` реальный — реапит записи, застрявшие в `recording`, и останавливает осиротевший egress (`apps/api/src/backgroundJobs/jobHandlers.ts:64-108`); расписание засеяно при старте (`ensureDefaultBackgroundJobSchedules.ts:15`, Блок 8) |
| Противоречие модели TURN-кредов между слайсами | deferred (resolve до Фазы 1 записи) | Открытое решение эпика §7 |
| Схема LiveKit participant identity (`sub == userId`) | deferred | Подтвердить до чата Фазы 3 |
| Сведение записи в один MP4 (ffmpeg-compose) | deferred (v1 — per-track) | `calls.recording_compose` НЕ no-op: kind намеренно отсутствует в реестре, постановка в очередь честно отклоняется 501 (`jobHandlers.ts:129-135` + `NOT_IMPLEMENTED_BACKGROUND_JOB_KINDS`); продукт принимает per-track файлы до реализации ffmpeg-джобы |
| Серверная запись (egress start/stop) из UI | **реализовано (не deferred)** | Н11 закрыт: клиент `startRecording`/`stopRecording` → POST `.../recordings/start`, `.../recordings/groups/:id/stop` (`apps/web/src/lib/call/call-client.ts:143,157`); кнопка «Запись» в виджете рендерится только при работающем пути (`recordingAvailable`, `call-stage.tsx:145-158`) |

## Component readiness

| Component/surface | Статус | Решение |
| --- | --- | --- |
| Runtime shell / navigation | approved-for-foundation | Использовать, но проверить fake/dead side nav items перед beta |
| Dashboard block | approved-for-runtime-foundation | Runtime адаптирует bento/cards под реальные attention data; дальше улучшать role filters и risk hierarchy |
| Agent cockpit block | needs-adaptation | Хорошая база; нужно grounded context, failure/result audit polish |
| Deals block | needs-adaptation | Stage persistence есть; нужны richer next actions, create и handoff evidence |
| Projects list block | needs-adaptation | Нужны filters/open/detail path and realistic empty states |
| My Work block | approved-for-runtime-foundation | Status/comment/blocker controls сохраняются через backend; нужны task detail и forbidden-state evidence |
| Demo project planning blocks | adapted-with-gaps | Timeline preview/apply использует backend planVersion; direct manipulation/conflict UI еще неполные |

## QA proof required

| Screen | Required proof before beta-ready |
| --- | --- |
| `/dashboard` | Seeded risk/overdue/overload appears; no console/pageerror/API failures; desktop/narrow screenshots |
| `/agent` | Grounded answer references real entities; proposal has confirmation; apply mutates; audit/result visible; failure path |
| `/my-work` | Assigned task visible; status/blocker/comment mutation persists; forbidden state |
| `/projects` | Projects and templates load without permission trap; filters/open project; empty/error/forbidden |
| Project detail | Open real project by id; add/update task; blocker visible; reload proof |
| Timeline | Task renders in date range; date/status update persists |
| `/crm/deals` | Pipeline loads with only used catalogs; stage move persists; no hidden clients/projectTypes dependency |
| `/crm/clients` create | Client/deal create, duplicate/validation/save error |
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
