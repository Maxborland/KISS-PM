# 08. KPI, сигналы и действия

## KPI не является декоративной карточкой

KPI в KISS PM нужен, чтобы выявить состояние, создать control signal и привести пользователя к governed action.

## KpiDefinition

KPI definition содержит:

- entityType;
- formula;
- unit;
- period;
- threshold rules;
- owner role;
- severity mapping;
- allowed actions;
- version.

## Formula safety

Формулы не могут быть произвольным JavaScript, SQL или пользовательским кодом. Нужен constrained expression language, валидация, preview и тестовые примеры.

## KpiEvaluation

Результат KPI должен быть traceable:

- definition version;
- formula version;
- source data;
- period;
- threshold;
- calculated value;
- severity;
- evaluation timestamp.

## ControlSignal

Control signal создается, когда KPI, ресурс, schedule, project lifecycle или approval state требует внимания.

Сигнал содержит:

- source entity;
- source metric;
- severity;
- explanation;
- owner/assignee;
- allowed actions;
- опциональные `ScenarioProposal` для schedule/resource conflicts;
- lifecycle state;
- links to audit/actions.

## ManagementAction

Management action — управляемое действие, которое может менять состояние.

Каждое действие обязано иметь:

- label и описание;
- target entity;
- required permission;
- preconditions;
- input schema;
- dry-run/preview для рискованных изменений;
- command binding;
- audit policy;
- post-action refresh.

## CorrectiveAction

Corrective action — задача/инициатива, созданная для исправления отклонения. Она связана с source signal, actor, responsible user, сроками, статусом и результатом.

## Разрешенные действия

- create task;
- create corrective action;
- open Gantt;
- reserve capacity;
- reassign resource;
- shift task dates;
- split work;
- generate planning scenarios;
- apply selected planning scenario;
- request explanation;
- escalate;
- accept risk with reason;
- create approval request;
- change lifecycle stage;
- update KPI target when authorized.
