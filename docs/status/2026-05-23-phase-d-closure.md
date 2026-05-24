# Phase D closure — 2026-05-23

## Baseline (до правок матрицы)

- `pnpm test` — 291 passed
- `pnpm typecheck` — OK
- `pnpm build` — OK

## Post verification (матрица + оргструктура)

- `pnpm test` — **299 passed** (55 files)
- `pnpm typecheck` — OK
- `pnpm build` — OK
- `pnpm db:migrate` — миграция `0026_phase_d_org_structure.sql`
- `pnpm test:db` — **99 passed** (14 files); TRUNCATE в db-тестах дополнен `tenant_org_nodes` / `tenant_user_org_placements`, audit — `auditEvents`

## Семантика ячеек матрицы (Part A)

| Класс | Условие |
|-------|---------|
| `is-absence` | Запись `resource_absences` на `userId` + `date` |
| `is-free-day` | `workMinutes === 0`, capacity > 0, нет absence, не weekend/holiday |
| `is-holiday` | Tenant exception `resourceId=null`, `workingMinutes=0` |

`getProductionCalendar` больше не подмешивает absences; `getPlanSnapshot` — по-прежнему учитывает для capacity.

## Оргструктура (Part B)

- Настройка: `/settings/org-structure`
- Матрица: 4 уровня при наличии направлений в выбранном треке; иначе interim `position → user`
