# Reconciliation runbook — 2026-07-07

Цель: свежо проверить только то, что после master merge осталось `unverified` в `reconciliation-matrix-2026-07-07.json`. Старые bug-файлы не считаются current-open без нового evidence.

## Текущее состояние матрицы

- `fixed-by-master`: 61 old bug id.
- `fixed-by-current-branch`: 5 current branch items.
- `confirmed-open`: 0.
- `unverified`: 19 old bug id + 5 risk zones.
- `not-a-bug/superseded`: 4 old bug id.

## Правило изменения статуса

- `unverified` → `fixed-by-master`: свежий browser/API/data check проходит на текущем master/current branch.
- `unverified` → `confirmed-open`: свежий check падает, есть exact steps, expected/actual, screenshot/log/network/API evidence.
- `confirmed-open` → fix batch: только после записи в матрицу.
- Старый скриншот 2026-07-04/05 сам по себе не открывает баг заново.

## Stand record

Перед прогоном заполнить:

| Поле | Значение |
|---|---|
| Git branch | `codex/pre-prod-hardening-on-master` |
| Commit | |
| Web URL | |
| API URL | |
| DB | |
| Env notes | |
| Browser tool | in-app Browser / Playwright |
| Evidence dir | `docs/qa/full-eval/evidence/reconciliation-2026-07-07/` |

## Roles

Проверять минимум:

| Role | Email | Expected shape |
|---|---|---|
| anonymous | no session | protected routes redirect/deny cleanly |
| admin alpha | `admin@kiss-pm.local` | full access |
| engineer alpha | `engineer@kiss-pm.local` | own work/project access, limited admin |
| plan reader alpha | `plan-reader-no-resources@kiss-pm.local` | project plan read, no resource directory/write |
| resource reader alpha | `resource-reader@kiss-pm.local` | resource-facing read paths only |
| admin beta | `beta@kiss-pm.local` | tenant isolation |

## Targeted checks from `unverified`

### Auth/Shell

| Matrix ids | Check | Evidence |
|---|---|---|
| `BUG-008` | `/login`: click `Создать аккаунт` and `Забыли пароль?`; both must be real links to `/register` and `/password-reset`. | screenshot + DOM anchors + URL after click |
| `BUG-AUTH-11` | Logout from `/profile`, then click `Войти снова`; must navigate to `/login`, not reload `/profile`. | network logout + URL |
| `BUG-AUTH-13` | Confirm valid reset token twice; decide whether product still expects `reset_token_used` or accepts `invalid_reset_token`. | API response + UI text |
| `BUG-SHELL-01` | `/` as anonymous and logged-in; 404 `На главную`; must not land on dead design-v3 page. | URL + screenshot |
| `BUG-SHELL-11` | `/profile` as role without profile update permission; form must be disabled/clear forbidden, not editable form that only fails after submit. | screenshot + PATCH status if attempted |
| `BUG-SHELL-14` | Anonymous `/agent`; must redirect/deny before presenting a working-looking chat. | URL + screenshot |

### Projects/Delivery

| Matrix ids | Check | Evidence |
|---|---|---|
| `BUG-PROJ-05` | `/schedule` and `/calendars`: Today/timeline/month origin uses real project/current date, not old mock March/April/June constants. | screenshot + computed labels |
| `BUG-PROJ-09` | All remaining demoAction candidates on `/schedule`, `/baseline`, `/calendars`; existing-route actions must be links/buttons or hidden. | DOM dump buttons/anchors |
| `BUG-PROJ-10` | Project selector changes URL or has explicit non-URL semantics; invalid id shows not-found. | URL before/after + screenshot |
| `BUG-PROJ-13` | Summary rows with children are non-leaf: collapse affordance and no unsafe leaf edits. | read-model parentTaskId + DOM |
| `BUG-PROJ-14` | PR role resource names degrade cleanly without raw user ids when `/users` is forbidden. | screenshot + network 403 |
| `BUG-PROJ-15`, `BUG-PROJ-26` | PR role on overview/commits with audit-events 403 must show no-permission, not `История пуста`. | network 403 + UI |
| `BUG-PROJ-16` | `/projects` filters/search/sort behavior; if not implemented, UI must not imply unavailable controls. | DOM + interaction log |
| `BUG-PROJ-21` | Baseline label entered by user is visible after capture/readback. | API/read-model + screenshot |

### CRM

| Matrix ids | Check | Evidence |
|---|---|---|
| `BUG-CRM-03` | Legacy deal with `pipelineId:null`: stage select must show real stage options/name or explicit non-editable state. | API deal + select options |
| `BUG-CRM-06` | Duplicate contact email policy: create duplicate; expected must be documented as allowed or rejected. | POST status + UI |
| `BUG-CRM-08` | Small money values `<1000` render as real rubles, not `0 тыс ₽`. | seeded/test deal + screenshot |
| `BUG-CRM-09` | No-CRM-right role on `/crm/products`: create button/modal hidden/disabled; no fake usable form. | screenshot + POST if attempted |

### Communications/Agent/Providers

| Matrix ids | Check | Evidence |
|---|---|---|
| `BUG-COMM-01` | Rename channel; sidebar list updates without full reload. | screenshot before/after + network |
| `BUG-COMM-05` | Mark same notification read twice; `readAt` should be idempotent or product must accept update semantics. | two API responses |
| `BUG-SHELL-12`, `G7-01` | Real LLM/SSE if configured; otherwise provider-degraded UI must be unmistakable. | provider status + SSE/browser |
| `BUG-SHELL-13` | Agent history/demo chrome/fake timestamps either real, hidden, or explicitly gated. | screenshot + DOM |
| `RISK-MEDIA-LIVEKIT-JITSI-CALL` | With provider enabled: create/join call, fake media, leave/rejoin, participant state. If disabled: clear degraded state. | config + browser/video logs |
| `RISK-AUTH-EMAIL-RESET-HAPPY-PATH` | Request reset through real mail provider/mailcatcher, follow token, login with new password. | email/log + auth response |

## Duplicate/race/idempotency matrix

For every write-flow touched by the unverified zones, run:

| Check | Required result |
|---|---|
| single submit | success with readback |
| double click | no duplicate mutation or clear conflict |
| two concurrent same API calls | idempotent or deterministic conflict |
| stale version | clear 409/current version where applicable |
| permission-denied role | no data mutation, clear UI |
| refresh after success | persisted state visible |

Minimum write-flows for the next pass:

- password reset request/confirm;
- profile update/logout;
- project baseline capture;
- project selector/settings writes if present;
- CRM contact create;
- CRM deal stage update;
- channel rename;
- notification mark-read;
- agent propose/apply if provider is configured;
- call room create/join if provider is configured.

## Stop point for this runbook

Stop after the matrix has no ambiguous stale rows:

- each `unverified` row has either fresh pass evidence or fresh fail evidence;
- all fresh fails are moved to `confirmed-open`;
- `fix-batches-2026-07-07.md` exists and contains only `confirmed-open` rows;
- no product code fix starts before that file exists.
