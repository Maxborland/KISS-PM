import { createHash } from "node:crypto";

import type {
  AttachmentEntityType,
  ExternalReferenceConnectorType,
  FileAssetProvider
} from "@kiss-pm/persistence";

const maxDisplayNameLength = 180;
const maxUrlLength = 1200;
const maxAttachmentIdLength = 240;
const maxEntityIdLength = 200;
const maxExternalIdLength = 240;
const maxRelationTypeLength = 80;
const maxMetadataLength = 8192;
const maxMetadataDepth = 5;
const maxMetadataEntries = 100;
const maxMetadataArrayItems = 100;
const maxMetadataKeyLength = 120;
const maxMetadataStringLength = 1000;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;
const windowsReservedNames = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9"
]);
const blockedMetadataKeys = new Set(["__proto__", "prototype", "constructor"]);

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

type JsonMetadataValue =
  | string
  | number
  | boolean
  | null
  | JsonMetadataValue[]
  | { [key: string]: JsonMetadataValue };

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
  const normalized = normalizeFileSegment(trimmed).replace(/\s+/g, " ");
  if (!normalized || normalized === "." || normalized === "..") {
    return { ok: false, error: "file_name_invalid" };
  }
  return { ok: true, value: normalized.slice(0, maxDisplayNameLength) };
}

export function parseAttachmentId(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "attachment_id_required" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "attachment_id_required" };
  if (
    trimmed.length > maxAttachmentIdLength ||
    /[\u0000-\u001f\u007f]/.test(trimmed) ||
    /[\\/]/.test(trimmed) ||
    trimmed.includes("..") ||
    !/^attachment(?:-task)?-[a-zA-Z0-9._:-]+$/.test(trimmed)
  ) {
    return { ok: false, error: "attachment_id_invalid" };
  }
  return { ok: true, value: trimmed };
}

export function parseAttachmentEntityId(value: unknown): ParseResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "attachment_entity_id_required" };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "attachment_entity_id_required" };
  if (
    trimmed.length > maxEntityIdLength ||
    /[\u0000-\u001f\u007f]/.test(trimmed) ||
    /[\\/]/.test(trimmed) ||
    trimmed.includes("..")
  ) {
    return { ok: false, error: "attachment_entity_id_invalid" };
  }
  return { ok: true, value: trimmed };
}

export function parseRelationType(value: unknown): ParseResult<string> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: "attachment" };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "attachment_relation_type_invalid" };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "attachment" };
  if (
    trimmed.length > maxRelationTypeLength ||
    /[\u0000-\u001f\u007f]/.test(trimmed) ||
    !/^[a-zA-Z0-9._:-]+$/.test(trimmed)
  ) {
    return { ok: false, error: "attachment_relation_type_invalid" };
  }
  return { ok: true, value: trimmed };
}

export function parseExternalId(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "external_id_invalid" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (
    trimmed.length > maxExternalIdLength ||
    /[\u0000-\u001f\u007f]/.test(trimmed) ||
    /[\\/]/.test(trimmed) ||
    trimmed.includes("..")
  ) {
    return { ok: false, error: "external_id_invalid" };
  }
  return { ok: true, value: trimmed };
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
  if (controlCharacterPattern.test(value)) {
    return { ok: false, error: "external_title_invalid" };
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "external_title_required" };
  return { ok: true, value: trimmed.slice(0, maxDisplayNameLength) };
}

export function parseMetadata(value: unknown): ParseResult<Record<string, unknown>> {
  if (value === undefined || value === null) return { ok: true, value: {} };
  const sanitized = sanitizeMetadataRecord(value, 0);
  if (!sanitized.ok) return sanitized;
  const serialized = stringifyMetadata(sanitized.value);
  if (!serialized.ok) return serialized;
  if (serialized.value.length > maxMetadataLength) {
    return { ok: false, error: "external_metadata_too_large" };
  }
  return { ok: true, value: sanitized.value };
}

export function buildStorageKey(input: {
  tenantId: string;
  assetId: string;
  safeDisplayName: string;
}): string {
  const tenantSegment = normalizeFileSegment(input.tenantId) || "tenant";
  const assetSegment = normalizeFileSegment(input.assetId) || "asset";
  const suffix = normalizeFileSegment(input.safeDisplayName) || "download";
  return `${tenantSegment}/${assetSegment}/${suffix}`;
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

function normalizeFileSegment(value: string): string {
  const withoutControl = value.replace(/[\u0000-\u001f\u007f]/g, "");
  const normalized = withoutControl
    .replace(/[\\/]+/g, "-")
    .replace(/\.\.+/g, ".")
    .replace(/[<>:"|?*]/g, "-")
    .replace(/[^\p{L}\p{N}._\-\s]+/gu, "-")
    .replace(/^[.\-\s]+/g, "")
    .replace(/[.\-\s]+$/g, "")
    .replace(/-+/g, "-")
    .trim();
  if (!normalized || normalized === "." || normalized === "..") return "";
  const baseName = normalized.split(".")[0]?.toLowerCase() ?? "";
  if (windowsReservedNames.has(baseName)) return `file-${normalized}`;
  return normalized;
}

function sanitizeMetadataRecord(
  value: unknown,
  depth: number
): ParseResult<Record<string, JsonMetadataValue>> {
  if (!isPlainRecord(value) || depth >= maxMetadataDepth) {
    return { ok: false, error: "external_metadata_invalid" };
  }
  const entries = Object.entries(value);
  if (entries.length > maxMetadataEntries) {
    return { ok: false, error: "external_metadata_invalid" };
  }

  const sanitized: Record<string, JsonMetadataValue> = {};
  for (const [key, rawValue] of entries) {
    if (
      !key ||
      key.length > maxMetadataKeyLength ||
      controlCharacterPattern.test(key) ||
      blockedMetadataKeys.has(key)
    ) {
      return { ok: false, error: "external_metadata_invalid" };
    }
    const parsedValue = sanitizeMetadataValue(rawValue, depth + 1);
    if (!parsedValue.ok) return parsedValue;
    sanitized[key] = parsedValue.value;
  }
  return { ok: true, value: sanitized };
}

function sanitizeMetadataValue(
  value: unknown,
  depth: number
): ParseResult<JsonMetadataValue> {
  if (value === null || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "string") {
    if (value.length > maxMetadataStringLength || controlCharacterPattern.test(value)) {
      return { ok: false, error: "external_metadata_invalid" };
    }
    return { ok: true, value };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, error: "external_metadata_invalid" };
    return { ok: true, value };
  }
  if (Array.isArray(value)) {
    if (depth >= maxMetadataDepth || value.length > maxMetadataArrayItems) {
      return { ok: false, error: "external_metadata_invalid" };
    }
    const items: JsonMetadataValue[] = [];
    for (const item of value) {
      const parsedItem = sanitizeMetadataValue(item, depth + 1);
      if (!parsedItem.ok) return parsedItem;
      items.push(parsedItem.value);
    }
    return { ok: true, value: items };
  }
  return sanitizeMetadataRecord(value, depth);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stringifyMetadata(value: Record<string, JsonMetadataValue>): ParseResult<string> {
  try {
    return { ok: true, value: JSON.stringify(value) };
  } catch {
    return { ok: false, error: "external_metadata_invalid" };
  }
}
