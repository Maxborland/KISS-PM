# Tablet sidebar black-band root-cause diagnosis

## Verdict

**INCONCLUSIVE for a CSS/layout root cause.**

The reported black bands are not present in either source PNG and were not reproduced by the live browser at a 768x1024 CSS viewport. The only reproduced corruption occurred after valid PNG bytes were submitted together in a multi-image evidence-view response. The same communications image rendered normally when submitted alone.

This does not satisfy the requested PASS gate: there is no falsifiable product CSS change that currently fails before and passes after. A product change would be speculative.

## Scope and entry path

CodeGraph was synced before inspection and used to resolve the structural path:

`CommunicationsChannelsPage` -> `ChannelsSurface` -> `CommsFrame` -> `WorkspaceShell`.

Only the implicated shell, communications and style files were inspected after that:

- `apps/web/src/delivery/ui/workspace-shell.tsx`
- `apps/web/src/communications/ui/comms-frame.tsx`
- `apps/web/src/communications/channels/channels-surface.tsx`
- `apps/web/src/app/communications/channels/page.tsx`
- `apps/web/src/styles/tokens.css`
- `apps/web/src/styles/kiss-v4.css`
- `apps/web/src/styles/widgets/comms.css`
- `apps/web/src/app/globals.css`

The legacy `AppShell` and `AppSidebar` path is not used by `/communications/channels`; CodeGraph showed that `CommsFrame` uses `WorkspaceShell` directly.

## Source findings

### Sidebar selector and tokens

The actual sidebar is the `aside` in `workspace-shell.tsx:49`:

```tsx
<aside className="hidden w-[232px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] md:flex">
```

At 768px, Tailwind's `md:flex` keeps the compact sidebar visible. Its paint is explicitly token-backed by `bg-[var(--panel)]`. The active light tokens resolve from `kiss-v4.css:11-13`:

```css
--canvas: #f7f8fa;
--panel: #ffffff;
```

The only dark-theme override is `[data-theme="dark"]` in `globals.css:28-31`. The live page had `html.light`, no `data-theme="dark"`, and `--panel: #fff`.

### Communications layout cannot repaint the sidebar

`CommsFrame` is rendered as a child of the main flex column, while the shell `aside` is its sibling. Relevant classes are:

- `workspace-shell.tsx:48`: root `flex min-h-screen w-full bg-[var(--canvas)]`
- `workspace-shell.tsx:49`: sidebar `bg-[var(--panel)] md:flex`
- `comms-frame.tsx:49`: header `bg-[var(--panel)]`
- `comms-frame.tsx:59`: tabs `bg-[var(--panel)]`
- `comms-frame.tsx:88`: content `overflow-auto bg-[var(--canvas)]`

CSS custom properties inherit into descendants, not sideways into siblings. No communications element sets `--panel`, `--canvas`, opacity, transform, filter, blend mode, isolation, position or z-index. `widgets/comms.css` contains only scoped `.comms-*` selectors and token-backed panel backgrounds. Therefore the communications subtree has no selector capable of painting black bands over the shell sidebar.

The nested channel-list `aside` at `channels-surface.tsx:142` is inside `<main>` and also uses `bg-[var(--panel)]`; it is not the 232px shell sidebar.

## Screenshot forensics

Fresh files inspected:

- `.superloopy/evidence/responsive/13-768x1024-admin-communications-channels.png`
- `.superloopy/evidence/responsive/13b-768x1024-admin-communications-channels-viewport.png`

Both files are exactly the same byte sequence:

```text
SHA-256 86B9C208E1410A0BB53EEBDF7D4665765C46A1D2F4303C91CEB6C9D76CD1FD1F
size    78,310 bytes
image   768x1024, sRGB, 3 channels, no alpha
```

Decoded pixel scan for each file:

```text
alpha=0 pixels       0
partial-alpha pixels 0
RGB(0,0,0) pixels    0
```

A black-band version therefore cannot be encoded in either artifact. When multiple screenshots were emitted in one evidence-view response, a later image displayed black regions. Emitting `13b` alone displayed the intact white sidebar and intact channel cards. This localizes the observed corruption downstream of PNG generation, in the multi-image display/compositing path, but does not identify that viewer's internal implementation.

## Live browser verification

Runtime: `http://127.0.0.1:3180/communications/channels`.

Chrome was set to an exact 768x1024 CSS viewport. Two independent reload/capture runs returned the same values:

```text
viewport              768x1024
sidebar display       flex
sidebar rect          x=0, y=0, width=231.9965, height=1024.4445
sidebar background    rgb(255, 255, 255)
sidebar color         rgb(28, 32, 36)
sidebar transform     none
sidebar opacity       1
sidebar links visible true
black CSS backgrounds 0 elements
black capture pixels  0
```

The browser capture was opaque and did not reproduce the black bands.

## Hypotheses tested

1. **Route-scoped token override. Rejected.** Prediction: `--panel` or computed sidebar background becomes dark on communications. Actual: `--panel=#fff`, sidebar background `rgb(255,255,255)`.
2. **Overflow or stacking context covers the sidebar. Rejected.** Prediction: an overlapping positioned/transformed communications element intersects `x=0..232`. Actual: sidebar is a normal-flow sibling; communications containers are static, untransformed and inside the main column starting at `x=232`.
3. **Corrupt or transparent screenshot bytes. Rejected.** Prediction: source PNGs differ, contain alpha, or contain black pixels. Actual: identical hashes, no alpha and zero black pixels.
4. **Downstream multi-image evidence rendering. Supported but outside product CSS.** Prediction: the same bytes display normally alone and can display corruptly in a batched response. This was reproduced exactly.

## Minimal correction

No product CSS correction is justified. Adding `position`, `z-index`, `isolation`, `transform`, a duplicate background, or a hard-coded color would not address the reproduced failure and would violate the minimal token-compliant requirement.

The smallest correction belongs in the evidence display/capture workflow: validate and render each decoded image independently, and retain the artifact SHA-256 beside the visual observation. That is outside the requested product/test/matrix scope and was not edited.

`w-[232px]` could separately be normalized to `w-[var(--sidebar-width)]`, since `--sidebar-width: 232px` already exists, but it has no causal connection to black paint and must not be presented as this fix.

## Browser assertion

A valid regression assertion for a real product defect would be:

```ts
expect(await page.evaluate(() => ({
  viewport: [innerWidth, innerHeight],
  sidebar: (() => {
    const el = document.querySelector("body aside");
    if (!el) return null;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      display: style.display,
      background: style.backgroundColor,
      width: rect.width,
      linksVisible: [...el.querySelectorAll("a")].every(
        (link) => Boolean(link.getClientRects().length)
      )
    };
  })()
}))).toEqual({
  viewport: [768, 1024],
  sidebar: {
    display: "flex",
    background: "rgb(255, 255, 255)",
    width: expect.closeTo(232, 1),
    linksVisible: true
  }
});
```

The capture side should additionally assert zero black pixels in the sidebar crop, excluding the small brand-mark rectangle. This assertion already passes before any product fix, so it cannot provide the required fail-before/pass-after evidence. That is the reason for the INCONCLUSIVE verdict.

## Change index

- Added report: `.superloopy/evidence/frontend/2026-07-10-responsive/tablet-sidebar-root-cause.md`
- Product files changed: none
- Tests/matrix files changed: none
- CodeGraph symbols added/changed/removed: `0/0/0`
- CodeGraph nodes before -> after: `23,986 -> 23,986`
- CodeGraph edges before -> after: `51,792 -> 51,792`; the Markdown report is outside the indexed symbol graph

SUPERLOOPY_EVIDENCE: .superloopy/evidence/frontend/2026-07-10-responsive/tablet-sidebar-root-cause.md
