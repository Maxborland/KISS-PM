import type { Hono } from "hono";

import type { EgressEndedFile } from "./communications/recording/livekitEgressProvider";
import { createCommunicationRecordingWorkspace } from "./communications/recording/recordingWorkspace";
import type { ApiRouteDeps } from "./routeTypes";

// LiveKit Egress webhook receiver. Registered OUTSIDE /api/* so it is exempt from the
// browser same-origin (CSRF) guard — it is a server-to-server callback whose
// authenticity is established by the mandatory LiveKit webhook signature instead.
export function registerCommunicationRecordingWebhookRoute(app: Hono, deps: ApiRouteDeps) {
  app.post("/integrations/livekit/webhook", async (context) => {
    const egressProvider = deps.egressProvider;
    if (!egressProvider) {
      // Recording disabled: nothing to reconcile and no key/secret to verify against.
      return context.body(null, 204);
    }

    const rawBody = await context.req.text();
    const authHeader = context.req.header("Authorization");
    let event;
    try {
      // receiveWebhook verifies the LiveKit signature (fail-closed) and returns a decoded
      // DTO — no SDK type, protobuf int64, or nanosecond unit reaches this handler.
      event = await egressProvider.receiveWebhook(rawBody, authHeader);
    } catch {
      return context.json({ error: "call_webhook_signature_invalid" }, 401);
    }

    if (event.kind === "egress_ended" && event.egressId && event.file) {
      await reconcile(deps, event.egressId, event.file);
    }

    return context.body(null, 204);
  });
}

async function reconcile(deps: ApiRouteDeps, egressId: string, file: EgressEndedFile): Promise<void> {
  // Tenant is parsed from the egress output key (recordings/{tenantId}/...) that WE set,
  // never trusted from a free-form payload field.
  const tenantId = parseTenantFromStorageKey(file.storageKey);
  if (!tenantId) return;

  const recordingWorkspace = createCommunicationRecordingWorkspace({
    dataSource: deps.dataSource,
    egressProvider: deps.egressProvider,
    appendManagementAuditEvent: deps.appendManagementAuditEvent
  });
  // storageKey is the authoritative codec-correct filename LiveKit reported.
  await recordingWorkspace.reconcileEgressEnded({
    tenantId,
    egressId,
    storageKey: file.storageKey,
    sizeBytes: file.sizeBytes,
    durationSeconds: file.durationSeconds
  });
}

function parseTenantFromStorageKey(key: string): string | null {
  const parts = key.split("/");
  return parts[0] === "recordings" && parts[1] ? parts[1] : null;
}
