"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { type MutationResult } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import { useResource, type LoadStatus } from "../../lib/use-resource";
import {
  WorkspaceApiError,
  createWorkspaceClient,
  type ProjectRecord,
  type TaskRecord,
  type WorkspaceClient,
  type WorkspaceTaskStatus,
  type WorkspaceUser
} from "./workspace-client";
import { createMockWorkspaceFetch } from "./mock-workspace-backend";
import { useWorkspaceRuntime } from "./workspace-runtime";

// 403 → forbidden: разделы без соответствующего права показывают «Доступ ограничен».
export type WorkspaceLoadStatus = LoadStatus;
// Результат мутации смены статуса: {ok} либо {ok,code,message} (как guard в use-crm).
export type WorkspaceMutationResult = MutationResult;

/* Изолированный клиент на каждый монтаж: свой fetchImpl-мок (отдельная
   in-memory сессия) + свой createWorkspaceClient. Переключение на боевой
   API = смена apiOrigin + удаление fetchImpl. Зеркало useCrm/usePlanning. */
function useWorkspaceClient(): WorkspaceClient {
  const { live } = useWorkspaceRuntime();
  return useDomainClient(live, createWorkspaceClient, createMockWorkspaceFetch);
}

// ---- useProjects: активные проекты рабочей области ----
export function useProjects() {
  const client = useWorkspaceClient();
  const loader = useCallback(async () => ({ projects: (await client.listProjects()).projects }), [client]);
  const { data, status, error, reload: load } = useResource(loader);
  return { data, status, error, reload: load };
}

// ---- useProjectDetail: карточка проекта + его задачи ----
export function useProjectDetail(projectId: string) {
  const client = useWorkspaceClient();
  const loader = useCallback(async () => {
    const r = await client.getProjectDetail(projectId);
    return { project: r.project, tasks: r.tasks };
  }, [client, projectId]);
  const { data, status, error, reload: load } = useResource(loader);
  return { data, status, error, reload: load };
}

// ---- useMyWork: задачи текущего пользователя + смена статуса ----
export function useMyWork() {
  const client = useWorkspaceClient();
  const loader = useCallback(async () => ({ tasks: (await client.listMyWork()).tasks }), [client]);
  const { data, status, error, setData, reload: load } = useResource(loader);

  // Смена статуса задачи: проектируем из самой задачи (нужен её projectId).
  // Ошибки WorkspaceApiError → {ok:false, code, message}; успех точечно патчит кэш.
  const updateTaskStatus = useCallback(async (taskId: string, statusId: string): Promise<WorkspaceMutationResult> => {
    const current = data?.tasks.find((t) => t.id === taskId);
    if (!current) return { ok: false, code: "task_not_found", message: "task_not_found" };
    try {
      const r = await client.updateTaskStatus(current.projectId, taskId, statusId);
      setData((d) => (d ? { tasks: d.tasks.map((t) => (t.id === taskId ? r.task : t)) } : d));
      return { ok: true };
    } catch (e) {
      if (e instanceof WorkspaceApiError) return { ok: false, code: e.code, message: e.code };
      return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
    }
  }, [client, data]);

  return { data, status, error, reload: load, updateTaskStatus };
}

// ---- useWorkspaceUsers: справочник пользователей (исполнитель/заказчик/владелец). mock=WORKSPACE_USERS, live=GET /users ----
export function useWorkspaceUsers() {
  const client = useWorkspaceClient();
  const [list, setList] = useState<WorkspaceUser[]>([]);
  useEffect(() => {
    let active = true;
    void client.listUsers().then((r) => { if (active) setList(r.users); }).catch(() => { if (active) setList([]); });
    return () => { active = false; };
  }, [client]);
  return useMemo(() => {
    const byId = new Map(list.map((u) => [u.id, u]));
    return { list, byId, name: (id: string) => byId.get(id)?.name ?? id, indexOf: (id: string) => list.findIndex((u) => u.id === id) };
  }, [list]);
}

// ---- useWorkspaceTaskStatuses: системные статусы (колонки канбана/селект). mock=TASK_STATUSES, live=GET /task-statuses ----
export function useWorkspaceTaskStatuses() {
  const client = useWorkspaceClient();
  const [list, setList] = useState<WorkspaceTaskStatus[]>([]);
  useEffect(() => {
    let active = true;
    void client.listTaskStatuses().then((r) => { if (active) setList([...r.taskStatuses].sort((a, b) => a.sortOrder - b.sortOrder)); }).catch(() => { if (active) setList([]); });
    return () => { active = false; };
  }, [client]);
  return useMemo(() => ({ list, byId: new Map(list.map((s) => [s.id, s])) }), [list]);
}
