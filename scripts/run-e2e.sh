#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm}"

echo "Starting Postgres..."
pnpm db:up
sleep 3

echo "Migrating and seeding..."
pnpm db:migrate
pnpm db:seed:dev

echo "Running Playwright smoke..."
pnpm test:e2e:smoke

echo "E2E smoke passed."
