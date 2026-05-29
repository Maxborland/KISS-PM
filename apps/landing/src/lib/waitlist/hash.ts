import { createHash } from "node:crypto";

/**
 * One-way IP hash so we never persist raw addresses. Salt comes from env so
 * the same IP across deploys can be re-hashed only by someone with the salt.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env["WAITLIST_IP_SALT"]?.trim();
  if (!salt) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
