import type { QueryClient } from "@tanstack/react-query";

export function invalidateWorkspaceCapacityQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["workspace-capacity-tree"] });
  void queryClient.invalidateQueries({ queryKey: ["workspace-capacity-summary"] });
}
