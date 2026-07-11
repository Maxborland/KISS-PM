# Lane 6: PROFILE + SETTINGS

Дата: 2026-07-10
Статус: **FAIL — traversal завершён, найдены 2 воспроизводимых product bugs**
Scope: `SHELL-PROFILE` + `SHELL-SETTINGS` для `AADM`, `EADM`, `PLAN`, `RES`, `BADM`.

## Среда и ограничения

- Workspace: `E:\KISS-PM`; web `http://127.0.0.1:3180` -> 200; API `/health` на `4180` -> 200 `{"status":"ok","product":"KISS PM"}`.
- Runner: локальный `.\node_modules\.bin\playwright.cmd`, Chromium Desktop Chrome, 1 worker. `pnpm install` не запускался.
- Live cookie sessions и реальные API. Только 409/503 состояния инжектировались через `page.route`.
- Продуктовый код, seeded passwords/roles и reconciliation matrix не менялись.

## Результат

Финальная команда:

```powershell
$env:E2E_WEB_PORT='3180'
$env:E2E_API_PORT='4180'
.\node_modules\.bin\playwright.cmd test --config playwright.config.ts e2e/full-eval/profile-settings-role.spec.ts --reporter=line --output=.superloopy/evidence/auth-shell-2026-07-10/playwright-output
```

Результат: **9 passed, 2 failed, 28.3s**. Оба failure — намеренно оставленные тесты на найденные баги; harness failures отсутствуют.

Clean-pass без bug assertions: та же команда с `--grep-invert '^BUG:'` -> **9 passed, 22.1s**.

## Role matrix

| Persona | `/profile` и `/settings` | Network/readback | Result |
|---|---|---|---|
| AADM | profile/theme enabled | allowed PATCH 200 | PASS |
| EADM | profile/theme enabled | allowed PATCH 200 | PASS |
| PLAN | все mutation controls disabled + warning | profile 403, theme 403, `/me` unchanged | PASS |
| RES | все mutation controls disabled + warning | profile 403, theme 403, `/me` unchanged | PASS |
| BADM | profile/theme enabled, `tenant-beta` only | beta theme 200, beta `/me` | PASS |

Каждый login дал `POST /api/auth/login` 200. Начальный `/api/auth/me` 401 на public login bootstrap ожидаем; после login session readbacks дали 200.

## Traversal evidence

### AADM `/profile`

- Dirty name/phone/telegram/theme/accent включает save и changed count.
- Accent `#123`: `aria-invalid=true`, виден `Формат: #RRGGBB`, save disabled, PATCH не отправлен.
- Theme применяется до save в `html[data-theme]` и `--accent`.
- Первый intercepted `PATCH /api/profile` -> 409 `request_failed`; UI показывает `Не удалось выполнить запрос`, dirty/save остаются retryable.
- Повтор -> profile 200, theme 200, `/me` 200. Readback: временные name, dark, `#b83280`; reload сохранил их.
- Пустые phone/telegram сохранились как `null`; после reload input пустые.
- `finally`: profile restore 200, theme restore 200, исходный `/me` подтверждён.

### EADM `/settings`

- Dirty phone -> profile 200 -> `/me` marker -> reload marker.
- `finally`: profile/theme restore 200/200, исходный `/me` подтверждён.

### BADM isolation

- UI показывает `tenant-beta` / `beta@kiss-pm.local`; alpha tenant/admin/engineer identity отсутствует.
- Theme PATCH 200; beta `/me` -> `accentColor=#2563eb`; reload сохранил beta value.
- `finally`: profile/theme restore 200/200, beta `/me` вернулся к исходному `#0f766e`.

### 5xx retry

- Четыре одновременно стартовавших browser `/api/auth/me` получили injected 503.
- Видим readable error-state и `Повторить`; после release retry -> 200 и ready profile.

## Баги

### L6-PS-01 — нет cancel action

Failing test: `BUG: dirty profile forms on /profile and /settings provide a cancel action`.

Repro: AADM -> открыть route -> изменить имя без save -> найти `Отменить`; повторить на второй route.

Expected: 1 видимая `Отменить` на каждой dirty-форме, возврат server-backed values без PATCH.

Actual: `{ "/profile": 0, "/settings": 0 }`; доступна только `Сохранить`.

Evidence: [profile](screenshots/bug-cancel-missing-profile.png), [settings](screenshots/bug-cancel-missing-settings.png), `playwright-output/full-eval-profile-settings-04662-ngs-provide-a-cancel-action-chromium/trace.zip`.

### L6-PS-02 — success confirmation теряется

Failing test: `BUG: a successful /settings save keeps visible success confirmation`.

Repro: EADM -> `/settings` -> изменить Telegram -> save -> дождаться profile 200 -> проверить `/me`.

Expected: после успешного PATCH видно `Сохранено` (`count=1`).

Actual: PATCH 200 и `/me` содержат новое значение, но `Сохранено` отсутствует (`count=0`). Наблюдаемый auth refresh размонтирует форму и теряет локальный `saved` state.

Evidence: [screenshot](screenshots/bug-settings-success-feedback-missing.png), `playwright-output/full-eval-profile-settings-c2cff-isible-success-confirmation-chromium/trace.zip`.

## Screenshots

- Allowed: [AADM profile](screenshots/aadm-profile-shape.png), [AADM settings](screenshots/aadm-settings-shape.png), [EADM profile](screenshots/eadm-profile-shape.png), [EADM settings](screenshots/eadm-settings-shape.png).
- Denied: [PLAN profile](screenshots/plan-profile-shape.png), [PLAN settings](screenshots/plan-settings-shape.png), [RES profile](screenshots/res-profile-shape.png), [RES settings](screenshots/res-settings-shape.png).
- Beta: [BADM profile](screenshots/badm-profile-shape.png), [BADM settings](screenshots/badm-settings-shape.png), [isolation reload](screenshots/badm-settings-beta-isolation-reload.png).
- State/readback: [nullable reload](screenshots/aadm-profile-nullable-reload.png), [settings reload](screenshots/eadm-settings-saved-reload.png), [503 retry](screenshots/aadm-profile-503-retry.png).

## Cleanup

- AADM final `/me`: исходные `Анна Администратор`, null contacts, light, `#0f766e`.
- EADM final `/me`: исходные `Игорь Инженер`, null contacts, light, `#0f766e`.
- BADM final `/me`: исходные `Борис Администратор`, null contacts, light, `#0f766e`.
- PLAN/RES attempts вернули 403/403 и unchanged `/me`; restore не требовался.
- Passwords, roles и access-profile assignments не менялись.

## Change index

- Added `e2e/full-eval/profile-settings-role.spec.ts`: 11 browser tests + network/readback/reload/restore helpers.
- Added этот report и lane screenshots. Product symbols: +0 / ~0 / -0.
- CodeGraph before: owned spec отсутствовал, 0 nodes / 0 edges.
- CodeGraph after final sync: owned spec = **19 symbols**; focused explore exposed **9 resolved edges**: 3 calls (`login -> readMe`, `restoreProfile -> readMe`, `restoreProfile -> evidence`) + 6 type references.
- Final `codegraph sync`: `Already up to date` — watcher уже проиндексировал spec.

## Verdict

Traversal по пяти ролям завершён. RBAC, invalid input, 409/5xx retry, nullable persistence, theme/accent application, reload и beta isolation проходят. Lane остаётся **FAIL** только из-за L6-PS-01 и L6-PS-02; оба закреплены failing tests.