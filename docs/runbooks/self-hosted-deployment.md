# Self-hosted backend deployment contract

## Назначение

Этот документ фиксирует минимальный backend-only контракт для self-hosted установки KISS PM. Он дополняет `backend-operations.md` и нужен, чтобы Phase 10 production readiness проверялась одинаково в Docker, VM или managed container runtime.

## Required services

| Service | Required | Contract |
|---------|----------|----------|
| API | yes | Node runtime запускает `@kiss-pm/api` с production env. |
| PostgreSQL | yes | Единственный persistent source of truth для tenants, projects, planning, KPI, audit, attachments metadata и collaboration records. |
| Object storage | yes | Local filesystem root или S3-compatible bucket. Binary objects must be backed up together with DB metadata. |
| Redis | optional | Required only when `PLANNING_EVENTS_BACKEND=redis`; used for multi-instance planning realtime fan-out. |
| Video provider | optional | `manual`, `jitsi` or `livekit` join provider for communication rooms. LiveKit secrets stay server-side and are never returned through readiness/audit/log metadata. |
| Reverse proxy / TLS | production responsibility | Terminates TLS, applies request size policy and routes only ready instances. |

## Deployment invariants

- Production API must not start without `DATABASE_URL`.
- Production API must not enable `KISS_PM_ENABLE_DEV_ROUTES`.
- Local storage in production must use explicit `KISS_PM_STORAGE_LOCAL_ROOT`.
- S3 storage must not expose credentials in readiness, audit, logs or download responses.
- `PLANNING_EVENTS_BACKEND` must be `memory` or `redis`; Redis mode requires `PLANNING_EVENTS_REDIS_URL` or `REDIS_URL`.
- `KISS_PM_VIDEO_PROVIDER`, when set, must be exactly `manual`, `jitsi` or `livekit`; unknown values must fail startup rather than silently disabling calls.
- LiveKit token TTL must be an exact integer in the range 60..3600 seconds, and API key/secret values must not contain surrounding whitespace.
- `/health/live` only proves process liveness.
- `/health/ready` is the traffic gate and must include configured DB, storage and Redis realtime dependencies.

## Backup contract

Backups must be coordinated:

1. PostgreSQL dump or PITR snapshot with app version and migration tag.
2. Matching local storage snapshot or S3 bucket version/snapshot.
3. Env/config snapshot with secret values redacted.

Restoring DB without matching object storage can produce dangling `FileAsset` rows. Restoring object storage without matching DB can leave inaccessible orphan objects.

## Update contract

1. Drain traffic.
2. Take DB and object storage backup.
3. Apply migrations.
4. Start API.
5. Verify `/health/live`.
6. Verify `/health/ready`.
7. Run backend release smoke.
8. Re-enable traffic.

Migrations are forward-only by default. If rollback is required after a destructive migration, restore the coordinated pre-migration backup.

## Readiness response privacy

Readiness responses may expose check names and safe provider labels only. They must not expose:

- connection strings;
- passwords, tokens or access keys;
- storage keys, local paths or bucket internals;
- hidden project/task metadata;
- raw exception messages.

## Collaboration dependency note

Collaboration & Communications backend uses the same operational contract: DB is the source of truth, attachments use the storage layer, external meeting links are metadata references, video providers issue join contracts only, and realtime delivery is optional Redis-backed infrastructure rather than a business-state source of truth.
