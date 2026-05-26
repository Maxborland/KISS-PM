# Каталог состояний design-v3

Единая таксономия для пустых, загрузочных, ошибочных и запретных состояний в KISS PM.

## Уровни размещения (L1–L4)

| Уровень | Контекст | Пример |
|---------|----------|--------|
| **L1** | Inline в строке таблицы, ячейке, компактной панели | «Нет строк» в таблице |
| **L2** | Панель / карточка / drawer body | Скелетон инспектора |
| **L3** | Секция страницы под `PageIntro` | Пустой список задач |
| **L4** | Полноэкранное продуктовое состояние (осознанно просторное) | Первый вход без данных |

BEM-модификатор: `state-empty--l3`, `state-illu--l3`, `loading-state--l3`.

## Примитивы vs продуктовые экраны

| Слой | Storybook | Shell |
|------|-----------|-------|
| Примитивы | `Catalog/All Components` — naked canvas | Нет |
| Продукт | `Screens` → «Состояние · …» | `WorkspaceChrome` + sidebar + topbar |

Не использовать `variant: "bare"` для продуктовых state-экранов.

## Компоненты

| Компонент | Назначение | Уровень по умолчанию |
|-----------|------------|----------------------|
| `EmptyState` | Нет данных, мягкий CTA | L3 |
| `ForbiddenState` | 403 / RBAC | L3 |
| `IlluState` | Иллюстративное пустое | L3 |
| `ErrorState` | Ошибка API / сеть + словарь | L3 |
| `LoadingState` | Текст + layout-скелетон | L3 |

### Скелетоны (shimmer)

Анимация: класс `.skeleton` — градиент `skeleton` keyframes, **не** `pulse`.

| Компонент | Layout |
|-----------|--------|
| `SkeletonTable` | Таблица / список |
| `SkeletonBento` | Дашборд bento |
| `SkeletonGantt` | Дерево + таймлайн |
| `SkeletonDrawer` | Правая панель 380px |

`LoadingState` принимает `layout`: `generic` | `table` | `bento` | `gantt`.

## Словарь ошибок

Модуль: `apps/web/src/components/ui/error-dictionary.ts`.

| Ключ | Заголовок | CTA |
|------|-----------|-----|
| `network` | Нет соединения | Повторить |
| `400` | Некорректный запрос | Вернуться |
| `401` | Сессия истекла | Войти |
| `403` | Доступ запрещён | В поддержку |
| `404` | Не найдено | К списку |
| `409` | Конфликт данных | Обновить |
| `422` | Данные не приняты | Исправить |
| `500` | Сбой сервера | Повторить |
| `502` | Сервис недоступен | Повторить |
| `503` | Технические работы | Повторить |

Использование:

```tsx
<ErrorState
  errorKey="500"
  correlationId={requestId}
  onRetry={() => refetch()}
  onSupport={() => openSupport(requestId)}
/>
```

`correlationId` отображается как `ID обращения: …` (класс `state-illu__correlation`).

Хелперы: `errorKeyFromStatus(status)`, `formatErrorCorrelationId(id)`.

## Storybook-сценарии

Экраны `state-*` участвуют в toolbar «Сценарий» (`ScenarioProvider`):

- `happy` — нормальный контент (для state stories — целевое состояние);
- `loading` / `error` / `empty` / `forbidden` — через `resolveStateScreenKind`.

## Проверки

```bash
pnpm --filter @kiss-pm/web verify:storybook-contract
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/web test
```
