const defaultMaxJsonBodyBytes = 64 * 1024;

type JsonBodyReadResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_json";
    }
  | {
      ok: false;
      status: 413;
      error: "payload_too_large";
    };

export async function readLimitedJsonBody(
  context: { req: { raw: Request } },
  fallback: unknown = null,
  maxBytes: number = defaultMaxJsonBodyBytes
): Promise<JsonBodyReadResult> {
  const contentLength = Number(context.req.raw.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const body = context.req.raw.body;
  if (!body) return { ok: true, value: fallback };

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let raw = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytesRead += chunk.value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413, error: "payload_too_large" };
    }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();

  if (raw.trim().length === 0) return { ok: true, value: fallback };

  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}
