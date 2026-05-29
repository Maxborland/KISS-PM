# Cursor Prompt — Batch B6: Project Control Surfaces (Resources/Baseline/Scenarios/KPI/Audit/Calendars)

Inherit master rules.

## Files in scope

```txt
apps/web/src/views/blocks/project-resources-block.tsx
apps/web/src/widgets/resource-matrix/resource-matrix.tsx
apps/web/src/widgets/resource-matrix/cells.tsx
apps/web/src/views/blocks/project-baseline-block.tsx
apps/web/src/views/blocks/project-scenarios-block.tsx
apps/web/src/views/blocks/project-kpi-block.tsx
apps/web/src/views/blocks/project-audit-block.tsx
apps/web/src/views/blocks/project-calendars-block.tsx
apps/web/src/views/screens/screens.stories.tsx (variants)
```

**NB: `gantt-slice-block.tsx` is NOT in this batch** — covered by `GANTT-PRODUCTION-GRADE-CURSOR-PROMPT.md`.

## P0

1. `project-resources-block.tsx` L21–32 — «Роли» → `Popover` filter; «Май 2026» → `DatePicker`/`Select` month; «Назначить» → `Dialog` stub. All wired to `useState`.
2. `widgets/resource-matrix/resource-matrix.tsx` L31–37 — collapse `<button>`: add `onClick={onToggleCollapse(rowId)}`, `aria-expanded`, filter rendered rows by collapse set.
3. `project-baseline-block.tsx` L46 «Создать снимок» → appends to local `snapshots` state. L47 «Сравнить» → toggles `compareMode` showing extra delta columns.
4. `project-scenarios-block.tsx` L21 + L55–57 — row `useState<selectedId>`; header «Принять сценарий» enabled only when selected matches; per-row «Принять» wired to same handler; «Принят» chip shown after.
5. `project-calendars-block.tsx` L72 «Шаблоны» → `Popover`/`Select` with templates that overwrite `weekdays` state. L76 «Сохранить» → `disabled={!isDirty}` + toast. L112 «Добавить» → reads form + appends to `exceptions` state.
6. `project-calendars-block.tsx` L51–59 / L140 — pass `onRemove={(date) => setExceptions(prev => prev.filter(...))}` to `ExceptionRow`.

## P1

7. `widgets/resource-matrix/cells.tsx` L64–77 — optional `onCellActivate`; render as `<button>` when provided.
8. `project-kpi-block.tsx` L28 «Открыть управленческую поверхность» → action stub. L31–45 tiles → `<button>` with `onDrillDown(kpiId)`. L58–60 signal chips → ghost buttons with `onAct`.
9. `project-audit-block.tsx` L23 search → controlled, filters `ENTRIES`. L24–27 «Фильтр» → either `Popover` with date/actor filter OR `disabled`. Add export button (`disabled title="Демо"` or CSV download of filtered list).
10. `project-calendars-block.tsx` L87–103 weekday switches/template Select — lift to block state so save snapshot is consistent.

## P2

11. `screens.stories.tsx` — variants: `ResourcesCollapsed`, `BaselineComparing`, `ScenariosAccepted`, `AuditFiltered`, `CalendarsDirty`.

## Acceptance

- Resources: filter chip applied, month changed, matrix collapses groups.
- Baseline: «Создать снимок» добавляет строку в список снимков (новый компонент или хранится в state); «Сравнить» меняет таблицу.
- Scenarios: выбор строки + accept → видимый «Принят».
- Calendars: dirty indicator, exception add/remove работают, Save disabled until dirty.
- Audit: search filter работает, export labeled.

## Verification

Master gate + `interaction-batch-6-evidence.json`.
