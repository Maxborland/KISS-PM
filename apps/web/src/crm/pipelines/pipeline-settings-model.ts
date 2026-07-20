/* ============================================================
   Чистые помощники конструктора CRM-воронки (без React/DOM) —
   отделены от диалога, чтобы покрыть логику упорядочивания стадий,
   валидации правил переходов и порядковых номеров юнит-тестами.
   ============================================================ */

import type { DealStage, StageTransition } from "@/crm/lib/crm-client";

// Следующий свободный порядковый номер (sortOrder — положительное целое; максимум + 1).
export function nextSortOrder(items: ReadonlyArray<{ sortOrder: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
}

// Стадии одной воронки в порядке отображения (по sortOrder, затем по id — стабильно).
export function orderedStages(stages: ReadonlyArray<DealStage>, pipelineId: string): DealStage[] {
  return stages
    .filter((s) => s.pipelineId === pipelineId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

// План перестановки стадии на одну позицию: ПОЛНЫЙ новый порядок id стадий воронки.
// Возвращает null, если двигать некуда (край) или стадия не найдена в своей воронке.
//
// Возвращается именно весь порядок, а не пара «поменять sortOrder местами»: сервер применяет
// его одним запросом PATCH /api/workspace/pipelines/:id/stage-order. Прежний план из двух
// {id, sortOrder} применялся клиентом последовательно и всегда падал на immediate-unique
// (tenant_id, pipeline_id, sort_order) — промежуточное состояние нарушало индекс (23505).
export function planStageOrder(
  stages: ReadonlyArray<DealStage>,
  stageId: string,
  direction: "up" | "down"
): string[] | null {
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return null;
  const ordered = orderedStages(stages, stage.pipelineId ?? "");
  const index = ordered.findIndex((s) => s.id === stageId);
  if (index < 0) return null;
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= ordered.length) return null;
  const ids = ordered.map((s) => s.id);
  [ids[index], ids[neighborIndex]] = [ids[neighborIndex]!, ids[index]!];
  return ids;
}

// minProbability из формы: пусто → правило без порога (null); иначе целое 0..100.
export function parseMinProbabilityInput(value: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return { ok: false };
  return { ok: true, value: parsed };
}

// Можно ли создать правило перехода: обе стадии выбраны, различны и пары ещё нет в воронке.
export function canCreateTransition(
  transitions: ReadonlyArray<StageTransition>,
  pipelineId: string,
  fromStageId: string,
  toStageId: string
): boolean {
  if (!fromStageId || !toStageId || fromStageId === toStageId) return false;
  return !transitions.some(
    (t) => t.pipelineId === pipelineId && t.fromStageId === fromStageId && t.toStageId === toStageId
  );
}
