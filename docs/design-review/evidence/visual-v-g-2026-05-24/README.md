# Visual evidence — batch V-G

**Sign-off v2 (visible chart):** [`V-G-SIGNOFF-2026-05-25.md`](./V-G-SIGNOFF-2026-05-25.md) · [`capture-manifest.json`](./capture-manifest.json)

Переснятие:

```bash
cd apps/web
pnpm storybook
node ../../docs/design-review/scripts/capture-evidence-visual-v-g.mjs
```

**Gantt (обязательно для parity):**

- `audit-views-screens-gantt-chart.png` — день, видимые полосы/timeline
- `audit-views-screens-gantt-chart-zoom-month.png` — месяц
- `audit-views-screens-gantt-table.png` — левая таблица (контраст)

Не использовать static `serve` для Gantt — iframe stub ~4 KB; v1 full-page PNG **не** показывали график справа.

См. [`parity-matrix.json`](../parity-matrix.json).
