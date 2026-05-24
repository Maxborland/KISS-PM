import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

/** Body / UI шрифт — Inter (нейтральный sans с отличной читаемостью на 12–14px). */
export const fontUi = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--next-font-ui",
  weight: ["400", "500", "600", "700"]
});

/** Display шрифт — Plus Jakarta Sans (геометричный, дружелюбный, для заголовков и tile значений). */
export const fontDisplay = Plus_Jakarta_Sans({
  subsets: ["latin", "cyrillic-ext"],
  display: "swap",
  variable: "--next-font-display",
  weight: ["500", "600", "700", "800"]
});

/** Mono шрифт — JetBrains Mono (mono cell, кнопочные шорткаты, IDS / коды). */
export const fontMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--next-font-mono",
  weight: ["400", "500", "600"]
});

export const FONT_VARIABLES = `${fontUi.variable} ${fontDisplay.variable} ${fontMono.variable}`;
