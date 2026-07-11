# Schedule browser closeout spec

Дата: 2026-07-10.

## Verdict

**FAIL / AUTHORED, PRODUCT BLOCKED.** Выделенный browser spec создан и
перечисляется Playwright как `11 tests in 1 file`. Он явно содержит все
`40` target role-строк из `lane-matrix.md` (`32` scenario ID, роли `admin` и
`planReader`) и не допускает итоговый pass, пока любая строка остаётся
`pending`, без timestamp либо без source-bound evidence.

Pass не заявлен: текущий Schedule write path не передаёт `idempotencyKey` для
обычных `apply-command` / `apply-command-batch`, Saved Views не имеют rename
control, а bounded C07 rerun не завершился за 240 секунд.

## Authored scope

- Единственный source-файл: `e2e/full-eval/projects-schedule-closeout.spec.ts`.
- Bundles `C01..C11` покрывают все 40 role rows, а не только
  `PROJ-035/036/037`.
- Каждый planning write требует цепочку UI gesture -> preview/apply HTTP status
  -> authoritative API readback -> concurrent same-key replay -> reload UI/API
  readback.
- Отсутствующий idempotency key является soft assertion только для продолжения
  остальных action oracle; в конце bundle он всё равно переводит тест в
  `blocker`, не в pass.
- Machine receipt содержит row key `scenarioId:role`, bundle, assertions,
  timestamp, screenshots и blocker. Ledger merge по обязательному
  `SCHEDULE_CLOSEOUT_RUN_ID` переживает Playwright worker restart.
- Final gate проверяет ровно `40` уникальных role rows, `11` bundles, отсутствие
  pending rows и неизменность hash set Schedule, commits, planning client и
  новых API contract files от старта до конца run.
- Browser-context `/api/**` всегда reroute-ится на `127.0.0.1:4192`; UI обязан
  быть на `3180`, worker count обязан быть `1`, DB должна быть явно disposable.
- Task/view fixtures очищаются в `finally`; baseline компенсируется recapture и
  разрешён только на disposable DB. После принудительно завершённого C07 run
  отдельно удалены ровно два residual task ID:
  `t-54222c50-c9fa-4ed1-a93e-b2a22f3d2365` и
  `t-d2a787ef-2723-4c73-821f-f22b6c55c317`.

## Contract updates

### C07 revert-last

C07 теперь нажимает реальный `/commits` control и проверяет request body:

- непустой `targetCommitId`;
- `clientPlanVersion`, равный версии до revert;
- стабильный `idempotencyKey` с prefix `planning-revert-`;
- success восстанавливает данные и увеличивает версию ровно на один;
- два параллельных replay с тем же envelope возвращают исходный `200` payload
  без второго version bump;
- тот же key с другим `targetCommitId` возвращает
  `409 { error: "idempotency_key_conflict" }` и не меняет read-model;
- отсутствие target либо key возвращает
  `400 { error: "planning_revert_invalid" }`.

### C10 Saved WBS Views

C10 захватывает реальный UI POST и проверяет:

- stable `clientRequestId` с prefix `saved-view-`;
- double-click UI отправляет один POST;
- два параллельных same-key replay возвращают тот же `201` response и тот же
  `savedView.id`;
- тот же key с другим payload/name возвращает
  `409 { error: "idempotency_key_conflict" }`;
- list readback содержит ровно один созданный ID и не содержит divergent name;
- reload/select сохраняет zoom payload;
- planReader видит shared view, не видит mutation controls, valid direct POST
  с `clientRequestId` получает `403`, list остаётся неизменным;
- delete и reload подтверждают cleanup.

## Verification

Fresh final commands:

```text
pnpm typecheck
PASS: exit 0; landing Result (102 files), 0 errors, 0 warnings, 0 hints.

E2E_API_PORT=4192 E2E_WEB_PORT=3180 ... playwright test \
  e2e/full-eval/projects-schedule-closeout.spec.ts --workers 1 --list
PASS: 11 tests in 1 file (C01..C11).

pnpm vitest run apps/api/src/planning/planningRevertRoute.test.ts \
  apps/web/src/delivery/schedule/schedule-saved-views.test.ts \
  --config vitest.config.ts
PASS: 2 files, 9 tests.
```

API `4192` был перезапущен после contract updates и подтверждён health `200` на
isolated `kiss_pm_projects_test`.

Targeted C10 command reached every new idempotency/readback/reader/delete
assertion. Exact remaining product failure:

```text
projects-schedule-closeout.spec.ts:840
PROJ-127 requires rename; current control is absent
getByRole('button', { name: 'Переименовать выбранный вид' }) -> element not found
```

Targeted C07 first fresh product failure:

```text
projects-schedule-closeout.spec.ts:1240
every exercised Schedule write must carry an idempotency key
Expected: true; Received: false
```

После удаления volatile `calculatedAt` из reload comparator C07 был запущен
повторно bounded-командой. Итог: `exit 124`, timeout `244.3s`; reporter result
не сформирован, C07 rows остались `pending`. Child process был остановлен, две
остаточные задачи очищены. Это **BLOCKED**, не pass и не flaky retry.

Первый полный pre-update browser run завершился `11 failed`; он superseded
последующими source/contract changes и не используется как fresh closeout pass.

## Exact rerun

После добавления idempotency keys в каждый Schedule apply path и Saved View
rename control:

```powershell
$env:E2E_API_PORT='4192'
$env:E2E_WEB_PORT='3180'
$env:KISS_PM_E2E_DISPOSABLE_DATABASE='1'
$env:SCHEDULE_CLOSEOUT_RUN_ID="schedule-closeout-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$env:SCHEDULE_FILTERS_COLUMNS_POLICY='absent' # либо disabled после решения контракта
$env:PLAYWRIGHT_JSON_OUTPUT_NAME='.superloopy/evidence/schedule-closeout-2026-07-10/schedule-closeout-playwright.json'
.\node_modules\.bin\playwright.cmd test e2e/full-eval/projects-schedule-closeout.spec.ts --config playwright.config.ts --project chromium --workers 1 --max-failures 0 --reporter=line,json
```

Ожидаемый admissible результат: `11 expected`, `0 unexpected`, `0 flaky`,
`0 skipped`; machine receipt: `40 pass`, `0 blocker`, `0 pending`; source hashes
до/после идентичны; screenshots каждого bundle существуют и относятся к тому же
run ID.

## Owned files

- `e2e/full-eval/projects-schedule-closeout.spec.ts`: added; test symbols and
  helpers only.
- `.superloopy/evidence/schedule-closeout-2026-07-10/worker-browser-spec.md`:
  added; this report.
- Product, matrix, docs, config and existing specs changed by this worker: none.

## CodeGraph change index

- Entry sync: `2,231 files / 24,865 nodes / 52,911 edges`.
- Final sync: `2,237 files / 25,056 nodes / 53,339 edges`.
- Global delta: `+6 files / +191 nodes / +428 edges`; это смешанный delta,
  включающий параллельные Schedule/API/commits contract changes, и он не
  приписывается этому worker целиком.
- Worker source addition: `projects-schedule-closeout.spec.ts`, `79` indexed
  TypeScript symbols. Добавлены `TARGET_ROWS`, `BUNDLE_ASSERTIONS`, 11 Playwright
  bundle tests, evidence ledger/source-hash gate и browser/API/readback/cleanup
  helpers. Removed/changed existing source symbols: none.
- Markdown report не добавляет source nodes/edges.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/worker-browser-spec.md
