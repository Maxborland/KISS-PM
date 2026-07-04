import { randomUUID } from "node:crypto";

import {
  canManageCommunications,
  canReadCommunications,
  canReadProjects,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  parseCollaborationId,
  parseCommunicationChannelDescription,
  parseCommunicationChannelRole,
  parseCommunicationChannelType,
  parseConversationTitle,
  parseMessageReactionEmoji,
  parseStickerDimension,
  parseStickerFileSize,
  parseStickerMimeType,
  parseStickerPackSource,
  parseStickerTags,
  type CommunicationChannel,
  type StickerAsset,
  type StickerPack,
  type TenantUser
} from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "./apiTypes";
import {
  parseContentLength,
  parseMultipartContentType,
  readBoundedMultipartRequest,
  toArrayBuffer
} from "./attachmentUploadRequest";
import { buildStorageKey, sanitizeFileName, sha256Hex } from "./attachmentValidation";
import {
  resolveCommunicationChannelAccess,
  type CommunicationChannelAccess
} from "./communicationChannelAccess";
import { readLimitedJsonBody } from "./jsonBody";
import type { ApiRouteDeps } from "./routeTypes";

const maxStickerUploadBytes = 2 * 1024 * 1024;
const maxStickerMultipartEnvelopeBytes = maxStickerUploadBytes + 256 * 1024;

export function registerCommunicationUpgradeRoutes(app: Hono, deps: ApiRouteDeps) {
  app.get("/api/workspace/communication-channels", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.ensureWorkspaceGeneralChannel || !deps.dataSource.listCommunicationChannels) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    await deps.dataSource.ensureWorkspaceGeneralChannel({
      tenantId: actor.tenantId,
      createdByUserId: actor.id
    });
    const channelType = parseOptionalChannelType(context.req.query("type"));
    if (!channelType.ok) return context.json({ error: channelType.error }, 400);
    const profile = await deps.getActorProfile(actor);
    const channels = await deps.dataSource.listCommunicationChannels({
      tenantId: actor.tenantId,
      ...(channelType.value ? { channelType: channelType.value } : {})
    });
    const readable = [];
    for (const channel of channels) {
      const access = await resolveCommunicationChannelAccess({
        actor,
        channel,
        dataSource: deps.dataSource,
        profile
      });
      if (access.readDecision.allowed) {
        readable.push(serializeChannel(channel, access));
      }
    }
    return context.json({ channels: readable });
  });

  app.post("/api/workspace/communication-channels", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const manageDecision = canManageCommunications({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!manageDecision.allowed) {
      await appendDeniedAudit(deps, actor, {
        action: "channel.create",
        permissionResult: manageDecision
      });
      return context.json({ error: manageDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseChannelCreateBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (parsed.value.channelType === "project_general") {
      const project = (await deps.dataSource.listProjects?.(actor.tenantId))?.find(
        (candidate) => candidate.id === parsed.value.scopeEntityId
      );
      if (!project) return context.json({ error: "communication_channel_scope_not_found" }, 404);
    }
    if (!deps.dataSource.createCommunicationChannel || !deps.dataSource.upsertCommunicationChannelMember) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const channel = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const created = await transactionDataSource.createCommunicationChannel!({
        id: `channel-${randomUUID()}`,
        tenantId: actor.tenantId,
        channelType: parsed.value.channelType,
        title: parsed.value.title,
        description: parsed.value.description,
        scopeEntityType: parsed.value.scopeEntityType,
        scopeEntityId: parsed.value.scopeEntityId,
        createdByUserId: actor.id
      });
      await transactionDataSource.upsertCommunicationChannelMember!({
        tenantId: actor.tenantId,
        channelId: created.id,
        userId: actor.id,
        role: "owner",
        createdByUserId: actor.id
      });
      await deps.appendManagementAuditEvent(
        communicationAudit({
          actionType: "communications.channel_created",
          actor,
          commandInput: {
            channelType: created.channelType,
            scopeEntityType: created.scopeEntityType,
            scopeEntityId: created.scopeEntityId
          },
          permissionResult: manageDecision,
          sourceEntity: { type: "CommunicationChannel", id: created.id },
          afterState: { channelId: created.id, title: created.title }
        }),
        transactionDataSource
      );
      return created;
    });
    return context.json({ channel: serializeChannel(channel, { readDecision: manageDecision, manageDecision }) }, 201);
  });

  app.get("/api/workspace/communication-channels/:channelId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveChannelForActor(context.req.param("channelId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    const members = await deps.dataSource.listCommunicationChannelMembers?.({
      tenantId: actor.tenantId,
      channelId: resolved.value.channel.id
    }) ?? [];
    return context.json({
      channel: serializeChannel(resolved.value.channel, resolved.value.access),
      members: members.map(serializeMember)
    });
  });

  app.patch("/api/workspace/communication-channels/:channelId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveChannelForActor(context.req.param("channelId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, actor, {
        action: "channel.update",
        permissionResult: resolved.value.access.manageDecision
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseChannelPatchBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (!deps.dataSource.updateCommunicationChannel) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const updated = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const channel = await transactionDataSource.updateCommunicationChannel!({
        tenantId: actor.tenantId,
        channelId: resolved.value.channel.id,
        ...parsed.value
      });
      if (!channel) return null;
      await deps.appendManagementAuditEvent(
        communicationAudit({
          actionType: "communications.channel_updated",
          actor,
          commandInput: { channelId: channel.id, ...parsed.value },
          permissionResult: resolved.value.access.manageDecision,
          sourceEntity: { type: "CommunicationChannel", id: channel.id },
          beforeState: serializeChannel(resolved.value.channel, resolved.value.access),
          afterState: serializeChannel(channel, resolved.value.access)
        }),
        transactionDataSource
      );
      return channel;
    });
    if (!updated) return context.json({ error: "communication_channel_not_found" }, 404);
    return context.json({ channel: serializeChannel(updated, resolved.value.access) });
  });

  app.get("/api/workspace/communication-channels/:channelId/conversation", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveChannelForActor(context.req.param("channelId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.readDecision.allowed) {
      return context.json({ error: resolved.value.access.readDecision.reason }, 403);
    }
    if (!deps.dataSource.ensureConversation || !deps.dataSource.getConversationReadState) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const conversation = await deps.dataSource.ensureConversation({
      id: `conversation-${randomUUID()}`,
      tenantId: actor.tenantId,
      entityType: "communication_channel",
      entityId: resolved.value.channel.id,
      conversationType: "default",
      title: resolved.value.channel.title,
      createdByUserId: actor.id
    });
    const readState = await deps.dataSource.getConversationReadState({
      tenantId: actor.tenantId,
      conversationId: conversation.id,
      userId: actor.id
    });
    return context.json({
      channel: serializeChannel(resolved.value.channel, resolved.value.access),
      conversation: {
        ...conversation,
        createdAt: conversation.createdAt.toISOString(),
        archivedAt: conversation.archivedAt?.toISOString() ?? null,
        readState
      }
    });
  });

  app.post("/api/workspace/communication-channels/:channelId/members", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveChannelForActor(context.req.param("channelId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, actor, {
        action: "channel.member.add",
        channelId: resolved.value.channel.id,
        permissionResult: resolved.value.access.manageDecision
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseMemberBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const targetUser = (await deps.dataSource.listUsersByTenantId(actor.tenantId))
      .find((user) => user.id === parsed.value.userId);
    if (!targetUser) return context.json({ error: "tenant_user_not_found" }, 404);
    if (!(await canTargetUserJoinChannel(targetUser, resolved.value.channel, deps))) {
      await appendDeniedAudit(deps, actor, {
        action: "channel.member.add_target",
        channelId: resolved.value.channel.id,
        permissionResult: {
          allowed: false,
          reason: "permission_missing"
        }
      });
      return context.json({ error: "permission_missing" }, 403);
    }
    if (!deps.dataSource.upsertCommunicationChannelMember) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const member = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const upserted = await transactionDataSource.upsertCommunicationChannelMember!({
        tenantId: actor.tenantId,
        channelId: resolved.value.channel.id,
        userId: parsed.value.userId,
        role: parsed.value.role,
        createdByUserId: actor.id
      });
      await deps.appendManagementAuditEvent(
        communicationAudit({
          actionType: "communications.channel_member_added",
          actor,
          commandInput: { channelId: resolved.value.channel.id, userId: upserted.userId, role: upserted.role },
          permissionResult: resolved.value.access.manageDecision,
          sourceEntity: { type: "CommunicationChannel", id: resolved.value.channel.id },
          afterState: { userId: upserted.userId, role: upserted.role }
        }),
        transactionDataSource
      );
      return upserted;
    });
    return context.json({ member: serializeMember(member) }, 201);
  });

  app.delete("/api/workspace/communication-channels/:channelId/members/:userId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resolved = await resolveChannelForActor(context.req.param("channelId"), actor, deps);
    if (!resolved.ok) return context.json({ error: resolved.error }, resolved.status);
    if (!resolved.value.access.manageDecision.allowed) {
      await appendDeniedAudit(deps, actor, {
        action: "channel.member.remove",
        channelId: resolved.value.channel.id,
        permissionResult: resolved.value.access.manageDecision
      });
      return context.json({ error: resolved.value.access.manageDecision.reason }, 403);
    }
    const userId = parseCollaborationId(context.req.param("userId"), "tenant_user_id_invalid");
    if (!userId.ok) return context.json({ error: userId.error }, 400);
    if (!deps.dataSource.archiveCommunicationChannelMember) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const member = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const archived = await transactionDataSource.archiveCommunicationChannelMember!({
        tenantId: actor.tenantId,
        channelId: resolved.value.channel.id,
        userId: userId.value
      });
      if (!archived) return null;
      await deps.appendManagementAuditEvent(
        communicationAudit({
          actionType: "communications.channel_member_removed",
          actor,
          commandInput: { channelId: resolved.value.channel.id, userId: archived.userId },
          permissionResult: resolved.value.access.manageDecision,
          sourceEntity: { type: "CommunicationChannel", id: resolved.value.channel.id },
          afterState: { archivedAt: archived.archivedAt?.toISOString() ?? null }
        }),
        transactionDataSource
      );
      return archived;
    });
    if (!member) return context.json({ error: "channel_member_not_found" }, 404);
    return context.json({ member: serializeMember(member) });
  });

  app.get("/api/workspace/sticker-packs", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const decision = canReadCommunications({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    const packs = await deps.dataSource.listStickerPacks?.(actor.tenantId);
    if (!packs) return context.json({ error: "communications_not_configured" }, 501);
    const assets: StickerAsset[] = [];
    for (const pack of packs) {
      assets.push(...((await deps.dataSource.listStickerAssets?.({
        tenantId: actor.tenantId,
        packId: pack.id
      })) ?? []));
    }
    return context.json({
      stickerPacks: packs.map((pack) => ({
        ...serializeStickerPack(pack),
        stickers: assets.filter((asset) => asset.packId === pack.id).map(serializeStickerAsset)
      }))
    });
  });

  app.get("/api/workspace/sticker-packs/:packId/stickers", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const decision = canReadCommunications({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    const packId = parseCollaborationId(context.req.param("packId"), "sticker_pack_id_invalid");
    if (!packId.ok) return context.json({ error: packId.error }, 400);
    const packs = await deps.dataSource.listStickerPacks?.(actor.tenantId);
    const pack = packs?.find((candidate) => candidate.id === packId.value);
    if (!pack) return context.json({ error: "sticker_pack_not_found" }, 404);
    const stickers = await deps.dataSource.listStickerAssets?.({
      tenantId: actor.tenantId,
      packId: pack.id
    });
    if (!stickers) return context.json({ error: "communications_not_configured" }, 501);
    return context.json({ stickerPack: serializeStickerPack(pack), stickers: stickers.map(serializeStickerAsset) });
  });

  app.post("/api/workspace/sticker-packs", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const decision = canManageCommunications({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAudit(deps, actor, { action: "sticker-pack.create", permissionResult: decision });
      return context.json({ error: decision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseStickerPackBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (!deps.dataSource.createStickerPack) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const pack = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const created = await transactionDataSource.createStickerPack!({
        id: `sticker-pack-${randomUUID()}`,
        tenantId: actor.tenantId,
        title: parsed.value.title,
        description: parsed.value.description,
        source: parsed.value.source,
        status: "ready",
        createdByUserId: actor.id
      });
      await deps.appendManagementAuditEvent(
        communicationAudit({
          actionType: "communications.sticker_pack_created",
          actor,
          commandInput: { source: created.source, title: created.title },
          permissionResult: decision,
          sourceEntity: { type: "StickerPack", id: created.id },
          afterState: { packId: created.id }
        }),
        transactionDataSource
      );
      return created;
    });
    return context.json({ stickerPack: serializeStickerPack(pack) }, 201);
  });

  app.post("/api/workspace/sticker-packs/:packId/import", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const decision = canManageCommunications({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAudit(deps, actor, { action: "sticker.import", permissionResult: decision });
      return context.json({ error: decision.reason }, 403);
    }
    const packId = parseCollaborationId(context.req.param("packId"), "sticker_pack_id_invalid");
    if (!packId.ok) return context.json({ error: packId.error }, 400);
    const packs = await deps.dataSource.listStickerPacks?.(actor.tenantId);
    const pack = packs?.find((candidate) => candidate.id === packId.value);
    if (!pack) return context.json({ error: "sticker_pack_not_found" }, 404);
    const contentLength = parseContentLength(context.req.header("content-length"));
    if (!contentLength.ok) return context.json({ error: contentLength.error }, 400);
    if (contentLength.value !== null && contentLength.value > maxStickerMultipartEnvelopeBytes) {
      return context.json({ error: "sticker_file_too_large" }, 413);
    }
    const contentType = parseMultipartContentType(context.req.header("content-type"));
    if (!contentType.ok) return context.json({ error: contentType.error }, 415);
    const bounded = await readBoundedMultipartRequest(context.req.raw, maxStickerMultipartEnvelopeBytes);
    if (!bounded.ok) return context.json({ error: bounded.error }, bounded.status);
    const parsed = await parseStickerImportForm(bounded.request);
    if (!parsed.ok) return context.json({ error: parsed.error }, parsed.status);
    const result = await importStickerFile({
      actor,
      decision,
      deps,
      pack,
      sticker: parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ sticker: serializeStickerAsset(result.sticker) }, 201);
  });

  app.delete("/api/workspace/sticker-packs/:packId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const decision = canManageCommunications({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAudit(deps, actor, { action: "sticker-pack.archive", permissionResult: decision });
      return context.json({ error: decision.reason }, 403);
    }
    const packId = parseCollaborationId(context.req.param("packId"), "sticker_pack_id_invalid");
    if (!packId.ok) return context.json({ error: packId.error }, 400);
    if (!deps.dataSource.archiveStickerPack) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const pack = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const archived = await transactionDataSource.archiveStickerPack!({
        tenantId: actor.tenantId,
        packId: packId.value
      });
      if (!archived) return null;
      await deps.appendManagementAuditEvent(
        communicationAudit({
          actionType: "communications.sticker_pack_archived",
          actor,
          commandInput: { packId: archived.id },
          permissionResult: decision,
          sourceEntity: { type: "StickerPack", id: archived.id },
          afterState: { archivedAt: archived.archivedAt?.toISOString() ?? null }
        }),
        transactionDataSource
      );
      return archived;
    });
    if (!pack) return context.json({ error: "sticker_pack_not_found" }, 404);
    return context.json({ stickerPack: serializeStickerPack(pack) });
  });

  app.get("/api/workspace/stickers/:stickerId/download", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const decision = canReadCommunications({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    if (!deps.dataSource.findStickerAsset || !deps.dataSource.findFileAssetById) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const stickerId = parseCollaborationId(context.req.param("stickerId"), "sticker_id_invalid");
    if (!stickerId.ok) return context.json({ error: stickerId.error }, 400);
    const sticker = await deps.dataSource.findStickerAsset(actor.tenantId, stickerId.value);
    if (!sticker) return context.json({ error: "sticker_not_found" }, 404);
    const asset = await deps.dataSource.findFileAssetById(actor.tenantId, sticker.fileAssetId);
    if (!asset || asset.archivedAt) return context.json({ error: "sticker_not_found" }, 404);
    if (asset.status !== "ready") return context.json({ error: "sticker_not_ready" }, 409);

    const object = await deps.storageProvider.readObject(asset.storageKey);
    const headers = new Headers();
    headers.set("Cache-Control", "no-store, private");
    headers.set("Content-Type", sticker.mimeType);
    headers.set("Content-Length", String(object.bytes.byteLength));
    headers.set(
      "Content-Disposition",
      `inline; filename="${escapeDownloadName(asset.safeDisplayName)}"`
    );
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(toArrayBuffer(object.bytes), { headers });
  });

  app.delete("/api/workspace/stickers/:stickerId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const decision = canManageCommunications({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAudit(deps, actor, { action: "sticker.archive", permissionResult: decision });
      return context.json({ error: decision.reason }, 403);
    }
    const stickerId = parseCollaborationId(context.req.param("stickerId"), "sticker_id_invalid");
    if (!stickerId.ok) return context.json({ error: stickerId.error }, 400);
    if (!deps.dataSource.archiveStickerAsset) {
      return context.json({ error: "communications_not_configured" }, 501);
    }
    const sticker = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const archived = await transactionDataSource.archiveStickerAsset!({
        tenantId: actor.tenantId,
        stickerAssetId: stickerId.value
      });
      if (!archived) return null;
      await deps.appendManagementAuditEvent(
        communicationAudit({
          actionType: "communications.sticker_archived",
          actor,
          commandInput: { stickerAssetId: archived.id, packId: archived.packId },
          permissionResult: decision,
          sourceEntity: { type: "StickerAsset", id: archived.id },
          afterState: { archivedAt: archived.archivedAt?.toISOString() ?? null }
        }),
        transactionDataSource
      );
      return archived;
    });
    if (!sticker) return context.json({ error: "sticker_not_found" }, 404);
    return context.json({ sticker: serializeStickerAsset(sticker) });
  });
}

async function resolveChannelForActor(
  rawChannelId: string,
  actor: TenantUser,
  deps: ApiRouteDeps
): Promise<
  | { ok: true; value: { channel: CommunicationChannel; access: CommunicationChannelAccess } }
  | { ok: false; status: 400 | 403 | 404 | 501; error: string }
> {
  const channelId = parseCollaborationId(rawChannelId, "communication_channel_id_invalid");
  if (!channelId.ok) return { ok: false, status: 400, error: channelId.error };
  const channel = await deps.dataSource.findCommunicationChannel?.(actor.tenantId, channelId.value);
  if (!channel) return { ok: false, status: 404, error: "communication_channel_not_found" };
  const profile = await deps.getActorProfile(actor);
  return {
    ok: true,
    value: {
      channel,
      access: await resolveCommunicationChannelAccess({
        actor,
        channel,
        dataSource: deps.dataSource,
        profile
      })
    }
  };
}

function parseOptionalChannelType(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: undefined };
  }
  return parseCommunicationChannelType(value);
}

function parseChannelCreateBody(value: unknown) {
  const record = readRecord(value);
  const channelType = parseCommunicationChannelType(record.channelType);
  if (!channelType.ok) return channelType;
  if (channelType.value === "workspace_general") {
    return { ok: false as const, error: "communication_channel_type_not_creatable" };
  }
  const title = parseConversationTitle(record.title);
  if (!title.ok) return title;
  const description = parseCommunicationChannelDescription(record.description);
  if (!description.ok) return description;
  const scopeEntityType = record.scopeEntityType === undefined || record.scopeEntityType === null
    ? null
    : String(record.scopeEntityType);
  const scopeEntityId = record.scopeEntityId === undefined || record.scopeEntityId === null
    ? null
    : String(record.scopeEntityId);
  if (
    (channelType.value === "team" || channelType.value === "project_general") &&
    (!scopeEntityType || !scopeEntityId)
  ) {
    return { ok: false as const, error: "communication_channel_scope_required" };
  }
  if (channelType.value === "team" && scopeEntityType !== "org_unit") {
    return { ok: false as const, error: "communication_channel_scope_type_invalid" };
  }
  if (channelType.value === "project_general" && scopeEntityType !== "project") {
    return { ok: false as const, error: "communication_channel_scope_type_invalid" };
  }
  if (
    scopeEntityType !== null &&
    scopeEntityType !== "project" &&
    scopeEntityType !== "org_unit"
  ) {
    return { ok: false as const, error: "communication_channel_scope_type_invalid" };
  }
  return {
    ok: true as const,
    value: {
      channelType: channelType.value,
      title: title.value,
      description: description.value,
      scopeEntityType: scopeEntityType as "project" | "org_unit" | null,
      scopeEntityId
    }
  };
}

function parseChannelPatchBody(value: unknown) {
  const record = readRecord(value);
  const patch: { title?: string; description?: string } = {};
  if (record.title !== undefined) {
    const title = parseConversationTitle(record.title);
    if (!title.ok) return title;
    patch.title = title.value;
  }
  if (record.description !== undefined) {
    const description = parseCommunicationChannelDescription(record.description);
    if (!description.ok) return description;
    patch.description = description.value;
  }
  if (patch.title === undefined && patch.description === undefined) {
    return { ok: false as const, error: "communication_channel_patch_empty" };
  }
  return { ok: true as const, value: patch };
}

function parseMemberBody(value: unknown) {
  const record = readRecord(value);
  const userId = parseCollaborationId(record.userId, "tenant_user_id_invalid");
  if (!userId.ok) return userId;
  const role = parseCommunicationChannelRole(record.role ?? "member");
  if (!role.ok) return role;
  return { ok: true as const, value: { userId: userId.value, role: role.value } };
}

function parseStickerPackBody(value: unknown) {
  const record = readRecord(value);
  const title = parseConversationTitle(record.title);
  if (!title.ok) return title;
  const description = parseCommunicationChannelDescription(record.description);
  if (!description.ok) return description;
  const source = parseStickerPackSource(record.source ?? "manual_upload");
  if (!source.ok) return source;
  return {
    ok: true as const,
    value: { title: title.value, description: description.value, source: source.value }
  };
}

async function parseStickerImportForm(request: Request): Promise<
  | {
      ok: true;
      value: {
        bytes: Uint8Array;
        emoji: string;
        height: number;
        mimeType: "image/png" | "image/webp";
        originalName: string;
        safeDisplayName: string;
        tags: string[];
        title: string;
        width: number;
      };
    }
  | { ok: false; status: 400 | 413; error: string }
> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, status: 400, error: "multipart_form_invalid" };
  }
  const file = form.get("file");
  if (!isUploadFile(file)) return { ok: false, status: 400, error: "sticker_file_required" };
  const mimeType = parseStickerMimeType(file.type || "application/octet-stream");
  if (!mimeType.ok) return { ok: false, status: 400, error: mimeType.error };
  const fileSize = parseStickerFileSize(file.size);
  if (!fileSize.ok) {
    return { ok: false, status: fileSize.error === "sticker_file_too_large" ? 413 : 400, error: fileSize.error };
  }
  const width = parseStickerDimension(Number(form.get("width")));
  if (!width.ok) return { ok: false, status: 400, error: width.error };
  const height = parseStickerDimension(Number(form.get("height")));
  if (!height.ok) return { ok: false, status: 400, error: height.error };
  const emoji = parseMessageReactionEmoji(form.get("emoji"));
  if (!emoji.ok) return { ok: false, status: 400, error: emoji.error };
  const title = parseConversationTitle(form.get("title") ?? file.name);
  if (!title.ok) return { ok: false, status: 400, error: title.error };
  const tags = parseStickerTags(parseTagsFormValue(form.get("tags")));
  if (!tags.ok) return { ok: false, status: 400, error: tags.error };
  const safeName = sanitizeFileName(file.name);
  if (!safeName.ok) return { ok: false, status: 400, error: safeName.error };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checkedBytes = parseStickerFileSize(bytes.byteLength);
  if (!checkedBytes.ok) {
    return { ok: false, status: checkedBytes.error === "sticker_file_too_large" ? 413 : 400, error: checkedBytes.error };
  }
  const image = parseStickerImageMetadata(bytes);
  if (!image.ok) return { ok: false, status: 400, error: image.error };
  if (image.value.mimeType !== mimeType.value) {
    return { ok: false, status: 400, error: "sticker_mime_type_invalid" };
  }
  if (image.value.width !== width.value || image.value.height !== height.value) {
    return { ok: false, status: 400, error: "sticker_dimension_mismatch" };
  }
  return {
    ok: true,
    value: {
      bytes,
      emoji: emoji.value,
      height: height.value,
      mimeType: mimeType.value,
      originalName: file.name,
      safeDisplayName: safeName.value,
      tags: tags.value,
      title: title.value,
      width: width.value
    }
  };
}

async function importStickerFile(input: {
  actor: TenantUser;
  decision: PolicyDecision;
  deps: ApiRouteDeps;
  pack: StickerPack;
  sticker: {
    bytes: Uint8Array;
    emoji: string;
    height: number;
    mimeType: "image/png" | "image/webp";
    originalName: string;
    safeDisplayName: string;
    tags: string[];
    title: string;
    width: number;
  };
}): Promise<{ ok: true; sticker: StickerAsset } | { ok: false; status: 501 | 502; error: string }> {
  if (
    !input.deps.dataSource.createPendingFileAsset ||
    !input.deps.dataSource.markFileAssetReady ||
    !input.deps.dataSource.markFileAssetFailed ||
    !input.deps.dataSource.createStickerAsset
  ) {
    return { ok: false, status: 501, error: "communications_not_configured" };
  }
  const assetId = `file-asset-sticker-${randomUUID()}`;
  const storageKey = buildStorageKey({
    tenantId: input.actor.tenantId,
    assetId,
    safeDisplayName: input.sticker.safeDisplayName
  });
  await input.deps.dataSource.createPendingFileAsset({
    id: assetId,
    tenantId: input.actor.tenantId,
    provider: input.deps.storageProvider.provider,
    storageKey,
    originalName: input.sticker.originalName,
    safeDisplayName: input.sticker.safeDisplayName,
    mimeType: input.sticker.mimeType,
    sizeBytes: input.sticker.bytes.byteLength,
    checksumSha256: null,
    createdByUserId: input.actor.id
  });
  try {
    await input.deps.storageProvider.putObject({
      storageKey,
      bytes: input.sticker.bytes,
      mimeType: input.sticker.mimeType
    });
  } catch {
    await input.deps.dataSource.markFileAssetFailed({
      tenantId: input.actor.tenantId,
      assetId
    });
    return { ok: false, status: 502, error: "storage_write_failed" };
  }
  const checksumSha256 = sha256Hex(input.sticker.bytes);
  try {
    const sticker = await input.deps.runDataSourceTransaction(async (transactionDataSource) => {
      const readyAsset = await transactionDataSource.markFileAssetReady?.({
        tenantId: input.actor.tenantId,
        assetId,
        sizeBytes: input.sticker.bytes.byteLength,
        checksumSha256
      });
      if (!readyAsset) throw new Error("file_asset_ready_failed");
      const created = await transactionDataSource.createStickerAsset?.({
        id: `sticker-${randomUUID()}`,
        tenantId: input.actor.tenantId,
        packId: input.pack.id,
        fileAssetId: readyAsset.id,
        emoji: input.sticker.emoji,
        title: input.sticker.title,
        tags: input.sticker.tags,
        mimeType: input.sticker.mimeType,
        width: input.sticker.width,
        height: input.sticker.height,
        sizeBytes: input.sticker.bytes.byteLength,
        checksumSha256,
        status: "ready",
        createdByUserId: input.actor.id
      });
      if (!created) throw new Error("sticker_asset_create_failed");
      await input.deps.appendManagementAuditEvent(
        communicationAudit({
          actionType: "communications.sticker_pack_imported",
          actor: input.actor,
          commandInput: {
            packId: input.pack.id,
            mimeType: created.mimeType,
            sizeBytes: created.sizeBytes
          },
          permissionResult: input.decision,
          sourceEntity: { type: "StickerPack", id: input.pack.id },
          afterState: { stickerAssetId: created.id }
        }),
        transactionDataSource
      );
      return created;
    });
    return { ok: true, sticker };
  } catch (error) {
    await input.deps.storageProvider.deleteObject(storageKey).catch(() => undefined);
    await input.deps.dataSource.markFileAssetFailed({
      tenantId: input.actor.tenantId,
      assetId
    });
    throw error;
  }
}

function parseStickerImageMetadata(bytes: Uint8Array): {
  ok: true;
  value: { mimeType: "image/png" | "image/webp"; width: number; height: number };
} | { ok: false; error: string } {
  const png = parsePngMetadata(bytes);
  if (png.ok) return png;
  const webp = parseWebpMetadata(bytes);
  if (webp.ok) return webp;
  return { ok: false, error: "sticker_image_invalid" };
}

function parsePngMetadata(bytes: Uint8Array): {
  ok: true;
  value: { mimeType: "image/png"; width: number; height: number };
} | { ok: false } {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte)) {
    return { ok: false };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = String.fromCharCode(...bytes.slice(12, 16));
  if (view.getUint32(8) !== 13 || type !== "IHDR") return { ok: false };
  return {
    ok: true,
    value: {
      mimeType: "image/png",
      width: view.getUint32(16),
      height: view.getUint32(20)
    }
  };
}

function parseWebpMetadata(bytes: Uint8Array): {
  ok: true;
  value: { mimeType: "image/webp"; width: number; height: number };
} | { ok: false } {
  if (
    bytes.length < 30 ||
    String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" ||
    String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP"
  ) {
    return { ok: false };
  }
  const chunkType = String.fromCharCode(...bytes.slice(12, 16));
  if (chunkType === "VP8X" && bytes.length >= 30) {
    return {
      ok: true,
      value: {
        mimeType: "image/webp",
        width: readUint24LE(bytes, 24) + 1,
        height: readUint24LE(bytes, 27) + 1
      }
    };
  }
  if (chunkType === "VP8L" && bytes.length >= 25 && (bytes[20] ?? 0) === 0x2f) {
    const bits =
      (bytes[21] ?? 0) |
      ((bytes[22] ?? 0) << 8) |
      ((bytes[23] ?? 0) << 16) |
      ((bytes[24] ?? 0) << 24);
    return {
      ok: true,
      value: {
        mimeType: "image/webp",
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1
      }
    };
  }
  if (chunkType === "VP8 " && bytes.length >= 30) {
    const start = 20;
    if (
      (bytes[start + 3] ?? 0) !== 0x9d ||
      (bytes[start + 4] ?? 0) !== 0x01 ||
      (bytes[start + 5] ?? 0) !== 0x2a
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      value: {
        mimeType: "image/webp",
        width: ((bytes[start + 6] ?? 0) | ((bytes[start + 7] ?? 0) << 8)) & 0x3fff,
        height: ((bytes[start + 8] ?? 0) | ((bytes[start + 9] ?? 0) << 8)) & 0x3fff
      }
    };
  }
  return { ok: false };
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function parseTagsFormValue(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(",").map((item) => item.trim());
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    "type" in value
  );
}

async function canTargetUserJoinChannel(
  targetUser: TenantUser,
  channel: CommunicationChannel,
  deps: ApiRouteDeps
): Promise<boolean> {
  if (channel.channelType !== "project_general") return true;
  if (channel.scopeEntityType !== "project" || !channel.scopeEntityId) return false;
  const profile = await deps.dataSource.findAccessProfileById?.(
    targetUser.tenantId,
    targetUser.accessProfileId
  );
  if (!profile) return false;
  const decision = canReadProjects({
    actor: targetUser,
    profile,
    targetTenantId: targetUser.tenantId
  });
  if (!decision.allowed) return false;
  const projects = await deps.dataSource.listProjects?.(targetUser.tenantId) ?? [];
  return projects.some((project) => project.id === channel.scopeEntityId);
}

function serializeChannel(channel: CommunicationChannel, access: CommunicationChannelAccess) {
  return {
    id: channel.id,
    channelType: channel.channelType,
    title: channel.title,
    description: channel.description,
    scopeEntityType: channel.scopeEntityType,
    scopeEntityId: channel.scopeEntityId,
    canManage: access.manageDecision.allowed,
    createdByUserId: channel.createdByUserId,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
    archivedAt: channel.archivedAt?.toISOString() ?? null
  };
}

function serializeMember(member: import("@kiss-pm/domain").CommunicationChannelMember) {
  return {
    tenantId: member.tenantId,
    channelId: member.channelId,
    userId: member.userId,
    role: member.role,
    createdByUserId: member.createdByUserId,
    createdAt: member.createdAt.toISOString(),
    archivedAt: member.archivedAt?.toISOString() ?? null
  };
}

function serializeStickerPack(pack: StickerPack) {
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    source: pack.source,
    status: pack.status,
    createdByUserId: pack.createdByUserId,
    createdAt: pack.createdAt.toISOString(),
    archivedAt: pack.archivedAt?.toISOString() ?? null
  };
}

function serializeStickerAsset(sticker: StickerAsset) {
  return {
    id: sticker.id,
    packId: sticker.packId,
    downloadUrl: `/api/workspace/stickers/${sticker.id}/download`,
    emoji: sticker.emoji,
    title: sticker.title,
    tags: sticker.tags,
    mimeType: sticker.mimeType,
    width: sticker.width,
    height: sticker.height,
    sizeBytes: sticker.sizeBytes,
    status: sticker.status,
    createdAt: sticker.createdAt.toISOString(),
    archivedAt: sticker.archivedAt?.toISOString() ?? null
  };
}

function escapeDownloadName(value: string): string {
  return value.replace(/["\\\r\n]/g, "_");
}

async function appendDeniedAudit(
  deps: ApiRouteDeps,
  actor: TenantUser,
  input: {
    action: string;
    channelId?: string;
    permissionResult: PolicyDecision;
  }
) {
  await deps.appendManagementAuditEvent(communicationAudit({
    actionType: "communications.denied",
    actor,
    commandInput: input,
    permissionResult: input.permissionResult,
    sourceEntity: { type: "Communication", id: input.channelId ?? actor.tenantId },
    executionResult: { status: "denied" }
  }));
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
