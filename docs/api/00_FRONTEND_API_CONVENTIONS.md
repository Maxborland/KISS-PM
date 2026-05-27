# Frontend API Conventions

## Base URL

В dev окружении web ходит в backend через Next rewrites:

- Web: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:4000`
- Frontend вызывает `/api/...` относительно web origin.

## Auth

Основной режим — browser session cookie `kiss_pm_session`.

- `POST /api/auth/login` создает cookie.
- `POST /api/auth/logout` удаляет cookie.
- `GET /api/auth/me` возвращает текущего пользователя и профиль.
- Если сессии нет или она невалидна, API возвращает `401 { error: "session_required" }`.

Dev routes `/api/session/*` включаются только локально и не являются product API.

## Mutation Guard

Все browser mutations, кроме `POST /api/auth/login`, требуют:

```http
x-kiss-pm-action: same-origin
```

Backend также проверяет trusted origin / fetch metadata. Если guard не пройден:

```json
{ "error": "same_origin_action_required" }
```

Фронт должен добавлять этот header ко всем `POST`, `PUT`, `PATCH`, `DELETE`.

## Error Shape

Стабильная форма ошибки:

```json
{ "error": "machine_readable_code" }
```

Частые статусы:

- `400` — неверный payload, query или route id.
- `401` — нет валидной сессии.
- `403` — не хватает permission или same-origin guard.
- `404` — entity не найдена или route недоступен.
- `409` — lifecycle/conflict/stale version.
- `413` — payload слишком большой.
- `501` — provider/persistence capability не включен в runtime.

Фронт не должен парсить текст исключений; только `error` code.

## Optimistic / Stale State

Planning, solver, control actions и closure используют server-side preconditions:

- `planVersion`
- `clientPlanVersion`
- persisted proposal/run hash
- lifecycle state

Если API возвращает stale/conflict ошибку, фронт должен обновить read model и
показать пользователю понятный conflict state вместо повторного blind apply.

## Permissions

Фронт может использовать API responses для disabled/empty/error states, но не
должен считать hidden UI контролем доступа. Backend всегда повторно проверяет
permissions и пишет audit для существенных denied/governed actions.

## Cache

Backend API по умолчанию выставляет:

```http
Cache-Control: no-store, private
```

Фронт может кешировать server state в TanStack Query, но должен инвалидировать
queries после successful mutation согласно workflow, а не полагаться на HTTP cache.
