# VISUAL_QA — унификация владельца токенов (PR5-prep-B)

Ветка: `codex/design-authority-tokens` (5 коммитов от master `6a815599`).
Цель изменения: **ноль визуальных изменений** — tokens.css становится единственным
владельцем `:root`, winning-значения kiss-v4 переносятся 1:1.

## Метод

1. **Машинный parity каскада**: скрипт собирает итоговую (winning) карту всех
   `:root`-переменных по правилам слоёв (tokens.css → tokens.planning.css →
   kiss-v4.css) для `origin/master` и ветки. Результат: **151/151 существующих
   значений идентичны**; единственное добавление — `--shadow-lift` (новый токен
   для .hover-lift, значение 1:1 со старым литералом).
2. **Real-browser скриншот-parity**: два статических Storybook-билда
   (origin/master в отдельной worktree и ветка), один и тот же набор stories,
   chromium 390/768/1280, pixel-diff (superloopy visual-diff).

## Результат pixel-diff

7 stories × 3 вьюпорта = **21/21 пар: similarityScore 100, diffRatio 0**
(попиксельно идентичны):

| Story | Покрывает |
|---|---|
| foundations-colors--palette | все цветовые токены напрямую |
| foundations-typography--type-scale | типографическая шкала |
| ui-table--design-v-2 / --numeric | границы/плотность/tabular-nums (v4-утилиты) |
| ui-alert--design-v-2 | стаб (Sonner-указатель) |
| widgets-звонок--grid | BEM-виджет (замороженный слой) |
| workspace-agent--default | лендинг-остров --lad-* (не тронут) |

Скриншоты: `baseline/*.png` (origin/master) и `branch/*.png` — имена совпадают попарно.

## Ограничения и честные оговорки

- Stories плотных продуктовых поверхностей (schedule, deals, dashboard,
  assignments, resources, my-work) **не рендерятся standalone в iframe.html**:
  pre-existing ошибка «invariant expected app router to be mounted», идентичная
  на обеих сторонах (первый прогон diff'а сравнил две одинаковые страницы ошибки —
  единственным отличием был номер порта в стектрейсе; такие скрины удалены из
  evidence как не-доказательство). Это существующий долг каталога Storybook,
  не следствие данного изменения; product-поверхности покрыты машинным parity
  каскада + прод-сборкой web.
- Dark theme в Storybook не активируется (тема ставится профилем через
  `data-theme`); dark-карта в globals.css не менялась (git diff подтверждает).
- Reduced-motion не снимался: motion-изменение только удаление МЁРТВЫХ классов
  `.v4-lift`/`.v4-pop` (0 консьюмеров) — анимации консьюмеров не менялись.

## Прочие гейты

- `pnpm typecheck` — 0 ошибок (web + landing/astro).
- `pnpm --filter @kiss-pm/web test` — 64 файла / 464 теста PASS
  (включая переписанный design-v3-enforcement: 8/8, с новыми ratchet-гейтами).
- `pnpm --filter @kiss-pm/web build` — prod-сборка PASS.
- `pnpm --filter @kiss-pm/web build-storybook` — PASS (обе стороны).
- Anti-slop pre-flight: новых UI-поверхностей нет; DESIGN.md-контракт создан,
  все значения в нём трассируются к tokens.css (проверено вручную).

**Вердикт: PASS — визуальный ноль подтверждён машинно и попиксельно на рендерящемся подмножестве.**
