# 09. Control surfaces / management instruments

## Определение

Control surface — это управленческая рабочая поверхность, где пользователь видит операционные данные, сигналы, контекст, разрешенные действия и результат.

Это не пассивный отчет.

## ControlSurfaceDefinition

Definition описывает:

- data source;
- entity type;
- view type;
- filters;
- groupings;
- visible fields;
- widgets / KPI cards;
- severity rules;
- drilldowns;
- row/card/bulk/global actions;
- permission requirements;
- saved views;
- audit behavior.

## Типы представлений

- table;
- board / Kanban;
- timeline;
- Gantt;
- heatmap;
- calendar;
- cards;
- dashboard;
- hybrid.

## Стартовый набор surfaces

1. CRM Intake Control.
2. Portfolio Control.
3. Project Delivery Control.
4. Resource Load Control.
5. KPI Deviation Control.
6. My Work Control.
7. Closed Projects Retrospective.
8. Tenant Admin / Configuration Control.

## Конструктор surfaces

Конструктор нужен, но не должен быть хаотичным BI-builder.

Правила:

- guided presets перед blank canvas;
- preview перед публикацией;
- validation ошибок;
- action binding только к разрешенным application commands;
- разделение read model и write command;
- versioning и rollback;
- E2E для published surface с действием.

## Несколько путей действия

Если действие доступно с разных surfaces, оно должно вести к одной command path. UI может быть разным, но permission, validation, audit и side effects должны быть одинаковыми.
