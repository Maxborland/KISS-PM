# Design v3 — мокапы и Storybook

## Источник истины (HTML, архив)

Каноническая HTML-галерея **KISS PM · Design v2** (65 макетов: Screens / Patterns / Components) остаётся **референсом в `docs/`**, не в runtime Storybook:

- каталог: `docs/design-v2/` (в основном репозитории / соседнем worktree)
- индекс: `index.html`, `catalog.json`

Используется для сверки визуала и токенов, не как отдельная ветка sidebar Storybook.

## Копия HTML в web (опционально)

При необходимости iframe-референса HTML копируется в:

```txt
apps/web/public/mockups/design-v2/
```

Скрипты `sync:mockups` / `gen:mockup-stories` в текущем slice **не подключены** — при появлении добавить в `apps/web/package.json` и обновить этот файл.

## Навигация Storybook (design-v3, актуально)

Индекс собирается из `.storybook/main.ts` (без `src/stories/design-v2/**`).

| Раздел sidebar | Содержание | Путь в коде |
|----------------|------------|-------------|
| **Основы** (Foundations) | Цвета, типографика | `src/stories/foundations/` |
| **UI** | shadcn + BEM: **Документация** (autodocs), **Витрина** (fullscreen showcase) | `src/components/ui/*.stories.tsx`, `src/stories/showcases/demos.tsx` |
| **Представления → Экраны** (Views/Screens) | Продуктовые экраны Phase 2 | `src/views/screens/screens.stories.tsx` |
| **Каталог → Все компоненты** | Сводная витрина primitives | `src/stories/catalog/ComponentCatalog.stories.tsx` |

Подписи sidebar на русском:

- дочерние stories: поле `name` в CSF (`Витрина`, `Для согласования`, …);
- autodocs «Docs» → **Документация** (`sidebar.renderLabel` в `.storybook/manager.ts`);
- группы UI/Catalog/Foundations → `.storybook/sidebarLabelsRu.ts`.

**Story id и `title` в CSF не менялись** (например `ui-button--design-v-2`, `title: "UI/Button"`), чтобы не ломать закладки.

## Удалённое legacy (batch 8)

Не использовать и не восстанавливать без ADR:

| Было | Статус |
|------|--------|
| `src/stories/design-v2/*.stories.tsx` (32 файла) | **удалено** |
| `pnpm gen:design-v2-stories` | **удалено** из `package.json` |
| `scripts/generate-design-v2-react-stories.mjs` | **удалено** |
| Sidebar **Design v2 / …** | **нет в индексе** |

## Согласование

```txt
HTML mockups (docs/design-v2)
  → сверка с React (UI/Витрина + Catalog + Views/Screens)
  → токены: apps/web/src/styles/tokens.css (см. TOKENS.md)
```

Команды верификации Storybook:

```bash
pnpm --filter @kiss-pm/web build-storybook
pnpm --filter @kiss-pm/web typecheck
```

_Обновлено: batch 9 docs sync · worktree design-v3-rebuild._
