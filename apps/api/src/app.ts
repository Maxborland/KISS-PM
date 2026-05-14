import { Hono } from "hono";

export function createApiApp() {
  const app = new Hono();

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "kiss-pm-api"
    })
  );

  return app;
}

export type ApiApp = ReturnType<typeof createApiApp>;

