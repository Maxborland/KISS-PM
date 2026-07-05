# Баги: Проекты — часть A (/projects, /projects/[id], /overview, /schedule)

Прогон фазы 3 Full Product Evaluation Loop, 2026-07-04.
Стенд: web http://127.0.0.1:3000 → API http://127.0.0.1:4020, реальный Postgres-seed (tenant-alpha: project-vektor-portal, project-gorset-migration, project-demo-crm-intake).
Роли: A=admin, PR=plan-reader-no-resources, RR=resource-reader, beta=beta@kiss-pm.local.
Деструктивные проверки — на project-demo-crm-intake; состояние возвращено (5 задач, исходные названия/WBS/%/зависимости; выросли только planVersion 2→16 и аудит-история QA-коммитов).

---

## BUG-PROJ-01 · КРИТИЧЕСКИЙ · Создание задачи на /schedule невозможно ни одним способом (хардкод `statusId:"todo"`)

**Где:** `/projects/[id]/schedule` — кнопка «Задача» (TaskModal), инлайн-строка внизу, ПКМ «Создать подзадачу/рядом».

**Шаги:**
1. Админ → `/projects/project-demo-crm-intake/schedule`.
2. «Задача» → название «QA-тест без исполнителя» → «Создать» (исполнитель не выбран).
3. Повторить через нижнюю инлайн-строку (Enter).

**Ожидание:** задача создана, «Коммит vN применён».

**Факт:** оба запроса (`apply-command-batch` / `apply-command`) → **409 planning_precondition_failed**. UI шлёт `"statusId":"todo"` — такого статуса в тенанте нет; бэк отвечает `«Команда ссылается на неизвестный или архивированный статус задачи»` (реальные id вида `task-status-in-progress`). Если выбран исполнитель — плюс мок-`resourceId` (см. BUG-PROJ-02). Все 3 пути создания падают.
Контрольный опыт: `task.create` через API с валидным `statusId:"task-status-in-progress"` → **200, v13** — блокер именно в хардкоде UI.
Дополнительно: notice после отказа показывает warning-сообщение «Отклонено бэком: У задачи есть трудоемкость, но нет исполнителя» вместо реальной блокирующей ошибки про статус; в случае с исполнителем модалка закрывается вообще без сообщения.

**Доказательства:** bug-proj-06-task-create-rejected.png; request body `{"type":"task.create","payload":{...,"statusId":"todo",...}}`; response body с `planning_command_invalid`.

---

## BUG-PROJ-02 · КРИТИЧЕСКИЙ · Селекты исполнителей — статический мок RESOURCES; назначение молча не применяется

**Где:** `/schedule` — ячейка «Ресурсы» (ResourceEditor) и TaskModal «Исполнитель» (импорт `RESOURCES` из `apps/web/src/delivery/lib/planning-demo-data.ts`).

**Шаги:**
1. Админ → `/projects/project-demo-crm-intake/schedule`.
2. Клик по ячейке «Ресурсы» задачи 3 → в списке «Петров А., Иванова М., Орлова Д., …» (мок), реальных пользователей (Анна Администратор, Игорь Инженер, Роман Ресурсный…) нет.
3. Выбрать «Петров А.».

**Ожидание:** список из `GET /api/workspace/users`; назначение сохраняется.

**Факт:** уходит `assignment.upsert` с `"resourceId":"u-petrov"` → **409 planning_precondition_failed** «Назначение ссылается на неизвестный ресурс». UI не показывает НИКАКОЙ ошибки (только console 409), ячейка молча возвращается к прежнему значению. Назначить исполнителя из UI невозможно в принципе. Бэк корректно защищает данные (порчи нет).

**Доказательства:** bug-proj-05-mock-resources-select.png; request `{"resourceId":"u-petrov",...}`; response `planning_precondition_failed`.

---

## BUG-PROJ-03 · КРИТИЧЕСКИЙ · `task.update_progress` — пустой коммит: 200/vN/audit, но значение не сохраняется

**Где:** `/schedule` — инлайн-правка «%», Gantt-ползунок %; сам apply-command контур.

**Шаги:**
1. Админ → `/projects/project-demo-crm-intake/schedule`, задача 3 «Обновить описание…» (10%).
2. 2×клик по «%», ввести 20, Enter → notice «Коммит v3 применён · затронуто задач: 1», шапка «план v3».
3. Свежий `GET …/read-model`.

**Ожидание:** percentComplete=20 в v3.

**Факт:** percentComplete **остался 10** при planVersion=3. Повтор чистым API: `task.update_progress` 30 при v3 → 200, `applied`, `auditEventId`, `newPlanVersion:4`, но даже в `readModel` самого ответа pct=10. Версия растёт, аудит пишется, изменение теряется молча. Контрольный опыт: `task.update_identity` (название) тем же контуром сохраняется корректно — сломана именно update_progress.

**Доказательства:** request `{"type":"task.update_progress","payload":{"taskId":"task-demo-description","percentComplete":20}}` → 200; последующий read-model pct=10, planVersion=3/4.

---

## BUG-PROJ-04 · MAJOR · Шапка проекта — хардкод «ПР · Производственный портал · Релиз 2 · В работе» для любого проекта

**Где:** все `/projects/[id]/*` (DeliveryFrame, PROJECT/PROJECT_FALLBACK в 8 поверхностях).

**Шаги:** админ → `/projects/project-vektor-portal/overview` и `/projects/project-demo-crm-intake/schedule`.

**Ожидание:** код/имя/статус реального проекта («Портал подрядчиков Вектор», «CRM intake» — `GET /api/workspace/projects/:id` их отдаёт).

**Факт:** оба проекта показывают «ПР / Производственный портал · Релиз 2 / В работе». Из read-model берутся только версия/дедлайн/финиш (они корректны: план v2, дедлайн 08.07.2026). На forbidden/error-фолбэке (RR, несуществующий id) шапка показывает выдуманный «**план v17**» вместо «—».

**Доказательства:** bug-proj-03-overview-header-today.png (vektor), прогон demo-crm-intake (та же шапка), RR-прогон («план v17» без прав на read-model).

---

## BUG-PROJ-05 · MAJOR · Мок-эпоха времени: «Сегодня»=28.04.2026, таймлайн от 02.03.2026, просрочки от 23.06.2026 (реальная дата 04.07.2026)

**Где:** `/schedule` (BASE_MS=2026-03-02, «Сегодня»=2026-04-28), `/overview` (TODAY=2026-06-23).

**Шаги:**
1. Админ → `/projects/project-vektor-portal/schedule` (проект 01.06–10.07.2026).
2. Замерить маркер «Сегодня»: left=1140px при 20px/день от эпохи 02.03.2026 → 57 дней → **28.04.2026** (реально 04.07.2026 → должен быть 2480px).
3. `/overview`: сигнал «Просрочено задач: 3 — срок раньше **23.06.2026**, не закрыты».

**Ожидание:** «Сегодня» и расчёт просрочек — от реальной даты; таймлайн — от старта проекта (эталон уже есть: assignments-surface берёт origin из `readModel.project.plannedStart`).

**Факт:** маркер «Сегодня» стоит на 28.04.2026; таймлайн начинается «Мар 02» — 3 пустых месяца до старта проекта; просрочки считаются от вшитого 23.06.2026 (список просрочек занижен: реально просрочено больше задач, чем 3 на 23.06).

**Доказательства:** bug-proj-04-schedule-today-epoch.png, bug-proj-03-overview-header-today.png.

---

## BUG-PROJ-06 · MAJOR · Строки списка /projects некликабельны — карточка проекта недостижима из UI

**Где:** `/projects`, таблица проектов.

**Шаги:** админ → `/projects`, клик/двойной клик/средняя кнопка по строке.

**Ожидание:** строка — ссылка на `/projects/[id]` (роут существует и работает).

**Факт:** `<tr>` с `cursor:default`, `title="Демо-прототип: карточка проекта — отдельный экран рабочего приложения"`, без ссылок и обработчиков. Вся область Project Delivery доступна только ручным вводом URL.

**Доказательства:** bug-proj-01-projects-list.png; DOM-проверка: `{title:"Демо-прототип…", cursor:"default", hasLink:false, onclick:false}` у всех строк.

---

## BUG-PROJ-07 · MAJOR · Таб-бар поверхностей (Обзор…Настройки) — спаны без навигации

**Где:** все `/projects/[id]/*` (DeliveryFrame, DELIVERY_TABS).

**Шаги:** админ → `/projects/project-vektor-portal/overview`, клик по табу «График».

**Ожидание:** `<Link>` на `/projects/[id]/schedule` (все 9 роутов существуют).

**Факт:** табы — `<span title="Демо-прототип: переключение поверхностей появится в приложении">`, клик ничего не делает. Переключение поверхностей возможно только ручным URL.

**Доказательства:** DOM-проверка: `{tag:"SPAN", title:"Демо-прототип…", href:null}` для всех неактивных табов.

---

## BUG-PROJ-08 · MAJOR · Каркас WorkspaceShell — фейковая навигация, врущие бейджи, disabled-поиск, хардкод-аватар, вечное «Сохранено»

**Где:** все роуты области (сайдбар, топбар, таб-бар).

**Факт (подтверждено на рантайме под A/PR/RR/beta):**
- пункты сайдбара — спаны `title="Демо-прототип: навигация подключится в рабочем приложении"`, клик ничего не делает;
- бейджи хардкод: «Проекты 8» при реальных 3 проектах (12/8/37/42 всюду, у всех ролей и тенантов одинаково);
- глобальный поиск «Найти задачу или ресурс» — `disabled` input;
- аватар «КБ» одинаков у admin/PR/RR/beta («Борис Администратор», «Анна Администратор» и т.д. — все «КБ»), меню сессии нет;
- индикатор «Сохранено» горит всегда, в т.ч. на forbidden-состоянии у RR и во время отказов apply.
- RR видит пункт «Проекты» в сайдбаре, не имея права projects.read.

**Ожидание:** реальная навигация, реальные счётчики (или без счётчиков), рабочий/скрытый поиск, текущий пользователь, честный индикатор сохранения.

**Доказательства:** bug-proj-01-projects-list.png (общий каркас), снапшоты под PR/RR.

---

## BUG-PROJ-09 · MAJOR · demoAction-кнопки disabled при существующих целевых роутах/фичах

**Где:** `/overview` («Открыть График» ×2, «Открыть Сценарии», «Открыть Baseline», «Показать путь», «Все» у коммитов), `/schedule` («Baseline», «Фильтры», «Колонки»).

**Шаги:** админ → `/projects/project-vektor-portal/overview`, DOM-проверка кнопок сигналов.

**Ожидание:** ссылки на существующие `/schedule`, `/scenarios`, `/baseline`, `/commits`.

**Факт:** все кнопки `disabled` с `title="Демо-прототип: … подключится к рабочему приложению"`, при этом оформлены как акцентные действия. Baseline-снимок реально доступен на вкладке Baseline, фильтров на Графике нет вовсе.

**Доказательства:** DOM-дамп кнопок: `{disabled:true, title:"Демо-прототип…"}` у всех 6 на overview и 3 на schedule.

---

## BUG-PROJ-10 · MAJOR · /projects/[id]: несуществующий id тихо подменяется первым проектом; селектор не меняет URL

**Где:** `/projects/[id]` (project-detail-surface, useEffect-подмена).

**Шаги:**
1. Админ → `/projects/project-does-not-exist-xyz`.
2. Сменить проект в селекторе «Проект:» на «CRM intake».

**Ожидание:** (1) явное «Проект не найден» (бэк честно отдаёт 404 `project_not_found`); (2) смена селектора обновляет URL.

**Факт:** (1) URL остаётся `/projects/project-does-not-exist-xyz`, но показана карточка **project-vektor-portal** — fetch 404 проглатывается, id подменяется первым в списке; RU-состояние `project_not_found` не показывается никогда. (2) Селектор реально грузит `getProjectDetail('project-demo-crm-intake')`, URL не меняется — refresh/шаринг ссылки теряют выбор.

**Доказательства:** bug-proj-02-fake-id-substitution.png; network: `GET /api/workspace/projects/project-does-not-exist-xyz → 404 {"error":"project_not_found"}` + рендер карточки Вектор.

---

## BUG-PROJ-11 · MAJOR · Overview считает статусы/вехи по мок-конвенциям — KPI и списки врут на live-данных

**Где:** `/projects/[id]/overview`.

**Шаги:** админ → `/projects/project-vektor-portal/overview`; сравнить с `/projects/project-vektor-portal` (карточка) и read-model.

**Ожидание:** «Прогресс: 1 закрыто · 3 в работе» (как на карточке), закрытые задачи исключены из «Ключевых задач», веха `task-vektor-milestone-launch` (durationMinutes=0) — в «Контрольных точках».

**Факт:**
- плитка «ПРОГРЕСС 25% — **0 закрыто · 0 в работе**» (реально 1 закрыта, 3 в работе): read-model-задачи не имеют статусной категории, счётчики всегда нули;
- «Ключевые задачи» содержат «Сбор требований 100%» (закрытая) — фильтр закрытых не работает по той же причине;
- «Контрольные точки» показывают только «Дедлайн релиза», веха проекта отсутствует (детекция только по `customFields.kind`, которого нет в live-данных; /schedule ту же задачу вехой показывает);
- аватары исполнителей «—» (customFields.resLabel нет на live).

**Доказательства:** bug-proj-03-overview-header-today.png; read-model-дамп: у задач нет status/statusCategory/kind; карточка проекта показывает «1 закрыто · 3 в работе».

---

## BUG-PROJ-12 · MINOR · Ложные баннеры «Прототип · данные in-memory, не сохраняются» на live-роутах

**Где:** `/projects` («Транспорт — contract-mock… Данные in-memory»), `/schedule` («Данные in-memory, не сохраняются»), `/overview` («ПРОТОТИП · IN-MEMORY»), `/projects/[id]`.

**Факт:** все правки реально пишутся в Postgres через apply-command (проверено: planVersion demo-проекта вырос 2→16, изменения переживают reload). Пользователь, читающий «не сохраняются», делает необратимые правки в проде.

**Ожидание:** тексты соответствуют среде (live = данные реальные, сохраняются).

---

## BUG-PROJ-13 · MINOR · Summary-задачи с детьми не распознаются на live: нет свёртки, редактируемы как листья

**Где:** `/projects/[id]/schedule` (vektor: «Этап 1. Подготовка», «Этап 2. Реализация» имеют детей 1.1/1.2, 2.1/2.2 по parentTaskId).

**Ожидание:** summary-строка: шеврон свернуть/развернуть, dur/труд/% недоступны для правки, бар без drag-ручек.

**Факт:** «Этап 1» рендерится обычной задачей — шеврона нет (свёртка недоступна вообще), «Длит 10 дн»/«40%» редактируемы, бар с ручками сдвига/resize/%. Детекция summary, судя по поведению, завязана на мок-конвенцию, а не на parentTaskId.

**Доказательства:** read-model: `task-vektor-requirements.parentTaskId=task-vektor-phase-prep`; DOM: в name-cell строки 1 нет кнопки-шеврона, только placeholder-спан.

---

## BUG-PROJ-14 · MINOR · Под PR план показывает сырые user-id вместо имён исполнителей

**Где:** `/schedule` (колонка «Ресурсы»), `/overview` (сигнал перегруза) под ролью PR.

**Шаги:** PR → `/projects/project-vektor-portal/schedule`.

**Ожидание:** имена исполнителей (или честное «нет прав на справочник»), деградация без сырых id.

**Факт:** `GET /api/workspace/users` → 403 (у PR нет права), и UI показывает `user-alpha-admin`, `user-alpha-engineer` в колонке «Ресурсы» и в сигнале «Перегруз ресурсов: user-alpha-engineer · 1 дн». Примечание-политика: PR (без `project_resources.read`) получает в read-model полный `resourceLoad` (buckets/overloads) — стоит зафиксировать, ожидаемо ли это.

**Доказательства:** bug-proj-07-pr-raw-ids.png; network: users → 403.

---

## BUG-PROJ-15 · MINOR · Отказы показываются raw-кодами; 403 истории коммитов маскируется под «История пуста»

**Где:** `/projects` (RR), `/schedule` (PR-мутации), `/overview` (PR).

**Факт (рантайм):**
- RR на `/projects`: «Не удалось загрузить / **permission_missing** / Повторить» — raw-код вместо RU-текста «Нет прав…» (сам отказ и retry работают, вечной загрузки нет);
- PR правит «%» → notice «Отклонено бэком: **permission_missing**» — raw-код; мутационные контролы под PR заранее не блокируются (отказ виден только после действия);
- PR на `/overview`: `GET /api/tenant/current/audit-events` → 403, но блок показывает «**История пуста**» — неотличимо от реально пустой истории.
- контраст: RR на `/overview`,`/schedule` получает корректный RU-текст «Доступ ограничен / У вас нет прав на просмотр этого раздела».

**Ожидание:** человекочитаемые RU-тексты для permission_missing; различать «пусто» и «нет прав».

---

## BUG-PROJ-16 · LOW · Фильтр «Все/Активные» — демо-переключатель без пояснения; в таблице нет сортировки и поиска

**Где:** `/projects`.

**Факт:** «Все» и «Активные» показывают одинаковые 3 строки (API отдаёт только активные), обещанной честной подписи у «Все» нет; сортировка и поиск по таблице отсутствуют полностью.

**Ожидание:** либо реальный фильтр по статусу, либо подпись, что архивные недоступны; базовая сортировка/поиск.

---

# Часть B (assignments / resources / baseline / calendars / scenarios / commits / settings)

Прогон части B, 2026-07-04. Стенд: web http://127.0.0.1:3000 → API http://127.0.0.1:4020, реальный Postgres-seed (tenant-alpha).
Деструктив — на project-demo-crm-intake. Восстановлено к поведению: назначения/трудозатраты/задачи вернулись; planVersion вырос 16→30 (QA-коммиты + пустышки accept_overload). Неустранимые остатки (нет обратных команд в домене): baseline `baseline-n1` (свежий снимок стал активным); строки-исключения календаря `hol-n1`@2026-05-20 и `ex-n2`@2026-05-21 переведены в 480 мин (полный рабочий день = эффективно «нет исключения», но строки остались).

**Продолжение (scenarios/commits/settings), 2026-07-04:** planVersion demo-crm-intake вырос 30→35 (сценарий-апплай v31, task.update_progress v32, 3× project.deadline.move v33/v34/v35 — дедлайн возвращён к исходным 15.06.2026 в v35). Остаток: реассайн от сценария «Балансированный» (Игорь Инженер частично → «Outsider Test» на задаче 1, +1ч соисполнителем) не откачен — обратной команды в UI для scenario-apply нет (см. BUG-PROJ-24), эффект безвреден для теста ролей (Outsider Test — существующий QA-сид-аккаунт, не реальный сотрудник). **project-vektor-portal и project-gorset-migration** для мутаций planning оказались непригодны ИЗНАЧАЛЬНО (сид-данные, не QA-порча) — см. BUG-PROJ-23; чистые apply-тесты перенесены на project-demo-crm-intake.

---

## BUG-PROJ-17 · MAJOR · Assignments: диалог «Добавить исполнителя» (+) предлагает МОК RESOURCES, а не реальных users

**Где:** `/projects/[id]/assignments` — кнопка «+» на строке задачи → AddAssigneeDialog (`assignments-editors.tsx`, импорт `RESOURCES` из `planning-demo-data.ts`).

**Шаги:**
1. Админ → `/projects/project-vektor-portal/assignments` (или любой проект).
2. «+» на строке задачи 1.1 «Сбор требований».
3. Открыть селект «Ресурс».

**Ожидание:** список из live-справочника (`GET /api/workspace/users` / `useResourceDirectory`): Анна Администратор, Игорь Инженер, Роман Ресурсный, Никита Без Ресурсов.

**Факт:** селект показывает статический мок «Петров А. · Менеджер проекта, Иванова М. · Дизайнер, Орлова Д., Лебедева Е., Сергеев П., Дмитриев К., Фёдоров И., Михаил К., Кузнецов Н.» — НИ ОДНОГО реального пользователя. Добавление такого исполнителя уходит `assignment.upsert` с мок-`resourceId` → **409 precondition_failed** «неизвестный ресурс» (тот же класс, что BUG-PROJ-02 на /schedule). Контраст: инспектор назначения (клик по исполнителю, PROJ-077) селект «Ресурс» берёт ПРАВИЛЬНО из live-справочника (Анна/Игорь/Никита/Роман) — т.е. правильный механизм в компоненте есть, но диалог «+» его не использует.

**Доказательства:** bug-proj-17-assignments-mock-resources.png; сравнение опций диалога «+» (мок) vs инспектора (live).

---

## BUG-PROJ-18 · MAJOR · Assignments: «Снять исполнителя» на строке исполнителя/соисполнителя (executor-плейсхолдер) — фантомный успех, назначение не удаляется

**Где:** `/projects/[id]/assignments` — инспектор назначения → «Снять исполнителя» (`assignment.delete`).

**Шаги:**
1. Админ → `/projects/project-demo-crm-intake/assignments`.
2. Задача 4 «Проверить результат импорта Gantt» → клик по «Игорь Инженер Соисполнитель · 100% · 0 ч» (плейсхолдер роли, id `task-…-user-alpha-engineer-co_executor`, workMinutes=null).
3. «Снять исполнителя».

**Ожидание:** исполнитель снят либо честный отказ.

**Факт:** бэк отвечает **200**, audit `planning.assignment.deleted`, `afterState.changedAssignmentIds:[…co_executor]`, planVersion растёт (v19→v20) — но в read-model назначение `task-demo-gantt-review-user-alpha-engineer-co_executor` **остаётся** (регенерируется из executor-списка задачи). Строка исполнителя в UI не исчезает. Пустой коммит + ложный успех (класс BUG-PROJ-03).
Контроль: снятие РЕАЛЬНОГО назначения (`assignment-demo-gantt-review-engineer`, workMin 240) тем же контуром удаляет корректно (v20→v21, realAssignmentDeleted=true) → баг только у executor/co_executor-плейсхолдеров (workMinutes=null).

**Доказательства:** audit-событие v20 (assignment.delete → succeeded, changedAssignmentIds содержит id) + read-model после: назначение на месте.

---

## BUG-PROJ-19 · MAJOR · Resources: «Снять перегруз» (risk.accept_overload) — пустышка на DB-бэкенде; перегруз не снимается и не принимается

**Где:** `/projects/[id]/resources` — drilldown ячейки → «Снять перегруз» (`resource-load-matrix.tsx` → `risk.accept_overload`).

**Шаги:**
1. Админ → `/projects/project-demo-crm-intake/resources`, клик по перегруженной ячейке Игорь Инженер · 2026-05-20 (150% · 12/8 ч).
2. «Снять перегруз».

**Ожидание (по семантике команды):** перегрузка помечается как принятый риск, попадает в `resourceLoad.acceptedOverloads`, исключается из целей Сценариев, title ячейки → «перегруз принят».

**Факт:** команда `risk.accept_overload` → 200, applied, planVersion растёт (v22→v23), но:
- в `planningRepository.ts:1117-1118` case `risk.accept_overload` — **NO-OP (`return;` без записи в БД)**;
- read-model `resourceLoad.acceptedOverloads` — **отсутствует** (никогда не заполняется на DB-бэкенде, только в mock-planning-backend/Storybook);
- перегруз **остаётся** в матрице (`overloadStillPresent=true`), KPI «Перегруз 1 чел. +17 ч» не меняется.
Итог: контрол пишет коммит+аудит, но не имеет НИКАКОГО эффекта на live. Плюс исходная семантика подписи спорна: «Снять перегруз» на деле = «принять риск перегруза» (PROJ-068), но и принятие не работает.

**Доказательства:** код `planningRepository.ts:1117`; runtime: apply 200 / newVersion 23 / acceptedOverloads absent / overloadStillPresent true; матрица после — перегруз на месте.

---

## BUG-PROJ-20 · MAJOR · Resources+Calendars: диалог «Отсутствие»/«Исключение» — МОК RESOURCES + хардкод-даты 04–08.05.2026; отсутствие невозможно добавить

**Где:** `/projects/[id]/resources` кнопка «Отсутствие» и `/projects/[id]/calendars` кнопка «Исключение» — общий AbsenceDialog (`resources-editors.tsx`, импорт `RESOURCES`).

**Шаги:**
1. Админ → `/projects/project-demo-crm-intake/resources` → «Отсутствие».
2. Селект «Сотрудник» = «Петров А.» (мок, дефолт); даты дефолт 2026-05-04…2026-05-08.
3. Задать даты в диапазоне проекта (19–20.05), «Добавить отсутствие».

**Ожидание:** список из live-users; отсутствие добавлено батчем `calendar.exception.upsert` по рабочим дням.

**Факт:**
- селект показывает мок «Петров А. … Кузнецов Н.» (те же 9, что BUG-PROJ-17), реальных пользователей нет; даже в ресурсном виде календаря (выбран Игорь) диалог дефолтит на «Петров А.»;
- дефолтные даты хардкод 2026-05-04/05-08 (мок-эпоха; для проектов вне мая — мимо);
- сабмит → **409 planning_precondition_failed**: `«Исключение ссылается на неизвестный ресурс»` ×2 + `«Команда ссылается на неизвестный или неактивный ресурс»` ×2; UI-нотис — raw-код «Отклонено: planning_precondition_failed» (класс BUG-PROJ-15). Добавить отсутствие/исключение из UI невозможно.

**Доказательства:** опции диалога (мок) на обеих вкладках; network `apply-command-batch → 409` + response body с validationIssues; нотис «Отклонено: planning_precondition_failed».

---

## BUG-PROJ-21 · MINOR · Baseline: имя снимка, введённое пользователем, нигде не отображается — все снимки называются «Снимок плана»

**Где:** `/projects/[id]/baseline` — форма «Зафиксировать базовый план» (поле «Название снимка») + история снимков.

**Шаги:**
1. Админ → `/projects/project-demo-crm-intake/baseline` → «Зафиксировать базовый план».
2. Ввести имя «QA snapshot 2026-07-04» → «Зафиксировать».

**Ожидание:** снимок в истории отображается под введённым именем.

**Факт:** `baseline.capture` передаёт `label` в бэк и он пишется в БД (`captureBaseline`), НО read-model не возвращает поле имени: `mapBaselines` (`planningRepository.ts:1695`) отдаёт только `{id, capturedAt, tasks}`. UI хардкодит «Снимок плана» для КАЖДОГО снимка. Введённое имя молча теряется для отображения; оба снимка demo-проекта в истории — «Снимок плана».

**Доказательства:** read-model baselines: keys `[id, capturedAt, tasks]` (нет name/label); UI-история показывает «Снимок плана · активный» и «Снимок плана · архив».

---

## BUG-PROJ-22 · MAJOR · Baseline: свежезафиксированный снимок сразу показывает ложные отклонения сроков (Δ дн. ≠ 0 при Δ работы 0) — capture морозит authored-даты, сравнение идёт против calculated-плана

**Где:** `/projects/[id]/baseline` — плитки + таблица «Отклонения от базового плана» (`baselineComparison`).

**Шаги:**
1. Админ → `/projects/project-demo-crm-intake/baseline` → «Зафиксировать» (снимок = текущий план).
2. Сразу посмотреть таблицу отклонений и плитки.

**Ожидание:** сразу после фиксации отклонения = 0 (снимок ≡ текущий план); mock-бэкенд именно так и делает («baseline.capture freezes the current plan; zero deltas»).

**Факт:** таблица показывает НЕнулевые дельты немедленно: задача 3 «Обновить описание…» баз. 23.05 → тек. 27.05 = **+4 дн.**; задачи 1/4/5 = **−1 дн.**; плитка «Изменилось задач 4 из 5 · 80%», «Финиш проекта +4 дн.» (при этом «Δ работы 0 ч»). Причина: `baseline.capture` замораживает **authored** `plannedStart/plannedFinish` задачи (task-demo-description → 2026-05-23), а колонка «Финиш тек.» в сравнении берёт **calculated** финиш движка (2026-05-27). Basis рассинхронизирован → сравнение конфаундит «authored↔calculated» дрейф с «baseline↔current». На live baseline-сравнение вводит в заблуждение (то же и на vektor: −1/−2/−5 дн. частично артефакт).

**Доказательства:** bug-proj-22-baseline-spurious-deltas.png; read-model: baseline-n1 task-demo-description plannedFinish 2026-05-23 vs calculatedFinish 2026-05-27; comparison.baselineId=baseline-n1 (активный свежий).

---

## BUG-PROJ-23 · КРИТИЧЕСКИЙ · Одна невалидная задача (веха с invalid_work_model) навсегда блокирует ВСЕ planning-команды проекта — /schedule, /scenarios, /baseline, /assignments, /calendars, /settings

**Где:** бэкенд `applyPlanningCommandHandler.ts:164-180` (`apps/api/src/planning/applyPlanningCommandHandler.ts`) + `previewPlanningCommand`/`previewPlanningCommands` (`apps/api/src/planning/planningCommandCore.ts:7-17,19-58`).

**Шаги:**
1. `GET …/planning/read-model` на `project-vektor-portal` и на `project-gorset-migration` → `calculatedPlan.validationIssues` содержит `{"code":"invalid_work_model","severity":"error","entity":{"type":"Task","id":"task-vektor-milestone-launch"}}` / `"task-gorset-milestone-signoff"` — ЕЩЁ ДО каких-либо QA-правок (сид-данные).
2. Админ → `/projects/project-gorset-migration/scenarios` → «Балансированный» (реассайн работы на др. ресурса) → «Применить»: **409 planning_precondition_failed**, validationIssues = тот же `invalid_work_model` по вехе.
3. То же «Агрессивный» (только `risk.accept_overload`, вообще не трогает задачи-вехи) → **тот же 409** с тем же `invalid_work_model` по несвязанной вехе.
4. Прямой пробный `apply-command` с безобидной `task.update_custom_field` на СОВЕРШЕННО ДРУГОЙ задаче (`task-gorset-phase-analysis`, не веха) → **тоже 409 planning_precondition_failed**, тот же validationIssue по вехе.

**Ожидание:** блокирующая проверка (`isBlockingValidationIssue` = severity `"error"`) должна применяться к issues, СВЯЗАННЫМ с конкретной командой/затронутыми сущностями, а не ко всему пересчитанному плану целиком.

**Факт:** `previewPlanningCommand`/`previewPlanningCommands` кладут в `validationIssues` ПОЛНЫЙ `calculatedPlan.validationIssues` пересчитанного плана (не diff, не scoped к команде) — `applyPlanningCommandHandler.ts:165-172`. Если план уже содержит ЛЮБУЮ issue с `severity:"error"` (здесь — сид-веха с некорректной моделью Work/Duration/Units), то АБСОЛЮТНО ЛЮБАЯ последующая команда — `apply-command`, `apply-command-batch`, `scenarios/:id/apply` — отклоняется с 409, независимо от того, что она меняет. Де-факто весь planning-контур проекта необратимо «закирпичен» до ручного фикса в БД.
Контроль: `project-demo-crm-intake` (`calculatedPlan.validationIssues = []`) — там ЛЮБЫЕ команды применяются нормально (см. BUG-PROJ-01…22 и ниже) — подтверждает, что причина именно в пред-существующей issue, а не в самом контуре apply.
Пострадавшие живые проекты: **project-vektor-portal, project-gorset-migration** — оба обычных стенд-проекта из инвентаря части A, оба теперь непригодны для ЛЮБЫХ мутаций planning.

**Доказательства:** bug-proj-23-scenario-balanced-apply-fails.png; read-model gorset/vektor `calculatedPlan.validationIssues`; response `apply-command` на `task-gorset-phase-analysis` (несвязанная задача) → 409 с issue по вехе `task-gorset-milestone-signoff`.

---

## BUG-PROJ-24 · КРИТИЧЕСКИЙ · «Откат» на /commits недостижим НИ ДЛЯ ОДНОГО коммита — механизм отслеживания «последнего apply сессии» живёт в отдельном hook-инстансе каждой поверхности

**Где:** `apps/web/src/delivery/lib/use-planning.ts` (`lastApplyRef`, строки ~80, 125-149, 216-247) + `apps/web/src/delivery/commits/commits-surface.tsx` (`onRevert`, `canRevert`/`latestRevert`).

**Шаги:**
1. Админ → `/projects/project-demo-crm-intake/schedule`, 2×клик по «%» задачи 2 → 5% → Enter. Коммит v32 применён, кнопка «Откат» в тулбаре Графика становится **активной** (не disabled).
2. НЕ нажимая «Откат», перейти на `/projects/project-demo-crm-intake/commits`.
3. В деталях коммита v32 («Обновлён прогресс»).

**Ожидание:** коммит v32 — последний apply этой браузерной сессии, ожидается «Откатить» доступным (документировано в баннере: «Откат — через buildCompensatingCommands + apply-command-batch»; на /scenarios прямо обещано «Откат — через поверхность «Коммиты»»).

**Факт:** v32 показывает **«Откат недоступен (необратимая операция или системная запись)»** — тот же текст, что и у коммитов часовой давности. Причина: `usePlanning(projectId)` — обычный hook, `lastApplyRef` — `useRef`, ЛОКАЛЬНЫЙ для конкретного React-компонента, который его вызвал. `/schedule`, `/commits`, `/scenarios`, `/baseline`, `/assignments` — это ОТДЕЛЬНЫЕ поверхности, каждая монтирует СВОЙ собственный экземпляр `usePlanning`, со своим пустым `lastApplyRef=null`. `/commits` никогда не вызывает `apply`/`applyBatch` до нажатия «Откатить» (только `onRevert` их вызывает, а `onRevert` требует уже истинного `latestRevert` — замкнутый круг). Итог: `canRevert`/`latestRevert` на `/commits` **всегда** `null`/`false`, для ЛЮБОГО коммита, независимо от давности и от того, кто и как его применил.
Дополнительно: `applyScenario` (используется `/scenarios`) вообще НЕ обновляет `lastApplyRef` (в отличие от `apply`/`applyBatch`) — т.е. даже если починить межстраничный баг, коммиты сценариев всё равно никогда не попадут под откат тем же путём.
Итог: функция «Откат» на `/commits` — по факту мёртвый код; заявленный в UI и коде принцип «доступен для последнего apply сессии» неверен — доступности нет НИКОГДА через штатную навигацию.

**Доказательства:** bug-proj-24-commit-revert-unavailable.png; код `use-planning.ts:80,125-149,216-247`, `commits-surface.tsx:64-74,95,107,141-143`; рантайм-проверка (см. шаги).

---

## BUG-PROJ-25 · MAJOR · Сценарии «Балансированный»/«Устойчивый»: альтернативный ресурс выбирается «первый попавшийся в тенанте», без учёта команды/роли/загрузки — «Устойчивый» почти никогда не проходит собственную проверку успеха

**Где:** `packages/domain/src/planning/scenarioPlanning.ts:67-141` (`createReassignmentProposal`, строка 88-91: `input.snapshot.resources.find((resource) => resource.id !== input.target.resourceId)`).

**Шаги:**
1. Админ → `/projects/project-gorset-migration/scenarios` и `/projects/project-demo-crm-intake/scenarios` (2 независимых прогона).
2. Оба раза бэкенд возвращает только 2 профиля («Агрессивный», «Балансированный») из заявленных «трёх» (баннер и заголовок явно говорят «три профиля» / «3 профиля»). «Устойчивый» отсутствует ОБА раза.
3. «Сравнить» на «Балансированный» (gorset) → цель реассайна — задача-веха `task-gorset-milestone-signoff` (WBS «2», подписана «Этап 2. Перенос»), альтернативный ресурс — **«Outsider Test»** (`user-8e529bf7-…`, QA-сид-аккаунт `access-profile-resource-reader`, НЕ участник команды проекта, email `qa-adm-outsider@notallowed.com`).
4. На demo-crm-intake диффа — «Игорь Инженер: труд X→Y» + «+ [альтернативный ресурс] (соисполнитель)» — тот же паттерн «первый другой ресурс», без проверки его загрузки/роли.

**Ожидание:** «Устойчивый» — реальный третий профиль в большинстве случаев (сдвиг всей работы); альтернативный ресурс подбирается с учётом доступной ёмкости/роли/участия в проекте.

**Факт:** `createReassignmentProposal` берёт `alternateResource = snapshot.resources.find(r => r.id !== target.resourceId)` — БЕЗ фильтра по team/role/capacity — первый, что нашёлся в `nextSnapshot.resources` (весь список ресурсов тенанта). Для «Устойчивый» (`effect="removed"`) переносится ВСЯ работа на этого одного «первого попавшегося» — с высокой вероятностью создаёт НОВЫЙ перегруз у него же, и `proposalMatchesEffect` (требует `nextDayOverload === 0`) отбраковывает предложение → профиль тихо не рендерится. Наблюдалось на обоих независимых прогонах (gorset, demo-crm-intake) — 0 из 2 дали «Устойчивый». Дополнительно: предлагаемый «рекомендуемый» (recommended) «Балансированный» может рекомендовать реассайн на посторонний QA-аккаунт без роли на проекте.

**Доказательства:** bug-proj-25-scenario-naive-reassignment.png (диф «+ Outsider Test (соисполнитель)»); код `scenarioPlanning.ts:88-91,94-100`; 2 независимых прогона без «Устойчивый» в выдаче.

---

## BUG-PROJ-26 · MAJOR · /commits: 403 на audit-events у PR молча превращается в «История пуста» (необработанный reject промиса)

**Где:** `apps/web/src/delivery/lib/use-planning.ts:226-227` (`loadCommits`, `if (!res.ok) throw new Error("audit_events_failed")`) + `apps/web/src/delivery/commits/commits-surface.tsx:36-39` (`useEffect`: `void loadCommits().then(...)` без `.catch`).

**Шаги:**
1. PR (`plan-reader-no-resources@kiss-pm.local`) → `/projects/project-demo-crm-intake/commits` (проект с 30 реальными коммитами, видно под admin).
2. Наблюдать ленту.

**Ожидание:** RU-текст «Нет прав на просмотр истории коммитов» (как на /overview у RR: «Доступ ограничен») — отличимо от реально пустой истории.

**Факт:** `GET /api/tenant/current/audit-events?projectId=project-demo-crm-intake` → **403 Forbidden**, но `commits-surface.tsx` показывает **«Лента (0)» / «История пуста.»** — неотличимо от нового проекта без истории. Причина: `loadCommits()` бросает `Error` при `!res.ok`, а вызывающий `useEffect` (`void loadCommits().then((c) => {...})`) не имеет `.catch` — необработанный reject промиса (виден в консоли браузера как ошибка), `setData`/`setSel` никогда не вызываются, `data` остаётся `null`, ветка рендера падает на `data?.commits ?? []` = пустой массив. Тот же класс, что уже задокументирован в BUG-PROJ-15 (PR/`overview`: 403 на audit-events → «История пуста»), но здесь — на ОСНОВНОЙ, выделенной под историю коммитов вкладке, а не второстепенном виджете — пользователь с высокой вероятностью решит, что у проекта действительно нет истории.

**Доказательства:** bug-proj-26-pr-commits-empty-history.png; network `GET …/audit-events → 403`; код `use-planning.ts:226-227`, `commits-surface.tsx:36-39` (нет `.catch`).

---

## Прочее (часть B, без отдельного номера)

- **demoAction-фейки на существующих роутах (класс BUG-PROJ-09), новые локации:** `/baseline` «Overlay в График» (title «Демо-прототип: наложение…», cursor default), `/calendars` «Открыть График» (title «Демо-прототип: переход на График…»). Роуты существуют, кнопки мертвы.
- **Resources drilldown, мелкое:** оккупация-встреча (meeting occupancy, `meeting-alpha-vektor-kickoff`) в разбивке «ИЗ ЧЕГО СЛОЖИЛАСЬ ЗАГРУЗКА» подписана как «Отсутствие (отпуск)» — неверная категория (это митинг, не отпуск).
- **Calendars, мелкое:** исключение с `workingMinutes=240` (частичный/полу-рабочий день) в списке и в баннере конфликта подписано как «праздник»/«нерабочий день» (25.05.2026 у demo) — на деле день частично рабочий.
- **Мок-эпоха на /calendars (класс BUG-PROJ-05):** список месяцев стартует с «Март 2026» (`BASE_MS=2026-03-02`), хотя demo-проект — май–июнь; 2 пустых месяца (март, апрель) перед стартом, вид по умолчанию — март.

---

## Проверено и работает (для полноты)

- preview→apply контур честный: каждая правка = коммит vN (v2→v16 за прогон), notice «Коммит vN применён · затронуто задач: K», монотонный рост версии;
- 409 `plan_version_conflict` (+`currentPlanVersion`) при устаревшем `clientPlanVersion` — проверено конкурентной правкой (внешние API-коммиты + UI-правка): UI авто-перезагружает read-model + notice «Конфликт версий плана — перезагружено»;
- защита бэка: неизвестный ресурс/статус → 409 precondition_failed (порчи данных нет), циклическая зависимость (3→1 при существующей 1→3) → 400, план не изменён;
- indent/outdent (task.move_wbs), DateEditor «Начало», «Сделать вехой» (update_custom_field kind), удаление задачи, режим «Пакет» (2 правки → один коммит), «Откат» (компенсирующий коммит), инспектор side-peek, DependencyEditor (исключение себя/предшественников), зум День/Неделя/Месяц (36/8/20px);
- RBAC-ядро: PR читает план, мутации → 403; RR → forbidden на planning-вкладках и отказ на /projects; beta (tenant-beta) не видит проекты alpha (пустой список, 404 на чужой id).
