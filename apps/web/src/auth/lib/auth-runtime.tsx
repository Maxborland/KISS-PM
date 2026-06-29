"use client";

import { createContext, useContext, type ReactNode } from "react";

// Транспорт auth: 'mock' (Storybook / contract-mock, по умолчанию) vs 'live' (боевой API:
// createAuthClient без fetchImpl → fetch на /api/auth/* + /api/profile через next.config-прокси,
// HttpOnly cookie-сессия). Зеркало WorkspaceRuntimeProvider/PlanningRuntimeProvider.
// Прод-routes оборачивают surface в <AuthRuntimeProvider live>; stories рендерятся БЕЗ провайдера
// → mock (живая in-memory сессия), поэтому не ломаются.
type AuthRuntime = { live: boolean };

const AuthRuntimeContext = createContext<AuthRuntime>({ live: false });

export function AuthRuntimeProvider({ live = false, children }: { live?: boolean; children: ReactNode }) {
  return <AuthRuntimeContext.Provider value={{ live }}>{children}</AuthRuntimeContext.Provider>;
}

export function useAuthRuntime(): AuthRuntime {
  return useContext(AuthRuntimeContext);
}
