# 0002 — Frontend Server State Uses TanStack Query

Date: 2026-05-16

## Status

Accepted

## Context

KISS PM uses React/Vite for the web app. Early P3/P4/P5 surfaces used local API clients with `useEffect` and component `useState` for server state. That was acceptable while the product foundation was being proven, but the project stack in `AGENTS.md` identifies TanStack Query as the default server-state layer.

In May 2026 TanStack disclosed an npm supply-chain incident affecting Router/Start-related packages. The official postmortem identifies `@tanstack/query*` packages as clean. This project still treats TanStack dependency changes as supply-chain sensitive.

## Decision

Use `@tanstack/react-query` as the standard for new frontend server state.

Allowed package for this decision:

- `@tanstack/react-query`

Not introduced by this decision:

- unscoped `tanstack`
- `@tanstack/react-router`
- `@tanstack/*router*`
- `@tanstack/start`
- `@tanstack/*start*`
- `@tanstack/setup`

New server-backed surfaces should use queries and mutations for API read models and state-changing commands. Component `useState` remains appropriate for local UI state such as selected rows, open panels, form drafts, and last local input values.

## Migration Policy

P3/P4/P5 legacy surfaces should be migrated in small verified batches. P6 work owned by another agent must not be blocked or rewritten as part of this decision unless a separate task claims that scope.

## Safety Gate

Before and after installation, run:

```bash
rg -n "\"tanstack\"|\"@tanstack/" package.json package-lock.json
npm audit --omit=dev
```

Dependency installation must use an exact verified version and normal npm lockfile updates.

## Consequences

- App shell provides `QueryClientProvider`.
- Tests use deterministic query clients with retries disabled.
- Server-state refresh after mutations should use query invalidation/refetch rather than local-only optimistic state.
- Legacy migration remains a tracked hardening task until all older surfaces have moved.
