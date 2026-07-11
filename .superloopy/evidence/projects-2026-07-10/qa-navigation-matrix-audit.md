# QA navigation matrix/evidence final audit

Дата final gate: 2026-07-10
Режим: независимый read-only consistency audit после fresh reruns. Product, tests, docs, matrix и source evidence не изменялись.

## Вердикт

**APPROVE**

Текущие role-route, navigation, screenshot, matrix и navigation-fix артефакты взаимно согласованы. Missing rows, duplicates, expected/actual mismatches, fail или inconclusive в проверяемом gate не обнаружены.

## Проверенный scope

- `.superloopy/evidence/projects-2026-07-10/projects-role-routes.json`
- `.superloopy/evidence/projects-2026-07-10/projects-navigation.json`
- `.superloopy/evidence/projects-2026-07-10/navigation/screenshots/*.png`, только девять путей из `projects-navigation.json.routes`
- `.superloopy/evidence/projects-2026-07-10/navigation-fix.json`
- `docs/qa/full-eval/projects-coverage-matrix-2026-07-10.json`

## Role x route Cartesian gate

Expected roles заданы явно: `admin`, `engineer`, `planReader`, `resourceReader`, `beta`.

Expected routes заданы явно:

1. `/projects`
2. `/projects/project-vektor-portal`
3. `/projects/project-vektor-portal/overview`
4. `/projects/project-vektor-portal/schedule`
5. `/projects/project-vektor-portal/resources`
6. `/projects/project-vektor-portal/assignments`
7. `/projects/project-vektor-portal/calendars`
8. `/projects/project-vektor-portal/scenarios`
9. `/projects/project-vektor-portal/baseline`
10. `/projects/project-vektor-portal/commits`
11. `/projects/project-vektor-portal/settings`

Результат независимого set comparison:

- expected Cartesian: `5 x 11 = 55`;
- actual rows: `55`;
- unique `(role, route)` keys: `55`;
- missing: `0`;
- duplicates: `0`;
- extra: `0`;
- `uiState === expectedUiState`: `55/55`;
- row `status: PASS`: `55/55`;
- `failures`: `0`.

Независимо пересчитанные actual states полностью совпадают с summary:

- `ready: 33`;
- `empty: 2`;
- `forbidden: 11`;
- `error: 9`;
- total `55`, pass `55`, fail `0`.

## Navigation gate

Нормализованный набор состоит из `9 route rows + 13 navigation checks + 1 selector check = 23`.

- normalized rows: `23`;
- unique keys: `23`;
- duplicates: `0`;
- all statuses: `23/23 PASS`;
- contract mismatches: `0` (`finalUrl route`, `actualHref === expectedHref`, selector reload/back);
- summary: total `23`, pass `23`, fail `0`, inconclusive `0`;
- `failures`: `0`;
- `inconclusive`: `0`.

## Screenshot freshness gate

Для девяти target-bound route rows:

- screenshot paths: `9`, unique `9`;
- files exist and are non-empty: `9/9`;
- unique SHA-256 hashes: `9/9`;
- screenshot route target совпадает с соответствующим `/projects/project-vektor-portal/<route>`: `9/9`;
- timestamps относятся к текущему navigation rerun: файлы записаны за `9.791-21.682 s` до `projects-navigation.json.generatedAt`;
- stale screenshots по допустимому окну `0..120 s`: `0`.

## Matrix gate

- actual matrix rows: `223`, declared rows: `223`;
- независимо пересчитанный global summary равен записанному summary;
- global `pass: 70`, `fail: 56`;
- target scope: `PROJ-004/011/025/028/087/095/110`;
- target rows: `15`, unique `(scenarioId, role)`: `15`, duplicates `0`;
- target statuses: `15/15 pass`.

`navigation-fix.json.matrixDelta` согласован с matrix: `rowsPromoted 15`, `fail 71 -> 56`, `pass 55 -> 70`.

## Fresh rerun linkage

- `projects-navigation.json.generatedAt`: `2026-07-10T05:18:46Z`;
- `projects-role-routes.json.generatedAt`: `2026-07-10T05:25:08Z`;
- `navigation-fix.json.generatedAt`: `2026-07-10T05:26:07Z`.

`navigation-fix.json` фиксирует текущие результаты: focused navigation Vitest `9 files, 35/35 passed`, web typecheck passed, navigation `23/23`, role-route Cartesian `55/55` с `33/2/11/9`, без mismatch/missing/duplicate.

## Discrepancies

**Нет.** Gate полностью соответствует заданным критериям; итог **APPROVE**.

## Change index

Изменён только этот audit-report. Product/tests/docs/matrix/source-evidence files не менялись. Source/product symbols added/changed/removed: `0/0/0`. Markdown evidence report не индексируется CodeGraph, поэтому ожидаемая graph delta для этой записи равна нулю.

SUPERLOOPY_AUDIT: .superloopy/evidence/projects-2026-07-10/qa-navigation-matrix-audit.md
