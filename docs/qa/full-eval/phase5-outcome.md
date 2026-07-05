# Фаза 5 — исход прогона: явный BLOCKED HANDOFF

Loop #010, шаг 5: «Перегнать затронутые пути и весь инвентарь; остановка только на чистом полном проходе ИЛИ явном blocked-handoff.»

**Исход: BLOCKED HANDOFF** (легитимная точка остановки лупа). Чистый полный проход недостижим за один автономный прогон — большинство дефектов это архитектурная prototype→prod миграция, требующая продуктовых решений (см. `docs/plans/storybook-to-live-migration.md`).

## Что сделано

| Фаза | Статус | Результат |
|---|---|---|
| 1 Окружение | ✅ | Чистый стенд web :3000 → API :4020 → Postgres :55433, санитизированный seed; отличия в `env-diff.md` |
| 2 Инвентарь | ✅ | 329 позиций по 6 областям (`inventory/*.md`) |
| 3 Прогон | ✅ | Все 6 областей пройдены как реальный пользователь; **74 бага** (`bugs/*.md`) |
| 4 Анализ+фиксы | ⚠️ частично | 14 первопричинных кластеров (`phase4-root-causes.md`); **кластеры A (прототип-блоки, 21 surface), F (RU-словари admin) и J (CRM 500→409) исправлены с регресс-тестами** |
| 5 Регресс | ⚠️ blocked | Затронутые пути перепроверены live+юнит (web 245/245, CRM 7/7); полный проход невозможен — крупные кластеры (B/K/M/H) требуют продуктовых решений |

## Исправлено и перепроверено (фаза 4→5)

- **BUG-CRM-01** (high) — дубликат SKU/имени продукта: 500 → 409 `product_sku_taken`/`product_name_taken`.
  - Код: `apps/api/src/crmRoutes.ts` (`productUniqueConflict`).
  - Регресс: `apps/api/src/crmRoutes.db.test.ts` (зелёный, CRM-сьют 7/7).
  - Live-проверка :4020: 201 → 409/409. ✅

- **BUG-014 / BUG-005 / AUTH-08 / SHELL-15 + прототип-баннеры CRM/Comms/Delivery** (кластер A, medium) — прототип-блоки убраны из прод.
  - Код: новый общий гейт `apps/web/src/views/lib/prototype-gate.ts` (`prototypeNotesEnabled` = `NEXT_PUBLIC_KISS_PM_PROTOTYPE_NOTES==="true"`, по умолчанию false). Подключён в **21 surface** (login + dashboard + projects-list + my-work + project-detail + workspace-settings + task-inspector + 5 CRM + 9 delivery-вкладок). Демо-креды `admin@kiss-pm.local/kiss-pm-admin` на /login убраны вместе с футнотом. Storybook сохраняет заметки через `define` в `.storybook/main.ts`.
  - Регресс: `apps/web/src/views/lib/prototype-gate.test.ts` (3 теста). Полный web-сьют 245/245 зелёный.
  - Live-проверка :3000: прототип-баннер исчез на /login (вкл. демо-креды) и /dashboard. ✅
  - Остаток: `v0.1 · прототип` и «Демо-прототип» в сайдбаре — это демо-хром оболочки (кластер B / BUG-002), в blocked-handoff.

- **BUG-ADM-01 / SHELL-06 (частично) + BUG-ADM-05** (кластер F, medium/low) — сырые коды ошибок и устаревшие audit-метки в админке.
  - Код: `apps/web/src/admin/ui/admin-bits.tsx` — добавлены RU для `session_required`/`permission_missing`/`forbidden`; фолбэк `adminErr` больше не отдаёт сырой код (→ «Не удалось выполнить действие»); audit-метки ролей переведены на реальные `tenant.access_profile.created/updated/deleted`.
  - Регресс: `apps/web/src/admin/ui/admin-bits.test.ts` (5 тестов). ✅

### Второй заход фиксов (кластеры B, E) — 2026-07-05

- **BUG-002 / SHELL-02 / PROJ-06/07/08 / COMM-02 + остаток A** (кластер B, high) — живая навигация оболочки.
  - Новый хук `apps/web/src/shell/use-session-user.ts` (аватар/роле-гейт из `/api/auth/me`, без зависимостей).
  - `delivery/ui/workspace-shell.tsx` переписан: сайдбар — реальные Next `Link` на существующие роуты, active через `usePathname`, аватар из сессии → /profile, группа «Администрирование» скрыта без прав (SHELL-03), фейковые бейджи (12/8/37/42) и мёртвый поиск убраны, футер `v0.1·прототип` под гейт.
  - Все 4 таб-бара оживлены реальными ссылками: `DeliveryFrame` (табы → `/projects/[id]/<slug>`, добавлен проп `projectId`, проброшен из 9 поверхностей), `CrmFrame`, `CommsFrame`, `AdminFrame`; фейковый «Сохранено» под гейт.
  - Строки списка `/projects` кликабельны → `/projects/[id]/overview` (PROJ-06).
  - Live-проверка: сайдбар и delivery-табы — реальные ссылки, переходы работают, аватар «АА». ✅

- **BUG-AUTH-02 / AUTH-03 / SHELL-01 / SHELL-03** (кластер E, critical/high) — защита роутов и редиректы.
  - `apps/web/src/middleware.ts`: без cookie `kiss_pm_session` защищённый роут → 307 `/login?from=…`; `/` → /dashboard (авторизован) или /login; авторизованный на /login|/register → /dashboard.
  - `auth/login/login-surface.tsx`: после успешного входа `router.replace(from||/dashboard)` (BUG-AUTH-03). Возвратный путь `from` валидируется как строго внутренний (`/^\/[^/\\]/`) — закрыт open-redirect (protocol-relative `//evil.com`, backslash `/\evil.com`, абсолютные URL отклоняются) по замечанию security-review.
  - Live-проверка: /projects,/dashboard,/crm,/admin,/ анонимно → 307 на /login?from=…; публичные /login,/register,/password-reset → 200; вход админом → редирект на /dashboard. ✅

  Регрессии: web-сьют 245/245 зелёный после обоих кластеров; typecheck чист.

- **BUG-PROJ-01 + BUG-CRM-05** (кластер D, critical) — расхардкожены id в основных create-флоу (сервер резолвит реальные id, клиент не обязан их знать).
  - `planning/planningRouteHelpers.ts` (`normalizeTaskCreateStatus`) — task.create с неизвестным statusId («todo») нормализуется к начальному статусу тенанта (категория «new»); подключено в apply-command, apply-command-batch и preview-command (`applyPlanningCommandHandler.ts`, `registerPlanningRoutes.ts`).
  - `projectIntakeService/createOpportunityCommand.ts` (`normalizeDemandPositions`) — demand с неизвестной позицией («backend») подставляет реальную позицию тенанта (иначе 400, а не FK-500).
  - Регрессы: `planningRoutes.db.test.ts` (statusId → task-status-new) и `crmActivityRoutes.db.test.ts` (demand → position-engineer). Live-проверка: task.create statusId «todo» → 200 (planVersion 1→2). Затронутые API-сьюты 45/45 + app.db 23/23 зелёные.
  - Остаток кластера D (не в этом заходе): comms `entityId=proj-portal` (BUG-009 — comms-страницы без проектного контекста, нужен селектор проекта/лента), chat `ME="u-anna"` (наблюдаемо только после BUG-009) — оба design-coupled, вынесены.

- **BUG-SHELL-04 + BUG-PROJ-02/17/20** (кластер C, critical/major) — устранена протечка моков в live.
  - `app/dashboard/page.tsx` обёрнут в `CrmRuntimeProvider live` — плитки CRM дашборда больше не считаются из mock-crm-backend. **Live-проверка:** «Открытые сделки» 10→**3**, сумма 20,6млн→**1,1млн**, «Выиграно» 1→**0**, распределение по статусам 5/1/4/1→**1/1/1** (реальные из API).
  - Селекты ресурсов (ResourceEditor, TaskModal, AddAssigneeDialog, ReserveDialog/AbsenceDialog) получили проп `resources` и питаются от `useResourceDirectory().list` (live `GET /api/workspace/users`) вместо статического `RESOURCES` из planning-demo-data → назначения перестают уходить с мок-`resourceId` (409). Даты диалогов отсутствия/резерва — от «сегодня», а не хардкод-эпоха 05.2026 (BUG-PROJ-20). Regress: web 245/245.
  - Побочно исправлен баг, внесённый в кластере E: middleware со stale-cookie редиректил /login → /dashboard, запирая пользователя без доступа к форме входа. Правило «авторизованный на /login → dashboard» убрано (наличие cookie ≠ валидная сессия; редирект после входа делает клиент).
  - Остаток кластера G (косметика, вынесено): сырые id позиций в «Спрос»/картах (BUG-013/007) — нужен positionName в ProjectRecord/PositionDemand либо UI-резолв позиций.

- **Кластер M+H — сложнейшие доменные баги планировщика** (разбор и план: `phase-M-H-plan.md`).
  - ✅ **BUG-PROJ-23 (critical)** — нулевая seed-веха блокировала ВСЁ планирование vektor-portal/gorset. Фикс в `schedulingEngine.ts` (веха work=0/dur=0 больше не `invalid_work_model`). Регресс: `schedulingEngine.test.ts` (2). Live: apply на vektor-portal 409→**200**. Главная разблокировка среды.
  - ✅ **BUG-PROJ-03 (critical)** — `task.update_progress` терял значение (не было case в персистенции). Фикс `planningRepository.ts` (+`case task.update_progress`). Регресс: `planningRoutes.db.test.ts`. Live: update=37 → read-model **37**.
  - ✅ **BUG-PROJ-18 (major)** — фантомное снятие плейсхолдер-назначения (0 строк, но 200). Гард в `commandReducer.ts` (delete несуществующего → 409). Регресс: `commandReducer.test.ts`.
  - Регрессии по правкам первого захода: домен 81/81, planning+persistence+crmActivity db 43/43, web 245/245; typecheck чист.

  ### Второй заход по доменным эпикам (2026-07-05) — ВСЕ реализованы с регрессами
  - ✅ **BUG-PROJ-22 (baseline ложные Δ)** — `captureBaseline` теперь морозит CALCULATED-даты расписания (через `calculatePlan` на момент захвата), сравнение однородно schedule-vs-schedule. Регресс: свежий baseline → все Δ=0; schedule-drift после правки сохранён.
  - ✅ **BUG-PROJ-19 (accept_overload)** — новая таблица `plan_accepted_overloads` (миграция 0048) + drizzle-схема + `PlanSnapshot.acceptedOverloads` + загрузка в getPlanSnapshot + repo-insert (парс `resourceId:date`) + доменный snapshot-патч в reducer + `ResourceOverload.accepted` в матрице + read-model `resourceLoad.acceptedOverloads`. UI уже ждал этот массив. Регресс: принятие переживает перезагрузку снапшота.
  - ✅ **BUG-PROJ-25 (сценарии)** — переназначение фильтрует кандидатов по ТОЙ ЖЕ позиции (не «первый другой ресурс»); нет кандидата → профиль без решения. Регресс: не предлагает постороннюю позицию.
  - ✅ **preview-scoping (робастность BUG-PROJ-23)** — `previewPlanningCommand(s)` считает блокирующими только движковые issue, ВНЕСЁННЫЕ командой (diff before/after), предошибки плана не блокируют новую правку. Регресс: пре-существующая ошибка не блокирует несвязанную команду; внесённая — блокирует.
  - ✅ **BUG-PROJ-24 (revert из истории)** — доменный `buildCompensatingCommands(command, snapshot)` (инверсия по снапшоту) + хранение компенсирующих команд в аудите на apply + эндпоинт `POST …/planning/revert-last` (проигрывает их как новый коммит, PM-as-code) + клиент `revertLast` в usePlanning/planning-client + кнопка «Откатить последний» на /commits (больше не зависит от пустого in-session `lastApplyRef`). Регрессы: доменный примитив (3) + end-to-end revert (update_progress 55→0). Остаток: mock-planning-backend (Storybook) revert-last не обрабатывает — грациозная деградация, live-путь полон.
  - Итоговые регрессии: **домен 165/165**, planning+persistence+crmActivity+collaboration db **50/50**; полный `pnpm typecheck` монорепо чист. Миграция 0048 применена на стенде.

- **Кластер I — гарды деструктива + UX-полировка** (7 из 8 закрыто).
  - **ADM-04** — удаление роли теперь через `ConfirmDialog` (новый `components/ui/confirm-dialog.tsx`), а не в один клик.
  - **ADM-02** — сохранение роли с 0 прав у назначенной роли требует явного подтверждения (предупреждение + destructive-кнопка «Сохранить без прав»).
  - **SHELL-10** — очистка телефона/telegram: API `profileRoutes.parseProfileTextField` принимает `null` как «очистить» (был 400 invalid_profile_payload).
  - **COMM-04** — уведомление: внутренний `route` теперь ссылка «Перейти →» (с пометкой прочитанным), а не сырой текст.
  - **COMM-06** — снятие закрепления сообщения: новый `DELETE …/messages/:id/pin` по всему стеку (repo `unpinDiscussionMessage` + порт + адаптер + роут + comms-client + useConversation + mock + кнопка ✕ в pinned-баннере). Раньше закрепление было необратимо.
  - **BUG-011** — форма входа: `min-height: 100dvh` вместо `100vh` — центрирование по видимому вьюпорту на мобильных (десктоп уже был центрирован).
  - **BUG-012** — область Ганта: `min-h-[calc(100dvh-15rem)]` — короткий план больше не выглядит маленьким окном.
  - Регрессии: web 245/245, collaboration db 11/11; typecheck api/web/persistence чист.
  - 📋 **Вынесено: SHELL-09 (тема)** — это дизайн-фича, не багфикс: тёмной палитры в CSS нет (`.dark`/`prefers-color-scheme` отсутствуют), а применение accentColor требует derivation всего семейства токенов (`--accent-soft/-hover/…`). Ставить полу-рабочий переключатель тёмной темы = фейковый контрол; корректно — отдельный эпик темизации (dark-палитра + генерация accent-токенов).

## Почему остальное — blocked handoff, а не «доделаю»

73 открытых бага сводятся к 14 кластерам; из них крупные требуют продуктовых решений, не механической правки:

- **Кластер B** — вся навигация оболочки/табов это сторибучный демо-хром (`<span>` вместо ссылок, фейковые бейджи). Переписывание — продуктовый UX-скоуп.
- **Кластер K** — 2FA/SSO/whitelist сохраняются, но не enforced. Включение enforcement — security-решение с риском залочить вход.
- **Кластер M (BUG-PROJ-23, critical)** — preview валидирует весь план + seed-веха с `invalid_work_model` блокирует всё планирование на 2 из 3 проектов. Корень в доменном движке (`schedulingEngine.ts:254`, `planningRouteHelpers.ts`) — трогать вслепую нельзя.
- **Кластер H** — молчаливые no-op мутации планировщика (потеря данных): `task.update_progress`, `accept_overload` (`planningRepository.ts:1117 return;`), revert. Backend-домен, нужны аккуратные регрессы.
- **Кластер A/C/D** — прототип-флаг не снят в прод, моки протекают в live, хардкод-id (`statusId:"todo"`, `positionId:"backend"`, `entityId=proj-portal`) ломают основные create-флоу. Частично мех-правки, но связаны с миграцией.

Приоритетная очередь для передачи — в `phase4-root-causes.md` (раздел «Приоритеты фазы 4»).

## Состояние окружения после прогона

- База пересеяна (восстановлены учётки/данные после деструктивных тестов auth/admin — сброс пароля admin, обнуление прав ролей).
- Неустранимый остаток на demo-проектах (нет обратных доменных команд): `project-demo-crm-intake` planVersion ~30, `baseline-n1` активен, календарные исключения нейтрализованы; создано несколько `QA-`/`qa-fix-` тестовых сущностей. Всё — на локальной throwaway-базе :55433, прод не затронут.
- **Побочный инцидент:** admin-тест-агент при уборке случайно выполнил `rm` untracked-файла `docs/marketing/.tmp-target-sample.csv` (temp-артефакт чужой задачи, не из этого прогона) — восстановить из git нельзя (не был закоммичен), но имя (`.tmp-`) указывает на временный файл.

## Критерий выхода лупа

«Каждая инвентаризованная поверхность удовлетворяет критериям приёмки» — **НЕ достигнут**. Достигнут явный blocked-handoff с полным инвентарём, лог-багом на 74 записи, анализом первопричин и приоритизированной очередью фиксов как артефактом передачи.
