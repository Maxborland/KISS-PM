import type { SearchResult } from "./searchTypes";

export function matches(query: string, ...values: Array<string | null | undefined>): boolean {
  return values.some((value) => value?.toLowerCase().includes(query));
}

export function score(query: string, ...values: string[]): number {
  let best = 0;
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (normalized === query) best = Math.max(best, 100);
    else if (normalized.startsWith(query)) best = Math.max(best, 80);
    else if (normalized.includes(query)) best = Math.max(best, 50);
  }
  return best;
}

export function rankAndLimit(results: SearchResult[], limit: number): SearchResult[] {
  return results
    .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}
