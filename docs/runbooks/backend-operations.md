# Backend operations runbook

## Назначение

Этот runbook описывает минимальный production-like контур эксплуатации backend KISS PM для self-hosted/operator сценария. Он не заменяет инфраструктурную документацию конкретного tenant, но фиксирует обязательные проверки Phase 10.

## Обязательные env variables

| Env | Назначение | Required |
|-----|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string для persistent runtime | yes for production |
| `PORT` | API port, default `4000` | no |
| `HOST` | API host, default `127.0.0.1` | no |
| `KISS_PM_STORAGE_PROVIDER` | `local` или `s3`; default local | no |
| `KISS_PM_STORAGE_LOCAL_ROOT` | root для local filesystem storage | yes when local production storage is used |
| `KISS_PM_STORAGE_S3_ENDPOINT` | S3-compatible endpoint | yes when provider is `s3` |
| `KISS_PM_STORAGE_S3_BUCKET` | S3 bucket | yes when provider is `s3` |
| `KISS_PM_STORAGE_S3_ACCESS_KEY_ID` | S3 access key | yes when provider is `s3` |
| `KISS_PM_STORAGE_S3_SECRET_ACCESS_KEY` | S3 secret key | yes when provider is `s3` |
| `KISS_PM_STORAGE_S3_REGION` | S3 region, default `us-east-1` | no |
| `KISS_PM_ENABLE_DEV_ROUTES` | dev-only tenant routes | must be `false`/unset in production |
| `PLANNING_EVENTS_BACKEND` | planning realtime event backend: `memory` or `redis`, default `memory` | no |
| `PLANNING_EVENTS_REDIS_URL` / `REDIS_URL` | Redis URL for planning realtime events | yes when `PLANNING_EVENTS_BACKEND=redis` |
| `KISS_PM_VIDEO_PROVIDER` | video join provider: `manual`, `jitsi`, `livekit`; unset means disabled | no |
| `KISS_PM_VIDEO_MANUAL_BASE_URL` | external meeting base URL for manual provider | yes when `KISS_PM_VIDEO_PROVIDER=manual` |
| `KISS_PM_VIDEO_JITSI_BASE_URL` | Jitsi meeting base URL | yes when `KISS_PM_VIDEO_PROVIDER=jitsi` |
| `KISS_PM_VIDEO_LIVEKIT_URL` | LiveKit server URL used by clients | yes when `KISS_PM_VIDEO_PROVIDER=livekit` |
| `KISS_PM_VIDEO_LIVEKIT_API_KEY` | LiveKit API key for join token signing | yes when `KISS_PM_VIDEO_PROVIDER=livekit` |
| `KISS_PM_VIDEO_LIVEKIT_API_SECRET` | LiveKit API secret for join token signing | yes when `KISS_PM_VIDEO_PROVIDER=livekit` |
| `KISS_PM_VIDEO_TOKEN_TTL_SECONDS` | LiveKit join token TTL, 60..3600 seconds, default 600 | no |

Secrets must not be logged, stored in audit metadata, or exposed through health/readiness responses.

## Start checklist

1. Apply migrations against the target database.
2. Verify `DATABASE_URL` points to the intended tenant environment.
3. Verify storage provider env:
   - local: root directory exists or can be created by the API user;
   - s3: endpoint, bucket and credentials are valid.
4. If `PLANNING_EVENTS_BACKEND=redis`, verify Redis connectivity and credentials before routing traffic.
5. If video is enabled, verify provider env is exact and credentials are stored only in runtime secret storage. Unknown provider values and malformed LiveKit token TTL must fail startup.
6. Start API.
7. Check liveness:

```bash
curl http://127.0.0.1:4000/health/live
```

Expected response:

```json
{ "status": "live", "product": "KISS PM" }
```

8. Check readiness:

```bash
curl http://127.0.0.1:4000/health/ready
```

Expected success:

```json
{
  "status": "ready",
  "product": "KISS PM",
  "checks": {
    "database": { "status": "ok" },
    "storage": { "status": "ok", "provider": "local" }
  }
}
```

If readiness returns `503`, do not send user traffic to the instance.

When Redis planning events are enabled, readiness includes a `realtime` check. A disconnected Redis backend must keep the instance out of rotation until Redis is reachable or the deployment is intentionally switched back to `PLANNING_EVENTS_BACKEND=memory`.

## Update checklist

1. Put the service into maintenance/drain mode at the reverse proxy or orchestrator layer.
2. Take a database backup before migrations.
3. Apply migrations.
4. Start the new API version.
5. Verify `/health/live` and `/health/ready`.
6. Run backend release smoke for the target environment.
7. Re-enable traffic.

## Migration policy

- Migrations are forward-only by default.
- Any non-reversible migration must state the rollback strategy in the PR or release notes.
- Rollback after a destructive migration means restoring the pre-migration backup.
- Migration verification must be run on clean DB and seeded/dev-like DB before Phase 10 exit.

## Backup and restore

Required backups:

- PostgreSQL database dump with timestamp and app version.
- Local storage root snapshot or S3 bucket backup/versioning policy.
- Env/config snapshot without exposing secret values in tickets or audit.

### Scripts

Ручной путь для дампа/восстановления БД:

- [`scripts/backup.sh`](../../scripts/backup.sh) — `pg_dump` из `DATABASE_URL` в
  gzip-файл `kiss-pm-<UTC-timestamp>.sql.gz` в каталоге `BACKUP_DIR`
  (по умолчанию `./backups`). Печатает абсолютный путь дампа в stdout, падает при
  отсутствии `DATABASE_URL`.
- [`scripts/restore.sh`](../../scripts/restore.sh) — восстановление из указанного
  `.sql.gz` в `DATABASE_URL`. Деструктивно: требует интерактивного `yes` или флага
  `--force` (для автоматизации/CI).

Оба скрипта — POSIX `sh`, требуют установленного `postgresql-client`
(`pg_dump`/`psql`). Пример регулярного бэкапа через cron (ежедневно 03:15 UTC):

```cron
15 3 * * * DATABASE_URL='postgres://...' BACKUP_DIR='/var/backups/kiss-pm' \
  /opt/kiss-pm/scripts/backup.sh >> /var/log/kiss-pm-backup.log 2>&1
```

`restore.sh` в cron не ставится — восстановление запускается только осознанно
оператором.

Пример ручного вызова:

```bash
DATABASE_URL='postgres://...' ./scripts/backup.sh
DATABASE_URL='postgres://...' ./scripts/restore.sh ./backups/kiss-pm-20260720T031500Z.sql.gz
```

### Restore procedure

1. Stop API traffic.
2. Restore PostgreSQL backup.
3. Restore matching storage snapshot/version.
4. Start API.
5. Verify readiness.
6. Run smoke checks for auth, project/task/planning, attachments/search and audit.

Database and storage backups must be point-in-time compatible. Restoring only one side can leave dangling file assets or missing objects.

### Restore drill

Регулярно проверяйте, что дамп реально восстановим (backup без проверенного
restore — это не бэкап):

1. Поднимите пустую одноразовую БД (отдельный контейнер/схема), НЕ production.
2. Экспортируйте `DATABASE_URL` этой пустой БД.
3. Прогоните restore из свежего дампа:

   ```bash
   DATABASE_URL='postgres://kiss_pm:...@127.0.0.1:5432/kiss_pm_drill' \
     ./scripts/restore.sh --force ./backups/kiss-pm-<timestamp>.sql.gz
   ```

4. Проверьте целостность: количество строк в ключевых таблицах (`kiss_pm_migrations`,
   пользователи/проекты/задачи) сходится с ожидаемым, `SELECT` по нескольким
   сущностям возвращает данные.
5. Запустите API против восстановленной БД и проверьте `/health/ready`.
6. Уроните drill-БД после проверки.

Куда класть evidence: результаты drill (дата, имя дампа, размер, вывод restore,
проверенные счётчики строк, статус `/health/ready`) фиксируйте в
`.superloopy/evidence/` под каталогом соответствующей волны эксплуатации; secret
values и connection string с паролем в evidence не попадают.

## Storage cleanup policy

Delete v1 is archive-first. Physical object deletion is not part of user-facing delete.

Cleanup job requirements before enabling hard delete:

- only delete archived assets older than accepted retention;
- never delete `pending` assets that may still be inside an active upload transaction window;
- write operational logs without storage keys, local paths or credentials;
- verify no active `EntityAttachment` references the asset.

## Incident checklist

For security/privacy incidents:

1. Disable affected route or drain traffic if leakage is active.
2. Preserve audit logs and request correlation evidence.
3. Check whether tenant isolation, hidden contribution masking, search metadata filtering or storage download authorization failed.
4. Rotate exposed credentials if any secret/path/provider internals were leaked.
5. Add a regression test before reopening traffic.

For readiness failures:

1. Inspect readiness body for failing check name only.
2. Check API logs for internal error details.
3. For `database_unavailable`: verify network, credentials, migration state and connection pool.
4. For `storage_unavailable`: verify local permissions or S3 endpoint/bucket/credentials.
5. Re-run `/health/ready` after remediation.

For data consistency incidents:

1. Freeze related management actions if they can worsen inconsistency.
2. Identify affected tenant/project/task/resource range.
3. Compare audit trail with current read model.
4. Repair through governed application commands where possible.
5. Use direct DB repair only with explicit operator approval and post-repair audit note.
