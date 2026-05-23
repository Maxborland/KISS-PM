# ADR: employee-day как единый источник истины для ресурсной ёмкости

## Статус

Принято (UX-6 closeout, 2026-05).

## Контекст

Ранее матрица ресурсов в планировании считалась в браузере **per-project**, а дашборд использовал эвристики. Это давало дрифт: локально 50%+60% в двух проектах выглядело нормально, хотя сотрудник перегружен на 110%.

## Решение

1. **Примитив `EmployeeDayLoad` / merge по workspace** в `packages/domain/src/planning/employeeCapacity.ts`.
2. **Инвариант перегруза:** `isOverload(user, day) := workMinutes_total(user, day) > capacityMinutes(user, day)`.
3. **Per-project view:** `workMinutes` в ячейке — доля проекта из `projectsMix`; `isOverload` и `heat` — от employee-total.
4. **Скрытые проекты:** минуты без `tenant.projects.read` агрегируются в `projectId: "__hidden__"` без утечки названий.
5. **API:** `GET /api/workspace/capacity/tree` и `GET /api/workspace/capacity/summary`; кеш LRU 60s, инвалидация при `planVersionChanged`.
6. **`overloadProjectIds` (дашборд):** вариант 1 — проекты из `projectsMix` в дни employee-overload (`collectProjectsWithOverloadedEmployees`), не per-project bucket и не агрегат проекта.

## Две метрики (не путать)

| Метрика | Определение | В продукте |
|---------|-------------|------------|
| Перегруз сотрудника | `workMinutes_total > capacityMinutes` за день | Матрица, `overloadUserCount` |
| Участие проекта в перегрузе | Проект есть в `projectsMix` в overload-day | `overloadProjectIds`, «Участвует в перегрузе» |
| Перегруз проекта (агрегат) | `Σ минут на P` vs порог команды | **Out of scope** |

Круги Эйлера **не вложены**: cross-project 110% даёт employee-overload и оба проекта в списке, без агрегатной перегрузки проекта.

## Последствия

- Фронтенд не агрегирует нагрузку; только отображает `OrgCapacityTree` / `CapacitySummary`.
- Матрица в двух проектах для одного пользователя в один день показывает одинаковый флаг перегруза.
- Сборка дерева на API опирается на plan snapshots всех активных проектов (не отдельный SQL-агрегатор на `task_assignments` в этом срезе).

## Связанные документы

- `docs/decisions/capacity-summary-api.md`
- `docs/plans/ux-remediation-2026.md`
