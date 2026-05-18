import { useEffect } from "react";

export function useDocumentThemeClass(theme?: string) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    return () => root.classList.remove("dark");
  }, [theme]);
}
