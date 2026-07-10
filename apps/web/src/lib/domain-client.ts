/* ============================================================
   Общее транспортное ядро доменных клиентов (admin/auth/crm/comms/…).

   Один requestJson + один класс ошибки вместо шести рукописных копий:
   - заголовки x-kiss-pm-action:same-origin + content-type
   - парсинг JSON-тела (invalid_json_response при мусоре)
   - !ok → DomainApiError(status, body.error, body) — code это СЫРОЙ
     серверный код (например self_access_change_forbidden), его мапят
     в русский текст словари поверхностей.
   Инъекция fetchImpl оставлена: contract-mock'и подменяют транспорт.
   ============================================================ */

export type DomainClientOptions = {
  apiOrigin: string;
  fetchImpl?: typeof fetch;
  credentials?: RequestCredentials;
};

export class DomainApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: Record<string, unknown>;
  constructor(status: number, code: string, body: Record<string, unknown>) {
    super(code);
    this.name = "DomainApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function createRequestJson(options: DomainClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = options.credentials ?? "include";

  // opts.sameOrigin (дефолт true) управляет заголовком x-kiss-pm-action:
  // login — боевое исключение, зовёт с sameOrigin:false (заголовок не шлётся).
  return async function requestJson<T>(
    path: string,
    init?: RequestInit,
    opts?: { sameOrigin?: boolean }
  ): Promise<T> {
    const sameOrigin = opts?.sameOrigin ?? true;
    const response = await fetchImpl(`${options.apiOrigin}${path}`, {
      ...init,
      credentials,
      headers: {
        "content-type": "application/json",
        ...(sameOrigin ? { "x-kiss-pm-action": "same-origin" } : {}),
        ...(init?.headers ?? {})
      }
    });
    const rawText = await response.text();
    let body: Record<string, unknown> = {};
    if (rawText.length > 0) {
      try {
        const parsed: unknown = JSON.parse(rawText);
        body =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { error: "invalid_json_response" };
      } catch {
        body = { error: "invalid_json_response" };
      }
    }
    if (!response.ok) {
      throw new DomainApiError(
        response.status,
        typeof body.error === "string" ? body.error : "request_failed",
        body
      );
    }
    if (body.error === "invalid_json_response") {
      throw new DomainApiError(response.status, "invalid_json_response", body);
    }
    return body as T;
  };
}

export type MutationResult = { ok: true } | { ok: false; code?: string; message: string };
// Результат мутации, возвращающей данные для UI (join-token, оценка, созданная запись).
export type MutationDataResult<T> =
  | { ok: true; data: T }
  | { ok: false; code?: string; message: string };

// Обёртка мутации: DomainApiError.code → {ok:false, code, message} для форм/тостов.
export async function guardMutation(fn: () => Promise<void>): Promise<MutationResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainApiError) return { ok: false, code: e.code, message: e.code };
    return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
  }
}

// Как guardMutation, но пробрасывает данные мутации.
export async function guardData<T>(fn: () => Promise<T>): Promise<MutationDataResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof DomainApiError) return { ok: false, code: e.code, message: e.code };
    return { ok: false, message: e instanceof Error ? e.message : "request_failed" };
  }
}
