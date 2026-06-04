# Contributing to KISS PM

Thanks for your interest in KISS PM.

KISS PM is an early-stage Apache-2.0 project exploring Project Management as Code: reviewable project diffs, human approval, permission checks, branchable hypotheses, and commit-like audit history.

## Before you contribute

Please read:

- [README.md](README.md) for product direction, setup, and verification.
- [SECURITY.md](SECURITY.md) before reporting vulnerabilities.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.

## What fits the project

Good contributions preserve the core direction:

- project changes are proposed as diffs before they are applied;
- significant mutations require explicit confirmation;
- permission checks and auditability are first-class;
- UI controls are real, disabled with a clear reason, or not shown;
- implementation slices are small enough to review and test.

## Pull request expectations

1. Keep the change focused. Avoid combining unrelated features, refactors, and documentation changes.
2. Explain the user-facing behavior and the affected surfaces.
3. Add or update targeted tests when behavior changes.
4. Run the smallest relevant verification commands before opening a PR.
5. Do not include secrets, private customer data, proprietary documents, private screenshots, or internal planning artifacts.

Useful checks:

```bash
pnpm typecheck
pnpm test
pnpm security:check
```

For browser/runtime changes, include the relevant Playwright command and screenshot/trace evidence when possible.

## Issues

Open an issue when you have:

- a reproducible bug;
- a focused feature proposal;
- a security concern that is not sensitive enough to require private disclosure;
- a documentation improvement.

For security-sensitive reports, do not open a public issue. Follow [SECURITY.md](SECURITY.md).
