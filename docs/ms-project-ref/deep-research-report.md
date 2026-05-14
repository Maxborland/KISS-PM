# Как MS Project работает с задачами

## План отчёта

- Уточнение охвата и версий, термины и единицы измерения, ключевые «сущности данных» (задача, назначение, ресурс, календарь, связь). citeturn24view0turn25view0turn14view1turn15search13turn5search2  
- Строгая модель полей задач (Duration/Work/Units/Start/Finish/Actual/Remaining/Percent*) и формулы пересчёта, включая режимы задач и типы задач. citeturn24view0turn25view0turn2search2turn2search22turn2search9turn17search0  
- Логика автопланирования: зависимости (FS/SS/FF/SF), лаг/опережение, ограничения, критический путь и резервы, forward/backward pass как реализуемая модель. citeturn4search0turn2search7turn3search6turn3search0turn3search2turn12search9turn4search1turn12search1turn12search2turn8search23  
- Поведение при инлайн‑редактировании: какие поля вводимые/вычисляемые, какие правки триггерят пересчёт, порядок «последнего ввода», undo/redo, режимы перерасчёта (auto/manual calc). citeturn11search3turn7view0turn18search0turn3search21turn18search2  
- Форматы данных и сериализация: .mpp (ограничения публичности), Project XML (mspdi_pj12.xsd), как сохраняются календари/связи/назначения/повременные данные, плюс Server/Online и экспорты/типы. citeturn19view0turn5search16turn9search3turn14view1turn16search6turn13view1turn6search13  
- Рекомендации для реализации в коде: архитектура, алгоритмы, матрицы пересчёта, тест‑кейсы, крайние случаи, производительность на больших графах. citeturn24view0turn25view0turn7view0turn5search0turn15search13turn16search2  

## Исполнительная сводка

MS Project (клиент Desktop и семейство Project Online/Server) опирается на три «опорвых» величины планирования ресурсо‑зависимых задач: **Work (трудозатраты)**, **Duration (длительность активного рабочего времени)** и **Units (единицы назначения, доля ресурса/мощность)**, связанные базовой формулой:

\[
\textbf{Work}=\textbf{Duration}\times \textbf{Units}
\]
citeturn24view0turn2search0  

Ключевой механизм управления пересчётами — **тип задачи (Fixed Units / Fixed Work / Fixed Duration)**, который фиксирует одну из трёх величин (приоритет «не менять фиксируемое, когда меняют две другие»). Microsoft в явном виде даёт матрицу «что пересчитывается при редактировании Units/Duration/Work» и численные сценарии пересчёта. citeturn24view0  

Отдельным переключателем является **Effort Driven (трудоёмкостное планирование)**: при включении Project стремится **держать общий Work постоянным**, перераспределяя оставшуюся работу между ресурсами при добавлении/удалении назначений; при этом есть исключения (например, Fixed Work всегда effort‑driven; на summary tasks флаг не действует; «первое назначение» имеет особое поведение). citeturn25view0turn11search9turn11search12  

Автопланирование дат (Start/Finish) — это сочетание: календарей (project/task/resource), связей (FS/SS/FF/SF) с лагами/опережениями, ограничений (constraints), статуса/факта и опций расчёта (включая критичность по slack). Для реализации в коде это удобно формализовать как граф задач + календарная арифметика + forward/backward pass с учётом ограничений и лагов, а затем вычисление slack/critical по опубликованным формулам. citeturn3search0turn3search2turn4search1turn12search9turn5search4turn16search6turn7view0  

Формат .mpp остаётся «проблемной зоной»: на уровне публичной документации нет полноценной спецификации; для интеграций Microsoft-документация фактически отсылает к автоматизации/экспорту в XML. При этом **Project XML Data Interchange (mspdi_pj12.xsd)** — хорошо определённая схема: в ней явно описаны Task, PredecessorLink (тип связи и лаг в десятых минуты), календари, повременные данные и многие поля, причём часть страниц доступна на русском. citeturn19view0turn9search3turn20search1turn16search2turn13view1turn5search2  

> Примечание об объёме: требование «все подробности» в буквальном смысле (каталог всех полей/вариантов/edge‑кейсов) сопоставимо с документацией на сотни страниц. В пределах одного ответа ниже даётся **максимально плотная “спецификация ядра”**: формулы, зависимости, сериализация, алгоритмы и тест‑набор. Полный «энциклопедический справочник по каждому полю MSPDI + UI‑поведение каждой колонки» выделен как **дополнительные части** в конце раздела реализации.

## Модель данных задач: сущности, поля, единицы и формулы

### Сущности и отношения

Для реализации «как MS Project» удобно держать следующую доменную модель (это не UI‑модель, а вычислительная):

- **Project**
  - глобальные опции пересчёта (automatic vs manual calculation), критичность по slack, статус‑дата и правила move completed/incomplete частей относительно status date, настройки «minutes per day/week», calendar defaults. citeturn7view0turn3search2turn12search3turn5search1turn6search5turn6search2  
  - базовый календарь проекта (один обязателен). citeturn5search2turn5search0  

- **Calendar**
  - рабочее время, исключения, рабочие недели; используется как основа для project/task/resource календарей. citeturn5search0turn5search2turn5search7turn5search10  

- **Task**
  - режим планирования (Task Mode): manual/auto и связанные «scheduled» поля. citeturn8search0turn8search4turn12search15turn8search23  
  - тип задачи (Fixed Units/Work/Duration) и EffortDriven. citeturn8search2turn24view0turn11search9turn25view0  
  - поля дат/длительности/работы/процентов/факта/остатка, календарь задачи, флаги игнорирования календарей ресурсов. citeturn14view1turn5search4turn15search1  
  - связи предшественников (PredecessorLink) и лаги. citeturn15search13turn16search6turn16search2  
  - timephased данные (повременные значения) на уровне Task (и отдельно на Assignment/Resource). citeturn13view1turn13view0turn14view1  

- **Resource**
  - календарь ресурса и max units/availability. citeturn2search5turn2search15turn5search22  

- **Assignment**
  - Units (allocation), Work, Start/Finish по назначению, Work contour и timephased work/actual work. citeturn2search1turn2search0turn2search21turn6search13turn13view1  

Это совпадает с тем, что явно хранится/описывается в Project XML: `<Project>` включает `<Calendars>`, `<Tasks>`, `<Resources>`, `<Assignments>`, а в `<Task>` присутствуют `Work`, `Duration`, `EffortDriven`, `ConstraintType`, `CalendarUID`, `PredecessorLink`, `TimephasedData` и др. citeturn6search21turn14view1turn9search11turn20search9  

### Единицы измерения и «каноническая» единица для кода

**Практически применимый вывод для реализации**: хранить длительности/работу/лаги внутри движка **в минутах** (integer) и лишь на границах UI/импорта/экспорта делать форматирование.

- COM/VBA модель Project для Desktop прямо говорит: `Task.Duration` — «duration (in minutes)» и `Task.Work` — «work (in minutes)». citeturn9search6turn10search0  
- В Project XML длительности представлены типом `xsd:duration`, а формат отображения задаётся числовыми кодами `DurationFormat`/`LagFormat`. citeturn14view1turn16search8turn17search2  
- Для лагов в связях: `LinkLag` хранится **в десятых долях минуты** (tenths of a minute). Это объясняет, почему «1 day lag» превращается в 4800 (если 1d = 480 минут, умножить на 10). citeturn16search2turn16search6  
- Для преобразований «дни/недели/месяцы ↔ минуты» Project хранит параметры `MinutesPerDay`, `MinutesPerWeek`, `DaysPerMonth` в проекте (в XML они отдельными элементами). citeturn5search1turn6search5turn6search2turn5search23  

#### Рабочие и «elapsed» единицы

Project различает **рабочие** и **elapsed** длительности (em/eh/ed/ew/emo). В XSD и документации DurationUnits прямо объясняется: elapsed время включает нерабочие периоды; `7d` — семь рабочих дней по календарю, `7ed` — семь календарных дней. citeturn17search9turn17search2  

Это важно для реализации: «добавить 7 рабочих дней» — календарная функция с пропуском нерабочего времени; «добавить 7 elapsed days» — простое добавление 7×24h независимо от календаря. citeturn17search9turn17search2  

### Ключевые поля задач и базовые формулы

Ниже — **минимальный “набор ядра”**, без которого невозможно воспроизвести поведение MS Project; все формулы далее опираются на эти определения.

#### Duration

Определение Microsoft: **Duration** — «total span of active working time»; считается как количество **активного рабочего времени** между scheduled start и end, обычно «не считая промежутков разделённых (split) задач и нерабочего времени». citeturn9search26turn17search0turn17search4  

Формально для автопланируемой задачи:

\[
Duration = WorkingTime(ScheduledStart, ScheduledFinish, CalendarContext)
\]

где `WorkingTime` считает только рабочие интервалы в календарном контексте задачи/назначений (ниже). citeturn17search0turn5search4turn15search1  

#### Work и Units (на самом деле — назначений)

Microsoft описывает Work как зависящий от units и «спана назначения»: «span of an assignment is multiplied by the assignment units to calculate the amount of work». Пример: 1‑day task при 100% units → 8h work; при 50% → 4h. citeturn2search0turn2search1  

Для кода это удобно записать на уровне Assignment:

\[
Work_{a} = Duration_{a} \times Units_{a}
\]

где `Units_a` — доля (например 1.0 для 100%, 0.5 для 50%) или число FTE (например 3.0 для 300%). citeturn2search0turn2search1turn2search5  

На уровне Task:

\[
Work_{task} = \sum_{a \in Assignments(task)} Work_{a}
\]

(Это соответствует общей идее: Task.Work — «total amount of work scheduled … by all assigned resources» в XML‑описании task элемента.) citeturn14view1turn2search0  

#### Percent Complete, Actual Duration, Remaining Duration

Microsoft даёт явные формулы:

- Если пользователь вводит `% Complete`, то:
\[
ActualDuration = Duration \times PercentComplete
\]
\[
RemainingDuration = Duration - ActualDuration
\]
citeturn2search2turn2search9  

- Если вводят `Actual Duration`, Project пересчитывает `Remaining Duration = Duration - ActualDuration`. citeturn2search2  
- Если вводят `Remaining Duration`, Project «меняет Duration так, чтобы оно стало суммой Remaining + Actual» (actual остаётся неизменным). citeturn2search6  

Также `% Complete` влияет на фактические даты: если `% Complete` > 0, `Actual Start` проставляется равным scheduled start (если не задан), а при 100% — `Actual Finish` равен scheduled finish. citeturn2search9  

#### Percent Work Complete, Actual Work, Remaining Work

Microsoft даёт формулу:

\[
PercentWorkComplete = \frac{ActualWork}{Work}\times 100
\]
citeturn2search22  

Ввод `% Work Complete` приводит к автоматическому пересчёту `Actual Work` и `Remaining Work`, а ввод `Actual Work` или `Remaining Work` пересчитывает остальные. citeturn2search22turn2search8turn2search30  

> Важное ограничение: **нельзя вводить timephased actual work для manually‑scheduled задач** (официальное замечание). Для реализации это означает: в manual mode у задачи должны быть ограничения на редактирование повременных фактов и/или на генерацию timephased actual по UI‑изменениям. citeturn2search13  

### Календарный контекст задачи: проектный, календарь задачи, календарь ресурсов

Microsoft формулирует приоритеты так:

- У проекта есть базовый календарь; задачи и ресурсы могут иметь свои календари, основанные на базовом. citeturn5search2turn5search0  
- Если к задаче применён **Task Calendar**, его рабочие времена «supersede» проектный календарь;  
- При назначенных ресурсах задача планируется на **пересечении** рабочих времен task calendar и resource calendar;  
- Есть флаг **Ignore Resource Calendar**, который позволяет учитывать только task calendar (игнорируя календари ресурсов). citeturn5search4turn15search1  

С точки зрения вычислений это задаёт `CalendarContext(task, assignment)`:

- если `task.TaskCalendar` задан и `task.IgnoreResourceCalendar = Yes` ⇒ `CalendarContext = task.TaskCalendar`; citeturn15search1turn5search4  
- если `task.TaskCalendar` задан и ignore = No ⇒ `CalendarContext = Intersection(task.TaskCalendar, resource.Calendar)`; citeturn5search4turn15search5  
- иначе (нет отдельного task calendar) ⇒ `CalendarContext = resource.Calendar` (для ресурсо‑драйвенных расчётов) или проектный календарь (для задач без назначений/для датовой сетки); практическое подтверждение: календарь ресурса может влиять на планирование задач и считается частой причиной «почему не планируется как ожидалось». citeturn7view0turn5search18  

## Типы и режимы задач: пересчёты Work/Duration/Units и распределение работы

### Режим задачи: Auto Scheduled vs Manually Scheduled

Microsoft описывает Task Mode поле и набор «scheduled» полей:

- `Task Mode` показывает, является ли задача placeholder/manual/auto, и даёт переключение manual/auto. citeturn8search0  
- Для ряда полей существуют пары: `Start` vs `Scheduled Start`, `Finish` vs `Scheduled Finish`, `Duration` vs `Scheduled Duration`.
  - Для **manually scheduled** задача: `Scheduled Start/Finish/Duration` — это «рекомендованные Project значения» и **read‑only**. citeturn8search23turn12search15turn8search4  
  - Для **auto scheduled** задача: scheduled поля совпадают с фактическими `Start/Finish` и т.п. citeturn8search23turn12search15turn8search4  

Практически документированное поведение: «оставить пустыми Duration/Start/Finish» возможно только в manual mode, и перед трекингом прогресса часто рекомендуют вернуть задачи в auto mode. citeturn8search8turn2search13  

#### Таблица сравнения режимов задач

| Аспект | Auto Scheduled | Manually Scheduled |
|---|---|---|
| Источник Start/Finish | рассчитываются по связям/ограничениям/календарям или вводятся и превращаются в constraint | могут быть пустыми/введёнными; Project показывает «рекомендацию» в Scheduled Start/Finish |
| Scheduled Start/Finish | равны Start/Finish | read‑only рекомендации |
| Scheduled Duration | равен Duration | read‑only рекомендация; Duration может быть пустым/текстовым в placeholder‑логике |
| Timephased actual work ввод | допускается | запрещён (официально) citeturn2search13 |

Основания: определения scheduled полей и ограничение на timephased actual. citeturn8search23turn12search15turn8search4turn2search13  

### Тип задачи: Fixed Units / Fixed Work / Fixed Duration — официальная матрица пересчёта

Microsoft даёт базовую формулу и явную «матрицу пересчёта» при изменении одного из трёх параметров. citeturn24view0  

Базовая формула:

\[
Work = Duration \times Units
\]
citeturn24view0turn2search0  

Матрица (дословно по смыслу Microsoft):

| Тип задачи | Если меняют Units | Если меняют Duration | Если меняют Work |
|---|---|---|---|
| Fixed Units | пересчитывается Duration | пересчитывается Work | пересчитывается Duration |
| Fixed Work | пересчитывается Duration | пересчитывается Units | пересчитывается Duration |
| Fixed Duration | пересчитывается Work | пересчитывается Work | пересчитывается Units |

citeturn24view0  

Это — «скелет» алгоритма. В коде его нужно дополнить: **какие сущности именно меняются** (Task vs Assignment), и **когда** изменения запрещены/конвертируются (например, cost resources не имеют work/units и не участвуют в пересчётах по этим параметрам). citeturn24view0  

### Effort Driven: что именно фиксируется при добавлении/удалении ресурсов

Microsoft определяет effort-driven scheduling так:

- При добавлении/удалении людей Project удлиняет/укорачивает Duration в зависимости от числа назначенных ресурсов, **но не меняет общий Work** (total work constant). citeturn25view0turn11search12  
- В effort‑driven задачи, когда добавляют ресурс, **remaining work распределяется на него**. citeturn11search9  

И перечисляет исключения/правила:

- Fixed Work задачи **всегда** effort‑driven (нельзя отключить). citeturn25view0turn24view0  
- Для Fixed Units: добавление ресурсов «shortens duration» (что соответствует “Work constant, Units↑ ⇒ Duration↓”). citeturn25view0turn24view0  
- Для Fixed Duration: добавление ресурсов «decreases individual unit values» (т.е. перераспределяет Units так, чтобы не менять Work при фиксированной Duration). citeturn25view0turn24view0  
- Effort‑driven расчёты «применяются только после первоначального назначения ресурсов»; после первого назначения Work не меняется при добавлении/удалении ресурсов. citeturn25view0  

#### Практическая формализация для кода

В реалистичной реализации нужно различать два класса операций:

1) **Редактирование параметров (Work/Duration/Units)** в таблице/диалоге.  
2) **Операции с составом назначений** (добавить/удалить ресурс, изменить количество ресурсов).

Microsoft-матрица выше описывает (1). Effort Driven в основном описывает (2). citeturn24view0turn25view0  

### Как Project распределяет работу по времени (timephasing) и Work Contour

MS Project хранит «повременные данные» (timephased) для задач/назначений/ресурсов; в Project XML есть `TimephasedData` элемент с `Type` (один из 76), `Start`, `Finish`, `Unit`, `Value`. citeturn13view1turn13view0turn20search7  

Контур работы (Work Contour) управляет распределением work по шкале времени на уровне назначения: это перечислимый выбор форм (Flat, Back Loaded, Front Loaded, Double Peak, Early Peak, Late Peak, Bell, Turtle, Contoured). citeturn6search13turn17search3turn6search7  

Для Project Server/Online Microsoft публикует кодировку AssignmentWorkContour: `0=Flat ... 7=Turtle, 8=Contoured`. citeturn6search13  

В Desktop UI контур задаётся через assignment field `Work Contour`. citeturn17search3turn6search3  

> Для реализации: «плоский» контур можно моделировать как равномерное распределение `Work_a` по всем рабочим минутам `CalendarContext` между `Assignment.Start` и `Assignment.Finish`. Для остальных контуров нужны функции распределения веса по времени (встроенные формы). Публичная документация описывает перечень форм, но **не специфицирует точную математическую кривую**. Следовательно, для 100% совпадения с Project понадобятся эмпирические тесты (см. раздел реализации). citeturn17search3turn6search13turn13view1  

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["Microsoft Project Task Information Advanced tab task type effort driven","Microsoft Project Task Usage view Work Contour timephased work","Microsoft Project Gantt Chart critical path red tasks"],"num_per_query":1}  

## Автопланирование дат: зависимости, лаги, ограничения, критический путь и резервы

### Ссылки между задачами: FS/SS/FF/SF и лаг/опережение

Microsoft фиксирует, что для предшественников/последователей используются типы связей: **FS, SS, FF, SF**, а также текстовый ввод лагов (отрицательное значение — lead, положительное — lag). citeturn4search0turn2search14turn2search7  

В Project XML это сериализуется элементом `PredecessorLink`, где:

- `Type` — один из (FF, FS, SF, SS);  
- `LinkLag` — лаг в **десятых долях минуты**;  
- `LagFormat` — формат единицы для лага (hours/days/…); `LinkLag` требует `LagFormat`. citeturn16search6turn16search2turn15search2turn16search5  

В XSD также перечислены коды форматов времени (DurationFormat/LagFormat): `d` vs `ed` и т.д. citeturn17search2turn17search9  

#### Формальная модель вычисления «ограничения от связи»

Обозначим:

- \(S_i, F_i\) — рассчитанные Start/Finish задачи \(i\).  
- \(D_i\) — duration (в рабочих минутах).  
- \(Cal_i\) — календарный контекст задачи (или назначения) для расчёта рабочих минут (см. выше). citeturn5search4turn15search1turn17search0  

Тогда базово:

\[
F_i = AddWorkingTime(S_i, D_i, Cal_i)
\]

для working‑duration; для elapsed‑duration — `AddElapsedTime`. citeturn17search9turn17search0  

Для связи \(j \to i\) с lag \(L\) (в минутах/elapsed) вводим оператор `ApplyLinkType`:

- **FS**: \(S_i \ge F_j + L\)  
- **SS**: \(S_i \ge S_j + L\)  
- **FF**: \(F_i \ge F_j + L\)  
- **SF**: \(F_i \ge S_j + L\)

В реализации MS Project после применения временного ограничения по календарю требуется «нормализовать» на ближайший допустимый рабочий момент (start time). Документация описывает, что расчёт дат опирается на dependencies/calendars/constraints. citeturn8search23turn12search15turn5search3turn5search4turn7view0  

### Ограничения (constraints), Deadline и «schedule from start vs finish»

Microsoft описывает типы ограничений и их характер (flexible/semi‑flexible/inflexible), включая Must Start On / Finish No Later Than и т.п. citeturn3search6turn3search3turn3search9  

Существенные правила автоприсвоения ограничений:

- Если вы вводите дату в Start для auto‑scheduled задачи — Project назначает `Start No Earlier Than` и ставит `Constraint Date`. citeturn3search3turn3search24  
- Если вы вводите Finish — Project назначает `Finish No Earlier Than` (при планировании «from start»), а если проект планируется «from finish» — `Finish No Later Than`. citeturn12search5turn3search11  
- При планировании «от даты окончания проекта» новые auto‑scheduled задачи получают `ALAP`, и в целом поведение отличается. citeturn8search1turn3search28turn7view0  

Deadline отличается от constraint: дедлайн не вызывает таких же «ошибок расписания», но может влиять на Total Slack. citeturn12search0turn12search7turn12search29  

### Forward/Backward pass и расчёт резервов

MS Project показывает поля Early Start/Finish и Late Start/Finish; Microsoft описывает их семантику:

- Early Start — «самая ранняя возможная дата старта при условии, что предшественники/последователи тоже стартуют на своих ранних датах», расчёты «based on a fixed task duration». citeturn4search1turn12search2turn12search19  
- Late Start/Late Finish имеют аналогичные определения, привязанные к «проектному финишу» и фиксированной длительности. citeturn4search2turn12search1turn12search18  

**Total Slack** рассчитывается официально так:

\[
TotalSlack = \min(LateFinish - EarlyFinish,\ LateStart - EarlyStart)
\]
citeturn3search0turn12search4  

**Finish Slack**:

\[
FinishSlack = LateFinish - EarlyFinish
\]
citeturn12search9  

Про Free Slack Microsoft говорит: он основан на сравнениях Early/Late полей задач и учитывает successor‑сеть; если successors нет, Free Slack = Total Slack. citeturn3search1turn12search14  

**Критичность** (Critical field): задача критична, если её Total Slack ≤ порог, задаваемый опцией «Tasks are critical if slack is less than or equal to …» (по умолчанию 0 дней). citeturn3search2turn3search7  

#### Реализуемый алгоритм (вид «как CPM с календарями и ограничениями»)

Ниже — строгая схема, пригодная для кода. Публичная документация не раскрывает внутренний инкрементальный механизм перерасчёта, но поля Early/Late и slack формулы соответствуют классическому CPM‑подходу. citeturn4search1turn12search1turn3search0turn3search1  

1) **Построение графа**  
   Узлы = задачи. Рёбра = `PredecessorLink` (все типы FS/SS/FF/SF) с lag/lead. citeturn16search6turn4search0  

2) **Forward pass (ранние даты)**  
   Вычисляем \(ES_i, EF_i\) в топологическом порядке (или итеративно для графов с SF/FF, где удобнее решать систему ограничений, но чаще можно свести к фазам).
   - Инициализация: \(ES_i\) не раньше project start (ASAP) и с учётом собственных constraints (SNET/MSO/…). citeturn7view0turn3search6turn3search3  
   - Для каждого predecessor‑ограничения вычисляем кандидаты:
     - FS: \(cand = EF_p + lag\)  
     - SS: \(cand = ES_p + lag\)  
     - FF: ограничивает finish ⇒ при фиксированном duration трансформируется в start‑кандидат через \(S_i \ge (EF_p + lag) - D_i\)  
     - SF: \(S_i \ge (ES_p + lag) - D_i\)
   - Применяем календарь: `S_i = NextWorkingTime(max(cands), Cal_i)`; затем `EF_i = AddWorkingTime(ES_i, D_i, Cal_i)`. citeturn5search4turn15search1turn17search0  

3) **Определение “project finish”**  
   По Microsoft: «последняя завершающаяся задача определяет дату окончания проекта». citeturn5search11turn8search1  

4) **Backward pass (поздние даты)**  
   В обратном топологическом порядке:
   - Инициализация терминальных задач: \(LF_i = ProjectFinish\) (или дедлайн/ограничение, если оно сильнее). citeturn12search1turn12search0turn3search6  
   - Для каждого successor ограничения формируем кандидаты на \(LF_i\) или \(LS_i\) (аналогично, но «в обратную сторону»).
   - Получаем \(LS_i = SubtractWorkingTime(LF_i, D_i, Cal_i)\). citeturn4search2turn12search18turn17search0  

5) **Slack и Critical**  
   `TotalSlack` и `FinishSlack` по формулам выше, `Critical` по порогу. citeturn3search0turn12search9turn3search2  

#### Mermaid‑диаграмма: граф задач и проходы

```mermaid
flowchart LR
  A[Task A] -->|FS + 2d lag| B[Task B]
  A -->|SS| C[Task C]
  B -->|FF| D[Task D]
  C -->|FS - 1d lead| D

  subgraph ForwardPass["Forward pass"]
    A1[ES/EF(A)] --> B1[ES/EF(B)]
    A1 --> C1[ES/EF(C)]
    B1 --> D1[ES/EF(D)]
    C1 --> D1
  end

  subgraph BackwardPass["Backward pass"]
    D2[LS/LF(D)] --> B2[LS/LF(B)]
    D2 --> C2[LS/LF(C)]
    B2 --> A2[LS/LF(A)]
    C2 --> A2
  end
```

Семантика типов связей и лаг/lead, как они вводятся и хранятся в XML (tenths of a minute), подтверждена Microsoft. citeturn4search0turn16search6turn16search2turn2search7  

## Инлайн‑редактирование: какие поля редактируемые, триггеры пересчёта, undo/redo и порядок применения

### «Вводимое vs вычисляемое»: как определить редактируемость поля

MS Project (как и большинство Office‑приложений) маркирует поля как:

- **Entered** (вводимые),
- **Calculated** (вычисляемые),
- **Calculated or Entered** (смешанные).

Это видно прямо в описаниях полей (пример: Duration — «Calculated or entered»; Scheduled Duration — рассчитываемое и read‑only для manual; Critical — вычисляемое и зависит от Total Slack). citeturn9search26turn8search4turn3search2turn8search23turn12search15  

Для реализации в коде удобно хранить для каждого поля:

- `entryType: Entered|Calculated|Mixed`
- `readOnlyWhen: {taskMode=Manual? summaryTask? ...}`
- `setterTriggers: {recalcSchedule, recalcWork, recalcAssignments, recalcSlack, ...}`

### Триггеры пересчёта: automatic calculation vs manual calculation

Microsoft явно описывает режим расчёта:

- Если включён «manual calculation», Project пересчитывает файл **только при нажатии F9**. citeturn7view0turn18search1  
- Опция называется «Calculate project after each edit» и переключается в File → Options → Schedule; в Resource Leveling документации это напрямую связано с режимом автоматического/ручного выравнивания и пересчёта. citeturn3search21turn7view0  
- Есть горячая клавиша «Turn on or off Auto Calculate» (Ctrl+F9) в списке shortcuts. citeturn18search2  

**Следствие для реализации**: изменения в таблице должны оформляться как события, которые либо:

- запускают «немедленный пересчёт» после commit (авторежим),  
- либо только помечают грязные узлы/агрегаты и ждут явного `CalculateNow()` (ручной режим). citeturn7view0turn3search21  

### Порядок применения изменений: “последние два поля” и автопостановка constraints

Microsoft даёт важный кусок «порядка применения» на примере Start/Finish/Duration:

- Есть две зависимости:
  - Duration меняется при изменении Start и Finish.
  - Start/Finish меняются при изменении Duration. citeturn11search3  
- Если пользователь вводит Start и Finish, Project считает Duration как рабочее время между ними (с учётом нерабочего времени). citeturn11search3turn17search0  
- Если затем меняют Finish, не трогая Duration, Duration пересчитывается; но если меняют Finish так, что «последними изменёнными полями были Finish и Duration», то Project может удержать Duration, пересчитав Start (в примере Microsoft прямо объясняет, почему Start стал May 4 при Finish May 8 — потому что Duration оставили 4 дня). citeturn11search3  
- Ввод Start/Finish может автоматически поставить constraint:
  - Start затем Finish ⇒ ставится Finish No Earlier Than (FNET);
  - Finish затем Start ⇒ Start No Earlier Than (SNET). citeturn11search3turn3search3turn12search5  

**Реализация**: нужен механизм “driver fields / last edited”. Минимально:

- хранить `lastEditedTimestamp[field]` или «последний драйвер»;
- при наличии тройки (Start, Finish, Duration) выбирать, какие два считать «введёнными», а третье — «вычислить» (с доп. правилами task type / manual/auto). citeturn11search3turn24view0  

### Undo/Redo и «транзакционность» правок

Microsoft Office описывает:

- Undo = Ctrl+Z, можно повторять для отката нескольких шагов.
- Redo = Ctrl+Y или F4. citeturn18search0turn18search2  

Для строгой реализации рекомендуется трактовать «одну правку в ячейке и commit» как одну атомарную транзакцию в истории:

- `BeginEdit(cell)` → накопление изменения → `CommitEdit`  
- `CommitEdit` формирует запись undo‑стека: (старое значение, новое значение, список затронутых производных полей + старые значения для отката).  

Публичная документация **не описывает**:
- точный размер undo‑стека в MS Project,
- гарантии атомарности при массовых операциях (fill down, вставка задач, перенос времени),
- влияние автопересчёта на записи undo.

Поэтому для воспроизведения поведения «как в Project» рекомендованы эмпирические тесты (см. раздел реализации). citeturn18search0turn7view0turn3search21  

## Форматы файлов и сериализация: .mpp, Project XML (MSPDI), SDK, Server/Online

### .mpp: статус спецификации

В публичном поле нет полноценной спецификации .mpp на уровне Microsoft‑документации; в Microsoft Q&A прямо подтверждают «There isn’t a spec for the .mpp file» и предлагают альтернативы: VBA‑макросы/экспорт в XML/CSV и т.п. citeturn19view0  

**Следствие**: если цель — реализация «движка MS Project» и обмен данными, опираться на .mpp как на документированный формат нельзя; реалистичные варианты:

- использовать **Project XML export/import** (MSPDI),
- использовать автоматизацию (VBA/COM) для чтения/выгрузки данных,
- для Project Server/Online — использовать CSOM/REST/экспортные схемы. citeturn19view0turn9search11turn9search8  

### Project XML Data Interchange (MSPDI): основные структуры

Microsoft публикует схему **mspdi_pj12.xsd** и документацию по элементам; XSD доступна по адресу schemas.microsoft.com, а страницы описания элементов доступны в Learn. citeturn9search3turn5search16turn9search11  

Ключевые факты:

- `<Project>` — корневой элемент, включает calendars/tasks/resources/assignments/extended attributes и т.д. citeturn6search21turn9search11  
- `<Task>` содержит основные поля: `Start`, `Finish`, `Duration`, `Work`, `EffortDriven`, `ConstraintType`, `ConstraintDate`, `Deadline`, `CalendarUID`, `IgnoreResourceCalendar`, `PredecessorLink`, `TimephasedData` и др. citeturn14view1turn20search10  
- `CalendarUID` — ссылка на календарь проекта/задачи (UID из коллекции Calendars). citeturn15search3turn15search29turn5search2  
- `PredecessorLink` — вложенный объект связи (см. ниже). citeturn16search6turn20search1  

#### Сериализация зависимостей (PredecessorLink)

В Project XML:  
`<Task><PredecessorLink> ... </PredecessorLink></Task>` citeturn14view1turn20search1  

Поля:

- `PredecessorUID` — UID задачи‑предшественника. citeturn16search6turn20search1  
- `Type` — FF/FS/SF/SS. citeturn16search6turn20search1turn20search3  
- `LinkLag` — лаг в десятых минуты. citeturn16search6turn16search2  
- `LagFormat` — формат единицы для `LinkLag`. citeturn16search6turn16search5  

Коды `LagFormat`/`DurationFormat` перечислены в XSD (m/h/d/w/mo и elapsed‑варианты). citeturn17search2turn17search9  

#### Календари и повременные данные

- Calendar элемент описывает working/nonworking и исключения; проект должен иметь базовый календарь. citeturn5search2turn5search0  
- TimephasedData хранит повременные значения по типам (76 типов), с интервалом Start/Finish и Unit. citeturn13view1turn20search7  

### Project Online / Project Server: типы и экспортные определения

Microsoft публикует «export data definitions», где видны важные перечисления:

- `TaskType`: `0=Fixed Units, 1=Fixed Duration, 2=Fixed Work`. citeturn10search9turn6search13  
- `AssignmentWorkContour`: `0=Flat, 1=Back Loaded, …, 7=Turtle, 8=Contoured`. citeturn6search13  

Для API уровня Project Server CSOM:

- CSOM доступен из Project Online и on‑prem Project Server через `Microsoft.ProjectServer.Client`. citeturn9search8  
- Есть перечисление `TaskType` для fixed units/work/duration (как часть пространства имён). citeturn10search11turn10search26  
- Свойство ScheduledFromStart (в объектах проекта) отражает «планировать от начала» vs «от конца». citeturn10search23turn7view0  

### COM/VBA (Desktop) как «источник истины» по внутренним единицам

Для Desktop‑автоматизации Microsoft документирует:

- `Task.Duration` — minutes. citeturn9search6  
- `Task.Work` — minutes. citeturn10search0  
- `Task.Type` — одно из `pjFixedUnits / pjFixedDuration / pjFixedWork`; default можно задавать через `Project.DefaultTaskType`. citeturn10search1turn23search6  

Это важно, потому что даёт однозначную «каноническую» единицу в коде и связывает её с UI‑единицами через параметры MinutesPerDay/Week и DurationFormat. citeturn5search1turn6search5turn17search2  

## Рекомендации для реализации в коде: архитектура, матрицы пересчёта, тесты и производительность

### Архитектурная модель и API

Рекомендуемая структура модулей:

- `CalendarEngine`
  - `NextWorkingTime(dt, calendar)`
  - `AddWorkingMinutes(dt, minutes, calendar)`
  - `WorkingMinutesBetween(start, finish, calendar)`
  - поддержка elapsed‑единиц (24×7) отдельно. citeturn17search9turn5search2turn15search1  

- `TaskGraph`
  - adjacency по `PredecessorLink` (хранить и forward, и reverse списки)
  - топологическая сортировка (для DAG) + стратегия для «сложных» связей (FF/SF) через преобразование в start‑ограничения при фиксированной длительности. citeturn16search6turn4search1  

- `SchedulingEngine`
  - `RecalculateSchedule(changedTasksSet)`
  - forward/backward pass
  - вычисление early/late/slack/critical по формулам. citeturn3search0turn12search9turn3search2  

- `WorkEngine`
  - применение матрицы task type для пересчёта Work/Duration/Units
  - поддержка effort‑driven при операциях с назначениями
  - генерация timephased work по contour (минимум flat, плюс scaffolding для остальных). citeturn24view0turn25view0turn6search13turn13view1  

- `EditSession/UndoRedo`
  - транзакционные правки + авто/ручной calc режим
  - undo/redo стек (Ctrl+Z / Ctrl+Y semantics). citeturn18search0turn7view0  

### Матрица пересчётов для кода

#### Матрица «редактировали X → пересчитать Y» (ядро MS Project)

Это «нормативная» матрица Microsoft, которую стоит напрямую закодировать. citeturn24view0  

| Task.Type | Edit Units | Edit Duration | Edit Work |
|---|---|---|---|
| Fixed Units | recalc Duration | recalc Work | recalc Duration |
| Fixed Work | recalc Duration | recalc Units | recalc Duration |
| Fixed Duration | recalc Work | recalc Work | recalc Units |

citeturn24view0  

#### Дополнение: изменения состава назначений (Add/Remove resource)

При `EffortDriven = true` (или по правилам исключений Microsoft):

- общий `Work_task` остаётся константой и перераспределяется по назначениям; для Fixed Units это проявляется как сокращение Duration; для Fixed Duration — уменьшение individual units. citeturn25view0turn11search9  

### Практические числовые примеры: пошаговые расчёты

Ниже — примеры, опирающиеся на официальные численные сценарии Microsoft (80h, 10d, 1 FTE). citeturn24view0turn2search0  

> Предположения примеров (как у Microsoft в сценариях): 1 «рабочий день» = 8 часов, ресурс 100% = 1.0 units, календарь стандартный. citeturn2search0turn5search0turn5search1  

#### Сценарий изменения длительности при Fixed Units

Исходные данные (из сценария Microsoft):  
- Duration = 10d  
- Work = 80h  
- Units = 1.0 (100%) citeturn24view0  

Проверка формулы:
\[
80h = 10d \times 1.0 \times 8h/d
\]
что соответствует примеру «1d при 100% даёт 8h». citeturn2search0turn24view0  

Изменение: пользователь меняет Duration на 8d.  
По матрице Fixed Units: при изменении Duration пересчитывается Work. citeturn24view0  

Новый Work:
\[
Work' = 8d \times 1.0 \times 8h/d = 64h
\]
Microsoft прямо подтверждает результат «8-day duration, 64 hours of work, 1 resource unit». citeturn24view0  

#### Сценарий изменения длительности при Fixed Work (пересчёт Units)

Исходные данные те же: Duration 10d, Work 80h, Units 1.0. citeturn24view0  

Изменение: пользователь меняет Duration на 8d.  
По матрице Fixed Work: при изменении Duration пересчитываются Units. citeturn24view0  

Новые Units:
\[
Units' = \frac{Work}{Duration'} = \frac{80h}{8d\times 8h/d} = \frac{80}{64} = 1.25
\]
Microsoft: «1.25 resource units … over allocated at 125%». citeturn24view0  

#### Сценарий изменения Work при Fixed Duration (пересчёт Units)

Исходные данные: Duration 10d, Work 80h, Units 1.0. citeturn24view0  

Изменение: Work увеличивают на +20h ⇒ Work = 100h.  
По матрице Fixed Duration: при изменении Work пересчитываются Units. citeturn24view0  

Новые Units:
\[
Units' = \frac{100h}{10d\times 8h/d}= \frac{100}{80}=1.25
\]
Microsoft подтверждает: «1.25 resource units … over allocated at 125%». citeturn24view0  

#### Проценты выполнения и fact/remaining — формулы

Для задачи с Duration=10d и `% Complete`=30%:

\[
ActualDuration = 10d \times 0.30 = 3d
\]
\[
RemainingDuration = 10d - 3d = 7d
\]
citeturn2search2turn2search9  

Если есть Work=80h и `Actual Work` = 20h:

\[
\%WorkComplete = \frac{20}{80}\times100 = 25\%
\]
citeturn2search22turn2search8  

### Поведение «длительность ↔ даты» и связанные constraints — пример Microsoft

Microsoft фиксирует:

- если вводят Start=May 1 и Finish=May 4 ⇒ Duration=3d; при изменении Finish на May 5 ⇒ Duration=4d;  
- но при определённых последовательностях правок Project может удержать Duration, пересчитав Start (пример с Finish=May 8 ⇒ Start=May 4 при Duration=4d). citeturn11search3  

Для реализации это означает: «даты и длительность» — это не просто три поля, а система с драйверами и автопостановкой ограничений (FNET/SNET при вводе). citeturn11search3turn12search5  

### Производительность на больших сетях задач

MS Project (и Project Server) реально используется на больших планах, и Microsoft отмечает, что операции над задачами через APIs могут быть ресурсоёмкими (косвенно видно в заметках о производительности/обновлениях). citeturn9search20  

Для собственного движка:

- Хранить граф как adjacency списки; пересчёт делать **инкрементально**: при изменении задачи пересчитывать только достижимые successors (forward) и predecessors (backward) при необходимости slack.  
- Календарную арифметику оптимизировать: кэшировать «рабочие интервалы» на горизонте проекта (например, по дням) и использовать префиксные суммы рабочих минут для быстрого `WorkingMinutesBetween`.  
- Timephased данные держать лениво: генерировать по требованию (просмотр/экспорт) и инвалидировать только затронутые диапазоны.

### Набор тест‑кейсов и пограничных сценариев

Ниже — тест‑матрица, которая воспроизводит ключевое поведение, подтверждённое Microsoft-источниками.

**Тесты пересчёта (Work/Duration/Units):**
- Fixed Units: edit Duration ⇒ Work меняется; edit Work ⇒ Duration меняется. citeturn24view0  
- Fixed Work: edit Duration ⇒ Units меняется; ed Units ⇒ Duration меняется; проверить запрет выключения EffortDriven. citeturn24view0turn25view0  
- Fixed Duration: edit Work ⇒ Units меняется; edit Units ⇒ Work меняется. citeturn24view0  

**Тесты effort‑driven на операциях назначений:**
- Добавить второй ресурс к Fixed Units при включённом effort‑driven: Duration сокращается, Work константа. citeturn25view0turn24view0  
- Добавить второй ресурс к Fixed Duration: individual units уменьшаются. citeturn25view0  
- Проверить правило «First assignment»: поведение при первом назначении отличается от добавления второго. citeturn25view0  

**Тесты календарей:**
- Task calendar supersedes project calendar; при назначении ресурса используется intersection, если ignore resource calendar = No. citeturn5search4turn15search1  
- Ignore resource calendar = Yes ⇒ использовать только task calendar. citeturn15search1turn5search4  
- Elapsed durations: 7ed vs 7d должны расходиться на календаре с выходными. citeturn17search9turn17search2  

**Тесты зависимостей и лагов:**
- Проверить сериализацию: `1d lag` → LinkLag=4800 при MinutesPerDay=480. citeturn16search2turn16search6turn5search1  
- Ввод lead/lag как отрицательного/положительного значения. citeturn2search14turn2search7  

**Тесты CPM‑показателей:**
- TotalSlack = min(LF−EF, LS−ES). citeturn3search0turn12search4  
- FinishSlack = LF−EF. citeturn12search9  
- Critical вычисляется по порогу slack. citeturn3search2turn3search7  

**Тесты прогресса:**
- `% Complete` задаёт `ActualDuration = Duration * %Complete`; влияет на Actual Start/Finish автозаполнением. citeturn2search2turn2search9  
- `% Work Complete = ActualWork/Work*100`. citeturn2search22  
- `Remaining Duration` ввод пересчитывает `Duration` как Actual+Remaining. citeturn2search6  

### Неоднозначности и «что нужно пометить как эмпирическое»

Публичная документация Microsoft **не фиксирует** (по крайней мере в доступных источниках):

- точную «кривую» распределения для каждого Work Contour (кроме перечня видов и их кодов) — поэтому нужно тестировать соответствие графикам timephased work; citeturn6search13turn17search3turn13view1  
- точные правила округления в UI (например, как округлять дробные минуты в задачах с пересечением календарей или при конвертации days↔minutes, особенно при нестандартных MinutesPerDay/Week/DaysPerMonth); известно лишь, что lag хранится в десятых минуты и что существуют MinutesPerDay/Week/DaysPerMonth — этого достаточно для движка, но для «пиксель‑в‑пиксель» совпадения с UI нужны тесты. citeturn16search2turn5search1turn6search5turn6search2  
- точную гранулярность timephased‑разбиения при разных видах шкалы времени (Day/Week/Hour) — в XML это задаётся Unit, но правила генерации при пересчёте не специфицированы. citeturn13view1turn13view0  

### Дополнительные части (если продолжать «до 1000 листов»)

Если разворачивать отчёт в «полный справочник реализации», логично вынести в отдельные части:

- Полный каталог полей Task/Resource/Assignment, их Entry Type (entered/calculated), влияние на scheduling и сериализацию в MSPDI. citeturn14view1turn3search14turn20search7  
- Полная спецификация MSPDI по элементам Calendars/Resources/Assignments/ExtendedAttributes с примерами XML фрагментов. citeturn9search11turn9search23turn9search31turn5search9  
- Детальная модель выравнивания ресурсов (resource leveling), задержек (LevelingDelay) и их влияния на Early Finish/Slack. citeturn12search2turn3search17turn14view1turn7view0  
- Модель трекинга с Status Date и опциями Move completed/incomplete частей относительно status date. citeturn12search3turn12search28turn12search6