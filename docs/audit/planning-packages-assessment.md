# Решение по пакетам planning-client и planning-gantt-ui

## 1. Вердикт (одной строкой)

**keep-disabled-decide-later** — отключить оба пакета из сборки/typecheck прямо сейчас (чтобы baseline позеленел), сохранить как ценную базу для будущего оживления в рамках Phase 3D; это НЕ мёртвый код, но и НЕ работающий продукт сегодня. _Дата: 2026-06-25._

---

## 2. Что это

### `@kiss-pm/planning-client` (710 LOC, последний коммит 2026-05-23)

**Назначение:** тонкий, фреймворк-независимый доменный клиент для backend планирования класса MS-Project — типизированная обёртка над HTTP/SSE плюс чистые helper-функции.

**Что внутри:**
- `src/api/planningApiClient.ts` + `types.ts` — транспорт: `createPlanningApiClient` с единым `requestJson<T>`, инъецируемым `fetchImpl`, `credentials`, CSRF-заголовком `x-kiss-pm-action`, типизированной ошибкой `PlanningApiError` (status/code/body).
- `src/duration/parseDuration.ts` — парсинг длительностей RU+EN (дни/часы, запятая как десятичный разделитель).
- `src/predecessors/parsePredecessorString.ts` + `serializePredecessorString.ts` — двунаправленный разбор/сборка связей FS/SS/FF/SF (RU: ОН/НН/ОО/НО) с лагами, дедупликацией.
- `src/fill/detectFillSeries.ts` — детектор серий для автозаполнения (drag-fill).
- `src/realtime/subscribeToPlanEvents.ts` — SSE-подписка с SSR-guard.
- `src/undo/buildCompensatingCommands.ts` — построение компенсирующих команд для client-side undo.

**Completeness: ~75%.** **Quality: 4/5.**

Контракт реален и совпадает 1:1 с живым backend: URL-ы и методы клиента (`read-model`, `preview-command`, `apply-command`, `apply-command-batch`, `baselines`, `scenarios/preview`, `scenarios/:id/apply`) и SSE-события `planVersionChanged`/`planSnapshotInvalidated` соответствуют `apps/api/src/planning/registerPlanningRoutes.ts` и `planningEventsRoute.ts`. Оптимистичная конкурентность реальна: каждая мутация несёт `clientPlanVersion`, backend отдаёт 409 `plan_version_conflict`.

Главная слабость — типизация на границе чтения: `PlanningReadModel.project/calculatedPlan/baselineComparison/resourceLoad` и `authored.*` — это `Record<string,unknown>` (`types.ts:3-17`), потребители не получают compile-time формы; `buildCompensatingCommands` маскирует это ad-hoc кастами (`as "FS"`, `as "fixed_duration"`).

### `@kiss-pm/planning-gantt-ui` (1419 LOC, последний коммит 2026-05-22)

**Назначение:** headless/типизированная библиотека рендеринга Gantt+WBS (Phase B/C «typed planning grid»), извлечённая из внешнего ассета «BR2».

**Что внутри:**
- `src/components/PlanningGanttSurface.tsx` — корневой stateless-компонент: на вход `PlanningGanttViewModel` + флаги features/capabilities, на выход типизированные `PlanningGanttIntent` через коллбэки. Чистый props-in/intents-out.
- `timeline/GanttBar.tsx`, `GanttDependencyArrows.tsx`, `GanttTimeline.tsx`, `GanttTimelineHeader.tsx` — SVG-рендер шкалы и стрелок зависимостей.
- `wbs/WbsGrid.tsx` — рукописная `<table>` (НЕ TanStack).
- `lib/timelineScale.ts`, `treeRows.ts`, `displayFormat.ts` — чистый слой: UTC-safe математика дат, flatten/collapse WBS-дерева, RU-метки. **Это сильнейшая, переиспользуемая часть, покрытая осмысленными тестами.**
- `types/viewModel.ts`, `intents.ts`, `capabilities.ts`, `features.ts` — богатая модель домена и полный словарь интентов.
- `src/packageBoundary.test.ts` — guardrail против протечки quarantined BR2/AntD-модулей.

**Completeness: ~35%.** **Quality: 4/5 (архитектура) / 3/5 (полнота).**

Это **read-only скелет**: весь словарь интентов объявлен, но **ни один компонент не вызывает `onIntent`** (grep `onIntent(` = ноль). Нет drag, inline-edit, авторинга зависимостей, виртуализации, milestone-ромбов, resource-load UI. Объявленные тяжёлые зависимости (`@dnd-kit/core`, `@tanstack/react-table`, `@tanstack/react-virtual`, `date-fns`) **не импортируются** — мёртвый вес. Пакет **не потребляет** `planning-client` (даже не в deps) и определяет собственные типы параллельно — адаптера между ними нет.

---

## 3. Реальная картина 105 ошибок (config vs логика)

**Вывод: ~100% — это дефекты конфигурации/установки, НОЛЬ логических багов в исходниках.**

| Класс | Кол-во | Причина | Это баг логики? |
|---|---|---|---|
| TS7026 (JSX implicitly any) | 88 | `tsconfig.base.json:15` `"types": ["node"]` блокирует автоподключение `@types/react` → глобальный namespace `JSX` не загружается | Нет (config) |
| TS7016 (нет declaration file) | 11 | Та же причина — react/react-dom/jsx-runtime | Нет (config) |
| TS2307 (cannot find module `@kiss-pm/domain`) | 5 | `packages/planning-client/tsconfig.json` не имеет `references`/`paths` на `../domain` (сравни `apps/api/tsconfig.json`) | Нет (config) |
| TS2322 (type mismatch) | 1 | Ложная тревога: prop `key` помечен как excess только потому, что отсутствует `LibraryManagedAttributes` из `@types/react`; исчезает при загрузке react-типов | Нет (config) |

99 из 105 ошибок сводятся к **одной** настройке (`types:["node"]` в базовом tsconfig). Эмпирически проверено: добавление `"types": ["node","react","react-dom"]` в `packages/planning-gantt-ui/tsconfig.json` уронило ошибки со 100 до 2.

Подтверждено на диске:
- `tsconfig.base.json:15` действительно `"types": ["node"]`.
- `packages/planning-gantt-ui/tsconfig.json` имеет `jsx: "react-jsx"`, но НЕ переопределяет `types`.
- `packages/planning-client/tsconfig.json` НЕ имеет `references`.
- Корневой `tsconfig.json` ссылается на оба пакета (строки 6, 10).

### План и оценка часов до зелёного typecheck

**Итого: 1–2 часа, 100% config (правок исходников не требуется).**

1. **(~0.5ч) React-типы** в `packages/planning-gantt-ui/tsconfig.json`: добавить в `compilerOptions` → `"types": ["node","react","react-dom"]` (сохранить `jsx: "react-jsx"`). Убивает все 88 TS7026 + TS7016 (react/jsx-runtime) + TS2322.
2. **(~0.5–1.5ч, основная неопределённость) Integrity установки pnpm**: вторичный дефект — `packages/planning-gantt-ui/node_modules/@types/react` присутствует, но `package.json` нечитаем; в корне `node_modules/@types` только `node`. Нужен чистый `pnpm install` (+ при необходимости `pnpm dedupe`) или hoist `@types/react` в корень, чтобы bare-name lookup `types:["react"]` не падал с TS2688.
3. **(минуты) `@kiss-pm/domain` (5×TS2307)**: добавить в `packages/planning-client/tsconfig.json` → `"references": [{ "path": "../domain" }]` (зеркало `apps/api`). Альтернатива для plain tsc — `paths` map с `baseUrl`.
4. Перезапустить `pnpm typecheck` (`tsc -b`) — ожидается зелёный.

Разбивка: часы на реальные логические баги = 0; config ≈ 0.5; отладка integrity pnpm ≈ 0.5–1.5.

---

## 4. Соответствие плоскостям планирования и исходный замысел

**Исходный замысел (документирован):** Phase B/C «Planning Workspace» — контролируемый MS-Project-style WBS+Gantt UI поверх backend-authoritative движка планирования (Phase 5/6). Backend остаётся единственным источником истины для дат/CPM/валидации/resource-load/baseline. UI получает нормализованный `PlanningGanttViewModel` и эмитит `PlanningGanttIntent`, которые host-адаптер в `apps/web` мапит на `PlanningCommand` preview/apply/reload.

Источники: `docs/decisions/2026-05-22-br2-gantt-boundaries-wbs-table.md`, `docs/plans/2026-05-22-br2-gantt-file-level-extraction-plan.md`, `docs/plans/KISS PM production plan.md` (Phase 3D, строки 461–494, целевой маршрут `/projects/[id]/timeline`).

**Архитектура замысла — хорошая и обоснованная:** жёсткая граница пакета (без Hono/persistence/Bitrix/ролей), нормализованная модель внутрь, интенты наружу. `planning-client` — точная и полная реализация своей половины. `planning-gantt-ui` — лишь частичная оболочка (45% по fit-оценке): рендерит read-only, но интерактивная посылка мертва.

**Почему пауза:** проект свернул на pivot. Phase B-доки ссылаются на `apps/web/src/features/planning/` и `features/dv2/planning/`, маршрут `/projects/[id]/schedule` — ничего из этого больше не существует. Приложение было перестроено, осиротив пакеты.

**Overlap с `apps/web/src/widgets/gantt/`:** живой Gantt в продукте — `widgets/gantt/gantt.tsx` (~203 LOC, CSS-grid, mock-данные, `fakeDate()`, хардкод «Авто», placeholder-ресурсы, не-интерактивные бары). `planning-gantt-ui` — это **дивергентный, более амбициозный ПРЕДПОЛАГАЕМЫЙ замена**, а НЕ drop-in. Живой `runtime-screen-view.tsx` при этом РЕАЛЬНО ходит на backend планирования, но **в обход пакета**: переопределяет собственный `PlanningReadModel` (line 75), собственный `usePlanning` через `apiFetch` (line 716), собственный `toGanttData()` (line 800) — дублируя `planning-client`.

**Что нужно для подключения:**
- *Дёшево (часы):* заменить дублирующую inline-реализацию в `runtime-screen-view.tsx` на импорт `planning-client` — эндпоинты и типы уже совпадают.
- *Дорого (multi-week, по сути greenfield):* для `planning-gantt-ui` — построить отсутствующий host-слой (`planningReadModelMapper`: ReadModel→ViewModel; `planningCommandIntentMapper`: Intent→PlanningCommand), реально реализовать интерактивность (`onIntent` в `GanttTimeline` с drag/resize, перестроить `WbsGrid` на TanStack/dnd-kit с inline-редакторами), создать маршрут `/projects/[id]/timeline` с циклом preview/apply/409/SSE.

---

## 5. Сильные стороны / пробелы / риски

### Сильные стороны
- `planning-client` — чистое разделение ответственности, робастный транспорт, реальный контракт оптимистичной конкурентности, двунаправленные i18n-helper-ы (RU+EN), реальная компенсация undo для 7 видов команд.
- `planning-gantt-ui` — textbook headless props-in/intents-out, сильная типизированная модель домена, дисциплина features vs capabilities, `packageBoundary.test.ts` как архитектурный guardrail.
- Чистый lib-слой обоих пакетов (`timelineScale`/`treeRows`/`displayFormat`, duration/predecessor/fill парсеры) — независимый, протестированный, **переиспользуемый прямо сейчас** в живом виджете.
- Все 105 ошибок — config, не логика: низкий риск починки.

### Пробелы
- `planning-client`: read-model практически нетипизирован (`Record<string,unknown>`); компенсация покрывает только 7 из ~20 команд (остальные → `default: return []`, тихий no-op); тесты только для 3 чистых helper-ов (ноль для API-клиента, SSE, undo); `fetchProjectAuditEvents` — несогласованный bolt-on (хардкод global fetch, игнор `fetchImpl`).
- `planning-gantt-ui`: интерактивность 0% (интенты не эмитятся); не потребляет `planning-client`, адаптера нет; 4 объявленные тяжёлые зависимости мертвы; resourceLoad/scenarioPlanning/commandPreview/milestones объявлены, но не отрендерены; хардкод RU-меток в JSX без i18n.
- Оба: ноль импортов из `apps/web/src` — несут только `package.json`/`next.config`/root tsconfig. Зелёный typecheck НЕ делает их используемыми.

### Риски
- **Риск тихой гнили:** дублирование между `planning-client` и inline-реализацией в `runtime-screen-view.tsx` означает, что backend-контракт поддерживается в двух местах; дрейф полей backend сломает кастующий `buildCompensatingCommands` без compile-time сигнала.
- **Риск ложной готовности:** богатый словарь интентов/capabilities создаёт впечатление работающей фичи, тогда как интерактивный слой не построен (~0%).
- **Риск устаревших доков:** Phase B-спеки ссылаются на несуществующие пути/маршруты — оживление потребует переоткрытия фактического состояния backend payload (он сейчас нетипизирован).
- **Риск оценки:** довести `planning-gantt-ui` до заявленной амбиции (drag-to-reschedule, inline-edit, авторинг зависимостей, виртуализация, resource load) — multi-week работа, по сути неоконченные ~55% исходного плана.

---

## 6. Рекомендация: **keep-disabled-decide-later**

**Обоснование:**
- Это НЕ мёртвый код: контракт `planning-client` живой и совпадает с backend 1:1; lib-слой обоих пакетов качественный и переиспользуемый; архитектура замысла обоснована и остаётся в документированном плане (Phase 3D, маршрут `/projects/[id]/timeline`).
- Но это и НЕ работающий продукт: ноль импортов из приложения, `planning-gantt-ui` интерактивно пуст на ~65%, host-адаптер не существует.
- `mark-dead` преждевременно — потеряем готовую и проверенную половину (`planning-client`) и качественный design-reference.
- `keep-and-revive` сейчас неоправданно — оживление UI-половины это multi-week greenfield, не входящий в текущий релизный фокус (self-hosted A/V comms).

**Оценка усилий на оживление (если/когда решим возрождать):**
- `planning-client` как живой data-слой (заменить дублирующую inline-реализацию): **дни, не недели** — контракт уже совпадает. Highest-leverage: заменить `Record<string,unknown>` реальными доменными типами из `packages/domain`, расширить компенсацию, добавить тесты API/409, импортировать клиент в один surface.
- `planning-gantt-ui` до read-only viewer на parity с `widgets/gantt`: ~неделя (config-fix + adapter + deps/transpile).
- `planning-gantt-ui` до заявленной амбиции (drag/inline-edit/dependency authoring/виртуализация/resource load): **multi-week**, по сути неоконченные ~55% исходного плана.

**Практичный путь к ценности:** оживить `planning-client` сейчас (дешёвый дедуп inline-реализации), а `planning-gantt-ui` держать как design-reference и доделывать в рамках Phase 3D, не отгружая as-is.

---

## 7. Немедленное действие (сделать сейчас в любом случае)

Чтобы baseline `pnpm typecheck` (`tsc -b`) позеленел **немедленно**, сохранив пакеты для оживления, выбрать ОДИН из вариантов:

**Вариант A (рекомендуется, минимально-инвазивный — отключить из сборки):**
1. Убрать ссылки на оба пакета из корневого `tsconfig.json` `references` (строки 6 и 10) — `tsc -b` перестаёт их собирать.
2. Убрать `@kiss-pm/planning-gantt-ui` / `@kiss-pm/planning-client` из `apps/web/package.json` deps и из `next.config.ts` `transpilePackages` (они и так не импортируются продуктом).
3. Оставить исходники пакетов на месте + добавить короткий README-маркер «paused, см. docs/audit/planning-packages-assessment.md».
4. `pnpm install` (sync lockfile) → `pnpm typecheck` → ожидается зелёный baseline.

**Вариант B (альтернатива — починить config, держать в сборке):** применить 3-шаговый config-fix из §3 (React-типы + pnpm install + domain reference, 1–2ч). Делать только если есть намерение оживлять `planning-client` в ближайшем спринте; иначе предпочесть A, чтобы не нести зелёный, но неиспользуемый код в build graph.

> Рекомендация по немедленному действию: **Вариант A** — снять блокировку baseline без затрат на починку неиспользуемого, сохранив всё для будущего оживления.
