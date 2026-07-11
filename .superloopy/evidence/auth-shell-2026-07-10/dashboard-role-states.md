# Lane 4 — SHELL-DASH dashboard role states

Дата: 2026-07-10
Runtime: web `http://127.0.0.1:3180`, API `http://127.0.0.1:4180`
Spec: `e2e/full-eval/dashboard-role-states.spec.ts`

## Вердикт

**PASS — 7/7 browser E2E.** Анонимный guard, пять role-correct состояний, reload/readback, tenant-beta isolation и детерминированный 500 → Retry → recovery подтверждены. Продуктовых багов и блокеров в этой lane не найдено.

Тесты выполняют только вход и GET/readback. Seed/API write-операций нет; product code и reconciliation matrix не изменялись.

## Матрица

| Роль | Сессия | UI-состояние | GET my-work | GET projects | GET opportunities | Readback count tasks/projects/opportunities |
|---|---|---|---:|---:|---:|---|
| ANON | нет | redirect `/login?from=%2Fdashboard`; dashboard sources не запрошены | — | — | — | — |
| AADM | `user-alpha-admin` / `tenant-alpha` | full; 4 KPI, без no-access | 200 | 200 | 200 | 13 / 3 / 6 |
| EADM | `user-alpha-engineer` / `tenant-alpha` | full; 4 KPI, без no-access | 200 | 200 | 200 | 7 / 3 / 6 |
| PLAN | `user-alpha-plan-reader-no-resources` / `tenant-alpha` | partial; tasks/projects доступны, CRM явно «нет доступа» | 200 | 200 | 403 | 1 / 3 / denied |
| RES | `user-alpha-resource-reader` / `tenant-alpha` | forbidden «Дашборд недоступен вашей роли» | 403 | 403 | 403 | denied / denied / denied |
| BADM | `user-beta-admin` / `tenant-beta` | empty; четыре KPI = 0, empty copy для tasks/CRM | 200 | 200 | 200 | 0 / 0 / 0 |

Для каждой авторизованной роли после первого render выполнен реальный `page.reload()`. После reload зафиксирован новый набор dashboard GET-запросов, сохранено то же role-correct UI-состояние и повторён прямой readback с теми же status/count.

## ANON

- `GET /api/auth/me → 401`.
- Итоговый URL: `/login?from=%2Fdashboard`.
- Ни один dashboard source (`my-work`, `projects`, CRM read-model) до redirect не запрошен.

## Beta isolation

- Readback `/api/auth/me`: `user-beta-admin`, `tenant-beta`.
- `my-work.tasks=[]`, `projects.projects=[]`, `opportunities.opportunities=[]`.
- В session + трёх payload нет строки `alpha`.
- В dashboard DOM нет alpha-имён: Анна Администратор, Игорь Инженер, Никита Без Ресурсов, Роман Ресурсный.
- UI показывает именно beta empty counts `0 / 0 / 0`, а не alpha counts `13 / 3 / 6`.

## Fault injection

Детерминированно перехвачен только `GET /api/workspace/my-work` в RES-сессии:

1. Первый перехваченный запрос возвращён тестом как `500 {"error":"load_failed"}`.
2. Остальные dashboard sources сохранили реальный `403`.
3. UI показал `Не удалось собрать сводку`, описание `Не удалось загрузить данные` и кнопку `Повторить`.
4. Клик `Повторить` создал новый запрос к тому же source; счётчик interception: `1 → 2`.
5. Второй запрос пропущен в API и получил реальный `403`.
6. UI восстановился в корректный для RES forbidden: `Дашборд недоступен вашей роли`.

## Скриншоты

- [ANON redirect](dashboard-role-states/screenshots/anon-redirect.png)
- [AADM full after reload](dashboard-role-states/screenshots/aadm-full-reload.png)
- [EADM full after reload](dashboard-role-states/screenshots/eadm-full-reload.png)
- [PLAN partial after reload](dashboard-role-states/screenshots/plan-partial-reload.png)
- [RES forbidden after reload](dashboard-role-states/screenshots/res-forbidden-reload.png)
- [BADM empty after reload](dashboard-role-states/screenshots/badm-empty-reload.png)
- [RES injected 500 error](dashboard-role-states/screenshots/res-source-500-error.png)
- [RES recovery after Retry](dashboard-role-states/screenshots/res-source-500-recovered.png)

## Проверка

```powershell
$env:E2E_WEB_PORT='3180'
$env:E2E_API_PORT='4180'
.\node_modules\.bin\playwright.cmd test e2e/full-eval/dashboard-role-states.spec.ts --config=playwright.config.ts --reporter=line
```

Результат: два последовательных свежих прогона без retry — `7 passed (10.6s)`, затем `7 passed (14.1s)`.

## CodeGraph

- До работы: `codegraph sync` — index already up to date; 2,170 files / 23,996 nodes / 51,809 edges.
- Structural entry: `DashboardSurface → useMyWork + useProjects + useCrm`; dashboard source behavior и role-state rendering сопоставлены с live network/readback.
- После работы: обязательный `codegraph sync` выполнен; 2,176 files / 24,129 nodes / 52,158 edges.
- Change index этой lane: добавлен `e2e/full-eval/dashboard-role-states.spec.ts` (CodeGraph: 24 symbols; основные новые types `RoleKey`, `DashboardState`, `RoleCase`, `ApiEvent`, `Readback`; helpers `recordApiEvents`, `dashboardEvents`, `loginThroughUi`, `expectDashboardState`, `readDashboardSources`, `readJson`, `responseBody`, `expectReadbackStatuses`, `expectBetaIsolation`, `arrayLength`, `summarizeReadback`, `screenshot`). Изменённых/удалённых code symbols в этой lane нет.
- Evidence report и 8 PNG добавлены как не-graph artifacts. Глобальный delta `+6 files / +133 nodes / +349 edges` включает параллельные изменения других lanes; точный вклад этой lane в CodeGraph — один spec и его 24 symbols, per-file edge delta MCP не публикует.
