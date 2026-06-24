// Доменный слой самостоятельной регистрации (новый тенант) и сброса пароля.
// Единственный источник правды для парольной политики и парсеров входных тел.
// Парсеры чистые: не делают I/O и не знают про HTTP, только валидируют структуру.

// Парольная политика — один источник правды для домена и API-слоя.
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 1024
} as const;

// Управляющие символы (C0 + DEL): запрещены во всех текстовых полях.
const controlCharPattern = /[\u0000-\u001f\u007f]/;
// Базовый формат email: ровно один @, точка в доменной части, без пробелов/@.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailMinLength = 3;
const emailMaxLength = 254;
const nameMinLength = 1;
const nameMaxLength = 160;
// Сырой токен сброса — hex-подобная непустая строка ограниченной длины.
const resetTokenPattern = /^[A-Za-z0-9]+$/;
const resetTokenMaxLength = 256;

export type ParsePasswordResult =
  | { ok: true; value: string }
  | { ok: false; error: "weak_password" };

export type ParseRegistrationResult =
  | { ok: true; value: { email: string; password: string; name: string } }
  | { ok: false; error: "invalid_registration_payload" | "weak_password" };

export type ParseResetConfirmResult =
  | { ok: true; value: { token: string; password: string } }
  | { ok: false; error: "invalid_reset_confirm_payload" | "weak_password" };

export type ParseResetRequestResult =
  | { ok: true; value: { email: string } }
  | { ok: false; error: "invalid_email" };

// Проверяет пароль против парольной политики: строка нужной длины без управляющих символов.
export function parsePassword(value: unknown): ParsePasswordResult {
  if (typeof value !== "string") {
    return { ok: false, error: "weak_password" };
  }
  if (
    value.length < PASSWORD_POLICY.minLength ||
    value.length > PASSWORD_POLICY.maxLength ||
    controlCharPattern.test(value)
  ) {
    return { ok: false, error: "weak_password" };
  }
  return { ok: true, value };
}

// Парсит тело самостоятельной регистрации (создание нового тенанта).
// Порядок: сначала структура/email/name → invalid_registration_payload,
// затем пароль через parsePassword → weak_password.
export function parseRegistrationInput(body: unknown): ParseRegistrationResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: "invalid_registration_payload" };
  }
  const record = body as { email?: unknown; password?: unknown; name?: unknown };

  const email = parseEmailValue(record.email);
  if (!email) {
    return { ok: false, error: "invalid_registration_payload" };
  }

  const name = parseSingleLineName(record.name);
  if (!name) {
    return { ok: false, error: "invalid_registration_payload" };
  }

  const password = parsePassword(record.password);
  if (!password.ok) {
    return { ok: false, error: "weak_password" };
  }

  return { ok: true, value: { email, password: password.value, name } };
}

// Парсит тело подтверждения сброса пароля (token + новый пароль).
// Порядок: token (структура/формат) → invalid_reset_confirm_payload, затем пароль → weak_password.
export function parseResetConfirmInput(body: unknown): ParseResetConfirmResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: "invalid_reset_confirm_payload" };
  }
  const record = body as { token?: unknown; password?: unknown };

  if (
    typeof record.token !== "string" ||
    record.token.length < 1 ||
    record.token.length > resetTokenMaxLength ||
    !resetTokenPattern.test(record.token)
  ) {
    return { ok: false, error: "invalid_reset_confirm_payload" };
  }

  const password = parsePassword(record.password);
  if (!password.ok) {
    return { ok: false, error: "weak_password" };
  }

  return { ok: true, value: { token: record.token, password: password.value } };
}

// Парсит тело запроса на сброс пароля: проверяется только формат email.
export function parseResetRequestInput(body: unknown): ParseResetRequestResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: "invalid_email" };
  }
  const record = body as { email?: unknown };
  const email = parseEmailValue(record.email);
  if (!email) {
    return { ok: false, error: "invalid_email" };
  }
  return { ok: true, value: { email } };
}

// Нормализует и валидирует email; возвращает нормализованное значение либо null.
function parseEmailValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length < emailMinLength ||
    email.length > emailMaxLength ||
    controlCharPattern.test(email) ||
    !emailPattern.test(email)
  ) {
    return null;
  }
  return email;
}

// Нормализует и валидирует однострочное имя; возвращает обрезанное значение либо null.
function parseSingleLineName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (
    name.length < nameMinLength ||
    name.length > nameMaxLength ||
    controlCharPattern.test(name)
  ) {
    return null;
  }
  return name;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
