# Auth Reset Browser/Mail Gap — 2026-07-07

Status: DONE - integrated by orchestrator

## Scope

Risk: `RISK-AUTH-EMAIL-RESET-HAPPY-PATH`.

Goal: verify the password-reset happy path beyond route-level tests: browser traversal through login/reset UI plus real or explicit mail-provider delivery/extraction path.

Non-goals honored: no commits, no reconciliation matrix update, no CRM/media/comms/agent-SSE changes.

## CodeGraph Entry

- `codegraph_status`: index healthy, 2163 files, 23850 nodes, 51890 edges.
- `codegraph_context`: located reset provider/UI area:
  - `apps/api/src/emailProvider.ts`
  - `apps/api/src/authRegistrationRoutes.ts`
  - `apps/web/src/app/(auth)/password-reset/page.tsx`
  - `apps/web/src/app/(auth)/password-reset/confirm/page.tsx`
  - `apps/web/src/auth/password-reset/reset-request-surface.tsx`
  - `apps/web/src/auth/password-reset/reset-confirm-surface.tsx`
- `codegraph_files`: found existing reset stories, UI pages, old full-eval scripts, and e2e directories.

## Evidence

### Route/provider tests

Command:

```powershell
node_modules\.bin\vitest.cmd run apps/api/src/authRegistrationRoutes.test.ts -t "password-reset"
```

Result: passed.

- 1 file passed.
- 12 tests passed, 5 skipped.
- Existing warning only: duplicate `assignment.delete` case in `packages/domain/src/planning/commandReducer.ts`; unrelated to auth reset.

Covered by existing tests:

- `delivery:"email"` with injected SMTP-like provider.
- `resetUrl` path is `/password-reset/confirm?token=...`.
- in-memory provider returns `delivery:"none"`.
- raw token from in-memory provider can complete request -> confirm -> login in route-level harness.
- concurrent same-token confirm accepts exactly one request and returns `reset_token_used` for the other.

### Browser traversal

Added targeted e2e:

```text
e2e/smoke/auth-password-reset-mail-gap.spec.ts
```

Command:

```powershell
$env:E2E_WEB_PORT='3000'
node_modules\.bin\playwright.cmd test --config playwright.config.ts e2e/smoke/auth-password-reset-mail-gap.spec.ts --no-deps
```

Result: passed.

- 1 Chromium test passed.
- Traversed `/login` -> click `Забыли пароль?` -> `/password-reset`.
- Submitted `admin@kiss-pm.local`.
- Observed `POST /api/auth/password-reset/request` response `202 {"status":"ok","delivery":"none"}`.
- Verified UI shows explicit no-mail status: `отправка почты в этой инсталляции не настроена`.
- Verified no `devToken` panel and no 64-hex token leak in DOM.
- Verified `/password-reset/confirm` navigation and `?token=` prefill.
- Verified confirm footer returns to `/password-reset`.

## Bugs/Fixes

No production UI/backend defect was found in the bounded scope.

Added one e2e evidence test for the current explicit no-mail runtime path:

- `e2e/smoke/auth-password-reset-mail-gap.spec.ts`

Not fixed here:

- Full browser confirm with login by new password, because the current e2e/runtime path does not expose a legitimate token extraction channel.

## Runtime Notes

`pnpm ...` commands failed before tests with `ERR_PNPM_IGNORED_BUILDS`; direct local bin commands were used instead.

An isolated Postgres project was briefly started on port `55438` for attempted local e2e setup and then stopped. The successful browser run used the already running full-eval web/API on `3000/4000`, where `/api/auth/password-reset/request` returns `202 delivery:none`.

A separate existing Next dev server on `3101` was not touched. It proxies to an API origin that rejects `Origin: http://127.0.0.1:3101`, causing `same_origin_action_required` behind a web-level `500 internal_error`; this was treated as environment noise, not an auth reset product defect.

## Remaining Live Mail Blocker

Live mail delivery/extraction is still blocked.

Current repo/runtime facts:

- Dev/test default provider is in-memory.
- Docker compose has no MailHog/Mailpit/mailcatcher service.
- `.env.example` documents SMTP env vars but provides no local capture service.
- Runtime stores password reset token hash in DB; raw token is only available inside `EmailProvider.sendPasswordReset`.
- There is no e2e test hook or mailbox API to extract `lastPasswordReset` from the running server.

Needed to close the remaining gap:

- configure real SMTP or local mailcatcher in e2e, or
- add an explicit test-only extraction path guarded by `KISS_PM_E2E_TEST_HOOKS=1`, then run browser request -> extract token -> confirm UI -> login with new password.

## Verdict

DONE_WITH_CONCERNS: browser traversal and explicit no-mail delivery state are verified; route-level happy path/provider contract remains green; full live mail delivery/extraction is still an infrastructure blocker.

## Orchestrator verification after integration

- `cmd /c "node_modules\.bin\vitest.cmd run apps/api/src/authRegistrationRoutes.test.ts -t \"password-reset\""`
  - Result: passed; 1 file passed; 12 tests passed, 5 skipped.
- `cmd /c "set E2E_WEB_PORT=3000&& node_modules\.bin\playwright.cmd test --config playwright.config.ts e2e/smoke/auth-password-reset-mail-gap.spec.ts --no-deps"`
  - Result: passed; 1 Chromium test passed.

Updated final status: browser reset request/degraded no-mail state/confirm-prefill evidence is complete for this bounded slice. Full live mailbox extraction remains blocked by missing mailcatcher or test-only extraction hook.