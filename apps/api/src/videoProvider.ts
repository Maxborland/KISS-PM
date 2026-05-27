import { createHmac, randomUUID } from "node:crypto";

export type VideoProviderKind = "disabled" | "manual" | "jitsi" | "livekit";

export type VideoProviderConfig =
  | { kind: "disabled" }
  | { kind: "manual"; baseUrl: string; allowInsecureHttp?: boolean }
  | { kind: "jitsi"; baseUrl: string; allowInsecureHttp?: boolean }
  | {
      kind: "livekit";
      url: string;
      apiKey: string;
      apiSecret: string;
      tokenTtlSeconds?: number;
      allowInsecureHttp?: boolean;
    };

export type IssueJoinTokenInput = {
  tenantId: string;
  roomId: string;
  providerRoomId: string;
  userId: string;
  userName: string;
};

export type VideoJoinContract = {
  provider: Exclude<VideoProviderKind, "disabled">;
  joinUrl: string;
  token: string | null;
  expiresAt: string | null;
};

export type VideoProvider = {
  kind: VideoProviderKind;
  issueJoinToken(input: IssueJoinTokenInput): Promise<VideoJoinContract>;
};

const defaultTokenTtlSeconds = 10 * 60;
const maxTokenTtlSeconds = 60 * 60;

export function createVideoProviderFromEnv(env: NodeJS.ProcessEnv = process.env): VideoProvider {
  const kind = parseProviderKind(env.KISS_PM_VIDEO_PROVIDER);
  const allowInsecureHttp =
    env.KISS_PM_VIDEO_ALLOW_INSECURE_HTTP === "true" && env.NODE_ENV !== "production";
  if (kind === "manual") {
    return createVideoProvider({
      kind,
      allowInsecureHttp,
      baseUrl: requiredEnvUrl(env.KISS_PM_VIDEO_MANUAL_BASE_URL, allowInsecureHttp)
    });
  }
  if (kind === "jitsi") {
    return createVideoProvider({
      kind,
      allowInsecureHttp,
      baseUrl: requiredEnvUrl(env.KISS_PM_VIDEO_JITSI_BASE_URL, allowInsecureHttp)
    });
  }
  if (kind === "livekit") {
    const tokenTtlSeconds = parsePositiveInt(env.KISS_PM_VIDEO_TOKEN_TTL_SECONDS);
    return createVideoProvider({
      kind,
      allowInsecureHttp,
      url: requiredEnvUrl(env.KISS_PM_VIDEO_LIVEKIT_URL, allowInsecureHttp),
      apiKey: requiredSecret(env.KISS_PM_VIDEO_LIVEKIT_API_KEY),
      apiSecret: requiredSecret(env.KISS_PM_VIDEO_LIVEKIT_API_SECRET),
      ...(tokenTtlSeconds === undefined ? {} : { tokenTtlSeconds })
    });
  }
  return createVideoProvider({ kind: "disabled" });
}

export function createVideoProvider(config: VideoProviderConfig): VideoProvider {
  if (config.kind === "disabled") {
    return {
      kind: "disabled",
      async issueJoinToken() {
        throw new Error("video_provider_disabled");
      }
    };
  }

  if (config.kind === "manual" || config.kind === "jitsi") {
    const baseUrl = normalizeBaseUrl(config.baseUrl, {
      allowInsecureHttp: config.allowInsecureHttp ?? true
    });
    return {
      kind: config.kind,
      async issueJoinToken(input) {
        return {
          provider: config.kind,
          joinUrl: joinUrl(baseUrl, input.providerRoomId),
          token: null,
          expiresAt: null
        };
      }
    };
  }

  const ttlSeconds = boundedTtl(config.tokenTtlSeconds);
  const url = normalizeBaseUrl(config.url, {
    allowInsecureHttp: config.allowInsecureHttp ?? true
  });
  return {
    kind: "livekit",
    async issueJoinToken(input) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiresAtSeconds = nowSeconds + ttlSeconds;
      const jwt = signHs256Jwt(
        {
          alg: "HS256",
          typ: "JWT"
        },
        {
          iss: config.apiKey,
          sub: input.userId,
          name: input.userName,
          nbf: nowSeconds - 5,
          exp: expiresAtSeconds,
          jti: randomUUID(),
          metadata: JSON.stringify({
            tenantId: input.tenantId,
            kissPmRoomId: input.roomId
          }),
          video: {
            room: input.providerRoomId,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true
          }
        },
        config.apiSecret
      );
      return {
        provider: "livekit",
        joinUrl: url,
        token: jwt,
        expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
      };
    }
  };
}

function parseProviderKind(value: string | undefined): VideoProviderKind {
  if (value === "manual" || value === "jitsi" || value === "livekit") return value;
  return "disabled";
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function boundedTtl(value: number | undefined): number {
  return Math.min(Math.max(value ?? defaultTokenTtlSeconds, 60), maxTokenTtlSeconds);
}

function requiredEnvUrl(value: string | undefined, allowInsecureHttp: boolean): string {
  if (!value) throw new Error("video_provider_misconfigured");
  return normalizeBaseUrl(value, { allowInsecureHttp });
}

function requiredSecret(value: string | undefined): string {
  if (!value || value.length < 8) throw new Error("video_provider_misconfigured");
  return value;
}

function normalizeBaseUrl(
  value: string,
  options: { allowInsecureHttp: boolean }
): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("video_provider_misconfigured");
  }
  if (url.protocol === "http:" && !options.allowInsecureHttp) {
    throw new Error("video_provider_insecure_url");
  }
  if (url.username || url.password) {
    throw new Error("video_provider_misconfigured");
  }
  url.username = "";
  url.password = "";
  return url.toString().replace(/\/$/, "");
}

function joinUrl(baseUrl: string, providerRoomId: string): string {
  return `${baseUrl}/${encodeURIComponent(providerRoomId)}`;
}

function signHs256Jwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  secret: string
): string {
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
