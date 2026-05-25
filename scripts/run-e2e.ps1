#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm"
}

Write-Host "Starting Postgres..."
pnpm db:up | Out-Null
Start-Sleep -Seconds 3

Write-Host "Migrating and seeding..."
pnpm db:migrate
pnpm db:seed:dev

Write-Host "Running Playwright smoke..."
pnpm test:e2e:smoke
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  Write-Error "E2E smoke failed with exit code $exitCode"
  exit $exitCode
}

Write-Host "E2E smoke passed."
