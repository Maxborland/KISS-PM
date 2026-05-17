 Текущий мок экрана проекта с графиком не принимается как готовый:

  - дизайн выглядит неряшливо и визуально скачет;
  - левая часть Гантта не ощущается как полноценная Excel-like таблица MS Project;
  - интерактивность частичная и декоративная: изменения не дают убедимого результата в UI;
  - KISS PM контур `сигнал -> recommended action -> dry-run preview -> apply -> audit/readback` есть формально, но не ощущается органично встроенным в рабочую плоскость планирования.

  Нужно сделать не статичную картинку, а полнофункциональный интерактивный мок, который можно руками проверить в браузере и по которому реально можно согласовывать UX/UI перед Release 2.

  ## Обязательные источники

  Перед работой прочитай и используй:

  - `E:\KISS-PM\docs`
  - `E:\KISS-PM\docs\ms-project-ref\deep-research-report.md`
  - `E:\KISS-PM\docs\ms-project-ref\compass_artifact_wf-71537e9a-6fb3-487e-83c6-74fef35b85ba_text_markdown.md`
  - продуктовые UX docs under `docs/product/`
  - `AGENTS.md`

  Из `ms-project-ref` обязательно учесть:

  - Gantt Chart = dual-pane grid + timeline;
  - Tracking Gantt = current bars + baseline bars;
  - левая таблица должна быть Excel-like рабочей сеткой;
  - F2 / double click edit mode;
  - typing over selected cell;
  - Enter / Tab / Shift+Tab / arrows navigation;
  - bottom blank row creates task;
  - Insert inserts task above;
  - Undo/Redo for table edits;
  - editable columns: duration, start, finish, predecessors, resources, work, units, type, constraint;
  - task modes: авто / вручную;
  - task types: фикс. единицы / фикс. труд / фикс. срок;
  - formula: `Труд = Длительность x Загрузка`;
  - recalculation matrix for task type edits;
  - predecessor syntax and Russian labels for link types:
    - `Оконч.-Нач.`
    - `Нач.-Нач.`
    - `Оконч.-Оконч.`
    - `Нач.-Оконч.`
  - baseline, milestone diamond, critical path, status date;
  - resource overallocations and resource leveling concepts.

  ## Цель

  Создать полнофункциональный интерактивный мок экрана проекта с Ганттом, близкий по UX к MS Project for Windows, но адаптированный под KISS PM.

  Экран должен быть рабочей управленческой плоскостью, а не дашбордом и не статичной картинкой.

  Главная идея:

  ```txt
  Excel-like план проекта + Гантт
  -> сигнал риска / конфликта
  -> рекомендуемое действие
  -> dry-run preview
  -> apply
  -> audit/readback
  ```

  ## Scope

  Работать в моках / visual companion / design prototype area, не внедрять в production app без отдельного разрешения.

  Ожидаемые артефакты:

  - интерактивный HTML/JS/CSS мок или локальный frontend mock route;
  - project-gantt-planner-vNext.html или эквивалент;
  - Playwright/browser verification artifacts:
      - screenshots;
      - console check;
      - interaction snapshots;
  - acceptance checklist/matrix для мокапа, например mock-acceptance-matrix.json;
  - короткий дизайн-notes файл с принятыми UX решениями.

  Не трогать production implementation P6/P7/P8 без отдельной задачи.

  ## Обязательные UX/UI требования

  ### 1. Общая композиция

  Экран должен быть плотным, рабочим, но не перегруженным.

  Обязательные зоны:

  - верхний контекст проекта;
  - компактная command ribbon / toolbar;
  - view switcher:
      - Диаграмма Ганта;
      - Гантт с базовым планом;
      - Решение ресурсных конфликтов;
  - основная dual-pane зона:
      - слева Excel-like таблица;
      - справа timeline/Gantt;
  - сдвижная правая управленческая панель;
  - нижняя status bar.

  Убрать лишние mock-only вкладки типа:

  - Task Sheet;
  - Team Planner;
  - Resource Graph;
  - Table: Entry;
  - Filter: All Tasks;
  - Group: None.

  Если нужны table/filter/group, они должны быть скрыты в настройках вида, а не занимать основной UX.

  ### 2. Excel-like таблица

  Левая таблица должна быть главным интерактивным ядром.

  Обязательно реализовать в мокапе:

  - активная ячейка с четкой рамкой;
  - адрес ячейки в строке ввода, например F4;
  - формульная / input строка;
  - клик по ячейке выбирает ячейку, не только строку;
  - стрелки перемещают active cell;
  - Tab / Shift+Tab перемещают вправо/влево;
  - Enter применяет значение;
  - Escape отменяет редактирование;
  - F2 и double click включают edit mode;
  - typing по выбранной ячейке заменяет значение;
  - редактирование через строку ввода меняет выбранную ячейку;
  - измененная ячейка/строка визуально помечается;
  - Undo / Redo работают хотя бы для последних 5 изменений;
  - bottom blank row создает новую задачу;
  - Insert добавляет задачу выше выбранной;
  - Delete удаляет выбранную задачу с undo;
  - indent/outdent меняет WBS/иерархию хотя бы визуально;
  - resize columns drag;
  - hide/show columns;
  - horizontal/vertical scroll;
  - sticky headers.

  Колонки минимум:

  - индикатор;
  - №;
  - режим;
  - ИСР/WBS;
  - название задачи;
  - длительность;
  - начало;
  - окончание;
  - предшественники;
  - ресурсы;
  - труд;
  - загрузка/единицы;
  - готово %;
  - тип задачи;
  - ограничение.

  ### 3. Scheduling behavior mock

  Мок не обязан быть настоящим scheduling engine, но интерактивность должна быть правдоподобной.

  Обязательно:

  - изменение Длительность пересчитывает Окончание или Труд согласно выбранному типу задачи;
  - изменение Труд пересчитывает Длительность или Загрузку;
  - изменение Загрузка пересчитывает Труд или Длительность;
  - типы задач работают визуально:
      - Фикс. единицы;
      - Фикс. труд;
      - Фикс. срок;
  - включение/выключение трудоемкостного планирования влияет на preview добавления ресурса;
  - изменение предшественника обновляет связь на Гантте;
  - некорректный predecessor показывает inline validation error;
  - milestone с 0 дн. отображается ромбом;
  - summary task rollup визуально обновляет span;
  - critical path подсвечивается;
  - baseline остается отдельным нижним bar в Tracking Gantt.

  ### 4. Gantt interactions

  Гантт должен быть интерактивным, не картинкой.

  Обязательно:

  - drag bar moves task date visually;
  - drag bar end changes duration visually;
  - click bar selects matching table row;
  - click table row highlights matching bar;
  - baseline toggle shows/hides baseline bars;
  - status date marker visible;
  - critical bars visible;
  - dependency line visible;
  - zoom day/week/month at mock level;
  - hide/show Gantt;
  - splitter changes table/timeline width.

  ### 5. Resource conflict screen

  Добавить полноценный режим:

  Решение ресурсных конфликтов

  Обязательно:

  - список конфликтов;
  - карта загрузки сотрудников по периодам;
  - выбор конфликта обновляет правую панель;
  - recommended action для выбранного конфликта;
  - dry-run preview показывает before/after:
      - загрузка до;
      - загрузка после;
      - влияние на дату вехи;
      - остаточный риск;
  - apply переводит preview в result;
  - audit/readback отображается после apply;
  - возвращение в Гантт показывает обновленную задачу/ресурс.

  ### 6. KISS PM управленческий контур

  Правая панель должна быть сдвижной и не мешать планированию.

  Панель должна показывать:

  - источник сигнала;
  - severity;
  - объяснение человеческим языком;
  - рекомендуемое действие;
  - альтернативы;
  - dry-run preview;
  - apply;
  - результат;
  - audit id;
  - readback state.

  Важно:

  - обычное редактирование таблицы не должно сразу выглядеть как governed action;
  - рискованные действия идут через preview/apply;
  - UI должен направлять к правильному управленческому решению, а не просто показывать кнопку.

  ### 7. Визуальное качество

  Использовать $frontend-design и $design-craft.

  Требования:

  - единая сетка, единые отступы, единые радиусы;
  - не больше 3-5 основных цветов;
  - никакой декоративной мишуры;
  - без градиентных шаров, marketing hero, карточного хаоса;
  - плотность как у профессионального planning tool;
  - текст не должен налезать;
  - кнопки и панели должны быть визуально согласованы;
  - русский UI по умолчанию;
  - MS Project-like ощущение, но без слепого копирования;
  - KISS PM элементы должны выглядеть органично, а не приклеенной боковой карточкой.

  ## Evidence / Verification

  Нельзя принимать мок как готовый без live/browser проверки.

  Обязательно выполнить:

  # если это static html, проверить что сервер отдает актуальную версию
  Invoke-WebRequest -Uri http://localhost:<PORT> -UseBasicParsing

  # или эквивалентную команду запуска/проверки локального mock server

  Через Playwright/browser проверить минимум:

  1. Страница открывается без console errors.
  2. Клик по ячейке выбирает ячейку и обновляет адрес.
  3. F2/double click включает редактирование.
  4. Ввод значения меняет ячейку.
  5. Enter применяет значение.
  6. Undo возвращает предыдущее значение.
  7. Redo возвращает изменение.
  8. Blank row создает новую задачу.
  9. Hide/show column работает.
  10. Resize column работает или имеет доказанный drag handler.
  11. Hide/show Gantt работает.
  12. Splitter table/timeline работает.
  13. Переключение Гантт с базовым планом показывает baseline.
  14. Переключение Решение ресурсных конфликтов показывает conflict workspace.
  15. Preview меняет before/after.
  16. Apply показывает result + audit/readback.
  17. Возврат в Гантт показывает обновленное состояние.
  18. Screenshot desktop 1440+.
  19. Screenshot narrower viewport.
  20. No obvious overlap/clipping.

  Сохранить artifacts:

  - screenshots;
  - browser snapshot;
  - console log;
  - interaction checklist with pass/fail.

  ## Acceptance Matrix

  Создай machine-readable acceptance matrix, если ее нет:

  {
    "screen": "project-gantt-planner",
    "rows": [
      {
        "id": "MOCK-GANTT-001",
        "requirement": "Excel-like cell selection and formula bar",
        "status": "verified|blocked|rejected",
        "evidence": {
          "command": "...",
          "exit_code": 0,
          "artifact": "...",
          "checked_at": "..."
        }
      }
    ]
  }

  Matrix должна покрывать:

  - layout;
  - Excel-like table;
  - scheduling recalculation mock;
  - Gantt interactions;
  - resource conflict screen;
  - KISS PM action loop;
  - visual quality;
  - Russian language;
  - browser verification.

  Если добавляешь verifier, он должен падать на:

  - missing required rows;
  - verified без evidence;
  - missing artifact;
  - stale checked_at;
  - blocker placeholder;
  - console errors;
  - missing screenshots.

  ## Do Not Cheat

  Не принимать:

  - статичную картинку;
  - “кнопка есть” как доказательство интерактивности;
  - только HTML без browser run;
  - screenshots без кликов;
  - console errors как “неважно”;
  - частичный Excel-like без редактирования/undo/navigation;
  - KISS PM панель без preview/apply/audit/readback;
  - неряшливый визуал как “черновик готов”;
  - английский UI в пользовательском контуре;
  - fake state, который не меняется после действия.

  ## Review Loop

  После реализации:

  1. Проведи self UX review.
  2. Проведи $bug-hunt по интерактивности.
  3. Проведи $requesting-code-review по качеству реализации мока.
  4. Обработай через $receiving-code-review.
  5. Исправь Critical / Important / Medium findings.
  6. Повтори browser verification.

  ## Definition of Done

  Мок считается готовым только если:

  - экран визуально выглядит как цельный professional planning tool;
  - левая часть ощущается как Excel-like рабочая таблица;
  - интерактивные изменения реально видны в UI;
  - есть минимум 3 связанных интерактивных сценария:
      - table edit -> recalculation -> Gantt update;
      - conflict selection -> preview -> apply -> audit/readback;
      - column/view customization -> persisted visual state within mock session;
  - KISS PM контур встроен в workflow, а не приклеен сбоку;
  - MS Project reference docs явно отражены в поведении;
  - русский UI полный;
  - Playwright/browser проверка пройдена;
  - screenshots/artifacts сохранены;
  - acceptance matrix обновлена и вся verified или честно blocked;
  - нет console errors;
  - финальный отчет содержит evidence, artifacts и remaining risks.

  ## Final Report

  Верни:

  Status:
  Mock version / URL:
  Changed:
  Files:
  MS Project reference coverage:
  Excel-like coverage:
  Gantt coverage:
  Resource conflict coverage:
  KISS PM action loop:
  Visual design changes:
  Verification:
  - command: exit code, key output/artifact
  Browser evidence:
  Screenshots:
  Acceptance matrix:
  Review findings:
  Known limitations:
  Next design decision needed:
  Verdict: accepted | rejected | blocked

  accepted можно ставить только если Definition of Done выполнен полностью.
