# Phase 6 — верификация Storybook

Артефакты для закрытия review PO-F4 (скриншот экрана Ганта).

## Обязательные story / тесты

| ID | Проверка | Артефакт |
|----|----------|----------|
| Gantt screen | `Screens` → **12 Гант проекта** (`screens--project-gantt`) | Скриншот в PR или локально: `pnpm --filter @kiss-pm/web storybook` → story → Export |
| Gantt geometry | `Widgets/Gantt` → **DependencyGeometrySelected** | Play: `.gantt2--dependency-selected`, `.gdep__path--selected` |
| Gantt unit | `gantt-dependency-paths.test.ts` | CI / `pnpm --filter @kiss-pm/web test` |
| Kanban DnD | `Widgets/Kanban` → **DnD targets** | Play: pointer drag MDS-39 → «В работе» |
| My Work DnD | `Screens` → **02 Моя работа · DnD** (`screens--my-work-kanban-dragging`) | Эталон product-screen |

## Команды

```bash
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web run verify:storybook-contract
```

## Скриншот для PR

1. Запустить Storybook.
2. Открыть `Screens/12 Гант проекта`.
3. Сохранить PNG как `docs/design-v3/artifacts/phase-6-project-gantt.png` (опционально в PR).

Без файла в репозитории достаточно ссылки на story id `screens--project-gantt` и зелёного `verify:storybook-contract`.
