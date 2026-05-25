import { createHash } from "node:crypto";

import type {
  AttachmentEntityType,
  ExternalReferenceConnectorType,
  FileAssetProvider
} from "@kiss-pm/persistence";

const maxDisplayNameLength = 180;
const maxUrlLength = 1200;

export const attachmentEntityTypes = [
  "opportunity",
  "client",
  "contact",
  "product",
  "project",
  "task"
] as const satisfies readonly AttachmentEntityType[];

export const externalReferenceConnectorTypes = [
  "manual_link",
  "bitrix24",
  "amocrm",
  "jira",
  "slack",
  "email",
  "s3",
  "local",
  "other"
] as const satisfies readonly ExternalReferenceConnectorType[];

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseAttachmentEntityType(value: unknown): ParseResult<AttachmentEntityType> {
  if (typeof value !== "string") return { ok: false, error: "attachment_entity_type_invalid" };
  if (attachmentEntityTypes.includes(value as AttachmentEntityType)) {
    return { ok: true, value: value as AttachmentEntityType };
  }
  return { ok: false, error: "attachment_entity_type_invalid" };
}

export function parseConnectorType(
  value: unknown
): ParseResult<ExternalReferenceConnectorType> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: "manual_link" };
  }
  if (
    typeof value === "string" &&
    externalReferenceConnectorTypes.includes(value as ExternalReferenceConnectorType)
  ) {
    return { ok: true, value: value as ExternalReferenceConnectorType };
  }
  return { ok: false, error: "connector_type_invalid" };
}

export function sanitizeFileName(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "file_name_required" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "file_name_required" };
  const withoutControl = trimmed.replace(/[\u0000-\u001f\u007f]/g, "");
  const normalized = withoutControl
    .replace(/[\\/]+/g, "-")
    .replace(/\.\.+/g, ".")
    .replace(/[<>:"|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized === "." || normalized === "..") {
    return { ok: false, error: "file_name_invalid" };
  }
  return { ok: true, value: normalized.slice(0, maxDisplayNameLength) };
}

export function parseMimeType(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "mime_type_required" };
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "mime_type_required" };
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(trimmed)) {
    return { ok: false, error: "mime_type_invalid" };
  }
  return { ok: true, value: trimmed };
}

export function parsePositiveSize(value: number, maxBytes: number): ParseResult<number> {
  if (!Number.isInteger(value) || value <= 0) return { ok: false, error: "file_empty" };
  if (value > maxBytes) return { ok: false, error: "file_too_large" };
  return { ok: true, value };
}

export function parseExternalReferenceUrl(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "external_url_required" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "external_url_required" };
  if (trimmed.length > maxUrlLength) return { ok: false, error: "external_url_too_long" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "external_url_invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "external_url_invalid" };
  }
  if (url.username || url.password) {
    return { ok: false, error: "external_url_invalid" };
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, error: "external_url_private_host" };
  }
  return { ok: true, value: url.toString() };
}

export function parseReferenceTitle(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "external_title_required" };
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "external_title_required" };
  return { ok: true, value: trimmed.slice(0, maxDisplayNameLength) };
}

export function parseMetadata(value: unknown): ParseResult<Record<string, unknown>> {
  if (value === undefined || value === null) return { ok: true, value: {} };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "external_metadata_invalid" };
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > 8192) return { ok: false, error: "external_metadata_too_large" };
  return { ok: true, value: value as Record<string, unknown> };
}

export function buildStorageKey(input: {
  tenantId: string;
  assetId: string;
  safeDisplayName: string;
}): string {
  const suffix = input.safeDisplayName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${input.tenantId}/${input.assetId}/${suffix}`;
}

export function parseStorageProvider(value: string | undefined): FileAssetProvider {
  return value === "s3" ? "s3" : "local";
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isBlockedHost(hostname: string): boolean {
  const trimmed = hostname.toLowerCase().replace(/\.+$/g, "");
  const normalized = trimmed.replace(/^\[|\]$/g, "");
  const isIpv6Literal = normalized.includes(":");
  const mappedIpv4Parts = parseMappedIpv4Parts(normalized);
  if (mappedIpv4Parts) return isBlockedIpv4Parts(mappedIpv4Parts);
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:0" ||
    normalized === "0:0:0:0:0:0:0:1"
  ) {
    return true;
  }
  if (
    (isIpv6Literal && normalized.startsWith("fc")) ||
    (isIpv6Literal && normalized.startsWith("fd")) ||
    (isIpv6Literal && /^fe[89ab]/.test(normalized))
  ) {
    return true;
  }

  const ipv4Match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;
  const parts = ipv4Match.slice(1).map(Number);
  return isBlockedIpv4Parts(parts);
}

function parseMappedIpv4Parts(normalizedHostname: string): number[] | null {
  if (!normalizedHostname.startsWith("::ffff:")) return null;
  const tail = normalizedHostname.slice("::ffff:".length);
  const dotted = tail.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) return dotted.slice(1).map(Number);

  const hexParts = tail.split(":");
  if (hexParts.length !== 2) return null;
  const high = Number.parseInt(hexParts[0] ?? "", 16);
  const low = Number.parseInt(hexParts[1] ?? "", 16);
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return null;
  }

  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function isBlockedIpv4Parts(parts: number[]): boolean {
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const first = parts[0] ?? -1;
  const second = parts[1] ?? -1;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    first === 0
  );
}
