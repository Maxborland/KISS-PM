# Phase 12. Background Jobs Infrastructure

## Статус

Backend foundation. UI для операторского мониторинга, внешний broker, email/push adapters и полнотекстовая поисковая проекция остаются следующими срезами.

## Product Intent

Руководитель проекта, tenant admin и self-hosted оператор не должны вручную запускать технические процедуры: очистку архивных файлов, dispatch уведомлений, sync коннекторов, rebuild поисковых проекций и прогрев capacity cache. Система должна выполнять такие операции надежно, повторяемо, наблюдаемо и без обхода tenant isolation.

## User Story

Как tenant admin или self-hosted оператор, я хочу, чтобы KISS PM безопасно выполнял фоновые и scheduled jobs с retries и понятным следом выполнения, чтобы продуктовые контуры storage, notifications, connectors, search и capacity могли работать без ручных cron-скриптов и без потери диагностики.

## Scope

- DB-backed durable queue `background_job_runs`.
- Persisted schedule registry `background_job_schedules`.
- Observability trail `background_job_events`.
- In-process worker v1, отключаемый env-флагом.
- Deterministic retry policy with bounded attempts.
- Handler registry:
  - `storage.asset_cleanup`;
  - `notification.dispatch`;
  - `connector.sync`;
  - `search.projection_rebuild`;
  - `capacity.cache_warmup`.
- File asset purge marker `file_assets.purged_at`.
- Operator API:
  - `GET /api/workspace/background-jobs/runs`;
  - `GET /api/workspace/background-jobs/runs/:runId/events`;
  - `POST /api/workspace/background-jobs/runs`.
- Permissions:
  - `tenant.background_jobs.read`;
  - `tenant.background_jobs.manage`.

## Non-Scope

- Redis/BullMQ/SQS as required runtime dependency.
- Arbitrary code execution jobs.
- User-authored cron expressions.
- Email/push provider delivery.
- Connector-specific sync implementation.
- Persisted full-text search index.
- UI monitoring console.

## Architecture

Domain owns job kinds, statuses, retry calculation and payload normalization. Persistence owns schedules, runs, events and file purge state. API owns permissioned operator endpoints. Worker owns claim-run-complete/fail orchestration and calls handlers through an explicit registry.

The first release is DB-first because self-hosted deployment must work with PostgreSQL only. A future broker can replace the claim loop behind the same handler and repository boundary.

## Acceptance Criteria

1. Scheduled jobs can be represented as persisted schedule rows and enqueued idempotently by schedule key + due instant.
2. A worker can claim only due queued jobs, run a registered handler, mark success, or record failure and retry/dead state.
3. Failed jobs use deterministic exponential backoff and never retry beyond `maxAttempts`.
4. Archived file cleanup deletes provider objects only for archived assets older than retention and marks `purged_at`.
5. Notification dispatch, connector sync and search projection rebuild exist as safe backend boundaries, not fake direct integrations.
6. Capacity warmup computes and stores the tenant/month aggregation in the existing raw capacity cache.
7. Operator API is tenant-scoped, permission-checked and validates job kind/status/limit.
8. Background job runs and events are stored in tenant-owned tables.
9. Production readiness checks expect the latest background jobs migration.
10. Unit/API/schema/migration tests prove the contract.

## Operational Env

- `KISS_PM_BACKGROUND_JOBS_ENABLED=true` enables the in-process worker in `apps/api`.
- `KISS_PM_BACKGROUND_JOBS_POLL_MS` controls polling, bounded from `1000` to `600000`, default `10000`.

## Future Follow-Up

- Dedicated worker process command.
- Lease timeout and stale-running job recovery.
- Email/push notification adapters.
- Connector-specific sync adapters.
- Persisted search projection once metadata runtime search hits performance pressure.
- Operator UI with filters, retry/cancel and event timeline.
