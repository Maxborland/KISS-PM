import { Chip } from "@/components/ui/chip";

/** Общие крошки CRM-поверхностей: форматирование сумм, чип статуса, RU-сообщения ошибок. */
export const money = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽` : `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс ₽`);
export const rub = (v: number) => `${v.toLocaleString("ru-RU")} ₽`;

const ERR: Record<string, string> = {
  invalid_client_name: "Укажите название",
  invalid_contact_name: "Укажите имя",
  invalid_contact_email: "Некорректный email",
  invalid_client_id: "Выберите клиента",
  client_not_found: "Клиент не найден или неактивен",
  invalid_product_name: "Укажите название",
  invalid_product_unit: "Укажите единицу измерения",
  invalid_product_price: "Цена — положительное целое",
  client_not_found_404: "Клиент не найден"
};
export const crmErr = (code?: string, fallback?: string) => (code && ERR[code]) || fallback || code || "Ошибка";

export function StatusChip({ status }: { status: "active" | "archived" }) {
  return status === "active" ? (
    <Chip variant="success">Активен</Chip>
  ) : (
    <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-xs)] font-medium text-[var(--muted-soft)]">Архив</span>
  );
}
