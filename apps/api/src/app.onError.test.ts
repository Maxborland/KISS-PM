import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import type { RequestLogger } from "./requestObservability";

describe("createApp onError structured logging", () => {
  it("logs error.message + stack + requestId through the logger and returns internal_error", async () => {
    const logger: RequestLogger = { info: vi.fn(), error: vi.fn() };
    const app = createApp({ errorLogger: logger });
    app.get("/api/test/onerror-boom", () => {
      throw new Error("boom internal detail");
    });

    const response = await app.request("/api/test/onerror-boom", {
      headers: { "x-request-id": "req-onerror-1" }
    });

    // Клиентский контракт не меняется: generic-ответ и статус 500.
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "internal_error" });

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [payload] = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    const logged = JSON.parse(payload) as {
      level: string;
      message: string;
      requestId: string;
      stack?: string;
    };
    expect(logged.level).toBe("error");
    expect(logged.message).toBe("boom internal detail");
    expect(logged.requestId).toBe("req-onerror-1");
    expect(logged.stack).toContain("boom internal detail");
  });
});
