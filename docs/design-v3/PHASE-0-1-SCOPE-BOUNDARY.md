# Phase 0–1 — граница scope (Storybook)

**Статус:** промежуточная верификация 2026-05-26.

## В scope PR «design-v3 Storybook Phase 0–1»

| Область | Пути |
|--------|------|
| Brief / контракт / токены (docs) | `docs/design-v3/PRODUCTION-GRADE-BRIEF.md`, `DESIGN_CONTRACT.md`, `TOKENS.md`, `STORYBOOK-STRUCTURE.md`, этот файл |
| Storybook play + CI gate | `apps/web/src/views/screens/screens.stories.tsx`, `apps/web/scripts/run-copy-scan-all-stories.mjs` |
| Foundations | `apps/web/src/stories/foundations/*`, `apps/web/.storybook/storybook-fonts.css` |
| Токены (без репейнта экранов) | `apps/web/src/styles/tokens.css`, `tokens.planning.css` |

## Вне scope — не смешивать без отдельного PR

Следующие изменения **не относятся** к Phase 0–1 Storybook и требуют отдельного ревью:

| Изменение | Пути |
|-----------|------|
| API / parsers | `apps/api/package.json`, `apps/api/src/projectWorkParsers.ts`, `apps/api/tsconfig.json` |
| Task command contract package | `packages/task-command-contract/` |
| Lockfile от API/workspace | `pnpm-lock.yaml` (только если затронут API-пакет) |

**Правило:** перед merge Storybook PR — вынести API/task-contract в отдельную ветку или revert из worktree.

## Артефакты проверки (не коммитить)

| Путь | Git |
|------|-----|
| `apps/web/.storybook-verify-tmp/` | JSON/PNG — **`.gitignore`**, снято с index (`git rm --cached`) |
| `apps/web/storybook-static/` | ignored |
| `output/` | ignored |

Evidence только локально/CI artifact, не в репозитории. См. [`STORYBOOK-STRUCTURE.md`](./STORYBOOK-STRUCTURE.md) §7.
