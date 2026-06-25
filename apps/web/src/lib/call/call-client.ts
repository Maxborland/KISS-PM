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

export type TurnCredentials = {
  urls: string[];
  username: string;
  credential: string;
  ttlSeconds: number;
  expiresAt: string;
};

/** POST .../sessions/:sessionId/turn-credentials → short-lived TURN creds (response-only). */
export async function fetchTurnCredentials(
  roomId: string,
  sessionId: string
): Promise<TurnCredentials | null> {
  try {
    const result = await apiFetch<{ turn: TurnCredentials | null }>(
      `/api/workspace/call-rooms/${encodeURIComponent(roomId)}/sessions/${encodeURIComponent(
        sessionId
      )}/turn-credentials`,
      { method: "POST" }
    );
    return result.turn;
  } catch {
    return null;
  }
}

export type CallRoomEntity = { entityType: string; entityId: string };

/** GET /call-rooms/:roomId → the room's parent entity (for the durable chat). */
export async function fetchCallRoomEntity(roomId: string): Promise<CallRoomEntity | null> {
  try {
    const result = await apiFetch<{ callRoom: { entityType: string; entityId: string } }>(
      `/api/workspace/call-rooms/${encodeURIComponent(roomId)}`
    );
    return { entityType: result.callRoom.entityType, entityId: result.callRoom.entityId };
  } catch {
    return null;
  }
}

/** GET /conversations?entityType&entityId → the default conversation id (find-or-create on the server). */
export async function resolveEntityConversationId(
  entityType: string,
  entityId: string
): Promise<string | null> {
  try {
    const result = await apiFetch<{ conversations: { id: string }[] }>(
      `/api/workspace/conversations?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(
        entityId
      )}`
    );
    return result.conversations[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** POST /conversations/:id/messages → durable persistence of an in-call message. */
export async function persistCallMessage(conversationId: string, body: string): Promise<void> {
  await apiFetch(`/api/workspace/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    json: { body }
  });
}

/** GET /call-rooms/:roomId → the room's active session, when one exists. */
export async function fetchActiveSession(roomId: string): Promise<CallSessionRef | null> {
  try {
    const result = await apiFetch<{ activeSession: CallSessionRef | null }>(
      `/api/workspace/call-rooms/${encodeURIComponent(roomId)}`
    );
    return result.activeSession ?? null;
  } catch {
    return null;
  }
}

/**
 * Start a session, or join the existing active one. A second participant (or a refresh)
 * cannot start — the room already has an active session (manager) or the actor only has read
 * access — so on any start failure we join the room's active session instead of failing.
 */
export async function joinOrStartCallSession(roomId: string): Promise<CallSessionRef> {
  try {
    return await startCallSession(roomId);
  } catch (cause) {
    const active = await fetchActiveSession(roomId);
    if (active) return active;
    throw cause;
  }
}

/** POST .../sessions/:sessionId/participant-state → record this participant's own state. */
export async function postParticipantState(
  roomId: string,
  sessionId: string,
  state: "joined" | "left"
): Promise<void> {
  try {
    await apiFetch(
      `/api/workspace/call-rooms/${encodeURIComponent(roomId)}/sessions/${encodeURIComponent(
        sessionId
      )}/participant-state`,
      { method: "POST", json: { state } }
    );
  } catch {
    // best-effort: presence is advisory for occupancy, not for media delivery
  }
}
