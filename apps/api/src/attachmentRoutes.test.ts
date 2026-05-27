import { describe, expect, it } from "vitest";

import {
  createUploadConcurrencyLimiter,
  parseContentLength,
  parseMultipartContentType,
  readBoundedMultipartRequest
} from "./attachmentUploadRequest";

describe("attachment route request bounds", () => {
  it("rejects streamed multipart bodies before materializing an oversized form", async () => {
    const request = streamedRequest([new Uint8Array(4), new Uint8Array(4)]);

    await expect(readBoundedMultipartRequest(request, 7)).resolves.toEqual({
      ok: false,
      status: 413,
      error: "file_too_large"
    });
  });

  it("rebuilds an under-limit streamed request for form parsing", async () => {
    const request = streamedRequest([new TextEncoder().encode("hello")]);
    const result = await readBoundedMultipartRequest(request, 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      await expect(result.request.text()).resolves.toBe("hello");
    }
  });

  it("rejects malformed upload content-length values before body reads", () => {
    expect(parseContentLength(undefined)).toEqual({ ok: true, value: null });
    expect(parseContentLength("0")).toEqual({ ok: true, value: 0 });
    expect(parseContentLength("00042")).toEqual({ ok: true, value: 42 });
    expect(parseContentLength("42")).toEqual({ ok: true, value: 42 });
    expect(parseContentLength("10.5")).toEqual({ ok: false, error: "content_length_invalid" });
    expect(parseContentLength("-1")).toEqual({ ok: false, error: "content_length_invalid" });
    expect(parseContentLength("1e3")).toEqual({ ok: false, error: "content_length_invalid" });
    expect(parseContentLength("999999999999999999999999")).toEqual({
      ok: false,
      error: "content_length_invalid"
    });
  });

  it("requires a bounded multipart/form-data content type for uploads", () => {
    expect(parseMultipartContentType("multipart/form-data; boundary=----kisspm")).toEqual({
      ok: true
    });
    expect(parseMultipartContentType("Multipart/Form-Data; boundary=\"quoted\"")).toEqual({
      ok: true
    });
    expect(parseMultipartContentType(undefined)).toEqual({
      ok: false,
      error: "unsupported_media_type"
    });
    expect(parseMultipartContentType("application/x-www-form-urlencoded")).toEqual({
      ok: false,
      error: "unsupported_media_type"
    });
    expect(parseMultipartContentType("multipart/form-data")).toEqual({
      ok: false,
      error: "unsupported_media_type"
    });
    expect(parseMultipartContentType("multipart/form-data; boundary=bad\u0000value")).toEqual({
      ok: false,
      error: "unsupported_media_type"
    });
  });

  it("limits concurrent uploads per actor key and releases capacity", () => {
    const limiter = createUploadConcurrencyLimiter(2);
    const first = limiter.tryAcquire("tenant:user");
    const second = limiter.tryAcquire("tenant:user");
    const third = limiter.tryAcquire("tenant:user");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third).toEqual({ ok: false });
    if (first.ok) first.release();

    expect(limiter.tryAcquire("tenant:user").ok).toBe(true);
  });
});

function streamedRequest(chunks: Uint8Array[]): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });

  return new Request("http://localhost/api/workspace/attachments/files", {
    body,
    duplex: "half",
    method: "POST"
  } as RequestInit & { duplex: "half" });
}
