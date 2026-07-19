import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { Hono } from "hono";
import { expect, test } from "vitest";

import { registerPlanningEventsRoute } from "./planningEventsRoute";

const actor = { id: "user-1", tenantId: "tenant-a" } as unknown as TenantUser;
const profile = { permissions: ["tenant.project_plan.read"] } as unknown as AccessProfile;

function buildApp(projectExistsInTenant: (tenantId: string, projectId: string) => Promise<boolean>) {
  const app = new Hono();
  registerPlanningEventsRoute(app, {
    getSessionActorFromHeaders: async () => actor,
    getActorProfile: async () => profile,
    projectExistsInTenant
  });
  return app;
}

// SEC-001: событийная шина ключуется только по projectId, поэтому подписка на проект, не
// принадлежащий тенанту актора, обязана отклоняться (иначе — утечка событий чужого тенанта).
test("SEC-001: SSE отклоняет проект чужого тенанта (404)", async () => {
  const app = buildApp(async () => false);
  const res = await app.request("/api/workspace/projects/project-foreign/planning/events", {
    headers: { cookie: "session=x", Accept: "text/event-stream" }
  });
  expect(res.status).toBe(404);
});

test("SEC-001: принадлежность проверяется тенантом актора и распарсенным projectId", async () => {
  const calls: Array<[string, string]> = [];
  const app = buildApp(async (tenantId, projectId) => {
    calls.push([tenantId, projectId]);
    return false;
  });
  await app.request("/api/workspace/projects/project-x/planning/events", {
    headers: { cookie: "session=x", Accept: "text/event-stream" }
  });
  expect(calls).toEqual([["tenant-a", "project-x"]]);
});

// Регресс Блока 10: без no-transform gzip-прокси (Next compress) буферизует
// бесконечный SSE-поток целиком — браузер не получает ни одного события.
test("SSE-ответ несёт Cache-Control: no-cache, no-transform (анти-gzip-буферизация)", async () => {
  const app = buildApp(async () => true);
  const res = await app.request("/api/workspace/projects/project-x/planning/events", {
    headers: { cookie: "session=x", Accept: "text/event-stream" }
  });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
  await res.body?.cancel();
});
