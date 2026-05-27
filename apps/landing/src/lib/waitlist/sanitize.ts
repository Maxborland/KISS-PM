/** Удаляет управляющие символы и обрезает пробелы по краям. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Простая защита от разметки в текстовых полях. */
const TAG_LIKE = /<[^>]*>/g;

export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ");
}

/** Нормализация однострочного текста перед валидацией. */
export function sanitizeText(value: string): string {
  return collapseSpaces(
    value.replace(CONTROL_CHARS, "").replace(TAG_LIKE, "").trim(),
  );
}

/** Контекст: те же правила, пустая строка допустима до optional-ветки схемы. */
export function sanitizeOptionalText(value: string): string {
  return sanitizeText(value);
}
