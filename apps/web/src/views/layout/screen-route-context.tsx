"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ScreenRouteMeta } from "@/shell/navigation-registry";

const ScreenRouteContext = createContext<ScreenRouteMeta | null>(null);

export function ScreenRouteProvider({ meta, children }: { meta: ScreenRouteMeta; children: ReactNode }) {
  return <ScreenRouteContext.Provider value={meta}>{children}</ScreenRouteContext.Provider>;
}

export function useScreenRouteMeta(): ScreenRouteMeta {
  const meta = useContext(ScreenRouteContext);
  if (!meta) {
    throw new Error("useScreenRouteMeta must be used within ScreenRouteProvider");
  }
  return meta;
}
