# Responsive shell visual QA

- Date: 2026-07-10
- Status: PASS after independent-audit correction
- Runtime: web 127.0.0.1:3180, API 127.0.0.1:4180
- Roles: seeded admin and plan-reader-no-resources
- Touch viewports: 390x844 and 768x1024 with a coarse pointer
- Fine-pointer viewports: 900x800 and 1280x800
- Design posture: operational SaaS, low visual variance, motion intensity 1, high information density

## Closed findings

### CURRENT-RESP-01 mobile navigation

WorkspaceShell now exposes a 44px menu trigger below md and a permission-aware
off-canvas drawer. The drawer:

- reuses the same route model as desktop;
- focuses its close control when opened;
- traps Tab within the drawer;
- closes on Escape, scrim click, close button, and route navigation;
- restores focus after Escape or explicit close;
- locks body scrolling while open.

Admin sees all permitted routes. Plan-reader sees My work, Projects, and Dashboard,
does not see CRM, communications, or administration, and successfully navigates to
/projects from the drawer.

### CURRENT-RESP-02 tablet black bands

Reclassified as not a product bug. Fresh 768x1024 browser runs show a white,
hit-testable sidebar. Source PNG decoding reports zero black pixels for every
committed screenshot. The apparent bands reproduce in the downstream evidence
image renderer, not in Chromium or the PNG bytes.

Root-cause report: tablet-sidebar-root-cause.md

Machine-readable hashes and pixel checks: screenshot-integrity.json

### CURRENT-RESP-03 touch targets

The --touch-target token is 44px. Shared buttons, inputs, menu items, dialog close,
avatar menu, search controls, sidebar links, and audited native admin selects use it
when the primary pointer is coarse.

Independent review caught an unsafe first implementation that keyed sizing only to
viewport width. A new 900x800 fine-pointer regression failed red with a 44x44 avatar
instead of 32x32. After scoping the rule to pointer: coarse, the same test passed.
Fine-pointer layouts preserve compact controls at both 900px and 1280px.

### CURRENT-RESP-04 header badge overlap

Visual QA discovered that the fixed 32px text badges "Comm." and "Admin" overflowed
their boxes and overlapped H1 at tablet width. They now use bounded lucide icons.
Playwright asserts that badge and heading bounding boxes do not overlap.

## Screenshots

| Evidence | What it proves |
|---|---|
| screenshots/390x844-mobile-navigation-open.png | Admin drawer, permitted routes, scrim, bounded controls |
| screenshots/390x844-mobile-navigation-closed.png | Mobile shell trigger and non-overlapping header |
| screenshots/390x844-plan-reader-navigation.png | Limited-role permission filtering |
| screenshots/768x1024-communications-sidebar.png | Painted sidebar, non-overlapping communications header |
| screenshots/768x1024-admin-touch-targets.png | Coarse-pointer controls and bounded admin header |
| screenshots/900x800-fine-pointer-compact.png | Narrow desktop keeps compact mouse controls |
| screenshots/1280x800-desktop-compact-shell.png | Wide desktop navigation and compact density preserved |

## Verification

Final browser run:

    E2E_WEB_PORT=3180 E2E_API_PORT=4180 playwright test e2e/a11y/responsive-shell.spec.ts

Result: 6 passed. Coverage includes drawer state/focus, role permissions and route
navigation, tablet paint/hit testing, 44x44 coarse-pointer measurements, header
geometry, and fine-pointer compact sizing at narrow and wide desktop widths.

TypeScript:

    tsc -p apps/web/tsconfig.json --noEmit --pretty false

Result: pass.

## Anti-slop preflight

- No new raw color values or gradients.
- No decorative cards, nested cards, or oversized headings.
- No new rounded text badges; overflowing text badges were removed.
- Existing KISS PM tokens, radii, typography, and lucide icon language are retained.
- Touch sizing is token-backed and pointer-aware; fine-pointer density is regression-tested.
- No marketing copy or instructional UI was introduced.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/frontend/2026-07-10-responsive/VISUAL_QA.md
