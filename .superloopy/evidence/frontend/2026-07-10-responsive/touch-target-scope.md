# Touch-target scope audit

Date: 2026-07-10 (Asia/Novosibirsk)
Mode: read-only audit; product source and route matrix were not edited.
Verdict: **PASS for scope determination**. The measured product baseline remains a FAIL until the scoped rule is implemented and remeasured from a build that matches the workspace source.

## Inputs and method

- Entered through CodeGraph after `codegraph sync`; indexed ownership was then narrowed with literal source reads for exact Tailwind strings and runtime selectors.
- Baseline evidence: `.superloopy/evidence/lane-responsive-traversal.md`, captured at `390x844` and `768x1024` with `hasTouch`.
- Fresh browser regression probe: live web `http://127.0.0.1:3180`, API `http://127.0.0.1:4180`, seeded admin, Chromium with the same touch viewports. The proposed CSS was injected only into the page DOM, measured, then removed. No create/update/delete request was sent.
- Token chain: shipped `--row-h = 36px` is set by `apps/web/src/styles/kiss-v4.css:57`; `--space-2 = 8px` is set by `apps/web/src/styles/tokens.css:66`. Therefore `calc(var(--row-h) + var(--space-2))` is exactly the required 44px target and stays on the existing 4px scale.
- Existing responsive anchor: `@media (max-width: 860px)` already exists in `apps/web/src/styles/bem.css:2239` for shell behavior.

## Build/source drift

During this audit, another lane modified the same area. The current working tree now contains uncommitted touch changes in `button.tsx`, `cva-shared.ts`, `dialog.tsx`, `shell-user-menu.tsx`, `workspace-shell.tsx`, `users-surface.tsx`, and `tokens.css`. The running build also began exposing some of them.

That concurrent patch is **not the minimum requested scope**:

- `apps/web/src/components/ui/button.tsx:10` inflates every shared `Button`, not only the failing `size="sm"` controls.
- Its mobile-first `lg:*` reset applies touch sizing to mouse users below the `lg` breakpoint; it is width-only rather than `(pointer: coarse)` scoped.
- `apps/web/src/styles/tokens.css:143` introduces `--touch-target`; the smaller rule below needs no parallel sizing token because the required value is already derivable from `--row-h + --space-2`.
- The concurrent shell patch does correctly close the original 768px sidebar-link failure and adds missing mobile navigation, but those are separate ownership changes and are not treated as this report's edits.

## Failure map

| Failing control | Affected measured route / viewport | Baseline | Ownership | Exact runtime selector | Source anchor |
|---|---|---:|---|---|---|
| Avatar trigger | All traversed authenticated routes; 390 and 768 | `32x32` | Local `ShellUserMenuInner`, raw button | `header button[aria-haspopup="menu"]` | `auth/avatar-menu/shell-user-menu.tsx:47-54` |
| `Сделка` CTA | `/crm/deals`; 390 and 768 | `81.7x28` | Shared `Button size="sm"`; local `CreateDealDialog`; Radix overwrites slot to `dialog-trigger` | `button[data-slot="dialog-trigger"][data-size="sm"][title="Создать сделку"]` | `crm/deals/deals-surface.tsx:506`, `components/ui/button.tsx:68` |
| `Создать пользователя` CTA | `/admin/users`; 390 and 768 | `171.91x28` | Shared `Button size="sm"`; local `CreateUserDialog` | `button[data-slot="dialog-trigger"][data-size="sm"][title="Создать пользователя"]` | `admin/users/users-surface.tsx:136` |
| User row edit/deactivate actions | `/admin/users`; 390 and 768 | `32x28` each | Shared text `Button size="sm"` used as an icon button; local row actions | `tbody button[data-slot="dialog-trigger"][data-size="sm"][title="Изменить"]`, `tbody button[data-slot="dialog-trigger"][data-size="sm"][title="Деактивировать"]`; inactive rows use `tbody button[data-slot="button"][data-size="sm"][title="Активировать снова"]` | `admin/users/users-surface.tsx:94-106,187` |
| Create-user text/password fields | `/admin/users` dialog; 390 and 768 | lane about `35px`; source/fresh baseline `36px` | Shared `Input` via `inputBase` | `[data-slot="dialog-content"] [data-slot="input"]` | `components/ui/cva-shared.ts:8-9`, `components/ui/input.tsx:6-15` |
| Create-user role/position selects | `/admin/users` dialog; 390 and 768 | lane about `35px`; source/fresh baseline `36px` | Local native `select`, duplicated `selCls` | `[data-slot="dialog-content"] select` | `admin/users/users-surface.tsx:19,153-161` |
| Dialog cancel/create actions | `/admin/users` dialog; 390 and 768 | lane about `35px`; source/fresh baseline `36px` | Shared default `Button` inside shared `FormDialog` | `[data-slot="dialog-footer"] button` | `components/domain/form-dialog.tsx:115-122` |
| Dialog close icon | `/admin/users` dialog; 390 and 768 | lane `31x31`; source/fresh baseline `32x32` | Shared `DialogContent` close primitive | `[data-slot="dialog-content"] > button[data-slot="dialog-close"]` | `components/ui/dialog.tsx:69-79` |
| `Канал` CTA | `/communications/channels`; 390 and 768 | `74.09x28` | Shared `Button size="sm"`; local `CreateChannelDialog` | `button[data-slot="dialog-trigger"][data-size="sm"]` with accessible name `Канал` | `communications/channels/channels-surface.tsx:567` |
| `Отправить` | `/communications/channels`; 390 and 768 | `101.42x28` | Shared `Button size="sm"`; local `ChannelConversation` | `button[data-slot="button"][data-size="sm"]` with accessible name `Отправить` | `communications/channels/channels-surface.tsx:528-530` |
| Workspace navigation links | All `WorkspaceShell` routes at 768; hidden at 390 in the measured baseline | lane `215x34` | Local `WorkspaceNavigation` / formerly inline shell nav | `aside[aria-label="Навигация рабочей области"] nav a` (pre-concurrent DOM: `aside nav a`) | `delivery/ui/workspace-shell.tsx:32-61` |

Shell-local controls affect `/dashboard`, `/my-work`, `/projects`, `/projects/:id` and project tabs, `/crm/**`, `/communications/**`, `/admin/**`, `/profile`, and `/settings`. Route-local selectors above limit the dialog and CTA claims to the routes actually measured.

## Smallest rule

Use the shared `size="sm"` data contract for the four CTA/action failures, dialog ancestry for form controls, and shell selectors only for shell-local controls. Normalize the same targets to the desktop contract first, then add 8px only for coarse touch at the existing 860px shell breakpoint.

```css
button[data-size="sm"],
[data-slot="dialog-content"] [data-slot="input"],
[data-slot="dialog-content"] select,
[data-slot="dialog-footer"] button,
[data-slot="dialog-content"] > button[data-slot="dialog-close"],
header button[aria-haspopup="menu"],
aside[aria-label="Навигация рабочей области"] nav a {
  min-block-size: var(--row-h);
}

button[data-size="sm"],
[data-slot="dialog-content"] > button[data-slot="dialog-close"],
header button[aria-haspopup="menu"] {
  min-inline-size: var(--row-h);
}

@media (max-width: 860px) and (pointer: coarse) {
  button[data-size="sm"],
  [data-slot="dialog-content"] [data-slot="input"],
  [data-slot="dialog-content"] select,
  [data-slot="dialog-footer"] button,
  [data-slot="dialog-content"] > button[data-slot="dialog-close"],
  header button[aria-haspopup="menu"],
  aside[aria-label="Навигация рабочей области"] nav a {
    min-block-size: calc(var(--row-h) + var(--space-2));
  }

  button[data-size="sm"],
  [data-slot="dialog-content"] > button[data-slot="dialog-close"],
  header button[aria-haspopup="menu"] {
    min-inline-size: calc(var(--row-h) + var(--space-2));
  }
}
```

Why this is the minimum safe scope:

- It does not inflate raw `button`, every `Button` variant, dropdown items, or unrelated page inputs.
- It fixes both Radix-wrapped triggers (`data-slot="dialog-trigger"`) and ordinary buttons because `data-size="sm"` survives `asChild` slot replacement.
- Width grows only where a control can otherwise remain icon-sized: small buttons, avatar, and close icon.
- Desktop settles at the design contract's 36px instead of 44px; the 44px rule is active only at the measured touch breakpoint.

## Regression measurements

Fresh DOM-injection measurements of the exact rule above:

| Control | 390x844 coarse: before -> after | 768x1024 coarse: before -> after | 1280x900 mouse: before -> after |
|---|---|---|---|
| Avatar | `32x32 -> 44x44` | `32x32 -> 44x44` | `32x32 -> 36x36` |
| `Сделка` | `81.7x28 -> 81.7x44` | `81.7x28 -> 81.7x44` | `81.7x28 -> 81.7x36` |
| `Создать пользователя` | `171.91x28 -> 171.91x44` | `171.91x28 -> 171.91x44` | `171.91x28 -> 171.91x36` |
| User row actions (8 rendered) | `32x28 -> 44x44` | `32x28 -> 44x44` | `32x28 -> 36x36` |
| Dialog inputs/selects | `340x36 -> 340x44` | `430x36 -> 430x44` | `430x36 -> 430x36` |
| Dialog footer buttons | `340x36 -> 340x44` | `75.19/101.39 x 36 -> x 44` | unchanged at `36px` height |
| Dialog close | `32x32 -> 44x44` | `32x32 -> 44x44` | `32x32 -> 36x36` |
| `Канал` | `74.09x28 -> 74.09x44` | `74.09x28 -> 74.09x44` | `74.09x28 -> 74.09x36` |
| `Отправить` | `101.42x28 -> 101.42x44` | `101.42x28 -> 101.42x44` | `101.42x28 -> 101.42x36` |
| Sidebar links | hidden at 390 | original lane `215x34`; concurrent build already `215x44`; rule retains `215x44` | `215x34 -> 215x36` |

Root overflow after injection remained false on `/crm/deals`, `/admin/users`, its open create-user dialog, and `/communications/channels`: `scrollWidth/clientWidth` was `390/390` and `768/768` respectively.

## Acceptance result

PASS: every measured failure has an exact runtime selector, shared/local owner, affected route and viewport, an existing-token derivation, a bounded breakpoint, and fresh before/after measurements. The implementation lane should replace its current broad `Button`/`lg` inflation with the scoped rule above or demonstrate equivalent selectors and measurements.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/frontend/2026-07-10-responsive/touch-target-scope.md
