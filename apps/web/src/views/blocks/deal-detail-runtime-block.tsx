"use client";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Chip } from "@/components/ui/chip";
import type { Opportunity } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  currency: "RUB",
  maximumFractionDigits: 0,
  style: "currency"
});

const numberFormatter = new Intl.NumberFormat("ru-RU");

export function DealDetailRuntimeBlock({ opportunity }: { opportunity: Opportunity }) {
  return (
    <>
      <RoutePageIntro
        lead={`Живая карточка сделки «${opportunity.title}»: клиент, контакт, сроки, бюджет, трудоёмкость и готовность к передаче в проект.`}
      />
      <div className="u-grid u-grid-2 u-gap-4">
        <CardPanel title="Сделка" subtitle={opportunity.id}>
          <div className="u-flex u-flex-col u-gap-3">
            <CellStack title={opportunity.title} subtitle={opportunity.description ?? "Описание не указано"} />
            <div className="u-flex u-flex-wrap u-gap-2">
              <Chip variant="info">{opportunity.status}</Chip>
              <Chip variant={opportunity.feasibilityStatus === "ready" ? "success" : "warning"}>
                {opportunity.feasibilityStatus ?? "оценка не проверена"}
              </Chip>
            </div>
          </div>
        </CardPanel>
        <CardPanel title="Коммерция" subtitle="Оценка и вероятность">
          <div className="u-grid u-grid-2 u-gap-3">
            <CellStack title={currencyFormatter.format(opportunity.contractValue)} subtitle="Бюджет" />
            <CellStack title={`${opportunity.probability}%`} subtitle="Вероятность" />
            <CellStack title={currencyFormatter.format(opportunity.plannedHourlyRate)} subtitle="Ставка/час" />
            <CellStack title={`${numberFormatter.format(opportunity.plannedHours)} ч`} subtitle="Плановая трудоёмкость" />
          </div>
        </CardPanel>
      </div>
      <CardPanel title="Контекст передачи" subtitle="Клиент, контакт, тип проекта и сроки" flush>
        <DataTable>
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Контакт</th>
              <th>Тип проекта</th>
              <th>Сроки</th>
              <th>Шаблон</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <CellStack title={opportunity.clientName} subtitle={opportunity.clientId ?? "клиент не связан"} />
              </td>
              <td>
                <CellStack
                  title={opportunity.contactName}
                  subtitle={opportunity.primaryContactId ?? "контакт не связан"}
                />
              </td>
              <td>
                <CellStack title={opportunity.projectType} subtitle={opportunity.projectTypeId ?? "тип не связан"} />
              </td>
              <td className="mono">{formatDateRange(opportunity.plannedStart, opportunity.plannedFinish)}</td>
              <td className="mono">{opportunity.templateId ?? "без шаблона"}</td>
            </tr>
          </tbody>
        </DataTable>
      </CardPanel>
      <CardPanel title="Потребность в ролях" subtitle={`${opportunity.demand.length} позиций`} flush>
        <DataTable>
          <thead>
            <tr>
              <th>Позиция</th>
              <th>Часы</th>
            </tr>
          </thead>
          <tbody>
            {opportunity.demand.map((demand) => (
              <tr key={demand.positionId}>
                <td className="mono">{demand.positionId}</td>
                <td>{numberFormatter.format(demand.requiredHours)} ч</td>
              </tr>
            ))}
            {opportunity.demand.length === 0 ? (
              <tr>
                <td colSpan={2}>Потребность в ролях не указана.</td>
              </tr>
            ) : null}
          </tbody>
        </DataTable>
      </CardPanel>
    </>
  );
}

function formatDateRange(start: string, finish: string): string {
  const formatter = new Intl.DateTimeFormat("ru-RU");
  return `${formatter.format(new Date(start))} — ${formatter.format(new Date(finish))}`;
}
