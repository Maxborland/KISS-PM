import { randomUUID } from "node:crypto";
import type { Context, Next } from "hono";

export type RequestLogger = Pick<Console, "info" | "error">;

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

// Достаёт requestId, назначенный requestObservabilityMiddleware: он кладёт его в
// response-заголовок x-request-id ещё до next(), поэтому в onError (когда цепочка
// уже бросила) канонический id читается из ответа, а не генерируется заново.
export function requestIdFromContext(context: Context): string {
  const fromResponse = context.res.headers.get("x-request-id");
  if (fromResponse && requestIdPattern.test(fromResponse)) return fromResponse;

  const fromRequest = context.req.header("x-request-id")?.trim();
  if (fromRequest && requestIdPattern.test(fromRequest)) return fromRequest;

  return "unknown";
}

export function requestObservabilityMiddleware(input: {
  enabled?: boolean;
  logger?: RequestLogger;
} = {}) {
  const enabled =
    input.enabled ??
    (process.env.NODE_ENV === "production" ||
      process.env.KISS_PM_REQUEST_LOGS === "true");
  const logger = input.logger ?? console;

  return async (context: Context, next: Next) => {
    const requestId = safeRequestId(context.req.header("x-request-id"));
    const startedAt = performance.now();
    context.header("x-request-id", requestId);

    try {
      await next();
      if (enabled) {
        logger.info(
          JSON.stringify({
            durationMs: Math.round(performance.now() - startedAt),
            method: context.req.method,
            path: context.req.path,
            requestId,
            status: context.res.status
          })
        );
      }
    } catch (error) {
      if (enabled) {
        logger.error(
          JSON.stringify({
            durationMs: Math.round(performance.now() - startedAt),
            method: context.req.method,
            path: context.req.path,
            requestId,
            status: 500
          })
        );
      }
      throw error;
    }
  };
}

function safeRequestId(value: string | undefined): string {
  const normalized = value?.trim();
  if (normalized && requestIdPattern.test(normalized)) return normalized;
  return randomUUID();
}
