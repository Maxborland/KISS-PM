/**
 * Env-переменные приходят двумя путями: process.env (реальное окружение,
 * прод/докер) и import.meta.env (Vite подхватывает .env-файл в dev).
 * Пустая строка считается «не задано».
 */
export function readEnv(name: string): string | undefined {
  const fromProcess =
    typeof process !== "undefined" ? process.env?.[name]?.trim() : undefined;
  if (fromProcess) return fromProcess;

  const meta = (import.meta as { env?: Record<string, string | undefined> }).env;
  const fromMeta = meta?.[name]?.trim();
  return fromMeta || undefined;
}
