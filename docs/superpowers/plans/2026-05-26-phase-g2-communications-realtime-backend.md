# Phase G.2 Communications Realtime Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build backend-only call rooms, audio/video provider control-plane, join tokens, participant state, call events and recording metadata for project/task/opportunity communications.

**Architecture:** Domain defines pure call contracts and validation; persistence stores tenant-scoped call records; API owns auth, permission checks, provider orchestration and audit. Media remains provider-backed through LiveKit/Jitsi/manual adapters; KISS PM does not host SFU/media in this slice.

**Tech Stack:** TypeScript, Hono API, Drizzle/PostgreSQL, Vitest, existing Storage/Attachment layer, Node `crypto` for LiveKit-compatible HS256 JWT.

---

### Task 1: Contract And Domain

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/12_ФАЗОВЫЙ_ПЛАН.md`
- Create: `docs/43_PHASE_G_2_COMMUNICATIONS_REALTIME_BACKEND.md`
- Modify: `packages/domain/src/collaboration.ts`
- Modify: `packages/domain/src/collaboration.test.ts`

- [ ] Add Phase G.2 docs and phase-plan links.
- [ ] Add call room/session/participant/event/recording types, status constants and parsers.
- [ ] Add domain tests for valid/invalid providers, media kind, statuses and bounded room titles.

### Task 2: Persistence

**Files:**
- Create: `packages/persistence/migrations/0035_phase_g2_communications_realtime.sql`
- Modify: `packages/persistence/src/schema.ts`
- Modify: `packages/persistence/src/collaborationRepository.ts`
- Modify: `packages/persistence/src/repositories.ts`
- Modify: `packages/persistence/src/migration.test.ts`
- Modify: `packages/persistence/src/schema.test.ts`

- [ ] Add tenant-scoped tables: `call_rooms`, `call_sessions`, `call_participant_states`, `call_events`, `call_recordings`.
- [ ] Add schema exports, table registry entries and column inventory.
- [ ] Add repository methods for room/session/event/participant/recording lifecycle.
- [ ] Add migration/schema tests.

### Task 3: Provider And API

**Files:**
- Create: `apps/api/src/videoProvider.ts`
- Create: `apps/api/src/communicationRealtimeRoutes.ts`
- Modify: `apps/api/src/apiTypes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/serverReadiness.ts`

- [ ] Add provider abstraction: disabled/manual/jitsi/livekit.
- [ ] Generate short-lived LiveKit-compatible JWT without persisting token.
- [ ] Register call-room API routes and stable errors.
- [ ] Add permission and audit checks using parent entity access.
- [ ] Update expected migration tag.

### Task 4: Tests And Verification

**Files:**
- Create: `apps/api/src/videoProvider.test.ts`
- Create: `apps/api/src/communicationRealtimeRoutes.db.test.ts`
- Modify: existing targeted DB test truncate lists if needed.

- [ ] Add provider tests for disabled/misconfigured/Jitsi/LiveKit behavior.
- [ ] Add DB API tests for create/list room, session start/end, join token, participant state, recording validation, denied access and audit safety.
- [ ] Run targeted tests, typecheck, full test set when feasible, `git diff --check`, CodeGraph sync.
