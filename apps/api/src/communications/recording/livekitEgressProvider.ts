import {
  DirectFileOutput,
  EgressClient,
  RoomServiceClient,
  S3Upload,
  TrackType,
  WebhookReceiver
} from "livekit-server-sdk";

// Thin LiveKit Egress wrapper for per-track server recording. Confines the
// livekit-server-sdk to one module; created from env, returns null when recording
// is not configured (provider!=livekit, egress disabled, or storage!=s3).

export type EgressTrack = {
  trackId: string;
  kind: "audio" | "video";
  participantIdentity: string;
};

export type EgressEndedFile = {
  storageKey: string;
  sizeBytes: number;
  durationSeconds: number | null;
};

// Decoded webhook DTO. The SDK WebhookEvent, protobuf int64s, and nanosecond units
// stay behind this seam so callers (the HTTP route) only ever see plain values.
export type EgressWebhookEvent =
  | { kind: "egress_ended"; egressId: string; file: EgressEndedFile | null }
  | { kind: "other" };

export type LiveKitEgressConfig = {
  httpUrl: string;
  apiKey: string;
  apiSecret: string;
  s3: {
    accessKey: string;
    secret: string;
    region: string;
    endpoint: string;
    bucket: string;
    forcePathStyle: boolean;
  };
};

export type LiveKitEgressProvider = {
  listRoomTracks(providerRoomId: string): Promise<EgressTrack[]>;
  startTrackEgress(input: { providerRoomId: string; trackId: string; filepath: string }): Promise<string>;
  stopEgress(egressId: string): Promise<void>;
  receiveWebhook(body: string, authHeader: string | undefined): Promise<EgressWebhookEvent>;
};

function toHttpUrl(wsUrl: string): string {
  if (wsUrl.startsWith("wss://")) return `https://${wsUrl.slice("wss://".length)}`;
  if (wsUrl.startsWith("ws://")) return `http://${wsUrl.slice("ws://".length)}`;
  return wsUrl;
}

export function createLiveKitEgressProvider(config: LiveKitEgressConfig): LiveKitEgressProvider {
  const egressClient = new EgressClient(config.httpUrl, config.apiKey, config.apiSecret);
  const roomClient = new RoomServiceClient(config.httpUrl, config.apiKey, config.apiSecret);
  const webhookReceiver = new WebhookReceiver(config.apiKey, config.apiSecret);

  function fileOutput(filepath: string): DirectFileOutput {
    return new DirectFileOutput({
      filepath,
      disableManifest: false,
      output: {
        case: "s3",
        value: new S3Upload({
          accessKey: config.s3.accessKey,
          secret: config.s3.secret,
          region: config.s3.region,
          endpoint: config.s3.endpoint,
          bucket: config.s3.bucket,
          forcePathStyle: config.s3.forcePathStyle
        })
      }
    });
  }

  return {
    async listRoomTracks(providerRoomId) {
      const participants = await roomClient.listParticipants(providerRoomId);
      const tracks: EgressTrack[] = [];
      for (const participant of participants) {
        for (const track of participant.tracks) {
          const kind =
            track.type === TrackType.AUDIO ? "audio" : track.type === TrackType.VIDEO ? "video" : null;
          if (!kind) continue;
          tracks.push({ trackId: track.sid, kind, participantIdentity: participant.identity });
        }
      }
      return tracks;
    },
    async startTrackEgress(input) {
      const info = await egressClient.startTrackEgress(
        input.providerRoomId,
        fileOutput(input.filepath),
        input.trackId
      );
      return info.egressId;
    },
    async stopEgress(egressId) {
      await egressClient.stopEgress(egressId);
    },
    async receiveWebhook(body, authHeader) {
      // Verifies the LiveKit signature (throws on forged/missing — fail-closed), then
      // decodes the SDK envelope into a plain DTO so callers never touch WebhookEvent,
      // protobuf int64, or nanosecond units.
      const event = await webhookReceiver.receive(body, authHeader);
      if (event.event !== "egress_ended" || !event.egressInfo) return { kind: "other" };
      const fileResult = event.egressInfo.fileResults?.[0];
      const storageKey = fileResult?.filename ?? "";
      // FileInfo.size is a protobuf int64; FileInfo.duration is int64 NANOSECONDS.
      const sizeBytes = fileResult?.size ? Number(fileResult.size) : 0;
      const durationSeconds = fileResult?.duration ? Math.round(Number(fileResult.duration) / 1e9) : null;
      // No usable artifact (failed/empty egress) → file:null so callers skip reconcile.
      const file = storageKey && sizeBytes > 0 ? { storageKey, sizeBytes, durationSeconds } : null;
      return { kind: "egress_ended", egressId: event.egressInfo.egressId, file };
    }
  };
}

export function createLiveKitEgressProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env
): LiveKitEgressProvider | null {
  if (env.KISS_PM_VIDEO_PROVIDER !== "livekit") return null;
  if (env.KISS_PM_VIDEO_EGRESS_ENABLED !== "true") return null;
  if (env.KISS_PM_STORAGE_PROVIDER !== "s3") return null;

  const wsUrl = env.KISS_PM_VIDEO_LIVEKIT_URL;
  const apiKey = env.KISS_PM_VIDEO_LIVEKIT_API_KEY;
  const apiSecret = env.KISS_PM_VIDEO_LIVEKIT_API_SECRET;
  const bucket = env.KISS_PM_STORAGE_S3_BUCKET;
  const region = env.KISS_PM_STORAGE_S3_REGION;
  if (!wsUrl || !apiKey || !apiSecret || !bucket || !region) return null;

  return createLiveKitEgressProvider({
    httpUrl: toHttpUrl(wsUrl),
    apiKey,
    apiSecret,
    s3: {
      accessKey: env.KISS_PM_STORAGE_S3_ACCESS_KEY_ID ?? "",
      secret: env.KISS_PM_STORAGE_S3_SECRET_ACCESS_KEY ?? "",
      region,
      endpoint: env.KISS_PM_STORAGE_S3_ENDPOINT ?? "",
      bucket,
      forcePathStyle: true
    }
  });
}
