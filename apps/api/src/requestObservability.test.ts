import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { requestObservabilityMiddleware } from "./requestObservability";

describe("request observability", () => {
  it("propagates safe request ids and emits bounded access logs", async () => {
    const logger = {
      error: vi.fn(),
      info: vi.fn()
    };
    const app = new Hono();
    app.use("*", requestObservabilityMiddleware({ enabled: true, logger }));
    app.get("/health", (context) => context.json({ ok: true }));

    const response = await app.request("/health", {
      headers: {
        "x-request-id": "req-prod-123"
      }
    });

    expect(response.headers.get("x-request-id")).toBe("req-prod-123");
    expect(logger.info).toHaveBeenCalledOnce();
    const payload = JSON.parse(logger.info.mock.calls[0]?.[0] ?? "{}") as {
      method: string;
      path: string;
      requestId: string;
      status: number;
    };
    expect(payload).toMatchObject({
      method: "GET",
      path: "/health",
      requestId: "req-prod-123",
      status: 200
    });
    expect(JSON.stringify(payload)).not.toContain("cookie");
  });
});
