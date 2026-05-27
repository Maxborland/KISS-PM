import type {
  CallEvent,
  CallParticipantState,
  CallRecording,
  CallRoom,
  CallSession
} from "@kiss-pm/domain";

import { summarizeCallRoom } from "./callWorkspace";

export function serializeCallRoom(room: CallRoom) {
  return {
    ...summarizeCallRoom(room),
    createdAt: room.createdAt.toISOString(),
    createdByUserId: room.createdByUserId,
    meetingId: room.meetingId,
    title: room.title,
    updatedAt: room.updatedAt.toISOString()
  };
}

export function serializeCallSession(session: CallSession) {
  return {
    endedAt: session.endedAt?.toISOString() ?? null,
    endedByUserId: session.endedByUserId,
    failureReason: session.failureReason,
    id: session.id,
    providerSessionId: session.providerSessionId,
    roomId: session.roomId,
    startedAt: session.startedAt.toISOString(),
    startedByUserId: session.startedByUserId,
    status: session.status
  };
}

export function serializeCallParticipantState(participantState: CallParticipantState) {
  return {
    joinedAt: participantState.joinedAt?.toISOString() ?? null,
    lastSeenAt: participantState.lastSeenAt.toISOString(),
    leftAt: participantState.leftAt?.toISOString() ?? null,
    roomId: participantState.roomId,
    sessionId: participantState.sessionId,
    state: participantState.state,
    userId: participantState.userId
  };
}

export function serializeCallEvent(event: CallEvent) {
  return {
    actorUserId: event.actorUserId,
    createdAt: event.createdAt.toISOString(),
    eventType: event.eventType,
    id: event.id,
    payload: event.payload,
    roomId: event.roomId,
    sessionId: event.sessionId
  };
}

export function serializeCallRecording(recording: CallRecording) {
  return {
    attachmentId: recording.attachmentId,
    createdAt: recording.createdAt.toISOString(),
    createdByUserId: recording.createdByUserId,
    id: recording.id,
    roomId: recording.roomId,
    sessionId: recording.sessionId,
    title: recording.title
  };
}
