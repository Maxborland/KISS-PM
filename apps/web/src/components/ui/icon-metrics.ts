/** Lucide sizing baseline for design-v3 (Phase 2). */
export const ICON_STROKE = 1.75 as const;

export const ICON_SIZE = {
  sm: 14,
  md: 16,
  lg: 20
} as const;

export type IconSizeKey = keyof typeof ICON_SIZE;
