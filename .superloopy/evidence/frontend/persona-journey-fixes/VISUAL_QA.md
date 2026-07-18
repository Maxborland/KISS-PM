# Visual QA: persona journey fixes

Дата: 2026-07-13.

## Scope

- Профиль владельца после полного первого рабочего цикла, viewport 390 px, reduced motion.
- Read-only CRM-канбан для reader-роли, viewport 1280 px.

## Evidence

- `persona-owner-profile-390.png`
- `persona-reader-deals-1280.png`

## Geometry

- Документ профиля не имеет горизонтального overflow.
- Канбан из пяти колонок помещается в доступную рабочую область на 1280 px.
- Ни одна карточка сделки не имеет внутреннего горизонтального overflow.

## Verification

- `pnpm typecheck`
- `pnpm --filter @kiss-pm/web test`
- `pnpm --filter @kiss-pm/web build`
- Persona Playwright smoke: 4/4 с `--repeat-each=2`.
- Свежие скриншоты проверены визуально после геометрических assertions.
