"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { usePlanningRuntime } from "./planning-runtime";
import { RESOURCES, type Resource } from "./planning-demo-data";

type ApiUser = { id: string; name: string; positionId?: string | null; positionName?: string | null };

/**
 * Справочник ресурсов (id → имя/позиция). Источник:
 * - mock (Storybook): статический RESOURCES — его id совпадают с мок-назначениями плана;
 * - live (прод-route): GET /api/workspace/users — id = реальные resourceId назначений read-model.
 * Привязка mock/live — к тому же usePlanningRuntime().live, что и planning-транспорт; Storybook
 * явно инжектит demo runtime. team/capacity на проде — из позиции/дефолта: полная
 * оргструктура (tenant_org_nodes) появится с дополнением сидов (SEED-AUGMENTATION-TASK.md).
 */
export function useResourceDirectory(): {
  list: Resource[];
  byId: Map<string, Resource>;
  name: (id: string) => string;
  of: (id: string) => Resource | undefined;
} {
  const { live } = usePlanningRuntime();
  const [users, setUsers] = useState<Resource[] | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!live || requested.current) return;
    requested.current = true;
    let active = true;
    void fetch("/api/workspace/users", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((payload: { users?: ApiUser[] }) => {
        if (!active) return;
        setUsers(
          (payload.users ?? []).map<Resource>((u) => ({
            id: u.id,
            name: u.name,
            positionId: u.positionId ?? "",
            positionName: u.positionName ?? "",
            // группировка по позиции — реальное поле; оргдерево (направление/отдел) ждёт сидов
            teamId: u.positionId ?? "team",
            teamName: u.positionName ?? "Команда проекта",
            // ponytail: дефолт рабочего дня 8ч; реальная ёмкость — из календаря ресурса, если понадобится
            capacityMinPerDay: 480
          }))
        );
      })
      .catch(() => {
        if (active) setUsers([]);
      });
    return () => {
      active = false;
    };
  }, [live]);

  const list = live ? users ?? [] : RESOURCES;
  return useMemo(() => {
    const byId = new Map(list.map((r) => [r.id, r]));
    return { list, byId, name: (id: string) => byId.get(id)?.name ?? id, of: (id: string) => byId.get(id) };
  }, [list]);
}
