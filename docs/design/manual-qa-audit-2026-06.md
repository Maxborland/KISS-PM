# Аудит ручного тестирования KISS-PM — приоритизация «что строить/чинить дальше»

Сводный анализ 8 доменов по сценарным аудитам. Состояния: ✅ wired (реально подключено к боевому API), ⚠️ partial (работает, но с дырой), ❌ stub (декоративная заглушка/демо), ⛔ missing (контрол отсутствует, хотя бэкенд часто готов).

---

## 1. Сводка

| Домен | Сценариев | ✅ | ⚠️ | ❌ | ⛔ | Вердикт |
|---|---|---|---|---|---|---|
| Auth & Onboarding | 31 | 14 | 2 | 10 | 5 | Формы submit'ят на реальный API, но вся межэкранная навигация — заглушки/Storybook-URL; нет редиректа после логина, ссылка из письма сброса 404-ит, сессии/logout не смонтированы. |
| Admin & Access Control | 21 | 2 | 9 | 7 | 3 | Только Audit реально жив; Users/Roles падают на отсутствующем `permission-catalog`, Security без бэкенда вообще, вся навигация мёртвая. |
| AI-агент (Генри Гантт) | 24 | 15 | 1 | 8 | 0 | Ядро (SSE-LLM → propose/execute, RBAC, аудит) живое; но правки в панели сверки игнорируются при apply, история чата — статичное демо. |
| Communications & Calls | 44 | 30 | 8 | 2 | 4 | Самый зрелый домен, end-to-end к Hono+LiveKit; белые пятна — реальный WebRTC-экран не слинкован, захардкоженный «текущий юзер», несколько контролов без UI. |
| CRM | 41 | 23 | 3 | 5 | 10 | CRUD+воронка+feasibility/активация живые; но нет редактирования записей, админки воронок, создания задач/файлов; навигация мёртвая; ложные «in-memory» баннеры. |
| Dashboard / My-Work / Home | 23 | 10 | 2 | 4 | 7 | Read-mostly: реальные данные и смена статуса, но нет карточки задачи, создания/редактирования, фильтров; Home — статик-плейсхолдер. |
| Profile & Settings | 21 | 11 | 4 | 2 | 4 | Профиль/имя/акцент/уведомления живые; но переключателя темы нет, сохранённый акцент не применяется, аватара/сессий/смены пароля нет. |
| Project Delivery | 56 | 40 | 5 | 10 | 1 | Почти весь домен реально подключён к live planning API; дыры точечные: пикеры ресурсов на моках, кнопки-заглушки навигации, revert только последнего коммита. |

---

## 2. Топ белых пятен (по всем доменам, severity ↓)

### HIGH

1. **Нет редиректа после входа/регистрации — юзер логинится, но застревает на /login** — Auth — `apps/web/src/auth/login/login-surface.tsx:136-151` (и `register-surface.tsx:58-75`). `AuthedCard` показывает текст-плейсхолдер вместо `router.push`. Во всём auth-домене ноль `useRouter`. Пользователь аутентифицирован, но физически не попадает в приложение. **Блокер выхода в прод.**

2. **Ссылка сброса пароля из письма ведёт на несуществующий роут (404)** — Auth — `apps/api/src/authRegistrationRoutes.ts:430-433`. `buildResetUrl` → `${origin}/auth/reset-password?token=`, а реальный роут — `/(auth)/password-reset/confirm`. Каждое письмо сброса 404-ит; флоу восстановления недостижим для реальных пользователей.

3. **Футер логина и вся reset-навигация — мёртвый текст / Storybook-URL** — Auth — `login-surface.tsx:158-168`, `reset-request-surface.tsx:66,144`, `reset-confirm-surface.tsx:62-89`. «Создать аккаунт»/«Забыли пароль?» — инертные `<span>`; «Перейти к подтверждению»/«Перейти ко входу» — `href="?path=/story/..."`. С живого /login нельзя дойти ни до /register, ни до /password-reset, ни пройти многошаговый сброс.

4. **`GET /api/workspace/permission-catalog` не существует — ломает Users И Roles в проде** — Admin — `apps/web/src/admin/lib/use-admin.ts:54-59`. `useAdmin.load()` тянет каталог прав внутри `Promise.all`; в live это 404 → реджект всей загрузки → обе страницы в error-state. `permissions-catalog.ts` сам признаёт «боевого GET-эндпоинта НЕТ». Фикс: либо добавить роут, либо использовать статичную `ALL_PERMISSIONS`.

5. **Security policy — нет бэкенда вообще** — Admin — `admin-client.ts:135-136`; в `apps/api` нет ни одного `TenantSecurityPolicy`. Весь экран (2FA, SSO, session timeout, allowlist доменов, save) нефункционален в проде: load падает, save 404-ит. Нужна модель + GET/PUT или скрыть страницу.

6. **Вся admin-навигация — мёртвый скаффолдинг** — Admin — `workspace-shell.tsx:46-56`, `admin-frame.tsx:45-57`. Сайдбар и табы — некликабельные `<span>`. До /admin и между Users/Roles/Security/Audit можно попасть только ручным вводом URL.

7. **Правки в панели «Сверка» игнорируются при apply** — AI-агент — `agent-surface.tsx:173,274-276`. `onUpdateChange` меняет только `change.after` (отображение), а `applySelected` исполняет `actionMap[c.id]` с ОРИГИНАЛЬНЫМ input от LLM. Юзер думает, что изменил статус/дату/коммент перед применением — но применяется неотредактированное. Дыра доверия в governed-apply.

8. **История чата агента — статичное демо** — AI-агент — `widgets/landing-agent-demo/components.tsx:98-122`. Прод /agent переиспользует `AgentConversationList` с захардкоженными `HISTORY_ITEMS` и кнопками без onClick. Нет персистентности, resume, «новый чат» — чат односессионный и амнезичный после перезагрузки.

9. **Реальный WebRTC-экран звонка недостижим из UI** — Communications — `apps/web/src/app/calls/[roomId]/page.tsx` + `calls-surface.tsx:306`. Полный LiveKit-опыт (лобби, mic/cam/screen-share, фон, in-call чат) живёт на `/calls/[roomId]`, но на него ничего не ссылается. «Подключиться» лишь открывает join-contract диалог. Нужен переход «Войти в звонок».

10. **Захардкоженный текущий юзер (`ME = "u-anna"`) ломает логику владения на live** — Communications — `chat-surface.tsx:30`. Affordance «Изменить» и подсветка/тоггл своей реакции опираются на прототип-константу вместо сессии → на живом API применяются к чужому автору.

11. **CRM: навигация мёртвая (табы и сайдбар)** — CRM — `crm-frame.tsx:41-57`, `workspace-shell.tsx:7-22`. Табы Сделки/Клиенты/Контакты/Продукты — `cursor-default <span>`; сайдбар без href с фейковым бейджем «37». CRM недостижим из чрома приложения, маршруты — только прямой URL.

12. **CRM: нет админки воронок/правил и создания задач/файлов на сделке** — CRM — `deals-surface.tsx:314-341`, `deal-card-surface.tsx:251-268`. `createPipeline/updatePipeline/createStageTransition/deleteStageTransition` и `createTask/createFile` реализованы в `use-crm.ts` и имеют живые роуты, но UI-потребителей нет. Воронки и правила read-only; на сделке можно только комментировать.

13. **My-Work: нет карточки задачи и нет создания/редактирования** — Dashboard — `my-work-surface.tsx:313-344,222-263`. Карточки/строки нельзя открыть; бэкенд уже отдаёт `GET tasks/:id`, `/activity`, `/comments`, а также `POST /tasks` и `PATCH /tasks/:id`. Мутируется только статус. Крупнейшая дыра домена.

14. **Сохранённый акцент-цвет не перетемизирует приложение; переключателя темы нет** — Profile — `profile-surface.tsx:386-401` (акцент) и `:289,318-321 vs 367-403` (тема). `accentColor` персистится через `PATCH /api/profile/theme` и показывается свотчем, но ничего не драйвит `--accent`. Тема: state/diff/эндпоинт есть, а контрола в форме нет — переключить light/dark нельзя. Классический placebo-контрол.

15. **Аватар: загрузки/смены нет вообще** — Profile — `profile-surface.tsx:220`, `auth-client.ts:47-56`. Только инициалы; в `WorkspaceUser` нет `avatarUrl`, нет file-input и нет роута. Заявленная возможность полностью отсутствует.

16. **Delivery: пикеры ресурсов захардкожены на моках на live** — Project Delivery — `schedule-editors.tsx:51-71,260`, `assignments-editors.tsx:49`. `ResourceEditor`, assignee-select в TaskModal и `AddAssigneeDialog` берут статичную `RESOURCES` вместо живой `useResourceDirectory` (`/api/workspace/users`). Любая мутация-назначение шлёт нереальный `resourceId`. Инспектор Assignments — единственный пикер, подключённый к live (нестыковка).

### MEDIUM

17. **Управление сессиями и user-menu в топ-баре не смонтированы** — Auth/Profile — `avatar-menu-surface.tsx` (весь файл), `use-auth.ts:117-134`. `GET/DELETE /api/auth/sessions` и хуки готовы, но `AvatarMenuSurface` ссылается только в story. В живом приложении нет ни logout, ни ссылки на профиль, ни ревока устройств в чроме. Low-effort, high-value панель безопасности.

18. **Нет auth middleware / защиты роутов** — Auth — `apps/web` (нет `middleware.ts`). Анонимы на /dashboard, /projects, /crm не редиректятся на /login; только ProfileSurface сам рисует forbidden.

19. **Admin: нет реактивации/удаления юзера и полей email/phone/telegram/status в редакторе** — Admin — `users-surface.tsx:77-79,146-201`. Кнопка деактивации прячется у inactive — реактивировать нечем; `DELETE` есть, но не выведен; диалоги правят только name/role/position.

20. **Audit log без фильтров/пагинации/диапазона дат/refresh** — Admin — `audit-surface.tsx`. Фиксированный last-50 без колонки актора. Тонко для реального инструмента аудита.

21. **AI-агент: захардкоженные счётчики, демо-пикеры и мёртвая настройка** — AI — `components.tsx:357,388,477-513,274-298`. «5 изменений»/«4 изменения записаны» — литералы из демо; даты/владельцы в пикерах — демо-данные; меню настроек агента — плейсхолдер с dead-кнопкой.

22. **Communications: бэкенд есть, UI нет** — attach recording (`calls-surface.tsx:202,357`), вложения в чат (`chat-surface.tsx:604`), @mention-пикер, unpin (`comms-client.ts:517`). Пин необратим из UI; файлы/упоминания недоступны.

23. **CRM: нет редактирования записей и деманда; ложные «Прототип/in-memory» баннеры** — CRM — `clients-surface.tsx:88-92,54-57`, `deal-card-surface.tsx:243-248`. `updateClient/Contact/Product` привязаны только к архив/восстановить — нельзя переименовать клиента или переоценить продукт. Деманд read-only, «отдельного экрана» нет; при создании деманд захардкожен на одну `backend`-позицию, `projectTypeId = projectTypes[0]`. Баннеры противоречат реальному `<CrmRuntimeProvider live>` к Postgres.

24. **Dashboard: пустой плейсхолдер «Митинги и сигналы», некликабельные KPI/строки, полный блок при CRM 403** — Dashboard — `dashboard-surface.tsx:215-221,155-184,80-82`. Целая карта без данных; клик по KPI/задаче ничего не делает; юзер без прав на CRM не видит дашборд вообще вместо degraded-вью.

25. **Profile: смены пароля в настройках нет** — Profile — `settings-surface.tsx`. Только отдельный forgot-password флоу.

26. **Delivery: кнопки-заглушки навигации (Baseline/Filters/Columns на тулбаре Gantt, CTA в Overview/Baseline/Calendars)** — Project Delivery — `schedule-surface.tsx:853-855`, `overview-surface.tsx:150,199`, `baseline-surface.tsx:100`, `calendars-surface.tsx:266`. Baseline-страница есть и подключена — должна навигировать; фильтров задач нет нигде; CTA сигналов не ведут к экрану-решению.

27. **Delivery: revert ограничен последним коммитом сессии** — Project Delivery — `use-planning.ts:216-239`. На live `revertible=true` только для самого свежего коммита текущей сессии (before-state в памяти; `audit.beforeState` несёт лишь счётчики). Экран Commits обещает больше, чем делает.

### LOW

28. Auth: тема/акцент персистятся, но не применяются (дубль #14). Фейковые «Сохранено» пиллы на live (Admin `admin-frame.tsx:59-62`, CRM `crm-frame.tsx:58-61`).
29. AI-агент: молчаливый деградейт к фейковому LLM без ключа (`llmProvider.ts:151-152`); `update_task` рекламируется реестром, но возвращает 501.
30. Communications: mark-all-read как O(n) fan-out; мёртвые кнопки композера в `widgets/chat`.
31. CRM: cyrillic-only имена ролей → opaque timestamp-id (`roles-surface.tsx:36-40`); секции audit/system/attachment из API не рендерятся; deal-stages/project-types без write-метода в клиенте.
32. Profile: phone/telegram без валидации формата; Integrations/Billing — честные disabled-заглушки.
33. Delivery: устаревшие «Прототип · in-memory» баннеры на DB-backed экранах; project-calendar/RBAC-таблица в Settings отсутствуют; легаси-виджет `widgets/gantt/gantt.tsx` мёртвый в дереве.

---

## 3. Полный чек-лист по доменам

### Auth & Onboarding (31)
**⛔ missing**
- Приход на confirm из письма сброса — email-link → /password-reset/confirm — письмо 404-ит (`authRegistrationRoutes.ts:430-433`).
- Просмотр активных сессий/устройств — AvatarMenuSurface — бэкенд+хук готовы, surface только в Storybook.
- Ревок чужой сессии — AvatarMenuSurface — `DELETE /sessions/:id` есть, нет live-mount.
- Logout/профиль из топ-бара — WorkspaceShell — нет user-menu в чроме.
- Редирект анонима на /login — middleware — `middleware.ts` отсутствует.

**❌ stub**
- После логина → рабочая область — AuthedCard — статичный текст, нет редиректа.
- «Создать аккаунт» / «Забыли пароль?» — LoginFooter — инертные `<span>`.
- После регистрации → вход в воркспейс — register branch — статичный текст.
- «Войти» из регистрации — footer — `href="#login"` мёртвый.
- devToken-панель — ResetRequest — только в mock, на live не появляется.
- «Перейти к подтверждению» / «Перейти ко входу» / «Запросить сброс заново» — Storybook-URL.
- «Профиль»/«Настройки» в dropdown — AvatarMenu — инертный demoAction.

**⚠️ partial**
- Смена темы+акцента и сохранение — ProfileForm — PATCH персистит, но UI не перетемизируется.
- Logout из профиля — `window.location.reload()` вместо роутинга на /login.

**✅ wired** (14): открытие /login, ввод+toggle пароля, валидный/невалидный логин, logout из карточки, открытие /register + ошибки, request сброса + invalid_email, открытие confirm + ошибки токена, открытие /profile, edit name/phone/telegram, просмотр прав/ролей.

### Admin & Access Control (21)
**⛔ missing**
- Реактивация юзера — кнопка только при status=active.
- Удаление юзера — `DELETE` есть, кнопки нет.
- Фильтр/пагинация/диапазон/refresh аудита — только fixed last-50.

**❌ stub**
- Переход в Admin из сайдбара / переключение табов / пилл «Сохранено» — некликабельные `<span>` / фейк.
- Открытие Security, тоггл 2FA/SSO, session timeout/домены, save policy — нет бэкенда (404).

**⚠️ partial** (все из-за catalog-404 на загрузке)
- Open Users / Create / Edit / Deactivate user — роуты реальны, но страница падает на `permission-catalog`; диалоги без email/phone/telegram/status.
- Open Roles / Create / Edit / Delete role + permission-checklist — то же; checklist дёргает несуществующий REST.

**✅ wired** (2): редирект /admin→/admin/users; Audit log (единственный реально живой экран).

### AI-агент (24)
**❌ stub**
- Правка значения изменения + пикеры даты/владельца — косметика, демо-данные, игнорируются на apply.
- Меню настроек агента — плейсхолдер + dead-кнопка.
- История прошлых бесед / collapsed-nav / фильтр «Выбрано ▾» — статика/без onClick.
- `update_task` — 501, исключён из EXECUTABLE_MUTATIONS.
- Landing-демо — намеренно скриптовое (но делит компоненты с продом — отсюда протечка статики).

**⚠️ partial**
- Сводка после применения — счётчики «5/4» захардкожены, не из реального числа.

**✅ wired** (15): открытие /agent, отправка, live CoT, память диалога, панель сверки, select/deselect/reject, apply (governed RBAC+аудит), reset, вложения+anchor+permission-fail+remove, resource-resolution preview→apply, реальный LLM-провайдер.

### Communications & Calls (44)
**⛔ missing**
- Вложение файла в чат — контракт поддерживает attachmentIds, композер только text+sticker.
- @mention-пикер — упоминания серверные, UI нет.
- Attach recording — хук+роут есть, RoomDetail render-only.
- Вход в реальный видео-звонок — /calls/[roomId] orphaned, ничего не ссылается.

**❌ stub**
- «Подключиться» — только join-contract диалог, без медиа, не ведёт на WebRTC-вью.
- Composer extras в widgets/chat — кнопки без onClick.

**⚠️ partial**
- Стикер — список из 2 захардкоженных; постинг реален.
- Edit own message / реакции — «свой» определяется по `ME="u-anna"`, на live неверный автор.
- Pin — работает, но unpin-роута/контрола нет (необратимо).
- Background blur — реален, но скрыт на неподдерживаемых браузерах.
- View meeting detail — реальный GET, но для созданных в сессии — плейсхолдер «подтянутся с сервера»; устаревший комментарий в page.tsx.
- Mark one read / mark all read — работают, но non-idempotent / O(n) fan-out.

**✅ wired** (30): открытие чата, отправка текста, delete, mark-read, DM, presence, realtime SSE, channels (open/create/edit/members/feed), calls (open/create/start/joined-left/end/timeline), реальный LiveKit (lobby/join/toggle/in-call-chat/leave), meetings (open/create/status/notes/links/action-items), notifications feed + prefs.

### CRM (41)
**⛔ missing**
- Edit полей client/contact/product — только архив/восстановить, edit-диалогов нет.
- Создание/редактирование воронки; создание/удаление правила перехода; управление стадиями; управление project-types — бэкенд+часть клиента есть, UI-потребителей нет.
- Создание follow-up задачи и загрузка файла на сделку — роуты есть, UI нет.
- Лента активности для client/contact/product — entityType поддержан, вызывает только карточка сделки.

**❌ stub**
- Редактирование деманда — read-only, «отдельный экран» не существует.
- Секции attachments/system-events/audit ленты — API отдаёт, UI маппит только activities[].
- Навигация по табам CRM / из сайдбара / индикатор «Сохранено» — `<span>` / фейк-бейдж / декор.

**⚠️ partial**
- Create contact / product — нет поля telegram / description; нет inline-валидации.
- Create deal — projectTypeId и demand захардкожены, нет выбора owner/тип/мульти-позиции.

**✅ wired** (23): clients/contacts/products list+create+archive; deals kanban, switch pipeline, drag/list-move стадии, move pipeline, forecast, transition rules (read), deal card open/edit, feasibility, activate, finalize, лента+комментарий+toggle task, file-link open.

### Dashboard / My-Work / Home (23)
**⛔ missing**
- Drill-down с KPI-плитки — StatTile без onClick/href.
- Реордер внутри колонки — контракт без ordering (намеренно).
- Карточка/sheet задачи по клику — нигде в домене нет.
- Создание / редактирование задачи — бэкенд CRUD есть, UI только статус.
- Комментарии/активность — роуты не потреблены.
- Фильтр/поиск/сортировка — отсутствуют.

**❌ stub**
- Home (/) — статичный «design-v3 foundation» плейсхолдер.
- «Митинги и сигналы» — честный dashed-плейсхолдер, нет контракта.
- Kanban-виджет: overflow-меню колонки / интерактивность карточки — Storybook-only, disabled.

**⚠️ partial**
- CRM 403 → весь дашборд блокируется вместо degraded.
- «Ближайшие задачи» — данные реальны, строки некликабельны.

**✅ wired** (10): Dashboard load+retry, 4 KPI, deals funnel; My-Work load+empty/retry, toggle kanban/list, drag-статус (реальная 409-матрица), list-dropdown статус, rejection-notice.

### Profile & Settings (21)
**⛔ missing**
- Переключатель темы light/dark — state/diff/эндпоинт есть, контрола нет.
- Загрузка/смена аватара — нет поля, input'а, роута.
- Просмотр/ревок активных сессий — хуки+роуты есть, UI нет.
- Смена пароля из настроек — только forgot-password флоу.

**❌ stub**
- Connect integration / Manage billing — честные disabled EmptyState.

**⚠️ partial**
- Edit phone / telegram — без валидации формата.
- Pick accent color — save wired, но не применяется к UI.
- Edit profile в Settings — наследует те же дыры.

**✅ wired** (11): открытие /profile, forbidden без сессии, edit name, validation (empty/accent), просмотр прав/чипов, logout, открытие /settings+табы, матрица уведомлений, demo-banner suppressed в проде.

### Project Delivery (56)
**⛔ missing**
- Settings: смена project-calendar и таблица RBAC-ролей — вне read-model (честные заметки).

**❌ stub**
- Тулбар Gantt: Baseline / Filters / Columns — demoAction (хотя /baseline существует).
- Baseline overlay на Gantt / Calendars→Открыть График / Overview CTA (все сигналы и «Все» коммиты) — demoAction no-op.
- Settings: Open Calendar / Bitrix24 / Import MSProject — заглушки.
- Глобальный поиск — input permanently disabled.
- Легаси Storybook Gantt-виджет — мёртвый mock.

**⚠️ partial**
- Create task в TaskModal / Assign resource в grid / Create task из Resources / Add assignee — командный путь live, но пикер ресурсов на захардкоженных RESOURCES.
- Revert старого/исторического коммита — только последний коммит сессии.

**✅ wired** (40): Schedule (load, move/resize×2/progress/dependency-drag+popover+predecessors, inline-edit/create, milestone, indent/outdent, delete-subtree, batch, undo, zoom/collapse); Resources (heatmap, accept-overload, edit-hours, absence); Scenarios (preview/target/compare/apply); Baseline (open/capture/history); Calendars (open/holiday/absence); Commits (feed/revert-last/details); Settings (deadline); Assignments (matrix/inspector-edit/curve-presets/reset); Overview load; project card.

---

## 4. Что делать дальше (приоритизированный план)

**Волна 1 — разблокировать базовый прод-флоу (без этого приложение неюзабельно):**
1. Auth-редиректы: добавить `router.push('/dashboard')` после login/register (`login-surface.tsx`, `register-surface.tsx`) + `middleware.ts` для защиты роутов и редиректа анонимов.
2. Починить ссылку сброса пароля: `buildResetUrl` → `/password-reset/confirm` (`authRegistrationRoutes.ts:430`).
3. Заменить инертные `<span>` футера логина и Storybook-URL reset-флоу на `next/link`.
4. Смонтировать топ-бар user-menu (`AvatarMenuSurface`) в WorkspaceShell: logout + ссылка на профиль + сессии — хуки уже готовы.
5. Подключить навигацию чрома: сайдбар (CRM/Admin/проекты) и табы Admin/CRM на `next/link`, убрать фейковые бейджи.

**Волна 2 — убрать «ложь интерфейса» (контролы, которые лгут пользователю):**
6. Admin: либо отдать `GET permission-catalog`, либо перейти на статичную `ALL_PERMISSIONS` — это разблокирует Users И Roles разом.
7. AI-агент: пробросить отредактированный `change.after` в `applySelected` (исправить дыру доверия в governed-apply); привязать счётчики сводки к реальному числу.
8. Communications: завязать `ME` на реальную сессию (`/api/auth/me`); добавить переход на `/calls/[roomId]`.
9. Profile: либо применить `--accent`/тему к документу, либо убрать неработающий контрол; добавить переключатель темы.
10. Delivery: пробросить `useResourceDirectory().list` в три пикера ресурсов (TaskModal, ResourceEditor, AddAssigneeDialog); кнопку Baseline на тулбаре — навигировать на готовую /baseline страницу.
11. Убрать/обновить ложные «Прототип · in-memory» баннеры и фейковые «Сохранено» пиллы на DB-backed surface'ах (CRM, Admin, Delivery).

**Волна 3 — закрыть функциональные дыры с готовым бэкендом (быстрый ROI):**
12. My-Work: карточка/детальный sheet задачи (`GET tasks/:id` + /activity + /comments) и создание/редактирование задачи — крупнейшая дыра домена.
13. CRM: edit-диалоги для client/contact/product; создание задач/файлов на сделке; админка воронок и правил переходов.
14. Admin: реактивация/удаление юзера, поля email/phone/telegram/status в редакторе.
15. Profile: панель сессий+ревок и смена пароля; аватар (требует новый роут+поле).

**Волна 4 — отложенный бэкенд (планировать как фичи):**
16. Admin Security policy (модель+GET/PUT+аудит) или скрыть страницу до готовности.
17. Dashboard агрегирующий контракт (митинги/фокус/сигналы) + кликабельные KPI/строки + degraded-вью при CRM 403.
18. История бесед агента (персистентность) ; Delivery — серверный revert произвольного исторического коммита.
---

## Приложение: живая проверка в браузере/API (2026-06-30)

Автоматический аудит выше дополнен ручной проверкой на поднятом боевом стеке
(API :4010 на PostgreSQL :55433, web :3001, реальный LLM через OpenRouter
`anthropic/claude-sonnet-4.6`):

- ✅ **AI-агент работает end-to-end на реальном LLM и реальных данных.** `/api/workspace/agent/propose`
  с живым ключом: модель сама вызвала `list_my_tasks` + `detect_resource_overloads` параллельно
  против боевой БД и вернула корректный разбор настоящих задач (project-vektor-portal,
  gorset-migration и т.д.). Tools отдаются по реальному RBAC. Это снимает главный риск —
  «реальный LLM ни разу не запускался».
  - Замечен реальный баг конфигурации: дефолтный слаг `anthropic/claude-3.7-sonnet`
    не существует на OpenRouter (404 «No endpoints found») → propose падал 500.
    Исправлено на `anthropic/claude-sonnet-4.6` (в коде и .env).
- ✅ **HIGH #1 подтверждён вживую:** после входа `/login` показывает заглушку
  «Вы вошли в KISS PM… здесь — переход в рабочую область» + кнопку «Выйти», **без редиректа
  в приложение**. Блокер выхода в прод подтверждён.
- ⚠️ **Уточнение к #4 (permission-catalog):** `/admin/users` на живом стеке **отрисовал реальных
  пользователей** из БД (admin@kiss-pm.local, Игорь Инженер, …) с кнопками «Изменить»/
  «Деактивировать» — то есть страница не падает целиком (деградирует мягче, чем «error-state»).
  НО баннер «Прототип / in-memory mock» висит при живых данных — это «ложный mock-маркер».
  Вердикт #4 переоценить: проверить отдельно Roles (а не Users) и факт 404 permission-catalog.

> **Безопасность:** OpenRouter-ключ был передан в открытом виде в чате — считать
> скомпрометированным и **ротировать** (отозвать на openrouter.ai, выпустить новый). В репозитории
> ключ только в gitignored `apps/api/.env`.

### Корректировка по живой проверке (2026-06-30, волна 2)

- **#6 permission-catalog / Admin Users+Roles — ЛОЖНОЕ срабатывание аудита.** На живом
  стеке `GET /api/workspace/permission-catalog` возвращает 200 с полным перечнем прав;
  `/admin/users` и `/admin/roles` отрисовывают реальные данные из БД (юзеры, роли с числом
  прав/назначений, гард удаления назначенной роли). Фронт зовёт корректный путь
  (`admin-client.listPermissionCatalog`). Кода менять не потребовалось — пункт закрыт как
  не-баг. (Реальная проблема рядом — ложный баннер «Прототип/in-memory mock» при живых данных,
  см. #11.)
