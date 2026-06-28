import { createHmac } from "node:crypto";

// Short-lived TURN credentials for standalone coturn (use-auth-secret / REST style):
//   username   = <expiry-unix>:<userId>
//   credential = base64(HMAC-SHA1(shared-secret, username))
// The shared secret stays server-side; credentials are returned once in the response
// and never persisted/audited/logged.

export type TurnCredentials = {
  urls: string[];
  username: string;
  credential: string;
  ttlSeconds: number;
  expiresAt: string;
};

export type TurnConfig = {
  urls: string[];
  sharedSecret: string;
  ttlSeconds: number;
};

const minTtlSeconds = 60;
const maxTtlSeconds = 3600;
const defaultTtlSeconds = 600;

export function parseTurnCredentialTtlSeconds(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return defaultTtlSeconds;
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error("turn_credential_ttl_invalid");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minTtlSeconds || parsed > maxTtlSeconds) {
    throw new Error("turn_credential_ttl_invalid");
  }
  return parsed;
}

export function createTurnConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TurnConfig | null {
  const rawUrls = env.KISS_PM_TURN_URL;
  const sharedSecret = env.KISS_PM_TURN_SHARED_SECRET;
  if (!rawUrls || !sharedSecret) return null;
  if (sharedSecret.trim() !== sharedSecret || sharedSecret.length < 8) {
    throw new Error("turn_shared_secret_invalid");
  }
  const urls = rawUrls
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (urls.length === 0) return null;
  return {
    urls,
    sharedSecret,
    ttlSeconds: parseTurnCredentialTtlSeconds(env.KISS_PM_TURN_CREDENTIAL_TTL_SECONDS)
  };
}

export function issueTurnCredentials(
  config: TurnConfig,
  userId: string,
  nowSeconds: number
): TurnCredentials {
  const expiry = nowSeconds + config.ttlSeconds;
  const username = `${expiry}:${userId}`;
  const credential = createHmac("sha1", config.sharedSecret).update(username).digest("base64");
  return {
    urls: config.urls,
    username,
    credential,
    ttlSeconds: config.ttlSeconds,
    expiresAt: new Date(expiry * 1000).toISOString()
  };
}
