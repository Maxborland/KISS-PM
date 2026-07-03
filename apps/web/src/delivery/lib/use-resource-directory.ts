"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { usePlanningRuntime } from "./planning-runtime";
import { createDeliveryPlanningClient } from "./planning-client";
import { RESOURCES, type Resource } from "./mock-planning-backend";

/**
 * Справочник ресурсов (id → имя/позиция). Источник берётся из единого шва клиента
 * (createDeliveryPlanningClient) — решение mock/live принимается ОДИН раз при конструировании,
 * хук больше не ветвится по live:
 * - mock (Storybook): статический RESOURCES — его id совпадают с мок-назначениями плана;
 * - live (прод-route): GET /api/workspace/users — id = реальные resourceId назначений read-model.
 * Дефолт — mock (тот же usePlanningRuntime().live, что и planning-транспорт), поэтому stories
 * не ломаются. team/capacity на проде — из позиции/дефолта: полная оргструктура (tenant_org_nodes)
 * появится с дополнением сидов (SEED-AUGMENTATION-TASK.md).
 */
export function useResourceDirectory(): {
  list: Resource[];
  byId: Map<string, Resource>;
  name: (id: string) => string;
  of: (id: string) => Resource | undefined;
} {
  const { live } = usePlanningRuntime();
  const clientRef = useRef<ReturnType<typeof createDeliveryPlanningClient> | null>(null);
  // Клиент нужен ТОЛЬКО для live-фетча справочника (/api/workspace/users). В mock директория статична
  // (RESOURCES), поэтому НЕ конструируем весь мок-бэкенд (createMockPlanningFetch) ради константы.
  if (live && clientRef.current === null) clientRef.current = createDeliveryPlanningClient(live);
  const client = clientRef.current;

  // синхронный старт (mock → RESOURCES сразу; live → пусто до ответа), затем обновление из шва (live).
  const [list, setList] = useState<Resource[]>(() => (client ? client.resourceDirectorySeed() : RESOURCES));
  const requested = useRef(false);

  useEffect(() => {
    if (!client || requested.current) return;
    requested.current = true;
    let active = true;
    void client.getResourceDirectory().then((rs) => {
      if (active) setList(rs);
    });
    return () => {
      active = false;
    };
  }, [client]);

  return useMemo(() => {
    const byId = new Map(list.map((r) => [r.id, r]));
    return { list, byId, name: (id: string) => byId.get(id)?.name ?? id, of: (id: string) => byId.get(id) };
  }, [list]);
}
