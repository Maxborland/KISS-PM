# ADR: ProjectDraft через статус Project

Дата: 2026-05-19.

## Статус

Принято.

## Контекст

Canonical docs требуют явный шаг:

```txt
CRM opportunity -> intake / feasibility -> project draft -> active project
```

При этом для текущей реализации пользователь уже уточнил, что draft и active не должны быть разными runtime-сущностями, если отличие состоит в статусе и видимости в рабочей зоне.

## Решение

`ProjectDraft` реализуется как единая сущность `Project` со статусом:

- `draft` — проектный черновик;
- `active` — проект в рабочей зоне;
- будущие статусы: `paused`, `closed`, `cancelled`.

Отдельная таблица `project_drafts` и отдельный aggregate сейчас не вводятся.

## Правила lifecycle

1. Draft хранится в таблице `projects` с `status = "draft"` и `activatedAt = null`.
2. Active project хранится в той же таблице с `status = "active"` и заполненным `activatedAt`.
3. `/api/workspace/projects` возвращает только `active` проекты, то есть draft не попадает в боевую рабочую зону.
4. Draft не участвует в расчете занятых часов ресурсной проверки. Резерв capacity в Phase 3 дает только `active` project.
5. Activation является governed action: backend permissions, final capacity recheck, tenant resource lock, audit.
6. Activation переводит draft в active, конвертирует source opportunity в `converted` и сохраняет single-use правило: одна opportunity не может породить несколько проектов.
7. Старый endpoint `POST /api/workspace/opportunities/:id/activate` остается совместимым для Phase 3 UI, но внутри проходит через draft lifecycle: create draft -> activate draft.

## Почему не отдельный ProjectDraft aggregate

На текущей фазе отдельный aggregate добавил бы миграционный и API/UI overhead без новой пользовательской ценности. Для Phase 4/5 нам важнее единая модель проекта, задач, Gantt, ресурсов и audit, где draft отличается правилами готовности и видимости, а не другой сущностью.

## Последствия

- Project lifecycle можно расширять без миграции из `project_drafts` в `projects`.
- Будущая проектная зона может добавить отдельный экран `Черновики проектов`, не меняя storage model.
- Нужно внимательно держать фильтры: active working zone, capacity reservations и dashboards не должны случайно считать draft как активный проект.
- Если в будущем draft получит принципиально другую модель данных, решение можно пересмотреть отдельным ADR.

## Acceptance evidence

- Persistence tests фиксируют создание draft, `activatedAt = null`, transition `draft -> active` и single-use.
- API DB tests фиксируют, что `/api/workspace/projects` не возвращает draft.
- Audit для `project.activated` получает `beforeState.status = "draft"` и `afterState.status = "active"`.
