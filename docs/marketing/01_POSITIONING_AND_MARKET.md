# Позиционирование и рынок

## Статус

Документ фиксирует новое positioning direction для KISS PM после исследования AI PM-рынка: агент является основным рабочим слоем, а доверие строится через proposed project diff, human review, partial apply и audit trail.

## Исполнительный вывод

Позиционирование перспективное, но сильным оно становится только в узкой формулировке:

> KISS PM - агентная система управления проектами, где AI готовит проектные изменения, а человек ревьюит и применяет их как diff.

Широкая фраза "agent-first project management" уже быстро насыщается. Asana, monday.com, Jira/Rovo, Linear, Dart, Taskade, Notion и Basecamp двигаются к агентам внутри рабочих систем. Свободнее выглядит не "AI project management", а конкретный workflow:

```txt
чат / агент -> структурированный project diff -> ревью человеком -> частичное применение -> audit trail
```

Именно этот workflow должен стать центральной маркетинговой и продуктовой демонстрацией.

## Короткая позиция

KISS PM помогает управлять проектами через проектного агента: пользователь задает цель, агент диагностирует состояние и готовит структурированные изменения, пользователь принимает все, выбирает отдельные hunks, редактирует или отклоняет, а система применяет решение с проверкой прав и аудитом.

Главная формула:

> Скажите, что нужно проекту. Проверьте, что изменится. Примените только одобренное.

## Рыночная карта

| Категория | Примеры | Что продают | Как KISS PM отличается |
|---|---|---|---|
| Классические work management платформы с AI | Asana AI Teammates, monday agents, ClickUp Brain, Jira/Rovo | AI внутри существующих досок, workflows, задач и отчетов | Агентный цикл является главным интерфейсом, а доски - контекстом |
| AI-native PM / task tools | Dart, Taskade, Height, Linear Agent | Быстрое создание задач, summary, triage, agent automations | Фокус на reviewable project diff и применении изменений с аудитом |
| Agent-operable work systems | Basecamp 5, Linear, Jira MCP/Rovo | Доступ агентов к рабочей системе через API, CLI или MCP | KISS PM проектируется вокруг human review before apply |
| Scheduling assistants | Reclaim, Motion, BeforeSunset AI | Автоматическое планирование календаря и задач | Это соседний слой; KISS PM управляет проектным состоянием, а не только временем |
| Coding-agent UX | Cursor, OpenAI Codex, Devin, GitHub Copilot | Агент меняет код, человек ревьюит diff или pull request | KISS PM переносит доверительный паттерн diff-review в проектное управление |
| Тяжелый PPM / PSA | Planview, Planisware, Meisterplan, Smartsheet, Kantata, Accelo | Портфель, ресурсы, governance, финансовое планирование | KISS PM продает более простой агентный путь от намерения к одобренному изменению |

## Что говорит рынок

- Asana продвигает AI Teammates как агентов внутри work graph, с контекстом, governance и execution across workflows.
- monday.com позиционирует AI agents как сущности, которые мониторят boards, принимают решения в заданных границах и выполняют действия.
- Atlassian Rovo/Jira подчеркивает permissions, workflows и audit trails для approved agent updates.
- Linear Agent работает поверх workspace data и делает chat основным местом перехода от вопроса к drafts и next steps.
- Dart называет себя AI-native PM и показывает AI Chat как способ превращать разговоры в задачи и updates.
- Taskade развивает agents и autonomous project management, но больше в сторону workspace/app builder.
- Basecamp 5 делает продукт agent-accessible через CLI/API/skills, но не занимает project diff review как главную PM-рамку.
- Cursor и Codex уже научили техническую аудиторию доверять агентам через review changes, diff comments, manual edits и apply.

## Наша территория

Самая сильная территория:

> Project management through an agent, with Cursor-like proposed diffs and human approval.

На русском:

> Управление проектами через агента, где каждое важное изменение сначала становится проверяемым project diff.

Это не отменяет старую сильную сторону KISS PM: ресурсы, KPI, Gantt, задачи, control surfaces, права и аудит. Но в лендинге они должны поддерживать агентный loop, а не забирать роль главного интерфейса.

## Позиционирующее утверждение

Для проектных команд, которые устали вручную переводить встречи, риски, задержки и решения в задачи, сроки и статусы, KISS PM является агентной системой управления проектами. Пользователь ставит цель проектному агенту, агент готовит diagnosis и proposed project diff, а человек ревьюит, редактирует и применяет только одобренные изменения с правами и audit trail.

## Конкурентный разрыв

| Capability | У кого есть части | Насколько занят gap |
|---|---|---|
| AI chat / agent в PM | Asana, monday, Jira/Rovo, Linear, Dart, Taskade, Notion | Уже crowded |
| Создание задач из AI | ClickUp, Dart, Notion, Taskade, monday | Уже table stakes |
| Агент может обновлять work items | monday, Jira/Rovo, Linear, Dart | Становится mainstream |
| Permissions / governance | Jira/Rovo, monday, Linear, enterprise tools | Частично занято |
| Structured project diff before apply | Явно у coding tools; в PM не найден как core positioning | Главный opening |
| Partial apply hunks | Сильно ассоциировано с code diff UX | Сильная дифференциация, если реально показать |
| Audit trail каждого agent-applied change | Jira/Rovo близко, KISS PM может сделать это центральным | Реально, но требует продукта |

Вывод: gap не только в словах, если продукт показывает настоящий объект `ProjectDelta` / `PlanDelta`, hunks, before/after, permissions и audit. Если это остается просто красивым экраном, конкуренты быстро догонят messaging.

## Целевые сегменты

### 1. Клиентские агентства и implementation-команды

Боль: много параллельных клиентских проектов, встречи не превращаются в систему, статусы пишутся вручную.

Что спросят у агента: "Подготовь план недели", "Преврати meeting notes в задачи", "Сделай client update".

Почему diff важен: нельзя случайно пообещать клиенту новый срок или scope без ревью.

### 2. Архитектурные, дизайн- и инженерные бюро

Боль: общие старшие специалисты, зависимости стадий, задержки в одном проекте двигают другие.

Что спросят у агента: "Перепланируй после задержки", "Найди, где блокируется дизайн-стадия".

Почему diff важен: изменения сроков, ролей и зависимостей имеют реальные последствия.

### 3. COO / PMO / delivery leads в SMB

Боль: дашборды показывают давление поздно, решения живут в звонках и таблицах.

Что спросят у агента: "Найди риски перед встречей", "Подготовь управленческие действия".

Почему diff важен: нужен human approval, accountability и audit trail.

## Сильнейший угол лендинга

Рекомендуемый angle:

> Run projects through an agent. Approve every change.

На русском:

> Управляйте проектами через агента. Применяйте только одобренные изменения.

Он сильнее, чем "портфельное управление" для первого экрана, потому что сразу объясняет новый способ работы и trust-механизм. Портфель, ресурсы и KPI лучше раскрывать дальше как то, что агент понимает и меняет через reviewable diffs.

## Что можно говорить сейчас

**Безопасно:**
- KISS PM проектируется как agent-first project management system.
- Агент готовит proposed changes, а пользователь ревьюит их перед применением.
- Доски, Gantt, задачи, ресурсы и KPI остаются contextual tools.
- Закрытая альфа проверяет этот workflow с целевыми командами.

**Только если demo реально поддерживает:**
- partial apply hunks;
- редактирование hunks перед применением;
- audit trail каждого примененного изменения;
- replanning после задержки;
- resource-aware proposed changes.

**Избегать:**
- "автономный project manager";
- "AI сам управляет проектами";
- "никогда не сорвете сроки";
- "полностью заменяет Jira/Asana/PM";
- "революционное рабочее пространство все-в-одном".

## Источники для проверки рынка

- Asana AI Teammates: https://asana.com/resources/ai-teammates-overview
- Asana AI Teammates help: https://help.asana.com/s/article/ai-teammates
- Atlassian Rovo/Jira agents: https://www.atlassian.com/blog/rovo/ai-agents-in-jira
- monday AI Agent builder: https://support.monday.com/hc/en-us/articles/33347027353746-Get-started-with-the-monday-AI-Agent-builder
- ClickUp Brain item creation: https://help.clickup.com/hc/en-us/articles/19953994898711-Create-items-with-Brain-AI
- Dart AI project management: https://www.dartai.com/
- Dart AI agents: https://www.dartai.com/ai-agents
- Linear Agent docs: https://linear.app/docs/linear-agent
- Linear changelog: https://linear.app/changelog
- Taskade for project managers: https://help.taskade.com/en/articles/8958678-taskade-for-project-managers
- Notion AI project management: https://www.notion.com/blog/ai-project-management
- Basecamp agent access: https://world.hey.com/dhh/basecamp-becomes-agent-accessible-3ae6b949
- Cursor diff review: https://docs.cursor.com/en/agent/review
- OpenAI Codex app: https://openai.com/index/introducing-the-codex-app/
