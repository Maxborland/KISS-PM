# Гипотезы ценообразования и упаковки

## Статус

Ценообразование находится на стадии исследования. Лендинг закрытой альфы показывает заявку на доступ; публичные цены появятся после отдельного pricing decision и проверки agent-first value.

## Текущая публичная позиция

Для лендинга:

> Закрытая альфа. Запросите доступ, и мы свяжемся с вами, когда будем готовы показать agent-first workflow.

Публично не обещаем:

- free forever;
- точную production price;
- enterprise SLA;
- migration guarantees;
- unlimited everything;
- автономное управление проектами без человека;
- ROI или экономию часов без доказательств.

## Ценностный взгляд на ценообразование

Ценность KISS PM растет с:

- количеством проектных изменений, которые сейчас проходят вручную;
- частотой встреч, задержек, клиентских обновлений и replanning;
- количеством людей, участвующих в ревью и применении проектных изменений;
- сложностью зависимостей, ресурсов и approval;
- потребностью в audit trail;
- требованиями к self-hosted, data control и security;
- ценой ошибки при silent automation или неверном переносе сроков.

Старый portfolio scale остается важным, но новый value metric должен учитывать agent runs и approved changes, а не только количество проектов или seats.

## Кандидаты на метрики ценности

| Метрика | Плюсы | Риски |
|---|---|---|
| Per workspace / tenant base | Просто объяснить, хорошо для self-hosted | Может не отражать интенсивность agent usage |
| Per active project band | Совпадает с PM-категорией | Слабее отражает meeting-to-change value |
| Per planning / manager seat | Связано с людьми, которые ревьюят изменения | Может мешать приглашать stakeholders |
| Запуски агента, включенные в план | Хорошо связано с agent-first ценностью | Нужно аккуратно объяснять лимиты |
| Applied changes / audit volume | Близко к ценности и trust | Может звучать как налог на использование |
| Hybrid base + projects + agent runs | Баланс ценности и понятности | Требует простого packaging |
| Индивидуальный enterprise / self-hosted | Подходит для governance и data control | Требует sales process |

Рекомендуемая research hypothesis:

> Base platform fee + active project band + included agent runs, с enterprise/self-hosted package для governance-heavy команд.

## Гипотезы упаковки

### Закрытая альфа

Цель: learning, demo validation и design partners.

Возможная структура:

- ограниченное число участников;
- прямой onboarding;
- фокус на 2-3 core workflows: weekly plan, delay replanning, meeting-to-update;
- explicit feedback expectation;
- публичная цена позже;
- production SLA только по отдельному соглашению;
- разрешение использовать обезличенные learnings, если юридически допустимо.

### Будущий командный план

Для команд, которые хотят agent-first workflow на нескольких проектах.

Возможности:

- project agent;
- agent runs;
- proposed project diff;
- accept all / accept selected / reject;
- basic tasks, dates, owners, comments;
- basic audit trail;
- manual project views.

### Будущий Delivery / Portfolio

Основной план для целевой аудитории.

Возможности:

- все из командного плана;
- Gantt/WBS context;
- resource-aware proposed changes;
- KPI/control signals;
- scenario proposals;
- governed actions;
- tenant settings;
- audit viewer;
- saved views / contextual surfaces.

### Будущий Enterprise / Self-hosted

Для организаций с требованиями к данным, security и governance.

Возможности:

- self-hosted deployment;
- advanced access profiles;
- SSO;
- audit exports;
- custom templates and surfaces;
- integration support;
- priority support;
- deployment runbooks;
- policy controls для agent actions.

## Вопросы для исследования цены

Спрашивать prospects:

1. Сколько проектных изменений в неделю сейчас рождается из встреч, писем и задержек?
2. Кто обычно переносит эти изменения в PM-систему?
3. Сколько времени уходит на weekly plan, status update и replanning?
4. Где ошибка изменения стоит дороже всего: срок, владелец, dependency, клиентское сообщение, ресурс?
5. Что должно быть видно перед применением AI-предложения?
6. Сколько людей должны ревьюить или утверждать изменения?
7. Как вы относитесь к лимитам agent runs?
8. Что логичнее для pricing: seats, active projects, agent runs или workspace package?
9. Какие capabilities требуют enterprise/self-hosted package?
10. При какой цене продукт кажется слишком дорогим? При какой - подозрительно дешевым?

## Рекомендации для будущей страницы цен

Когда появится публичный pricing:

- объяснить, кто подходит каждому плану;
- не делать много tiers;
- показать recommended plan;
- связать pricing с agent workflow, а не только seats;
- объяснить included agent runs простым языком;
- включить FAQ по active projects, agent runs, audit storage, self-hosted, support, migration и data security;
- не прятать trust capabilities только в enterprise, если они являются core differentiator.

## Заметка о цене в alpha-форме

В первой форме лендинга бюджет не спрашивать. Сначала собрать:

- роль;
- количество параллельных проектов;
- частоту ручных project updates;
- самый болезненный workflow;
- важность approval/audit.

Цену обсуждать на discovery calls после того, как человек понял proposed diff workflow.
