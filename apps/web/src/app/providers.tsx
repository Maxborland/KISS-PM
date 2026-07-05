"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Сохранённые в профиле тема/акцент применяются на ЛЮБОЙ странице при загрузке
// (раньше data-theme ставил только экран профиля — остальное приложение
// оставалось светлым даже после перезагрузки, G2-14). Аноним/Storybook → no-op.
function ProfileThemeSync() {
  useEffect(() => {
    let alive = true;
    void fetch("/api/auth/me", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: { theme?: unknown; accentColor?: unknown } } | null) => {
        if (!alive || !d?.user) return;
        const root = document.documentElement;
        if (d.user.theme === "dark" || d.user.theme === "light") root.dataset.theme = d.user.theme;
        if (typeof d.user.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(d.user.accentColor)) {
          root.style.setProperty("--accent", d.user.accentColor);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return null;
}

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1
          }
        }
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <ProfileThemeSync />
          {children}
          <Toaster richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
