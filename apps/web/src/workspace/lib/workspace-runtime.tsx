"use client";

import { createContext, useContext, type ReactNode } from "react";

// Транспорт workspace: 'mock' (Storybook / contract-mock, по умолчанию) vs 'live' (боевой API:
// client без fetchImpl → fetch на /api/* через next.config-прокси, cookie-сессия). Зеркало
// PlanningRuntimeProvider. Прод-routes оборачивают surface в <WorkspaceRuntimeProvider live>;
// stories рендерятся без провайдера → mock, поэтому не ломаются.
type WorkspaceRuntime = { live: boolean };

const WorkspaceRuntimeContext = createContext<WorkspaceRuntime>({ live: false });

export function WorkspaceRuntimeProvider({ live = false, children }: { live?: boolean; children: ReactNode }) {
  return <WorkspaceRuntimeContext.Provider value={{ live }}>{children}</WorkspaceRuntimeContext.Provider>;
}

export function useWorkspaceRuntime(): WorkspaceRuntime {
  return useContext(WorkspaceRuntimeContext);
}
