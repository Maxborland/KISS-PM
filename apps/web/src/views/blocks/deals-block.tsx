"use client";

import { useState } from "react";
import { Plus, Filter } from "lucide-react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Field, FormGrid } from "@/components/domain/form-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SearchPill } from "@/components/ui/search-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { PageIntro } from "@/views/layout/page-intro";
import { demoAction } from "@/views/lib/demo";
import { PrototypeDialog } from "@/views/lib/prototype-dialog";

const STAGES = [
  { id: "lead", title: "Лид" },
  { id: "qual", title: "Квалификация" },
  { id: "proposal", title: "КП" },
  { id: "deal", title: "Договор" },
  { id: "won", title: "Закрыто" }
];

const DEALS = [
  { id: "DEAL-103", title: "Аудит Salesforce", client: "ACME Studio", amount: "320 000 ₽", stage: "lead", owner: { initials: "КБ", color: "c4" as const } },
  { id: "DEAL-107", title: "Портал самообслуживания", client: "ООО «Вектор»", amount: "640 000 ₽", stage: "lead", owner: { initials: "ИИ", color: "c1" as const } },
  { id: "DEAL-101", title: "Внедрение CRM", client: "ООО «Ромашка»", amount: "890 000 ₽", stage: "qual", owner: { initials: "ИИ", color: "c1" as const } },
  { id: "DEAL-108", title: "Интеграция с 1С", client: "АО «Стандарт»", amount: "1 480 000 ₽", stage: "qual", owner: { initials: "АП", color: "c2" as const } },
  { id: "DEAL-102", title: "DataHub KPI", client: "АО «Техно»", amount: "1 240 000 ₽", stage: "proposal", owner: { initials: "АП", color: "c2" as const } },
  { id: "DEAL-104", title: "Продление · 2027", client: "Фабрика #21", amount: "2 100 000 ₽", stage: "deal", owner: { initials: "МД", color: "c5" as const } },
  { id: "DEAL-099", title: "Модуль отчётности", client: "ООО «Альфа»", amount: "560 000 ₽", stage: "won", owner: { initials: "КБ", color: "c4" as const } },
  { id: "DEAL-096", title: "Поддержка 2026", client: "ООО «Ромашка»", amount: "780 000 ₽", stage: "won", owner: { initials: "ИИ", color: "c1" as const } }
];

function stageCount(stageId: string) {
  return DEALS.filter((d) => d.stage === stageId).length;
}

/** Флагманский create-сценарий: реальная модалка создания сделки (прототип, без сохранения). */
function DealCreateDialog() {
  return (
    <PrototypeDialog
      title="Новая сделка"
      description="Заведите возможность в воронке продаж."
      trigger={
        <Button variant="primary">
          <Plus className="size-4" aria-hidden />
          Сделка
        </Button>
      }
      footer={
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button variant="ghost">Отмена</Button>
          </DialogClose>
          <Button variant="primary" {...demoAction("создание сделки")}>
            Создать
          </Button>
        </DialogFooter>
      }
    >
      <FormGrid>
        <Field label="Название" full required htmlFor="d-name">
          <Input id="d-name" placeholder="Внедрение CRM" />
        </Field>
        <Field label="Клиент" htmlFor="d-client">
          <Input id="d-client" placeholder="ООО «Ромашка»" />
        </Field>
        <Field label="Сумма, ₽" htmlFor="d-amount">
          <Input id="d-amount" placeholder="890 000" />
        </Field>
        <Field label="Стадия" htmlFor="d-stage">
          <Select defaultValue="lead">
            <SelectTrigger id="d-stage" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormGrid>
    </PrototypeDialog>
  );
}

export function DealsBlock() {
  const [mode, setMode] = useState<"kanban" | "list" | "forecast">("kanban");

  return (
    <>
      <PageIntro title="Сделки" lead="Воронка продаж и активные возможности." actions={<DealCreateDialog />} />
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
          <SearchPill
            placeholder="Поиск по воронке…"
            className="u-w-240"
            disabled
            title="Демо-прототип: поиск подключится к рабочему приложению"
          />
          <Button variant="secondary" size="sm" disabled title="Демо Storybook: фильтр подключится к API">
            <Filter className="size-4" aria-hidden />
            Фильтр
          </Button>
        </div>
      </div>

      {/* §5: один вид за раз — канбан ИЛИ таблица, не оба сразу. */}
      {mode === "kanban" ? (
        <div className="funnel">
          {STAGES.map((s) => (
            <div key={s.id} className="funnel__col">
              <div className="funnel__head">
                <span className="funnel__title">{s.title}</span>
                <Badge variant="secondary">{stageCount(s.id)}</Badge>
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
                      <Chip variant="info">{s.title}</Chip>
                      <span className="mono u-text-xs u-text-strong">{d.amount}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : mode === "list" ? (
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
            {DEALS.map((d) => (
              <tr key={d.id}>
                <td>
                  <CellStack title={d.title} subtitle={d.id} />
                </td>
                <td>{d.client}</td>
                <td>
                  <Chip variant="info">{STAGES.find((s) => s.id === d.stage)?.title}</Chip>
                </td>
                <td className="mono">{d.amount}</td>
                <td>
                  <BemAvatarStack>
                    <BemAvatar {...d.owner} size="sm" />
                    <BemAvatar initials="ВВ" color="c3" size="sm" />
                  </BemAvatarStack>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <p className="u-text-sm u-text-muted">Прогноз продаж появится в рабочем приложении.</p>
      )}
    </>
  );
}
