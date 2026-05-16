import { type ReactElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { createAppQueryClient } from "./queryClient";

export function withTestQueryClient(element: ReactElement): ReactElement {
  return <QueryClientProvider client={createAppQueryClient({ testMode: true })}>{element}</QueryClientProvider>;
}
