# Lane 5: SHELL-MYWORK role actions

Date: 2026-07-10

## Scope

- Runtime: web `http://127.0.0.1:3180`, API `http://127.0.0.1:4180`.
- Roles: AADM, EADM, PLAN, RES, BADM.
- Test: `e2e/full-eval/mywork-role-actions.spec.ts`.
- No product code or reconciliation matrix was changed.

## Final result

Command:

```powershell
$env:E2E_WEB_PORT='3180'; $env:E2E_API_PORT='4180'; .\node_modules\.bin\playwright.cmd test mywork-role-actions --project=chromium --trace=off --reporter=line --output=.superloopy\evidence\auth-shell-2026-07-10\playwright-output
```

Result: **7 passed, 4 failed** in 66.5 seconds. The four retained failures are reproducible product failures, not environment or selector failures.

## Confirmed failures

### 1. Project labels render raw ids

- AADM expected `Портал подрядчиков Вектор` from `GET /api/workspace/projects` for `project-vektor-portal`.
- AADM actual table value: `project-vektor-portal`.
- EADM expected `Портал подрядчиков Вектор`.
- EADM actual table value: `project-vektor-portal`.
- The same raw id is visible for PLAN in `plan-mywork-list.png`.
- Failing assertions: `AADM/EADM: rows resolve user names and project labels`.

### 2. PLAN cannot resolve its own display name

- Role/user: PLAN / `user-alpha-plan-reader-no-resources`.
- Expected: `Никита Без Ресурсов` (current authenticated user's name).
- Actual: `Участник rces`.
- Failing assertion: `PLAN: rows resolve user names and project labels`.

### 3. My Work has no task filter

- Seeded AADM result contains 13 tasks across three projects.
- Expected: visible task filter `Поиск задачи...`; filtering should persist across Kanban/List.
- Actual: no task filter exists. Kanban/List switching itself works.
- Failing assertion: `AADM: Kanban/List tabs and task filter preserve the same data`.


## Role/action evidence

| Role | My Work read/UI | Status action | Denial/isolation |
|---|---|---|---|
| AADM | `GET /api/workspace/my-work` 200; rows and owner names rendered | UI PATCH 200; unique `lane5-aadm-*` request marker asserted; API readback, reload, and finally restore all passed | deterministic GET sequence `[503, 200]` passed |
| EADM | GET 200; rows and owner names rendered | UI PATCH 200; unique `lane5-eadm-*` marker asserted; API readback, reload, and finally restore all passed | n/a |
| PLAN | GET 200; one participant task rendered | Seed task is `new`, so no reversible `waiting <-> in_progress` mutation was available; irreversible mutation was intentionally not left behind | Another user's task has no UI affordance; direct PATCH 403 `task_participant_role_required`; admin readback unchanged |
| RES | GET 403; forbidden surface; zero status selects | none | Direct PATCH 403 `permission_missing`; admin readback unchanged |
| BADM | GET 200 with `tasks: []`; `Задач пока нет` visible | none | Alpha task absent; cross-tenant PATCH 404 `project_not_found`; admin readback unchanged |

All performed mutations used a unique marker and restored the original `statusId` in `finally`. The final run re-asserted restored API state.

## Screenshots

- `screenshots/aadm-mywork-list.png`
- `screenshots/eadm-mywork-list.png`
- `screenshots/plan-mywork-list.png`
- `screenshots/aadm-status-reload.png`
- `screenshots/eadm-status-reload.png`
- `screenshots/res-mywork-forbidden.png`
- `screenshots/badm-mywork-empty-isolated.png`
- `screenshots/aadm-mywork-503.png`
- `screenshots/aadm-mywork-retry-200.png`

## Verification notes

- Focused mutation run: 3/3 passed.
- Focused PLAN/RES/BADM denial and isolation run: 3/3 passed.
- Focused deterministic retry run: 1/1 passed.
- Final complete run: 7 passed, 4 intentionally retained failing regressions.
- No blocker was masked. The open result is the three UI defects above.
