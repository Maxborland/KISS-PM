# Auth + Shell final closure — 2026-07-10

## Verdict

**PASS WITH ONE LIVE EVIDENCE GAP**: public auth, protected-route guards, dashboard role states, desktop shell/navigation/logout, profile/settings, and My Work role/actions pass. The AUTH-SHELL-07 code fix is green, but a post-fix delivered-message content readback remains `partial_live_rereadback`.

The historical lane reports remain unchanged and intentionally show their original failures. This document records the remediation and fresh final evidence.

## Final coverage

| Lane | Fresh result | Evidence |
|---|---:|---|
| Public auth | 3/3 browser tests passed on SMTP runtime | `playwright-auth-shell-final.json`, `live-reset/readback.json` |
| Route guards | 58 route/role atoms passed | `auth-route-guards.md`, `playwright-auth-shell-final.json` |
| Dashboard states | 7/7 passed | `dashboard-role-states.md`, `playwright-auth-shell-final.json` |
| Shell/nav/logout | 5/5 roles passed | `playwright-shell-final-fixed/.last-run.json`, `playwright-auth-shell-final.json` |
| Profile/settings | 11/11 passed | `playwright-profile-final/.last-run.json`, `playwright-auth-shell-final.json` |
| My Work | 11/11 passed, including PLAN write-flow | `playwright-auth-shell-final.json`; active disposable rows after cleanup: `0` |

Machine-readable coverage: `auth-shell-coverage.json` (`154 pass`, `1 partial_live_rereadback`).
Reproducible result receipt with current-file SHA-256 hashes: `verification-summary.json`.

## Fixed findings

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| AUTH-SHELL-01 | medium | Profile/settings had no cancel action | Added a real reset action that restores the persisted values. |
| AUTH-SHELL-02 | medium | Successful profile/settings save feedback disappeared during auth refresh | Added quiet auth refresh so the saved form remains mounted and visible. |
| AUTH-SHELL-03 | high | Browser Back after logout restored a cached protected profile | Logout now uses a hard `window.location.replace("/login")`; five roles pass logout/back/relogin. |
| AUTH-SHELL-04 | medium | My Work rendered raw project IDs | Project IDs resolve through the project read model. |
| AUTH-SHELL-05 | medium | PLAN saw a synthetic `Участник rces` label for itself | Current session identity is the fallback when the user directory is forbidden. |
| AUTH-SHELL-06 | medium | My Work had no task search | Added one filter shared by Kanban and List, including honest empty results. |
| AUTH-SHELL-07 | high | SMTP reset link used the internal API origin | Reset URL now uses the normalized, validated browser Origin; API regression passes with distinct app/API origins. A second delivered-message content readback is still pending. |

## Live reset traversal

The orchestrator created an isolated account, requested reset through `/password-reset`, found one fresh Gmail message, extracted a redacted 64-character token, confirmed it through the browser UI, proved the old password was rejected, proved the new password survived reload, logged out, and proved token reuse was rejected. This traversal discovered AUTH-SHELL-07 before the final fix.

Post-fix proof is split but fresh: the API regression proves the provider payload uses the normalized browser app origin; the in-app browser proves the confirm route loads; the SMTP-enabled combined suite proves `delivery=email`. This is not presented as a live provider-content pass. A second Gmail content readback was not claimed because Windows Computer Use stopped when it could not establish the active Chrome URL.

## Commands

```powershell
.\node_modules\.bin\vitest.cmd run apps/api/src/authRegistrationRoutes.test.ts
# 17 passed

$env:E2E_API_PORT='4190'; $env:E2E_WEB_PORT='3180'
.\node_modules\.bin\playwright.cmd test e2e/full-eval/auth-public.spec.ts e2e/full-eval/auth-route-guards.spec.ts e2e/full-eval/dashboard-role-states.spec.ts e2e/full-eval/shell-role-nav.spec.ts e2e/full-eval/profile-settings-role.spec.ts e2e/full-eval/mywork-role-actions.spec.ts --workers=1
# 38 passed

.\node_modules\.bin\playwright.cmd test e2e/full-eval/mywork-role-actions.spec.ts --workers=1
# 11 passed after deterministic PLAN fixture and hydration hardening

.\node_modules\.bin\tsc.cmd -p apps/api/tsconfig.json --pretty false
.\node_modules\.bin\tsc.cmd -p apps/web/tsconfig.json --pretty false
# both passed
```

Full machine-readable reporters are stored as `vitest-auth-reset-final.json` and `playwright-auth-shell-final.json`.

## Residual scope

The Auth + Shell product fixes are implemented, with AUTH-SHELL-07 still awaiting one post-fix Gmail content readback before full evidence closure. The global matrix also retains the Jitsi/physical-camera external-provider limitation and role-route-action coverage for the remaining large domains. After the mailbox rereadback, the next fix/evaluation batch should take Projects end to end.
