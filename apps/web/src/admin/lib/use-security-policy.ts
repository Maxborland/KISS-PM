"use client";

import { useCallback, useEffect, useState } from "react";

import { guardMutation } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import { useResource, type LoadStatus } from "../../lib/use-resource";
import { createAdminClient, type SecurityPolicy } from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";
import { useAdminRuntime } from "./admin-runtime";

// 403 → forbidden: политика безопасности закрыта без workspace_config.read.
export type SecurityPolicyLoadStatus = LoadStatus;
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

  const loader = useCallback(async () => (await client.getSecurityPolicy()).securityPolicy, [client]);
  const { data: policy, status, error, setData: setPolicy, reload: load } = useResource(loader);

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
