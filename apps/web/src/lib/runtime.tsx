"use client";

import { createContext, useContext, type ReactNode } from "react";

// Транспортный режим поддерева: 'mock' (Storybook/contract-mock, по умолчанию)
// vs 'live' (боевой API через next-прокси, cookie-сессия). Один контекст на все
// домены: прод-routes оборачивают поверхности live, stories рендерятся без
// провайдера → mock. Значение действует на ПОДДЕРЕВО — вложенный провайдер
// переопределяет для всех доменных хуков внутри (в проде все обёртки live,
// в Storybook провайдеров нет, так что смешанных поддеревьев не существует).
// planning-runtime намеренно отдельный: default live=true + fetchImpl-инъекция.
type Runtime = { live: boolean };

const RuntimeContext = createContext<Runtime>({ live: false });

export function RuntimeProvider({ live = false, children }: { live?: boolean; children: ReactNode }) {
  return <RuntimeContext.Provider value={{ live }}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): Runtime {
  return useContext(RuntimeContext);
}
