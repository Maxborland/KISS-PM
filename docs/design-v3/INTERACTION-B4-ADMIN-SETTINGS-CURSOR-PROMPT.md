# Cursor Prompt — Batch B4: Admin + Settings persistence

Inherit master rules.

## Files in scope

```txt
apps/web/src/views/blocks/admin-block.tsx
apps/web/src/views/blocks/settings-block.tsx
apps/web/src/views/screens/screens.stories.tsx (variants)
```

## P0

1. `admin-block.tsx` L28–31 «Пригласить» → `Dialog` stub (email input + Send button toast).
2. `admin-block.tsx` L62–64 row `IconButton` → `DropdownMenu` Edit/Block/Delete with toast.
3. `admin-block.tsx` L75–78 «Аудит» → either route stub (`onClick={() => alert("Открывается журнал аудита")}`) or `disabled title=`.
4. `settings-block.tsx` L28 «Сохранить» — controlled, `disabled={!isDirty}`, toast on save.

## P1

5. `admin-block.tsx` L82–85 — lift 4 policies to `useState`; controlled `SwitchRow` with `checked` + `onCheckedChange`.
6. `settings-block.tsx` L57–82 profile fields — controlled with `useState`; mark `isDirty` on change.
7. `settings-block.tsx` L90–103 notification switches — controlled.
8. `settings-block.tsx` integrations/billing tabs (L43–50 demo copy) — render actual `CardPanel` content (3–5 mock integration cards each with `Connect` `disabled` or local toggle).

## P2

9. `screens.stories.tsx` — `AdminInviteOpen`, `SettingsDirtyProfile`, `SettingsIntegrationsContent`.

## Acceptance

- Admin: invite dialog opens; row menu opens; policies persist locally; dirty indicator visible.
- Settings: profile dirty state visible; Save disabled until dirty; integrations/billing have content.

## Verification

Master gate + `interaction-batch-4-evidence.json`.
