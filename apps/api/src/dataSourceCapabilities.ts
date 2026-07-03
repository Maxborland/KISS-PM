import type { ApiTenantDataSource } from "./apiTypes";

/**
 * Проверяет, что datasource предоставляет ВСЕ перечисленные методы, и сужает тип: возвращает тот же store,
 * но с этими методами как ОБЯЗАТЕЛЬНЫМИ (не optional), либо null если хоть один отсутствует.
 *
 * ApiTenantDataSource объявляет почти все методы опциональными (разные развёртывания дают разные capability),
 * поэтому по всему API повторялся guard `if (!ds.a || !ds.b) return 501` + downstream `ds.a!(...)` / `ds.a?.(...)`
 * (~71 сайт, 37 файлов). Этот хелпер держит «какие capability нужны операции» в ОДНОМ вызове, а сужение типа
 * снимает необходимость в non-null-ассершенах ниже по коду. Вызывающий сам решает форму ответа при null (501).
 */
export function requireCapabilities<K extends keyof ApiTenantDataSource>(
  dataSource: ApiTenantDataSource,
  capabilities: readonly K[]
): (ApiTenantDataSource & Required<Pick<ApiTenantDataSource, K>>) | null {
  for (const capability of capabilities) {
    if (!dataSource[capability]) return null;
  }
  return dataSource as ApiTenantDataSource & Required<Pick<ApiTenantDataSource, K>>;
}
