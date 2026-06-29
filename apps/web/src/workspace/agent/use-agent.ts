"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useWorkspaceRuntime } from "@/workspace/lib/workspace-runtime";
import {
  AgentApiError,
  createAgentClient,
  type AgentActionInput,
  type AgentExecuteResponse,
  type AgentProposeResponse,
  type AgentStreamEvent,
  type AgentToolAvailability
} from "./agent-client";
import { createMockAgentFetch } from "./mock-agent-backend";

export type AgentStatus = "loading" | "idle" | "proposing" | "executing";
export type AgentResult<T> = { ok: true; data: T } | { ok: false; code: string };

/**
 * Хук агента. Транспорт по WorkspaceRuntime: live → боевой createAgentClient (fetch на
 * /api/workspace/agent/*, cookie-сессия), mock → contract-mock (createMockAgentFetch).
 * tools грузятся на монтаже; propose/execute — мутации с разбором AgentApiError.
 */
export function useAgent() {
  const { live } = useWorkspaceRuntime();
  const fetchRef = useRef<typeof fetch | null>(null);
  if (fetchRef.current === null && !live) fetchRef.current = createMockAgentFetch();
  const clientRef = useRef<ReturnType<typeof createAgentClient> | null>(null);
  if (clientRef.current === null) {
    clientRef.current = live
      ? createAgentClient({ apiOrigin: "" })
      : createAgentClient({ apiOrigin: "", fetchImpl: fetchRef.current! });
  }
  const client = clientRef.current;

  const [tools, setTools] = useState<AgentToolAvailability[]>([]);
  const [proposal, setProposal] = useState<AgentProposeResponse | null>(null);
  const [status, setStatus] = useState<AgentStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void client
      .listTools()
      .then((r) => { if (active) setTools(r.tools); })
      .catch(() => { if (active) setTools([]); })
      .finally(() => { if (active) setStatus("idle"); });
    return () => { active = false; };
  }, [client]);

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
    async (goal: string, onEvent: (event: AgentStreamEvent) => void): Promise<AgentResult<AgentProposeResponse>> => {
      setStatus("proposing");
      setError(null);
      try {
        // live → реальный SSE; mock/Storybook (нет stream-ручки) → обычный propose +
        // синтез событий из результата, чтобы CoT-трейс отображался и в витрине.
        const data = live
          ? await client.proposeStream(goal, onEvent)
          : await (async () => {
              const result = await client.propose(goal);
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

  const execute = useCallback(
    async (actions: AgentActionInput[]): Promise<AgentResult<AgentExecuteResponse>> => {
      setStatus("executing");
      setError(null);
      try {
        const data = await client.execute(actions);
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

  return { tools, proposal, setProposal, status, error, propose, proposeStream, execute };
}
