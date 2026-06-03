"use client";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { Client } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export function ClientsRuntimeBlock({ clients }: { clients: Client[] }) {
  return (
    <>
      <RoutePageIntro lead="Живой справочник клиентов рабочей области: юридические лица, статус и дата обновления." />
      <CardPanel title="Клиенты" subtitle={`${clients.length} записей`} flush>
        {clients.length === 0 ? (
          <EmptyState
            title="Клиентов нет"
            description="После добавления клиентов рабочей области они появятся здесь."
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Описание</th>
                <th>Статус</th>
                <th>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <CellStack title={client.name} subtitle={client.id} />
                  </td>
                  <td>{client.description ?? "—"}</td>
                  <td>
                    <Chip variant={client.status === "active" ? "success" : "warning"}>
                      {client.status === "active" ? "Активен" : "Архив"}
                    </Chip>
                  </td>
                  <td className="mono">{formatClientDate(client.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </CardPanel>
    </>
  );
}

function formatClientDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}
