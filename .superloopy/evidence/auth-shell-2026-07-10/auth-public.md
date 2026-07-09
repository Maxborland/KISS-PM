# Lane 1 AUTH PUBLIC — 2026-07-10

## Verdict

**BLOCKED**: `AUTH-LOGIN` and `AUTH-REGISTER` pass. The accessible part of `AUTH-RESET` passes, but valid reset confirm, login with the new password, reload/logout after reset, and token reuse are blocked because the supplied API runtime returns `delivery:"none"` and exposes neither SMTP delivery nor a reset-token extraction hook.

Final run: **2 passed, 1 failed (intentional blocker assertion), 8.3s**.

## Runtime and command

- Web: `http://127.0.0.1:3180`
- API: `http://127.0.0.1:4180` (`GET /health` -> `200 {"status":"ok","product":"KISS PM"}`)
- Browser: local `./node_modules/.bin/playwright.cmd`, Chromium, one worker
- Unique user created by the final run: `auth-public-mrdyakox-29908@example.test`
- Seeded credentials were used only for login verification and were not changed.
- No product code, reconciliation matrix, dependencies, or runtime process was changed.

```powershell
$env:E2E_WEB_PORT='3180'
$env:E2E_API_PORT='4180'
.\node_modules\.bin\playwright.cmd test --config playwright.config.ts e2e/full-eval/auth-public.spec.ts --project=chromium --workers=1 --no-deps --trace=off --output=.superloopy/evidence/auth-shell-2026-07-10/screenshots/auth-public/playwright-output
```

## Atom results

| Atom | Status | Browser/network/readback evidence |
|---|---|---|
| AUTH-LOGIN invalid email | PASS | `type=email` validity is false and submit remains disabled for `not-an-email`. |
| AUTH-LOGIN invalid password | PASS | Enter submits `POST /api/auth/login` -> `401 {error:"invalid_credentials"}`; UI alert: `Неверный email или пароль`. |
| AUTH-LOGIN password reveal | PASS | Toggle changes password input `password -> text -> password` with matching accessible button labels. |
| AUTH-LOGIN success | PASS | Enter submits seeded login -> `200`; browser reaches `/dashboard`; `GET /api/auth/me` readback is `200` with the same user. |
| AUTH-LOGIN refresh | PASS | Full `page.reload()` remains on `/dashboard`; post-reload `/api/auth/me` body exactly equals pre-reload readback. |
| AUTH-LOGIN logout | PASS | User-menu logout -> `POST /api/auth/logout` `200 {status:"ok"}`; browser returns to `/login`; `/api/auth/me` -> `401 {error:"session_required"}`. |
| AUTH-REGISTER invalid email | PASS | Enter submits `POST /api/auth/register` -> `400 {error:"invalid_registration_payload"}`; matching UI alert. |
| AUTH-REGISTER weak password | PASS | Enter submits -> `400 {error:"weak_password"}`; matching UI alert. |
| AUTH-REGISTER password reveal | PASS | Toggle changes the registration password input `password -> text -> password`. |
| AUTH-REGISTER unique success | PASS | `POST /api/auth/register` -> `201`; response name/workspace checked; auto-login `/api/auth/me` -> `200`; dashboard survives reload with identical readback. |
| AUTH-REGISTER logout | PASS | Logout returns `200` and browser returns to `/login`. |
| AUTH-REGISTER duplicate | PASS | Re-registering the exact created email -> `409 {error:"email_taken"}`; matching UI alert; session remains anonymous (`/api/auth/me` -> `401`). |
| AUTH-RESET invalid email | PASS | Enter submits `POST /api/auth/password-reset/request` -> `400 {error:"invalid_email"}`; matching UI alert. |
| AUTH-RESET request for created user | PASS_WITH_BLOCKER | Exact final-run user submitted through UI -> `202 {status:"ok",delivery:"none"}`; UI truthfully states SMTP is not configured. |
| AUTH-RESET confirm route/prefill | PASS | Browser opens `/password-reset/confirm?token=<64 hex>` and reads the token back from the form. |
| AUTH-RESET password reveal | PASS | New-password input changes `password -> text`. |
| AUTH-RESET invalid token | PASS | Enter submits `POST /api/auth/password-reset/confirm` -> `400 {error:"invalid_reset_token"}`; matching UI alert. |
| AUTH-RESET valid confirm | BLOCKER | No raw token can be obtained from the running API because delivery is `none`; only the token hash is persisted. |
| AUTH-RESET login/new password + refresh/logout | BLOCKER | Depends on valid confirm, which is inaccessible in this runtime. |
| AUTH-RESET token reuse | BLOCKER | Depends on consuming a valid raw token first; no valid raw token is exposed. |

## Reproducible blocker

The E2E deliberately remains red at the delivery gate after all technically accessible reset checks complete.

- **Expected:** `delivery:"email"` plus a retrievable SMTP message containing the created user's raw reset token, allowing UI confirm -> login with new password -> reload -> logout -> reused-token check.
- **Actual:** `delivery:"none"`; the UI says mail delivery is not configured; the running API has no auth reset-token test hook; persisted reset data contains a hash, not the raw token.
- **Assertion:** `expect(resetRequestBody.delivery).toBe("email")`
- **Failure:** `Expected: "email"; Received: "none"` at `e2e/full-eval/auth-public.spec.ts:244`.

No product fallback, seeded-password mutation, direct DB credential edit, or fabricated token was used to hide this gap.

## Fresh evidence

Screenshots are isolated under `screenshots/auth-public/`:

- `auth-login-invalid-credentials.png`
- `auth-login-success-after-reload.png`
- `auth-login-logout-readback.png`
- `auth-register-invalid-and-weak.png`
- `auth-register-success-after-reload.png`
- `auth-register-duplicate.png`
- `auth-reset-invalid-email.png`
- `auth-reset-request-delivery-none.png`
- `auth-reset-invalid-token.png`

Playwright failure context is under `screenshots/auth-public/playwright-output/`.

## Change index

- Added `e2e/full-eval/auth-public.spec.ts`: one serial Chromium lane with three tests and local screenshot/readback helpers.
- Added this report and the isolated `screenshots/auth-public/` evidence.
- Product symbols changed: none.
- Reconciliation matrix changed: no.
- CodeGraph sync completed after the final edit. Owned file graph: `0 -> 11` nodes (`1 file`, `3 imports`, `3 constants`, `4 functions`) and `0 -> 14` touching edges (`10 contains`, `3 imports`, `1 calls`).
- Global graph moved from `2170 files / 23996 nodes / 51809 edges` to `2176 / 24130 / 52160`; the global delta includes concurrent lanes, so the owned-file counts above are the authoritative change index for this lane.
