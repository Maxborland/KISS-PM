"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useMemo, useState } from "react";

import type { FunnelDeal, FunnelStage } from "@/widgets/funnel/types";
import { parseDealAmount } from "@/widgets/kanban/deal-kanban-profiles";

export type UseFunnelStateResult = {
  deals: FunnelDeal[];
  setDeals: (deals: FunnelDeal[]) => void;
  /** Перемещает сделку в стадию `toStageId` на позицию `toIndex` (по умолчанию — в конец). */
  moveDeal: (dealId: string, toStageId: string, toIndex?: number) => void;
  /** Меняет порядок сделок внутри одной стадии. */
  reorderDeal: (stageId: string, fromIndex: number, toIndex: number) => void;
  addDeal: (deal: FunnelDeal) => void;
  countByStage: Record<string, number>;
  amountByStage: Record<string, number>;
};

function groupByStage(deals: FunnelDeal[], stages: FunnelStage[]): Record<string, FunnelDeal[]> {
  const by: Record<string, FunnelDeal[]> = {};
  for (const s of stages) by[s.id] = [];
  for (const d of deals) {
    const bucket = by[d.stage];
    if (bucket) bucket.push(d);
  }
  return by;
}

function flatten(by: Record<string, FunnelDeal[]>, stages: FunnelStage[]): FunnelDeal[] {
  return stages.flatMap((s) => by[s.id] ?? []);
}

export function useFunnelState(
  initialDeals: FunnelDeal[],
  stages: FunnelStage[]
): UseFunnelStateResult {
  const [deals, setDeals] = useState<FunnelDeal[]>(initialDeals);

  const moveDeal = useCallback(
    (dealId: string, toStageId: string, toIndex?: number) => {
      setDeals((prev) => {
        const item = prev.find((d) => d.id === dealId);
        if (!item) return prev;
        const without = prev.filter((d) => d.id !== dealId);
        const by = groupByStage(without, stages);
        const targetBucket = by[toStageId] ?? [];
        const insertAt = toIndex == null ? targetBucket.length : Math.max(0, Math.min(toIndex, targetBucket.length));
        targetBucket.splice(insertAt, 0, { ...item, stage: toStageId });
        by[toStageId] = targetBucket;
        return flatten(by, stages);
      });
    },
    [stages]
  );

  const reorderDeal = useCallback(
    (stageId: string, fromIndex: number, toIndex: number) => {
      setDeals((prev) => {
        const by = groupByStage(prev, stages);
        const bucket = by[stageId];
        if (!bucket || fromIndex === toIndex) return prev;
        by[stageId] = arrayMove(bucket, fromIndex, toIndex);
        return flatten(by, stages);
      });
    },
    [stages]
  );

  const addDeal = useCallback((deal: FunnelDeal) => {
    setDeals((prev) => [deal, ...prev]);
  }, []);

  const { countByStage, amountByStage } = useMemo(() => {
    const counts: Record<string, number> = {};
    const amounts: Record<string, number> = {};
    for (const stage of stages) {
      counts[stage.id] = 0;
      amounts[stage.id] = 0;
    }
    for (const d of deals) {
      counts[d.stage] = (counts[d.stage] ?? 0) + 1;
      amounts[d.stage] = (amounts[d.stage] ?? 0) + parseDealAmount(d.amount);
    }
    return { countByStage: counts, amountByStage: amounts };
  }, [deals, stages]);

  return { deals, setDeals, moveDeal, reorderDeal, addDeal, countByStage, amountByStage };
}
