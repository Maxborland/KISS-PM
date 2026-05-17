# Phase 12 Release Demo Tenant Template Pack

This document defines the deterministic P12 release demo tenant pack used by the market-release gate. It is not a template marketplace and it does not describe customer-specific production data.

## P12 release demo tenant

Tenant A (`tenant-a`) is the release demo tenant for `E2E-110`. The pack uses deterministic fixture ids only:

- operator admin: `tenant-admin-a`
- tenant admin: `tenant-admin-a`
- project manager: `project-manager-a`
- resource manager: `resource-manager-a`
- executive portfolio viewer: `tenant-admin-a`
- executor: `executor-a`
- integration admin: `tenant-admin-a`
- read-only observer: `readonly-observer-a`

Tenant B (`tenant-b`) is reserved for isolation checks only. Tenant B private ids must not appear in Tenant A read models, UI search results, audit evidence, or E2E output except as denied/no-leak assertions.

## Template pack

The sample template pack key is `release_demo_control_loop`. It is intentionally small and maps the complete release journey:

```txt
CRM opportunity
  -> project draft
  -> active project and baseline
  -> resource/KPI/control signals
  -> governed action and audit
  -> closure snapshot
  -> retrospective improvement
  -> operator readiness evidence
```

The pack contains:

- stages: `intake`, `planning`, `execution`, `control`, `closure`, `retrospective`;
- role templates: operator admin, tenant admin, project manager, resource manager, executive, executor, integration admin, read-only observer;
- control surfaces: CRM intake, project work, Gantt, resource load, KPI deviation, portfolio control, closed portfolio retrospectives, integration diagnostics, operator readiness;
- sample action keys for project creation, baseline capture, resource resolution, and governed portfolio action;
- custom fields: `risk_level`, `release_readiness_owner`;
- saved views: `critical_portfolio`, `operator_readiness`.

## Mocked external services

All P12 release demo and E2E-110 setup uses mocked external services. The required mode is:

```txt
KISS_PM_EXTERNAL_SERVICES_MODE=mocked
```

The mock adapter seed is `adapter-mock-crm` / `conn-mock-crm-a` with payload fixture `mock-crm-valid`. Keep this pack on deterministic mock adapter data and empty credential placeholders only.

## Evidence handoff

`packages/shared-test-fixtures/src/phase12Fixtures.ts` is the source of truth for deterministic ids and documentation links. Later P12-008/P12-009 work should consume this seed instead of inventing new ids.
