# Cursor Prompt — Batch B5: Shell & Navigation Polish

Inherit master rules.

## Files in scope

```txt
apps/web/src/views/blocks/avatar-menu-block.tsx
apps/web/src/shell/app-sidebar.tsx
apps/web/src/shell/app-topbar.tsx
apps/web/src/shell/topbar-breadcrumbs.tsx
apps/web/src/shell/command-palette.tsx
apps/web/src/views/screens/screen-view.tsx
apps/web/src/views/layout/workspace-chrome.tsx
apps/web/src/views/catalog.ts                  (per-screen activeNav + topbar flags)
apps/web/src/views/screens/screens.stories.tsx (shell pattern stories)
```

## P1 (the whole batch is P1 polish)

1. `avatar-menu-block.tsx` L40–66 — each `DropdownMenuItem` gets `onSelect`:
   - «Профиль» / «Настройки» / «Уведомления» / «Безопасность» → `setLastAction(label)` + toast.
   - «Тема: светлая» → toggles `document.documentElement.classList` (`light`/`dark`).
   - «Выйти» → confirmation Dialog stub.
2. `app-sidebar.tsx` L39–48 — replace `<a href="#" onClick={preventDefault}>` with `<button>` + `onClick={onSelectItem(item.label)}` prop; add `aria-current="page"` for active.
3. `app-sidebar.tsx` — extend `BASE_GROUPS` (`sidebar-nav.ts`) with «Настройки» + «Админ» entries so `meta.activeNav` matches `09-admin` / `10-settings`.
4. `app-topbar.tsx` L18–20 «Уведомления» → `Sheet` stub with mock notification list (or `disabled title`).
5. `topbar-breadcrumbs.tsx` L17–19 — `<button type="button" onClick={onCrumbClick(index)}>` or `aria-disabled` + `title`.
6. `command-palette.tsx` L36–38 nav items `onSelect` → `onNavigate(screenId)` callback (story arg) + close.
7. `screen-view.tsx` + `workspace-chrome.tsx` — for `09-admin`/`10-settings`/`11-avatar-menu` pass `showDefaultActions={false}` (no fake Export/Create on these surfaces).

## P2

8. `screens.stories.tsx` — add `ShellPattern` story rendering `WorkspaceChrome` alone with mock content; `AvatarMenuOpen` (already exists, verify variants).

## Acceptance

- Sidebar nav highlights match the screen displayed.
- Avatar menu: every item produces visible action.
- Breadcrumbs: clicking parent crumb fires story action.
- Command palette: selecting `Дашборд` fires `onNavigate("01-dashboard")`.

## Verification

Master gate + `interaction-batch-5-evidence.json`.
