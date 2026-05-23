# ADR: Planning realtime (SSE)

## Контекст

Phase C.1 доставляет `GET /api/workspace/projects/:projectId/planning/events` с событиями
`planVersionChanged`, `planSnapshotInvalidated` и heartbeat 15 с.

## Решение

- **Dev / single process:** in-memory `PlanningEventPublisher` (`PLANNING_EVENTS_BACKEND=memory`, default).
- **Production / multi-instance:** Redis Pub/Sub (`PLANNING_EVENTS_BACKEND=redis`, `REDIS_URL`). При недоступности Redis в **dev** — fallback in-memory с `console.warn`; в production обязателен рабочий Redis.
- **Health:** `GET /api/health/realtime` → `{ backend, connected, redisConfigured }`.
- **Подключение:** до 3 попыток connect с backoff 200/500/1000 ms (`planningRedisEventBus.ts`).
- Клиент при SSE invalidates React Query и сбрасывает локальный preview overlay (`handleConflict`).

## Контракт событий

| event | payload |
| --- | --- |
| `planVersionChanged` | `{ projectId, planVersion }` |
| `planSnapshotInvalidated` | `{ projectId, reason }` |
| `heartbeat` | `{}` каждые 15 с |

## Docker

Сервис `redis` в `docker-compose.yml`; API получает `REDIS_URL=redis://redis:6379`.

## Последствия

- Multi-instance без Redis: пользователь на инстансе A не увидит apply с инстанса B до ручного refresh.
- Smoke: `planningRedisEventBus.smoke.test.ts` (требует `REDIS_URL`).
