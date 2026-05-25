import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type {
  AttachmentEntityType,
  ExternalReferenceConnectorType
} from "@kiss-pm/persistence";
import type { Hono } from "hono";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import { serializeAttachment } from "./attachmentSerialization";
import {
  parseAttachmentEntityType,
  parseConnectorType,
  parseExternalReferenceUrl,
  parseMetadata,
  parseMimeType,
  parsePositiveSize,
  parseReferenceTitle,
  sanitizeFileName
} from "./attachmentValidation";
import { createAttachmentWorkspace } from "./attachments/attachmentWorkspace";
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
  const attachmentWorkspace = createAttachmentWorkspace(deps);

  app.get("/api/workspace/attachments", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const entityType = parseAttachmentEntityType(context.req.query("entityType"));
    if (!entityType.ok) return context.json({ error: entityType.error }, 400);
    const entityId = context.req.query("entityId")?.trim();
    if (!entityId) return context.json({ error: "attachment_entity_id_required" }, 400);

    const profile = await deps.getActorProfile(actor);
    const result = await attachmentWorkspace.listAttachments({
      actor,
      entityId,
      entityType: entityType.value,
      profile
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ attachments: result.attachments.map(serializeAttachment) });
  });

  app.post("/api/workspace/attachments/external-references", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseExternalReferenceBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const result = await attachmentWorkspace.attachExternalReference({
      actor,
      profile,
      ...parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ attachment: serializeAttachment(result.attachment) }, 201);
  });

  app.post("/api/workspace/attachments/files", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

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
    const result = await attachmentWorkspace.attachFile({
      actor,
      profile,
      ...parsedForm.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ attachment: serializeAttachment(result.attachment) }, 201);
  });

  app.delete("/api/workspace/attachments/:attachmentId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const result = await attachmentWorkspace.archiveAttachment({
      actor,
      attachmentId: context.req.param("attachmentId"),
      profile
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json({ attachment: serializeAttachment(result.attachment) });
  });

  app.get("/api/workspace/attachments/:attachmentId/download", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const result = await attachmentWorkspace.prepareDownload({
      actor,
      attachmentId: context.req.param("attachmentId"),
      profile
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    const headers = new Headers();
    headers.set("Cache-Control", "no-store, private");
    headers.set("Content-Type", result.mimeType);
    headers.set("Content-Length", String(result.bytes.byteLength));
    headers.set(
      "Content-Disposition",
      `attachment; filename="${escapeDownloadName(result.safeDisplayName)}"`
    );
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(toArrayBuffer(result.bytes), { headers });
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
