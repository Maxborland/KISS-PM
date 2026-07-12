import { Chip } from "@/components/ui/chip";
import { makeRuError } from "@/lib/error-messages";
import type { Opportunity } from "@/crm/lib/crm-client";
export { money, rub } from "./money";

// Канонические RU-подписи статуса сделки и осуществимости (каноника — карточка
// сделки /crm/deals/[id]); поверхности импортируют отсюда, а не копируют словари.
export const OPPORTUNITY_STATUS_LABEL: Record<Opportunity["status"], string> = {
  new: "Новая",
  feasibility: "Проверка",
  ready_to_activate: "Готова к запуску",
  won_closed: "Выиграна",
  lost_rejected: "Проиграна"
};
export const FEASIBILITY_LABEL: Record<string, string> = {
  ok: "Реализуема",
  warning: "С оговорками",
  conflict: "Конфликт ресурсов",
  blocked: "Заблокирована"
};

/** Общие крошки CRM-поверхностей: форматирование сумм, чип статуса, RU-сообщения ошибок. */
const ERR: Record<string, string> = {
  // permission_missing — из COMMON_ERR
  invalid_client_name: "Укажите название",
  invalid_contact_name: "Укажите имя",
  invalid_contact_email: "Некорректный email",
  contact_email_taken: "Контакт с таким email уже есть",
  invalid_client_id: "Выберите клиента",
  client_not_found: "Клиент не найден или неактивен",
  invalid_product_name: "Укажите название",
  invalid_product_unit: "Укажите единицу измерения",
  invalid_product_price: "Цена — положительное целое"
};
export const crmErr = makeRuError(ERR);

export function StatusChip({ status }: { status: "active" | "archived" }) {
  return status === "active" ? (
    <Chip variant="success">Активен</Chip>
  ) : (
    <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-xs)] font-medium text-[var(--muted-soft)]">Архив</span>
  );
}
