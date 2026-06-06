# ADR: Capacity API (`/tree`, `/summary`)

## Статус

Принято (UX-6 closeout, 2026-05).

## Эндпоинты

| Метод | Путь | Право | Назначение |
|-------|------|-------|------------|
| GET | `/api/workspace/capacity/tree?monthIso=YYYY-MM[&projectId=]` | `tenant.project_resources.read` | `OrgCapacityTree` для матрицы ресурсов |
| GET | `/api/workspace/capacity/summary?monthIso=YYYY-MM` | `tenant.project_resources.read` | Агрегат для дашборда: `overloadProjectIds`, `buckets`, `overloadUserCount`, `generatedAt` |

## Кеш

- In-memory LRU per-tenant, TTL **60 секунд**.
- Инвалидация всех ключей tenant при SSE `planVersionChanged` (см. `invalidateCapacityCacheForTenant`).

## Семантика `overloadProjectIds` (вариант 1)

Проекты, в которых **участвуют перегруженные сотрудники** (employee-total): для каждого дня месяца, где `workMinutes_total(user) > capacityMinutes(user)`, в множество попадают все `projectId` из `projectsMix` (кроме `__hidden__`).

Пример: 5 ч на проект A + 4 ч на проект B в один день → оба id в `overloadProjectIds`.

Это **не** агрегатная «перегрузка проекта» (`Σ минут на P` vs порог команды) — отдельный продуктовый slice.

## Контракт summary

```json
{
  "monthIso": "2026-05",
  "overloadProjectIds": ["project-a"],
  "buckets": { "low": 12, "mid": 4, "high": 2 },
  "overloadUserCount": 3,
  "generatedAt": "2026-05-23T12:00:00.000Z"
}
```

## Реализация

- `apps/api/src/capacity/capacityService.ts` — сборка из plan snapshots + org structure + production calendar + absences.
- `apps/api/src/capacity/registerCapacityRoutes.ts` — маршруты и кеш.
