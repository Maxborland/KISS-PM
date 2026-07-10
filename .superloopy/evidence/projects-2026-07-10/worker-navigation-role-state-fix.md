# Projects role route UI-state fix

## Status

PASS. Строгая классификация реализована только в `e2e/full-eval/projects-role-routes.spec.ts`.

## Изменения

- `EvidenceRow` содержит `expectedUiState`, и значение записывается для каждой role/route строки.
- `getExpectedUiState` задаёт точную матрицу: `403 -> forbidden`; `projectsCount > 0 -> ready`; нулевой count на `/projects` -> `empty`; нулевой count на detail/subroute -> `error`.
- Каждая строка проверяет фактический state точным `expect(row.uiState).toBe(row.expectedUiState)`.
- Legacy-проверка `not.toBe("ready")` удалена.
- `detectUiState` проверяет explicit error markers до generic empty markers; `forbidden` остаётся первым приоритетом.
- Проверка `alphaLeak === false` для ролей с нулевым списком сохранена.

## Verification

### Playwright collection

Команда:

```text
pnpm exec playwright test e2e/full-eval/projects-role-routes.spec.ts --list
```

Результат: exit code 0.

```text
Listing tests:
  [chromium] › full-eval\projects-role-routes.spec.ts:58:1 › Projects role x every route state matrix
Total: 1 test in 1 file
```

### Code-level proof

Статическая fail-fast проверка исходника завершилась с exit code 0:

```text
PASS: evidence row declares expectedUiState
PASS: row computes expectedUiState
PASS: exact actual-to-expected assertion exists once
PASS: legacy not-ready assertion is absent
PASS: 403 maps to forbidden
PASS: positive count maps to ready
PASS: zero-count list/detail split is exact
PASS: explicit error precedes generic empty
```

Полный browser execution не запускался: assignment требует collection check `--list` и code-level proof.

## Scope

Созданы/изменены только назначенные артефакты:

- `e2e/full-eval/projects-role-routes.spec.ts`
- `.superloopy/evidence/projects-2026-07-10/worker-navigation-role-state-fix.md`

Product code, screenshots, JSON evidence, coverage matrix и другие тесты не изменялись этой работой. Существующие параллельные изменения в dirty worktree не откатывались.

## CodeGraph change index

- Перед изменением: `codegraph sync` сообщил `Already up to date`; контекст содержал `EvidenceRow` и `detectUiState`, символ `getExpectedUiState` отсутствовал.
- После изменения: обязательный `codegraph sync` успешно переиндексировал 1 modified file / 39 nodes.
- Файл: `e2e/full-eval/projects-role-routes.spec.ts`.
- Symbols: `EvidenceRow` changed; `detectUiState` changed; `getExpectedUiState` added (CodeGraph search/node: function at line 242).
- Semantic call: Playwright matrix callback теперь вызывает `getExpectedUiState` (0 -> 1). `codegraph_callers` не материализовал caller для anonymous test callback.
- Наблюдаемые aggregate nodes до explicit sync -> после sync: `24772 -> 24772`; aggregate edges: `53116 -> 53116`. Watcher уже подхватил edit до pre-sync status snapshot, поэтому aggregate delta равна нулю; explicit sync всё равно подтвердил reindex целевого файла.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-role-state-fix.md
