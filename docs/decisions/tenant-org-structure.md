# ADR: Tenant org structure

## Контекст

Tenant-wide оргструктура с двумя треками (functional / project) используется в настройках, матрице ресурсов проекта и (Phase E) tenant-wide отчётах.

## Решения

### 1. Составной первичный ключ узлов

`tenant_org_nodes` имеет `PRIMARY KEY (tenant_id, id)`.

- FK `parent_id` и placement ссылаются на `(tenant_id, node_id)`.
- Один и тот же `id` допустим в functional и project **внутри одного PUT**, но не между tenant’ами.
- Миграция: `0027_tenant_org_nodes_composite_pk.sql`.

### 2. Shared package `@kiss-pm/tenant-org-structure`

- Типы, graph helpers, `validateOrgStructureReplace`, `isPlacementConsistentWithNodes`.
- Persistence и web импортируют один контракт; read/write инварианты не расходятся.

### 3. PUT replace-all

Полная замена snapshot (оба трека) в одной транзакции. Patch API не в Phase D.

### 4. Конкурентное редактирование

Last-write-wins. UI не перезаписывает локальный черновик при refetch, пока `isDraftDirty`.

**Отложено (Phase E+):** `updated_at` / etag / 409 conflict.

### 5. Phase E — tenant resource load

Агрегация загрузки по tenant должна использовать тот же org-grouping модуль, что и `computeOrgMonthlyResourceMatrix`, вынесенный в shared/server package — не дублировать формулы в UI-only коде.

## Последствия

- Импорт оргструктуры между tenant’ами требует remap id.
- Неконсистентные legacy placement (до ужесточения validation) отфильтровываются на read-path; пересохранение оргструктуры очищает данные.
