"use client";

import { createContext, useContext, type ReactNode } from "react";

import { PlanningPreviewGateProvider } from "./planning-preview-gate";

export type PlanningRuntimeFetch = typeof fetch;

type PlanningRuntime = { live: boolean; fetchImpl: PlanningRuntimeFetch | null };

const PlanningRuntimeContext = createContext<PlanningRuntime>({ live: true, fetchImpl: null });

export function PlanningRuntimeProvider({
  live = true,
  fetchImpl = null,
  children
}: {
  live?: boolean;
  fetchImpl?: PlanningRuntimeFetch | null;
  children: ReactNode;
}) {
  return (
    <PlanningRuntimeContext.Provider value={{ live, fetchImpl }}>
      <PlanningPreviewGateProvider>{children}</PlanningPreviewGateProvider>
    </PlanningRuntimeContext.Provider>
  );
}

export function usePlanningRuntime(): PlanningRuntime {
  return useContext(PlanningRuntimeContext);
}
