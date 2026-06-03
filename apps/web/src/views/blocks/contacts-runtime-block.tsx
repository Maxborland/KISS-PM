"use client";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { Contact } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export function ContactsRuntimeBlock({ contacts }: { contacts: Contact[] }) {
  return (
    <>
      <RoutePageIntro lead="Живой справочник контактных лиц: клиент, роль, каналы связи и статус." />
      <CardPanel title="Контакты" subtitle={`${contacts.length} записей`} flush>
        {contacts.length === 0 ? (
          <EmptyState
            title="Контактов нет"
            description="После добавления контактных лиц рабочей области они появятся здесь."
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Контакт</th>
                <th>Клиент</th>
                <th>Роль</th>
                <th>Каналы связи</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <CellStack title={contact.name} subtitle={contact.id} />
                  </td>
                  <td className="mono">{contact.clientId}</td>
                  <td>{contact.role ?? "—"}</td>
                  <td>
                    <CellStack title={contact.email ?? "—"} subtitle={`${contact.phone ?? "—"} · ${contact.telegram ?? "—"}`} />
                  </td>
                  <td>
                    <Chip variant={contact.status === "active" ? "success" : "warning"}>
                      {contact.status === "active" ? "Активен" : "Архив"}
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
