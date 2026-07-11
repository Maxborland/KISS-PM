# Navigation role matrix integrity

## Verdict

PASS. Финальный live-run содержит полный Cartesian `5 roles x 11 routes = 55` без пропусков, дублей и expected/actual mismatches.

## Failed run and diagnosis

Промежуточный строгий прогон записал 51/55 строк. Два независимых read-only агента подтвердили одну причину: `page.screenshot()` получил краткую Windows file-open ошибку на admin `/scenarios`; исключение из `finally` потеряло текущую строку и оборвало ещё три admin routes. Это был harness/evidence failure, не product, auth или timeout failure.

Исправление fail-closed:

- screenshot exception переводит строку в `FAIL`;
- ошибка добавляется в `failures`;
- `rows.push(row)` выполняется во вложенном `finally`;
- остальные role-route строки продолжают выполняться;
- stale screenshot не может дать PASS.

## Exact state semantics

Live API/UI evidence уточнило ожидаемую zero-project семантику:

- beta `/projects`: `empty`;
- beta `/projects/:id` с detail API `404`: `empty` (`Проект не найден`);
- девять beta delivery subroutes: explicit `error`;
- resourceReader: 11 `forbidden`;
- admin, engineer, planReader: 33 `ready`.

Финальный state summary: `ready 33 / empty 2 / forbidden 11 / error 9`.

## Fresh verification

- `projects-role-routes.spec.ts`: 55/55 PASS, 0 FAIL.
- Expected/actual mismatches: 0.
- Missing combinations: 0.
- Duplicate combinations: 0.
- Screenshots: 55/55 current rows have non-empty paths; screenshot writes fail closed.
- `projects-navigation.spec.ts`: 23/23 PASS, 0 FAIL, 0 INCONCLUSIVE.
- Independent gates: code APPROVE, browser/evidence APPROVE, matrix APPROVE.

## Evidence

- `.superloopy/evidence/projects-2026-07-10/projects-role-routes.json`
- `.superloopy/evidence/projects-2026-07-10/projects-navigation.json`
- `.superloopy/evidence/projects-2026-07-10/qa-navigation-browser-audit.md`
- `.superloopy/evidence/projects-2026-07-10/qa-navigation-matrix-audit.md`

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/orchestrator-navigation-role-matrix-integrity.md
