/** Surfaces rendered with static mocks until backend is connected (see ARCHITECTURE-DECISIONS §5). */
export const UI_ONLY_PREVIEW_SURFACES = [
  "kpi",
  "audit",
  "baseline",
  "scenarios",
  "notificationCenter"
] as const;

export type UiOnlyPreviewSurface = (typeof UI_ONLY_PREVIEW_SURFACES)[number];

export function isUiOnlyPreview(surface: UiOnlyPreviewSurface): boolean {
  return UI_ONLY_PREVIEW_SURFACES.includes(surface);
}

export const UI_ONLY_PREVIEW_BANNER_TEXT = "Preview — backend не подключён";
