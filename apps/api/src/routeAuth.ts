import type { Context } from "hono";
import type {
  AccessProfile,
  PolicyDecision,
  TenantPolicyInput
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "./apiTypes";

/* ============================================================
   Преамбула защищённого маршрута одним вызовом:
     actor      → 401 session_required
     capability → 501 persistence_not_configured
     permission → 403 decision.reason
   Порядок фиксирован (401 → 501 → 403) — это преобладающий порядок
   рукописных преамбул. dataSource в ok-ветке типобезопасно сужен:
   заявленные capability-методы больше не optional, guard'ы и `!`
   в теле обработчика не нужны.
   ============================================================ */

type RouteAuthDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
};

export type AuthorizedRoute<K extends keyof ApiTenantDataSource> = {
  actor: TenantUser;
  profile: AccessProfile;
  decision: PolicyDecision;
  dataSource: ApiTenantDataSource & Required<Pick<ApiTenantDataSource, K>>;
};

// Аутентификация без permission-шага: actor → 401, capabilities → 501.
// Для контуров, где доступ решает entity-access/membership после преамбулы
// (collaboration/communications), а не tenant-permission.
export async function authenticateRoute<K extends keyof ApiTenantDataSource = never>(
  context: Context,
  deps: Pick<RouteAuthDeps, "dataSource" | "getSessionActorFromHeaders">,
  input: {
    capabilities?: readonly K[];
    // У контуров свои 501-коды (collaboration/communications_not_configured).
    capabilityError?: string;
    unauthorizedError?: string;
  } = {}
): Promise<
  | { ok: true; value: Pick<AuthorizedRoute<K>, "actor" | "dataSource"> }
  | { ok: false; response: Response }
> {
  const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
  if (!actor) {
    return {
      ok: false,
      response: context.json({ error: input.unauthorizedError ?? "session_required" }, 401)
    };
  }
  for (const capability of input.capabilities ?? []) {
    if (!deps.dataSource[capability]) {
      return {
        ok: false,
        response: context.json(
          { error: input.capabilityError ?? "persistence_not_configured" },
          501
        )
      };
    }
  }
  return {
    ok: true,
    value: {
      actor,
      dataSource: deps.dataSource as ApiTenantDataSource & Required<Pick<ApiTenantDataSource, K>>
    }
  };
}

export async function authorizeRoute<K extends keyof ApiTenantDataSource = never>(
  context: Context,
  deps: RouteAuthDeps,
  input: {
    permission: (policyInput: TenantPolicyInput) => PolicyDecision;
    capabilities?: readonly K[];
    capabilityError?: string;
    // Часть ручек отвечает legacy-кодом (например dev_session_required).
    unauthorizedError?: string;
    // Denied-аудит перед 403 — маршрут передаёт свой sourceWorkflow/sourceEntity.
    onDenied?(denied: {
      actor: TenantUser;
      profile: AccessProfile;
      decision: PolicyDecision;
    }): Promise<void>;
  }
): Promise<{ ok: true; value: AuthorizedRoute<K> } | { ok: false; response: Response }> {
  const authenticated = await authenticateRoute(context, deps, input);
  if (!authenticated.ok) return authenticated;
  const { actor } = authenticated.value;
  const profile = await deps.getActorProfile(actor);
  const decision = input.permission({ actor, profile, targetTenantId: actor.tenantId });
  if (!decision.allowed) {
    await input.onDenied?.({ actor, profile, decision });
    return { ok: false, response: context.json({ error: decision.reason }, 403) };
  }
  return {
    ok: true,
    value: {
      actor,
      profile,
      decision,
      dataSource: deps.dataSource as ApiTenantDataSource & Required<Pick<ApiTenantDataSource, K>>
    }
  };
}
