import { createHash } from "node:crypto";

let warnedMissingSalt = false;

/**
 * One-way IP hash so we never persist raw addresses. Salt comes from env so
 * the same IP across deploys can be re-hashed only by someone with the salt.
 * The old fallback literal was public (this repo), so hashes with it were
 * brute-forceable: in production without a salt we now store null instead
 * and log loudly — a missing hash is honest, a fake-anonymous one is not.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env["WAITLIST_IP_SALT"]?.trim();
  if (salt) {
    return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
  }
  if (import.meta.env.PROD) {
    if (!warnedMissingSalt) {
      warnedMissingSalt = true;
      console.error(
        "[waitlist] WAITLIST_IP_SALT is not set — storing ip_hash=null. Set it (see .env.example).",
      );
    }
    return null;
  }
  return createHash("sha256").update(`kiss-pm-dev:${ip}`).digest("hex").slice(0, 32);
}
