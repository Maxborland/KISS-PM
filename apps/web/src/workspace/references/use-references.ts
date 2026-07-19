"use client";

import { useCallback } from "react";

import { guardMutation, type MutationResult } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import { useResource, type LoadStatus } from "../../lib/use-resource";
import {
  createAdminClient,
  type Position,
  type PositionCreateInput,
  type PositionUpdateInput
} from "@/admin/lib/admin-client";
import { createMockAdminFetch } from "@/admin/lib/mock-admin-backend";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import {
  createWorkspaceClient,
  type TaskStatusDefinitionInput,
  type WorkspaceTaskStatus
} from "@/workspace/lib/workspace-client";
import { createMockWorkspaceFetch } from "@/workspace/lib/mock-workspace-backend";
import { useWorkspaceRuntime } from "@/workspace/lib/workspace-runtime";

/* ============================================================
   Хуки справочников (workspace «Настройки → Справочники»):
   - должности   → createAdminClient   (GET/POST/PATCH/DELETE /api/workspace/positions);
   - статусы задач → createWorkspaceClient (GET/POST/PATCH/DELETE /api/workspace/task-statuses,
     DELETE = архив; системные записи защищены сервером).
   Транспорт — по общему RuntimeProvider (live → боевой API, mock →
   contract-mock на каждый монтаж), зеркало useAdmin/useWorkspace.
   ============================================================ */

export type ReferencesLoadStatus = LoadStatus;
export type ReferencesMutationResult = MutationResult;

const byNameRu = (a: Position, b: Position) => a.name.localeCompare(b.name, "ru");
const bySortOrder = (a: WorkspaceTaskStatus, b: WorkspaceTaskStatus) => a.sortOrder - b.sortOrder;

// ---- Должности: список + create/update/delete поверх positionRoutes ----
export function usePositionsReference() {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createAdminClient, createMockAdminFetch);

  const loader = useCallback(async () => (await client.listPositions()).positions, [client]);
  const { data: positions, status, error, setData, reload } = useResource(loader);

  const createPosition = useCallback(
    (input: PositionCreateInput) =>
      guardMutation(async () => {
        const r = await client.createPosition(input);
        setData((d) => (d ? [...d, r.position].sort(byNameRu) : d));
      }),
    [client, setData]
  );
  const updatePosition = useCallback(
    (positionId: string, input: PositionUpdateInput) =>
      guardMutation(async () => {
        const r = await client.updatePosition(positionId, input);
        setData((d) => (d ? d.map((p) => (p.id === positionId ? r.position : p)).sort(byNameRu) : d));
      }),
    [client, setData]
  );
  const deletePosition = useCallback(
    (positionId: string) =>
      guardMutation(async () => {
        await client.deletePosition(positionId);
        setData((d) => (d ? d.filter((p) => p.id !== positionId) : d));
      }),
    [client, setData]
  );

  return { positions, status, error, reload, createPosition, updatePosition, deletePosition };
}

// ---- Статусы задач: список + create/update/archive поверх taskStatusRoutes ----
export function useTaskStatusesReference() {
  const { live } = useWorkspaceRuntime();
  const client = useDomainClient(live, createWorkspaceClient, createMockWorkspaceFetch);

  const loader = useCallback(
    async () => [...(await client.listTaskStatuses()).taskStatuses].sort(bySortOrder),
    [client]
  );
  const { data: taskStatuses, status, error, setData, reload } = useResource(loader);

  const createTaskStatus = useCallback(
    (input: TaskStatusDefinitionInput) =>
      guardMutation(async () => {
        const r = await client.createTaskStatusDefinition(input);
        setData((d) => (d ? [...d, r.taskStatus].sort(bySortOrder) : d));
      }),
    [client, setData]
  );
  const updateTaskStatus = useCallback(
    (statusId: string, input: Omit<TaskStatusDefinitionInput, "id">) =>
      guardMutation(async () => {
        const r = await client.updateTaskStatusDefinition(statusId, input);
        setData((d) => (d ? d.map((s) => (s.id === statusId ? r.taskStatus : s)).sort(bySortOrder) : d));
      }),
    [client, setData]
  );
  // Архив (DELETE): запись остаётся в списке со status:"archived" — как отдаёт боевой GET.
  const archiveTaskStatus = useCallback(
    (statusId: string) =>
      guardMutation(async () => {
        const r = await client.archiveTaskStatusDefinition(statusId);
        setData((d) => (d ? d.map((s) => (s.id === statusId ? r.taskStatus : s)) : d));
      }),
    [client, setData]
  );

  return { taskStatuses, status, error, reload, createTaskStatus, updateTaskStatus, archiveTaskStatus };
}
