# Independent responsive final audit

- Date: 2026-07-10
- Scope: current responsive diff, `e2e/a11y/responsive-shell.spec.ts`, responsive evidence directory, and the three `CURRENT-RESP` matrix records.
- Overall verdict: **FAIL**
- Product/test/matrix changes made by this audit: none.

## Verdict

`CURRENT-RESP-01` (mobile navigation) and `CURRENT-RESP-04` (header badge overlap) have sufficient fresh evidence for closure. PNG viewport/integrity claims also pass independent verification.

`CURRENT-RESP-03` must not be closed as currently worded. The implementation applies 44px minimum sizing to shared controls at every viewport below Tailwind `lg` (1024px), regardless of pointer type. This includes narrow desktop/fine-pointer use, while the matrix and `VISUAL_QA.md` claim desktop density is preserved. The desktop regression test proves only the avatar is 32x32 at 1280px; it does not cover shared Button/Input/menu/dialog controls or a fine-pointer viewport below 1024px.

## Findings

### HIGH - CURRENT-RESP-03 closure overstates desktop-density safety

Evidence:

- `apps/web/src/components/ui/button.tsx:10` adds `min-h/min-w: 44px` to every shared Button below `lg`.
- `apps/web/src/components/ui/cva-shared.ts:10,24`, `dialog.tsx:73`, `global-search.tsx:107,143`, `shell-user-menu.tsx:54,70,79,89`, `users-surface.tsx:19`, and `workspace-shell.tsx:51` use the same width-only `< lg` policy.
- `.superloopy/evidence/frontend/2026-07-10-responsive/touch-target-scope.md` explicitly identifies this concurrent patch as broader than the minimum safe scope and recommends coarse-pointer scoping.
- `responsive-shell.spec.ts:245` checks only the avatar at 1280x800. It does not verify desktop dimensions for shared Button, Input, menu item, dialog close/footer controls, search, or native selects.
- The matrix note says the token is applied "without increasing desktop density"; `VISUAL_QA.md` says desktop density is regression-tested. Those claims are not established by the test and are false for fine-pointer windows below 1024px by direct CSS inspection.

Impact: dense operational screens can receive 44px controls on narrow desktop windows, increasing row/form/menu density globally. This is a shared-primitive regression surface, not a route-local exception.

Required before PASS: either scope 44px behavior to coarse-pointer/touch conditions (or another documented product breakpoint) and rerun representative 390/768/desktop measurements, or change the product contract and matrix wording and add explicit fine-pointer `<1024px` regression coverage for all affected shared primitive categories.

## Passed checks

- Fresh focused Playwright run against existing web/API services on `3180/4180`: **5 passed (6.7s)**.
- Fresh TypeScript check: **pass**.
- Mobile admin drawer: trigger state, permitted links, Escape close, focus inside drawer, and focus restoration passed.
- Plan-reader drawer: expected permitted links are present, CRM/communications/admin links are absent, `/projects` navigation succeeds, and the drawer closes.
- Header badges: bounded Lucide icons replace overflowing text badges; fresh 768px geometry assertions passed for communications and administration.
- Screenshots independently decoded as exactly `390x844`, `768x1024`, and `1280x800` according to filenames.
- All six screenshot byte lengths and SHA-256 hashes match `screenshot-integrity.json`.
- Independent BGRA decode found **0 opaque RGB(0,0,0) pixels** in every source PNG. Apparent black regions in the downstream image renderer are not encoded in the source files.
- Current matrix JSON parses and contains exactly three `CURRENT-RESP` finding records: 01, 03, and 04. Record 02 is separately waived, not an active finding record.

## Commands

```text
git status --short
git diff --stat -- <responsive scope>
git diff -- <responsive source/design scope>
node -e <parse and print CURRENT-RESP records>
PowerShell PresentationCore PngBitmapDecoder + Get-FileHash over screenshots/*.png
Invoke-WebRequest http://127.0.0.1:3180/ and http://127.0.0.1:4180/health
node_modules/.bin/playwright.cmd test e2e/a11y/responsive-shell.spec.ts --project=chromium --list
node_modules/.bin/playwright.cmd test e2e/a11y/responsive-shell.spec.ts --project=chromium --reporter=line --output=C:\tmp\responsive-final-audit-playwright-final
node_modules/.bin/tsc.cmd -p apps/web/tsconfig.json --noEmit --pretty false --tsBuildInfoFile C:\tmp\responsive-final-audit-web.tsbuildinfo
```

`pnpm exec playwright ... --list` was also attempted and failed before test discovery with `ERR_PNPM_IGNORED_BUILDS`; the already-installed local Playwright binary was then used successfully. No dependency approval or repository repair was performed.

## Residual risks

- The suite claims a focus trap, but asserts only that focus is somewhere inside the drawer after opening; it does not exercise forward/backward Tab wrapping or assert that the close button receives initial focus. The implementation contains this logic, but the behavior is not directly regression-tested.
- Route navigation is tested for closing the drawer, not for post-navigation focus placement. The current implementation intentionally does not restore focus on link navigation.
- Badge non-overlap is asserted at 768px only. The icon-based implementation is structurally bounded, but 390px route-header geometry is not measured by this suite.
- The anti-slop checklist in `VISUAL_QA.md` is a scoped summary, not a complete line-by-line run of every generic frontend rule; no blocker/high responsive issue was found from that omission.
- CodeGraph `sync` was not run because the user allowed exactly one write. The pre-audit index was healthy at 2,170 files, 23,995 nodes, and 51,808 edges.

## Change index

- Added: `.superloopy/evidence/frontend/2026-07-10-responsive/responsive-final-audit.md`
- Product files changed: 0
- Test files changed: 0
- Matrix records changed: 0
- Existing evidence changed: 0
- Symbols added/changed/removed: `0/0/0` (Markdown-only report)
- CodeGraph nodes/edges before -> after: not synced by explicit write restriction; expected symbol delta `0/0` because the only addition is Markdown.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/frontend/2026-07-10-responsive/responsive-final-audit.md
