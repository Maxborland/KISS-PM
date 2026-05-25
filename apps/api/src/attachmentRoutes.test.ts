import { describe, expect, it } from "vitest";

import { readBoundedMultipartRequest } from "./attachmentRoutes";

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
