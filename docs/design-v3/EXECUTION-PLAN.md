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
- [ ] **P2.1** planning **commits revert**: `POST …/planning/revert/:auditEventId` — server-side reconstruct inverse через `buildCompensatingCommands` (`packages/planning-client/src/undo`) + apply. Включить откат в delivery `commits-surface` (сейчас `latestRevert=null`). M ⬩dep: read governedPlanningApply/planningRouteHelpers. **Завершает delivery-домен по бэку.**
- [ ] **P2.2** admin **permission-catalog**: `GET /api/workspace/permission-catalog` → список назначаемых прав (из `@kiss-pm/access-control`). Фронт `admin/roles` берёт каталог из бэка вместо client-enum. M
- Приёмка: e2e revert (apply команду → revert → план вернулся к версии N−1); каталог прав отдаётся и рендерится.

## P3 — Backend с миграциями (M–L)  ·  PR #210
- [ ] **P3.1** admin **security-policy**: новая таблица `tenant_security_policies` (миграция) + `GET`/`PUT /api/tenant/current/security-policy` {twoFactorRequired, sessionTimeoutHours, ssoSamlEnabled, domainAllowlist}. Фронт — карточка «Политики безопасности». M ⬩dep: drizzle migration + schema.
- [ ] **P3.2** auth **active-sessions**: миграция (добавить `device/userAgent/ip/lastSeenAt` в `user_sessions`) + `GET /api/auth/sessions` (+ опц. `DELETE /api/auth/sessions/:id`). Фронт — avatar-menu «Активные сессии». M–L ⬩dep: migration.
- [ ] **P3.3** auth **password-reset token policy**: подтвердить EmailProvider-проводку; dev-режим — отдать `devToken` под флагом для тестов (прод — письмо). S–M.
- Приёмка: каждая миграция идемпотентна; e2e GET/PUT/list.

## P4 — Realtime-эпик (L, отдельный эпик)  ·  PR #210/новый
- [ ] **P4.1** **SSE realtime**: `GET /api/workspace/realtime/events` (text/event-stream) для `message.created` + `notification.created` (зеркало `planningEventBus`/`planningEventsRoute`). Фронт: chat/notifications живут на push вместо poll. L
- [ ] **P4.2** **DM-канал**: миграция (тип conversation `direct` + membership) + `POST /conversations/direct`. Фронт: DM-список в chat. L ⬩dep: migration + P4.1.
- [ ] **P4.3** **presence**: presence-эндпоинт/поле + online/away в chat. L ⬩dep: P4.1.
- Приёмка: e2e — новое сообщение приходит подписчику без рефетча.

## P5 — Долг/уборка (опционально)  ·  ветка #209
- [ ] Удалить осиротевшие design-v2 routes (`/deals`, `/calls/[roomId]`, `/agent`) и монолит `views/screens/runtime-screen-view.tsx` + `views/blocks/*` после подтверждения, что v3-аналоги покрывают.
- [ ] Дотянуть `inspector` (сейчас панель) — решить: вкладка проекта или drawer.

---

## Порядок исполнения
P0 (merge — за тобой) ∥ **P1 (катаю сразу — видимый разрыв закрывается быстро)** → P2 (revert завершает delivery) → P3 (миграции) → P4 (realtime-эпик) → P5 (уборка).

Каждый пункт = свой коммит-слайс с e2e; статус отмечаю чекбоксами здесь по мере прохождения.
