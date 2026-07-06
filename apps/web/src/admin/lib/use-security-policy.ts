"use client";

import { useCallback, useEffect, useState } from "react";

import { guardMutation } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import { createAdminClient, type SecurityPolicy } from "./admin-client";
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
  const client = useDomainClient(live, createAdminClient, createMockAdminFetch);

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
    (input: SecurityPolicy): Promise<SecurityPolicySaveResult> =>
      guardMutation(async () => {
        const res = await client.updateSecurityPolicy(input);
        setPolicy(res.securityPolicy);
      }),
    [client]
  );

  return { policy, status, error, reload: load, save };
}
