# CRM intake product polish implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `task-workflow-orchestrator`, then `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** довести CRM intake до более цельного рабочего контура: плотная карточка сделки, информативный Kanban, проверяемые задачи/коммуникации и отсутствие fake affordances.

**Architecture:** идем вертикальными безопасными срезами. Backend/API/schema не меняются в первом блоке: используем существующие persisted deals, activity endpoints, RBAC и audit. Presentation logic выносим в pure helpers и focused React components, чтобы `OpportunityDetailView.tsx` и `DealsKanban.tsx` не росли как god-files.

**Tech Stack:** Next.js App Router Client Components, TanStack Query, existing Hono API, PostgreSQL persistence, @dnd-kit Kanban, Playwright smoke.

---

## Product Intent

- **Problem:** CRM intake уже функционален, но часть screens выглядит как набор технических блоков: Kanban cards не дают достаточного CRM-контекста, detail page недостаточно структурирует коммерческую суть, задачи/коммуникации требуют более явного рабочего контура.
- **User / role:** менеджер внедрения или CRM/project intake manager.
- **Customer need:** быстро понять по сделке клиента, контакт, этап, деньги, сроки, потребность, ресурсный риск и следующий шаг, не проваливаясь в лишние таблицы.
- **Value:** сделка становится рабочим CRM intake workspace, который естественно ведет к ресурсной проверке и активации проекта.
- **Non-goals:** email/телефония/файлы/mentions/rich text, новая backend schema задач, массовые действия и экспорт.

## Architecture / Scope Matrix

| Area | Current state | Target state | Status |
|---|---|---|---|
| Deal detail | Работает, но detail layout монолитен и визуально сухой | CRM-like header + business summary + action rail + readable links/fields | In progress |
| Kanban | Реальный `@dnd-kit` + select fallback уже есть | Карточки несут client/contact/period/economics/demand/feasibility context | In progress |
| Activity workspace | Summary/composer/tabs сделаны предыдущим блоком | Сохранить, не ломать | Covered |
| Tasks/comments | Persisted activity endpoints уже есть | UI states остаются проверяемыми, future model documented | Covered for this slice |
| Permissions | UI disabled + backend guards | Не ослаблять; restricted E2E must remain green | Verified |
| Audit | Existing audit/system activity | Не менять; E2E must remain green | Verified |

## Acceptance Criteria

- [x] AC1. Kanban card shows deal title, client, contact, period, contract value, hourly rate, required hours, demand and feasibility state.
- [x] AC2. Kanban DnD/fallback stage move remains real and persisted after reload.
- [x] AC3. Deal detail header and summary separate contract value, planned hourly rate, calculated required hours and demand; no combined misleading economics line.
- [x] AC4. Client/contact links on detail remain clickable and visually obvious.
- [x] AC5. Activity workspace still works after layout changes.
- [x] AC6. Restricted/read-only user still cannot mutate deals/activity and sees disabled reasons.
- [x] AC7. Desktop and narrow viewport have no horizontal overflow and no broken panel/card overlap.

## Implementation Blocks

### Block A. Characterization and View Models

- [x] Add unit tests for a Kanban card view model:
  - client label;
  - contact label;
  - period label;
  - contract value label;
  - hourly rate label;
  - planned hours label;
  - demand label;
  - feasibility label.
- [x] Run targeted unit test and confirm RED for missing helper.
- [x] Add helper in `apps/web/src/opportunityDisplay.ts`.
- [x] Run targeted unit test and confirm GREEN.

### Block B. Kanban Product Polish

- [x] Update `DealsKanban.tsx` to use the Kanban card view model.
- [x] Add visible CRM metadata to each Kanban card without fake controls.
- [x] Update `crm.css` for compact card facts, feasibility line and accessible mobile layout.
- [x] Extend `e2e/smoke/deals-kanban.spec.ts` to assert real card facts and persisted move.

### Block C. Deal Detail Product Polish

- [x] Extract focused detail subcomponents if needed before adding UI density.
- [x] Improve header/summary visual hierarchy around:
  - client/contact/project type/stage;
  - economics;
  - demand;
  - governed actions.
- [x] Keep `OpportunityActivityPanel` unchanged as the right-side functional block.
- [x] Add/extend E2E assertions for clear separated economics and links.

### Block D. Review and Verification

- [x] Product Owner review: promised user path, no fake affordances, CRM usefulness.
- [x] Lead Architect review: boundaries, no god-file regression, no backend/schema accidental scope.
- [x] UI/UX review: dense Russian operational UI, responsive states, clear disabled reasons.
- [x] Bug Hunt and Security Review.
- [x] Process Critical/Important findings through Receiving Code Review.
- [x] Run:
  - `pnpm vitest run apps/web/src/opportunityDisplay.test.ts`;
  - `pnpm --filter @kiss-pm/web typecheck`;
  - `pnpm test`;
  - `pnpm --filter @kiss-pm/web build`;
  - `DATABASE_URL=...55433 E2E_WEB_PORT=3102 E2E_API_PORT=4102 pnpm test:e2e:smoke`;
  - `git diff --check`;
  - `docker compose ps`.
- [x] Browser smoke desktop and narrow viewport on `http://127.0.0.1:3001/opportunities`.
- [x] Commit logical block.

## Review Notes

- Product Owner review: карточка Kanban теперь отвечает на базовые CRM-вопросы без провала в detail: кто клиент, кто контакт, когда период, сколько стоит, какая норма часа, сколько часов нужно, какая потребность и ресурсный статус. Fake affordances не добавлялись: сохранились только рабочий DnD, fallback-select, открытие карточки и существующие disabled reasons.
- Lead Architect review: backend/API/schema не менялись. Новый presentation helper живет в `apps/web/src/opportunityDisplay.ts` и покрыт unit test; `DealsKanban.tsx` потребляет готовый view model. `OpportunityActivityPanel` сохранен как отдельный функциональный блок. Решение по Playwright: smoke-suite выполняется `workers: 1`, потому что тесты мутируют один shared tenant и проверяют реальный pointer DnD.
- UI/UX review: применен плотный операционный стиль, русский UI, без landing/hero и без копирования референсов. Browser snapshot подтвердил Kanban cards с client/contact/period/demand/economics/feasibility; detail подтвердил отдельную секцию `Коммерческая модель сделки` и правую рабочую ленту.
- Bug Hunt: найден важный дефект после уплотнения карточек - pointer-driven DnD стал нестабилен при полном smoke-прогоне. Исправлено `collisionDetection={pointerWithin}` в `DndContext`; полный smoke дополнительно стабилизирован serial execution из-за общей тестовой базы.
- Security Review: touched frontend code не добавляет `dangerouslySetInnerHTML`, DOM sinks, dynamic navigation, local/session storage, public secrets, Next server actions или новые API endpoints. Backend permission checks не ослаблялись.
- Receiving Code Review: Critical/Important items обработаны. После фиксов прошли targeted unit, typecheck, full unit/integration, Next build, full smoke, browser desktop/narrow smoke.
- Verification evidence:
  - `pnpm vitest run apps/web/src/opportunityDisplay.test.ts`: RED exit 1 до helper, GREEN exit 0 после helper.
  - `pnpm --filter @kiss-pm/web typecheck`: exit 0.
  - `pnpm test`: exit 0, 159 tests passed.
  - `pnpm --filter @kiss-pm/web build`: exit 0.
  - `DATABASE_URL=postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55433/kiss_pm E2E_WEB_PORT=3102 E2E_API_PORT=4102 pnpm test:e2e:smoke`: exit 0, 4 smoke tests passed.
  - Browser smoke: `http://127.0.0.1:3001/opportunities` desktop snapshot showed enriched Kanban; detail snapshot showed commercial summary + activity tabs; narrow viewport check reported `overflowing: false`.
