import type { Hono } from "hono";

import {
  createLiveKitEgressProviderFromEnv,
  type LiveKitEgressProvider
} from "./communications/recording/livekitEgressProvider";
import { createCommunicationRecordingWorkspace } from "./communications/recording/recordingWorkspace";
import type { ApiRouteDeps } from "./routeTypes";

// LiveKit Egress webhook receiver. Registered OUTSIDE /api/* so it is exempt from the
// browser same-origin (CSRF) guard — it is a server-to-server callback whose
// authenticity is established by the mandatory LiveKit webhook signature instead.
export function registerCommunicationRecordingWebhookRoute(app: Hono, deps: ApiRouteDeps) {
  app.post("/integrations/livekit/webhook", async (context) => {
    const egressProvider = createLiveKitEgressProviderFromEnv();
    if (!egressProvider) {
      // Recording disabled: nothing to reconcile and no key/secret to verify against.
      return context.body(null, 204);
    }

    const rawBody = await context.req.text();
    const authHeader = context.req.header("Authorization");
    let event;
    try {
      // Verifies the LiveKit signature; throws on a forged/missing signature (fail-closed).
      event = await egressProvider.receiveWebhook(rawBody, authHeader);
    } catch {
      return context.json({ error: "call_webhook_signature_invalid" }, 401);
    }

    if (event.event === "egress_ended" && event.egressInfo) {
      await reconcile(deps, egressProvider, event.egressInfo);
    }

    return context.body(null, 204);
  });
}

async function reconcile(
  deps: ApiRouteDeps,
  egressProvider: LiveKitEgressProvider,
  egressInfo: { egressId: string; fileResults?: { filename?: string; size?: bigint; duration?: bigint }[] }
): Promise<void> {
  const egressId = egressInfo.egressId;
  const fileResult = egressInfo.fileResults?.[0];
  // Tenant is parsed from the egress output key (recordings/{tenantId}/...) that WE set,
  // never trusted from a free-form payload field.
  const tenantId = parseTenantFromStorageKey(fileResult?.filename ?? "");
  if (!tenantId || !egressId) return;

  const sizeBytes = fileResult?.size ? Number(fileResult.size) : 0;
  const durationSeconds = fileResult?.duration ? Number(fileResult.duration) : null;

  const recordingWorkspace = createCommunicationRecordingWorkspace({
    dataSource: deps.dataSource,
    egressProvider,
    appendManagementAuditEvent: deps.appendManagementAuditEvent
  });
  await recordingWorkspace.reconcileEgressEnded({ tenantId, egressId, sizeBytes, durationSeconds });
}

function parseTenantFromStorageKey(key: string): string | null {
  const parts = key.split("/");
  return parts[0] === "recordings" && parts[1] ? parts[1] : null;
}
