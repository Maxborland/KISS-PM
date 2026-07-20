#!/bin/sh
# backup.sh — ручной снимок PostgreSQL БД KISS PM.
#
# Что делает: pg_dump из $DATABASE_URL в gzip-файл с timestamp в каталоге
# $BACKUP_DIR (по умолчанию ./backups). Печатает абсолютный путь результата в
# stdout — его можно подхватить в вызывающем скрипте.
#
# Это РУЧНОЙ путь эксплуатации (см. docs/runbooks/backend-operations.md, раздел
# «Бэкап и восстановление»). Для регулярных бэкапов поставьте в cron, например
# ежедневно в 03:15 (оператор задаёт DATABASE_URL/BACKUP_DIR в окружении cron):
#
#   15 3 * * * DATABASE_URL='postgres://...' BACKUP_DIR='/var/backups/kiss-pm' \
#     /opt/kiss-pm/scripts/backup.sh >> /var/log/kiss-pm-backup.log 2>&1
#
# Требуется установленный клиент pg_dump (postgresql-client).
#
# Env:
#   DATABASE_URL  (обязателен) — connection string исходной БД.
#   BACKUP_DIR    (опц., дефолт ./backups) — каталог для дампов.

set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "backup.sh: DATABASE_URL is not set; refusing to run" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "backup.sh: pg_dump not found in PATH; install postgresql-client" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

# UTC timestamp — стабильная сортировка и отсутствие двусмысленности TZ.
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/kiss-pm-$timestamp.sql.gz"

# --no-owner/--no-privileges: дамп переносим между окружениями без привязки к
# конкретным ролям. pg_dump сам читает DATABASE_URL как позиционный dbname URI.
# gzip на лету, без промежуточного .sql на диске.
# --clean --if-exists: дамп сам дропает существующие объекты перед CREATE,
# чтобы restore.sh поверх непустой БД не падал на дубликатах.
pg_dump --no-owner --no-privileges --clean --if-exists "$DATABASE_URL" | gzip -c > "$target"

# Абсолютный путь для оператора/скрипта-обёртки.
case "$target" in
  /*) echo "$target" ;;
  *)  echo "$(pwd)/$target" ;;
esac
