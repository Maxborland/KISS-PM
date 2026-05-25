"use client";

import { useState } from "react";
import { Plus, Filter } from "lucide-react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { SearchPill } from "@/components/ui/search-pill";
import { PageIntro } from "@/views/layout/page-intro";

const STAGES = [
  { id: "lead", title: "Лид", count: 12 },
  { id: "qual", title: "Квалификация", count: 7 },
  { id: "proposal", title: "КП", count: 4 },
  { id: "deal", title: "Договор", count: 3 },
  { id: "won", title: "Закрыто", count: 18 }
];

const DEALS = [
  { id: "DEAL-101", title: "Внедрение CRM", client: "ООО «Ромашка»", amount: "890 000 ₽", stage: "qual", owner: { initials: "ИИ", color: "c1" as const } },
  { id: "DEAL-102", title: "DataHub KPI", client: "АО «Техно»", amount: "1 240 000 ₽", stage: "proposal", owner: { initials: "АП", color: "c2" as const } },
  { id: "DEAL-103", title: "Аудит Salesforce", client: "ACME Studio", amount: "320 000 ₽", stage: "lead", owner: { initials: "КБ", color: "c4" as const } },
  { id: "DEAL-104", title: "Продление · 2027", client: "Фабрика #21", amount: "2 100 000 ₽", stage: "deal", owner: { initials: "МД", color: "c5" as const } },
  { id: "DEAL-098", title: "Поддержка портала", client: "ООО «Север»", amount: "540 000 ₽", stage: "won", owner: { initials: "ВВ", color: "c3" as const } },
  { id: "DEAL-099", title: "Обучение команды", client: "АО «Техно»", amount: "180 000 ₽", stage: "won", owner: { initials: "АП", color: "c2" as const } }
];

export function DealsBlock() {
  const [mode, setMode] = useState<"kanban" | "list" | "forecast">("kanban");

  return (
    <>
      <PageIntro
        title="Сделки"
        lead="Воронка продаж и активные возможности."
        actions={
          <Button variant="primary">
            <Plus className="size-4" aria-hidden />
            Сделка
          </Button>
        }
      />
      <div className="view-toolbar">
        <Segmented
          name="deals-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "kanban", label: "Канбан" },
            { value: "list", label: "Список" },
            { value: "forecast", label: "Прогноз" }
          ]}
        />
        <div className="view-toolbar__filters">
          <SearchPill placeholder="Сделки, клиенты…" className="u-w-240" />
          <Button variant="secondary" size="sm" disabled title="Демо Storybook: фильтр подключится к API">
            <Filter className="size-4" aria-hidden />
            Фильтр
          </Button>
        </div>
      </div>
      {mode === "kanban" ? (
        <div className="funnel">
          {STAGES.map((s) => (
            <div key={s.id} className="funnel__col">
              <div className="funnel__head">
                <span className="funnel__title">{s.title}</span>
                <Badge variant="secondary">{s.count}</Badge>
              </div>
              <div className="funnel__body">
                {DEALS.filter((d) => d.stage === s.id).map((d) => (
                  <article key={d.id} className="deal-card">
                    <div className="deal-card__head">
                      <span className="deal-card__id mono">{d.id}</span>
                      <BemAvatar {...d.owner} size="sm" />
                    </div>
                    <h3 className="deal-card__title">{d.title}</h3>
                    <p className="deal-card__client">{d.client}</p>
                    <div className="deal-card__foot">
                      <Chip variant={s.id === "won" ? "success" : "info"}>{s.title}</Chip>
                      <span className="mono u-text-xs u-text-strong">{d.amount}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {mode === "list" ? (
        <>
          <p className="u-text-sm u-text-muted u-mb-3">Список сделок (демо переключения).</p>
          <DataTable>
            <thead>
              <tr>
                <th>Сделка</th>
                <th>Клиент</th>
                <th>Стадия</th>
                <th>Сумма</th>
                <th>Команда</th>
              </tr>
            </thead>
            <tbody>
              {DEALS.map((d) => {
                const stage = STAGES.find((s) => s.id === d.stage);
                return (
                  <tr key={d.id}>
                    <td>
                      <CellStack title={d.title} subtitle={d.id} />
                    </td>
                    <td>{d.client}</td>
                    <td>
                      <Chip variant={d.stage === "won" ? "success" : "info"}>{stage?.title}</Chip>
                    </td>
                    <td className="mono">{d.amount}</td>
                    <td>
                      <BemAvatarStack>
                        <BemAvatar {...d.owner} size="sm" />
                        <BemAvatar initials="ВВ" color="c3" size="sm" />
                      </BemAvatarStack>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </>
      ) : null}
      {mode === "forecast" ? (
        <p className="u-text-sm u-text-muted">Прогноз продаж (демо переключения).</p>
      ) : null}
    </>
  );
}
