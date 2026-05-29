import { afterEach, describe, expect, it, vi } from "vitest";

import { loginWithPassword } from "@/lib/api/auth";

describe("runtime auth login API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts credentials to the documented login endpoint through apiFetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        user: { id: "usr-1", tenantId: "tenant-1", name: "Администратор" },
        workspace: { id: "tenant-1" }
      })
    );

    await expect(
      loginWithPassword({ email: "admin@kiss-pm.local", password: "admin12345" })
    ).resolves.toMatchObject({ workspace: { id: "tenant-1" } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe("/api/auth/login");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("same-origin");
    expect((init?.headers as Headers).get("content-type")).toBe("application/json");
    expect((init?.headers as Headers).get("x-kiss-pm-action")).toBe("same-origin");
    expect(init?.body).toBe(
      JSON.stringify({ email: "admin@kiss-pm.local", password: "admin12345" })
    );
  });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}
