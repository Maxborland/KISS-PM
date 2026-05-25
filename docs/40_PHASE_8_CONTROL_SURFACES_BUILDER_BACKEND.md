# 40. Phase 8: Control surfaces builder backend

## Статус

Backend-scope Phase 8 реализован (PR #25, hotfix PR #26). Этот документ остается canonical contract для конструктора управленческих поверхностей; Phase 10 проверяет его как production hardening surface.

UI builder, визуальные редакторы и frontend-роутинг публикуемых surfaces идут отдельным UI slice. Backend обязан фиксировать контракт так, чтобы будущий UI не придумывал собственные права, action binding, preview/publish и versioning.

## Product intent

Control surface в KISS PM не является отчетом или произвольным BI-виджетом. Это управленческий инструмент, который соединяет:

1. разрешенный read model;
2. понятный вид представления;
3. поля, фильтры, группировки, KPI/widgets и severity rules;
4. drilldown;
5. разрешенные действия;
6. preview перед публикацией;
7. versioning, rollback и audit.

## User story

Как tenant admin, я хочу создать surface из guided preset, проверить definition через preview и опубликовать версию, чтобы обычные пользователи могли работать с управленческой поверхностью по своим правам без ручной разработки.

## Backend boundaries

### Domain

`packages/domain/src/controlSurfaces/*` отвечает за чистый контракт:

- `ControlSurfaceDefinition`;
- data source / entity / view type enums;
- field, filter, widget, severity rule, drilldown и action binding;
- validation issues;
- default guided presets;
- publish readiness.

Domain не импортирует API, persistence, Hono, Drizzle или access-control.

### Persistence

Persistence хранит tenant-scoped:

- `control_surface_definitions` как текущий draft/published state;
- `control_surface_versions` как immutable published snapshots.

Delete v1 является archive-first. Hard delete не входит.

### API / application

API отвечает за:

- actor/profile resolution;
- permission checks;
- stable error codes;
- transaction boundary для publish/rollback/archive;
- audit events;
- mapping repository records -> API DTO.

Control surface не меняет бизнес-состояние напрямую. Действия в definition только валидируются как binding к разрешенному action key / permission contract; исполнение остается в существующих application command paths.

## Permissions

- `tenant.control_surfaces.read` — читать список/карточку/published definitions.
- `tenant.control_surfaces.manage` — сохранять draft и делать preview.
- `tenant.control_surfaces.publish` — публиковать, rollback и archive.

Action binding дополнительно содержит `requiredPermissions`. UI сможет скрывать/disable действия, но backend остается источником валидности binding.

## API contract

- `GET /api/tenant/current/control-surfaces`
- `GET /api/tenant/current/control-surfaces/:surfaceId`
- `POST /api/tenant/current/control-surfaces`
- `POST /api/tenant/current/control-surfaces/:surfaceId/preview`
- `POST /api/tenant/current/control-surfaces/:surfaceId/publish`
- `POST /api/tenant/current/control-surfaces/:surfaceId/rollback`
- `DELETE /api/tenant/current/control-surfaces/:surfaceId`

Stable errors:

- `control_surface_invalid`;
- `control_surface_not_found`;
- `control_surface_version_not_found`;
- `control_surface_publish_blocked`;
- access-control reason for missing permission.

## Exit gate

Phase 8 backend считается готовым только когда:

- tenant admin может сохранить draft;
- preview возвращает validation issues и publish readiness без мутации business data;
- publish создает immutable version, обновляет published definition и пишет audit;
- rollback публикует новую версию из старого snapshot и пишет audit;
- archive скрывает surface из active use и пишет audit;
- restricted user может читать только при `tenant.control_surfaces.read` и не может manage/publish;
- persistence tests доказывают tenant isolation, versioning и rollback;
- API tests доказывают permissions, audit и stable errors.
