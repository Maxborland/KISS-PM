# Phase 12 Recovery and Backup Policy

## Purpose

P12-003 defines the release-gate recovery policy for the current deterministic KISS PM runtime. It proves that operator recovery commands are permission-checked, audited, tenant-scoped, and read back after execution. It does not execute a real production database backup or restore.

## Current Runtime

The current repository runtime is deterministic and in-memory for test and E2E evidence. The supported recovery smoke is therefore a controlled in-memory scenario:

1. Capture a baseline recovery state.
2. Simulate an unusable corrupted state inside the recovery-smoke runtime only.
3. Restore the baseline state.
4. Write an audit event.
5. Read back the restored state through API.
6. Reset through `/test-fixtures/reset` in test mode and prove the smoke state is cleared.

## API Contract

- `GET /api/ops/recovery-smoke`
  - requires `ops.read`;
  - returns tenant-scoped latest run, status, and policy.
- `POST /api/ops/recovery-smoke/run`
  - requires `ops.execute`;
  - accepts `{ "scenarioKey": "release-readiness-state" }`;
  - returns before/failure/after state and `auditEventId`;
  - writes audit event `ops.recovery_smoke.run`.

## Production Backup Requirements

A real production deployment must provide backup and restore outside this repository:

- scheduled database backups;
- restore procedure with operator owner and RTO/RPO targets;
- secret store backup policy;
- restore audit trail;
- periodic recovery drill evidence.

Until a production database is introduced and credentials are explicitly provided, the repository release gate can only verify deterministic recovery smoke plus this policy.
