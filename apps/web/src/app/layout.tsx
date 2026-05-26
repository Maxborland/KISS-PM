import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FONT_VARIABLES } from "./fonts";
import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "KISS PM",
  description: "Управление проектами, ресурсами и контролем"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={FONT_VARIABLES} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
