/** WCAG contrast helpers for Foundations/Colors (preview only). */

function channelLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channelLinear(r) + 0.7152 * channelLinear(g) + 0.0722 * channelLinear(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastBadge = "AAA" | "AA" | "—";

export function contrastBadge(ratio: number): ContrastBadge {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  return "—";
}

/** Best text on solid swatch: white or near-black. */
export function bestTextContrast(swatchHex: string): { ratio: number; badge: ContrastBadge; on: "#ffffff" | "#0f172a" } {
  const onWhite = contrastRatio("#ffffff", swatchHex);
  const onDark = contrastRatio("#0f172a", swatchHex);
  if (onWhite >= onDark) {
    return { ratio: onWhite, badge: contrastBadge(onWhite), on: "#ffffff" };
  }
  return { ratio: onDark, badge: contrastBadge(onDark), on: "#0f172a" };
}
