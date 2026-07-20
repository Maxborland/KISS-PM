#!/bin/sh
# restore.sh — восстановление PostgreSQL БД KISS PM из gzip-дампа backup.sh.
#
# Что делает: распаковывает указанный .sql.gz и прогоняет его через psql в
# $DATABASE_URL. ДЕСТРУКТИВНО: дамп содержит DROP/CREATE и перезаписывает данные
# целевой БД. Поэтому требует подтверждения — либо интерактивного "yes", либо
# флага --force (для автоматизации / restore-drill в CI).
#
# Это РУЧНОЙ путь эксплуатации (см. docs/runbooks/backend-operations.md, раздел
# «Бэкап и восстановление» → restore-drill). НЕ ставьте restore в cron: он
# перезаписывает БД и запускается только осознанно оператором.
#
# Использование:
#   DATABASE_URL='postgres://...' ./scripts/restore.sh [--force] <dump.sql.gz>
#
# Env:
#   DATABASE_URL  (обязателен) — connection string ЦЕЛЕВОЙ БД (будет перезаписана).

set -eu

force=0
dump=""

# Разбор аргументов: --force в любом порядке, один позиционный — путь к дампу.
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    -*)
      echo "restore.sh: unknown flag: $arg" >&2
      exit 2
      ;;
    *)
      if [ -n "$dump" ]; then
        echo "restore.sh: only one dump file may be given" >&2
        exit 2
      fi
      dump="$arg"
      ;;
  esac
done

if [ -z "$dump" ]; then
  echo "usage: DATABASE_URL=... $0 [--force] <dump.sql.gz>" >&2
  exit 2
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "restore.sh: DATABASE_URL is not set; refusing to run" >&2
  exit 1
fi

if [ ! -f "$dump" ]; then
  echo "restore.sh: dump file not found: $dump" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "restore.sh: psql not found in PATH; install postgresql-client" >&2
  exit 1
fi

# Подтверждение деструктивной операции, если не передан --force.
if [ "$force" -ne 1 ]; then
  printf 'restore.sh: this OVERWRITES the target database. Type "yes" to continue: '
  read -r answer
  if [ "$answer" != "yes" ]; then
    echo "restore.sh: aborted" >&2
    exit 1
  fi
fi

# ON_ERROR_STOP=1: падаем на первой ошибке SQL, а не тихо продолжаем с битым
# состоянием. gunzip -c поток в psql, без временного .sql на диске.
gunzip -c "$dump" | psql --set ON_ERROR_STOP=1 "$DATABASE_URL"

echo "restore.sh: restore complete from $dump"
