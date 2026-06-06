# 44. Phase 12: Calendar & Occupancy V2 backend

## Статус

Phase 12 усиливает уже реализованные planning, capacity, absences и communications
слои. Это backend-only срез: frontend-календари, Google/Microsoft/CalDAV sync
jobs, мобильные push-уведомления и визуальная календарная сетка не входят.

## Product intent

KISS PM должен планировать проектную работу не только по дневной емкости, но и по
реальной занятости сотрудника: рабочий календарь, отсутствия, личные busy-слоты,
встречи, звонки, назначения задач и резервы должны сходиться в один источник
truth для планирования и управленческих решений.

Пользовательская ценность:

- PM и resource manager видят, почему сотрудник недоступен в конкретное время.
- Auto-solver не предлагает назначения поверх встреч, звонков или личных busy-слотов,
  если есть no-overlap вариант.
- Встречи и звонки занимают capacity так же явно, как проектная работа.
- Личные календари можно подключить позже через Google/Microsoft/CalDAV adapters без
  переписывания planning API.

## Scope

### Unified Occupancy

Новый backend слой `Occupancy` является единым read model/source для занятости:

- planning assignments and explicit assignment allocations;
- resource reservations;
- absences;
- personal calendar busy events;
- meetings where user is participant and meeting is not cancelled;
- active/scheduled call sessions where user is participant or room is tied to a meeting.

Каждый occupancy item хранит minute-accurate interval:

- `tenantId`;
- `resourceId`;
- `sourceType`;
- `sourceId`;
- `startsAt`, `finishesAt`;
- `workMinutes`;
- `capacityImpact`: `busy | unavailable | tentative`;
- `visibility`: `public | busy_only | private`;
- safe display metadata.

Дневные, недельные и месячные capacity views остаются API aggregation формой, но
агрегируются из minute intervals. Новый источник не должен возвращать скрытые
project/task/meeting titles пользователю без соответствующих прав.

### Personal Calendars

Добавить tenant-scoped personal calendar contract:

- `resource_personal_calendars`;
- `resource_calendar_events`;
- один default personal calendar на сотрудника создается lazy/command path;
- manual busy events доступны в v1;
- `sourceProvider`: `manual | google | microsoft | caldav`;
- external sync fields сохраняют boundary, но sync jobs/adapters остаются future scope.

Правила:

- manual event может быть создан/обновлен самим пользователем или manager/admin с
  правом управления ресурсами;
- private/busy-only события в read models маскируются;
- URL/fetch к внешним календарям в v1 не выполняется.

### Meetings And Calls As Occupation

Meetings:

- `MeetingParticipant` создает busy occupancy на `scheduledStart..scheduledFinish`;
- `status=cancelled` не занимает capacity;
- declined participant не занимает capacity;
- completed meeting остается фактом занятости.

Calls:

- active call session занимает interval `startedAt..now` для joined/joining participants;
- ended session занимает `startedAt..endedAt`;
- если call room связан с meeting, scheduled meeting already covers planned occupation;
  active session adds actual occupation only for participants.

### Minute-slot Capacity

V1 расчет остается deterministic и без timezone magic:

- internally minute intervals use UTC instants;
- capacity windows derive from existing calendar/exception model;
- day/week/month buckets aggregate minute intervals;
- solver free capacity uses minute overlap before falling back to soft overload.

Day buckets остаются public API compatibility, но больше не являются source of truth.

### Calendar Sync Boundary

Google/Microsoft/CalDAV future adapters обязаны писать только через application
commands personal calendar events:

- no direct mutation of tasks/projects/meetings;
- no server-side fetch in this phase;
- external ids are tenant-scoped and safe;
- webhook/secrets/token storage are future secured connector scope.

## Architecture boundaries

```txt
domain/planning/occupancy
  -> pure interval math, masking metadata shape, aggregation helpers

persistence/occupancyRepository
  -> personal calendars/events and cross-source input loaders

api/occupancyRoutes
  -> auth, permissions, stable errors, request validation, audit

planning/resourcePlanning + autoSolver
  -> consume occupancy input, do not load DB
```

Forbidden:

- domain imports API, Drizzle, Hono, access-control or provider SDKs;
- meetings/calls mutate planning assignments directly;
- external calendar adapters bypass application commands;
- hidden metadata leaks through capacity/search/audit.

## API surface

- `GET /api/workspace/resources/:resourceId/personal-calendar`
- `POST /api/workspace/resources/:resourceId/personal-calendar/events`
- `PATCH /api/workspace/resources/:resourceId/personal-calendar/events/:eventId`
- `DELETE /api/workspace/resources/:resourceId/personal-calendar/events/:eventId`
- `GET /api/workspace/occupancy?resourceId=&from=&to=`

Stable errors:

- `occupancy_invalid_query`;
- `occupancy_calendar_not_found`;
- `occupancy_event_not_found`;
- access-control reason from RBAC for denied requests.

## Permissions

- Own calendar read/write: active same-tenant user.
- Resource manager read: `tenant.project_resources.read`.
- Resource manager write: `tenant.project_resources.manage`.
- Meeting/call titles are visible only when actor can read the parent entity.
- Hidden occupation still counts in capacity and overload math.

## Audit

Required actions:

- `occupancy.calendar_created`;
- `occupancy.event_created`;
- `occupancy.event_updated`;
- `occupancy.event_removed`;
- `occupancy.denied`.

Audit safe metadata only: resource id, event id, source provider, visibility, interval,
busy minutes. No external tokens, sync cursors, private titles, URLs or provider secrets.

## Acceptance criteria

1. Personal busy event reduces free capacity and appears in occupancy read model.
2. Meeting participants consume capacity for scheduled meeting interval.
3. Cancelled meetings and declined participants do not consume capacity.
4. Active/ended call participant sessions produce minute-accurate occupation.
5. Planning resource load and tenant capacity aggregate the same occupancy source.
6. Auto-solver prefers no-overlap minute-slot proposals before overload fallback.
7. Private/busy-only calendar events count in totals but mask metadata for other users.
8. Future Google/Microsoft/CalDAV boundary is represented without server-side fetch.
9. All writes are permissioned, audited and tenant-isolated.

## Test plan

- Unit:
  - interval overlap and day aggregation;
  - private/busy-only masking;
  - meeting/call occupation filtering;
  - resource load counts occupancy minutes;
  - auto-solver avoids occupied slots before overload fallback.
- DB/integration:
  - personal calendar/event CRUD and tenant isolation;
  - uniqueness of external ids per calendar/source provider;
  - meetings/calls loader returns minute intervals only for active participants.
- API:
  - own calendar CRUD;
  - manager read/write permissions;
  - denied user gets stable error and denied audit;
  - occupancy endpoint masks hidden metadata.
- Regression:
  - planning read model, capacity tree/drilldown, auto-solver, meetings/calls,
    absences and Phase 10 security gates keep passing.

## Non-scope

- Frontend calendar UI.
- Google/Microsoft/CalDAV OAuth, webhooks or background sync.
- Minute-accurate drag UI.
- Provider-side meeting calendar creation.
- Full calendar sharing workflow.
- BI/export.
