/** Публичные почтовые домены — не принимаем как «рабочий» контакт B2B-альфы. */
const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "mail.ru",
  "inbox.ru",
  "bk.ru",
  "list.ru",
  "internet.ru",
  "yandex.ru",
  "ya.ru",
  "yandex.com",
  "rambler.ru",
  "lenta.ru",
  "ukr.net",
  "i.ua",
  "meta.ua",
  "gmx.com",
  "gmx.de",
  "web.de",
  "mail.com",
  "aol.com",
  "zoho.com",
  "qq.com",
  "163.com",
  "126.com",
]);

export const WORK_EMAIL_ERROR =
  "Укажите рабочий email на домене компании (не личную почту Gmail, Mail.ru, Яндекс и т.п.)";

export function getEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export function isConsumerEmailDomain(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return true;
  return CONSUMER_EMAIL_DOMAINS.has(domain);
}

export function isWorkEmail(email: string): boolean {
  return !isConsumerEmailDomain(email);
}
