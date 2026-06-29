# design-v3 → production — мастер-план с приоритетами

Статус на старте плана: фронт мигрирован (все 6 доменов, PR #208 SSOT + #209 миграция, `tsc`+`build`=0);
backend слайсы 1–4 готовы (PR #210, каждый e2e против Postgres :55433). Ниже — что осталось, по приоритету.

**Цикл на каждый пункт:** read паттерн → реализация миррором → `tsc -b` + контракт-тест + **e2e против :55433** → коммит-слайс → push в свой PR. Никаких фейков: если бэка нет — surface честно держит заглушку, пункт — отдельный слайс.

Легенда: effort S(часы)/M(день)/L(несколько дней); ⬩dep = зависимость.

---

## P0 — Приземлить готовое (разблокирует всё)  ·  действие пользователя/CI
- [ ] Смержить стек: **#208 → трунк** (`codex/backend-prod-go-no-go-fixes`), затем **#209 → #208**, **#210 → трунк**. Все три MERGEABLE/CLEAN.
- Приёмка: трунк содержит v3-фронт + 4 backend-слайса; `build`+`tsc` зелёные на трунке.

## P1 — Замкнуть петлю по готовому бэку (высокий value / низкий effort)  ·  ветка #209
Эндпоинты УЖЕ есть (слайсы 1/3/4) — фронт пока на честных заглушках. Подключаем:
- [x] **P1.1** meetings-surface → `GET /api/workspace/meetings/:id` (`SEED_DETAIL` убран; `comms-client.getMeeting` + `useMeetingDetail` + mock-роут; рефетч после мутаций). ✅ tsc 0 · Storybook рендерит реальную деталь.
- [x] **P1.2** meetings ActionItemsCard → `PATCH …/action-items/:id {status}` (живой select open/done/cancelled; `comms-client.patchActionItem` + `useMeetings.patchActionItem` + mock PATCH-роут). ✅ tsc 0 · Storybook рендерит селект.
- [x] **P1.3** comms бейдж непрочитанного → `GET /api/workspace/unread-summary` (`comms-client.getUnreadSummary` + `useUnreadSummary` + mock-роут; бейджи на табах Чат/Уведомления в `comms-frame`). ✅ tsc 0 · Storybook рендерит «Чат 2 / Уведомления 2».
- **P1 ЗАКРЫТ** ✅ — все 4 backend-слайса (#210) потребляются фронтом.
- Приёмка: Storybook этих экранов не падает (mock-роуты добавить в `mock-comms-backend`); e2e на :55433 показывает реальные детали/тоггл/число.

## P2 — Быстрые backend-победы (M, без миграции) + их фронт  ·  PR #210 (бэк) + #209 (фронт)
- [x] **P2.1** planning **commits revert** — оказался **frontend-only** (backend-эндпоинт НЕ нужен): `usePlanning` держит последний apply (commands + before read-model + afterVersion) в памяти; live `loadCommits` отдаёт его как `latestRevert`, и `commits-surface` строит инверсию через `buildCompensatingCommands` + applyBatch (контракт уже был). Откат — для последнего коммита сессии; произвольный исторический откат = будущая серверная задача (audit.beforeState только счётчики). ✅ tsc 0 · Storybook commits рендерит «Откатить».
- [x] **P2.2** admin **permission-catalog** — backend `GET /api/workspace/permission-catalog` (59 прав из `@kiss-pm/access-control`, session+canReadAccessProfiles; e2e 200/401) + фронт `admin/roles` берёт каталог из бэка (`useAdmin` грузит `data.permissions`, группы строятся в компоненте; `ALL_PERMISSIONS` — типизированный fallback). ✅ tsc 0 · openapi 6/6 · Storybook рендерит «59 прав».
- **P2 ЗАКРЫТ** ✅ — delivery замкнут (revert), admin-роли на реальном каталоге.

## P3 — Backend с миграциями (M–L)  ·  PR #210
- [x] **P3.1** admin **security-policy**: таблица `tenant_security_policies` (миграция 0044, идемпотентна) + `GET`/`PUT /api/tenant/current/security-policy` {twoFactorRequired, sessionTimeoutHours, ssoSamlEnabled, domainAllowlist} в `registerWorkspaceConfigRoutes` (гейт canRead/canManageWorkspaceConfig, audit, нормализация allowlist trim/lowercase/dedup, timeout 1..8760). Фронт — вкладка «Безопасность» + карточка «Политики безопасности» (Switch 2FA/SSO, число тайм-аута, tag-editor доменов; `useSecurityPolicy` + mock GET/PUT). ✅ tsc 0 (api+web) · openapi 6/6 · mock-admin 30/30 · миграция применена+идемпотентна · e2e :55433 GET defaults→PUT→GET (allowlist нормализован) · bad timeout→400 · no cookie→401 · Storybook: round-trip toggle→Save→«сохранена».
- [x] **P3.2** auth **active-sessions**: миграция 0045 (`user_agent/ip_address/last_seen_at` в `user_sessions`, идемпотентна) + `GET /api/auth/sessions` (deviceLabel из UA, current-флаг) + `DELETE /api/auth/sessions/:id` (текущую нельзя). `last_seen_at` бьётся в единственном чокпоинте резолва сессии с throttle 60с. Фронт — avatar-menu «Активные сессии» (список устройств + отзыв; `useAuth.sessions/loadSessions/revokeSession` + mock GET/DELETE). ✅ tsc 0 (api+web) · openapi 6/6 · app/authSession 62/62 · mock-auth 27/27 · миграция применена+идемпотентна · e2e :55433 2 логина→список(device/current)→revoke other 200→revoke current 400→unknown 404→401 · Storybook: 3 сессии, revoke Firefox→2.
- [x] **P3.3** auth **register + password-reset** — НАХОДКА: бэка не существовало нигде (фронтовый mock ссылался на несуществующий `authRegistrationRoutes.ts`). Построен с нуля под контракт мока (mock = спека):
  - **8a register** (#210): `+createTenant` repo + POST `/api/auth/register` (свежий тенант + owner-роль с полным каталогом прав + user + scrypt-кред в транзакции + авто-логин). Порядок кодов зеркалит mock: payload→weak_password→email_taken.
  - **8b password-reset** (#210): миграция 0046 `password_reset_tokens` (идемпотентна) + repo (create/find/consume) + `exposeDevSecrets` (=enableDevTenantRoutes) в deps + POST `/password-reset/request` (anti-enum, всегда 202; dev→devToken, prod→лог до SMTP) + `/confirm` (parse→weak→invalid_token→used→expired; смена пароля + consume + гашение сессий в tx).
  - **Фронт** (#209): register/reset surfaces + client + hook + live-прод-страницы УЖЕ были (mock-only) — теперь под ними реальный бэк; код менять не пришлось, только ссылки `authRegistrationRoutes.ts`→`authRoutes.ts`.
  - ✅ tsc 0 (api+web) · openapi 6/6 · app/authSession 68/68 · mock-auth 27/27 · миграция 0046 идемпотентна · e2e register (201/409/400/403, кириллица UTF-8) · e2e reset (devToken→confirm→login new/old, used/unknown/invalid/weak, prod без devToken).
- **P3 ЗАКРЫТ** ✅ — security-policy, active-sessions, register+reset на реальном бэке.
- Приёмка: каждая миграция идемпотентна; e2e GET/PUT/list. ✓

## P4 — Realtime-эпик (L, отдельный эпик)  ·  PR #210/новый
- [x] **P4.1** **SSE realtime** — backend (#210): `workspaceEventBus` (in-memory pub/sub по каналам `user:{id}`/`conversation:{id}`; ponytail: Redis при >1 реплике) + `GET /api/workspace/realtime/events` (SSE, всегда `user:{actor}`, опц. `conversation:{id}` с валидацией доступа; heartbeat 15с) + эмит `message.created`/`notification.created` после коммита POST-сообщения. Фронт (#209): `useWorkspaceRealtime` (live-only EventSource; mock=no-op) → chat перечитывает ленту на `message.created`, comms-frame перечитывает unread на `notification.created`. ✅ tsc 0 (api+web) · openapi 6/6 · app 57/57 · comms-mock 64/64 · e2e :55433 (SSE 401/404/200 event-stream → POST 201 → `message.created` получен с телом) · Storybook chat рендерит без регрессий. ⚠️ live-push в браузере требует полного стека (Next+API) — backend-доставка доказана node-e2e.
- [x] **P4.2** **DM-канал** — backend (#210): домен +"direct" (conversationType+entityType); миграция 0047 (пересоздание CHECK conversations + таблица `conversation_members`, идемпотентна); repo membership (add/is/listIds/listDirectForUser); `resolveConversationForActor` ветвит DM на гейт членства; `POST`/`GET /api/workspace/conversations/direct` (create-or-get по детерминированной паре + counterpartUserIds); SSE-канал беседы тоже по членству; DM-сообщение шлёт notification.created второму участнику. Фронт (#209): `DirectConversation` тип + client (list/create) + `useDirectMessages` + mock (сид DM + роуты) + chat-surface DM-секция «Личные сообщения» (имя собеседника, бейдж, выбор → лента; пикер «новый DM»). ✅ tsc 0 (api+web) · openapi 6/6 · app 57/57 · domain-collab 14/14 · mock-comms 64/64 · миграция идемпотентна · e2e :55433 (open 201 idempotent · member post/list · GET /direct + counterpartUserIds · self 400 · unknown 404 · НЕ-участник read/post/SSE 403) · Storybook: DM-список рендерит «Иван И.» + создание DM с «Сергей П.» + выбор→лента.
- [x] **P4.3** **presence** — backend (#210): `presenceStore` (online=есть открытое SSE с рефкаунтом вкладок; away=недавно отключился ≤5мин; offline) + `presence.changed` событие + `tenant:{id}` канал; SSE на connect→online, на disconnect→away (через `stream.onAbort` — sleep не прерывается обрывом), heartbeat освежает; `GET /api/workspace/presence` (снимок). Фронт (#209): `usePresence` (initial GET + live `presence.changed`), `useWorkspaceRealtime.onPresence`, `PresenceDot` (green/amber/grey) на аватарах DM-собеседников и авторов сообщений. ✅ tsc 0 (api+web) · presenceStore unit 6/6 · openapi 6/6 · app 57/57 · mock-comms 64/64 · e2e :55433 (connect→online, второй юзер→online, disconnect→away ~1.5с; admin-SSE получил presence.changed online→away; снимок отражает) · Storybook: точки «В сети»/«Недавно был(а)»/«Не в сети» по статусам.
- **P4 ЗАКРЫТ** ✅ — SSE realtime, DM-канал, presence на реальном бэке.
- Приёмка: e2e — новое сообщение приходит подписчику без рефетча. ✓

## P5 — Долг/уборка (опционально)  ·  ветка #209
**Аудит зависимостей (выполнен) поправил посылку плана:** монолит `runtime-screen-view`
(+`screen-view`+`views/blocks/*`) — НЕ свободно-удаляем: он load-bearing для 6 маршрутов.
Удалять можно только то, что (а) реально осиротело и (б) имеет v3-замену.
- [x] **Удалены 3 v3-покрытых v2-маршрута** (подтверждено: нет внешних ссылок, есть v3-аналог, нет в навигации):
  `/deals` + `/deals/[id]` → `/crm/deals` (+`[id]`); `/projects/[id]/timeline` → `/projects/[id]/schedule` (v3-вкладка «График»; «timeline» нет в `DELIVERY_TABS`). ✅ tsc 0 · typegen ок · storybook-health 11/11.
- [ ] **Ретайр монолита — ЗАБЛОКИРОВАН** (требует net-new v3-маршрутов, это уже не «уборка»):
  `/admin` (09-admin лендинг) и `/admin/audit` рендерят монолит — v3 admin-surface'ов для лендинга/аудита нет;
  `/agent` (11-agent, marketing-демо) — v3-аналога нет. Пока эти 3 маршрута живут, нельзя удалять
  `runtime-screen-view`/`screen-view`/`views/blocks/*`. `/calls/[roomId]` — боевой livekit-экран (НЕ v2-прототип), оставлен.
  Дальше: либо построить v3 для admin-landing/audit + решить судьбу `/agent`, тогда удалить монолит; либо оставить как есть.
- [ ] Дотянуть `inspector` (сейчас панель) — решить: вкладка проекта или drawer. (Не начато — отдельная фича-задача, не уборка.)

---

## Порядок исполнения
P0 (merge — за тобой) ∥ **P1 (катаю сразу — видимый разрыв закрывается быстро)** → P2 (revert завершает delivery) → P3 (миграции) → P4 (realtime-эпик) → P5 (уборка).

Каждый пункт = свой коммит-слайс с e2e; статус отмечаю чекбоксами здесь по мере прохождения.
