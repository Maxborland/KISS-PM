# Backend capability inventory — 2026-05-25

Этот ledger фиксирует состояние backend capability перед Phase 10. Он нужен, чтобы production hardening не превратился в новую feature-фазу.

## Status legend

| Status | Meaning |
|--------|---------|
| `done` | Реализовано и имеет базовое покрытие |
| `gap` | Нужно исправить в Phase 10 |
| `follow-up` | Не блокирует Phase 10, но требует отдельного backlog item |
| `out-of-scope` | Не входит в Phase 10 |

## Capability matrix

| Capability | Evidence | Status | Phase 10 focus |
|------------|----------|--------|----------------|
| Phase 5/6 planning engine backend | PR #16, `docs/30_PHASE_5_6_MS_PROJECT_CLASS_BACKEND.md` | `done` | preconditions, audit, solver/apply idempotency, performance fixture |
| Phase E tenant capacity backend | PR #22, `docs/38_PHASE_D_PLAN.md` section Phase E | `done` | hidden contribution masking, cache invalidation, tenant/month fixture |
| Phase F storage/search backend | PR #23, `docs/26_PHASE_4_2_STORAGE_CONNECTOR_FOUNDATION.md` | `done` | upload/download safety, URL validation, metadata leakage, storage readiness |
| Phase 7 KPI/signals/action backend | implementation merged before Phase 8, `docs/39_PHASE_7_KPI_SIGNALS_ACTION_ENGINE_BACKEND.md` | `done` | evaluation traceability, action apply governance, tenant isolation |
| Phase 8 control surfaces backend | PR #25, hotfix PR #26, `docs/40_PHASE_8_CONTROL_SURFACES_BUILDER_BACKEND.md` | `done` | version immutability, archive/publish edge cases, action binding safety |
| Phase 9 closure/retrospectives backend | PR #27, hotfix PR #30 | `done` | immutable snapshot consistency, plan/fact metrics, retry/conflict semantics |
| Auth/RBAC/audit foundation | Phase 2/3/4 ledgers and current API tests | `done` | denial consistency, audit redaction, operator diagnostics |

## Known follow-ups

| Item | Status | Phase 10 decision |
|------|--------|-------------------|
| Real connector sync jobs | `out-of-scope` | Future integration phase |
| Full-text file extraction | `out-of-scope` | Future search/document phase |
| Antivirus/DLP | `out-of-scope` | Future enterprise hardening |
| Absence approval workflow | `out-of-scope` | Future resource governance phase |
| BI/export | `out-of-scope` | Future reporting/export phase |
| Materialized capacity cache | `follow-up` | Add only if Phase 10 performance fixture fails |
| `global_search_documents` projection | `follow-up` | Add only if Phase 10 metadata search fixture fails |

## Phase 10 acceptance link

Phase 10 implementation must keep this ledger current. Any new `gap` found during review must be resolved before release readiness, or moved to `follow-up` with an explicit accepted risk.
