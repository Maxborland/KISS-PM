export function parseContentLength(value: string | undefined):
  | { ok: true; value: number | null }
  | { ok: false; error: "content_length_invalid" } {
  if (!value) return { ok: true, value: null };
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return { ok: false, error: "content_length_invalid" };
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) return { ok: false, error: "content_length_invalid" };
  return { ok: true, value: parsed };
}

export function parseMultipartContentType(value: string | undefined):
  | { ok: true }
  | { ok: false; error: "unsupported_media_type" } {
  if (!value) return { ok: false, error: "unsupported_media_type" };
  const parts = value.split(";").map((part) => part.trim());
  const mediaType = parts[0]?.toLowerCase();
  if (mediaType !== "multipart/form-data") return { ok: false, error: "unsupported_media_type" };

  const boundary = parts
    .slice(1)
    .map((part) => part.match(/^boundary=(?:"([^"]+)"|([^;]+))$/i))
    .find((match): match is RegExpMatchArray => Boolean(match));
  const boundaryValue = boundary?.[1] ?? boundary?.[2] ?? "";
  if (!boundaryValue || /[\u0000-\u001f\u007f]/.test(boundaryValue)) {
    return { ok: false, error: "unsupported_media_type" };
  }
  return { ok: true };
}

export async function readBoundedMultipartRequest(
  request: Request,
  maxBytes: number
): Promise<
  | { ok: true; request: Request }
  | { ok: false; status: 413; error: "file_too_large" }
> {
  if (!request.body) return { ok: true, request };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, status: 413, error: "file_too_large" };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    ok: true,
    request: new Request(request.url, {
      body: toArrayBuffer(bytes),
      headers: request.headers,
      method: request.method
    })
  };
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
