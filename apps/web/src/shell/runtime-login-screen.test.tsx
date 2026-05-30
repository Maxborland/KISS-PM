// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RuntimeLoginScreen } from "@/shell/runtime-login-screen";

const replace = vi.fn();

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace })
}));

describe("RuntimeLoginScreen", () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    host.remove();
    vi.restoreAllMocks();
    replace.mockReset();
  });

  it("submits credentials to /api/auth/login from the runtime form", async () => {
    const onAuthenticated = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        user: { id: "usr-admin", tenantId: "tenant-1", name: "Администратор" },
        workspace: { id: "tenant-1" }
      })
    );

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RuntimeLoginScreen mode="protected-route" onAuthenticated={onAuthenticated} />
        </QueryClientProvider>
      );
    });

    const password = host.querySelector<HTMLInputElement>("input[name='password']")!;
    const form = host.querySelector<HTMLFormElement>("form")!;

    await act(async () => {
      password.value = "admin12345";
      password.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" })
    ));
    expect(fetchMock.mock.calls[0]![1]?.body).toBe(
      JSON.stringify({ email: "admin@kiss-pm.local", password: "admin12345" })
    );
    await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
  });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}
