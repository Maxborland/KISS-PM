import { parseWorkspaceSearchLimit, parseWorkspaceSearchTypes, normalizeWorkspaceSearchQuery } from "./searchQuery";
import { rankAndLimit } from "./searchScoring";
import type { SearchResult, WorkspaceSearchInput, WorkspaceSearchSource } from "./searchTypes";
import { workspaceSearchSources } from "./workspaceSearchSources";

export type { SearchResult, WorkspaceSearchInput } from "./searchTypes";
export { normalizeWorkspaceSearchQuery, parseWorkspaceSearchLimit, parseWorkspaceSearchTypes } from "./searchQuery";

export async function searchWorkspace(input: WorkspaceSearchInput): Promise<SearchResult[]> {
  const sourceLimit = input.limit * 2;
  const sourceResults = await Promise.all(
    workspaceSearchSources.map((source) => maybeSearch(input, source, sourceLimit))
  );

  return rankAndLimit(sourceResults.flat(), input.limit);
}

async function maybeSearch(
  input: WorkspaceSearchInput,
  source: WorkspaceSearchSource,
  limit: number
): Promise<SearchResult[]> {
  if (input.requestedTypes && !source.sourceTypes.some((type) => input.requestedTypes?.has(type))) return [];
  return source.search(input, limit);
}
