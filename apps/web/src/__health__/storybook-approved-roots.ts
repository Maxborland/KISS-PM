export const STORYBOOK_APPROVED_ROOTS = [
  "Foundations",
  "Primitives",
  "Composites",
  "Widgets",
  "Screens",
  "Flows",
  "Patterns",
  "API Contract"
] as const;

/** Первый сегмент `title` в `const meta` (object literal или spread + `title`). */
export function extractMetaRoot(source: string): string | null {
  const metaIdx = source.indexOf("const meta");
  if (metaIdx < 0) return null;
  const slice = source.slice(metaIdx, metaIdx + 800);

  const inlineTitle = slice.match(/title:\s*["']([^/"']+)/);
  if (inlineTitle?.[1]) return inlineTitle[1];

  return null;
}
