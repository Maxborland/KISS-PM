"use client";

import { useCallback, useEffect, useState } from "react";

import { useDomainClient } from "@/lib/use-domain-client";
import { useWorkspaceRuntime } from "@/workspace/lib/workspace-runtime";
import {
  AgentApiError,
  createAgentClient,
  type AgentActionInput,
  type AgentExecuteResponse,
  type AgentHistoryTurn,
  type AgentProposeResponse,
  type AgentStreamEvent,
  type AgentToolAvailability
} from "./agent-client";
import { createMockAgentFetch } from "./mock-agent-backend";

export type AgentStatus = "loading" | "idle" | "proposing" | "executing";
export type AgentResult<T> = { ok: true; data: T } | { ok: false; code: string };
export type AgentExecuteResult =
  | { ok: true; data: AgentExecuteResponse }
  | { ok: false; code: string; status: number | null; uncertain: boolean };

/**
 * Хук агента. Транспорт по WorkspaceRuntime: live → боевой createAgentClient (fetch на
 * /api/workspace/agent/*, cookie-сессия), mock → contract-mock (createMockAgentFetch).
 * tools грузятся на монтаже; propose/execute — мутации с разбором AgentApiError.
 */
export function useAgent() {
  const { live } = useWorkspaceRuntime();
  const client = useDomainClient(live, createAgentClient, createMockAgentFetch);

  const [tools, setTools] = useState<AgentToolAvailability[]>([]);
  // Статус LLM-провайдера инсталляции: live=false (demo/mock) → UI показывает
  // честный баннер деградации вместо неотличимого «Предложений нет» (G7-01).
  const [provider, setProvider] = useState<{ model: string; live: boolean; configured?: boolean } | null>(null);
  const [proposal, setProposal] = useState<AgentProposeResponse | null>(null);
  const [status, setStatus] = useState<AgentStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Сбой listTools раньше молча схлопывался в tools=[] — UI не мог отличить
  // «нет прав ни на что» от «ручка недоступна». Теперь код ошибки виден поверхности.
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [toolsReloading, setToolsReloading] = useState(false);

  const reloadTools = useCallback(async () => {
    // Баннер ошибки НЕ прячем на время повтора — иначе «всё хорошо»-окно до ответа.
    setToolsReloading(true);
    try {
      const r = await client.listTools();
      setTools(r.tools);
      setProvider(r.provider ?? null);
      setToolsError(null);
    } catch (e) {
      setTools([]);
      setToolsError(e instanceof AgentApiError ? e.code : "request_failed");
    } finally {
      setToolsReloading(false);
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    void reloadTools().finally(() => { if (active) setStatus("idle"); });
    return () => { active = false; };
  }, [reloadTools]);

  const propose = useCallback(
    async (goal: string): Promise<AgentResult<AgentProposeResponse>> => {
      setStatus("proposing");
      setError(null);
      try {
        const data = await client.propose(goal);
        setProposal(data);
        return { ok: true, data };
      } catch (e) {
        const code = e instanceof AgentApiError ? e.code : "request_failed";
        setError(code);
        return { ok: false, code };
      } finally {
        setStatus("idle");
      }
    },
    [client]
  );

  const proposeStream = useCallback(
    async (goal: string, onEvent: (event: AgentStreamEvent) => void, attachmentIds: string[] = [], history: AgentHistoryTurn[] = []): Promise<AgentResult<AgentProposeResponse>> => {
      setStatus("proposing");
      setError(null);
      try {
        // live → реальный SSE; mock/Storybook (нет stream-ручки) → обычный propose +
        // синтез событий из результата, чтобы CoT-трейс отображался и в витрине.
        const data = live
          ? await client.proposeStream(goal, onEvent, attachmentIds, history)
          : await (async () => {
              const result = await client.propose(goal, attachmentIds, history);
              for (const analyze of result.analyzeResults) onEvent({ type: "analyze", tool: analyze.tool, title: analyze.tool, ok: true });
              for (const action of result.proposedActions) onEvent({ type: "proposal", tool: action.tool, title: action.title });
              if (result.reasoning) onEvent({ type: "reasoning", text: result.reasoning });
              return result;
            })();
        setProposal(data);
        return { ok: true, data };
      } catch (e) {
        const code = e instanceof AgentApiError ? e.code : "request_failed";
        setError(code);
        return { ok: false, code };
      } finally {
        setStatus("idle");
      }
    },
    [client, live]
  );

  // Загрузка вложения (live → штатная ручка; mock → синтетика для витрины).
  const uploadAttachment = useCallback(
    async (file: File, entityType: string, entityId: string): Promise<AgentResult<{ id: string; name: string }>> => {
      try {
        const data = live ? await client.uploadAttachment(file, entityType, entityId) : { id: `mock-att-${file.name}`, name: file.name };
        return { ok: true, data };
      } catch (e) {
        return { ok: false, code: e instanceof AgentApiError ? e.code : "upload_failed" };
      }
    },
    [client, live]
  );

  // Проекты-якоря (live → реальные; mock → демо-список).
  const listProjects = useCallback(
    async (): Promise<Array<{ id: string; label: string }>> => {
      try {
        return live ? await client.listProjects() : [{ id: "proj-portal", label: "Портал клиента" }, { id: "proj-crm", label: "CRM-внедрение" }];
      } catch {
        return [];
      }
    },
    [client, live]
  );

  const execute = useCallback(
    async (actions: AgentActionInput[]): Promise<AgentExecuteResult> => {
      setStatus("executing");
      setError(null);
      try {
        const data = await client.execute(actions);
        return { ok: true, data };
      } catch (e) {
        const status = e instanceof AgentApiError ? e.status : null;
        const code = e instanceof AgentApiError ? e.code : "request_failed";
        setError(code);
        return { ok: false, code, status, uncertain: status === null || status >= 500 };
      } finally {
        setStatus("idle");
      }
    },
    [client]
  );

  return { tools, toolsError, toolsReloading, reloadTools, provider, proposal, setProposal, status, error, propose, proposeStream, uploadAttachment, listProjects, execute };
}
