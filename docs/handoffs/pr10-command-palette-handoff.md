# Хэндоф: PR10 «Command Palette + Saved Views v2»

**Кому:** любому агенту-исполнителю (Codex CLI / другой), продолжающему план UI-модернизации после PR9.
**Дата:** 2026-07-13. **Автор хэндофа:** Claude (сессия PR5–PR9).
**Мастер-план:** `docs/plans/product-improvement-pr5-plus-2026-07-12.md` (строки таблицы PR10/PR11 — канонический scope).

---

## 1. Контекст: что это за продукт и что уже сделано

KISS-PM — зрелый PM+CRM инструмент. Продуктовая рамка (подтверждена владельцем): **«мощный зрелый project management solution с PM-as-code подходом и agent-first философией»**. Никакого демо-хрома: каждый контрол либо стоит на реальном endpoint, либо честно помечен как недоступный. «Скоро» там, где endpoint существует, — считается халтурой.

Выполнено и влито в `master` (GitHub `Maxborland/KISS-PM`):

| PR | # | Суть |
|---|---|---|
| PR1–PR4 | #226–#229 | вкладки проекта, CRM-активация, canonical TaskPeek, agent partial-apply (+#230–232 follow-ups) |
| prep-B | #233 | `tokens.css` — единственный владелец `:root`; корневой `DESIGN.md`; ratchet-гейты |
| prep-A | #234 | e2e-карантин (19 спеков в `e2e/quarantine/`), 3 a11y переписаны |
| PR5 | #235 | Agent Workspace — эталонная поверхность №1 |
| PR6a | #236 (+#237) | Planning Cockpit contracts, work-model честность |
| PR6b | #238 | виртуализация Графика и матрицы ресурсов (@tanstack/react-virtual) |
| PR7 | #239 | Scenarios KISS Delta last mile (квитанция, TTL, откат через preview-гейт) |
| PR8 | #240 | CRM-грамматика: url-peek примитив `?task=`/`?deal=`, DealPeek, deep-link по всем воронкам |
| PR9 | (ветка `codex/dashboard-grammar`) | Dashboard summary-first, без fake signals, drill-down; Settings — фокус Segmented |

После PR10 останется **PR11** `codex/dark-motion-parity`: полная semantic dark map (~30 токенов `*-soft`/`*-text`, prio-чипы, тени), консолидация механизма темы (next-themes мёртв везде, кроме `sonner.tsx`), reduced-motion для tailwindcss-animate-оверлеев и widget-CSS; `/agent` — первая приёмочная поверхность.

## 2. Scope PR10 (из мастер-плана, ветка `codex/command-palette-context`)

Две части, обе обязательны:

### 2.1 Cmd/Ctrl+K Command Palette
- Строится **поверх прод-`WorkspaceShell` GlobalSearch** (найди GlobalSearch в `apps/web/src/workspace/`), а НЕ поверх Storybook-заглушки `shell/command-palette.tsx` — заглушку не промоутить и не расширять.
- Промоутить **неиспользуемые примитивы `apps/web/src/components/ui/command*`** (cmdk уже в зависимостях) — они лежали без консьюмеров со времён аудита.
- **Typed action groups на реальных permissioned-действиях**: группы (навигация, задачи, сделки, проекты, действия) наполняются только тем, что доступно роли текущего пользователя. Никаких пунктов-декораций: если действие требует права, которого нет, — пункт скрыт или честно disabled с причиной.
- **`types=`-фильтр API**: у существующего поискового endpoint (смотри API workspace-поиска в `apps/api/src/`) добавить/использовать фильтрацию по типам сущностей, чтобы палитра запрашивала только нужные группы.
- Навигация к сущностям — через существующую URL-peek-грамматику: `/my-work?task=<id>`, `/crm/deals?deal=<id>` (примитив `apps/web/src/workspace/lib/url-peek.tsx` из PR8; deep-link `?deal=` резолвится по всем воронкам, `?task=` — canonical TaskPeek).
- Keyboard-first: открытие Cmd/Ctrl+K из любой точки shell, полная навигация стрелками, Escape, видимый фокус, focus-return на элемент-инициатор.

### 2.2 Saved Views v2
- Фильтры матрицы ресурсов добавляются в payload сохранённых видов.
- **Version bump payload'а + tolerant parsing**: существующие сохранённые виды пользователей НЕ должны «повреждаться» — старый payload без версии парсится как v1 с дефолтами, неизвестные поля игнорируются, невалидный payload даёт честный fallback, а не крэш. Это главный риск PR10 — проверь миграцию чтения на реальных старых записях (создай вид до правок, прочитай после).
- Saved Views wiring уже существует (НЕ переделывать с нуля — найди текущий код сохранённых видов и расширяй).

### 2.3 Не входит в PR10
- Dark map, тема, motion — это PR11.
- Новые классы сценариев, auto-solver, персистентность разговоров агента — смежные треки вне плана.

## 3. Правила репо (обязательные)

1. **AGENTS.md — канон.** Прочитай целиком до старта. Ключевое: русский язык во всех коммуникациях/коммитах/PR; малые проверяемые срезы; честность (никаких fake-контролов, preview→apply, прототипные маркеры); финальный отчёт по §9 с change index.
2. **CodeGraph (AGENTS.md §8):** перед задачей — вход через `codegraph_*`/CLI, после — `codegraph sync` + change index в отчёте. **Внимание:** при работе в git-worktree общий индекс `.codegraph/` смешивает ворктри — в этом случае используй grep/read fallback и **задекларируй это явно** в отчёте (прецедент PR5–PR9, владелец в курсе).
3. **Дизайн-система:** `tokens.css` — единственный владелец `:root`-переменных; корневой `DESIGN.md` — авторитет. Запрещено: новые `:root`-переменные, hex-цвета, шрифты 10–12px raw-px, новые BEM-классы (freeze). Ratchet-гейт живёт в vitest: `apps/web/src/__health__/design-v3-enforcement.health.test.ts` (отдельного scripts-файла нет). Утилиты — `kiss-v4.css`.
4. **Tailwind v4 грабля:** `@plugin` в `globals.css` обязан идти ПОСЛЕ всех `@import` — иначе поздние импорты молча выпадают и превью полностью разстилизовано.
5. **Storybook-гейт:** `verify:storybook-contract` сканирует дерево навигации — английские слова в TITLE стори валят весь гейт.

## 4. Окружение и команды

- **Репо:** `E:\KISS-PM`, trunk — `master`. **ВАЖНО: локальная ветка `master` в основном чекауте — несвязанная OSS-история. Базой всегда служит `origin/master`** (сначала `git fetch origin master`).
- **Рабочий процесс:** свежий worktree `git worktree add .claude/worktrees/pr10-palette -b codex/command-palette-context origin/master`, в нём `pnpm install` (store общий, быстро).
- **Postgres:** docker `kiss-pm-postgres-1`, `127.0.0.1:55432`, user `kiss_pm`, пароль `kiss_pm_dev_password`. Своя БД на PR: `CREATE DATABASE kiss_pm_pr10;` затем `DATABASE_URL=postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm_pr10 pnpm db:reset:dev` (миграции+сид).
- **E2E:** playwright сам поднимает API+web через webServer; уникальные порты на PR: `E2E_API_PORT=4135 E2E_WEB_PORT=3135` (4133/4134 и 3133/3134 заняты прошлыми PR). Деструктивные спеки гейтятся `KISS_PM_E2E_DISPOSABLE_DATABASE=1`. Карантин: `e2e/quarantine/` игнорируется конфигом.
- **Гейты перед «готово» (все локально, с выводом):**
  ```
  pnpm typecheck
  pnpm --filter @kiss-pm/web test        # 487+ тестов, включая ratchet
  pnpm --filter @kiss-pm/web build
  # живые e2e (пример):
  DATABASE_URL=...kiss_pm_pr10 E2E_API_PORT=4135 E2E_WEB_PORT=3135 pnpm e2e -- e2e/smoke/<новый-спек>.spec.ts
  ```
- **CI GitHub Actions мёртв** с 2026-06-04: политика организации `allowed_actions=local_only` роняет все runs как `startup_failure`. Владелец отложил починку — **все гейты локальные**, зелёный локальный прогон = release-gate. Не трать время на починку Actions.
- **Не гоняй `next build` параллельно с работающим `next dev`** в одном ворктри — production-сборка пишет в тот же `.next` и отравляет dev-сервер (симптом: массово красные e2e; лечение: `rm -rf apps/web/.next`, перезапуск).

## 5. Цикл PR (отработан на #233–#240)

1. Ветка от `origin/master`, атомарные коммиты (conventional, русский), у каждого — рабочее состояние.
2. Самопроверка всех гейтов из §4 + живые e2e на своей БД.
3. Адверсариальное само-ревью диффа (логика, интеграция/регрессии старых консьюмеров, честность e2e) — почини найденное до пуша.
4. `git push -u origin <ветка>`; `gh pr create --base master` с телом: что/состав/проверки/известные границы.
5. **Codex-ревью сам НЕ приходит** (с 2026-07-12): триггерь комментарием `gh pr comment <N> --body "@codex review"`. Реакция 👀 на комментарии = принял; результат — review через ~5–10 мин.
6. Каждый тред ревью: исправь или аргументированно ответь, затем resolve через GraphQL `resolveReviewThread`. Добился **двух чистых волн** (повторный `@codex review` после пуша правок).
7. `gh pr merge <N> --merge` (merge-commit, НЕ squash), затем `git fetch origin master` и проверь head.

## 6. E2E-паттерны (эталоны в репо)

- `e2e/smoke/crm-deal-peek.spec.ts` — образец: try/finally-уборка (finalize/архивация в finally с допуском 409/422 повторного финала), ассерты терминальных состояний ленты (`alert count 0` + элемент списка/«Пока нет активностей.»), route-моки для кейсов, которые live-API не поддерживает, вьюпорт-блок 390px без горизонтального скролла.
- `e2e/smoke/canonical-task-peek.spec.ts` — DELETE-уборка с допуском [200, 404].
- Регрессия «клик внутри открытого peek не закрывает панель» — обязательна для любых новых поверхностей с URL-peek (Radix Portal всплывает по React-дереву: гварды DOM-contains `event.currentTarget.contains(event.target)` + `window.getSelection()` уже стоят в `deals-surface.tsx`/`schedule-surface.tsx` — не сломай и повтори паттерн, если добавляешь свои body-click триггеры).
- Сид: reader-роль — `planReader`; сидовые сущности типа `task-vektor-testing` имеют фиксированные даты — не завязывай новые ассерты на «дата в будущем».

## 7. Известные грабли (сэкономят часы)

- **`?deal=` deep-link:** API `GET /api/workspace/deal-stages` отдаёт стадии только default-воронки — live-рендер сделок чужих воронок ограничен; резолвер PR8 в этом случае честно снимает параметр с toast. Для палитры: переход на сделку из не-default воронки отработает через тот же резолвер.
- **fixed_units** — live-дефолт типа задач: движок пересчитывает `duration = work×1000/units` через `recalculateWorkModel(changedField:'workMinutes')`; любой sender `update_work_model` обязан слать engine-consistent пару (см. `engineConsistentWorkMinutes` в `schedule-surface.tsx`). Палитра не должна слать сырые правки work-model.
- **`sticky` внутри `overflow-auto`-карточек работает только с `max-h`** на контейнере.
- **Превью одиночной команды** — singular `preview-command`, батч — `preview-command-batch`: e2e должны ждать правильный вариант.
- **unit-suite web** изредка флейкает `socket hang up` (ECONNRESET) в `schedule-navigation-guard` — не связано с диффами, перезапусти прогон.
- Порты 3000/3001/4000/4010 могут быть заняты чужими стендами — «ложные 403» именно оттуда; всегда свои порты.
- Виртуализованные списки (График, матрица): DOM содержит ~33 строки из N — e2e-селекторы «по всем строкам» не работают, скролль к цели.

## 8. Definition of Done PR10 (из плана + правила)

- Полный пользовательский путь (палитра открывается → ищет → действие исполняется → фокус возвращается), не «кнопка присутствует».
- Состояния: loading / empty / error / permission / partial.
- Keyboard и focus полностью.
- Свежий e2e-смоук на текущих роутах, зелёный локально (admin + reader-роль).
- Скриншоты 390/768/1280 (normal + reduced-motion) в `.superloopy/evidence/frontend/pr10-palette/`.
- Ни одного нового локального токена / декоративной motion.
- Saved Views: доказанная обратная совместимость старых payload'ов (тест: вид, созданный до правок, читается после).
- Отчёт §9 AGENTS.md + change index (CodeGraph или задекларированный fallback).

---

Вопросы по контексту, которых нет в этом файле, ищи в: `docs/plans/product-improvement-pr5-plus-2026-07-12.md`, `AGENTS.md`, `DESIGN.md`, телах PR #233–#240 (в каждом — состав/проверки/границы).
