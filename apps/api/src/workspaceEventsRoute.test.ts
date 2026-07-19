import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { Hono } from "hono";
import { expect, test } from "vitest";

import { registerWorkspaceEventsRoute } from "./workspaceEventsRoute";

const actor = { id: "user-1", tenantId: "tenant-a" } as unknown as TenantUser;
const profile = { permissions: [] } as unknown as AccessProfile;

function buildApp() {
  const app = new Hono();
  registerWorkspaceEventsRoute(app, {
    dataSource: {} as never,
    getSessionActorFromHeaders: async (cookie) => (cookie ? actor : undefined),
    getActorProfile: async () => profile
  });
  return app;
}

test("SSE требует сессию (401 без cookie)", async () => {
  const app = buildApp();
  const res = await app.request("/api/workspace/realtime/events", {
    headers: { Accept: "text/event-stream" }
  });
  expect(res.status).toBe(401);
});

// Регресс Блока 10: без no-transform gzip-прокси (Next compress) буферизует
// бесконечный SSE-поток целиком — браузер не получает ни одного события
// (message.created/notification.created доходили до curl, но не до EventSource).
test("SSE-ответ несёт Cache-Control: no-cache, no-transform (анти-gzip-буферизация)", async () => {
  const app = buildApp();
  const res = await app.request("/api/workspace/realtime/events", {
    headers: { cookie: "session=x", Accept: "text/event-stream" }
  });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
  await res.body?.cancel();
});
