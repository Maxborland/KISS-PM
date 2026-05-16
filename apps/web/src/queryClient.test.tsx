import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useQuery } from "@tanstack/react-query";

import { AppQueryClientProvider, createAppQueryClient } from "./queryClient";

function QueryProbe() {
  const result = useQuery({
    queryKey: ["query-client-probe"],
    queryFn: async () => "query-ready"
  });

  return <span data-testid="query-client-probe">{result.data ?? result.status}</span>;
}

describe("query client foundation", () => {
  it("creates deterministic test clients with query and mutation retries disabled", () => {
    const client = createAppQueryClient({ testMode: true });

    expect(client.getDefaultOptions().queries?.retry).toBe(false);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("provides TanStack Query context to app surfaces", async () => {
    render(
      <AppQueryClientProvider>
        <QueryProbe />
      </AppQueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("query-client-probe")).toHaveTextContent("query-ready"));
  });
});
