"use client";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { Product } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  currency: "RUB",
  maximumFractionDigits: 0,
  style: "currency"
});

export function ProductsRuntimeBlock({ products }: { products: Product[] }) {
  return (
    <>
      <RoutePageIntro lead="Живой каталог услуг и продуктов для сделок, оценки работ и передачи в проект." />
      <CardPanel title="Продукты" subtitle={`${products.length} записей`} flush>
        {products.length === 0 ? (
          <EmptyState
            title="Продуктов нет"
            description="После настройки услуг и продуктов рабочей области они появятся здесь."
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Тип</th>
                <th>Цена</th>
                <th>Единица</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <CellStack title={product.name} subtitle={product.sku ?? product.id} />
                  </td>
                  <td>{product.type === "service" ? "Услуга" : "Товар"}</td>
                  <td>{currencyFormatter.format(product.price)}</td>
                  <td>{product.unit}</td>
                  <td>
                    <Chip variant={product.status === "active" ? "success" : "warning"}>
                      {product.status === "active" ? "Активен" : "Архив"}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </CardPanel>
    </>
  );
}
