import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type CreateAppQueryClientOptions = {
  testMode?: boolean;
};

export function createAppQueryClient(options: CreateAppQueryClientOptions = {}): QueryClient {
  const testMode = options.testMode ?? import.meta.env.MODE === "test";

  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: testMode ? false : 2,
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: false
      }
    }
  });
}

export function AppQueryClientProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
