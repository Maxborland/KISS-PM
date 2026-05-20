# CRM-like activity panel implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `task-workflow-orchestrator`, then `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** довести правую панель карточки сделки до рабочего CRM-like окна: быстрый ввод комментария/задачи, хронология, task-focus, read-only ясность и проверяемое persisted поведение.

**Architecture:** backend/API/schema не расширяются в этом slice. UI работает поверх уже существующих `OpportunityActivity` comments/tasks, redacted system events и raw audit projection. Новая логика остается в focused web helpers/components, чтобы `OpportunityActivityPanel.tsx` не рос в god-file.

**Tech Stack:** Next.js App Router Client Components, TanStack Query, existing Hono API, persisted PostgreSQL activity endpoints, Playwright smoke.

---

## Product Intent

- **Problem:** правая панель уже хранит чат/задачи/аудит, но ощущается как технические вкладки, а не как рабочая CRM-зона сделки.
- **User / role:** CRM/project intake manager, который открывает сделку и сразу фиксирует следующий контакт, задачу или управленческое событие.
- **Customer need:** видеть историю и следующий шаг в одном месте, не прыгать между вкладками ради базового действия и не путать read-only состояние с поломкой.
- **Value:** сделка становится операционным workspace до активации проекта, а не только паспортом.
- **Non-goals:** внешняя почта/телефония/файлы, rich text editor, nested comments, attachments, mention system, project task redesign.

## Acceptance Criteria

- [x] AC1. На `/opportunities/:id` в правой панели есть CRM summary strip: число открытых follow-up задач, число комментариев, последнее действие.
- [x] AC2. На вкладке `Лента` доступен быстрый composer с режимами `Комментарий` и `Задача`; оба режима вызывают существующие persisted mutations и обновляют ленту без reload.
- [x] AC3. Лента группирует элементы по понятным датам (`Сегодня`, `Вчера`, дата), а не выглядит как плоский список системных карточек.
- [x] AC4. Задачи показывают CRM-like состояние: открытые задачи сверху, выполненные ниже, срок/ответственный/статус читаются без раскрытия.
- [x] AC5. Read-only пользователь видит причину запрета в composer и не получает fake editable controls.
- [x] AC6. E2E доказывает: комментарий и задача создаются из quick composer на ленте, задача завершается, данные видны после reload, restricted user не может мутировать.

## Architecture Notes

- `apps/web/src/opportunityActivity.ts` владеет pure helpers: группировка ленты, summary, сортировка задач, русские labels.
- `apps/web/src/OpportunityActivityComposer.tsx` владеет быстрым composer и не знает о TanStack Query.
- `apps/web/src/OpportunityActivityFeed.tsx` рендерит timeline groups и rows.
- `apps/web/src/OpportunityActivityForms.tsx` остается владельцем full chat/task tabs; при необходимости использует общие row helpers.
- `apps/web/src/OpportunityActivityPanel.tsx` оркестрирует query/mutations/state, но не содержит разметку сложных подвидов.

## Execution

### Block 1. Characterization tests

- [x] Add unit tests for:
  - Russian count labels;
  - activity summary;
  - grouping feed items by day;
  - task ordering: `todo` before `done`, then newest first.
- [x] Add E2E expectations for:
  - quick composer on feed creates a persisted comment;
  - switching composer to task creates a persisted task;
  - task can be completed and survives reload;
  - restricted user sees read-only composer reason.
- [x] Run targeted tests and confirm RED where helpers/UI are missing.

### Block 2. UI implementation

- [x] Create `OpportunityActivityComposer.tsx`.
- [x] Extend `opportunityActivity.ts` helpers.
- [x] Update `OpportunityActivityPanel.tsx` to show summary strip and feed quick composer.
- [x] Update `OpportunityActivityFeed.tsx` for timeline grouping.
- [x] Update task tab UI to use sorted task groups.
- [x] Update `crm.css` with token-driven CRM panel styles.

### Block 3. Review and verification

- [x] Run Bug Hunt, Code Review, UI/UX review and Security Review on changed scope.
- [x] Process Critical/Important findings through Receiving Code Review.
- [x] Run:
  - `pnpm --filter @kiss-pm/web typecheck`;
  - `pnpm test`;
  - `pnpm --filter @kiss-pm/web build`;
  - `pnpm test:e2e:smoke` with worktree env;
  - `git diff --check`;
  - `docker compose ps`.
- [x] Browser smoke desktop and narrow viewport on `http://127.0.0.1:3001/opportunities/:id`.
- [x] Commit logical block.

## Review Notes

- TDD RED: `pnpm vitest run apps/web/src/opportunityActivity.test.ts` сначала упал с `ReferenceError` для новых helpers (`getOpportunityActivitySummary`, `groupOpportunityFeedItemsByDay`, `sortOpportunityTasks`), что подтвердило отсутствующее поведение.
- TDD GREEN: `pnpm vitest run apps/web/src/opportunityActivity.test.ts` прошел, 5 tests.
- Bug Hunt: проверены state transitions composer mode, read-only controls, task ordering, summary counters, date grouping и mobile layout. Critical/Important замечаний не осталось.
- Code Review: срез оставлен без backend/API/schema изменений; orchestration остался в `OpportunityActivityPanel.tsx`, новый UI вынесен в `OpportunityActivityComposer.tsx`, pure logic - в `opportunityActivity.ts`.
- Security Review: новых privileged endpoints, raw HTML, secret exposure или permission bypass не добавлено; mutations используют существующие permission-guarded API и read-only UI остается disabled.
- UI/UX Review: панель стала рабочим CRM-блоком: summary strip, быстрый comment/task composer, группировка ленты по дням, task-first сортировка, понятные counters и disabled reason. Не добавлялись fake controls для email/attachments/exports.
- Verification:
  - `pnpm vitest run apps/web/src/opportunityActivity.test.ts` - exit 0.
  - `pnpm --filter @kiss-pm/web typecheck` - exit 0.
  - `pnpm test` - exit 0, 158 tests.
  - `pnpm --filter @kiss-pm/web build` - exit 0.
  - `DATABASE_URL=...55433 E2E_WEB_PORT=3102 E2E_API_PORT=4102 pnpm test:e2e:smoke` - exit 0, 4 Chromium tests.
  - `git diff --check` - exit 0.
  - `docker compose ps` - exit 0, `web`, `api`, `postgres` up.
- Live browser smoke: после `docker compose restart web api` открыта карточка `manual-activity-mpdgoexk` на `http://127.0.0.1:3001`; проверены summary strip, создание комментария, создание follow-up задачи, обновление counters, группировка `Сегодня`, desktop и narrow viewport.
- Runtime note: live Compose использует PostgreSQL на `55433`; для ручного browser smoke были выполнены `DATABASE_URL=...55433 pnpm db:migrate` и `DATABASE_URL=...55433 pnpm db:seed:dev`.
