"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isPublicAuthPath } from "@/shell/use-session-user";
import { applyDocumentTheme } from "@/lib/document-theme";

// Сохранённые в профиле тема/акцент применяются на ЛЮБОЙ странице при загрузке
// (раньше data-theme ставил только экран профиля — остальное приложение
// оставалось светлым даже после перезагрузки, G2-14). Аноним/Storybook → no-op.
function ProfileThemeSync() {
  useEffect(() => {
    // Анонимные страницы: сессии нет — не создаём 401-шум в консоли (G1-AUTH-13).
    if (isPublicAuthPath(window.location.pathname)) return;
    let alive = true;
    void fetch("/api/auth/me", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: { theme?: unknown; accentColor?: unknown } } | null) => {
        if (!alive || !d?.user) return;
        applyDocumentTheme(d.user);
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <ProfileThemeSync />
        {children}
        <Toaster richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
