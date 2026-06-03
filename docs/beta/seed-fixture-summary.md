# KISS PM: beta seed fixture

Этот seed нужен для founder-beta walkthrough, а не для декоративного demo. Он должен давать стабильные сущности архитектурного бюро для dashboard, deals, projects, My Work, planning/resources и agent/audit проверок.

## Команды

```bash
pnpm db:up
pnpm db:reset:dev
```

`db:reset:dev`:

- выполняет миграции;
- сбрасывает только local dev database `localhost|127.0.0.1/kiss_pm`;
- запускает `db:seed:dev`;
- запускает `db:seed:check`.

## Состав tenant-alpha

| Сущность | Seed contract |
| --- | --- |
| Клиенты | 3: `ГК Северный квартал`, `Фонд Музей города`, `Отель Набережная` |
| Сделки | 5 в разных стадиях, включая `ready_to_activate` и `blocked` feasibility |
| Проекты | 4, включая активный просроченный проект |
| Задачи | 24 активные задачи |
| Пользователи | 6 пользователей tenant-alpha с ролями проектного бюро |
| Workload | Назначения задач + reservations; есть минимум один overload bucket |
| Missing role | `position-interior-designer` есть в demand, но не закрыта пользователем |
| Blocked/waiting | минимум одна задача в `waiting` с activity `Блокер требует решения` |
| Overdue | минимум одна незавершенная задача просрочена относительно `2026-06-03` |
| Audit | минимум 3 seed audit events для project risk, blocker и agent result |

## Stable IDs

- Admin login: `admin@kiss-pm.local` / `admin12345`.
- Seeded users: `user-alpha-admin`, `user-alpha-lead-architect`, `user-alpha-architect`, `user-alpha-bim`, `user-alpha-estimator`, `user-alpha-engineer`.
- Core projects: `project-demo-crm-intake`, `project-beta-school-renovation`, `project-beta-museum-concept`, `project-beta-hotel-interiors`.
- Attention tasks: `task-beta-school-fire-brief`, `task-beta-hotel-interior-gap`, `task-beta-cross-resource-conflict`.

## Proof

`pnpm db:seed:check` fails unless the beta seed contains:

- at least 3 clients;
- at least 5 deals;
- 4 projects;
- 20-40 active tasks;
- 5-8 tenant users;
- workload assignments;
- at least one overdue task;
- at least one waiting/blocker task;
- at least one missing-role demand;
- at least one overload bucket;
- at least 3 audit events.
