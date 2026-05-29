# Контент, SEO и AI discovery

## Цель

Построить discoverability вокруг новой категории, которую KISS PM хочет занять:

> управление проектами через агента с proposed project diff, human review, partial apply и audit trail.

Контент должен поддерживать:

- спрос на закрытую альфу;
- объяснение новой категории;
- сравнение с классическими PM tools и AI add-ons;
- AI/LLM citation readiness;
- sales enablement для скептичных операционных лидеров.

## Принципы контента

1. Механизм важнее манифеста: показывать workflow, hunks и audit.
2. Русский язык по умолчанию; английские термины использовать только для устойчивого поиска и UX-метафор.
3. Не продавать "PM с AI"; продавать безопасный путь от намерения к изменению проекта.
4. "Best tools" и comparison pages запускать после появления сильного demo proof.
5. Каждая страница должна показывать конкретный пример: запрос агенту -> proposed diff -> apply/audit.

## Контентные опоры

### 1. Агентное управление проектами

Главная идея: PM-интерфейс смещается от досок и отчетов к разговору, ревью и действию.

Темы:

- Что такое agent-first project management.
- Почему AI-чат поверх задач не решает проблему управления.
- Как проектный агент помогает двигать работу вперед.
- Чем agent workflow отличается от automation.
- Почему AI в PM должен показывать изменения до применения.

### 2. Project diff и human approval

Главная идея: доверие к агенту строится не на обещаниях, а на reviewable diff.

Темы:

- Что такое project diff в управлении проектами.
- Как работает partial apply для проектных изменений.
- Почему proposed changes лучше silent automation.
- Как ревьюить задачи, сроки, владельцев и зависимости до применения.
- Как audit trail делает AI-действия проверяемыми.

### 3. Практические проектные моменты

Главная идея: агент должен помогать в конкретных ситуациях, где сейчас много ручной работы.

Темы:

- Как перепланировать проект после задержки.
- Как превратить meeting summary в project update.
- Как подготовить план проекта на неделю.
- Как найти блокеры перед клиентской встречей.
- Как подготовить client status без ручного сбора всех статусов.

### 4. Ресурсы, Gantt, KPI и портфель как контекст агента

Главная идея: classic PM surfaces остаются важными, но становятся контекстом для agent run.

Темы:

- Как проектный агент должен учитывать Gantt и зависимости.
- Как агент может увидеть ресурсный конфликт до срыва.
- Почему KPI-сигнал должен вести к proposed action.
- Как дашборды становятся context surfaces, а не основным workflow.
- Как управлять несколькими проектами через agent review loop.

### 5. Governance, self-hosted и безопасность AI-действий

Главная идея: чем больше агент может подготовить, тем важнее права, approval и аудит.

Темы:

- Почему AI-агенту в PM нужны permission checks.
- Что должно быть в audit trail agent-applied changes.
- Human-in-the-loop в проектном управлении.
- Self-hosted управление проектами для команд с требованиями к данным.
- Как не превратить AI PM в governance risk.

## SEO-кластеры

| Кластер | Примеры запросов |
|---|---|
| Agent-first PM | agent-first project management, AI project manager, AI project management, агентное управление проектами |
| Project diff | project diff, proposed changes, approval workflow, human in the loop AI |
| Meeting to tasks | meeting notes to tasks, meeting summary project update, задачи из протокола встречи |
| Replanning | перепланирование проекта, project replanning, перенести сроки проекта, dependency management |
| Resource-aware planning | resource planning, resource capacity planning, загрузка ресурсов проекта |
| Governance | audit trail, AI approval workflow, permission checks, self-hosted project management |
| Comparisons | KISS PM vs Jira, AI PM tools, Cursor for project management, alternatives to ClickUp/Asana |

## Структура для AI discovery

Для AI/LLM citation страницы должны содержать самостоятельные direct answer blocks.

### Шаблон блока определения

**Что такое agent-first project management?**

> Agent-first project management - это подход, где главным рабочим интерфейсом становится проектный агент. Пользователь задает цель или проблему, агент анализирует проектный контекст и готовит proposed changes, а человек ревьюит и применяет только одобренные изменения.

### Project diff definition

**Что такое project diff?**

> Project diff - это структурированный набор предлагаемых изменений проектного состояния: новые задачи, перенос сроков, смена владельца, зависимости, риски, комментарии или сообщения. В KISS PM diff показывается до применения, чтобы пользователь мог принять все, выбрать отдельные hunks, отредактировать или отклонить.

### Блок карты категории

| Подход | Что делает | Где KISS PM расширяет workflow |
|---|---|---|
| Task tracker | Показывает задачи и статусы | Агент готовит изменения задач и сроков на ревью |
| BI-дашборд | Показывает метрики | Сигнал превращается в proposed action |
| Automation | Выполняет заранее заданное правило | Агент готовит contextual diff, человек применяет |
| AI chat | Отвечает текстом | Ответ превращается в structured project diff |
| KISS PM | Агент -> diff -> review -> apply -> audit | Это основной workflow |

### FAQ block template

**KISS PM - это AI-чат для задач?**

Нет. AI-чат может быть способом разговора, но ключевой механизм KISS PM - proposed project diff. Агент не просто отвечает текстом, а готовит изменения проектного состояния, которые пользователь ревьюит перед применением.

## Рекомендуемая дорожная карта контента

### Первые 30 дней

1. Опубликовать agent-first лендинг.
2. Сделать cornerstone article: `Что такое agent-first project management`.
3. Подготовить demo article: `Как project diff меняет управление проектами`.
4. Написать founder essay: `Почему AI не должен молча менять проект`.

### Дни 31-60

1. Опубликовать статью: `Как превратить meeting summary в project update`.
2. Опубликовать статью: `Как перепланировать проект после задержки через proposed diff`.
3. Создать glossary pages: `project diff`, `hunk`, `audit trail`, `management action`.
4. Сделать alpha demo page вокруг сценария: `задержка -> agent run -> diff -> audit`.

### Дни 61-90

1. Осторожно запустить comparison pages: `KISS PM vs AI chat in Asana`, `KISS PM vs ClickUp Brain`, `KISS PM vs Jira AI agents`.
2. Создать lead magnet: `Чеклист доверия к AI-агенту в проектном управлении`.
3. Создать lightweight tool: `Оцените, сколько ручных project updates делает команда`.
4. Обновить `.agents/product-marketing.md` по языку alpha calls.

## Готовность к programmatic SEO

Будущие pSEO patterns:

- `[ситуация] + project diff`: задержка, встреча, клиентский статус, handoff;
- `[роль] + AI project management`: PM, COO, PMO, resource manager;
- `[tool] + AI approval workflow`: Jira, Asana, ClickUp, Bitrix24;
- glossary pages по agent workflow;
- integration pages для Jira, Bitrix24, MS Project, Slack, CRM.

Генерировать страницы at scale можно только после:

1. стабильного public positioning;
2. реального demo или screenshots;
3. уникального примера на каждой странице;
4. понятного conversion path.

## Проверка качества SEO-страницы

Каждая страница должна иметь:

- один понятный search intent;
- direct answer в первых 80 словах;
- русский heading structure;
- один конкретный agent prompt;
- пример proposed diff;
- объяснение review/apply/audit;
- FAQ на 3-5 вопросов;
- дату обновления;
- ограничения claims;
- ссылку на заявку в закрытую альфу.
