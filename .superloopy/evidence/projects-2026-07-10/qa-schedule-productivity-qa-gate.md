# Schedule productivity: independent QA/evidence gate

**Verdict: APPROVE**

Gate выполнен независимо по текущему worktree для PROJ-046/123/124/125/126. Предыдущие reviewer verdicts не использовались как доказательство: проверены текущий diff, исходники тестов, сырой Playwright JSON и свежие локальные прогоны.

## Evidence freshness

- Playwright artifact: `.superloopy/evidence/projects-2026-07-10/schedule-productivity-playwright.json`
- SHA-256: `1D1286DAC503C1AC490A2F7B15E027985F614E4334ECEEFB833BACAA99FD0EB1`
- Run start: `2026-07-10T03:45:36.293Z`; artifact mtime: `2026-07-10T03:46:13.9641662Z`.
- E2E spec mtime: `2026-07-10T03:45:27.4021166Z`; SHA-256: `F13499D9D9D89C60300AD47F73550CB5EB7627C10245D02098EED8D46D1F03D1`.
- Последние затронутые runtime-файлы до запуска: `schedule-surface.tsx` `03:41:57Z`, `schedule-productivity.ts` `03:44:10Z`, domain compensation `03:38:47Z`, DB test `03:34:50Z`. E2E стартовал после них.
- `schedule-productivity-fix.json` сам по себе был недостаточно свеж для unit/typecheck части, поэтому эти gates перепроверены командами ниже на текущем worktree.

## Required gates

| Gate | Result | Fresh evidence |
|---|---:|---|
| Playwright | PASS | JSON: 4 expected, 4 passed, 0 skipped/unexpected/flaky, Chromium, retry 0 |
| Unit/focused suite | PASS | `pnpm vitest run packages/domain/src packages/planning-client/src apps/web/src/delivery/schedule --config vitest.config.ts` -> 35 files, **197/197 passed** |
| DB compensation audit | PASS | `DATABASE_URL=.../kiss_pm_projects_test pnpm vitest run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts -t "applies command batch atomically with idempotency and version conflict"` -> **1 passed, 23 skipped**; assertion verifies reverse-order `afterState.compensatingCommands` |
| Domain typecheck | PASS | `pnpm --filter @kiss-pm/domain typecheck` |
| Planning-client typecheck | PASS | `pnpm --filter @kiss-pm/planning-client typecheck` |
| API typecheck | PASS | `pnpm --filter @kiss-pm/api typecheck` |
| Web typecheck | PASS | `pnpm --filter @kiss-pm/web typecheck`; `next typegen` + `tsc` passed |
| Responsive | PASS | Playwright test traversed 390/768/1280, asserted toolbar visibility and no document overflow; JSON contains three named PNG attachments |

Первый DB rerun на `127.0.0.1:55433` получил `ECONNREFUSED`. Это не assertion failure. Повтор выполнен на существующей отдельной БД `kiss_pm_projects_test` на compose Postgres `55432`; test setup/teardown работал только с этой test DB и завершился green.

## Literal acceptance paths

| Path | Verdict | Direct evidence |
|---|---:|---|
| reload server replay | PASS | После `page.reload()` E2E повторно отправляет исходный `apply-command-batch` envelope с тем же idempotency key, получает 200 и тот же `newPlanVersion`; readback остаётся ровно 10 задач |
| actual mouse drag | PASS | E2E использует finish-date handle и реальные `page.mouse.down()` -> hover target row -> `page.mouse.up()`; затем preview/apply и readback двух последовательных finish dates |
| keyboard-only ten tasks/readback | PASS | 10 циклов `Insert`, keyboard typing, `Enter`, keyboard confirmation; Home/End/ArrowDown/F2 проверены; API read-model находит все 10, reload показывает сохранённые строки |
| zero-request irreversible undo | PASS | После необратимого TSV create batch кнопка Undo disabled; shortcut показывает отсутствие отката и счётчик preview-batch requests остаётся 0. Runtime не вызывает `undo()` при `canUndo=false`, поэтому apply path не достигается |
| assigned milestone load removal | PASS | Assigned task до преобразования присутствует в assignments и resource-load bucket; reviewed batch удаляет assignment, ставит duration/work=0 и `kind=milestone`; оба readback-проверки load removal проходят, reload показывает `0 дн` |

## Diff review

- PROJ-123: стабильные project-scoped task IDs и batch idempotency key проходят durable replay; malformed/stale paths блокируют apply.
- PROJ-124: pointer handler принимает только downward range; stale preview возвращает 409 без изменения readback.
- PROJ-125: keyboard navigation/create/edit проводятся через реальные UI handlers, не helper-only shortcut.
- PROJ-126: компенсация строится только для полностью обратимого batch, в обратном порядке; capability/busy/editable/version guards не отправляют write.
- PROJ-046: milestone batch сначала удаляет все назначения, затем обнуляет work model и ставит custom field; domain/client compensation восстанавливает assignment/work/custom field.
- `git diff --check` по tracked runtime/test scope прошёл; только существующие CRLF normalization warnings.

## Residual risk

Gate подтверждает заявленный scope. Обратный UI-пункт для превращения milestone обратно в task остаётся вне acceptance scope. Playwright JSON не содержит встроенного commit SHA, поэтому freshness привязана к run timestamp, mtime и SHA-256 текущего spec; после любых новых изменений перечисленных runtime/E2E файлов gate должен быть перезапущен.

## Change index

- Product code, matrix, inventory и другие evidence files этим аудитом не изменялись.
- Единственный добавленный файл: `.superloopy/evidence/projects-2026-07-10/qa-schedule-productivity-qa-gate.md`.
- Проверенная structural area: Schedule productivity UI/helpers, milestone command construction, planning batch audit compensation, domain/client compensating batch builders.
- CodeGraph before -> after: files 2217 -> 2217; nodes 24673 -> 24673; edges 52713 -> 52730. Markdown artifact не создаёт symbol nodes; рост edges получен обязательным sync текущего worktree.
