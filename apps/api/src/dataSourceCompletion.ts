import type { PostgresTenantDataSource } from "@kiss-pm/persistence";

/* ============================================================
   Граница «частичный источник → полный контракт».

   Тип контракта данных обязателен (ApiTenantDataSource =
   PostgresTenantDataSource), но два источника частичны ПО ПОСТРОЕНИЮ и
   это поддерживаемый режим: in-memory fallback (dev без DATABASE_URL)
   и тестовые фикстуры. Их обслуживают in-пробы состава и capability-
   guard'ы маршрутов (включая fail-closed-инварианты вида «нет
   withTransaction → 501 ДО мутации» и ?.-обогащения «нет метода →
   пропустить»). Эта функция — единственное место, где частичность
   легализуется в полный тип; новые частичные источники подключайте
   только через неё.
   ============================================================ */

export function ensureCompleteDataSource(
  partial: Partial<PostgresTenantDataSource>
): PostgresTenantDataSource {
  return partial as PostgresTenantDataSource;
}
