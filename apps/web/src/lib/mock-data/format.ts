import type { AvatarColor } from "@/lib/api-types";

const RUB_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

export function formatRub(value: number): string {
  return RUB_FORMATTER.format(value).replace("₽", "₽");
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}

export function formatDateRange(start: string | null, finish: string | null): string {
  return `${formatDate(start)} — ${formatDate(finish)}`;
}

export function formatHours(hours: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(hours)} ч`;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function avatarColorByIndex(index: number): AvatarColor {
  const colors: AvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
  return colors[index % colors.length] ?? "c1";
}
