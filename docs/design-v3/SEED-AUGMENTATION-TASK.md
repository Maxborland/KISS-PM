# TASK: дополнить dev/test сиды до «нормальных» связанных данных

**Зачем:** прод-routes v3-surfaces работают на реальном backend (`/api/*` → Hono → Postgres `:55433`).
Текущий сид слишком тонкий, чтобы surfaces показывали репрезентативные данные и чтобы покрыть
состояния (несколько проектов, оргструктура, CRM, communications).

## Текущее состояние сида (БД `kiss_pm`, 2026-06-28)
| Сущность | Сейчас | Достаточно? |
|---|---|---|
| projects | **1** (`project-demo-crm-intake` «CRM intake») | ✗ нужно ≥3 |
| tasks | 9 (реальное WBS-дерево: фазы → задачи → веха) | ✓ для 1 проекта |
| task_assignments / task_dependencies / task_participants | 7 / 3 / 14 | ✓ для 1 проекта |
| tenant_users | 5 | ✓ (хватает на WORKSPACE_USERS) |
| task_statuses | 10 | ✓ |
| positions | 2 | ✗ тонко |
| **tenant_org_nodes** | **0** | ✗ нет оргструктуры → Resources-матрица без группировки (направление/отдел/роль) |
| opportunities / clients / contacts / products | проверить | нужно для CRM-surfaces |
| meetings / communication_channels / user_notifications | проверить | нужно для Communications-surfaces |

## Что добавить (источник: `scripts/seed-dev.ts` + `@kiss-pm/test-fixtures` `createDemoTenantDataset`)
1. **≥3 связанных проекта** с разными статусами (в работе / под риском / завершён), у каждого
   полное WBS-дерево (≥2 фазы, подзадачи, ≥1 веха), зависимости (FS/SS), назначения на реальных
   `tenant_users`, ≥1 baseline (для surface Baseline — сравнение план/факт).
2. **Оргструктура** `tenant_org_nodes` (направление → отдел → позиции) + `tenant_user_org_placements`,
   чтобы Resources-матрица группировала по team/role/person (scope в `resources-surface`).
3. **CRM**: clients/contacts/products + opportunities в разных стадиях `deal_stages` (для CRM-surfaces).
4. **Communications**: communication_channels + сообщения + user_notifications + 1 meeting с
   участниками (для chat/notifications/meetings-surfaces).
5. Привязать всё к `tenant-alpha` (основной демо-тенант) — связи между сущностями обязательны
   (проект ↔ opportunity, задача ↔ исполнитель ↔ позиция ↔ оргузел).

## Критерий приёмки
- `/projects/<id>/schedule|resources|baseline` показывают непустые реальные данные для ≥3 проектов.
- Resources-матрица имеет ≥2 уровня группировки (направление/отдел).
- CRM/Communications-surfaces не упираются в empty-state из-за отсутствия данных.
- `pnpm db:reset:dev` (с `DATABASE_URL=…:55433`) воспроизводит набор идемпотентно.
