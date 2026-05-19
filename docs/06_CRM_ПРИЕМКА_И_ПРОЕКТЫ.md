# 06. CRM, приемка и проекты

## CRM как вход в управление проектом

CRM opportunity — начало проектного контура, а не отдельный sales-only модуль.

## Opportunity

Opportunity содержит:

- клиента и контакт;
- категорию/тип проекта;
- желаемые даты;
- ожидаемый объем;
- вероятность/статус;
- коммерческие параметры;
- custom fields;
- external mapping, если opportunity пришла из CRM-адаптера.

## Intake readiness

Система должна показать, готова ли opportunity к проектной оценке.

Blockers:

- нет обязательных дат;
- нет категории проекта;
- нет template match;
- недостаточно данных для demand forecast;
- нет доступной емкости;
- конфликт с уже зарезервированными ресурсами;
- пользователь не имеет права создать draft или резерв.

## Demand forecast

Demand forecast рассчитывает ожидаемую работу по ролям, стадиям и периодам. Источники:

- выбранный process template;
- исторические closed-project snapshots;
- ручные параметры;
- tenant defaults.

## Project draft

Project draft создается до активного проекта. Он нужен, чтобы согласовать структуру, роли, даты, стадии, резервы и риски.

В текущей реализации Project draft хранится как `Project.status = "draft"`, а не как отдельная runtime-сущность. Активный проект — тот же `Project` после governed transition в `status = "active"`.

Draft должен уметь:

- ссылаться на opportunity;
- жить без внешней CRM;
- хранить выбранный template;
- иметь предварительный Gantt/WBS;
- показывать blockers и readiness;
- переходить в active project через governed action.

## Active project

Active project содержит lifecycle state, стадии, задачи, артефакты, назначения, baseline, KPI, control signals и audit trail.

## Правило project lifecycle

Стадия не закрывается, если обязательные артефакты, approvals или quality gates не выполнены. Override возможен только с правом и причиной.
