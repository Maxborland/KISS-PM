# MS Project: архитектура реализации для KISS PM

Этот документ фиксирует архитектурные уроки из MS Project-class planning systems.

## Scheduling engine

Scheduling engine должен быть чистым доменным модулем без UI, API и базы. Он принимает план, календарь, зависимости, assignments и constraints, возвращает рассчитанное состояние и validation issues.

## Deterministic calculations

Расчеты должны быть воспроизводимыми. Один и тот же input дает один и тот же output. Это обязательно для unit tests и аудита.

## Read/write separation

Gantt UI показывает read model. Изменения идут через commands: shift task, change dependency, update assignment, capture baseline. Команда проверяет права и пишет audit.

## CPM и critical path

Critical Path Method требует графа задач, расчетов earliest/latest start/finish и slack. Это отдельный roadmap block после MVP.

## Resource leveling

Resource leveling не должен быть магической автокнопкой без объяснения. KISS PM должен показывать preview: какие задачи сдвигаются, какие риски появляются, что изменится в KPI и deadline.

## MSPDI/XML

Import/export MS Project полезен как future integration adapter. Он не должен менять внутреннюю модель на MS Project-specific core. Внутри KISS PM остается canonical project/task/assignment model.

## View architecture

Table, Gantt, timeline, workload matrix и Kanban должны быть views над общими моделями. Нельзя создавать отдельные сущности только потому, что view выглядит иначе.

## Минимальный путь

1. Gantt MVP: WBS, dates, duration, work, assignments, FS dependency, baseline.
2. Calendar-aware scheduling.
3. Dependency variants and lag/lead.
4. Work/Duration/Units recalc.
5. Critical path.
6. Resource leveling preview.
7. MSPDI import/export adapter.
