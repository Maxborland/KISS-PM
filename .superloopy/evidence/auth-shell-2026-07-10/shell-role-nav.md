# Lane 3 — SHELL-NAV / AUTH-LOGOUT

Дата: 2026-07-10
Runtime: web `http://127.0.0.1:3180`, API `http://127.0.0.1:4180`
Verdict: **FAIL — один воспроизводимый AUTH-LOGOUT defect на всех пяти ролях**

## Scope

- Роли: AADM, EADM, PLAN, RES, BADM; каждый сценарий получил отдельный Playwright context.
- Desktop shell only: permission-aware links/absence, real href clicks, active item, global search, avatar identity, profile/settings menu.
- Logout: `POST /api/auth/logout`, `/api/auth/me` readback, browser Back, reload, relogin.
- Mobile responsive не дублировался. Product code и reconciliation matrix не менялись.

## Final run

```powershell
$env:E2E_WEB_PORT='3180'
$env:E2E_API_PORT='4180'
.\node_modules\.bin\playwright.cmd test "e2e/full-eval/shell-role-nav.spec.ts" --project=chromium --workers=1 --reporter=line --output=.superloopy/evidence/auth-shell-2026-07-10/playwright-output-final-3
```

Результат: `5 failed`, и все пять тестов завершили полный traversal до повторного входа. Единственный финальный failure в каждом тесте — assertion `browser back remains public`.

## Role matrix

| Role | `/me` identity | Visible desktop nav | Search `Вектор` | Profile/settings | Logout/relogin |
|---|---|---|---|---|---|
| AADM | `user-alpha-admin`, Анна Администратор | 6/6 | `200`, 4 results, project click → `/projects/project-vektor-portal` | real href clicks pass | pass except Back defect |
| EADM | `user-alpha-engineer`, Игорь Инженер | 6/6 | `200`, 4 results, project click → `/projects/project-vektor-portal` | real href clicks pass | pass except Back defect |
| PLAN | `user-alpha-plan-reader-no-resources`, Никита Без Ресурсов | Мои задачи, Проекты, Дашборд; other 3 absent | `200`, 1 result, project click → `/projects/project-vektor-portal` | real href clicks pass | pass except Back defect |
| RES | `user-alpha-resource-reader`, Роман Ресурсный | 0 links; all six absent for current permissions | `200`, 0 results, honest empty state | real href clicks pass | pass except Back defect |
| BADM | `user-beta-admin`, Борис Администратор | 6/6 | `200`, 0 results in empty beta tenant | real href clicks pass | pass except Back defect |

For every visible nav item the test verified the literal `href`, clicked the link, read back the resulting URL, checked active styling, and rejected `permission_missing` / `Доступ ограничен`. Avatar initials, menu name and user id matched `/api/auth/me` for every role.

## Defect: Back restores authenticated profile after logout

Reproduces for AADM, EADM, PLAN, RES, BADM.

1. Login and open avatar menu.
2. Click the real `/profile` and `/settings` menu links.
3. Click `Выйти`.
4. Observe `POST /api/auth/logout → 200`, then `GET /api/auth/me → 401`, and public `/login`.
5. Press browser Back.

**Expected:** pathname remains `/login`; no authenticated route is restored.
**Actual:** pathname becomes `/profile` from browser history while explicit `/api/auth/me` readback is still `401`.

This is not a session-revocation failure: reload returns `200` on `/login?from=%2Fprofile`, and relogin returns to `/profile` with `POST /login → 200` and `/me → 200`. The defect is stale private UI/history exposure before reload.

Failing assertion: `e2e/full-eval/shell-role-nav.spec.ts:304`
Traces: `.superloopy/evidence/auth-shell-2026-07-10/playwright-output-final-3/*/trace.zip`

## Network/readback

| Checkpoint | AADM | EADM | PLAN | RES | BADM |
|---|---:|---:|---:|---:|---:|
| initial `POST /api/auth/login` | 200 | 200 | 200 | 200 | 200 |
| initial explicit `GET /api/auth/me` | 200 | 200 | 200 | 200 | 200 |
| `GET /api/workspace/search` | 200 | 200 | 200 | 200 | 200 |
| `POST /api/auth/logout` | 200 | 200 | 200 | 200 | 200 |
| post-logout `GET /api/auth/me` | 401 | 401 | 401 | 401 | 401 |
| Back-path / explicit `/me` | `/profile` / 401 | `/profile` / 401 | `/profile` / 401 | `/profile` / 401 | `/profile` / 401 |
| public reload | 200 | 200 | 200 | 200 | 200 |
| relogin + explicit `/me` | 200 / 200 | 200 / 200 | 200 / 200 | 200 / 200 | 200 / 200 |

## Fresh evidence

Five screenshots per role were captured during the final traversal:

- `screenshots/{aadm,eadm,plan,res,badm}-desktop-nav.png`
- `screenshots/{aadm,eadm,plan,res,badm}-identity-menu.png`
- `screenshots/{aadm,eadm,plan,res,badm}-logged-out-public.png`
- `screenshots/{aadm,eadm,plan,res,badm}-browser-back-after-logout.png`
- `screenshots/{aadm,eadm,plan,res,badm}-relogin-restored.png`

Representative defect evidence: [AADM browser Back after logout](screenshots/aadm-browser-back-after-logout.png), [PLAN browser Back after logout](screenshots/plan-browser-back-after-logout.png), [RES browser Back after logout](screenshots/res-browser-back-after-logout.png).

## Change index

- Added `e2e/full-eval/shell-role-nav.spec.ts`: role cases, auth/readback helpers, evidence capture, and five generated SHELL-NAV/AUTH-LOGOUT tests.
- Added this report and 25 owned screenshots. Playwright failure traces are under `playwright-output-final-3`.
- Product symbols changed: none. Reconciliation matrix changed: no.
- Mandatory final `codegraph sync`: completed, already up to date.
- CodeGraph before → after: files `2,176 → 2,176`, nodes `24,130 → 24,130`, edges `52,160 → 52,160` (delta `0 / 0 / 0`). The graph excludes this new untracked E2E/report, so no symbols or relations were added to the index.
