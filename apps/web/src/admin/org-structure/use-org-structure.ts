"use client";

import { useCallback } from "react";

import { DomainApiError, guardMutation, type MutationResult } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import { useResource } from "../../lib/use-resource";
import { useAdminRuntime } from "../lib/admin-runtime";
import {
  createOrgStructureClient,
  type OrgPosition,
  type OrgStructureReplaceBody,
  type OrgStructureSnapshot,
  type OrgWorkspaceUser
} from "./org-structure-client";
import { createMockOrgStructureFetch } from "./mock-org-structure-backend";

/* ============================================================
   Хук поверхности оргструктуры: транспорт по AdminRuntime (live →
   боевой createOrgStructureClient на /api/*, mock → contract-mock).
   Грузит снапшот дерева + справочники людей/должностей одним заходом;
   справочники толерантны к 403 (роль только с org_structure.read
   всё равно видит дерево, пусть и без имён для расстановки).
   ============================================================ */

export type OrgStructureData = {
  orgStructure: OrgStructureSnapshot;
  users: OrgWorkspaceUser[];
  positions: OrgPosition[];
};

async function optionalForbidden<T>(request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof DomainApiError && error.status === 403) return fallback;
    throw error;
  }
}

export function useOrgStructure() {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createOrgStructureClient, createMockOrgStructureFetch);

  const loader = useCallback(async (): Promise<OrgStructureData> => {
    const [structure, users, positions] = await Promise.all([
      client.getOrgStructure(),
      optionalForbidden(client.listUsers(), { users: [] }),
      optionalForbidden(client.listPositions(), { positions: [] })
    ]);
    return { orgStructure: structure.orgStructure, users: users.users, positions: positions.positions };
  }, [client]);

  const { data, status, error, reload } = useResource(loader);

  // Сохранение = боевой PUT (full-replace). После успеха честно перезагружаем
  // снапшот (сервер — источник истины: нормализует sortOrder/присвоенные единицы).
  const save = useCallback(
    (body: OrgStructureReplaceBody): Promise<MutationResult> =>
      guardMutation(async () => {
        await client.replaceOrgStructure(body);
        await reload();
      }),
    [client, reload]
  );

  return {
    data,
    hasData: data !== null,
    status,
    error,
    reload,
    save
  };
}
