// Control-plane glue for the call client. Uses the existing apiFetch (CSRF header +
// session cookie are injected there); imports NO media SDK.

import { apiFetch } from "@/lib/api";

export type CallProvider = "livekit" | "jitsi" | "manual";

export type CallJoin = {
  provider: CallProvider;
  joinUrl: string;
  token: string | null;
  expiresAt: string | null;
};

export type CallSessionRef = {
  id: string;
  status: string;
};

/** POST /api/workspace/call-rooms/:roomId/sessions/start → opens (or reuses) a session. */
export async function startCallSession(roomId: string): Promise<CallSessionRef> {
  const result = await apiFetch<{ session: CallSessionRef }>(
    `/api/workspace/call-rooms/${encodeURIComponent(roomId)}/sessions/start`,
    { method: "POST" }
  );
  return result.session;
}

/** POST .../sessions/:sessionId/join-token → short-lived LiveKit JWT (response-only). */
export async function fetchJoinToken(roomId: string, sessionId: string): Promise<CallJoin> {
  const result = await apiFetch<{ join: CallJoin }>(
    `/api/workspace/call-rooms/${encodeURIComponent(roomId)}/sessions/${encodeURIComponent(
      sessionId
    )}/join-token`,
    { method: "POST" }
  );
  return result.join;
}
