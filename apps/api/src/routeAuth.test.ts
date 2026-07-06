import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { canReadClients } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "./apiTypes";
import { authorizeRoute } from "./routeAuth";

const actor: TenantUser = {
  id: "user-1",
  tenantId: "tenant-1",
  name: "Тест",
  accessProfileId: "profile-1"
};

function buildApp(overrides: {
  actor?: TenantUser | undefined;
  permissions?: readonly ["tenant.clients.read"] | readonly [];
  dataSource?: Partial<ApiTenantDataSource>;
}) {
  const app = new Hono();
  const deps = {
    dataSource: overrides.dataSource ?? ({ listClients: async () => [] } as Partial<ApiTenantDataSource>),
    getSessionActorFromHeaders: async () => overrides.actor,
    getActorProfile: async () => ({
      id: "profile-1",
      permissions: overrides.permissions ?? (["tenant.clients.read"] as const)
    })
  };
  app.get("/probe", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canReadClients,
      capabilities: ["listClients"]
    });
    if (!auth.ok) return auth.response;
    // Сужение типа: listClients обязателен, вызов без `!`/`?.`.
    return context.json({ clients: await auth.value.dataSource.listClients(auth.value.actor.tenantId) });
  });
  return app;
}

describe("authorizeRoute", () => {
  it("401 без актёра", async () => {
    const res = await buildApp({ actor: undefined }).request("/probe");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "session_required" });
  });

  it("501 при отсутствующей capability (до проверки прав)", async () => {
    const res = await buildApp({
      actor,
      permissions: [],
      dataSource: {} as ApiTenantDataSource
    }).request("/probe");
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ error: "persistence_not_configured" });
  });

  it("403 с reason при запрете", async () => {
    const res = await buildApp({ actor, permissions: [] }).request("/probe");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "permission_missing" });
  });

  it("ok: actor/profile/decision и вызов сузившегося метода", async () => {
    const res = await buildApp({ actor }).request("/probe");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clients: [] });
  });
});
