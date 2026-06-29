"use client";

import { createContext, useContext, type ReactNode } from "react";

// Транспорт администрирования: 'mock' (Storybook / contract-mock, по умолчанию) vs 'live'
// (боевой API: client без fetchImpl → fetch на /api/* через next.config-прокси, cookie-сессия).
// Зеркало WorkspaceRuntimeProvider/PlanningRuntimeProvider. Прод-routes оборачивают surface в
// <AdminRuntimeProvider live>; stories рендерятся без провайдера → mock, поэтому не ломаются.
type AdminRuntime = { live: boolean };

const AdminRuntimeContext = createContext<AdminRuntime>({ live: false });

export function AdminRuntimeProvider({ live = false, children }: { live?: boolean; children: ReactNode }) {
  return <AdminRuntimeContext.Provider value={{ live }}>{children}</AdminRuntimeContext.Provider>;
}

export function useAdminRuntime(): AdminRuntime {
  return useContext(AdminRuntimeContext);
}
