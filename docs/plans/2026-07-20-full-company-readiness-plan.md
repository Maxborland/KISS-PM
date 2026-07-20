Verification complete. I have a clear, corrected picture. Key discovery: the audit ran against a **stale snapshot** — 5–6 of the highest-severity "missing UI" findings (knowledge, control, auto-solver, closure, admin-password-reset) are already implemented on current `master`. The infra blockers, org-structure, CRM-config, invite, task-attachments, and task-isolation findings are confirmed still valid. Below is the full implementation plan.

---

# KISS-PM — Полный имплементационный план готовности к реальному прогону компанией

**Ветка аудита:** `master` (repo `/mnt/e/KISS-PM-wt-agent-first`) · **Дата:** 2026-07-20
**Метод:** дедупликация 103 находок + точечная перепроверка спорных critical/major по коду (grep/read, read-only).

> ⚠️ **Важно: аудит частично устарел.** Точечная перепроверка показала, что несколько находок с наивысшей критичностью **уже закрыты на текущем `master`** (аудит гонялся по более старому снапшоту). Ниже — раздел «Отсев ложного» с доказательствами, а план построен по **скорректированной** картине.

---

## 0. Отсев ложного и корректировка (перепроверено по коду)

| Находка (как в аудите) | Заявл. | Факт на master | Доказательство |
|---|---|---|---|
| knowledge — нет UI (документы/решения/поручения) | **critical/missing** | **ЗАКРЫТО** | `apps/web/src/delivery/knowledge/knowledge-surface.tsx` (777 стр) + `knowledge-client.ts` (252 стр, зовёт `/api/workspace/projects/:id/knowledge/*`) + `app/projects/[id]/knowledge/page.tsx` (live) + тесты |
| control — нет UI (KPI/сигналы/corrective preview→apply) | **critical/missing** | **ЗАКРЫТО** | `apps/web/src/delivery/control/control-surface.tsx` (655 стр, `previewAction`/`applyAction`, receipt, cross-link в Коммиты) + `app/projects/[id]/control/page.tsx` (live) + тесты |
| Авто-солвер — нет точки входа в UI | **major/missing** | **ЗАКРЫТО** | `use-planning.ts:320-366` `runAutoSolver`/`applySolverProposal`; `scenarios-surface.tsx` потребляет `AutoSolverWireProposal`, обрабатывает stale-коды. Совпадает с параллельной находкой `works` |
| retrospective/closure — нет UI | **major/missing** | **ЗАКРЫТО** | `apps/web/src/delivery/closure/project-closure-section.tsx` + `closure-client.ts` (`/closure/preview`,`/close`,`/lessons`). Совпадает с находкой `works` |
| Админ-сброс/смена пароля сотрудника | **major/missing** | **ЗАКРЫТО** | `workspaceParsers.ts:105,120` парсит `password`; `workspaceUserRoutes.ts:168-173` `hashPassword`; есть `POST /users/:userId/password-reset-token` (:355) |
| global-search вырезает knowledge-результаты | **major/partial** | **устарело → minor** | Код-вырезка `!r.route.includes("/knowledge/")` отсутствует в текущем `global-search.tsx`; группировка по `RESULT_GROUPS` (:118). Остаётся проверить, что тип knowledge включён в группы |

**Прочие подтверждённо-рабочие звенья (оставляем как есть, не трогаем):** auth-ядро, CRM deal→project активация (бэкенд), planning apply-цикл, сценарии preview→apply→revert, авто-солвер run/apply, назначения, отсутствия, occupancy, канбан-переходы задач, комментарии/активность, командный чат (SSE), corrective-action apply (бэкенд), роли/пользователи, project-work CRUD, asset ref-count.

**Итог корректировки:** из 103 находок реально требуют работы ≈ **62** (после дедупликации и отсева). Двух «critical/missing UI» больше нет — верхнюю критичность теперь держат **инфра-блокеры деплоя** и **оргструктура**.

---

## 1. Скорректированный реестр по критичности

### CRITICAL (блокирует реальное использование / потеря данных / крэш) — подтверждено
1. **Деплой web невозможен** — нет `apps/web/Dockerfile`, нет `output:"standalone"`, compose гонит `next dev -H 0.0.0.0` (`docker-compose.yml:141`). *Подтв.*
2. **Логин ломается на боевом сервере** — secure-cookies форсятся в prod (`runtimeSecurityConfig.ts:36-42`), в поставке нет TLS/nginx/traefik/caddy (`grep=0` в compose). *Подтв.*
3. **Небезопасный поставляемый стек** — дефолт-пароль БД `kiss_pm_dev_password`, `KISS_PM_ENABLE_DEV_ROUTES:"true"` в единственном compose (`docker-compose.yml:7,67`). *Подтв.*
4. **Оргструктура — тупик на первом шаге ресурсов** — нет `apps/web/src/app/settings/org-structure`, ноль web-консьюмеров `/api/tenant/current/org-structure` (`grep=0`), e2e в карантине. Бэкенд+домен готовы. *Подтв.*

### MAJOR (модуль работает частично / тупик в важном сценарии) — подтверждено
5. Утечка чтения чужих задач между проектами (`taskReadWorkspace.ts:157-174` — только tenant-wide `canReadProjects`). *Подтв.*
6. Нет invite-flow сотрудников (письмо→сам задаёт пароль); `grep invitation=0` в auth/workspace. *Подтв.*
7. Вложения к задаче не приложить/не скачать из UI (`task-detail-surface.tsx` — ноль attachment/fileUrl/download). *Подтв.*
8. Нельзя создать проект без сделки (только `/opportunities/:id/activate`, нет `POST /projects`). *Подтв.*
9. Закрытые/приостановленные проекты пропадают из списка (`.filter status==="active"`). 
10. Нельзя переоткрыть/поставить на паузу проект (нет `reopen/pause/resume`). *Подтв. — grep=0.*
11. Нельзя сменить тип/шаблон/название/календарь проекта (нет `PATCH /projects/:id`; календарь read-only stub). *Подтв.*
12. CRM: нельзя настроить свою воронку/стадии/переходы/типы проектов из UI (клиент-методы `createDealStage/updatePipeline/createStageTransition` есть, surface их не вызывает — только empty-state `createDefaultPipeline`). *Подтв.*
13. Нет управления типами/шаблонами проектов из UI (API есть, surface нет).
14. Прод-календарь тенанта: нельзя задать рабочие дни/часы (только GET+POST/bulk), нельзя удалить исключение (нет DELETE). *Подтв. — routes только GET+bulk.*
15. Матрица загрузки схлопывается без оргструктуры (следствие #4).
16. Уведомления только in-app — `notification.dispatch` в `NOT_IMPLEMENTED_BACKGROUND_JOB_KINDS` (`backgroundJobRoutes.ts:31`). *Подтв.*
17. Видеозвонки/запись выключены по умолчанию (`videoProvider.ts:71` default disabled). Инфра-конфиги livekit/egress/coturn **уже есть** в `infra/`. *Подтв.*
18. Наблюдаемость: `app.onError` не логирует stack/requestId (`app.ts:94-97`). *Подтв.*
19. Бэкапы БД отсутствуют (нет backup/restore в `scripts/`). *Подтв.*
20. Security-заголовки фронтенда отсутствуют (`next.config.ts` без `headers()`). *Подтв.*
21. Аудит: серверные фильтры по актору/типу/дате отсутствуют, лимит 50 захардкожен.
22. control-surfaces (tenant publish/rollback) — нет UI (`grep control-surfaces=0` в web). *Подтв.*
23. Оргструктура из админки (дубль #4).
24. Applied-improvement петля шаблонов — кнопки «Применить улучшение» нет в closure-UI (`closure-client` без `applyTemplateImprovement`).
25. Фон-воркер выключен по умолчанию вне поставляемого compose (`serverConfig.ts:84`).

### MINOR (шероховатости) — сгруппированы в блок 12
Удаление CRM-сущностей; move-pipeline тупик; авто-солвер reject/repair/e2e; scenario reject e2e; presence в Redis; meetings SSE; manual-call гейт; storage docs; hard-delete задач необратим; оптимистичная блокировка канбана; peek-комментарии; capacity live-заглушки 480/position; planning-gantt-ui мёртвый пакет; multi-step revert; email-верификация регистрации; must-change-password; scheduled-tasks мёртвый роут; справочники в /admin; slugify кириллицы; миграции дубль-номера; POST/bulk год; JSON /propose без catch; agent execute-провенанс; update_task 501; controlRoutes.test.ts отсутствует; workspaceUserRoutes.test.ts отсутствует; 2FA/SSO мёртвые флаги.

---

## 2. Блоки работ

> Формат каждого блока: **находки** → **спецификация (файлы NEW/EDIT + контракт)** → **DoD** → **верификация** → **оценка** → **зависимости**.

---

### БЛОК 1 — Прод-инфраструктура деплоя (CRITICAL) 🔴
**Находки:** #1 web-deploy, #2 TLS/cookies, #3 dev-стек, #18 observability, #19 backup, #20 headers, #25 worker.

**Спецификация:**
- **NEW `apps/web/Dockerfile`** — multi-stage: `pnpm build` → runner. **EDIT `apps/web/next.config.ts`**: добавить `output: "standalone"` и `async headers()` с `Content-Security-Policy` (`frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (prod).
- **NEW `docker-compose.prod.yml`** — без bind-mount, без `next dev`; web = `node server.js` (standalone); api = `apps/api/Dockerfile`; reverse-proxy (caddy/traefik) с TLS-терминацией на 443 → web:3000/api:4000; `KISS_PM_ENABLE_DEV_ROUTES` не задан (off); `POSTGRES_PASSWORD` **обязателен из секрета, без дефолта**; `KISS_PM_BACKGROUND_JOBS_ENABLED=true`; реальные SMTP/storage env.
- **EDIT `apps/api/src/serverConfig.ts` / стартовый гвард** — падать при старте, если `NODE_ENV=production && KISS_PM_ENABLE_DEV_ROUTES=true`; предупреждать, если `backgroundJobsEnabled=false` в prod.
- **EDIT `apps/api/src/app.ts:94-97`** — в `onError` для 5xx логировать `error.stack + requestId + route + tenantId` (structured logger, использовать существующий `requestObservabilityMiddleware`); 4xx не логировать как error.
- **NEW `scripts/backup.sh` / `scripts/restore.sh`** — `pg_dump`/`pg_restore` + документ DR; опц. cron-job контейнер.
- **NEW `docs/DEPLOYMENT.md`** — обязательные env, TLS-домен, порядок миграций, чек-лист.

**DoD:** компания клонирует репо, задаёт домен+секреты, `docker compose -f docker-compose.prod.yml up` → HTTPS-сайт, логин работает (кука Secure проходит по TLS), dev-роуты недоступны, воркер шлёт уведомления/чистку, 5xx попадают в логи со стеком, `backup.sh` даёт восстановимый дамп.

**Верификация:** ручной прогон prod-compose на чистой VM (или CI job `deploy-smoke`): `curl -kI https://host` → security-заголовки; логин через UI; `docker compose exec` проверка `KISS_PM_ENABLE_DEV_ROUTES` off; `backup.sh && restore.sh` в отдельную БД; e2e-smoke auth против prod-сборки.

**Оценка:** **L** · **Зависимости:** нет (фундамент). Блокирует финальный инфра-DoD.

---

### БЛОК 2 — Оргструктура тенанта + оживление матрицы загрузки (CRITICAL) 🔴
**Находки:** #4/#23 org-structure UI, #15 capacity-группировка, capacity live-заглушки (`planning-client.ts:118-126` teamId=positionId, 480 hardcode).

**Спецификация:**
- **NEW `apps/web/src/features/org-structure/*`** (surface + client) и **NEW `apps/web/src/app/settings/org-structure/page.tsx`** — редактор двух треков (functional/project), CRUD узлов направление→отдел→команда, форма расстановок, кнопка «Сохранить» → `PUT /api/tenant/current/org-structure` (full-replace; API готов, `orgStructureRoutes.ts:177-244`). Вкладка в `SettingsSurface`.
- **EDIT `apps/web/src/delivery/lib/planning-client.ts:118-126`** — тянуть реальную capacity из календаря ресурса и оргузлы из `/api/workspace/users` вместо `480`/`positionId`.
- **Вернуть из карантина** `e2e/quarantine/admin/org-structure.spec.ts` на живые якоря `org-structure-page`.

**DoD:** админ заводит направления/отделы/команды, расставляет людей, сохраняет; `/capacity` группирует загрузку по 4 уровням (направление·отдел·должность), а не «Без оргструктуры»→должность; пикер назначений показывает реальную ёмкость.

**Верификация:** e2e (расчехлённый) — создать оргдерево → расставить → открыть `/capacity`, assert непустые группы; unit на маппинг Resource; ручной прогон.

**Оценка:** **L** · **Зависимости:** оживляет #15; желательно после базового деплоя, но параллелится с блоками 3-11.

---

### БЛОК 3 — Онбординг и восстановление доступа (MAJOR) 🟠
**Находки:** #6 invite-flow; email-верификация регистрации (minor); must-change-password (minor). *(Админ-сброс пароля — уже закрыт, см. §0.)*

**Спецификация:**
- **NEW `POST /api/workspace/invitations`** (под `canManageTenantUsers`) — создаёт user `status='invited'` без пароля + одноразовый invite-токен, письмо через `emailProvider`. **NEW публичный `POST /api/auth/invitation/accept`** — сотрудник задаёт пароль по токену, активируется.
- **EDIT `apps/web/src/admin/users/users-surface.tsx:130,167`** — заменить обязательное поле пароля на «Отправить приглашение» (пароль — опциональный fallback).
- **(стретч)** флаг `must_change_password` в credential + проверка в `/login`/`/me` с редиректом.
- **(стретч)** `pending_verification` для нового владельца + письмо подтверждения.

**DoD:** владелец приглашает сотрудника по email; тот по ссылке задаёт свой пароль и входит; временные пароли по внешним каналам не нужны.

**Верификация:** NEW `workspaceUserRoutes.db.test.ts` (create/dup-email/self-demote/allowlist — закрывает #закрытую находку про отсутствие тестов); route-тест invite/accept; e2e invite→accept→login.

**Оценка:** **L** · **Зависимости:** реальный SMTP (Блок 1 / инфра-предпосылка).

---

### БЛОК 4 — Конструктор CRM-воронки (MAJOR) 🟠
**Находки:** #12 (стадии/переходы/типы проектов из UI), move-pipeline тупик, `GET /deal-stages` только дефолтная воронка (`crmRoutes.ts:556-567`), удаление CRM-сущностей, «первоклассная» crmPipelineRoutes-подсистема (stub — решить: подключить или удалить).

**Спецификация:**
- **NEW экран «Воронки»** в CRM Settings — список воронок → CRUD стадий + reorder → матрица переходов (from/to, `minProbability`, `requireFeasibilityOk`, `guardNote`). Использовать **уже существующие** клиент-методы `crm-client.ts:155-161` (`createPipeline/updatePipeline/createDealStage/createStageTransition/deleteStageTransition`) — их только не вызывает surface.
- **EDIT `crmRoutes.ts:556-567`** — `GET /deal-stages?pipelineId=` (или отдавать все воронки), чтобы `allStages` содержал стадии всех воронок → оживить `MovePipelineDialog`.
- **NEW UI типов проектов** + селектор `projectType` в диалоге сделки (`deals-surface.tsx:679` вместо `[0]`).
- Архивация/удаление (soft `status`) для clients/contacts/products/deals + при необходимости DELETE/archive для opportunities.
- **Решение по `crmPipelineRoutes.ts`** (параллельная модель, automations без исполнителя): либо подключить к deal-flow, либо удалить как незавершённую (рекомендуется удалить — избежать двух конкурирующих моделей).

**DoD:** компания настраивает свою воронку (стадии/переходы/типы), заводит вторую воронку и переносит в неё сделку, выбирает тип при создании сделки, удаляет мусорные записи — всё мышкой.

**Верификация:** e2e: создать стадию → переход с guard → провести сделку, ловящую guard (422); перенос сделки между воронками; unit на `/deal-stages?pipelineId`.

**Оценка:** **L** · **Зависимости:** нет.

---

### БЛОК 5 — Жизненный цикл проекта: создание/статусы/редактирование (MAJOR) 🟠
**Находки:** #8 ручное создание, #9 список закрытых, #10 reopen/pause/resume, #11 PATCH тип/шаблон/название/календарь, #24 apply template-improvement, integrations/permissions stub (minor).

**Спецификация:**
- **NEW `POST /api/workspace/projects`** — ручное создание active-проекта (title/typeId/templateId/calendarId), переиспользуя `createProjectDraftFromOpportunity`+`activateProjectDraft` без opportunity; кнопка «Новый проект» в `projects-list-surface`.
- **EDIT `projectIntakeRoutes.ts:278-281`** — `GET /projects?status=active|closed|paused|all`; фильтры «Закрытые/Все» в списке.
- **NEW `POST /projects/:id/reopen|pause|resume`** (RBAC `projects.manage`, аудит, инвалидация capacity); отражение статуса в шапке/списке.
- **NEW `PATCH /api/workspace/projects/:projectId`** — title/projectTypeId/templateId/calendarId (валидация, аудит, bump версии); форма в настройках вместо read-only полей (`settings-surface.tsx:157-164`).
- **EDIT `closure-client.ts`** — метод `applyTemplateImprovement(projectId, actionId)` (`POST …/template-improvement-actions/:id/apply` уже есть) + кнопка в closure-секции.

**DoD:** проект создаётся без сделки; закрытые/паузные видны в списке; ошибочное закрытие откатывается reopen; тип/шаблон/название/календарь редактируемы; предложенное улучшение шаблона применяется из UI.

**Верификация:** e2e: создать проект вручную → сменить тип → закрыть → найти в «Закрытые» → reopen → pause/resume; unit на PATCH-валидацию; тест apply-improvement.

**Оценка:** **L** · **Зависимости:** пересекается с Блоком 13 (типы/шаблоны admin).

---

### БЛОК 6 — Задачи: вложения + изоляция доступа (MAJOR, включает security) 🟠
**Находки:** #5 утечка чтения чужих задач (security), #7 вложения UI, показ file-активности (stub), создание задачи из My Work (minor), оптимистичная блокировка канбана (minor), peek-комментарии (minor).

**Спецификация:**
- **EDIT `apps/api/src/project-work/taskReadWorkspace.ts:148-198`** (`getTaskDetail`/`listTaskActivity`) — после `findTaskById` проверять доступ к `task.projectId` (участие в задаче ИЛИ доступ к проекту), иначе 403/404 — по образцу `canParticipateInTaskActivity` в `preflightCreateTaskComment`. **Security-фикс, приоритет внутри блока.**
- **EDIT `task-detail-surface.tsx`** — блок вложений: `input[type=file]` → `POST /api/workspace/attachments/files` (`entityType="task"`, `entityId=taskId`), список из `attachmentItems` со ссылкой `GET /attachments/:id/download`; для `activity.type==="file"` рендерить `<a href={fileUrl} download>`. **EDIT `workspace-client.ts`** — `uploadTaskAttachment/listTaskAttachments`, типизировать `attachmentItems`.
- **(minor)** `clientUpdatedAt` из `useMyWork.updateTaskStatus` → 409 handling; кнопка «Новая задача» в My Work → `POST /api/workspace/tasks`.

**DoD:** к задаче прикладывается ТЗ/скрин и скачивается; file-активность кликабельна; сотрудник НЕ может прочитать задачу чужого проекта по прямому id; параллельные правки канбана дают честный конфликт.

**Верификация:** NEW route-тест изоляции (actor без доступа к проекту → 403 на `GET /tasks/:id`); e2e upload→download вложения; unit на 409.

**Оценка:** **M** · **Зависимости:** нет. Security-часть — в первую волну.

---

### БЛОК 7 — Производственный календарь тенанта (MAJOR) 🟠
**Находки:** #14 нельзя задать рабочие дни/часы + нельзя удалить исключение; POST/bulk возвращает чужой год (minor).

**Спецификация:**
- **NEW `PATCH /api/tenant/current/production-calendar`** — `workingWeekdays`, `workingMinutesPerDay` (валидация, аудит); форма редактирования базового режима в `AdminProductionCalendarSurface` (сейчас read-only).
- **NEW `DELETE /api/tenant/current/production-calendar/exceptions/:id`** + `deleteException` в репозитории + кнопка «Удалить/Сбросить день».
- **EDIT `productionCalendarRoutes.ts:189-190`** — возвращать год отредактированных items, а не `new Date().getUTCFullYear()`.

**DoD:** компания с 6-дневкой/12ч-днём задаёт свой базовый график → ёмкость/CPM/feasibility считаются от него; ошибочный праздник удаляется.

**Верификация:** route-тест PATCH+DELETE+аудит; проверка, что capacity меняется после смены режима; unit на год ответа.

**Оценка:** **M** · **Зависимости:** влияет на Блок 2 (capacity).

---

### БЛОК 8 — Коммуникации: уведомления + видео/запись (MAJOR) 🟠
**Находки:** #16 notification.dispatch, #17 video/#recording, meetings SSE (minor), presence Redis (minor), manual-call гейт (minor), storage docs (minor).

**Спецификация:**
- **EDIT `apps/api/src/backgroundJobs/jobHandlers.ts`** — реализовать handler `notification.dispatch` (читает `listNotificationPreferences`, шлёт через `emailProvider`), убрать kind из `NOT_IMPLEMENTED_BACKGROUND_JOB_KINDS` (`backgroundJobRoutes.ts:31`); засеять digest-расписание; вернуть email/digest в `DELIVERABLE_CHANNELS` (`notifications-surface.tsx`).
- **EDIT `docker-compose.prod.yml`** (Блок 1) — доподнять сервисы LiveKit/egress/coturn (конфиги **уже есть**: `infra/livekit/livekit.yaml`, `infra/egress/egress.yaml`, `infra/coturn/turnserver.conf`); задокументировать `KISS_PM_VIDEO_PROVIDER=livekit`+URL/key/secret; **NEW smoke-e2e** join против реального LiveKit-контейнера.
- **(стретч)** `calls.recording_compose` — склейка треков (composite egress); **(minor)** meetings SSE-эмит; presence → Redis; учесть manual+backend-disabled в `providerDisabled` гейте.

**DoD:** оффлайн-сотрудник получает email/дайджест по mention/назначению; видеозвонок из комнаты реально соединяет двоих (в поставке с LiveKit); запись даёт воспроизводимый файл (стретч — компоновка).

**Верификация:** route-тест notification.dispatch; e2e видео-join против LiveKit-контейнера; unit гейта manual.

**Оценка:** **L** · **Зависимости:** Блок 1 (compose+SMTP+storage).

---

### БЛОК 9 — Планирование: обратимость и полнота солвера (MAJOR→MINOR) 🟠
**Находки:** hard-delete задач необратим (major); multi-step/arbitrary revert (major); авто-солвер reject (minor); режим repair фантомный (minor); solver apply e2e + scenario reject e2e (minor); planning-gantt-ui мёртвый пакет (minor).

**Спецификация:**
- **EDIT `schedule-surface.tsx:994,997`** — боевым путём сделать `mode:'archive'` (`archivedAt` поддержан, `planningRepository.ts:874`) вместо hard `db.delete`, ЛИБО добавить компенсацию для delete в `compensatingCommands.ts:181` (recreate из снапшота «до»). Устраняет безвозвратную потерю ветки WBS.
- **Revert:** либо честно ограничить UI до «откат последнего обратимого», либо реализовать `revert-to-version` через накопительную компенсацию по цепочке.
- **NEW `POST /auto-solver-runs/:runId/reject`** + writer `markPlanningSolverRunRejected` (колонки `rejectedAt/rejectedReason` зарезервированы, `schema/planning.ts:658`) + кнопка «Отклонить» в solver-карточке.
- Режим `repair`: реализовать ветку в `autoSolver.ts` ИЛИ убрать `repair` из типа/envelope.
- Удалить неиспользуемый `packages/planning-gantt-ui` ИЛИ перевести на него `schedule-surface`.

**DoD:** ошибочное удаление задачи откатывается; заявленный откат честен; solver-предложения можно отклонить; контракт режимов не обещает несуществующее.

**Верификация:** e2e solver-run→apply→reload-persist→revert (по образцу `projects-scenarios-write.spec.ts`); e2e scenario reject→409; unit на компенсацию delete.

**Оценка:** **L** · **Зависимости:** нет.

---

### БЛОК 10 — Администрирование: аудит, control-surfaces, справочники (MAJOR→MINOR) 🟠
**Находки:** #21 серверные фильтры аудита; #22 control-surfaces publish/rollback UI; #13 типы/шаблоны проектов UI; справочники в /admin (minor); background-jobs retry/cancel (minor); scheduled-tasks мёртвый (minor); 2FA/SSO мёртвые флаги (minor).

**Спецификация:**
- **EDIT `apps/api/src/auditRoutes.ts:12-16`** — серверные фильтры `actorUserId/actionType/fromDate/toDate/executionResult` + keyset-пагинация (cursor); **EDIT `audit-surface.tsx:35`** — контролы фильтров + «Показать ещё».
- **NEW admin-экран control-surfaces** — `preview/publish/rollback/presets` на `/api/tenant/current/control-surfaces/*` (`controlSurfaceRoutes.ts:171/214/321/420`).
- **NEW раздел «Типы и шаблоны проектов»** в Settings/admin — CRUD поверх `project-types` и `config/project-templates` (по образцу ReferencesTab).
- **(minor)** дублировать «Справочники» в AdminFrame; `POST /runs/:id/retry|cancel` для фон-задач; решить судьбу `scheduled-tasks`; убрать мёртвые 2FA/SSO флаги ИЛИ реализовать TOTP+SAML (L, скорее вне scope — см. §5).

**DoD:** комплаенс фильтрует аудит по актору/типу/дате за пределами последних 50; админ публикует/откатывает control-surface из UI; заводит свои типы/шаблоны.

**Верификация:** NEW `controlRoutes.test.ts`; route-тест audit-фильтров; e2e control-surface publish→rollback.

**Оценка:** **L** · **Зависимости:** нет.

---

### БЛОК 11 — Агент: честность карточки и корректность (MAJOR→MINOR) 🟠
**Находки:** пустая diff-карточка доменных mutation-tool'ов (major, дыра доверия); нет read-инструмента статусов для change_task_status (major); история тредов stub (major); update_task 501 (minor); JSON /propose без catch (minor); provenance неудачных действий (minor); staged-scenario TTL (minor); live-LLM smoke (minor).

**Спецификация:**
- **EDIT `agent-surface.tsx:56-88`** — рекурсивно сериализовать `input.fields` в человекочитаемый `after` (пары ключ:значение); блокировать `apply` доменных mutation до отрисовки честного diff. Закрывает дыру «подтверждаю вслепую».
- **NEW read-only analyze-инструмент `list_task_statuses`** под `canReadProjects` (или включить статусы в `read_project_plan` payload) — чтобы LLM брал валидный `statusId`, а не галлюцинировал.
- **История тредов:** либо персистить агентские треды на сервере и отдавать в `AgentConversationList`, либо честно убрать нефункциональную панель до реализации (рекомендуется убрать — быстрее).
- **(minor)** обернуть `runProposeLoop` в try/catch → `{error}` 502; логировать не-403 фейлы execute; авто-регенерация протухшего scenarioId; убрать `update_task` из публичного реестра до готовности.

**DoD:** пользователь видит, ЧТО именно создаёт агент, до подтверждения; смена статуса задачи через агента работает у рядового сотрудника без галлюцинаций; панель истории не вводит в заблуждение.

**Верификация:** unit на сериализацию fields; e2e change_task_status рядовым сотрудником; тест try/catch JSON /propose.

**Оценка:** **M** · **Зависимости:** нет.

---

### БЛОК 12 — Сквозная тестовая сеть и мелочи (MINOR) 🟢
**Находки:** отсутствующие тесты (`controlRoutes.test.ts`, `workspaceUserRoutes.test.ts`); e2e knowledge/control (surfaces есть — добавить сквозняк); knowledge PATCH/restore версий; DELETE decisions/action-items; global-search knowledge в RESULT_GROUPS; slugify кириллицы; миграции дубль-номера/_journal; POST/bulk год (в Блоке 7).

**Спецификация:** добить route-тесты и e2e перечисленных модулей; мелкие DELETE/PATCH для knowledge; проверить включение knowledge в поиск; перенумеровать миграции (уникальный монотонный префикс, синхронизировать/удалить `_journal.json`).

**DoD:** ключевые роуты имеют прицельные тесты; управленческий сквозняк доказан e2e; история миграций непротиворечива.

**Оценка:** **M** · **Зависимости:** после соответствующих UI-блоков.

---

## 3. Definition of Done — сквозной acceptance-сценарий реальной компании

Плановый DoD = один непрерывный прогон **без единой заглушки**, покрытый e2e:

1. **Регистрация** workspace → авто-логин владельца *(works)*.
2. **Приглашение команды** — invite-письмо → сотрудник сам задаёт пароль → входит с ролью *(Блок 3)*.
3. **CRM-воронка** — компания настраивает свои стадии/переходы/типы проектов, заводит клиента/контакт/сделку *(Блок 4)*.
4. **Конверсия сделки в проект** через feasibility-гейт *(works)*; ИЛИ ручное создание проекта *(Блок 5)*.
5. **Планирование** — WBS/Гант/зависимости/критпуть/baseline/сценарии/солвер/коммиты; удаление задачи **обратимо** *(works + Блок 9)*.
6. **Ресурсы/оргструктура** — компания строит оргдерево, расставляет людей, видит 4-уровневую матрицу загрузки с реальной ёмкостью; календарь тенанта под свой режим *(Блоки 2, 7)*.
7. **Назначения/загрузка/отсутствия/occupancy** *(works)*.
8. **Задачи/канбан/вложения** — создать/двигать/комментировать, **приложить и скачать файл**, чужие задачи недоступны *(works + Блок 6)*.
9. **Агент на живом LLM** — предлагает действие с **честной diff-карточкой**, меняет статус задачи, применяет по подтверждению *(Блок 11)*.
10. **Коммуникации** — чат (SSE), **email/дайджест-уведомления оффлайн**, видеозвонок в поставке *(works + Блок 8)*.
11. **Знания** — документы/решения/поручения ведутся из UI *(уже works — §0)*.
12. **KPI/контур** — руководитель смотрит сигналы, применяет corrective preview→apply *(уже works — §0)*; publish/rollback control-surface из админки *(Блок 10)*.
13. **Админка** — роли/аудит(с фильтрами)/справочники/типы-шаблоны *(works + Блок 10)*.
14. **Закрытие проекта** — preview→close→уроки→применение улучшения шаблона; закрытый виден в списке и переоткрываем *(works + Блоки 5)*.

**Инфра-DoD:** прод-деплой на сервере с **TLS** (логин работает), dev-роуты выключены, секреты вместо дефолтов, **бэкапы** восстановимы, **наблюдаемость** (5xx со стеком), фон-воркер включён, security-заголовки на HTML *(Блок 1)*.

---

## 4. Порядок исполнения волнами

**Волна 0 (фундамент, параллельно):**
- Блок 1 (инфра-деплой) — критический путь для инфра-DoD.
- Блок 6 security-часть (изоляция задач) — быстрый security-фикс, ни от чего не зависит.

**Волна 1 (широкий параллелизм, независимые модули):**
- Блок 2 (оргструктура) ‖ Блок 4 (CRM) ‖ Блок 5 (lifecycle) ‖ Блок 7 (календарь) ‖ Блок 9 (planning) ‖ Блок 11 (агент).
- Блок 3 (invite) — после того как Блок 1 даёт SMTP.

**Волна 2 (зависят от волны 0/1):**
- Блок 8 (коммуникации) — после compose+storage+SMTP (Блок 1).
- Блок 6 вложения — после/parallel с Блоком 1 (storage).
- Блок 10 (админ) — независим, можно и в волне 1.

**Волна 3 (замыкание):**
- Блок 12 (тесты/мелочи/миграции) — после появления соответствующих UI; финальный сквозной e2e-прогон DoD-сценария.

**Максимально параллелится:** 2, 4, 5, 7, 9, 10, 11 (разные модули, минимальные пересечения). Пересечение 5↔10 (типы/шаблоны) — согласовать контракт `PATCH /projects` и справочник шаблонов заранее.

---

## 5. Осознанно вне scope

- **Полный биллинг/подписки** — в находках отсутствует; не нужен для внутреннего прогона.
- **TOTP-2FA и SAML/SSO** *(находка «Администрирование/Безопасность», L)* — рекомендуется на этом этапе **удалить мёртвые флаги** из контракта политики (чтобы не обещать), полную реализацию отложить. `sessionTimeout`/`domainAllowlist` работают.
- **DPA/юридическая обвязка комплаенса** — организационное, не кодовое.
- **Полный видео-стек с записью-компоновкой** *(recording_compose, L)* — базовый join включаем (Блок 8), компоновку в один ролик помечаем **«стретч»**.
- **Интеграции Bitrix24/MS Project** *(находка, честный roadmap)* — оставить как явный roadmap; не выдавать за рабочее.
- **`crmPipelineRoutes` automations-исполнитель** — рекомендуется удалить незавершённый слой, а не достраивать (две конкурирующие модели воронки).
- **`planning-gantt-ui` пакет** — удалить как техдолг (боевой Гант самодостаточен).
- **`scheduled-tasks` роут** — снять с регистрации/пометить internal.

---

## 6. Риски и внешние предпосылки

| Риск / предпосылка | Влияние | Митигирование |
|---|---|---|
| **LLM-ключ** (OpenRouter/Anthropic) обязателен для боевого агента | без ключа агент честно деградирует (баннер), сценарий 9 не пройдёт | предоставить ключ в prod-env; live-smoke за CI-флагом |
| **Домен + TLS-сертификаты** | без TLS логин мёртв (Блок 1/#2) | reverse-proxy с ACME (caddy/traefik) в prod-compose; задокументировать |
| **SMTP-инсталляция** | без неё invite/сброс/уведомления не уходят (`emailProvider` in-memory запрещён в prod) | обязательный SMTP в prod-env + health-check доставки при старте |
| **Storage (S3/local root)** | без `KISS_PM_STORAGE_*` API падает на старте; вложения/стикеры не работают | дефолтный local-root в prod-compose + docs |
| **LiveKit/egress/coturn** | видео/запись выключены по умолчанию | конфиги уже в `infra/`; поднять сервисы в prod-compose (Блок 8) |
| **Аудит устарел** | часть работ могла быть уже сделана после снапшота | перед стартом каждого блока — быстрый re-check по file:line (как в §0) |
| **Дубли номеров миграций** | хрупкая история, риск ручной ошибки | Блок 12: перенумерация до релиза |
| **Фон-воркер off по умолчанию** вне compose | тихий отказ уведомлений/чистки | стартовый лог-предупреждение + чек-лист (Блок 1) |

---

**Итоговая оценка объёма:** ~4 блока **L** критического/major-пути (1, 2, 4, 5), ~5 блоков **L/M** major (3, 6, 7, 8, 9, 10, 11), 1 блок **M** замыкающих тестов. После закрытия Блоков 1–11 + сквозного e2e из §3 продукт проходит полный прогон реальной компании без блокеров/критических багов/заглушек и разворачивается на сервере с TLS/бэкапами/наблюдаемостью.