# План: унификация двух реализаций CRM-пайплайнов (PR #205)

## Контекст коллизии
PR #205 (`codex/storybook-interface-scaffold-audit-20260621` → база `codex/crm-pipeline-routes-rbac-audit`)
конфликтует, потому что обе ветки независимо реализовали CRM-пайплайны **по-разному**:

- **База (6 июня) — «first-class governance»**: 4 новые таблицы `crm_pipelines`, `crm_pipeline_stages`,
  `crm_pipeline_transition_rules`, `crm_pipeline_stage_automation_definitions`; `deal_stages` оставлены
  плоскими. Богатый lifecycle (`lifecycle_state` open/won_closed/lost_rejected ⇔ `is_final`, CHECK на
  трёх слоях), производный `lifecycle_graph_metadata` (jsonb), 12 REST-роутов `/api/workspace/crm/pipelines`,
  **4 гранулярных RBAC-права**, полный аудит, partial-PATCH, OpenAPI. Автоматизации (stage_entered/left →
  action_type+action_config) как определения. **Но**: нет рантайм-эншфорса перемещения сделки (правила
  переходов хранятся, но не применяются к opportunity).
- **Моя ветка (24 июня) — «operational multi-funnel»**: таблица `pipelines` (тонкая:
  name/description/isDefault/sortOrder/status), `stage_transitions` (from/to + require_feasibility_ok/
  min_probability/guard_note), `deal_stages.pipeline_id` (nullable retrofit), `opportunities.pipeline_id`.
  Домен `pipelineTransitions` (evaluateStageTransition / evaluatePipelineChange /
  evaluateOpportunityStageTransition). **Рантайм-роуты перемещения** `/opportunities/:id/stage` (422/409) и
  `/opportunities/:id/pipeline`. RBAC через deal-stage-права. Бэкфилл дефолтной воронки на тенант. **Весь
  storybook-CRM построен на этой модели** (mock + поверхности: канбан по воронке, гварды переходов,
  кросс-воронка, форкаст, honesty-баннеры с точными эндпойнтами/кодами).

Прямой конфликт: тест базы утверждает `deal_stages` плоские (7 колонок) + существует `crm_pipeline_stages`;
мой тест утверждает `deal_stages.pipeline_id` + `stage_transitions`/`pipelines`. `deal_stages` не может быть
одновременно и плоским, и pipeline-aware. Чистого сосуществования нет — нужна унификация (свёртка в одну
связную модель). Решение пользователя: **объединить оба = first-class таблицы + автоматизация/rbac базы И
storybook-интеграция моей ветки.**

## РЕШЕНИЕ (чекпоинт Фазы 1, утверждено): Direction 2 — канон = first-class таблицы базы
Каноническая модель стадий — **`crm_pipeline_stages` базы** (pipeline-owned, lifecycle_state/is_final),
а НЕ свёртка в `deal_stages`. Соответственно:
- `crm_pipelines` (база) += операционные `is_default`, `sort_order`, `description` (нужны вебу).
- `crm_pipeline_stages` (база) = каноническая таблица стадий; веб `GET /deal-stages` сериализует её строки
  как `DealStage{ id, tenantId, pipelineId, name, sortOrder, status (+ lifecycleState, isFinal аддитивно) }`.
- `crm_pipeline_transition_rules` (база) += мои runtime-гвард-поля `require_feasibility_ok`,
  `min_probability`, `guard_note` (рядом с governance-полями базы required_permission/required_fields/
  require_reason). Веб `StageTransition` сериализует эту таблицу (camelCase, мои гвард-поля).
- `crm_pipeline_stage_automation_definitions` (база) — как есть.
- `opportunities` += `pipeline_id`; `stage_id` теперь ссылается на **`crm_pipeline_stages`** (не deal_stages).
- Мои таблицы `pipelines` / `stage_transitions` и retrofit `deal_stages.pipeline_id` **упраздняются**;
  `deal_stages` возвращается к плоскому виду базы (legacy; решить keep-as-legacy vs drop по радиусу ссылок).
- Домен: `pipelineTransitions` (мои runtime-гварды) адаптируются читать `crm_pipeline_transition_rules` +
  `crm_pipeline_stages`; `crmPipeline` базы (graph/finality) — как есть.
- Роуты: веб-facing пути (мои: `/pipelines`, `/deal-stages`, `/pipelines/:id/stage-transitions`,
  `/opportunities/:id/{stage,pipeline}`) перенацеливаются на базины таблицы; рич-менеджмент базы
  `/crm/pipelines/*` (stages CRUD с lifecycle, automations, гранулярный RBAC) сохраняется. Допускается
  двойной namespace поверх ОДНИХ канонических таблиц (минимум churn вебу).

(Ниже исходные секции плана; модель данных читать в свете решения Direction 2 выше.)

## Принцип унификации
Operational-модель моей ветки (на ней держится storybook) — **скелет**; governance-богатство базы
(lifecycle/finality/derived-graph/automations/RBAC/audit/OpenAPI-строгость) **наращивается сверху**.
Отдельные `crm_pipeline_*` таблицы базы **сворачиваются** в один stage-table (`deal_stages`), потому что
веб читает именно `deal_stages` с `pipelineId` (1:N стадия→воронка), и honesty-баннеры фиксируют эти пути.

## Унифицированная модель данных (одна связная)
- **`pipelines`** = операционные колонки моей ветки (name, description, isDefault, sortOrder, status) +
  производное base-поле **`lifecycle_graph_metadata`** (jsonb NOT NULL, без дефолта, server-derived, клиент
  не задаёт; пересобирается на каждое изменение стадий/правил).
- **`deal_stages`** = ЕДИНАЯ таблица стадий (таблица базы `crm_pipeline_stages` упраздняется, её колонки
  складываются сюда): `id, tenant_id, pipeline_id` (моё), `name, sort_order, status` + base-governance
  **`lifecycle_state`** (open/won_closed/lost_rejected) + **`is_final`** + CHECK
  `final ⇔ lifecycle_state∈{won_closed,lost_rejected}` (и open ⇔ non-final). `pipeline_id` остаётся
  nullable (веб толерантен к legacy/«Без стадии»), но бэкфилл проставляет дефолтную воронку. Уникальности
  pipeline-scoped (`(tenant, pipeline, sort_order)`, `(tenant, pipeline, name)`).
- **`stage_transitions`** = ЕДИНАЯ таблица правил перехода = объединение гвардов: `pipeline_id, from_stage_id,
  to_stage_id` + моё `require_feasibility_ok, min_probability, guard_note` + base `required_permission
  (nullable), required_fields (jsonb default []), require_reason (bool)`. CHECK `from≠to`, unique
  `(tenant, pipeline, from, to)`. Питает И рантайм-гварды (мои move-роуты), И производный граф (база).
- **`crm_pipeline_stage_automation_definitions`** = автоматизации базы как есть, но `stage_id` ссылается на
  `deal_stages` (чистое добавление; у моей ветки эквивалента нет).
- **`opportunities.pipeline_id`** = моё (nullable, держится в синхроне со стадией). 
- **Одна миграция**: обе ветки добавили файл `0041` (`0041_crm_pipeline_schema_contract.sql` базы и
  `0041_phase_h2_multi_funnel.sql` моя) → коллизия номера. Свести в один связный `0041` (живой БД не
  применялись — безопасно переписать). `migration.test` (порядок/без-пропусков) держать зелёным.

## Домен
- Сохранить мой `pipelineTransitions` (рантайм-гварды) **И** base `crmPipeline`
  (buildCrmPipelineLifecycleGraph, lifecycle-state-типы, finality-инвариант, automation-типы, guards).
- Правила перехода базы теперь **эншфорсятся в рантайме** моими move-роутами (база их только хранила).
  Деривация графа читает `deal_stages`(lifecycle_state/is_final) + `stage_transitions` по воронке.
- `index.ts`: экспортировать оба модуля (это был один из 8 конфликтов — берём ОБЕ строки export).

## API (один namespace роутов — веб-facing пути моей ветки, обогащённые возможностями базы)
- Сохранить веб-facing пути (honesty-баннеры их фиксируют): `/api/workspace/pipelines` CRUD,
  `/deal-stages` CRUD (теперь с lifecycle_state/is_final), `/pipelines/:id/stage-transitions` CRUD (теперь с
  governance-полями), `/opportunities/:id/{stage,pipeline}` рантайм-перемещения (422/409).
- Добавить из базы: **эндпойнты автоматизаций**, пересборку **производного lifecycle-графа** на мутациях
  стадий/правил, **partial-merge PATCH** (patchBodyWithExisting) на всех апдейтах.
- Принять **4 гранулярных RBAC-права базы** (`tenant.crm_pipelines.read/manage`,
  `tenant.crm_pipeline_rules.manage`, `tenant.crm_pipeline_automations.manage`), отмапив на эти роуты;
  opportunity-перемещения сохраняют opportunity-права.
- Принять **тщательный аудит базы** (успех + denial, sourceWorkflow `crm_pipeline_management`).
- OpenAPI: объединение схем (DealStage += lifecycle_state/is_final; StageTransition += governance-поля;
  Pipeline += lifecycle_graph_metadata; + automation-схемы). Route-table — мои веб-facing пути + automations.

## RBAC / access-control
- Принять 4 права базы (`packages/access-control/src/index.ts` + `policy.test.ts`), сидинг в
  `tenantAdminProfile.ts`. Мои роуты deal-stage/transition/opportunity отмапить на них.

## Тесты — реконсилиация к унифицированному контракту
- **Обновить** «deal_stages плоские» базы → deal_stages pipeline-aware с lifecycle-полями
  (`schema.test.ts`, `crmPipelineContract.test.ts` DealStage). Сохранить мои pipeline_id-ассерты.
- Сохранить base finality/graph/automation/RBAC/audit тесты (перенаправить stage-ссылки на deal_stages,
  упразднить crm_pipeline_stages-ассерты, заменив на deal_stages).
- Сохранить мои runtime-guard тесты (pipelineTransitions.test, projectIntakeService.test: 422/409 split,
  cross_pipeline_move, stage_not_in_pipeline).
- Добавить unified-контракт-тесты, где модель срослась (граф читает deal_stages; правило с обоими наборами
  гвардов).

## Веб (storybook)
- Минимум: контракт сохранён (deal_stages.pipelineId, два move-эндпойнта, camelCase-поля переходов, коды/
  статусы) → mock + поверхности остаются зелёными. Новые поля (lifecycle_state/is_final/automations)
  аддитивны; опционально показать позже (не требуется для зелёного). Honesty-баннеры свериться/обновить,
  если коды/пути сместятся (план: не смещать).

## Порядок исполнения
1. Слить `origin/codex/crm-pipeline-routes-rbac-audit` в ветку; разрешить 8 конфликтов **в сторону
   унифицированной модели** (не одной стороной): index.ts (оба export), schema.ts (объединить таблицы,
   свернуть crm_pipeline_stages → deal_stages), schema.test.ts/crmRepository.ts/apiTypes.ts/
   routeParamParsers.ts/openApiDocument.ts/crmProjects.ts (объединить).
2. Реализовать свёртку + glue: deal_stages += lifecycle_state/is_final + finality CHECK + derived graph,
   transitions += governance-поля, automations → deal_stages, единая 0041, RBAC 4 права, audit,
   partial-PATCH, OpenAPI-объединение.
3. Полный цикл строгости: typecheck (web/api/persistence/domain/access-control) + ОБА тест-сьюта
   (mine + base, реконсилированные) из корня + `verify:storybook-contract` + Playwright-смоук CRM.
4. Состязательное ревью диффа (контракт-верность, инварианты обеих сторон сохранены, honesty) → фиксы.
5. Коммит + пуш → PR #205 мерджабелен.

## Риски / решения
- **Свёртка crm_pipeline_stages → deal_stages** меняет «deal_stages плоские»-намерение базы. Осознанно: моя
  ветка уже сделала deal_stages pipeline-aware, и веб на этом построен. Тесты базы реконсилируются.
- **Объём**: большой кросс-слойный кусок. Исполнять фазами с верификацией; всё в PR #205.
- **Миграция 0041 ×2**: свести в один файл, держать migration.test зелёным; живой БД не применялись.
- **Два route-namespace**: канон — веб-facing (мои), возможности базы вливаются в них; `/crm/pipelines/*`
  базы упраздняется/реролится (или оставить как алиас — решить при реализации; по умолчанию упразднить,
  чтобы не плодить дубль-контракт).
