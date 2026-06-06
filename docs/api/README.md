# API-документация KISS PM

Эта папка фиксирует frontend-facing контракт backend API. Цель — чтобы фронт мог
собирать экраны по понятным сценариям, не читая route handlers и persistence-код.

## Интерактивная документация

Backend публикует:

- `GET /api/openapi.json` — OpenAPI 3.1 документ для машинного чтения.
- `GET /api/docs` — Scalar API Reference поверх этого OpenAPI документа.

Scalar используется как интерактивная справка и быстрый способ проверить payload,
headers и ответы. Human docs в этой папке объясняют workflow, permission/error
семантику и экранные recipes, которые OpenAPI не умеет выразить достаточно ясно.

## Как фронту читать контракт

1. Начать с `00_FRONTEND_API_CONVENTIONS.md`.
2. Найти нужный модуль в Scalar `/api/docs`.
3. Для сложных экранов читать `07_FRONTEND_SCREEN_RECIPES.md`.
4. Если route есть в коде, но нет в OpenAPI/Scalar, это дефект API-контракта.
5. Статус глубины схем смотреть в `99_COVERAGE_LEDGER.md`.

## Статус покрытия

Первый слой OpenAPI покрывает все реализованные backend routes как route inventory:
method, path, tags, auth expectation, common errors, path params, mutation guard и
generic JSON/file/event-stream responses.

Следующий уровень покрытия углубляет каждый модуль до точных request/response схем:

- Auth/profile/workspace.
- CRM/projects/tasks.
- Planning/Gantt/resources/auto-solver.
- Capacity/KPI/control.
- Storage/search/documents.
- Collaboration/calls/calendar/occupancy/background jobs.

Новые backend endpoints должны добавляться вместе с OpenAPI записью и human-doc
заметкой, если endpoint участвует в frontend workflow.
