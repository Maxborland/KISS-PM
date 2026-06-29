"use client";

import { createContext, useContext, type ReactNode } from "react";

// Транспорт блока «Коммуникации»: 'mock' (Storybook / contract-mock, изолированный
// in-memory стор, по умолчанию) vs 'live' (боевой API: createCommsClient без fetchImpl →
// fetch на /api/workspace/*, который next.config проксирует в Hono; cookie-сессия идёт
// автоматически). По умолчанию mock — чтобы stories работали без бэкенда. Прод-routes
// оборачивают surface в <CommsRuntimeProvider live>; stories рендерятся без провайдера →
// mock, поэтому не ломаются. Зеркало WorkspaceRuntimeProvider/PlanningRuntimeProvider.
type CommsRuntime = { live: boolean };

const CommsRuntimeContext = createContext<CommsRuntime>({ live: false });

export function CommsRuntimeProvider({ live = false, children }: { live?: boolean; children: ReactNode }) {
  return <CommsRuntimeContext.Provider value={{ live }}>{children}</CommsRuntimeContext.Provider>;
}

export function useCommsRuntime(): CommsRuntime {
  return useContext(CommsRuntimeContext);
}
