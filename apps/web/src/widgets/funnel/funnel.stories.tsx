import type { Meta, StoryObj } from "@storybook/react";
import { useMemo, useState } from "react";

import type { FunnelDeal, FunnelStage } from "@/widgets/funnel/types";
import { useFunnelState } from "@/widgets/funnel/use-funnel-state";
import {
  DEAL_KANBAN_SORT_OPTIONS,
  DEAL_KANBAN_VIEW_PROFILE,
  DealKanbanCard,
  Kanban,
  KanbanCardViewMenu,
  buildDealKanbanComparators,
  dealToKanbanItem,
  defaultDealKanbanViewState,
  resolveVisibleFields,
  useKanbanOrderedItems,
  type DealKanbanItem,
  type KanbanColumnDef,
  type KanbanColumnSortKey,
  type KanbanColumnSortState
} from "@/widgets/kanban";

const STAGES: FunnelStage[] = [
  { id: "lead", title: "Лид" },
  { id: "qual", title: "Квалификация" },
  { id: "proposal", title: "КП" },
  { id: "deal", title: "Договор" },
  { id: "won", title: "Закрыто" }
];

type StageId = (typeof STAGES)[number]["id"];

const STAGE_LABEL = STAGES.reduce<Record<string, string>>((acc, s) => {
  acc[s.id] = s.title;
  return acc;
}, {});

const COLUMN_TONE: Record<StageId, KanbanColumnDef<StageId>["tone"]> = {
  lead: "neutral",
  qual: "info",
  proposal: "violet",
  deal: "warning",
  won: "success"
};

const COLUMNS: KanbanColumnDef<StageId>[] = STAGES.map((s) => ({
  id: s.id as StageId,
  title: s.title,
  emptyLabel: "Нет сделок",
  tone: COLUMN_TONE[s.id as StageId] ?? "neutral"
}));

const DEALS: FunnelDeal[] = [
  {
    id: "DEAL-101",
    title: "Внедрение CRM",
    client: "ООО «Ромашка»",
    amount: "890 000 ₽",
    stage: "qual",
    probability: 42,
    probabilityTrend: "up",
    owner: { initials: "ИИ", color: "c1" }
  },
  {
    id: "DEAL-102",
    title: "DataHub KPI",
    client: "АО «Техно»",
    amount: "1 240 000 ₽",
    stage: "proposal",
    probability: 68,
    probabilityTrend: "up",
    owner: { initials: "АП", color: "c2" }
  },
  {
    id: "DEAL-103",
    title: "Аудит Salesforce",
    client: "ACME Studio",
    amount: "320 000 ₽",
    stage: "lead",
    probability: 18,
    probabilityTrend: "flat",
    owner: { initials: "КБ", color: "c4" }
  },
  {
    id: "DEAL-104",
    title: "Продление · 2027",
    client: "Фабрика #21",
    amount: "2 100 000 ₽",
    stage: "deal",
    probability: 81,
    probabilityTrend: "down",
    owner: { initials: "МД", color: "c5" }
  },
  {
    id: "DEAL-098",
    title: "Поддержка портала",
    client: "ООО «Север»",
    amount: "540 000 ₽",
    stage: "won",
    probability: 100,
    probabilityTrend: "flat",
    owner: { initials: "ВВ", color: "c3" }
  }
];

function toItem(d: FunnelDeal): DealKanbanItem<StageId> {
  const stageId = d.stage as StageId;
  return dealToKanbanItem(d, { id: stageId, title: STAGE_LABEL[stageId] ?? stageId });
}

function FunnelHarness({
  initialDeals = DEALS,
  query = ""
}: {
  initialDeals?: FunnelDeal[];
  query?: string;
}) {
  const { deals, moveDeal, reorderDeal } = useFunnelState(initialDeals, STAGES);
  const [openId, setOpenId] = useState<string | null>(null);
  const [columnSort, setColumnSort] = useState<KanbanColumnSortState<StageId>>({});
  const [cardView, setCardView] = useState(() => defaultDealKanbanViewState());

  const filtered = useMemo(() => {
    if (!query.trim()) return deals;
    const q = query.toLowerCase();
    return deals.filter(
      (d) => d.title.toLowerCase().includes(q) || d.client.toLowerCase().includes(q)
    );
  }, [deals, query]);

  const items = useMemo(() => filtered.map(toItem), [filtered]);
  const comparators = useMemo(() => buildDealKanbanComparators<DealKanbanItem<StageId>, StageId>(), []);
  const sorted = useKanbanOrderedItems(COLUMNS, items, columnSort, comparators);
  const visibleFields = useMemo(
    () => resolveVisibleFields(DEAL_KANBAN_VIEW_PROFILE, cardView),
    [cardView]
  );

  const handleReorder = (columnId: StageId, fromIndex: number, toIndex: number) => {
    if ((columnSort[columnId] ?? "manual") !== "manual") {
      setColumnSort((prev) => ({ ...prev, [columnId]: "manual" }));
    }
    reorderDeal(columnId, fromIndex, toIndex);
  };

  const handleSortChange = (columnId: StageId, key: KanbanColumnSortKey) => {
    setColumnSort((prev) => ({ ...prev, [columnId]: key }));
  };

  return (
    <div className="u-flex u-flex-col u-gap-3">
      <div className="view-toolbar">
        <KanbanCardViewMenu
          profile={DEAL_KANBAN_VIEW_PROFILE}
          value={cardView}
          onChange={setCardView}
        />
      </div>
      <Kanban<DealKanbanItem<StageId>, StageId>
        boardVariant="funnel"
        columns={COLUMNS}
        items={sorted}
        visibleFields={visibleFields}
        sortOptions={DEAL_KANBAN_SORT_OPTIONS}
        columnSort={columnSort}
        onColumnSortChange={handleSortChange}
        renderCard={(item, ctx) => (
          <DealKanbanCard
            item={item}
            draggable={ctx.draggable}
            isDragging={ctx.isDragging}
            visibleFields={ctx.visibleFields}
            onOpen={setOpenId}
          />
        )}
        onItemMove={(id, toCol, toIndex) => moveDeal(id, toCol, toIndex)}
        onItemReorder={handleReorder}
      />
      {openId ? (
        <p className="u-text-xs u-text-muted" data-testid="open-id">
          Открыта сделка: {openId}
        </p>
      ) : null}
    </div>
  );
}

const meta: Meta<typeof FunnelHarness> = {
  title: "Widgets/Funnel",
  component: FunnelHarness,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof FunnelHarness>;

export const Default: Story = {
  name: "Default",
  render: () => <FunnelHarness />
};

export const EmptyStage: Story = {
  name: "EmptyStage",
  render: () => <FunnelHarness initialDeals={DEALS.filter((d) => d.stage !== "deal")} />
};

export const Filtered: Story = {
  name: "Filtered",
  render: () => <FunnelHarness query="DataHub" />
};
