# VISUAL_QA — Planning Cockpit contracts (PR6a)

Ветка: `codex/planning-cockpit-contracts` (6 коммитов от master `6a815599`).
Скоуп визуальных изменений: матрица ресурсов (плотность 36px = var(--row-h),
sticky-шапки с реальным вертикальным скроллом карточки max-h 75dvh,
right-aligned tabular-nums + overflow-hidden в ячейках, focus-visible-кольца,
drilldown-сосед на ≥lg / оверлей на <lg, ссылка «Открыть в Графике»).
График: без визуальной перестройки (жесты/команды/клавиатура).

## Real-browser evidence

Строгий литеральный e2e `projects-resources-closeout` (16 квитанций,
KISS_PM_E2E_DISPOSABLE_DATABASE=1) прогнан живьём ПОСЛЕ всех визуальных правок:
**3/3 PASS** — скриншоты строк и drilldown-сценариев обновлены прогоном в
`.superloopy/evidence/project-resources-assignments-2026-07-11/screenshots/`
(collapsed-live-hierarchy, month-full-horizon, live-contribution-drilldown и др.,
per-role admin/planReader; квитанции в `receipts/`). Это реальный браузер,
реальные данные, честная фиксация новой геометрии (sticky-шапка, плотность,
drilldown-сосед). Плюс живые прогоны: schedule-write/productivity/resources-write —
8 passed; dev-БД пересеяна после disposable-прогона.

## Гейты

- pnpm typecheck — 0; web unit 464/464 (+engine-consistency и pointer-lifecycle тесты);
- prod-сборка web — PASS;
- DESIGN.md-гейт: новые стили — только токены/утилити (var(--row-h), var(--radius-card),
  var(--accent-hover), touch-pan-y/touch-none); raw hex не добавлялся (health-гейты зелёные);
- reduced-motion: новых анимаций нет (жесты — pointer, отмены мгновенные);
- Storybook-скриншоты неприменимы: stories планирования не рендерятся standalone
  (pre-existing «invariant expected app router», задокументировано в PR5-evidence).

## Ревью-волна (3 линзы) — закрыто

- P1 семантика движка (fixed_units resize snap-back + перезапись часов) →
  engineConsistentWorkMinutes + recalculateWorkModel в editWork/optimisticPatch;
- P2×5: fill-хардкод fixed_duration, клавиатурный clamp к старту проекта,
  blur-cancel fill-drag, раснеймспейс ?task= + projectId на уровне проекта,
  max-h для рабочих sticky-шапок;
- P3×7: begin-guard второго указателя, touch-pan-y/touch-none по направлению жеста,
  overlay на <lg + min-w грида, overflow-hidden ячеек, скролл/фокус строки по ?task=.

**Вердикт: PASS.**
