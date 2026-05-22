# 31. Phase 7: Planning workspace UI contract

## Статус

Этот документ фиксирует продуктовый и архитектурный контракт UI поверх Phase 5/6
MS Project-class backend planning engine.

Phase 7 не строит отдельный frontend-движок планирования. Интерфейс является
управляемой рабочей поверхностью над `PlanSnapshot`, `PlanningCommand`,
planning read model, resource load matrix и scenario proposals.

MSPDI/XML import/export не входит в scope. Импорт/экспорт остается будущим
integration adapter, а не частью ядра planning workspace.

## Цель

Пользователь должен уметь создать и сопровождать реальный рабочий график
проекта без скрытых расхождений между таблицей задач, Gantt, resource sheet,
resource matrix и audit.

Рабочая поверхность должна давать:

- MS Project-like project schedule: WBS, даты, длительность, трудоемкость,
  прогресс, constraints, зависимости, critical path и baseline comparison;
- resource sheet: люди, роли, календари, доступность, назначения,
  исключения и резервы;
- resource usage/load matrix: загрузка, свободная емкость, перегрузы и
  drilldown причин;
- scenario planning: explainable варианты решения перегруза или deadline-risk;
- command preview/apply: каждое существенное изменение сначала показывает
  последствия, затем проходит права, preconditions, audit и reload.

## Пользователи

- Проектный менеджер создает WBS, зависимости, baseline, назначения и
  контролирует сроки.
- Resource manager смотрит загрузку людей/ролей, свободную емкость,
  перегрузы, исключения календарей и сценарии выравнивания.
- Руководитель направления видит критический путь, deadline-risk, resource
  conflicts и управленческие решения с audit.
- Исполнитель видит свои задачи через общую task model; task CRUD остается
  удобным фасадом, но не отдельной моделью вне планирования.
- Tenant admin настраивает роли, статусы, календари и права, но не меняет
  доменную логику planning engine через UI.

## Non-scope

- Import/export MS Project, MSPDI, XML, MPP.
- KPI/control signals/action engine, кроме отображения planning risks,
  которые уже возвращает движок.
- Мультипроектное resource leveling как apply-flow. Мультипроектные views
  могут быть read-only reference/future surface.
- Самостоятельный UI-only пересчет дат, critical path, перегрузов или
  baseline variance.
- Копирование BR2 layout как обязательного визуального стиля.
- Fake controls: drag, bulk, export, filters, apply, scenario или calendar edit
  не показываются активными без реального end-to-end сценария.

## Архитектурный принцип

Все planning surfaces читают один backend read model:

```txt
GET /api/workspace/projects/:projectId/planning/read-model
```

Read model содержит:

- `project`;
- `authored.tasks`, `authored.dependencies`, `authored.assignments`,
  `authored.baselines`;
- `calculatedPlan`;
- `baselineComparison`;
- `resourceLoad`;
- `validationIssues`;
- `planVersion`;
- `engineVersion`.

Frontend может хранить только draft overlay для текущего редактирования и
visual preview. Authoritative даты, critical path, resource load, overloads,
free capacity и validation issues приходят из backend.

Любое изменение отправляется как `PlanningCommand`:

```txt
POST /api/workspace/projects/:projectId/planning/preview-command
POST /api/workspace/projects/:projectId/planning/apply-command
```

Scenario proposals используют отдельные endpoints:

```txt
POST /api/workspace/projects/:projectId/planning/scenario-proposals
POST /api/workspace/projects/:projectId/planning/scenario-proposals/:proposalId/apply
```

`apply-command` всегда использует текущий `planVersion`. При stale version UI
показывает conflict state, предлагает reload и не делает silent retry.

## Command mapping

| UI действие | PlanningCommand |
|---|---|
| Создать задачу или подзадачу | `task.create` |
| Переименовать задачу | `task.update_identity` |
| Изменить start/finish из таблицы или Gantt drag/resize | `task.update_schedule` |
| Изменить task type, effort-driven, duration, work | `task.update_work_model` |
| Изменить статус | `task.update_status` |
| Indent/outdent/reorder WBS | `task.move_wbs` |
| Архивировать или удалить задачу | `task.delete_or_archive` |
| Создать/изменить связь FS/SS/FF/SF и lag/lead | `dependency.upsert` |
| Удалить связь | `dependency.delete` |
| Назначить ресурс, роль, units или work | `assignment.upsert` |
| Снять назначение | `assignment.delete` |
| Зафиксировать baseline | `baseline.capture` |
| Добавить исключение календаря | `calendar.exception.upsert` |
| Изменить constraint | `constraint.update` |
| Зарезервировать ресурс | `resource.reserve` |
| Принять перегруз с причиной | `risk.accept_overload` |
| Сдвинуть deadline проекта | `project.deadline.move` |

Task CRUD в обычном task workspace должен пользоваться этим же command layer или
совместимым application service. Нельзя создавать второй путь, который меняет
задачу без пересчета planning read model.

UI labels для типов связей должны быть русскими, но stable value остается
английским:

- ОН / Finish-to-Start -> `FS`;
- НН / Start-to-Start -> `SS`;
- ОО / Finish-to-Finish -> `FF`;
- НО / Start-to-Finish -> `SF`.

## Project schedule workspace

Основной экран проекта строится как синхронизированная рабочая область:

```txt
Toolbar / filters / view presets
  -> WBS grid слева
  -> Gantt timeline справа
  -> Inspector / validation / audit drawer
```

Обязательные режимы:

- `График`: WBS grid + Gantt timeline;
- `Ресурсы`: resource sheet + resource usage/load matrix;
- `Сценарии`: proposals, before/after и apply;
- `Baseline`: сравнение с выбранным baseline и история фиксации.

### WBS grid

Минимальные колонки:

- WBS;
- название;
- статус;
- scheduling mode: `auto` / `manual`;
- task type: `fixed_units`, `fixed_work`, `fixed_duration`;
- effort-driven;
- start;
- finish;
- duration;
- work;
- percent complete;
- predecessors;
- successors;
- assignments;
- constraint;
- calendar;
- baseline start/finish;
- variance;
- validation state.

Таблица должна поддерживать dense режим, sticky header, pinned WBS/title,
resizable columns, keyboard navigation, inline edit через preview и row-level
validation marker.

### Gantt timeline

Timeline обязан показывать:

- summary tasks и обычные tasks;
- task bars с progress overlay;
- planned start/finish и manual/auto visual marker;
- baseline bars;
- critical path;
- non-working time shading из calendars/exceptions;
- dependency lines FS/SS/FF/SF;
- lag/lead label там, где он влияет на чтение графика;
- today line, project bounds и deadline marker;
- validation badges на строках с ошибками.

Gantt drag/resize/dependency drawing не применяет изменения сразу. UI делает
preview command, показывает after-state и только затем позволяет apply.

## Resource sheet

Resource sheet показывает tenant/project resources, которые участвуют в
планировании:

- ресурс: человек, роль/позиция, команда/подразделение;
- calendar;
- working minutes/day и exceptions;
- active/inactive state;
- текущие назначения;
- reserved capacity;
- planned load;
- free capacity;
- overload summary;
- drilldown к задачам и reservations.

Редактирование resource facts разрешается только там, где есть backend command
или application action. Если Phase 7 UI еще не владеет полным управлением
личными календарями сотрудника, такие календари отображаются read-only или
редактируются через отдельный permissioned flow.

Future personal calendars для встреч, отпусков и фокуса должны попадать в этот
же источник занятости как `calendar.exception` или `reservation`. Нельзя
создавать вторую независимую модель занятости, которую resource matrix не
учитывает.

## Resource usage/load matrix

Матрица загрузки использует `resourceLoad` из read model:

- `buckets`;
- `overloads`;
- `freeCapacityBuckets`.

Поддерживаемые bucket-группировки:

- день;
- неделя;
- месяц.

Строки:

- resource;
- role;
- team/department;
- project task group;
- assignment drilldown.

Ячейка показывает числа, а не только цвет:

```txt
planned / available / reserved / free / overload
```

Overload drilldown обязан показывать причины:

- task;
- assignment;
- reservation;
- calendar_exception.

Из overload drilldown пользователь может:

- открыть задачу;
- изменить назначение;
- сдвинуть задачу;
- split/reassign через scenario proposal;
- зарезервировать ресурс;
- принять риск с обязательной причиной.

## Scenario planning UX

Scenario flow начинается из конкретного planning conflict:

```txt
resource overload / deadline risk / validation issue
  -> target
  -> generate proposals
  -> compare
  -> preview apply
  -> governed apply
  -> audit + reload read model
```

Backend возвращает `ScenarioProposal` с:

- `profile`: aggressive, balanced или resilient;
- `conflictEffect`: accepted, reduced или removed;
- `planDelta`;
- explainability: finish date, deadline delta, overload minutes,
  overloaded resources, changed tasks, changed assignments, dependency warnings,
  required approvals и risk score.

UI обязан показывать proposals как сравнимые управленческие варианты, а не как
магическую кнопку "исправить". Пользователь должен видеть цену решения: сдвиг
даты, чей ресурс меняется, какие задачи затронуты, какие approvals нужны и где
остается риск.

## Permissions and audit

Planning workspace использует права Phase 5/6:

- `tenant.projects.read`;
- `tenant.project_plan.read`;
- `tenant.project_plan.manage`;
- `tenant.project_baselines.manage`;
- `tenant.project_resources.read`;
- `tenant.project_resources.manage`;
- `tenant.planning_scenarios.preview`;
- `tenant.planning_scenarios.apply`;
- `tenant.audit_events.read`.

Правила UI:

- read без manage показывает рабочую поверхность read-only;
- forbidden action скрывается или disabled с причиной;
- preview требует право на конкретный command и право чтения плана;
- apply требует manage/apply право, актуальный `planVersion` и required reason;
- audit drawer показывает, кто изменил план, что preview/apply сделал и какой
  `engineVersion` участвовал в расчете.

## Error states

UI должен иметь явные состояния:

- `session_required`: перейти ко входу;
- `permission_denied`: показать forbidden state и недоступное право;
- `project_not_found`: project-level not found;
- `plan_version_conflict`: reload/compare before retry;
- `planning_command_invalid`: подсветить поля команды;
- `planning_precondition_failed`: показать причину и affected tasks/resources;
- dependency cycle / impossible constraint / calendar issue: показать в
  validation panel и на affected rows;
- `accepted_risk_reason_required`: не разрешать apply без причины;
- `persistence_not_configured`: service unavailable/admin state.

## BR2 baseline plus better

Из BR2 берем capability baseline:

- плотные operational tables;
- кастомный Gantt renderer и interaction model как стартовую реализацию,
  которую извлекаем из BR2 и адаптируем под KISS PM;
- resource matrix;
- resource cell drilldown;
- быстрые filters и entry points;
- действия прямо из таблиц/матриц;
- видимость conflicts и перегрузов.

KISS PM должен быть лучше за счет:

- единого planning engine вместо UI-local пересчетов;
- preview/apply с planVersion и audit;
- явного `PlanSnapshot`/read model;
- сценариев aggressive/balanced/resilient с explainability;
- resource calendars/reservations как единого источника занятости;
- отказа от Bitrix-specific naming и hardcoded company logic;
- accessibility, keyboard navigation и clean responsive behavior.

Gantt packages из BR2 являются разрешенным исходным implementation asset для
Phase 7: их можно переносить, выделять в пакет KISS PM и адаптировать. Это
решение принято потому, что Gantt в BR2 был спроектирован как отдельный
кастомный пакет, но остался внутри BR2 codebase.

Архитектурная ревизия границ переноса и WBS table candidates зафиксирована в
`decisions/2026-05-22-br2-gantt-boundaries-wbs-table.md`.

Ограничение остается архитектурным: BR2 Gantt отвечает за rendering,
interaction model, timeline, drag/drop, dependency drawing и visual density, но
не становится источником доменной истины. Даты, dependencies, critical path,
resource load, overloads, scenario proposals, validation и apply-result приходят
из KISS PM planning engine.

WBS table не обязана переноситься из BR2. Табличный слой должен быть
replaceable adapter: если OSS/headless grid дает лучшую virtualization, pinned
columns, resize, keyboard navigation, accessibility и controlled state, его
можно выбрать вместо BR2 WBS table. Первым кандидатом для оценки является
headless table + virtualizer подход, совместимый с текущим React/Next stack.

## Frontend component boundaries

Целевые модули frontend:

- `PlanningWorkspaceRoute`;
- `planningReadModelApi`;
- `planningCommandPreviewApi`;
- `PlanningWorkspaceShell`;
- `WbsGrid`;
- `GanttTimeline`;
- `TaskInspector`;
- `DependencyEditor`;
- `AssignmentEditor`;
- `ResourceSheet`;
- `ResourceLoadMatrix`;
- `ResourceCellDrilldown`;
- `ScenarioPanel`;
- `BaselineComparisonPanel`;
- `PlanningValidationPanel`;
- `PlanningAuditDrawer`.

Компоненты должны быть controlled от read model + draft overlay. Дублирование
расчета schedule/resource load внутри компонентов запрещено.

## Implementation slices

### Slice UI-A. Read model client and route shell

Цель: project planning route, query state, permissions, loading/error/forbidden,
planVersion/engineVersion banner.

Exit gate: пользователь открывает planning workspace и видит synchronized
read-only WBS/resource summary из backend read model.

### Slice UI-B. WBS grid and task inspector

Цель: dense WBS grid, task inspector, validation markers, inline preview для
identity/schedule/work model/status.

Exit gate: изменение задачи проходит preview/apply/reload/audit и не расходится
с обычным task workspace.

### Slice UI-C. Gantt timeline

Цель: timeline rendering, task bars, dependencies, critical path, baseline bars,
calendar shading, drag/resize/dependency preview.

Exit gate: Gantt не содержит UI-only apply; каждое изменение идет через
PlanningCommand.

### Slice UI-D. Resource sheet and matrix

Цель: resource sheet, day/week/month load matrix, overload/free capacity,
drilldown reasons.

Exit gate: перегруз из backend `resourceLoad` виден, объясним и связан с
задачами/назначениями/reservations/calendar exceptions.

### Slice UI-E. Scenario proposals

Цель: generation, cards compare, before/after, apply with required approvals and
risk reason.

Exit gate: overload drilldown запускает proposals, apply пересчитывает plan и
пишет audit.

### Slice UI-F. Baseline, audit and hardening

Цель: baseline capture/comparison, audit drawer, stale version conflicts,
permission negatives, browser visual QA, performance budgets.

Exit gate: workspace проходит E2E на create/edit dependency/resource/scenario,
не имеет fake controls и держит крупный проект без layout collapse.

## Acceptance criteria

1. Пользователь создает задачу в WBS grid, preview видит affected schedule,
   apply увеличивает `planVersion`, audit содержит planning event.
2. Пользователь меняет duration/work/task type, а UI показывает пересчитанные
   dates/resource load только после backend preview/read model.
3. Пользователь создает зависимости FS/SS/FF/SF с lag/lead, cycle блокируется
   validation issue.
4. Пользователь фиксирует baseline и видит baseline bars/variance.
5. Resource manager видит overload в matrix, открывает drilldown причин и
   запускает scenario proposal.
6. Пользователь применяет balanced scenario, получает recalculated matrix,
   changed tasks/assignments и audit.
7. Stale `planVersion` не перезаписывает чужие изменения.
8. Пользователь без manage прав видит read-only план и объясненные disabled
   actions.
9. Личные календарные занятости, когда появятся, попадают в matrix как
   exceptions/reservations, а не как отдельный расчет.
10. Browser E2E проверяет desktop/tablet/narrow layout: текст не перекрывается,
    timeline/matrix остаются читаемыми, critical actions доступны.

## Open decisions before implementation

- File-level BR2 Gantt extraction plan and final package namespace.
- Минимальная глубина keyboard shortcuts для первой UI-фазы.
- Будет ли Phase 7 редактировать personal calendars или только читать
  exceptions/reservations из существующего источника.
- Границы portfolio/multiproject planning view в первой реализации.
- Нужен ли отдельный saved view/preset layer до Control Surfaces Builder.
- Performance target для числа задач/назначений на один проект в browser smoke.
