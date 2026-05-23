# Phase D closure — 2026-05-23

## Delivered

- **D.1** Tenant production calendar: `tenant_production_calendars`, `tenant_production_calendar_exceptions`, API `GET/POST /api/tenant/current/production-calendar`, UI `/settings/production-calendar`, RF 2026 preset.
- **D.2** Monthly resource matrix: hierarchy position → user, `GET /api/tenant/current/scheduled-tasks`, hover tooltip + day drawer, heatmap in `ResourcesPane`.
- **D.3** `project.settings.update` command + `ProjectSettingsPane` with calendar preview.
- **D.4** `planning_saved_views`, `tasks.custom_fields`, saved views REST, `task.update_custom_field`, WBS saved views + custom field pane.
- **D.6** Absences plane: `resource_absences`, `0025_phase_d_absences.sql`, API absences, planning/production-calendar merge, UI `/settings/absences`.
- Migrations `0023`, `0024`, `0025`; e2e specs under `e2e/admin` and `e2e/planning`.

## Verification

```bash
pnpm test && pnpm typecheck && pnpm build
# OK on 2026-05-23 (291 unit tests)

pnpm db:up && pnpm db:migrate && pnpm test:db
pnpm db:reset:dev && pnpm test:e2e:smoke
# Требует локальный Postgres (docker compose). При недоступности Docker/registry — не прогонялось в closure-сессии.
```

## Out of scope (Phase E)

- ICS import, division/workshop hierarchy, absences approval workflow.
