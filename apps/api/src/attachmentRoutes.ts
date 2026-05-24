import type { AccessProfile, PolicyDecision } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type {
  AttachmentEntityType,
  AttachmentReadModel,
  ExternalReferenceConnectorType
} from "@kiss-pm/persistence";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import {
  resolveAttachmentEntityContext,
  type AttachmentEntityContext
} from "./attachmentEntityAccess";
import { serializeAttachment } from "./attachmentSerialization";
import {
  buildStorageKey,
  parseAttachmentEntityType,
  parseConnectorType,
  parseExternalReferenceUrl,
  parseMetadata,
  parseMimeType,
  parsePositiveSize,
  parseReferenceTitle,
  sanitizeFileName,
  sha256Hex
} from "./attachmentValidation";
import { readLimitedJsonBody } from "./jsonBody";
import type { StorageProvider } from "./storageProvider";

const maxUploadBytes = 25 * 1024 * 1024;
const maxMultipartEnvelopeBytes = maxUploadBytes + 1024 * 1024;

type AttachmentRouteDeps = {
  dataSource: ApiTenantDataSource;
  storageProvider: StorageProvider;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export function registerAttachmentRoutes(app: Hono, deps: AttachmentRouteDeps) {
  app.get("/api/workspace/attachments", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listEntityAttachments) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const entityType = parseAttachmentEntityType(context.req.query("entityType"));
    if (!entityType.ok) return context.json({ error: entityType.error }, 400);
    const entityId = context.req.query("entityId")?.trim();
    if (!entityId) return context.json({ error: "attachment_entity_id_required" }, 400);

    const profile = await deps.getActorProfile(actor);
    const entity = await resolveAttachmentEntityContext({
      actor,
      dataSource: deps.dataSource,
      entityId,
      entityType: entityType.value,
      profile
    });
    if (!entity.ok) return context.json({ error: entity.error }, entity.status);
    if (!entity.value.readDecision.allowed) {
      return context.json({ error: entity.value.readDecision.reason }, 403);
    }

    const attachments = await deps.dataSource.listEntityAttachments({
      tenantId: actor.tenantId,
      entityType: entity.value.entityType,
      entityId: entity.value.entityId
    });
    return context.json({ attachments: attachments.map(serializeAttachment) });
  });

  app.post("/api/workspace/attachments/external-references", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.createExternalReference ||
      !deps.dataSource.createEntityAttachment ||
      !deps.dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseExternalReferenceBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const entity = await resolveAttachmentEntityContext({
      actor,
      dataSource: deps.dataSource,
      entityId: parsed.value.entityId,
      entityType: parsed.value.entityType,
      profile
    });
    if (!entity.ok) return context.json({ error: entity.error }, entity.status);
    if (!entity.value.manageDecision.allowed) {
      await appendAttachmentDeniedAudit(deps, {
        actor,
        entity: entity.value,
        error: entity.value.manageDecision.reason,
        permissionResult: entity.value.manageDecision
      });
      return context.json({ error: entity.value.manageDecision.reason }, 403);
    }

    const attachment = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.createExternalReference ||
        !transactionDataSource.createEntityAttachment
      ) {
        throw new Error("persistence_not_configured");
      }
      const reference = await transactionDataSource.createExternalReference({
        id: `external-ref-${randomUUID()}`,
        tenantId: actor.tenantId,
        connectorType: parsed.value.connectorType,
        externalId: parsed.value.externalId,
        url: parsed.value.url,
        title: parsed.value.title,
        metadata: parsed.value.metadata,
        createdByUserId: actor.id
      });
      const createdAttachment = await transactionDataSource.createEntityAttachment({
        id: `attachment-${randomUUID()}`,
        tenantId: actor.tenantId,
        entityType: entity.value.entityType,
        entityId: entity.value.entityId,
        assetId: null,
        externalReferenceId: reference.id,
        relationType: parsed.value.relationType,
        sourceActivityType: null,
        sourceActivityId: null,
        createdByUserId: actor.id
      });
      await appendAttachmentAudit(deps, transactionDataSource, {
        actionType: "attachment.external_reference_attached",
        actor,
        attachment: createdAttachment,
        entity: entity.value,
        permissionResult: entity.value.manageDecision
      });
      return createdAttachment;
    });

    return context.json({ attachment: serializeAttachment(attachment) }, 201);
  });

  app.post("/api/workspace/attachments/files", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.createPendingFileAsset ||
      !deps.dataSource.markFileAssetReady ||
      !deps.dataSource.markFileAssetFailed ||
      !deps.dataSource.createEntityAttachment ||
      !deps.dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const contentLength = parseContentLength(context.req.header("content-length"));
    if (contentLength !== null && contentLength > maxMultipartEnvelopeBytes) {
      return context.json({ error: "file_too_large" }, 413);
    }

    const boundedRequest = await readBoundedMultipartRequest(
      context.req.raw,
      maxMultipartEnvelopeBytes
    );
    if (!boundedRequest.ok) {
      return context.json({ error: boundedRequest.error }, boundedRequest.status);
    }

    const parsedForm = await parseUploadForm(boundedRequest.request);
    if (!parsedForm.ok) return context.json({ error: parsedForm.error }, parsedForm.status);

    const profile = await deps.getActorProfile(actor);
    const entity = await resolveAttachmentEntityContext({
      actor,
      dataSource: deps.dataSource,
      entityId: parsedForm.value.entityId,
      entityType: parsedForm.value.entityType,
      profile
    });
    if (!entity.ok) return context.json({ error: entity.error }, entity.status);
    if (!entity.value.manageDecision.allowed) {
      await appendAttachmentDeniedAudit(deps, {
        actor,
        entity: entity.value,
        error: entity.value.manageDecision.reason,
        permissionResult: entity.value.manageDecision
      });
      return context.json({ error: entity.value.manageDecision.reason }, 403);
    }

    const assetId = `file-asset-${randomUUID()}`;
    const storageKey = buildStorageKey({
      tenantId: actor.tenantId,
      assetId,
      safeDisplayName: parsedForm.value.safeDisplayName
    });
    const pending = await deps.dataSource.createPendingFileAsset({
      id: assetId,
      tenantId: actor.tenantId,
      provider: deps.storageProvider.provider,
      storageKey,
      originalName: parsedForm.value.originalName,
      safeDisplayName: parsedForm.value.safeDisplayName,
      mimeType: parsedForm.value.mimeType,
      sizeBytes: parsedForm.value.bytes.byteLength,
      checksumSha256: null,
      createdByUserId: actor.id
    });

    try {
      await deps.storageProvider.putObject({
        storageKey,
        bytes: parsedForm.value.bytes,
        mimeType: parsedForm.value.mimeType
      });
    } catch {
      await deps.dataSource.markFileAssetFailed({
        tenantId: actor.tenantId,
        assetId: pending.id
      });
      return context.json({ error: "storage_write_failed" }, 502);
    }

    const checksumSha256 = sha256Hex(parsedForm.value.bytes);
    try {
      const attachment = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        if (!transactionDataSource.markFileAssetReady || !transactionDataSource.createEntityAttachment) {
          throw new Error("persistence_not_configured");
        }
        const readyAsset = await transactionDataSource.markFileAssetReady({
          tenantId: actor.tenantId,
          assetId: pending.id,
          sizeBytes: parsedForm.value.bytes.byteLength,
          checksumSha256
        });
        if (!readyAsset) throw new Error("file_asset_ready_failed");
        const createdAttachment = await transactionDataSource.createEntityAttachment({
          id: `attachment-${randomUUID()}`,
          tenantId: actor.tenantId,
          entityType: entity.value.entityType,
          entityId: entity.value.entityId,
          assetId: readyAsset.id,
          externalReferenceId: null,
          relationType: parsedForm.value.relationType,
          sourceActivityType: null,
          sourceActivityId: null,
          createdByUserId: actor.id
        });
        await appendAttachmentAudit(deps, transactionDataSource, {
          actionType: "attachment.file_attached",
          actor,
          attachment: createdAttachment,
          entity: entity.value,
          permissionResult: entity.value.manageDecision
        });
        return createdAttachment;
      });
      return context.json({ attachment: serializeAttachment(attachment) }, 201);
    } catch (error) {
      await deps.storageProvider.deleteObject(storageKey).catch(() => undefined);
      await deps.dataSource.markFileAssetFailed({
        tenantId: actor.tenantId,
        assetId: pending.id
      });
      throw error;
    }
  });

  app.delete("/api/workspace/attachments/:attachmentId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.findAttachmentById || !deps.dataSource.archiveAttachment) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const attachment = await deps.dataSource.findAttachmentById(
      actor.tenantId,
      context.req.param("attachmentId")
    );
    if (!attachment || attachment.archivedAt) {
      return context.json({ error: "attachment_not_found" }, 404);
    }

    const profile = await deps.getActorProfile(actor);
    const entity = await resolveAttachmentEntityContext({
      actor,
      dataSource: deps.dataSource,
      entityId: attachment.entityId,
      entityType: attachment.entityType,
      profile
    });
    if (!entity.ok) return context.json({ error: entity.error }, entity.status);
    if (!entity.value.manageDecision.allowed) {
      await appendAttachmentDeniedAudit(deps, {
        actor,
        entity: entity.value,
        error: entity.value.manageDecision.reason,
        permissionResult: entity.value.manageDecision
      });
      return context.json({ error: entity.value.manageDecision.reason }, 403);
    }

    const archived = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.archiveAttachment) throw new Error("persistence_not_configured");
      const current = await transactionDataSource.archiveAttachment({
        tenantId: actor.tenantId,
        attachmentId: attachment.id
      });
      if (!current) return undefined;
      await appendAttachmentAudit(deps, transactionDataSource, {
        actionType: "attachment.removed",
        actor,
        attachment: current,
        beforeState: serializeAttachment(attachment),
        entity: entity.value,
        permissionResult: entity.value.manageDecision
      });
      return current;
    });
    if (!archived) return context.json({ error: "attachment_not_found" }, 404);
    return context.json({ attachment: serializeAttachment(archived) });
  });

  app.get("/api/workspace/attachments/:attachmentId/download", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.findAttachmentById) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const attachment = await deps.dataSource.findAttachmentById(
      actor.tenantId,
      context.req.param("attachmentId")
    );
    if (!attachment || attachment.archivedAt || !attachment.fileAsset) {
      return context.json({ error: "attachment_not_found" }, 404);
    }
    if (attachment.fileAsset.status !== "ready" || attachment.fileAsset.archivedAt) {
      return context.json({ error: "attachment_not_ready" }, 409);
    }

    const profile = await deps.getActorProfile(actor);
    const entity = await resolveAttachmentEntityContext({
      actor,
      dataSource: deps.dataSource,
      entityId: attachment.entityId,
      entityType: attachment.entityType,
      profile
    });
    if (!entity.ok) return context.json({ error: entity.error }, entity.status);
    if (!entity.value.readDecision.allowed) {
      return context.json({ error: entity.value.readDecision.reason }, 403);
    }

    const object = await deps.storageProvider.readObject(attachment.fileAsset.storageKey);
    const headers = new Headers();
    headers.set("Content-Type", attachment.fileAsset.mimeType);
    headers.set("Content-Length", String(object.bytes.byteLength));
    headers.set(
      "Content-Disposition",
      `attachment; filename="${escapeDownloadName(attachment.fileAsset.safeDisplayName)}"`
    );
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(toArrayBuffer(object.bytes), { headers });
  });
}

async function parseUploadForm(request: Request): Promise<
  | {
      ok: true;
      value: {
        entityType: AttachmentEntityType;
        entityId: string;
        relationType: string;
        originalName: string;
        safeDisplayName: string;
        mimeType: string;
        bytes: Uint8Array;
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
  const entityType = parseAttachmentEntityType(form.get("entityType"));
  if (!entityType.ok) return { ok: false, status: 400, error: entityType.error };
  const entityId = String(form.get("entityId") ?? "").trim();
  if (!entityId) return { ok: false, status: 400, error: "attachment_entity_id_required" };
  const file = form.get("file");
  if (!isUploadFile(file)) return { ok: false, status: 400, error: "file_required" };

  const originalName = sanitizeFileName(file.name);
  if (!originalName.ok) return { ok: false, status: 400, error: originalName.error };
  const mimeType = parseMimeType(file.type || "application/octet-stream");
  if (!mimeType.ok) return { ok: false, status: 400, error: mimeType.error };
  const size = parsePositiveSize(file.size, maxUploadBytes);
  if (!size.ok) {
    return { ok: false, status: size.error === "file_too_large" ? 413 : 400, error: size.error };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checkedSize = parsePositiveSize(bytes.byteLength, maxUploadBytes);
  if (!checkedSize.ok) {
    return {
      ok: false,
      status: checkedSize.error === "file_too_large" ? 413 : 400,
      error: checkedSize.error
    };
  }

  return {
    ok: true,
    value: {
      entityType: entityType.value,
      entityId,
      relationType: parseRelationType(form.get("relationType")),
      originalName: file.name,
      safeDisplayName: originalName.value,
      mimeType: mimeType.value,
      bytes
    }
  };
}

function parseExternalReferenceBody(value: unknown): {
  ok: true;
  value: {
    entityType: AttachmentEntityType;
    entityId: string;
    connectorType: ExternalReferenceConnectorType;
    externalId: string | null;
    url: string;
    title: string;
    metadata: Record<string, unknown>;
    relationType: string;
  };
} | { ok: false; error: string } {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const entityType = parseAttachmentEntityType(body.entityType);
  if (!entityType.ok) return entityType;
  const entityId = typeof body.entityId === "string" ? body.entityId.trim() : "";
  if (!entityId) return { ok: false, error: "attachment_entity_id_required" };
  const connectorType = parseConnectorType(body.connectorType);
  if (!connectorType.ok) return connectorType;
  const url = parseExternalReferenceUrl(body.url);
  if (!url.ok) return url;
  const title = parseReferenceTitle(body.title);
  if (!title.ok) return title;
  const metadata = parseMetadata(body.metadata);
  if (!metadata.ok) return metadata;
  return {
    ok: true,
    value: {
      entityType: entityType.value,
      entityId,
      connectorType: connectorType.value,
      externalId: typeof body.externalId === "string" && body.externalId.trim()
        ? body.externalId.trim().slice(0, 240)
        : null,
      url: url.value,
      title: title.value,
      metadata: metadata.value,
      relationType: parseRelationType(body.relationType)
    }
  };
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

function parseRelationType(value: unknown): string {
  const relationType = typeof value === "string" ? value.trim() : "";
  return relationType ? relationType.slice(0, 80) : "attachment";
}

async function appendAttachmentAudit(
  deps: AttachmentRouteDeps,
  auditDataSource: ApiTenantDataSource,
  input: {
    actionType: string;
    actor: TenantUser;
    attachment: AttachmentReadModel;
    beforeState?: Record<string, unknown> | null;
    entity: AttachmentEntityContext;
    permissionResult: PolicyDecision;
  }
) {
  await deps.appendManagementAuditEvent(
    {
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: input.actionType,
      sourceWorkflow: "attachments",
      sourceEntity: input.entity.sourceEntity,
      commandInput: {
        attachmentId: input.attachment.id,
        entityType: input.attachment.entityType,
        entityId: input.attachment.entityId
      },
      beforeState: input.beforeState ?? null,
      afterState: summarizeAttachment(input.attachment),
      permissionResult: input.permissionResult
    },
    auditDataSource
  );
}

async function appendAttachmentDeniedAudit(
  deps: AttachmentRouteDeps,
  input: {
    actor: TenantUser;
    entity: AttachmentEntityContext;
    error: string;
    permissionResult: PolicyDecision;
  }
) {
  await deps.appendManagementAuditEvent({
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: "attachment.denied",
    sourceWorkflow: "attachments",
    sourceEntity: input.entity.sourceEntity,
    commandInput: {
      entityType: input.entity.entityType,
      entityId: input.entity.entityId
    },
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: {
      status: "denied",
      error: input.error
    }
  });
}

function summarizeAttachment(attachment: AttachmentReadModel): Record<string, unknown> {
  return {
    id: attachment.id,
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    kind: attachment.fileAsset ? "file" : "external_reference",
    fileName: attachment.fileAsset?.safeDisplayName ?? null,
    title: attachment.externalReference?.title ?? null,
    mimeType: attachment.fileAsset?.mimeType ?? null,
    sizeBytes: attachment.fileAsset?.sizeBytes ?? null,
    connectorType: attachment.externalReference?.connectorType ?? null,
    archivedAt: attachment.archivedAt?.toISOString() ?? null
  };
}

function escapeDownloadName(value: string): string {
  return value.replace(/["\\\r\n]/g, "_");
}

function parseContentLength(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function readBoundedMultipartRequest(
  request: Request,
  maxBytes: number
): Promise<
  | { ok: true; request: Request }
  | { ok: false; status: 413; error: "file_too_large" }
> {
  if (!request.body) return { ok: true, request };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, status: 413, error: "file_too_large" };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    ok: true,
    request: new Request(request.url, {
      body: toArrayBuffer(bytes),
      headers: request.headers,
      method: request.method
    })
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
