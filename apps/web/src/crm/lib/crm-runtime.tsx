"use client";

import { createContext, useContext, type ReactNode } from "react";

// Транспорт CRM: 'mock' (Storybook / contract-mock, по умолчанию) vs 'live' (боевой API:
// client без fetchImpl → fetch на /api/* через next.config-прокси, cookie-сессия). Зеркало
// WorkspaceRuntimeProvider/PlanningRuntimeProvider. Прод-routes оборачивают surface в
// <CrmRuntimeProvider live>; stories рендерятся без провайдера → mock, поэтому не ломаются.
type CrmRuntime = { live: boolean };

const CrmRuntimeContext = createContext<CrmRuntime>({ live: false });

export function CrmRuntimeProvider({ live = false, children }: { live?: boolean; children: ReactNode }) {
  return <CrmRuntimeContext.Provider value={{ live }}>{children}</CrmRuntimeContext.Provider>;
}

export function useCrmRuntime(): CrmRuntime {
  return useContext(CrmRuntimeContext);
}
