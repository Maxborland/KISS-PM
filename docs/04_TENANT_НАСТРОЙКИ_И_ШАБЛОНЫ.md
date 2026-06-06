# 04. Tenant-настройки и шаблоны

## Цель

KISS PM должен настраиваться под разные организации без переписывания кода.

## Что настраивается

- Роли и пользовательские labels.
- Процессные шаблоны проекта.
- Стадии, gates, артефакты, approval rules.
- Шаблоны задач.
- Custom fields.
- KPI definitions, formulas, thresholds.
- Control surface definitions.
- Action definitions.
- Access profiles.
- Saved views.
- **Оргструктура** (направления, отделы/команды, привязка сотрудников к должностям).
- Интеграционные настройки.

## Оргструктура tenant

Два параллельных трека (stable keys в БД, labels в UI):

```txt
functional: Направление → Отдел → Должность → Сотрудник
project:    Направление → Команда → Должность → Сотрудник
```

- Должность — справочник `positions`.
- Сотрудник — `tenant_users` + placement в `tenant_user_org_placements`.
- Настройка: `/settings/org-structure`, permissions `tenant.org_structure.read|manage`.
- API: `GET/PUT /api/tenant/current/org-structure`.
- Первый consumer: матрица ресурсов проекта (4 уровня при наличии направлений); фильтры Users — по placements того же трека.
- Tenant-wide отчёт загрузки по оргструктуре — Phase E (см. `docs/38_PHASE_D_PLAN.md`).

## Правило stable key + label

В системе есть стабильный ключ и отображаемая метка.

Пример:

```txt
systemKey: concept_design
tenantLabel: ГЗМПК
```

Код работает с `systemKey`. Пользователь видит `tenantLabel`.

## Версионирование

Версионируются настройки, которые влияют на расчеты и историю:

- process templates;
- KPI formulas;
- thresholds;
- control surface definitions;
- action definitions;
- access profiles, если их изменение влияет на аудит.

## Безопасные builders

Каждый builder обязан иметь:

- preview;
- validation;
- понятные ошибки;
- черновик и публикацию;
- rollback/version history там, где это важно;
- E2E для критичных write-flow.

## Первый template pack

Первым можно сделать template pack для проектно-производственной организации: стадии, роли, задачи, resource pools, KPI и control surfaces. Но это template pack, а не core domain.
