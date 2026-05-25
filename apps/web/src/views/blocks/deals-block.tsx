"use client";

import { useMemo, useState } from "react";
import { Filter, Plus } from "lucide-react";
import { toast } from "sonner";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SearchPill } from "@/components/ui/search-pill";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { formatDate, formatDateRange, formatHours, formatRub } from "@/lib/mock-data/format";
import { MOCK_OPPORTUNITIES } from "@/lib/mock-data/deals";
import { MOCK_DEAL_STAGES } from "@/lib/mock-data/crm";
import { MOCK_TENANT_ID, positionName, userAvatar, userName } from "@/lib/mock-data/users";
import { useFunnelState } from "@/widgets/funnel";
import type { FunnelDeal, FunnelStage } from "@/widgets/funnel";
import {
  DealKanbanCard,
  DEAL_KANBAN_SORT_OPTIONS,
  DEAL_KANBAN_VIEW_PROFILE,
  Kanban,
  KanbanCardViewMenu,
  buildDealKanbanComparators,
  defaultDealKanbanViewState,
  resolveVisibleFields,
  useKanbanOrderedItems,
  type DealKanbanItem,
  type KanbanColumnAction,
  type KanbanColumnDef,
  type KanbanColumnSortKey,
  type KanbanColumnSortState
} from "@/widgets/kanban";
import { PageIntro } from "@/views/layout/page-intro";

const STAGES: FunnelStage[] = MOCK_DEAL_STAGES
  .filter((stage) => stage.status === "active")
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((stage) => ({ id: stage.id, title: stage.name }));

type StageId = (typeof STAGES)[number]["id"];

const STAGE_TONE: Record<string, "info" | "success" | "warning" | "violet"> = {
  lead: "violet",
  qual: "info",
  proposal: "info",
  deal: "warning",
  won: "success"
};

const STAGE_LABEL = STAGES.reduce<Record<string, string>>((acc, s) => {
  acc[s.id] = s.title;
  return acc;
}, {});

const INITIAL_DEALS: FunnelDeal[] = MOCK_OPPORTUNITIES.map((opportunity) => ({
  ...opportunity,
  client: opportunity.clientName,
  amount: formatRub(opportunity.contractValue),
  stage: opportunity.stageId ?? "lead",
  owner: userAvatar(opportunity.ownerUserId)
}));

type DealDraft = {
  title: string;
  clientName: string;
  contactName: string;
  contractValue: string;
  plannedHourlyRate: string;
  plannedStart: string;
  plannedFinish: string;
  probability: string;
  projectType: string;
  description: string;
  stage: string;
};

const EMPTY_DEAL_DRAFT: DealDraft = {
  title: "",
  clientName: "",
  contactName: "",
  contractValue: "",
  plannedHourlyRate: "5000",
  plannedStart: "2026-06-01",
  plannedFinish: "2026-07-15",
  probability: "50",
  projectType: "CRM внедрение",
  description: "",
  stage: STAGES[0]!.id
};

const RUB_FORMATTER = new Intl.NumberFormat("ru-RU");

function matchesQuery(deal: FunnelDeal, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    deal.title.toLowerCase().includes(q) ||
    deal.client.toLowerCase().includes(q) ||
    deal.id.toLowerCase().includes(q)
  );
}

function toKanbanItem(deal: FunnelDeal): DealKanbanItem<StageId> {
  const stageId = deal.stage as StageId;
  return {
    id: deal.id,
    columnId: stageId,
    title: deal.title,
    client: deal.client,
    contactName: deal.contactName ?? "Контакт не указан",
    amount: deal.amount,
    probability: deal.probability ?? 0,
    plannedFinish: deal.plannedFinish ?? new Date().toISOString(),
    plannedHours: deal.plannedHours ?? 0,
    feasibilityStatus: deal.feasibilityStatus ?? null,
    projectType: deal.projectType ?? "Тип не указан",
    owner: deal.owner,
    stageLabel: STAGE_LABEL[stageId] ?? stageId,
    stageTone: STAGE_TONE[stageId] ?? "info"
  };
}

const DEAL_COLUMNS: KanbanColumnDef<StageId>[] = STAGES.map((s) => ({
  id: s.id as StageId,
  title: s.title,
  emptyLabel: "Нет сделок"
}));

const STAGE_ACTION_LABEL: Record<KanbanColumnAction, string> = {
  rename: "Переименовать стадию",
  wip: "Лимит сделок",
  add: "Добавить сделку"
};

export type DealsBlockProps = {
  initialMode?: "kanban" | "list" | "forecast";
  initialDeals?: FunnelDeal[];
};

export function DealsBlock({ initialMode = "kanban", initialDeals = INITIAL_DEALS }: DealsBlockProps = {}) {
  const [mode, setMode] = useState<"kanban" | "list" | "forecast">(initialMode);
  const [query, setQuery] = useState("");
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DealDraft>(EMPTY_DEAL_DRAFT);
  const [columnSort, setColumnSort] = useState<KanbanColumnSortState<StageId>>({});
  const [cardView, setCardView] = useState(() => defaultDealKanbanViewState());

  const { deals, moveDeal, reorderDeal, addDeal, countByStage, amountByStage } = useFunnelState(
    initialDeals,
    STAGES
  );

  const filtered = useMemo(() => deals.filter((d) => matchesQuery(d, query)), [deals, query]);
  const kanbanItems = useMemo(() => filtered.map(toKanbanItem), [filtered]);

  const comparators = useMemo(() => buildDealKanbanComparators<DealKanbanItem<StageId>, StageId>(), []);
  const sortedItems = useKanbanOrderedItems(DEAL_COLUMNS, kanbanItems, columnSort, comparators);
  const visibleFields = useMemo(
    () => resolveVisibleFields(DEAL_KANBAN_VIEW_PROFILE, cardView),
    [cardView]
  );

  const openDeal = useMemo(() => deals.find((d) => d.id === openDealId) ?? null, [deals, openDealId]);

  const handleCreate = () => {
    if (!draft.title.trim()) return;
    const id = `DEAL-NEW-${deals.length + 1}`;
    const contractValue = Number(draft.contractValue.replace(/[^\d]/g, "")) || 0;
    const plannedHourlyRate = Number(draft.plannedHourlyRate.replace(/[^\d]/g, "")) || 1;
    const plannedHours = Math.floor(contractValue / plannedHourlyRate);
    addDeal({
      id,
      tenantId: MOCK_TENANT_ID,
      clientId: null,
      primaryContactId: null,
      ownerUserId: "usr-ivanova",
      projectTypeId: null,
      stageId: draft.stage,
      title: draft.title.trim(),
      clientName: draft.clientName.trim() || "—",
      contactName: draft.contactName.trim() || "Не указан",
      client: draft.clientName.trim() || "—",
      description: draft.description.trim() || null,
      projectType: draft.projectType.trim() || "Не указан",
      plannedStart: `${draft.plannedStart}T00:00:00.000Z`,
      plannedFinish: `${draft.plannedFinish}T00:00:00.000Z`,
      contractValue,
      plannedHourlyRate,
      plannedHours,
      probability: Number(draft.probability) || 0,
      status: "new",
      templateId: null,
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      demand: [],
      customFieldValues: {},
      amount: formatRub(contractValue),
      stage: draft.stage,
      owner: userAvatar("usr-ivanova")
    });
    setDraft(EMPTY_DEAL_DRAFT);
    setCreateOpen(false);
  };

  const handleColumnSortChange = (columnId: StageId, key: KanbanColumnSortKey) => {
    setColumnSort((prev) => ({ ...prev, [columnId]: key }));
  };

  const handleItemReorder = (columnId: StageId, fromIndex: number, toIndex: number) => {
    if ((columnSort[columnId] ?? "manual") !== "manual") {
      setColumnSort((prev) => ({ ...prev, [columnId]: "manual" }));
      toast.info("Ручной порядок", {
        description: `Стадия «${STAGE_LABEL[columnId]}» переключена на ручную сортировку.`
      });
    }
    reorderDeal(columnId, fromIndex, toIndex);
  };

  const handleItemMove = (id: string, toColumnId: StageId, toIndex: number) => {
    moveDeal(id, toColumnId, toIndex);
  };

  const handleColumnAction = (columnId: StageId, action: KanbanColumnAction) => {
    toast.info(`${STAGE_ACTION_LABEL[action]} — ${STAGE_LABEL[columnId]}`, {
      description: "Демо Storybook: действие зафиксировано локально."
    });
  };

  return (
    <>
      <PageIntro
        title="Сделки"
        lead="Воронка продаж и активные возможности."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
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
          <SearchPill
            placeholder="Сделки, клиенты…"
            className="u-w-240"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          {mode === "kanban" ? (
            <KanbanCardViewMenu
              profile={DEAL_KANBAN_VIEW_PROFILE}
              value={cardView}
              onChange={setCardView}
            />
          ) : null}
          <Button variant="secondary" size="sm" disabled title="Демо Storybook: фильтр подключится к API">
            <Filter className="size-4" aria-hidden />
            Фильтр
          </Button>
        </div>
      </div>

      {mode === "kanban" ? (
        <Kanban<DealKanbanItem<StageId>, StageId>
          boardVariant="funnel"
          columns={DEAL_COLUMNS}
          items={sortedItems}
          visibleFields={visibleFields}
          sortOptions={DEAL_KANBAN_SORT_OPTIONS}
          columnSort={columnSort}
          onColumnSortChange={handleColumnSortChange}
          renderCard={(item, ctx) => (
            <DealKanbanCard
              item={item}
              draggable={ctx.draggable}
              isDragging={ctx.isDragging}
              visibleFields={ctx.visibleFields}
              onOpen={setOpenDealId}
            />
          )}
          onItemMove={handleItemMove}
          onItemReorder={handleItemReorder}
          onColumnAction={handleColumnAction}
        />
      ) : null}

      {mode === "list" ? (
        <DealsList deals={filtered} onOpen={setOpenDealId} />
      ) : null}

      {mode === "forecast" ? (
        <DealsForecast stages={STAGES} countByStage={countByStage} amountByStage={amountByStage} />
      ) : null}

      <Sheet open={openDeal != null} onOpenChange={(open) => !open && setOpenDealId(null)}>
        <SheetContent>
          {openDeal ? (
            <>
              <SheetHeader>
                <SheetTitle>{openDeal.title}</SheetTitle>
                <SheetDescription>
                  {openDeal.id} · {openDeal.clientName ?? openDeal.client} · {openDeal.contactName ?? "Контакт не указан"}
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                <div className="u-flex u-flex-col u-gap-3">
                  <div className="u-flex u-items-center u-gap-2">
                    <Chip variant={openDeal.stage === "won" ? "success" : "info"}>
                      {STAGES.find((s) => s.id === openDeal.stage)?.title ?? openDeal.stage}
                    </Chip>
                    <Chip variant={openDeal.feasibilityStatus === "feasible" ? "success" : "warning"}>
                      {openDeal.feasibilityStatus ?? "feasibility не проверен"}
                    </Chip>
                    <span className="mono u-text-sm u-text-strong">{openDeal.amount}</span>
                  </div>
                  <CellStack
                    title={userName(openDeal.ownerUserId)}
                    subtitle={`Ответственный · ${openDeal.projectType ?? "Тип не указан"}`}
                    icon={<BemAvatar {...openDeal.owner} size="sm" />}
                  />
                  <ContractFields
                    rows={[
                      ["Backend id", openDeal.id],
                      ["Tenant", openDeal.tenantId ?? "—"],
                      ["Client id", openDeal.clientId ?? "—"],
                      ["Primary contact id", openDeal.primaryContactId ?? "—"],
                      ["Owner user id", openDeal.ownerUserId ?? "—"],
                      ["Project type id", openDeal.projectTypeId ?? "—"],
                      ["Stage id", openDeal.stageId ?? openDeal.stage],
                      ["Период", formatDateRange(openDeal.plannedStart ?? null, openDeal.plannedFinish ?? null)],
                      ["Ставка", `${formatRub(openDeal.plannedHourlyRate ?? 0)} / ч`],
                      ["Плановые часы", formatHours(openDeal.plannedHours ?? 0)],
                      ["Вероятность", `${openDeal.probability ?? 0}%`],
                      ["Статус", openDeal.status ?? "—"],
                      ["Template id", openDeal.templateId ?? "—"],
                      ["Проверка feasibility", openDeal.feasibilityCheckedAt ? formatDate(openDeal.feasibilityCheckedAt) : "—"],
                      ["Создана", formatDate(openDeal.createdAt ?? null)],
                      ["Обновлена", formatDate(openDeal.updatedAt ?? null)]
                    ]}
                  />
                  {openDeal.description ? (
                    <p className="u-text-sm u-text-muted">{openDeal.description}</p>
                  ) : null}
                  <div className="u-flex u-flex-col u-gap-2">
                    <span className="u-text-xs u-text-muted">Demand</span>
                    {(openDeal.demand ?? []).map((item) => (
                      <div key={item.positionId} className="u-flex u-items-center u-justify-between u-text-sm">
                        <span>{positionName(item.positionId)}</span>
                        <span className="mono">{formatHours(item.requiredHours)}</span>
                      </div>
                    ))}
                  </div>
                  <ContractFields
                    rows={Object.entries(openDeal.customFieldValues ?? {}).map(([key, value]) => [key, value])}
                  />
                </div>
              </SheetBody>
              <SheetFooter>
                <Button variant="secondary" onClick={() => setOpenDealId(null)}>
                  Закрыть
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Новая сделка</SheetTitle>
            <SheetDescription>Демо: добавляется в локальное состояние.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <form
              className="u-flex u-flex-col u-gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleCreate();
              }}
            >
              <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                Название
                <Input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })}
                  placeholder="Например, Внедрение CRM"
                  required
                />
              </label>
              <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                Клиент
                <Input
                  value={draft.clientName}
                  onChange={(event) => setDraft({ ...draft, clientName: event.currentTarget.value })}
                  placeholder="ООО «...»"
                />
              </label>
              <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                Контакт
                <Input
                  value={draft.contactName}
                  onChange={(event) => setDraft({ ...draft, contactName: event.currentTarget.value })}
                  placeholder="ФИО контактного лица"
                />
              </label>
              <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                Сумма договора
                <Input
                  value={draft.contractValue}
                  onChange={(event) => setDraft({ ...draft, contractValue: event.currentTarget.value })}
                  placeholder="500 000 ₽"
                />
              </label>
              <div className="grid-2">
                <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                  План-старт
                  <Input
                    type="date"
                    value={draft.plannedStart}
                    onChange={(event) => setDraft({ ...draft, plannedStart: event.currentTarget.value })}
                  />
                </label>
                <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                  План-финиш
                  <Input
                    type="date"
                    value={draft.plannedFinish}
                    onChange={(event) => setDraft({ ...draft, plannedFinish: event.currentTarget.value })}
                  />
                </label>
              </div>
              <div className="grid-2">
                <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                  Ставка/час
                  <Input
                    value={draft.plannedHourlyRate}
                    onChange={(event) => setDraft({ ...draft, plannedHourlyRate: event.currentTarget.value })}
                  />
                </label>
                <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                  Вероятность, %
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.probability}
                    onChange={(event) => setDraft({ ...draft, probability: event.currentTarget.value })}
                  />
                </label>
              </div>
              <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                Тип проекта
                <Input
                  value={draft.projectType}
                  onChange={(event) => setDraft({ ...draft, projectType: event.currentTarget.value })}
                  placeholder="CRM внедрение"
                />
              </label>
              <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                Описание
                <Input
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.currentTarget.value })}
                  placeholder="Кратко о потребности клиента"
                />
              </label>
              <label className="u-flex u-flex-col u-gap-1 u-text-xs u-text-muted">
                Стадия
                <select
                  className="select"
                  value={draft.stage}
                  onChange={(event) => setDraft({ ...draft, stage: event.currentTarget.value })}
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" hidden />
            </form>
          </SheetBody>
          <SheetFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!draft.title.trim()}>
              Добавить
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DealsList({ deals, onOpen }: { deals: FunnelDeal[]; onOpen: (id: string) => void }) {
  if (deals.length === 0) {
    return <p className="u-text-sm u-text-muted">Ничего не найдено.</p>;
  }
  return (
    <DataTable>
      <thead>
        <tr>
          <th>Сделка</th>
          <th>Клиент</th>
          <th>Контакт</th>
          <th>Стадия</th>
          <th>Сумма</th>
          <th>План</th>
          <th>Команда</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((d) => {
          const stage = STAGES.find((s) => s.id === d.stage);
          return (
            <tr
              key={d.id}
              tabIndex={0}
              role="button"
              aria-label={`Открыть сделку ${d.id}`}
              onClick={() => onOpen(d.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(d.id);
                }
              }}
              className="row-clickable"
            >
              <td>
                <CellStack title={d.title} subtitle={d.id} />
              </td>
              <td>{d.clientName ?? d.client}</td>
              <td>{d.contactName ?? "—"}</td>
              <td>
                <Chip variant={d.stage === "won" ? "success" : "info"}>{stage?.title}</Chip>
              </td>
              <td className="mono">{d.amount}</td>
              <td>
                <CellStack title={`${d.probability ?? 0}%`} subtitle={formatDate(d.plannedFinish ?? null)} />
              </td>
              <td>
                <BemAvatarStack>
                  <BemAvatar {...d.owner} size="sm" />
                </BemAvatarStack>
              </td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

function ContractFields({ rows }: { rows: Array<[string, string]> }) {
  if (rows.length === 0) return null;

  return (
    <dl className="entity-fields">
      {rows.map(([label, value]) => (
        <div key={label} className="entity-fields__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DealsForecast({
  stages,
  countByStage,
  amountByStage
}: {
  stages: FunnelStage[];
  countByStage: Record<string, number>;
  amountByStage: Record<string, number>;
}) {
  return (
    <div className="funnel-forecast">
      {stages.map((s) => (
        <div key={s.id} className="funnel-forecast__card">
          <span className="funnel-forecast__label">{s.title}</span>
          <span className="funnel-forecast__value mono">
            {RUB_FORMATTER.format(amountByStage[s.id] ?? 0)} ₽
          </span>
          <span className="funnel-forecast__hint">{countByStage[s.id] ?? 0} сделок</span>
        </div>
      ))}
    </div>
  );
}
