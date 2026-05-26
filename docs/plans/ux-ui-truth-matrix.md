# Матрица честности UI (UX-0)

Экран → элемент → реальное поведение. Обновлять при добавлении affordances.

| Экран | Элемент | Поведение | Статус |
|-------|---------|-----------|--------|
| Planning / Inspector | Вкладки Общие, Зависимости, Ресурсы | Редактирование через preview/apply | OK |
| Planning / Inspector | Добавить FS | `dependency.upsert` | OK |
| Planning / WBS | Indent/outdent | Меню + Ctrl+[ ] | OK |
| Planning / Gantt | Drag bar / resize | Только zoom «День» | OK |
| Planning / Gantt | Shift+клик | Черновик FS → upsert | OK |
| Planning / Apply bar | Применить при stale | Disabled + текст | OK |
| Planning / Remote banner | SSE обновление | Баннер + stale preview | OK |
| Dashboard | Управленческий фокус | Проекты с перегруженными сотрудниками (`overloadProjectIds`, employee-total mix) | OK (live) |
| Dashboard | Свободная ёмкость | `summary.buckets` из capacity API | OK (live) |
| Projects | Портфельная шкала | Timeline strip | OK |
| Projects | Закрытые | Фильтр + ретроспектива | OK (MVP) |
| Resources matrix | Клик по ячейке | ResourceDayDrawer | OK |
| Resources matrix | Перегруз ячейки | `isOverload` от employee-total (`data-overload-source`) | OK |
| Resources matrix | Источник данных | `GET /api/workspace/capacity/tree` | OK |
| Profile | Справка | Статический блок | OK |

Запрещено без реализации: фейковые вкладки, неработающие bulk actions, сортировка без API.
