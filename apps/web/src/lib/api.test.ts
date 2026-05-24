import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api";

describe("apiFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns top-level array and primitive JSON payloads unchanged", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{ id: "task-1" }])));
    await expect(apiFetch<Array<{ id: string }>>("/api/tasks")).resolves.toEqual([{ id: "task-1" }]);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify("ready")));
    await expect(apiFetch<string>("/api/status")).resolves.toBe("ready");
  });

  it("preserves caller headers from Headers instances", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    await apiFetch<{ ok: boolean }>("/api/tasks", {
      headers: new Headers({ "x-correlation-id": "trace-1" })
    });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get("x-correlation-id")).toBe("trace-1");
    expect((init?.headers as Headers).get("x-kiss-pm-action")).toBe("same-origin");
  });

  it("keeps object error bodies available for ApiError mapping", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "forbidden", message: "Нет доступа" }), { status: 403 })
    );

    await expect(apiFetch("/api/tasks")).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
      message: "Нет доступа",
      body: { error: "forbidden", message: "Нет доступа" }
    });
  });
});
