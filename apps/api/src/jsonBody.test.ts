import { describe, expect, it } from "vitest";
import { readLimitedJsonBody } from "./jsonBody";

function requestContext(request: Request) {
  return {
    req: {
      raw: request
    }
  };
}

describe("limited JSON body reader", () => {
  it("accepts application/json request bodies", async () => {
    const result = await readLimitedJsonBody(
      requestContext(
        new Request("http://127.0.0.1/api/commands", {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({ command: "ok" })
        })
      )
    );

    expect(result).toEqual({ ok: true, value: { command: "ok" } });
  });

  it("accepts structured JSON media types", async () => {
    const result = await readLimitedJsonBody(
      requestContext(
        new Request("http://127.0.0.1/api/commands", {
          method: "POST",
          headers: { "content-type": "application/vnd.kiss-pm.command+json" },
          body: JSON.stringify({ command: "ok" })
        })
      )
    );

    expect(result).toEqual({ ok: true, value: { command: "ok" } });
  });

  it("rejects non-JSON request bodies before parsing", async () => {
    const result = await readLimitedJsonBody(
      requestContext(
        new Request("http://127.0.0.1/api/commands", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: JSON.stringify({ command: "ok" })
        })
      )
    );

    expect(result).toEqual({
      ok: false,
      status: 415,
      error: "unsupported_media_type"
    });
  });

  it("rejects malformed Content-Length before reading the body", async () => {
    const result = await readLimitedJsonBody(
      requestContext(
        new Request("http://127.0.0.1/api/commands", {
          method: "POST",
          headers: {
            "content-length": "12.5",
            "content-type": "application/json"
          },
          body: JSON.stringify({ command: "ok" })
        })
      )
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "invalid_content_length"
    });
  });

  it("accepts zero-padded Content-Length headers", async () => {
    const result = await readLimitedJsonBody(
      requestContext(
        new Request("http://127.0.0.1/api/commands", {
          method: "POST",
          headers: {
            "content-length": "00042",
            "content-type": "application/json"
          },
          body: JSON.stringify({ command: "ok" })
        })
      )
    );

    expect(result).toEqual({ ok: true, value: { command: "ok" } });
  });

  it("rejects Content-Length values above the configured body limit", async () => {
    const result = await readLimitedJsonBody(
      requestContext(
        new Request("http://127.0.0.1/api/commands", {
          method: "POST",
          headers: {
            "content-length": "8",
            "content-type": "application/json"
          },
          body: JSON.stringify({ command: "ok" })
        })
      ),
      null,
      7
    );

    expect(result).toEqual({
      ok: false,
      status: 413,
      error: "payload_too_large"
    });
  });

  it("keeps empty request bodies on the fallback path", async () => {
    const result = await readLimitedJsonBody(
      requestContext(
        new Request("http://127.0.0.1/api/commands", {
          method: "POST"
        })
      ),
      {}
    );

    expect(result).toEqual({ ok: true, value: {} });
  });
});
