const defaultMaxJsonBodyBytes = 64 * 1024;

type JsonBodyReadResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_json" | "invalid_content_length";
    }
  | {
      ok: false;
      status: 413;
      error: "payload_too_large";
    }
  | {
      ok: false;
      status: 415;
      error: "unsupported_media_type";
    };

export async function readLimitedJsonBody(
  context: { req: { raw: Request } },
  fallback: unknown = null,
  maxBytes: number = defaultMaxJsonBodyBytes
): Promise<JsonBodyReadResult> {
  const contentLength = parseContentLength(context.req.raw.headers.get("content-length"));
  if (contentLength === null) return { ok: false, status: 400, error: "invalid_content_length" };
  if (contentLength > maxBytes) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const body = context.req.raw.body;
  if (!body) return { ok: true, value: fallback };

  if (!isJsonContentType(context.req.raw.headers.get("content-type"))) {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }

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

function parseContentLength(value: string | null): number | null {
  if (value === null || value === "") return 0;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  return Number(normalized);
}

function isJsonContentType(contentType: string | null): boolean {
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase();
  return (
    mediaType === "application/json" ||
    Boolean(mediaType?.startsWith("application/") && mediaType.endsWith("+json"))
  );
}
