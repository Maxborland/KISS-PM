import { Scalar } from "@scalar/hono-api-reference";
import type { Hono } from "hono";
import { createKissPmOpenApiDocument } from "./openApiDocument";

export function registerApiDocsRoutes(app: Hono) {
  app.get("/api/openapi.json", (context) => {
    return context.json(createKissPmOpenApiDocument());
  });

  app.get(
    "/api/docs",
    Scalar({
      pageTitle: "KISS PM API",
      theme: "default",
      url: "/api/openapi.json"
    })
  );
}
