# 41. Phase 10: Backend production hardening

## Статус

Phase 10 начинается после закрытия основных backend capability-срезов:

- Phase 5/6 planning engine backend;
- Phase E tenant capacity backend;
- Phase F storage/search backend;
- Phase 7 KPI/signals/action engine backend;
- Phase 8 control surfaces builder backend;
- Phase 9 closure/retrospectives backend.

Это не новая feature-фаза. Цель Phase 10 — доказать, что существующий backend-контур безопасен, изолирован по tenant, проверяем, наблюдаем и готов к self-hosted/release-like эксплуатации.

## Product intent

Пользовательская ценность Phase 10 не в новых экранах, а в снижении эксплуатационного риска:

- operator/self-hosted admin может поднять, проверить, обновить и восстановить систему;
- tenant admin и PM/resource manager могут доверять расчетам, правам, audit и данным;
- команда разработки получает ясный release gate вместо бесконечного "еще чуть-чуть поправим".

## Backend capability inventory gate

Перед hardening каждая backend surface должна получить один из статусов:

- `done` — capability реализована и покрыта базовыми тестами;
- `gap` — требуется фикс в Phase 10;
- `follow-up` — важно, но не блокирует production-readiness v1;
- `out-of-scope` — явно не входит в Phase 10.

Инвентарь ведется в `docs/status/2026-05-25-backend-capability-inventory.md`.

## Hardening matrix

Каждая поверхность проверяется по одной матрице:

| Поверхность | Проверки |
|-------------|----------|
| Planning command / solver apply | tenant isolation, permissions, planVersion/preconditions, persisted proposal consistency, audit |
| Tenant capacity/resource load | hidden contribution masking, project filter semantics, cache invalidation, tenant isolation |
| KPI/signals/action engine | definition safety, evaluation traceability, governed action path, audit |
| Control surfaces | draft/preview/publish/rollback/archive, version immutability, action binding safety |
| Storage/search | upload/download safety, URL validation, metadata leakage, provider internals redaction |
| Closure/retrospectives | immutable snapshots, plan/fact metrics, lessons/actions audit, retry/conflict semantics |
| Auth/RBAC/audit | session/CSRF, denied paths, stable errors, correlation and safe metadata |

## Phase 10 work packages

### 10.1 Security and privacy

- Threat-model pass для auth/session, uploads/downloads, search, capacity masking, external references, control action bindings и audit.
- Запрет утечек: storage keys, local paths, credentials, provider internals, hidden project/task metadata.
- Denial paths должны возвращать стабильные ошибки и писать audit там, где действие является management/action mutation.

### 10.2 DB, migrations and data integrity

- Миграции проходят на clean DB и seeded/dev-like DB.
- `test:db` доказывает tenant isolation, cascade/archive rules, uniqueness constraints, persisted run/proposal consistency, attachment exclusivity и immutable versions.
- Rollback policy документирует backup-before-migrate, non-reversible migrations и ожидаемый способ восстановления.

### 10.3 Performance and reliability

- Production-shaped fixture покрывает multiple projects/tasks/resources, capacity month tree, metadata search, planning read-model, control signals/actions и audit list.
- V1 thresholds:
  - common backend reads: локальный integration p95 до `500ms`;
  - tenant-wide capacity month fixture: локальный integration p95 до `1500ms`;
  - request paths не делают unbounded tenant-wide scan, если есть scoped query.
- Projection добавляется только после failing evidence:
  - `global_search_documents` — если metadata search не проходит threshold;
  - materialized capacity cache — если runtime aggregation не проходит threshold.

### 10.4 Operations readiness

- Добавить или укрепить:
  - `GET /health/live`;
  - `GET /health/ready`;
  - DB connectivity + migration/schema readiness;
  - storage provider read/write readiness;
  - optional Redis/event bus readiness, если включен.
- Operator runbooks:
  - install/start/update;
  - env variables;
  - backup/restore;
  - migration procedure;
  - storage cleanup policy;
  - incident checklist.

Runbook: `docs/runbooks/backend-operations.md`.

### 10.5 Release-like backend smoke

Финальный smoke обязан пройти контур:

```txt
auth/session
  -> CRM/project/task
  -> planning preview/apply
  -> solver proposal/apply
  -> tenant capacity read
  -> KPI evaluation/signal/action
  -> attachment/search
  -> control surface draft/publish
  -> closure snapshot/lesson/template improvement
  -> audit verification
```

Отдельно проверяется хотя бы один representative unauthorized mutation.

## Non-scope

- UI-доводка, visual audit viewer, dashboard polish.
- BI/export.
- Connector sync jobs.
- Full-text file extraction.
- Antivirus/DLP.
- Approval workflow для absences.
- Новые бизнес-capability, не нужные для безопасности, проверяемости или эксплуатации уже реализованного backend.

## Exit gate

Phase 10 закрыта только когда:

- capability inventory не содержит `gap` без решения;
- все Required hardening findings исправлены или явно приняты как follow-up;
- `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm test:db` проходят;
- security/privacy regression tests проходят;
- migration verification проходит на clean и seeded DB;
- performance fixture проходит thresholds или имеет принятое projection/follow-up решение;
- release-like backend smoke проходит;
- operator runbooks достаточны для self-hosted admin.
