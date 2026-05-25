# V-H — plan-first: parity Storybook ↔ planning-ui-approved

**Дата:** 2026-05-24  
**Статус:** только план (без правок кода)  
**Эталоны:** [`docs/references/planning-ui-approved/`](../references/planning-ui-approved/) (`index.json`, `02-schedule-wbs-gantt.html`, `04-resources.html`, `schedule.css`)  
**Storybook:** `views-screens--project-gantt`, `views-screens--project-resources`

---

## 1. Сопоставление screenId

| Эталон HTML | Storybook (design-v3) | Блок |
|-------------|----------------------|------|
| `02-schedule-wbs-gantt` | `12-project-gantt` → `views-screens--project-gantt` | `GanttSliceBlock` + `Gantt` widget |
| `02b-schedule-task-selected` | — | Нет story: выделение строки + inspector |
| `02c-schedule-preview-pending` | — | Нет story: preview pending overlay |
| `04-resources` | `13-project-resources` → `views-screens--project-resources` | `ProjectResourcesBlock` |
| `05-assignments` | — | Нет slice «Назначения» |
| `03-task-inspector-detail` | частично `03-task-card` | CRM entity, не planning inspector |

---

## 2. Gantt / schedule (`02-schedule-wbs-gantt`)

### Есть в Storybook

- Двухуровневая шапка timeline (месяц + дни)
- WBS-колонки (#, режим, WBS, название, длит., %, даты, ресурсы, труд)
- Полосы summary / task / milestone, critical styling
- Toolbar: icon groups, «крит. путь», «Базовый план», Segmented zoom (после V-F: `--gantt-day-w` реагирует на zoom)
- KPI strip SPI/CPI/прогресс/задач

### Gaps (приоритет)

| # | Gap | Severity | Предлагаемый slice |
|---|-----|----------|-------------------|
| H-1 | Нет **split-pane**: фиксированная ширина grid + scroll chart как в `schedule.css` (`.planning-split`) | high | CSS `widgets/gantt` + layout shell |
| H-2 | Нет **dependency arrows** между полосами | high | SVG overlay layer в `Gantt` |
| H-3 | Нет **inspector panel** справа при выборе задачи (`02b`) | high | отдельная story + `TaskInspector` slice |
| H-4 | Нет **preview pending** состояния расчёта (`02c`) | medium | `data-planning-state="preview"` + toolbar badge |
| H-5 | Zoom **неделя/месяц**: только сжатие day-width, без агрегации колонок | medium | read-model + column bucketing |
| H-6 | Topbar project chrome: табы «График / Ресурсы / …» как в mockup-shell | medium | `ProjectChrome` в `views/layout` |
| H-7 | Inline edit ячеек WBS | low | Phase 5 planning, не design-v3 catalog |

---

## 3. Resources (`04-resources`)

### Есть в Storybook

- `PageIntro` + таблица/матрица mock (упрощённый блок)
- Workspace chrome, RU copy

### Gaps

| # | Gap | Severity | Предлагаемый slice |
|---|-----|----------|-------------------|
| H-8 | Нет **weekly matrix** с heatmap загрузки (строки ресурсы × недели) | high | `ResourceMatrix` widget по `04-resources.html` |
| H-9 | Нет переключателя **список / матрица / календарь** в toolbar | medium | Segmented + state (как Gantt zoom) |
| H-10 | Нет **utilization %** и conflict chips в ячейках | medium | Chip variants §7 |
| H-11 | Нет drill-down `04b-resource-detail` | low | entity story отдельно |

---

## 4. Критерии приёмки (когда брать implement после V-H)

1. Playwright: `views-screens--project-gantt` — смена Segmented меняет `data-gantt-zoom` и `--gantt-day-w` (есть после V-F).
2. PNG evidence: gantt + resources в `docs/design-review/evidence/` с `status` не `red` только после закрытия H-1…H-2 и H-8.
3. `parity-matrix.json` строки `dv3-vf-*` / `dv3-vh-*` → `green` только с коммитнутым screenshot.

---

## 5. Рекомендуемый порядок batches (post V-H)

```txt
V-H-impl-1  split-pane + chart scroll (H-1)
V-H-impl-2  dependency arrows mock (H-2)
V-H-impl-3  resource matrix density (H-8, H-10)
V-H-impl-4  inspector story (H-3)
V-H-impl-5  project tab chrome (H-6)
```

_Связано: visual batch V-F (zoom wiring), V-G (evidence PNG), `DESIGN_CONTRACT.md` §10._
