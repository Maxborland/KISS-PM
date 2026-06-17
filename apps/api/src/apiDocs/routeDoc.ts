export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type RouteDoc = {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  auth?: "public" | "session" | "dev";
  body?: "json" | "multipart" | "none";
  response?: "json" | "file" | "event-stream";
  requestSchema?: string;
  successSchema?: string;
  successStatus?: 200 | 201;
  queryParameters?: Array<Record<string, unknown>>;
  availability?: "always" | "test-hooks";
};
