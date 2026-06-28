# Глобальный аудит оставшейся работы — фронт + бэк (2026-06-28)

> Сгенерировано многоагентным sweep'ом (10 параллельных сканеров по измерениям: prod-полнота фронта, Storybook-vs-prod парность, маркеры, качество/a11y/i18n, полнота API-роутов, бэк-маркеры, тест-гэпы, comms/AV-эпик, data-wiring, доки/планы) + синтез. Все находки с evidence (file:line). 90 находок → ~60 уникальных.

## Сводка

| Область | P1 | P2 | P3 | Итого |
|---|---|---|---|---|
| Фронтенд | 1 | 17 | 12 | 30 |
| Бэкенд | 0 | 7 | 6 | 13 |
| Инфра/CI | 0 | 3 | 2 | 5 |
| Данные/проекции | 0 | 3 | 2 | 5 |
| Доки/планы | 0 | 5 | 2 | 7 |
| **Итого** | **1** | **35** | **24** | **60** |

Единственный P1 — мёртвая левая навигация в проде (найдена тремя независимыми сканерами). Основная масса P2 концентрируется в двух кластерах: (а) Storybook-only surfaces без прод-роутов и мок-данные, протекающие в живой продукт; (б) незавершённые фазы comms self-hosted A/V эпика (realtime-bus, webhook-reconcile, janitor, moderation, recording compose).

## Топ-10 что осталось крупного

1. **Мёртвая левая навигация в проде** — весь основной nav (`href="#"`+preventDefault) не ведёт никуда; даже построенные экраны достижимы только через in-content ссылки/URL. Блокирует юзабилити всего продукта. (FE, P1)
2. **Нет выхода из аккаунта и avatar-меню в проде** — после логина пользователь не может разлогиниться (logout есть только в Storybook-блоке). (FE, P2)
3. **Comms-продукт (чаты/треды/composer/уведомления/встречи) без прод-роутов** — сайдбар рекламирует фичи с бейджами, которых в живом приложении нет; только Storybook-двойники. (FE, P2/L)
4. **Звонок недостижим из UI** — `CallRuntimeView` рабочий, но нет списка звонков, нет кнопки start/join, nav-пункт мёртв; вход только ручным URL `/calls/[roomId]`. (FE, P2)
5. **Мок-данные протекают в прод-runtime** — Gantt даты (`05.2026`), progress 0.4, ассайни «ИИ», Kanban «Задача N», ресурсы «Ресурс 1..N», сайдбар-бейджи. Рендерятся как настоящие. (FE/Данные, P2)
6. **Comms realtime-транспорт (SSE/presence/ring) не построен** — нет шины событий вне звонка; всё на polling; блокирует ring-UI, presence, fan-out чата/уведомлений. (BE, P2/L)
7. **LiveKit webhook реконсилит только `egress_ended`** + **нет janitor’а зависших egress** — roster/presence чисто клиентские; крэш клиента оставляет session «active» и egress, который продолжает писать/биллить навсегда. (BE, P2)
8. **BEM/legacy CSS всё ещё пронизывает живой код** (~3.5k строк bem.css+supplement в каждый бандл; shell/login/call/типографика) — мигрированы только таблицы. Это и есть ядро дизайн-долга. (FE, P2/L)
9. **Дизайн-пивот shadcn+TW+bento заявлен следующим эпиком, но заморожен** на чекпоинте; часть текущего WIP будет переписана. (Доки, P2/L)
10. **Прод-готовность media-плоскости не закрыта** — coturn недеплоебелен (placeholder-конфиг, нет TLS/realm/IP), readiness покрывает только LiveKit (coturn/egress не зашиты, fail-open), relay-fallback не тестируется — задокументированный no-go для прод go-live с `provider=livekit`. (Инфра, P2)

---

## Фронтенд

### P1
- **Мёртвая левая навигация на всех экранах** (data-wiring) — каждый пункт рендерится как `<a href="#" onClick={e=>e.preventDefault()}>`; в `sidebar-nav.ts` ни у одного item нет href; AppSidebar оборачивает весь RuntimeScreenView. Дашборд/Календарь/Задачи/Чаты/Звонки/Встречи/Уведомления/Интеграции/Отчёты не навигируют; нет aria-current. — `apps/web/src/shell/app-sidebar.tsx:39-48`, `apps/web/src/views/config/sidebar-nav.ts:10-47`, `views/layout/workspace-chrome.tsx:48-49` — P1/M

### P2
- **Command palette + topbar Export/Create нефункциональны** (disabled) — пункты палитры только закрывают диалог (нет router.push), search readOnly; топбар-кнопки «Экспорт»/«Создать» hard-disabled с тултипами «Демо Storybook» рендерятся в живом проде. — `shell/command-palette.tsx:24-38`, `views/layout/workspace-chrome.tsx:30-37`, `runtime-screen-view.tsx:117` — P2/M
- **Comms surfaces (channels/thread/composer/notifications/meetings) без прод-роутов** (missing) — существуют только как Storybook-блоки; нет ни `/chats`, ни `/notifications`, ни `/meetings`; сайдбар рекламирует бейджами 3/7. Чистые виджеты (ConversationView/MessageComposer) реальны, но не собраны в страницу и не подключены к данным. — `views/blocks/chat-screen-blocks.tsx`, `comms-collab-blocks.tsx`, `screen-view.tsx:93-98`, `catalog.ts:57-62` — P2/L
- **Живой звонок без точки входа** (data-wiring) — нет `/calls` списка, нет кнопки start/join, nav-пункт «Звонки» мёртв; roomId должен приходить из meetings/comms, которых нет. — `apps/web/src/app/calls/[roomId]/page.tsx`, `call-runtime-view.tsx` — P2/M
- **Корневой `/` — Phase-1 заглушка** (stub) — рендерит статический «KISS PM — design-v3 foundation» вместо редиректа на /dashboard; middleware.ts отсутствует. — `apps/web/src/app/page.tsx:1-15` — P2/S
- **Справочники (clients/contacts/products) без прод-роута** (missing) — только `entities-block.tsx`; ветка «Справочники» в breadcrumbs недостижима. — `screen-view.tsx:73-75`, `catalog.ts:39-41,158-181` — P2/L
- **Project deep-dive экраны (baseline/scenarios/kpi/audit/calendars) без роутов** (missing) — из 7 заявленных прод-роуты есть только timeline+resources; пять «Отчёты» — только Storybook-блоки. — `views/blocks/project-{baseline,scenarios,kpi,audit,calendars}-block.tsx`, `runtime-screen-view.tsx:46-47,395` — P2/L
- **Settings — read-only профиль-карточка** (partial) — нет вкладок Уведомления/Интеграции/Оплата и ни одного мутирующего контрола; в Storybook (settings-block) они есть. — `runtime-screen-view.tsx:560-562` — P2/M
- **Редактирование ролей в Admin отключено** (disabled) — RolesPanel read-only, «изменение ролей отключено до отдельного сценария»; нельзя создать/изменить роль. — `runtime-screen-view.tsx:549,952` — P2/M
- **Мок-данные в прод-runtime** (mock) — Gantt: progress 0.4 и ассайни «ИИ» для всех строк + фейковые даты `DD.05.2026` и колонка «—»; Kanban: «Задача N» + «ИИ»; AssignmentsTable: «Ресурс {index+1}». Рендерятся как реальные. — `runtime-screen-view.tsx:512,630,1070`, `widgets/gantt/gantt.tsx:21-24,122-126` — P2/M
- **Нет avatar-меню и logout в проде** (missing) — единственный «Выйти» — в `avatar-menu-block.tsx`; прод-топбар показывает статичный аватар-стек, футер сайдбара — статичный юзер; нет вызова logout. После логина выйти из UI нельзя. — `views/blocks/avatar-menu-block.tsx:63-66`, `workspace-chrome.tsx:38-42`, `app-sidebar.tsx:64-73` — P2/S
- **9 surfaces помечены UI-only (бэкенд не подключён)** (data-wiring) — kpi/audit/baseline/scenarios/notificationCenter/chat/calls/meetings/notifications: вьюхи есть, реальных данных не читают; баннер «Превью — бэкенд не подключён». Канонический реестр оставшейся FE-работы. — `apps/web/src/lib/featureFlags.ts:1-20` — P2/L
- **i18n EN-leak: businessStatus() показывает сырые enum-токены** (missing) — маппинг ~25 значений, остальное падает в regex-замену сепараторов → английский: `opportunity.created`→«opportunity created», `project.activated`, `management_action.denied`; даже happy-path activation леакает (map ждёт `opportunity.activated`, бэкенд шлёт `project.activated`). Видно на Audit/Dashboard journal. — `runtime-screen-view.tsx:1039-1067,397,875,918,942` — P2/M
- **BEM/legacy CSS пронизывает живой код** (tech-debt) — globals.css тянет bem.css (2220) + bem-supplement.css (1342) в каждый бандл; shell/login/call/типографика/45 BEM-классов в runtime-screen-view. Мигрированы только DataTable. — `app/globals.css:7-8`, `runtime-screen-view.tsx`, `app-sidebar.tsx:27-72`, `call-runtime-view.tsx:33-81` — P2/L
- **403/Forbidden не обрабатывается; ForbiddenState/EmptyState/IlluState не используются в live** (partial) — StateGate ловит только loading/error/empty; per-query 403 падает в generic ErrorState; пустая ветка — инлайновый BEM `state-illu`. Готовые shadcn-компоненты подключены только в Storybook. — `runtime-screen-view.tsx:578`, `components/ui/{forbidden,empty,illu}-state.tsx` — P2/M
- **planning-client пакет на паузе, не подключён** (disabled) — типизированный domain-client (~75%, REST/SSE 1:1) исключён из build-graph; live-логика плана продублирована инлайном в runtime-screen-view. — `packages/planning-client/PAUSED.md`, `docs/audit/planning-packages-assessment.md` — P2/M
- **planning-gantt-ui ~35% «ложная готовность»** (stub) — headless Gantt-скелет без интерактивного слоя: ни один компонент не эмитит onIntent, нет адаптера к planning-client. — `packages/planning-gantt-ui/PAUSED.md` — P2/L
- **Дизайн-пивот shadcn+TW+bento заморожен** (todo) — заявлен следующим эпиком, заморожен на чекпоинте; comms front-end deepenings (call-engine reducer, camera seam, `<VideoSlot>`) заблокированы неутверждённой Storybook-fidelity. — `PAUSED.md:3-5,35-58,41-42` — P2/L

### P3
- **Топбар-bell — no-op** (stub) — нет onClick/href. — `shell/app-topbar.tsx:18-20` — P3/S
- **Сайдбар-бейджи — захардкоженные мок-числа** (mock) — 24/4/7/13/3/7/1 не отражают реальное состояние. — `views/config/sidebar-nav.ts:17-44` — P3/S
- **TaskDetailSheet — только просмотр** (partial) — нет edit/status/comment из шита; полной карточки задачи в проде нет (нет `/tasks/[id]`). — `runtime-screen-view.tsx:640-668` — P3/M
- **Create-task modal (stepper) только в Storybook** (partial) — в проде урезанная inline-форма. — `views/blocks/task-create-modal-block.tsx`, `runtime-screen-view.tsx:763-808` — P3/M
- **deals/projects-block: disabled-фильтры + сегменты, меняющие только текст** (partial) — forecast/templates/archive за тогглами не существуют. — `views/blocks/deals-block.tsx:59,94`, `projects-list-block.tsx:110,118` — P3/S
- **settings-block: Интеграции/Оплата без контента, Save — no-op** (stub) — `views/blocks/settings-block.tsx:28,43-51` — P3/M
- **my-work-block: режим «Список» — текст-заглушка** (stub) — (прод MyWorkRuntime реализует реальную TaskTable; гэп только в галерее). — `views/blocks/my-work-block.tsx:27-28` — P3/S
- **01-dashboard story → generic Phase-2 placeholder с no-op кнопками** (stub) — `screen-view.tsx:46-105,109` — P3/S
- **Raw BEM `badge badge--secondary` вместо shadcn Badge в DealsFunnel** (tech-debt) — `runtime-screen-view.tsx:810` vs `:833` — P3/S
- **Card/detail экраны показывают TableSkeleton при загрузке** (partial) — форма shape не совпадает. — `runtime-screen-view.tsx:578,369,396,258,562,531` — P3/S
- **UI-polish журнал: открытые confirm-dialog/kebab/tooltip/badge** (todo) — `docs/design/ui-polish-gaps.md:18-20,29` — P3/S
- **Полная карточка задачи (03-task-card) только в Storybook** (partial) — `screen-view.tsx:49-55`, `catalog.ts:32` — P3/M

---

## Бэкенд

### P2
- **Comms realtime-транспорт (SSE/presence/ring) не построен** (missing) — SSE есть только у planning; заявленных `communicationEventBus.ts`/`communicationRedisEventBus.ts`/`communicationEventsRoute.ts` нет; comms через REST-polling. Блокирует ring-UI, presence, fan-out. — `communicationRealtimeRoutes.ts:100,396`, plan `docs/plans/communications-self-hosted-av-epic.md:38,41,93` — P2/L
- **LiveKit webhook реконсилит только `egress_ended`** (partial) — `{kind:'other'}` для всех прочих; room/participant/track lifecycle не реконсилится → roster/presence чисто клиентские. — `communications/recording/livekitEgressProvider.ts:114`, `communicationRecordingWebhookRoute.ts:29-37` — P2/M
- **Нет janitor’а для egress/recordings в `recording`** (missing) — код многократно обещает «the janitor reaps», но reaper’а нет; недоставленный `egress_ended` оставляет строку `recording` навсегда (запись/биллинг). — `recordingWorkspace.ts:200,262,285,398`, runbook `:92` — P2/M
- **Background-job no-op handlers** (stub) — `notification.dispatch` (нет email/push), `search.projection_rebuild` (нет full-text index), `calls.recording_compose` (ffmpeg deferred). — `apps/api/src/backgroundJobs/jobHandlers.ts:41-59,130-135` — P2/M
- **In-call moderation (kick/mute/lock) не построена** (missing) — `callControlActions.ts` отсутствует; хост не может убрать/замьютить/залочить комнату server-side. — `communicationRealtimeRoutes.ts:47-413`, plan `:40,48` — P2/M
- **Media readiness покрывает только LiveKit** (partial) — coturn без readiness, egress non-gating; противоречит prod hard-fail списку. — `serverReadiness.ts:58-80`, `docs/plans/KISS PM production plan.md:996` — P2/S

### P3
- **callRecordingJanitor egress-stop loop — best-effort** (tech-debt) — `jobHandlers.ts:95-123` — P3/S
- **connector.sync — no-op boundary** (stub) — `jobHandlers.ts:46-54` — P3/L
- **Калл/видео выключены по умолчанию** (disabled) — без `KISS_PM_VIDEO_*` join-token 501; легитимный config-gate. — `videoProvider.ts:75-81,150` — P3/S
- **In-call chat persistence (call-chat.ts) не построена** (missing) — нет server-contract для conversationId call_room. — plan `§7.5` — P3/M
- **Транскрипция/субтитры/AI-резюме — отдельный эпик, не начат** (missing) — plan `§9:110` — P3/L
- **`applyGovernedPlanningDelta` — реализован, но без вызывающих и тестов** (tech-debt) — мёртвая дубль-экстракция. Подключить с тестами или удалить. — `governedPlanningApply.ts:53` — P3/S

> **Не баг (контекст):** ~150 `*_not_configured` 501 — DI-guards для in-memory/test datasource; с Postgres все методы есть, роуты функциональны. — `inMemoryTenantDataSource.ts`, `repositories.ts:190-211`

### Тесты (бэкенд)
- **Redis cross-instance event-bus только CI-skipped smoke-тестом** (test-gap) — `it.skipIf(!redisUrl)`; CI не поднимает Redis → регрессия fan-out пройдёт зелёной. — `planningRedisEventBus.smoke.test.ts:9`, `release-gate.yml:45-58` — P2/M
- **Реальный LiveKit egress-адаптер без тестов** (test-gap) — `receiveWebhook` (проверка подписи = security boundary), ns→sec, env-gating не исполняются ни одним тестом. — `livekitEgressProvider.ts:55-163` — P2/M
- **HTTP-роут webhook’а не покрыт e2e** (test-gap) — fail-closed 401, empty-egress→failRecording, tenant-resolve не проверены. — `communicationRecordingWebhookRoute.ts:14-78` — P2/S

---

## Инфра/CI

### P2
- **coturn — reference-конфиг, не деплоебелен** (partial) — placeholder realm/secret/IP, закомментированы external/listening-ip, нет coturn-сервиса в compose, `turn.enabled=false`. TURN-креды выдаются, но указывают на неразвёрнутый сервер → ~10-15% за symmetric NAT без relay. — `infra/coturn/turnserver.conf`, `infra/livekit/livekit.yaml:36` — P2/M
- **Phase 10 production hardening «в работе»** (partial) — security/privacy/perf/backup-restore/secrets-validation/health-readiness/load-smoke; exit-gate не закрыт. — `docs/12_ФАЗОВЫЙ_ПЛАН.md:143-151` — P2/L
- **Launch & monetization: только infra-research + ценовые гипотезы** (missing) — billing/payments/self-serve не спланированы; провайдер не выбран. — `docs/infra/ru-managed-kubernetes-comparison.md`, `docs/marketing/07_PRICING...:1-12` — P2/L
- **PAUSED-чекпоинт закоммитил большой untracked-heap «как есть»** (tech-debt) — app-routes/marketing/docs/e2e/proof-*.png; merge-time hazard, требует разбора. — `PAUSED.md:24-33` — P2/M

### P3
- **Нет плана масштабирования — single-node media** (missing) — нет multi-node LiveKit, Redis-cluster, sizing. GA-блокер. — `infra/livekit/livekit.yaml`, plan `§9:110` — P3/L
- **NAT/symmetric-firewall relay-fallback не тестируется** (test-gap) — #1 причина «connected but no media». — plan `§8:104` — P2/M

---

## Данные/проекции

### P2
- **Planning read-model project-проекция опускает title/name/status** (data-wiring) — таблица projects ИМЕЕТ title, но он не копируется в `snapshot.project`; Gantt/Resources несут мёртвый fallback и шлют второй запрос ради имени. — `planningRepository.ts:371-379`, `planningReadModel.ts:34`, `apiDocs/schemas/planning.ts:30-50` — P2/S
- **`assignment.resourceId` не резолвится в имя; read-model дропает resources** (data-wiring) — snapshot содержит resources (tenantUsers с `.name`), но `createPlanningReadModel` их выкидывает → AssignmentsTable рендерит «Ресурс {index+1}». — `planningReadModel.ts:33-48`, `domain/src/planning/types.ts:69-77` — P2/M
- **Capacity summary без minute-тоталов; тайл «Перегруз, ч» читает несуществующее поле** (data-wiring) — API отдаёт counts+heat; FE-тип объявляет 5 полей-дрейфа (`totalOverloadMinutes`), которых API не шлёт → тайл всегда 0. — `domain/src/planning/employeeCapacity.ts:69,491`, `capacity/registerCapacityRoutes.ts:83-105`, `runtime-screen-view.tsx:475,1069` — P2/S

### P3
- **Нет server-side CRM pipeline-проекции (opportunities по стадиям)** (missing) — нет read-model с per-stage counts/sum/forecast; унификация (Direction 2) на stacked-ветке PR #205, не в trunk. — `projectIntakeRoutes.ts:48`, `crmRepository.ts:285-322` — P3/L
- **Dashboard activity journal иногда пуст** (data-wiring) — наполнение audit-events feed не верифицировано. — `docs/design/ui-polish-gaps.md:38` — P3/S

---

## Доки/планы

### P2
- **Comms-эпик Phases 2-6 частично не построены** (missing) — sticker-picker, mention-menu, lib/call/call-chat.ts отсутствуют; нет `/comms` роута. — `docs/plans/communications-self-hosted-av-epic.md:55-63` — P2/L
- **5 нерешённых open decisions перед Phase 1/5** (todo) — TURN embedded vs standalone; SSE vs WS; S3/R2; dev-compose bridge vs host-net; conversationId для in-call chat. — `...av-epic.md:90-96` — P2/S
- **Deferred R1: LiveKit room-webhooks для authoritative presence** (missing) — `PAUSED.md:54-56` — P2/M
- **Comms/Finance/Clients/Contacts экраны помечены deferred, не wired** (disabled) — должны достичь «wired» до beta. — `docs/beta/screen-readiness-matrix.md:74-81` — P2/L
- **Beta runtime-экраны «wired/partial» с поименованными гэпами** (partial) — dashboard role-фильтры; agent grounded-context; My Work blocker-domain; projects фильтры/templates; project detail owner/date edit; planning stale-conflict UI; admin role-mutation. — `docs/beta/implementation-backlog.md:9-29` — P2/M

### P3
- **API Coverage Ledger: L2/L3 не достигнут; A/V media-plane вне OpenAPI** (partial) — `docs/api/99_COVERAGE_LEDGER.md:49-65` — P3/M
- **Comms cross-cutting гэпы отложены в Phase 6 / future** (test-gap) — transcription, mobile 390px call-UI, NAT relay, browser-matrix, live-video a11y, load/scale. — `...av-epic.md:108-110` — P3/L

---

## Рекомендованный порядок

**Принцип:** сначала закрыть user-facing дыры в живом проде (дёшево, высокий эффект), затем — незавершённые бэкенд-фазы comms, в конце — tech-debt/инфра/GA.

1. **Навигация и shell (P1, дёшево, разблокирует всё)** — оживить sidebar (href+router, aria-current), command-palette routing, avatar-меню с logout, редирект `/`→`/dashboard`. Без этого продукт неюзабелен.
2. **Убрать «Демо Storybook» из прод-чрома** — подключить или спрятать Export/Create/bell в проде; убрать мок-бейджи.
3. **Задавить мок-данные, протекающие в реальные экраны** — FE + бэкенд-проекции одним заходом: planning read-model title + resources-проекция, capacity minute-тоталы, реальные Gantt-даты/progress/assignee, Kanban id.
4. **i18n EN-leak businessStatus** — расширить маппинг + починить `project.activated`.
5. **403/Forbidden + правильные skeleton-формы** — подключить ForbiddenState/EmptyState/IlluState в live.
6. **Comms бэкенд-ядро** — realtime SSE-bus (presence/ring/fan-out) → webhook lifecycle-reconcile + janitor зависших egress (билинг-риск!) → moderation kick/mute/lock. Только после — прод-роуты чатов/встреч/звонков.
7. **Закрыть тестовые дыры вокруг денег/безопасности** — HTTP-тест webhook-роута, unit egress-адаптера, Redis-bus в CI.
8. **Media-плоскость к prod go-live** — coturn деплой (TLS/realm/IP), readiness fail-closed для coturn/egress, тест NAT relay-fallback.
9. **Tech-debt и эпики** — дизайн-пивот shadcn+TW+bento (с него BEM-чистка + ревайв planning-client/gantt-ui), recording_compose ffmpeg, connector.sync, transcription, scaling, launch/billing. Удалить/подключить `applyGovernedPlanningDelta`.
10. **Гигиена WIP** — разобрать PAUSED-heap по темам до merge; дописать API Coverage Ledger.

### Честно о покрытии (что сканеры не достали)
- Ни один сканер не запускал приложение/Storybook/Playwright — FE-выводы статические (но `href="#"`/preventDefault/disabled конклюзивны из исходников).
- Не проверена a11y leaf-виджетов (kanban/gantt/chat/call), контраст, focus-trap; marketing/landing.
- Не сделан method-by-method diff всех ~150 методов `ApiTenantDataSource` против Postgres (spot-check указывает на полноту, не доказывает каждый optional-метод).
- Web call-engine internals (screen-share/reconnect/virtual-background) оценены частично.
- CRM pipeline-ветка (PR #205) не инспектировалась из текущего worktree.
- Покрытие тестов не измерено (нет coverage-tooling); doc-фазы 14-47 взяты по статусу из doc 12/README.
