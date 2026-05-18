# Статус Phase 2.3: single-workspace config и audit hardening

## Блок

Audit viewer, negative RBAC browser coverage и первый workspace config baseline для custom fields/templates.

## Текущее состояние

- Scope Phase 2.3 зафиксирован в `docs/21_PHASE_2_3_SINGLE_WORKSPACE_CONFIG_AUDIT.md`.
- Single-workspace подход сохраняется: отдельную SaaS/operator admin surface в этой фазе не строим.
- Phase 2.3 должна добавить права `tenant.workspace_config.read` и `tenant.workspace_config.manage`.
- Custom fields/templates должны быть DB-backed, tenant-scoped и auditable.
- Custom fields/templates должны использовать canonical пару `systemKey` + `tenantLabel`.
- `Аудит` и `Настройки` должны быть permission-aware UI routes.

## Артефакты

- Canonical scope: `docs/21_PHASE_2_3_SINGLE_WORKSPACE_CONFIG_AUDIT.md`.
- Browser smoke: `e2e/smoke/single-workspace-auth-rbac.spec.ts` будет расширен в рамках реализации.

## Проверки блока 1

- Стартовый `git status --short`: generated `apps/web/next-env.d.ts` и untracked `phase2-2-users-crud.png`; generated файл возвращен к dev routes import, screenshot не трогается.
- Docs links добавлены в `AGENTS.md` и `docs/README.md`.
- Bug Hunt по docs baseline нашел 3 Important: acceptance не требовал root typecheck, create/update/validation были сформулированы слабее scope, negative RBAC не разделял read и mutation endpoints.
- Исправлено: acceptance теперь требует `pnpm typecheck`, отдельные create/update/validation/audit proofs для custom fields/templates и `403` для read + mutation endpoints.
- Security review Critical/Important не нашел; Minor уточнение про read/write `403` закрыто тем же acceptance update.
- Повторный Bug Hunt Critical/Important не нашел; minor по терминологии `tenantLabel` закрыт.
- Повторный security review Critical/Important/Minor не нашел.

## Review loop

- После каждого блока Phase 2.3: Bug Hunt, Requesting Code Review, security-best-practices review.
- Critical / Important замечания исправляются до перехода к следующему блоку.
