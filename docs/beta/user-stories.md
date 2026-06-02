# KISS PM: user stories beta

User story считается принятой только если названы экран, runtime data contract, состояния, permissions и QA proof.

## CEO / Owner

### CEO-01: Обзор рисков портфеля

Как CEO, я хочу видеть активные проекты с просрочками, блокерами, перегрузом и финансовыми рисками, чтобы вмешаться до эскалации клиента.

Acceptance:

- Screen: `/dashboard` или control surface.
- Data: активные проекты, вехи, просроченные задачи, блокеры, нагрузка владельцев, финансовый статус если доступен.
- States: loading, empty, no risks, API error, forbidden.
- Actions: открыть проект, отфильтровать риск, назначить или обсудить recovery action.
- QA: seeded at-risk project виден в runtime smoke.

### CEO-02: Прозрачность pipeline

Как CEO, я хочу видеть стадии сделок и вероятные старты проектов, чтобы понимать будущую загрузку и выручку.

Acceptance:

- Screen: `/deals`.
- Data: стадия, вероятность, ожидаемый старт, клиент, владелец, бюджет если доступен.
- Actions: открыть сделку, изменить стадию если разрешено, проверить готовность handoff.
- QA: read-model не требует неиспользуемых каталогов и permissions.

### CEO-03: Агентская сводка срочного

Как CEO, я хочу спросить агента, что требует внимания сегодня, чтобы получить приоритетный список без ручного обхода всех экранов.

Acceptance:

- Agent context: workspace, роль, доступные проекты и attention items.
- Output: список с проектами, причиной, severity и следующим действием.
- Safety: нет мутации без confirmation.
- QA: mocked или runtime test отклоняет неграундированный ответ.

## Sales

### SALES-01: Захват клиента и запроса

Как sales user, я хочу создать клиента и сделку с заметками и следующим шагом, чтобы запрос не потерялся.

Acceptance:

- Screen: `/directories/clients` и `/deals` create flow.
- Required: client name, deal title, owner, stage, next action.
- States: validation, duplicate hint, save error.
- QA: Playwright create flow.

### SALES-02: Управление стадией сделки

Как sales user, я хочу двигать сделку по стадиям и видеть следующий шаг, чтобы pipeline был рабочим.

Acceptance:

- Screen: `/deals`.
- Actions: change stage, next action/date, open detail.
- Data: stage persists, activity/audit visible.
- QA: stage change persists after reload.

### SALES-03: Handoff в проект

Как sales user, я хочу передать выигранную сделку в проект с контекстом, чтобы PM не начинал discovery заново.

Acceptance:

- Screen: deal detail / create project from deal.
- Data: client, scope notes, dates, commitments, risks, contacts.
- QA: API/read-model proves project contains handoff context.

## Project Manager

### PM-01: Создать план проекта

Как PM, я хочу создать вехи и задачи с владельцами и сроками, чтобы команда получила рабочий план.

Acceptance:

- Screen: project detail / planning workspace.
- Actions: add milestone, add task, assign owner, set date, set status.
- States: empty project, validation, save error.
- QA: create project -> add tasks -> reload -> verify.

### PM-02: Восстановить просроченную работу

Как PM, я хочу видеть просрочки и блокеры в одном месте, чтобы восстановить график до эскалации.

Acceptance:

- Screen: `/dashboard`, project attention panel.
- Data: overdue tasks, blocked tasks, milestone impact.
- Actions: open task, change owner/date/status, ask agent.
- QA: seeded overdue task appears in attention view.

### PM-03: Timeline и зависимости

Как PM, я хочу видеть Gantt-like timeline задач и вех, чтобы понимать структуру расписания.

Acceptance:

- Screen: project planning/timeline.
- Data: tasks, milestones, dates, status, blockers/dependencies if modeled.
- Interaction: date/status changes persist.
- QA: timeline smoke verifies task render and update.

### PM-04: План недели через агента

Как PM, я хочу, чтобы агент предложил недельный план из текущих задач, чтобы быстрее перевести состояние проекта в действия.

Acceptance:

- Agent context: project, tasks, owners, dates, blockers.
- Output: structured proposal.
- Safety: user confirms writes.
- Audit: accepted changes visible in activity/audit.
- QA: proposal -> confirm -> entity changed -> audit visible.

## Project Lead / Team Lead

### LEAD-01: Вид исполнения команды

Как Lead, я хочу видеть задачи команды, блокеры и перегруз специалистов, чтобы координировать исполнение.

Acceptance:

- Screen: project team/workload.
- Data: specialists, tasks, due dates, blockers, load hints.
- Actions: filter by person/status, open task, mark blocker.
- QA: seeded overload visible.

### LEAD-02: Проверка реалистичности kickoff

Как Lead, я хочу проверять scope, вехи и ресурсные допущения, чтобы поймать нереалистичный план рано.

Acceptance:

- Screen: project kickoff/planning.
- Actions: comment, flag risk, adjust assumptions if allowed.
- QA: risk appears in PM/CEO attention surface.

## Specialist

### SPEC-01: Моя работа

Как специалист, я хочу видеть свои задачи с приоритетами, сроками, блокерами и комментариями, чтобы понимать следующий шаг.

Acceptance:

- Screen: `/my-work`.
- Data: assigned tasks, status, due date, project, priority, blocker.
- Actions: update status, add comment, mark blocker.
- QA: assigned task appears, status persists.

### SPEC-02: Сообщить о блокере

Как специалист, я хочу отметить задачу заблокированной с причиной, чтобы руководство увидело риск.

Acceptance:

- Screen: task detail / `/my-work`.
- Required: blocker reason.
- Visibility: blocker appears in project and attention views.
- QA: blocker created by specialist appears for PM.

## HR / Resource Manager

### HR-01: Видимость загрузки

Как resource manager, я хочу видеть загрузку и доступность людей, чтобы риски staffing были видны до срыва сроков.

Acceptance:

- Screen: resources/workload.
- Data: people, roles, active tasks or effort/load signal, availability if available.
- States: no people, missing availability, loading/error.
- QA: seeded overload appears with person and linked projects.

### HR-02: Покрытие ролей

Как resource manager, я хочу видеть проекты без ключевых ролей, чтобы закрывать staffing gaps.

Acceptance:

- Screen: project/resources.
- Data: required roles, assigned people, missing roles.
- QA: missing role appears in project attention state.

## Admin / Office

### ADMIN-01: Операционные задачи офиса

Как admin, я хочу вести организационные задачи по проектам, чтобы документы, доступы и встречи не терялись.

Acceptance:

- Screen: project tasks / admin work queue.
- Data: project, task type, owner, due date, status.
- QA: admin task can be created and filtered.

## Finance

### FIN-01: Договоры и оплаты

Как finance user, я хочу видеть договорный и платежный статус по проектам или сделкам, чтобы финансовые блокеры были видны PM/CEO.

Acceptance:

- Screen: deal/project finance section if in scope.
- Data: contract status, invoice/payment status, budget range/amount.
- Permissions: finance fields hidden/read-only without access.
- QA: unauthorized role cannot see finance fields.

## Agent

### AGENT-01: Контекстный ответ

Как пользователь, я хочу, чтобы агент отвечал из текущего контекста, а не generic советом.

Acceptance:

- Agent receives route, role, visible read model, allowed actions.
- Answer cites concrete app entities by name/link.
- QA: test rejects answer without entity references.

### AGENT-02: Подтвержденная мутация

Как пользователь, я хочу, чтобы любая запись агентом требовала подтверждения, чтобы данные не менялись случайно.

Acceptance:

- Agent proposes structured diff/action.
- User confirms explicitly.
- Mutation runs only after confirmation.
- Result and audit entry visible.
- QA: negative test proves no mutation before confirmation.
