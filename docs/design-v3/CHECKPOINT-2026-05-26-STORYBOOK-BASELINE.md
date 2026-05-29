# Checkpoint — design-v3 Storybook baseline (2026-05-26)

**Вердикт:** `baseline ready` — VRT 119/119, axe 11/11, vitest 199/199 (локально 2026-05-26).

## Scope Phase 9

| Task | Артефакт |
|------|----------|
| 9.1 VRT | `apps/web/tests/e2e/storybook-vrt*.ts`, baselines `apps/web/tests/e2e/storybook-vrt-baselines/*.png` |
| 9.2 Gates | `design-v3-quality-gates.health.test.ts`, `storybook-a11y.spec.ts`, `run-storybook-contract-ci.mjs` |
| 9.3 Lock | `DESIGN_CONTRACT.md` v2, этот checkpoint |

## Секции Storybook (8 roots)

`Foundations`, `Primitives`, `Composites`, `Widgets`, `Screens`, `Flows`, `Patterns`, `API Contract` — см. `storybook-section-roots.health.test.ts`.

## VRT coverage

Префиксы story id: `widgets-`, `screens-`, `flows-`, `patterns-` (из `storybook-static/index.json` после `build-storybook`).

Viewport: **1440×900**, locale `ru-RU`, timezone `Europe/Moscow`.

Скриншоты: iframe preview `#storybook-preview-iframe`, `maxDiffPixelRatio: 0.02`, `animations: disabled`.

## Команды верификации

```bash
# apps/web
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web build-storybook
pnpm --filter @kiss-pm/web test:vrt          # Playwright @vrt
pnpm --filter @kiss-pm/web test:a11y         # axe: 0 critical/serious (12 stories)
pnpm --filter @kiss-pm/web build

# monorepo root
pnpm test
pnpm typecheck
pnpm build
pnpm verify:storybook-contract   # typecheck + vitest + build-storybook + web build + copy-scan + VRT + a11y
```

## Evidence (локальный прогон 2026-05-26)

| Команда | Exit | Примечание |
|---------|------|------------|
| `pnpm --filter @kiss-pm/web test` | 0 | 199 tests (вкл. `design-v3-quality-gates`, section roots) |
| `pnpm --filter @kiss-pm/web test:vrt` | 0 | 119 snapshots, `storybook-vrt-baselines/` |
| `pnpm --filter @kiss-pm/web test:a11y` | 0 | 11 stories, 0 critical/serious |
| `pnpm verify:storybook-contract` | — | полный pipeline ~15+ мин; перегенерировать `phase9-ci-evidence.json` перед merge |

## Known follow-ups

- Сократить frozen allowlist inline-style/hex в `design-v3-quality-gates.health.test.ts` (badge/button → tokens).
- Расширить axe на все `screens--*` (сейчас 12 эталонных stories).
- Copy-scan в CI: при EMFILE на Windows — chunked serve уже в `run-copy-scan-all-stories.mjs`; при timeout — поднять `COPY_SCAN_CHUNK_SIZE` или parallel workers=1.
- DnD play-stories: регрессия через `storybook-kanban-play.ts` + health grep, не через VRT (статичный кадр).

## Ссылки

- Контракт: [`DESIGN_CONTRACT.md`](./DESIGN_CONTRACT.md) **v2**
- Структура: [`STORYBOOK-STRUCTURE.md`](./STORYBOOK-STRUCTURE.md)
- Production brief: [`PRODUCTION-GRADE-BRIEF.md`](./PRODUCTION-GRADE-BRIEF.md)
