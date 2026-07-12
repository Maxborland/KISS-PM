# VISUAL_QA — Agent Workspace, эталон №1 (PR5)

Ветка: `codex/agent-workspace-reference` (stacked на `codex/design-authority-tokens`).
Design Read: операционный workspace для ежедневной работы PM, язык KISS Operational,
`DESIGN_VARIANCE 4/10 · MOTION_INTENSITY 5/10 · VISUAL_DENSITY 9/10`.

## Матрица скриншотов (реальный браузер, Storybook static + contract-mock)

`agent-{light|dark}-{normal|reduced}-{390|768|1280}.png` — 12 кадров, все без
горизонтального скролла (проверено программно: `scrollWidth <= clientWidth`).
`agent-review-open-1280.png` — интерактивный прогон: сообщение → живой CoT-трейс →
предложение в панели сверки (mock-мозг, реальный клиент).

## Токен-гейт (DESIGN.md)

- Все цвета/размеры/радиусы/тени в `workspace/agent/**` — через `var(--*)` из tokens.css;
  raw hex/`text-[Npx]` — ноль (health-гейт 8/8 зелёный).
- Dark: поверхность собрана на dark-адаптированных токенах (canvas/panel/border/text);
  два найденных ревью P1 (result-пузырь и чип вложения парили светлый `--accent-soft`
  с theme-flipping `--text` → нечитаемо в dark) исправлены: акцентная рамка на панели
  и нейтральный чип. Оставшиеся «светлые острова» (warning-баннер, статус-чипы с
  fixed-парами soft-bg+*-text ≈4.7:1) — читаемы, системный долг PR11.
- Новые layout-константы токенизированы: `--shell-topbar-h: 56px` (высота топбара
  WorkspaceShell, full-height считается от него), `--side-panel-width: 360px`
  (панель сверки; развязана от planning-геометрии `--inspector-width`).

## Anti-slop pre-flight

- Шрифтовой стек — существующий бренд (Inter/Plus Jakarta Sans/JetBrains Mono токенами) — override допустим.
- Акцент один (indigo `--accent`), применён точечно (аватар, выбор, ссылки); градиентов нет.
- Русские грамматические тире в копии — языковое исключение (в DESIGN.md/контракте
  запрета нет; вся RU-копия репо использует тире); декоративные стрелки из новой копии убраны.
- Motion: единственная новая анимация — Spinner (essential-индикатор); reduced-motion
  замедляет `.animate-spin` глобальным гардом; остальное — Radix-примитивы.
- Пустое состояние честное; счётчики/статусы — только из payload (контракт PR4).

## Функциональные гейты

- `pnpm typecheck` — 0 ошибок; unit+health: 37/37 (7 unit агента, включая новые:
  честный thinking без выдуманных шагов, trace-сообщение в треде, skeleton загрузки,
  retry listTools без raw-кода в тексте страницы).
- **Живой e2e `agent-partial-apply` — 2/2 PASS** (mocked partial-apply + live конфликт
  из реального backend; viewport-свип 390/768/1280 с reduced-motion).
- Прод-сборка web + Storybook — PASS.

## Ревью-волна (4 линзы) — все P1/P2 закрыты

- e2e/contract P1 «двойной ReviewContent → strict mode violation» + P1 «Sheet не
  закрывается при ресайзе ≥768 (orphan overlay + aria-hidden)» → один экземпляр
  панели через matchMedia (desktop aside ↔ mobile Sheet, unmount целиком).
- design P1×2 (dark-нечитаемость) → исправлены (см. токен-гейт).
- a11y P2×3: псевдо-интерактивный article → взаимодействие через внутренние кнопки
  (чип toggle с aria-describedby на заголовок изменения); Sheet без Trigger ронял
  фокус на body → onCloseAutoFocus на кнопку «Сверка»; apply-кнопка дизейблилась
  под фокусом во время execute → aria-disabled+guard.
- P3-серия: role=group у трейса, aria-live=off на повторе трейса (без двойного
  озвучивания), sr-only status на skeleton, role=alert на баннере ошибки, прерванный
  ход помечается («Ход прерван ошибкой»), pending-состояние retry, guard двойного
  submit во время thinking, aria-label «Убрать файл {имя}», haspopup на «Сверка»,
  size-4 иконка, docstring story.

**Вердикт: PASS.**
