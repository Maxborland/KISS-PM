# Phase 12 Production Deployment Environment

## Purpose

This document is the Phase 12 deployment and environment contract for the current KISS PM release path. It defines the production-like smoke surface used before market-release acceptance. It does not provision a real cloud account and it does not store production credentials in this repository.

## Runtime Targets

- `development`: local developer mode. Missing release variables are warnings.
- `test`: automated test mode. Missing release variables are warnings unless a test explicitly validates production-like smoke.
- `production_like`: deterministic local or CI release smoke. Required release variables must be configured, but external services should be mocked.
- `production`: real deployment target. Required release variables must be configured by the deployment environment or secret manager.

## Required Variables

`.env.example` contains names only. Real values must be supplied by the environment, CI secret store, or a secret manager.

| Variable | Required for `production_like` / `production` | Rule |
|---|---:|---|
| `KISS_PM_RUNTIME_ENV` | yes | `production_like` for release smoke or `production` for real deployment |
| `KISS_PM_PUBLIC_BASE_URL` | yes | `https://...`, `http://localhost...`, or `http://127.0.0.1...` for deterministic local smoke |
| `KISS_PM_API_BASE_URL` | yes | API origin matching the deployed API |
| `KISS_PM_ALLOWED_ORIGINS` | yes | Comma-separated web origins allowed to call the API |
| `KISS_PM_SECRET_REF` | yes | Secret-manager reference such as `secret://...`, `vault://...`, or `env://...`; never a raw secret |
| `KISS_PM_AUDIT_RETENTION_DAYS` | yes | Positive retention period selected by deployment policy |
| `KISS_PM_EXTERNAL_SERVICES_MODE` | yes | `mocked` for deterministic release smoke, `adapter` only for explicitly scoped live-adapter runs |
| `KISS_PM_ALLOW_TEST_FIXTURE_RESET` | no in production | May be `true` only in deterministic test/smoke environments |
| `VITE_KISS_PM_ALLOW_FIXTURE_AUTH` | no in production | Must be disabled for `production_like` and `production` smoke |

## Smoke Endpoint

`GET /health/deployment` returns a safe deployment-smoke DTO:

- `status`: `passed` or `failed`;
- `target`: normalized runtime target;
- `checks`: required env, URL shape, secret-reference shape, and external-service mode.

The endpoint never returns configured values for secrets or secret references. It reports secret state as `configured`, `missing`, or `invalid-secret-reference`.

The endpoint fails `production_like` and `production` smoke when fixture-only switches such as `KISS_PM_ALLOW_TEST_FIXTURE_RESET=true` or `VITE_KISS_PM_ALLOW_FIXTURE_AUTH=true` are enabled.

## Production-Like Smoke

For local deterministic release smoke, start the API with at least:

```bash
KISS_PM_RUNTIME_ENV=production_like
KISS_PM_PUBLIC_BASE_URL=https://kiss-pm.example.test
KISS_PM_API_BASE_URL=https://api.kiss-pm.example.test
KISS_PM_ALLOWED_ORIGINS=https://kiss-pm.example.test
KISS_PM_SECRET_REF=secret://kiss-pm/prod/app
KISS_PM_AUDIT_RETENTION_DAYS=365
KISS_PM_EXTERNAL_SERVICES_MODE=mocked
```

Then call:

```bash
GET /health/deployment
```

The response must be `status: "passed"` before E2E-113 can claim deployment smoke evidence.

## Release-Gate Notes

- P12-001 may be implementation-complete before Phase 12 is accepted.
- P12 acceptance still requires E2E-113 and the final P12 strict matrix gate.
- Real production DNS, cloud infrastructure, and database backup execution remain environment-owned unless credentials and scope are explicitly provided.
