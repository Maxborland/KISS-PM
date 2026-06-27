# MS Project: модель планирования для KISS PM

Этот документ фиксирует, какие идеи из MS Project важны для будущего scheduling engine KISS PM.

## Базовый треугольник

Ключевая формула:

```txt
Work = Duration * Units
```

Для полноценного планирования нужно понимать, что изменение одного параметра может пересчитывать другой.

## Типы задач

- Fixed Units — фиксированы единицы назначения, меняется duration или work.
- Fixed Work — фиксирован объем работы, меняются duration или units.
- Fixed Duration — фиксирована длительность, меняются work или units.

## Effort-driven behavior

Если задача effort-driven, добавление ресурса может сокращать duration при сохранении work. Это не нужно в первом MVP, но должно быть заложено в roadmap.

## Dependencies

Полный набор зависимостей:

- FS: finish-to-start;
- SS: start-to-start;
- FF: finish-to-finish;
- SF: start-to-finish.

Также нужны lag/lead.

## Calendars

Scheduling должен учитывать рабочие календари, выходные, праздники, исключения, availability и tenant-specific рабочие режимы.

## Constraints

Нужны ограничения: start no earlier than, finish no later than и аналогичные правила. Constraints должны давать validation warnings, а не молча ломать план.

## Critical path

Critical path нужен для понимания задач, влияющих на дату завершения проекта. Это future requirement после Gantt MVP.

## Scenario planning поверх MS Project-like модели

MS Project-like scheduling дает расчет допустимости, дат, критического пути, перегрузов и влияния изменений. KISS PM должен использовать эти расчеты для scenario planning: предлагать не один автоплан, а несколько explainable вариантов с разным профилем риска.

- Aggressive — раньше завершить или удержать дедлайн ценой видимых перегрузов.
- Balanced — удержать дедлайн и минимизировать перегрузы.
- Resilient — убрать перегрузы и показать честный сдвиг дедлайна.

Scenario planning не заменяет Work / Duration / Units, calendars, constraints и critical path. Это слой выбора управленческого компромисса над ними.

## Для первой версии KISS PM

В первой реализации достаточно WBS, дат, duration, planned work, assignments, FS dependencies и baseline basics. Но архитектура не должна блокировать будущие Work/Duration/Units, calendars, constraints, critical path и scenario planning proposals.
