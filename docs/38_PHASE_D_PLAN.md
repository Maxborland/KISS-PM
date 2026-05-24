# 38. Phase D — Planning Workspace продвинутый контур

Canonical doc для реализованного среза Phase D (ветка `feature/planning-ui-design-2026-05-23`).

## Миграции

| Файл | Содержание |
|------|------------|
| `0023_phase_d_tenant_production_calendar.sql` | `tenant_production_calendars`, `tenant_production_calendar_exceptions` |
| `0024_phase_d_saved_views_custom_fields.sql` | `planning_saved_views`, `tasks.custom_fields` |
| `0025_phase_d_absences.sql` | `resource_absences` |
| `0026_phase_d_org_structure.sql` | `tenant_org_nodes`, `tenant_user_org_placements` |
| `0027_tenant_org_nodes_composite_pk.sql` | PK `(tenant_id, id)`, composite FK для parent и placements |

> `0022` занят `phase_5_6_planning_command_idempotency.sql`.

## D.1 Production calendar (tenant-wide)

- Storage: отдельные tenant-таблицы (не `resource_calendars`).
- `calendar_id` по умолчанию: `tenant-default` (`tenantProductionCalendarConstants.ts`).
- API: `GET /api/tenant/current/production-calendar`, `POST .../bulk`.
- UI: `/settings/production-calendar`, permission `tenant.workspace_config.*`.
- В `getPlanSnapshot` exceptions tenant-default подмешиваются в `calendarExceptions`.
- ICS import — Phase E.

## D.2 Monthly resource matrix

- **Interim-иерархия** (если оргструктура не настроена): **должность → пользователь** (`positions` + `tenant_users.position_id`).
- **Целевая иерархия** (при наличии узлов в D.7): **направление → отдел/команда → должность → сотрудник**, переключатель functional/project в `ResourcesPane`.
- Горизонт: дни **месяца** (`useMonthlyResourceMatrix`, `MonthNavigation`).
- Семантика ячеек:
  - `is-absence` — только при записи `resource_absences` на дату (не через `exceptionMinutes === 0`);
  - `is-free-day` — рабочий день без назначенной работы и без отсутствия;
  - `is-holiday` — tenant-wide non-working из production calendar.
- Cross-project: `GET /api/tenant/current/scheduled-tasks`.
- UI: `features/planning/resources/*`; absences для матрицы — отдельный `useAbsences`, не merge в `getProductionCalendar`.

## D.3 project.settings.update

- `PlanningCommand` `project.settings.update` + reducer + `planningParsers`.
- UI: `ProjectSettingsPane`, `CalendarPreviewSummary`.

## D.4 Saved views + custom fields

- `planning_saved_views`, `tasks.custom_fields jsonb`.
- REST saved-views в `planningRoutes.ts`.
- `task.update_custom_field` command.
- UI: `savedViews/*`, `customFields/CustomFieldDefinitionsPane`, `wbsColumns` + `SavedViewsDropdown`.

## D.6 Absences plane

- Типы: `vacation`, `admin_leave`, `sick_leave`, `maternity_leave`, `truancy`.
- Таблица `resource_absences`, repo `resourceAbsencesRepository.ts`.
- Permissions: `tenant.absences.read`, `tenant.absences.manage`.
- API: `GET/POST/DELETE /api/tenant/current/absences`.
- Planning: absences → `PlanCalendarException` в `getPlanSnapshot` (capacity); для UI матрицы — прямой lookup `resource_absences`.
- UI: `/settings/absences`, `features/absences/*`, e2e `e2e/admin/absences.spec.ts`.
- Approval workflow — Phase E.

## D.7 Org structure (tenant settings)

- Два трека: **functional** (направление → отдел → должность → сотрудник) и **project** (направление → команда → должность → сотрудник).
- Таблицы: `tenant_org_nodes`, `tenant_user_org_placements`.
- PK узлов: **`(tenant_id, id)`** — id уникален в пределах tenant, не глобально (миграция `0027`).
- Доменный контракт: пакет `@kiss-pm/tenant-org-structure` (типы, `validateOrgStructureReplace`, `isPlacementConsistentWithNodes`, graph helpers).
- Application: `replaceTenantOrgStructureCommand` (audit + replace); persistence — только storage.
- Permissions: `tenant.org_structure.read`, `tenant.org_structure.manage`.
- API: `GET/PUT /api/tenant/current/org-structure` (PUT = full replace snapshot).
- UI: `/settings/org-structure`, `features/org-structure/*`; consumers: матрица ресурсов (4 уровня + toggle), фильтры Users по placements.
- **Конкурентное редактирование:** last-write-wins; черновик UI защищён `isDraftDirty` от refetch. Optimistic lock / etag — Phase E+ (см. `docs/decisions/tenant-org-structure.md`).

## Phase E (planned) — Tenant resource load report

- Агрегация загрузки **по всем проектам** tenant (не вкладка одного проекта).
- Группировка по выбранному org track: направление → отдел/команда → должность → сотрудник.
- Источники: assignments + `resourceLoad` / capacity, production calendar, absences.
- Phase E уточняет старое Phase 3 правило по draft: tenant capacity считает только
  capacity-committed planning containers (`active`, `paused`, а также `draft` с
  реальными assignments/reservations). Draft по-прежнему не попадает в active
  projects workspace API, но его явная плановая занятость видна resource manager'у
  в tenant-wide capacity.
- Поверхность: отдельный маршрут или control surface (TBD в `docs/12_ФАЗОВЫЙ_ПЛАН.md`).

## Out of scope (Phase E)

- ICS import production calendar.
- Drag-fill bulk, approval workflow для absences.
