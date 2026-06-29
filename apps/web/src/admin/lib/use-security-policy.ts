"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AdminApiError, createAdminClient, type SecurityPolicy } from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";
import { useAdminRuntime } from "./admin-runtime";

export type SecurityPolicyLoadStatus = "loading" | "ready" | "error";
export type SecurityPolicySaveResult = { ok: true } | { ok: false; code?: string; message: string };

/**
 * Хук политики безопасности тенанта (admin «Безопасность»). Лёгкий брат useAdmin:
 * тот же выбор транспорта по AdminRuntime (live → боевой createAdminClient на /api/*,
 * mock → contract-mock fetchImpl на каждый монтаж), но грузит только один ресурс —
 * GET/PUT /api/tenant/current/security-policy, без справочников пользователей/ролей.
 */
export function useSecurityPolicy() {
  const { live } = useAdminRuntime();
  const fetchRef = useRef<typeof fetch | null>(null);
  if (fetchRef.current === null && !live) fetchRef.current = createMockAdminFetch();
  const clientRef = useRef<ReturnType<typeof createAdminClient> | null>(null);
  if (clientRef.current === null) {
    clientRef.current = live
      ? createAdminClient({ apiOrigin: "" })
      : createAdminClient({ apiOrigin: "", fetchImpl: fetchRef.current! });
  }
  const client = clientRef.current;

  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [status, setStatus] = useState<SecurityPolicyLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await client.getSecurityPolicy();
      setPolicy(res.securityPolicy);
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (input: SecurityPolicy): Promise<SecurityPolicySaveResult> => {
      try {
        const res = await client.updateSecurityPolicy(input);
        setPolicy(res.securityPolicy);
        return { ok: true };
      } catch (e) {
        if (e instanceof AdminApiError) return { ok: false, code: e.code, message: e.code };
        return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
      }
    },
    [client]
  );

  return { policy, status, error, reload: load, save };
}
