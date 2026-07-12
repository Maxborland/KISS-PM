# План реализации PR5 → конец (UI-модернизация по ресерчу 2026-07-10)

Дата: 2026-07-12. База: `master` @ `6a815599` (после merge PR #232).

## Источники

- Синтез ресерча: `E:\KISS-PM\.worktrees\ui-research-saturation-20260710\.superloopy\evidence\research\20260710-modern-ui-completeness\SYNTHESIS.md` (Application plan, Phases 0–5).
- Поправка про эталоны: `REFERENCE-SURFACES-AMENDMENT.md` (там же) — два эталона: **Agent Workspace** и **Planning Cockpit**; Scenarios — лаборатория KISS Delta, не флагманский экран.
- PR-последовательность утверждена в Codex-сессии 2026-07-10 (rollout-2026-07-10T10-54-35): PR1 fulfillment → PR2 deals → PR3 task peek → PR4 agent truth → **PR5 Agent Workspace → PR6 Planning Cockpit → PR7 Scenarios/KISS Delta → перенос грамматики в CRM/Dashboard/Settings**.
- Аудит текущего состояния master: 5 параллельных агентов, 2026-07-12 (эта сессия), grep/read-фолбэк (CodeGraph-индекс смешивает соседние worktree — отключён сознательно, задизклоужено).

## Статус: что уже сделано (не переделывать)

| PR | Ветка | Итог |
|---|---|---|
| PR1 #226 | `codex/ui-fulfillment-foundation` | 9 вкладок проекта — реальные ссылки; demoAction → маршруты; E2E |
| PR2 #227 | `codex/crm-deal-activation` | Сделки открываются из Kanban/list; keyboard quick-assign unstaged; активация fail-closed; E2E |
| PR3 #228 | `codex/canonical-task-peek` | URL-backed TaskPeek `?task=` + `/tasks/[id]`; wired в My Work/проект/Gantt; E2E |
| PR4 #229 | `codex/agent-partial-apply-contract` | Item-level partial apply правдив (client+server+E2E); payload-backed previews |
| #230–232 | merge-train followups | Целостность assignment writes, advisory lock, ASCII-контракт ID |

Сверх плана уже сделано (подтверждено аудитом):

- **Preview→apply генерализован на все 6 planning-поверхностей** (`usePlanning` + `PlanningPreviewGate`, commit `e2ac60e3`) — пункт «Deadline в Settings как первый governed tracer» из SYNTHESIS **закрыт и превзойдён**.
- **Saved Views полностью wired** (API CRUD + `schedule-saved-views.tsx` в тулбаре Schedule) — пункт «backend Saved Views не выведен» закрыт (payload пока только layout: zoom/columnWidths/collapsed).
- Scenarios: контур `current → proposal → consequences → risk/approval → execute/audit` на ~80% готов на уровне plumbing (persisted runs, hash/engine/target re-validation, транзакционный apply, audit на preview/apply/deny/conflict).

## Критические находки аудита, меняющие план

1. **CI мёртв.** Все GitHub Actions runs (Release gate, Security gates, design-v3 contract) — `startup_failure` 0s с 2026-07-04; PR1–PR4 и followups влиты без единого прогона CI. Проблема уровня аккаунта/раннеров/биллинга, не YAML.
2. **~20 e2e-спеков нацелены на удалённый UI** и не могут пройти никогда: семейство testid `planning-workspace/planning-wbs-grid/...` (e2e/planning), маршруты `/opportunities/:id`, `/clients/:id` (crm-activity, crm-entity-template), старый task-workspace, a11y-спеки со старыми testid, admin-маршруты `/settings/production-calendar|absences|org-structure`. `test:e2e:smoke` гоняет весь `./e2e` без фильтра.
3. **DESIGN.md не существует**, а семантические токены имеют **двух владельцев**: `tokens.css` (layer tokens) и `kiss-v4.css` (layer components) оба определяют `:root` c 35 пересекающимися именами — побеждает kiss-v4 (indigo-канон), значения tokens.css мёртвые. Health-тест **закрепляет текущее двоевластие** (требует `:root` в kiss-v4.css).
4. **Прод-поверхность /agent целиком построена на маркетинговом токен-острове `--lad-*`** (hex-палитра, px-шкала, без dark, невидим для hex-гейта) и шарит компоненты с landing-демо.
5. `@tanstack/react-virtual` установлен, но **не используется нигде**; schedule и матрица рендерят все строки.

## Последовательность PR5 → конец

Нумерацию эталонов сохраняю (PR5 = Agent Workspace, как в утверждённом плане); перед PR5 нужны два маленьких enabling-PR.

### PR5-prep-A — `codex/ci-e2e-gate-repair` (S–M) — можно параллельно с prep-B

Закрывает так и не выполненный пункт 6 Phase 0 («release-gate execution observable»).

1. Диагностировать/починить Actions-уровень (все workflow падают одинаково → аккаунт/раннеры/биллинг).
2. Карантин или миграция устаревших спеков: разделить `./e2e` на `current/` и `quarantine/` (или Playwright projects + grep), `test:e2e:smoke` гоняет только живые.
3. Перенести keyboard-only и axe-покрытие со старых testid на текущие (`schedule-productivity-workspace`, `resource-load-matrix`, `saved-views-dropdown`).

**Гейт:** release-gate реально выполняется и зелёный на master; ни один спек не ссылается на несуществующие testid/маршруты.

### PR5-prep-B — `codex/design-authority-tokens` (M) — пререквизит эталона

SYNTHESIS Phase 1, пропущенная в PR-нарезке. Без неё PR5 будет калибровать эталон против каскада, где kiss-v4 молча побеждает tokens.css.

1. Тонкий корневой `DESIGN.md`: authority, роли файлов, ownership, задокументированные исключения (10–12px технические оси), QA-гейты. Без дублирования hex/рецептов. Код — ground truth (TOKENS.md частично устарел: заявляет «dark OUT», а dark уже в проде).
2. `tokens.css` — единственный владелец `:root`: перенести 35 winning-значений kiss-v4 в tokens.css, kiss-v4 оставить только утилитами (`v4-mono/v4-num/v4-row/msgrid/gantt-bar`); влить конфликты `tokens.planning.css` (inspector-width 380↔360, critical-stripe); убрать non-variable декларации с `:root`.
3. Переписать `design-v3-enforcement.health.test.ts` (сейчас утверждает старое состояние) **в том же коммите**; расширить health-гейты на CSS-слой: hex вне tokens-файлов (allowlist для landing/маркетинга), literal font-size 10–12px, запрет новых `:root` вне `styles/tokens*.css`, запрет новых BEM-селекторов (freeze). Stylelint не вводить — vitest-паттерн уже в CI дважды.
4. Патч `AGENTS.md` §10 (сейчас велит добавлять новые BEM-классы в bem.css — противоречит форвард-пути); консолидация hover-lift (удалить мёртвые `v4-lift`/`v4-pop`, shadow через токен); решить next-themes vs `data-theme` (реальный механизм — второй; первый мёртвый груз).
5. Верификация: computed-style parity + скриншоты до/после (значения не должны измениться — меняется только владелец).

**Риски:** `--row-h` 30↔36px, порядок `@plugin` после всех `@import` в globals.css (известная ловушка), story-титулы RU (copy-scan гейт).

### PR5 — `codex/agent-workspace-reference` (L) — эталон №1

Slice A поправки. Item 1 (partial-apply truth) и серверная половина item 3 — **сделаны PR4, не трогать** (E2E их закрепляет).

1. **Де-айленд**: перевести прод-`/agent` с `--lad-*` на канонические токены (+ dark theme). Явно выбрать стратегию с landing-демо: рекомендация — прод-поверхность получает собственные компоненты/стили (fork на canonical tokens), маркетинговый виджет остаётся как есть и оба «стягиваются» позже; редактирование in-place перекрасит лендинг, шаринг удвоит связность.
2. **Демо-остатки**: убрать fake CoT-fallback (жёсткие ACTIVITY_STEPS до первого SSE-события), demo-копию AgentStatusMenu + мёртвую кнопку «Настроить в аккаунте», inert «Выбрано ▾», позиционные navIcons (иконки врут для Дашборд/Коммуникации/Админ), hard-coded 'AI'-бейдж/зелёную точку, client-note demo-вариант.
3. **Ролевая модель сообщений**: типизированные kinds user/assistant/tool-call/tool-result/proposal-card/apply-result/system/error вместо плоских строк; рендерить `analyzeResults` (сейчас приходят и выбрасываются); структурированные liveSteps.
4. **Состояния**: loading до ответа `GET /agent/tools` (skeleton + блок composer), поверхность ошибки listTools (сейчас глотается в `tools=[]`).
5. **Keyboard/focus/motion**: tabbable change-cards (сейчас `<article onClick>`), Escape/focus-trap для меню и мобильных drawer, `aria-live` на стрим и результат, reduced-motion гейт для lad-анимаций (сейчас не покрыты).
6. **История**: колонка мертва (items={[]}, персистентности разговоров нет). Решение в PR5 — честно убрать/свернуть колонку; персистентность разговоров — отдельный трек (см. «Смежные треки»).

**Не делать:** review-UI вокруг `update_task` (сервер отвечает 501 и не предлагает его LLM).
**Риски:** unit/E2E-тесты прибиты к `.lad-*` селекторам и RU-лейблам PR4-контракта — сохранять семантику при рестайле; `storybook-contract.health` требует существования `agent-surface.tsx` по пути.
**Гейт (из плана + amendment):** mixed result никогда не «полный успех»; каждое число/значение из payload; keyboard-путь composer → proposal → apply → receipt; superloopy-frontend visual-QA: 390/768/1280, normal/reduced, light/dark.

### PR6 — Planning Cockpit, эталон №2 — два PR

**PR6a — `codex/planning-cockpit-contracts` (M–L):**

1. **Shared selection**: общий selection-контракт project/task/resource (URL-synced), согласованный с существующим `?task=` и batch-навигационным guard; матрица ↔ schedule перекрёстные переходы («открыть строку в графике»).
2. **Паритет плотности матрицы с grid**: ROW_H 34→36 (токен), sticky period-header, right-aligned tabular-nums, focus-visible на ячейках-кнопках (сейчас outline-none), drilldown не поверх колонок.
3. **Pointer lifecycle** в `usePointerDrag`: setPointerCapture, `pointercancel`/`lostpointercapture`, Escape, activation threshold, pointerId-фильтр; snapshot ширин для отмены column-resize; унификация с ad-hoc `startFinishFillDrag`. Autoscroll — только после этого (эмпирика: edge-zone 20–25%, ramp 350–450ms, ≤900px/s — стартовая гипотеза).
4. **Keyboard-альтернативы drag-операциям** (move/resize/progress/link) + aria-описания баров; существующая roving-tabindex-модель — база.
5. **Правда work model**: правки duration/дат больше не переписывают силой `fixed_duration`+`effortDriven:false` у задач с другой семантикой — сохранять существующий тип; удержать пару `task.update_work_model`+`assignment.upsert` (иначе разъедутся часы матрицы и WBS — известный баг).
6. Демо-остатки: дефолтная selection `'t-3.2.1'`, optimistic-имена из статического RESOURCES, unused imports Filter/Columns3/Layers.

**PR6b — `codex/planning-cockpit-virtualization` (L):**

1. Виртуализация строк schedule (таблица + gantt-lane + SVG links) и матрицы через уже установленный `@tanstack/react-virtual`.
2. Фикстуры 100/1k/10k + профилирование (long task ≤50ms в тест-конверте); мемо-структура матрицы (O(resources×periods×days)).
3. Совместимость с DOM-coupled фичами: taskPeekTriggerRefs, inline-edit, drag-fill.

Рекомендация: перед 6a вынести из `schedule-surface.tsx` (1885 строк) хотя бы command-builders и жесты — иначе blast-radius правок неуправляем.

**Без fake proposal-геометрии**: read model не отдаёт projected-координаты — текстовый fallback остаётся честным потолком (границы из amendment).

### PR7 — `codex/scenarios-kiss-delta` (M) — лаборатория контракта

Plumbing готов на ~80%; PR7 — «последняя миля честности» в UI:

1. **Audit receipt**: `auditEventId` уже возвращается — прокинуть через `use-planning` и дать ссылку на `/projects/[id]/commits` (сейчас «Откат доступен на вкладке Коммиты» — статический текст).
2. **TTL**: показать `expiresAt` (countdown/предупреждение) вместо 409 после клика.
3. **Entity-level последствия**: прогнать `proposal.planDelta.commands` через существующий `preview-command-batch` → before/after read models для compare-панели и генерик-гейта (сейчас рендерятся только 4 счётчика).
4. **Типизация контракта**: `ScenarioProposal` из `@kiss-pm/domain` как wire type; вернуть `permissionPreview`/`auditPreview` в `PlanningPreviewResponse`; убрать `as unknown as Proposal[]`.
5. RU-сообщения для scenario-кодов (`planning_scenario_already_applied`, `scenario_unavailable`, hash/engine/target mismatch); вычисляемый riskScore и настоящий `deadlineDeltaDays` (сейчас константы 80/40/20 и 0); рендер `requiredApprovals`.
6. `revertLast` — через preview-гейт (сейчас в обход).
7. Гигиена: stale «мок-only» комментарии про `acceptedOverloads` (поле давно каноническое), dual route aliases.

**Риски:** гейт — общий choke point 6 поверхностей и 12 full-eval спеков; persisted proposal hash — расширение контракта должно быть tolerant к in-flight runs; scenario apply без idempotencyKey (retry-UX вернёт 409, не кэш).

### PR8+ — перенос доказанной грамматики (по одному consumer)

| PR | Ветка | Scope |
|---|---|---|
| PR8 | `codex/crm-grammar` | Deal Peek `?deal=` по паттерну TaskPeek (вынести shared hook; учесть fragile import `AppRouterContext`), canonical cards/tables, stage/value delta, сдержанная глубина |
| PR9 | `codex/dashboard-grammar` | Summary-first иерархия, меньше декоративных metric-cards, без fake signals, drill-down к причине; Settings — только визуальный паритет (governed preview/apply уже есть) |
| PR10 | `codex/command-palette-context` | Cmd/Ctrl+K поверх **прод**-`WorkspaceShell` GlobalSearch (промоутить неиспользуемые `components/ui/command*`, НЕ Storybook-заглушку `shell/command-palette.tsx`), typed action groups на реальных permissioned-действиях, `types=`-фильтр API; Saved Views v2 — фильтры матрицы + payload version bump с tolerant parsing (иначе существующие виды «повреждены») |
| PR11 | `codex/dark-motion-parity` | Полная semantic dark map (~30 токенов: *-soft/*-text, prio-чипы, shadows), консолидация механизма темы (убрать мёртвый next-themes), reduced-motion для tailwindcss-animate оверлеев и widget-CSS |

Финальный трек (после нуля новых консьюмеров): BEM-выведение (39 tsx-файлов, 3.7k строк CSS) — отдельный L-трек, в PR5-prep-B только freeze.

## Смежные треки вне этого плана (не потерять)

- **Раскрытие planning engine в UI** (task types/effort-driven/constraints/deadline editor) — P0 из WBS/Gantt-синтеза 2026-07-09; PR6a чинит только силовую перезапись. Отдельный PR после PR6.
- **Auto-solver**: полный proposal→apply API с аудитом существует, web-консьюмеров ноль — кандидат во второй источник proposals в лаборатории Scenarios (PR7b, L).
- **Персистентность разговоров агента** (история-колонка) — новый endpoint + storage (L).
- Новые классы сценариев (deadline/scope what-if) кроме `resource_overload`.

## DoD каждого PR (из утверждённого плана + правила репо)

- полный пользовательский путь, а не присутствие кнопки;
- loading/empty/error/permission/partial states;
- keyboard и focus;
- свежий E2E на текущих routes (и зелёный, теперь наблюдаемый, release-gate);
- superloopy-frontend: DESIGN.md-гейт, anti-slop, browser visual-QA 390/768/1280 normal/reduced (после PR11 — и dark);
- никаких новых локальных токенов и декоративной motion;
- CodeGraph sync + change index в финальном отчёте (AGENTS.md §8–9).

## Порядок и параллелизм

```
PR5-prep-A (CI)  ──┐
PR5-prep-B (tokens)┴─→ PR5 (Agent) ─→ PR6a ─→ PR6b
                         └─ PR7 (Scenarios) — параллельно PR6, файлы не пересекаются
PR6/PR7 пройдены → PR8 → PR9 → PR10 → PR11
```

prep-A и prep-B независимы и могут идти параллельно; PR7 не зависит от PR5/PR6 по файлам и может стартовать сразу после prep-A.
