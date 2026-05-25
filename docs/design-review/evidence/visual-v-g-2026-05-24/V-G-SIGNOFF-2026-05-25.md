# V-G sign-off — evidence repair (2026-05-25, v2 visible chart)

## Метод

- **Storybook dev** `http://127.0.0.1:6006` (`pnpm storybook`), не static `serve`.
- Скрипт: [`../../scripts/capture-evidence-visual-v-g.mjs`](../../scripts/capture-evidence-visual-v-g.mjs)
- Manifest: [`capture-manifest.json`](./capture-manifest.json) (`batch: visual-v-g-signoff-v2`)

## Исправление false positive (v1)

Первый sign-off (v1) проходил manifest по **DOM/CSS** (`--gantt-day-w`, размер PNG), но снимки `body` / `.gantt2` без горизонтального скролла показывали только **шапку, toolbar, KPI и левую WBS-таблицу**. Колонка графика (timeline, `.gbar` / `.gmile`) уезжала вправо из-за `overflow: auto` на `.gantt2`.

**v2:** перед chart-PNG скролл `.gantt2` до видимости полос; screenshot элемента `.gantt2` после скролла; manifest требует `visibleGanttBarCount > 0` и `chartScrolledIntoView: true`.

## Gantt evidence (canonical)

| Файл | Назначение | Sign-off |
|------|------------|----------|
| `audit-views-screens-gantt-table.png` | WBS слева, `scrollLeft = 0` | справочно |
| `audit-views-screens-gantt-chart.png` | **День** — timeline + полосы в кадре | **да** |
| `audit-views-screens-gantt-chart-zoom-month.png` | **Мес** — timeline + полосы, `--gantt-day-w: 12px` | **да** |
| `audit-views-screens-gantt.png` | full-page alias (parity-matrix) | наследует pass chart |
| `audit-views-screens-gantt-zoom-month.png` | full-page alias month | наследует pass chart |

Проверки manifest для `*-chart.png`:

- `ganttBarCount > 0` (15)
- `visibleGanttBarCount > 0` (11 после скролла)
- `chartScrolledIntoView: true`
- day: `ganttDayW === "28px"`, `scrollLeft ≈ 1009` · month: `12px`, `scrollLeft ≈ 568`
- PNG `.gantt2`: ≥ 10 KB (элемент меньше full-page)

Последний прогон: `audit-views-screens-gantt-chart.png` 836×392, 13 020 B · `audit-views-screens-gantt-chart-zoom-month.png` 36 391 B.

## Прочие экраны (без изменений v2)

`audit-views-screens-task-card.png`, `deals`, `dashboard` — full `body`, как раньше.

## Команда

```bash
cd apps/web
pnpm storybook
# другой терминал:
node ../../docs/design-review/scripts/capture-evidence-visual-v-g.mjs
```

**Sign-off:** `capture-manifest.json` → `allPass: true` (только записи с `requiredForSignoff: true`).
