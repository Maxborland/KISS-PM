import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function formatDateShort(value: string | null | undefined): string {
  const date = parseApiDate(value);
  if (!date) return "—";
  return format(date, "d MMM yyyy", { locale: ru });
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseApiDate(value);
  if (!date) return "—";
  return format(date, "d MMM yyyy, HH:mm", { locale: ru });
}

export function formatRelative(value: string | null | undefined): string {
  const date = parseApiDate(value);
  if (!date) return "—";
  return formatDistanceToNow(date, { addSuffix: true, locale: ru });
}

export function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  }).format(value);
}
