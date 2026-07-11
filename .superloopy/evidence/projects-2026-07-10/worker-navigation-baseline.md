# PROJ-087: Baseline Overlay в График

Статус: PASS

## Результат

- `ProjectBaseline` уже содержал реальный `next/link` CTA `Слой в «Графике»` с маршрутом `/projects/${projectId}/schedule`; production surface менять не потребовалось.
- Добавлен focused regression test для read-профилей `A` и `PR`.
- Для обоих профилей тест подтверждает, что CTA рендерится как `<a>`, сохраняет переданный `projectId` в `href` и не имеет `disabled` или `aria-disabled="true"`.
- CTA не зависит от `tenant.project_baselines.manage`: профиль `PR` проверяется только с `tenant.project_plan.read`, профиль `A` с read + manage.

## Изменённые файлы

- `apps/web/src/delivery/baseline/baseline-navigation.test.tsx`: новый focused navigation test, 2 сценария.
- `.superloopy/evidence/projects-2026-07-10/worker-navigation-baseline.md`: этот evidence report.
- `apps/web/src/delivery/baseline/baseline-surface.tsx`: без изменений.

## Проверка

PASS:

```text
pnpm --filter @kiss-pm/web exec vitest run src/delivery/baseline/baseline-navigation.test.tsx
Test Files  1 passed (1)
Tests       2 passed (2)
```

PASS с typecheck focused-файла:

```text
pnpm --filter @kiss-pm/web exec vitest run src/delivery/baseline/baseline-navigation.test.tsx --typecheck.enabled
Test Files  1 passed (1)
Tests       2 passed (2)
Type Errors no errors
```

PASS:

```text
pnpm --filter @kiss-pm/web run typecheck
next typegen: passed
tsc -p tsconfig.json --pretty false: passed
```

Первый общий typecheck временно упал на параллельно создававшемся вне-scope `delivery-frame-navigation.test.tsx`; после завершения того worker повторный запуск прошёл. Вне-scope файл не редактировался в этом lane.

## CodeGraph change index

- До изменений выполнены `codegraph sync`, `codegraph_context` и `codegraph_impact`.
- `codegraph_context` не нашёл baseline TSX entry point, а `codegraph_impact(BaselineSurface)` вернул `Symbol not found`; для конкретного surface/test применён файловый read fallback.
- После изменений выполнен `codegraph sync`: `Already up to date`, watcher уже проиндексировал новый тест.
- `baseline-surface.tsx`: 30 -> 30 nodes/symbols, production graph без изменений.
- `baseline-navigation.test.tsx`: файл отсутствовал -> 6 nodes (file, 4 imports, `permissions`).
- Связанные edges нового теста: 0 -> 9 (5 `contains`, 4 `imports`).
- Unresolved test-runner call refs: 0 -> 7 (`vi.mock` x6, `describe` x1); это ограничение индексатора, не TypeScript error.
- Итоговый индекс: 2221 files, 24705 nodes, 52776 edges.

## Scope и UI gate

- Docs, matrix, E2E и git history не затронуты; commit не создавался.
- Визуальный QA не применялся: production JSX/CSS и вид CTA не менялись, проверяется только существующий navigation contract.
- Anti-slop/token audit: новых визуальных значений и copy в product UI нет.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-baseline.md
