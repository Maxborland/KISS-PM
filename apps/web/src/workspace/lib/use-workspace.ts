"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  WorkspaceApiError,
  createWorkspaceClient,
  type ProjectRecord,
  type TaskRecord,
  type WorkspaceClient
} from "./workspace-client";
import { createMockWorkspaceFetch } from "./mock-workspace-backend";

export type WorkspaceLoadStatus = "loading" | "ready" | "error";
// Результат мутации смены статуса: {ok} либо {ok,code,message} (как guard в use-crm).
export type WorkspaceMutationResult = { ok: true } | { ok: false; code?: string; message: string };

/* Изолированный клиент на каждый монтаж: свой fetchImpl-мок (отдельная
   in-memory сессия) + свой createWorkspaceClient. Переключение на боевой
   API = смена apiOrigin + удаление fetchImpl. Зеркало useCrm/usePlanning. */
function useWorkspaceClient(): WorkspaceClient {
  const fetchRef = useRef<typeof fetch | null>(null);
  if (fetchRef.current === null) fetchRef.current = createMockWorkspaceFetch();
  const clientRef = useRef<WorkspaceClient | null>(null);
  if (clientRef.current === null) clientRef.current = createWorkspaceClient({ apiOrigin: "", fetchImpl: fetchRef.current });
  return clientRef.current;
}

// ---- useProjects: активные проекты рабочей области ----
export function useProjects() {
  const client = useWorkspaceClient();
  const [data, setData] = useState<{ projects: ProjectRecord[] } | null>(null);
  const [status, setStatus] = useState<WorkspaceLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await client.listProjects();
      setData({ projects: r.projects });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  useEffect(() => { void load(); }, [load]);

  return { data, status, error, reload: load };
}

// ---- useProjectDetail: карточка проекта + его задачи ----
export function useProjectDetail(projectId: string) {
  const client = useWorkspaceClient();
  const [data, setData] = useState<{ project: ProjectRecord; tasks: TaskRecord[] } | null>(null);
  const [status, setStatus] = useState<WorkspaceLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await client.getProjectDetail(projectId);
      setData({ project: r.project, tasks: r.tasks });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof WorkspaceApiError ? e.code : e instanceof Error ? e.message : "load_failed");
    }
  }, [client, projectId]);

  useEffect(() => { void load(); }, [load]);

  return { data, status, error, reload: load };
}

// ---- useMyWork: задачи текущего пользователя + смена статуса ----
export function useMyWork() {
  const client = useWorkspaceClient();
  const [data, setData] = useState<{ tasks: TaskRecord[] } | null>(null);
  const [status, setStatus] = useState<WorkspaceLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await client.listMyWork();
      setData({ tasks: r.tasks });
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  useEffect(() => { void load(); }, [load]);

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
