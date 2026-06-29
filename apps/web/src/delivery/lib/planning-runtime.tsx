"use client";

import { createContext, useContext, type ReactNode } from "react";

// Транспорт планирования: 'mock' (Storybook / contract-mock, изолированная сессия на монтаж)
// vs 'live' (боевой API: planning-client без fetchImpl → fetch на /api/*, который next.config
// проксирует в Hono; cookie-сессия идёт автоматически). По умолчанию mock — чтобы 80 stories
// работали без бэкенда. Прод-routes оборачивают surface в <PlanningRuntimeProvider live>.
type PlanningRuntime = { live: boolean };

const PlanningRuntimeContext = createContext<PlanningRuntime>({ live: false });

export function PlanningRuntimeProvider({ live = false, children }: { live?: boolean; children: ReactNode }) {
  return <PlanningRuntimeContext.Provider value={{ live }}>{children}</PlanningRuntimeContext.Provider>;
}

export function usePlanningRuntime(): PlanningRuntime {
  return useContext(PlanningRuntimeContext);
}
