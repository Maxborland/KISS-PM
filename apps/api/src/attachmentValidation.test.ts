import { describe, expect, it } from "vitest";

import {
  parseAttachmentId,
  parseAttachmentEntityId,
  parseAttachmentEntityType,
  buildStorageKey,
  parseExternalReferenceUrl,
  parseExternalId,
  parseMetadata,
  parseMimeType,
  parseReferenceTitle,
  parseRelationType,
  sanitizeFileName
} from "./attachmentValidation";

describe("attachment validation", () => {
  it("normalizes unsafe display names without allowing path traversal", () => {
    expect(sanitizeFileName("../brief\\final?.pdf")).toEqual({
      ok: true,
      value: "brief-final-.pdf"
    });
    expect(sanitizeFileName("CON")).toEqual({ ok: true, value: "file-CON" });
    expect(sanitizeFileName("Единый фильтр поиска.txt")).toEqual({
      ok: true,
      value: "Единый фильтр поиска.txt"
    });
    expect(buildStorageKey({
      tenantId: "../tenant-alpha",
      assetId: "asset/1",
      safeDisplayName: "../brief.pdf"
    })).toBe("tenant-alpha/asset-1/brief.pdf");
  });

  it("validates MIME type shape", () => {
    expect(parseMimeType("Application/PDF")).toEqual({ ok: true, value: "application/pdf" });
    expect(parseMimeType("text")).toEqual({ ok: false, error: "mime_type_invalid" });
  });

  it("bounds attachment entity and relation identifiers before persistence", () => {
    expect(parseAttachmentId(" attachment-123e4567-e89b-12d3-a456-426614174000 ")).toEqual({
      ok: true,
      value: "attachment-123e4567-e89b-12d3-a456-426614174000"
    });
    expect(parseAttachmentId("bad..attachment")).toEqual({
      ok: false,
      error: "attachment_id_invalid"
    });
    expect(parseAttachmentId("external-ref-123")).toEqual({
      ok: false,
      error: "attachment_id_invalid"
    });
    expect(parseAttachmentEntityId(" client-alpha ")).toEqual({
      ok: true,
      value: "client-alpha"
    });
    expect(parseAttachmentEntityId("../client-alpha")).toEqual({
      ok: false,
      error: "attachment_entity_id_invalid"
    });
    expect(parseAttachmentEntityId(new File(["x"], "entity.txt"))).toEqual({
      ok: false,
      error: "attachment_entity_id_required"
    });
    expect(parseRelationType(" supporting-doc ")).toEqual({
      ok: true,
      value: "supporting-doc"
    });
    expect(parseRelationType("bad/relation")).toEqual({
      ok: false,
      error: "attachment_relation_type_invalid"
    });
    expect(parseAttachmentEntityType("communication_channel")).toEqual({
      ok: true,
      value: "communication_channel"
    });
    expect(parseAttachmentEntityType("call_room")).toEqual({
      ok: false,
      error: "attachment_entity_type_invalid"
    });
    expect(parseExternalId(" jira:PM-42 ")).toEqual({
      ok: true,
      value: "jira:PM-42"
    });
    expect(parseExternalId("ticket\u0000id")).toEqual({
      ok: false,
      error: "external_id_invalid"
    });
  });

  it("sanitizes external reference metadata as bounded JSON", () => {
    const input = {
      count: 2,
      nested: { ok: true, tags: ["crm", null] },
      source: "contract"
    };

    const result = parseMetadata(input);

    expect(result).toEqual({
      ok: true,
      value: {
        count: 2,
        nested: { ok: true, tags: ["crm", null] },
        source: "contract"
      }
    });
    expect(result.ok ? result.value : undefined).not.toBe(input);
    expect(result.ok ? result.value.nested : undefined).not.toBe(input.nested);
  });

  it("rejects hidden control characters in external reference title and metadata", () => {
    expect(parseReferenceTitle("Contract link")).toEqual({
      ok: true,
      value: "Contract link"
    });
    expect(parseReferenceTitle("Contract\u0000link")).toEqual({
      ok: false,
      error: "external_title_invalid"
    });
    expect(parseMetadata({ "bad\u0000key": "value" })).toEqual({
      ok: false,
      error: "external_metadata_invalid"
    });
    expect(parseMetadata({ source: "crm\u0007link" })).toEqual({
      ok: false,
      error: "external_metadata_invalid"
    });
    expect(parseMetadata({ tags: ["safe", "bad\u001fname"] })).toEqual({
      ok: false,
      error: "external_metadata_invalid"
    });
  });

  it("rejects external reference metadata pollution keys and non-json values", () => {
    const polluted: Record<string, unknown> = {};
    Object.defineProperty(polluted, "__proto__", {
      enumerable: true,
      value: { admin: true }
    });

    expect(parseMetadata(polluted)).toEqual({
      ok: false,
      error: "external_metadata_invalid"
    });
    expect(parseMetadata({ constructor: "Object" })).toEqual({
      ok: false,
      error: "external_metadata_invalid"
    });
    expect(parseMetadata({ date: new Date("2026-05-25T00:00:00.000Z") })).toEqual({
      ok: false,
      error: "external_metadata_invalid"
    });
    expect(parseMetadata({ n: Number.POSITIVE_INFINITY })).toEqual({
      ok: false,
      error: "external_metadata_invalid"
    });
  });

  it("bounds external reference metadata complexity", () => {
    const deep = { a: { b: { c: { d: { e: { f: "too-deep" } } } } } };
    const hugeArray = Array.from({ length: 101 }, (_, index) => index);
    const oversized = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [`key${index}`, "x".repeat(1000)])
    );

    expect(parseMetadata(deep)).toEqual({
      ok: false,
      error: "external_metadata_invalid"
    });
    expect(parseMetadata({ hugeArray })).toEqual({
      ok: false,
      error: "external_metadata_invalid"
    });
    expect(parseMetadata(oversized)).toEqual({
      ok: false,
      error: "external_metadata_too_large"
    });
  });

  it("rejects unsafe external URLs without server-side fetch policy", () => {
    expect(parseExternalReferenceUrl("https://example.test/brief.pdf")).toEqual({
      ok: true,
      value: "https://example.test/brief.pdf"
    });
    expect(parseExternalReferenceUrl("javascript:alert(1)")).toEqual({
      ok: false,
      error: "external_url_invalid"
    });
    expect(parseExternalReferenceUrl("https://user:pass@example.test/brief.pdf")).toEqual({
      ok: false,
      error: "external_url_invalid"
    });
    expect(parseExternalReferenceUrl("http://127.0.0.1:9000/brief.pdf")).toEqual({
      ok: false,
      error: "external_url_private_host"
    });
    expect(parseExternalReferenceUrl("http://files.localhost/brief.pdf")).toEqual({
      ok: false,
      error: "external_url_private_host"
    });
    expect(parseExternalReferenceUrl("http://192.168.1.10/brief.pdf")).toEqual({
      ok: false,
      error: "external_url_private_host"
    });
    expect(parseExternalReferenceUrl("http://[fc00::1]/brief.pdf")).toEqual({
      ok: false,
      error: "external_url_private_host"
    });
    expect(parseExternalReferenceUrl("http://[fe80::1]/brief.pdf")).toEqual({
      ok: false,
      error: "external_url_private_host"
    });
    expect(parseExternalReferenceUrl("http://[::]/brief.pdf")).toEqual({
      ok: false,
      error: "external_url_private_host"
    });
    expect(parseExternalReferenceUrl("http://[0:0:0:0:0:0:0:0]/brief.pdf")).toEqual({
      ok: false,
      error: "external_url_private_host"
    });
    expect(parseExternalReferenceUrl("http://[::ffff:127.0.0.1]/brief.pdf")).toEqual({
      ok: false,
      error: "external_url_private_host"
    });
    expect(parseExternalReferenceUrl("http://[::ffff:8.8.8.8]/brief.pdf")).toEqual({
      ok: true,
      value: "http://[::ffff:808:808]/brief.pdf"
    });
    expect(parseExternalReferenceUrl("http://localhost./brief.pdf")).toEqual({
      ok: false,
      error: "external_url_private_host"
    });
    expect(parseExternalReferenceUrl("https://fc.example.test/brief.pdf")).toEqual({
      ok: true,
      value: "https://fc.example.test/brief.pdf"
    });
  });
});
