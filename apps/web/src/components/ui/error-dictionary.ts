export const ERROR_DICTIONARY_KEYS = [
  "network",
  "400",
  "401",
  "403",
  "404",
  "409",
  "422",
  "500",
  "502",
  "503"
] as const;

export type ErrorDictionaryKey = (typeof ERROR_DICTIONARY_KEYS)[number];

export type ErrorDictionaryCtaKind = "retry" | "back" | "support" | "login";

export type ErrorDictionaryEntry = {
  title: string;
  description: string;
  hint?: string;
  ctaLabel: string;
  ctaKind: ErrorDictionaryCtaKind;
};

export const ERROR_DICTIONARY: Record<ErrorDictionaryKey, ErrorDictionaryEntry> = {
  network: {
    title: "Нет соединения",
    description: "Проверьте интернет или VPN и повторите запрос.",
    hint: "Если проблема повторяется, передайте ID обращения в поддержку.",
    ctaLabel: "Повторить",
    ctaKind: "retry"
  },
  "400": {
    title: "Некорректный запрос",
    description: "Данные формы или фильтра не прошли проверку. Исправьте поля и отправьте снова.",
    ctaLabel: "Вернуться",
    ctaKind: "back"
  },
  "401": {
    title: "Сессия истекла",
    description: "Войдите снова, чтобы продолжить работу в рабочей области.",
    ctaLabel: "Войти",
    ctaKind: "login"
  },
  "403": {
    title: "Доступ запрещён",
    description: "Недостаточно прав для этого действия. Обратитесь к администратору арендатора.",
    ctaLabel: "В поддержку",
    ctaKind: "support"
  },
  "404": {
    title: "Не найдено",
    description: "Объект удалён или ссылка устарела. Откройте список и выберите актуальную запись.",
    ctaLabel: "К списку",
    ctaKind: "back"
  },
  "409": {
    title: "Конфликт данных",
    description: "Запись изменила другой пользователь. Обновите страницу и повторите действие.",
    ctaLabel: "Обновить",
    ctaKind: "retry"
  },
  "422": {
    title: "Данные не приняты",
    description: "Сервер не смог применить изменения. Проверьте обязательные поля и бизнес-ограничения.",
    ctaLabel: "Исправить",
    ctaKind: "back"
  },
  "500": {
    title: "Сбой сервера",
    description: "Мы уже видим ошибку в мониторинге. Повторите позже или обратитесь в поддержку с ID.",
    ctaLabel: "Повторить",
    ctaKind: "retry"
  },
  "502": {
    title: "Сервис недоступен",
    description: "Шлюз не получил ответ от API. Подождите минуту и повторите запрос.",
    ctaLabel: "Повторить",
    ctaKind: "retry"
  },
  "503": {
    title: "Технические работы",
    description: "Платформа временно недоступна. Статус обновлений — на странице статуса арендатора.",
    ctaLabel: "Повторить",
    ctaKind: "retry"
  }
};

export function formatErrorCorrelationId(correlationId: string): string {
  const trimmed = correlationId.trim();
  return trimmed.length > 0 ? `ID обращения: ${trimmed}` : "";
}

export function resolveErrorDictionaryEntry(key: ErrorDictionaryKey): ErrorDictionaryEntry {
  return ERROR_DICTIONARY[key];
}

/** Сопоставление HTTP-кода с ключом словаря (неизвестные 5xx → 500). */
export function errorKeyFromStatus(status: number): ErrorDictionaryKey {
  if (status === 400) return "400";
  if (status === 401) return "401";
  if (status === 403) return "403";
  if (status === 404) return "404";
  if (status === 409) return "409";
  if (status === 422) return "422";
  if (status === 502) return "502";
  if (status === 503) return "503";
  if (status >= 500) return "500";
  if (status >= 400) return "400";
  return "network";
}
