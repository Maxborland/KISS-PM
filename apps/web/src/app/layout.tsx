import type { Metadata, Viewport } from "next";
import "../styles.css";
import "../crm.css";
import "../task.css";
import { AppQueryProvider } from "../queryClient";

export const metadata: Metadata = {
  title: "KISS PM",
  description: "Рабочий контур управления проектами, ролями и audit foundation"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppQueryProvider>{children}</AppQueryProvider>
      </body>
    </html>
  );
}
