# PROJ-110 — Settings default calendar -> Calendars

## Verdict

PASS для scoped lane. В текущем `settings-surface.tsx` CTA уже является реальной ссылкой на `/projects/:id/calendars`; product-код не изменялся. Добавлен regression-контракт для A/PR read paths и календарных fallback-labels.

## Scope

- Без изменений: `apps/web/src/delivery/settings/settings-surface.tsx`.
- Добавлен: `apps/web/src/delivery/settings/settings-navigation.test.tsx`.
- Не затронуты docs, coverage matrix и E2E.
- Коммит не создавался.

## Verified behavior

- A (`tenant.project_plan.read`) видит реальную подпись календаря и CTA-ссылку.
- PR (`tenant.project_plan.read` + `tenant.project_plan.manage`) видит тот же read path и CTA-ссылку.
- CTA имеет `href="/projects/project-110/calendars"` и текст `Открыть Календарь`.
- Реальный календарь отображается как `Производственный · Пн–Пт 8 ч`.
- Если `project.calendarId` не найден в `calendars`, отображается raw id.
- Если `project.calendarId` отсутствует, отображается `— (не задан)`.

## Verification

PASS:

```text
cd apps/web
pnpm vitest run src/delivery/settings/settings-navigation.test.tsx

Test Files  1 passed (1)
Tests       4 passed (4)
```

OUT-OF-SCOPE BLOCKED:

```text
cd apps/web
pnpm run typecheck

next typegen: PASS
tsc: FAIL
src/delivery/ui/delivery-frame-navigation.test.tsx(38,6): TS2375
projectId: string | undefined is not assignable to optional projectId: string
under exactOptionalPropertyTypes.
```

`delivery-frame-navigation.test.tsx` — параллельный untracked lane и вне разрешённого scope; файл не изменялся.

## CodeGraph change index

- Pre-edit context/impact: `ProjectSettings` — leaf surface; impact ограничен 4 self-local symbols в основном workspace и параллельном worktree.
- Area files: 3 -> 4 indexed files under `apps/web/src/delivery/settings`.
- Added indexed symbols: 0 -> 8 in `settings-navigation.test.tsx`, включая `renderSettings`.
- Resolved call edges for `renderSettings`: 0 -> 0 (CodeGraph не сформировал call edge для JSX/server-render wrapper).
- `settings-surface.tsx`: 29 -> 29 indexed symbols; source symbols and behavior unchanged.
- Post-edit `codegraph sync`: completed; index reported up to date and listed the new test file.

## Residual risk

Общий web typecheck нельзя подтвердить зелёным до исправления или завершения соседнего navigation lane. Scoped Vitest regression воспроизводим и проходит.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-settings.md
