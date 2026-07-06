/* ============================================================
   Общий механизм RU-текстов ошибок. Доменные словари остаются в своих
   *-bits (локальность копирайтинга), сюда вынесены:
   - общие транспортно-сессионные коды, продублированные в каждом словаре;
   - фабрика lookup-функции (была скопирована 6 раз).
   Доменный словарь ПЕРЕКРЫВАЕТ общий (спред-порядок) — существующие
   доменные формулировки сохраняются дословно.
   ============================================================ */

export const COMMON_ERR: Record<string, string> = {
  session_required: "Требуется вход в систему",
  permission_missing: "Недостаточно прав для этого действия",
  forbidden: "Доступ запрещён",
  not_found: "Не найдено",
  invalid_json: "Некорректный запрос",
  request_failed: "Не удалось выполнить запрос",
  invalid_json_response: "Некорректный ответ сервера",
  persistence_not_configured: "Хранилище недоступно"
};

export function makeRuError(
  domain: Record<string, string>,
  defaultFallback?: string
): (code?: string, fallback?: string) => string {
  const map = { ...COMMON_ERR, ...domain };
  return (code?: string, fallback?: string) =>
    (code && map[code]) || fallback || defaultFallback || code || "Ошибка";
}
