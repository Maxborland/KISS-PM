// Распознавание нарушений уникальности Postgres (SQLSTATE 23505) по имени индекса.
// Единственный владелец этой логики: раньше идентичный обход error.cause был
// продублирован в workspaceUserRoutes.ts и authRegistrationRoutes.ts, из-за чего
// путь приёма приглашения знал не про все индексы и отдавал 500 вместо 4xx.

// Драйверы и обёртки прячут исходную ошибку в error.cause на произвольной глубине,
// поэтому обходим цепочку (ограничение глубины — защита от циклических ссылок).
function uniqueViolationMarker(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 8; depth += 1) {
    const rec = current as {
      code?: unknown;
      constraint?: unknown;
      constraint_name?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (rec.code === "23505") {
      return String(rec.constraint ?? rec.constraint_name ?? rec.message ?? "");
    }
    current = rec.cause;
  }
  return null;
}

// Дубликат клиентского id проекта: PK projects_pkey = (tenant_id, id). Двойной клик,
// сетевой ретрай или скриптовый импорт давали 23505 → необработанный 500.
export function isProjectIdConflict(error: unknown): boolean {
  return uniqueViolationMarker(error)?.includes("projects_pkey") ?? false;
}

// Гонка регистрации одного email (TOCTOU): pre-check прошёл, но глобальный
// uniqueIndex user_credentials_email_uidx отверг параллельную вставку.
export function isCredentialEmailConflict(error: unknown): boolean {
  return uniqueViolationMarker(error)?.includes("user_credentials_email_uidx") ?? false;
}

// Конфликты уникальности пользователя рабочего пространства. Важно: список включает
// ГЛОБАЛЬНЫЙ user_credentials_email_uidx — email уникален по всем тенантам, поэтому
// занятый в чужом тенанте адрес обязан давать 409, а не 500.
export function workspaceUserUniqueConflict(
  error: unknown
): "user_id_taken" | "user_email_taken" | null {
  const marker = uniqueViolationMarker(error);
  if (marker === null) return null;
  if (
    marker.includes("tenant_users_tenant_id_id_uidx") ||
    marker.includes("tenant_users_pkey")
  ) return "user_id_taken";
  if (
    marker.includes("tenant_users_tenant_id_email_uidx") ||
    marker.includes("user_credentials_email_uidx")
  ) return "user_email_taken";
  return null;
}
