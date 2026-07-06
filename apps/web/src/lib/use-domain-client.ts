"use client";

import { useRef } from "react";

/**
 * Fork mock/live в одном месте: live → клиент без fetchImpl (fetch на /api/*
 * через next-прокси, cookie-сессия), mock → contract-mock fetchImpl на каждый
 * монтаж (изолированная in-memory сессия). Клиент стабилен на всё время жизни
 * компонента. Заменяет восемь рукописных копий этой развилки по доменам.
 */
export function useDomainClient<C>(
  live: boolean,
  createClient: (options: { apiOrigin: string; fetchImpl?: typeof fetch }) => C,
  createMockFetch: () => typeof fetch
): C {
  const clientRef = useRef<C | null>(null);
  if (clientRef.current === null) {
    clientRef.current = live
      ? createClient({ apiOrigin: "" })
      : createClient({ apiOrigin: "", fetchImpl: createMockFetch() });
  }
  return clientRef.current;
}
