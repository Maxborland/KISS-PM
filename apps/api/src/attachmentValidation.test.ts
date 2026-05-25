import { describe, expect, it } from "vitest";

import {
  buildStorageKey,
  parseExternalReferenceUrl,
  parseMimeType,
  sanitizeFileName
} from "./attachmentValidation";

describe("attachment validation", () => {
  it("normalizes unsafe display names without allowing path traversal", () => {
    expect(sanitizeFileName("../brief\\final?.pdf")).toEqual({
      ok: true,
      value: ".-brief-final-.pdf"
    });
    expect(buildStorageKey({
      tenantId: "tenant-alpha",
      assetId: "asset-1",
      safeDisplayName: "../brief.pdf"
    })).toBe("tenant-alpha/asset-1/..-brief.pdf");
  });

  it("validates MIME type shape", () => {
    expect(parseMimeType("Application/PDF")).toEqual({ ok: true, value: "application/pdf" });
    expect(parseMimeType("text")).toEqual({ ok: false, error: "mime_type_invalid" });
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
