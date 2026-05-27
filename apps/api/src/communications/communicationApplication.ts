import type { AccessProfile, PolicyDecision } from "@kiss-pm/access-control";
import {
  parseCollaborationId,
  type CallRoom,
  type CallSession,
  type CollaborationEntityType,
  type TenantUser
} from "@kiss-pm/domain";

import type { CommunicationDataPort } from "../apiDataPorts";
import type { ManagementAuditEventInput } from "../apiTypes";
import {
  resolveEntityAccessContext,
  type EntityAccessContext
} from "../entityAccess";
import type { ApiRouteDeps } from "../routeTypes";

export type ResolvedCallRoom = {
  access: EntityAccessContext<CollaborationEntityType>;
  room: CallRoom;
};

export type CommunicationApplicationError = {
  ok: false;
  status: 400 | 403 | 404 | 501;
  error: string;
};

export function createCommunicationApplication(deps: ApiRouteDeps) {
  async function resolveEntityAccess(actor: TenantUser, entity: {
    entityType: CollaborationEntityType;
    entityId: string;
  }) {
    const profile = await deps.getActorProfile(actor);
    return resolveCommunicationEntityAccess({
      actor,
      dataSource: deps.capabilities.communications,
      entityId: entity.entityId,
      entityType: entity.entityType,
      profile
    });
  }

  return {
    resolveEntityAccess,
    async resolveCallRoomForActor(roomIdRaw: string, actor: TenantUser) {
      return resolveCallRoomForActor(roomIdRaw, actor, deps, resolveEntityAccess);
    },
    async resolveCallRoomAndSession(roomIdRaw: string, sessionIdRaw: string, actor: TenantUser) {
      return resolveCallRoomAndSession(roomIdRaw, sessionIdRaw, actor, deps, resolveEntityAccess);
    },
    async appendDeniedAudit(input: {
      actionType: string;
      actor: TenantUser;
      commandInput: Record<string, unknown>;
      permissionResult: PolicyDecision;
      sourceEntity: { type: string; id: string };
    }) {
      await deps.appendManagementAuditEvent(communicationAudit({
        ...input,
        executionResult: { status: "denied" }
      }));
    },
    audit: communicationAudit,
    tenantUserExists(userId: string, actor: TenantUser) {
      return tenantUserExists(deps.capabilities.communications, actor.tenantId, userId);
    }
  };
}

async function resolveCallRoomForActor(
  roomIdRaw: string,
  actor: TenantUser,
  deps: ApiRouteDeps,
  resolveEntityAccess: (
    actor: TenantUser,
    entity: { entityType: CollaborationEntityType; entityId: string }
  ) => ReturnType<typeof resolveCommunicationEntityAccess>
): Promise<
  | { ok: true; value: ResolvedCallRoom }
  | CommunicationApplicationError
> {
  const roomId = parseCollaborationId(roomIdRaw, "call_room_id_invalid");
  if (!roomId.ok) return { ok: false, status: 400, error: roomId.error };
  const room = await deps.capabilities.communications.findCallRoom?.(actor.tenantId, roomId.value);
  if (!room) return { ok: false, status: 404, error: "call_room_not_found" };
  const access = await resolveEntityAccess(actor, room);
  if (!access.ok) return access;
  return { ok: true, value: { access: access.value, room } };
}

async function resolveCallRoomAndSession(
  roomIdRaw: string,
  sessionIdRaw: string,
  actor: TenantUser,
  deps: ApiRouteDeps,
  resolveEntityAccess: (
    actor: TenantUser,
    entity: { entityType: CollaborationEntityType; entityId: string }
  ) => ReturnType<typeof resolveCommunicationEntityAccess>
): Promise<
  | { ok: true; value: ResolvedCallRoom & { session: CallSession } }
  | CommunicationApplicationError
> {
  const resolved = await resolveCallRoomForActor(roomIdRaw, actor, deps, resolveEntityAccess);
  if (!resolved.ok) return resolved;
  const sessionId = parseCollaborationId(sessionIdRaw, "call_session_id_invalid");
  if (!sessionId.ok) return { ok: false, status: 400, error: sessionId.error };
  const session = await deps.capabilities.communications.findCallSession?.(actor.tenantId, sessionId.value);
  if (!session || session.roomId !== resolved.value.room.id) {
    return { ok: false, status: 404, error: "call_session_not_found" };
  }
  return { ok: true, value: { ...resolved.value, session } };
}

function resolveCommunicationEntityAccess(input: {
  actor: TenantUser;
  dataSource: CommunicationDataPort;
  entityId: string;
  entityType: CollaborationEntityType;
  profile: AccessProfile;
}) {
  return resolveEntityAccessContext({
    ...input,
    notFoundError: "communications_entity_not_found"
  });
}

async function tenantUserExists(
  dataSource: CommunicationDataPort,
  tenantId: string,
  userId: string
): Promise<boolean> {
  const users = await dataSource.listUsersByTenantId(tenantId);
  return users.some((user) => user.id === userId);
}

function communicationAudit(input: {
  actionType: string;
  actor: TenantUser;
  commandInput: Record<string, unknown>;
  permissionResult: Record<string, unknown>;
  sourceEntity: { type: string; id: string };
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  executionResult?: Record<string, unknown>;
}): ManagementAuditEventInput {
  const auditInput: ManagementAuditEventInput = {
    actionType: input.actionType,
    actorUserId: input.actor.id,
    afterState: input.afterState ?? null,
    beforeState: input.beforeState ?? null,
    commandInput: input.commandInput,
    permissionResult: input.permissionResult,
    sourceEntity: input.sourceEntity,
    sourceWorkflow: "communications",
    tenantId: input.actor.tenantId
  };
  if (input.executionResult !== undefined) auditInput.executionResult = input.executionResult;
  return auditInput;
}
