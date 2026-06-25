// Мультиворонки: чистые правила переходов между стадиями сделки.
//
// Две независимые операции:
//  1) evaluateStageTransition — перенос сделки между стадиями ВНУТРИ одной воронки,
//     разрешённый списком переходов (stage_transitions) и их условиями (гвардами).
//  2) evaluatePipelineChange — перенос сделки в ДРУГУЮ воронку (на её стадию);
//     управляется не переходами, а валидностью целевой воронки/стадии.
//
// Функции чистые: вызывающий резолвит сущности из хранилища и передаёт уже
// найденные значения. Финальность сделки (won_closed/lost_rejected) вычисляет
// вызывающий (apps/api и мок используют общий isFinalOpportunityStatus) и
// передаёт сюда флагом `finalized` — домен не знает о строковых статусах.

// Правило перехода между двумя стадиями одной воронки (зеркало stage_transitions).
export type StageTransitionRule = {
  fromStageId: string;
  toStageId: string;
  requireFeasibilityOk: boolean;
  minProbability: number | null;
};

export type StageTransitionBlockReason =
  | "opportunity_finalized"
  | "cross_pipeline_move"
  | "transition_not_allowed"
  | "condition_probability"
  | "condition_feasibility";

export type StageTransitionDecision =
  | { allowed: true }
  | { allowed: false; reason: StageTransitionBlockReason; message: string };

export type StageTransitionOpportunity = {
  finalized: boolean;
  stageId: string | null;
  pipelineId: string | null;
  probability: number;
  feasibilityStatus: string | null;
};

// Feasibility считается «пройденной» только при статусе "ok"
// (assessOpportunityFeasibility → "ok" | "warning" | "conflict" | "blocked").
const FEASIBILITY_OK = "ok";

export function evaluateStageTransition(input: {
  opportunity: StageTransitionOpportunity;
  targetStage: { id: string; pipelineId: string | null };
  transitions: readonly StageTransitionRule[];
}): StageTransitionDecision {
  const { opportunity, targetStage, transitions } = input;

  if (opportunity.finalized) {
    return {
      allowed: false,
      reason: "opportunity_finalized",
      message: "Сделка завершена — смена стадии недоступна."
    };
  }

  // Перенос на ту же стадию — безопасный no-op, разрешаем.
  if (opportunity.stageId !== null && opportunity.stageId === targetStage.id) {
    return { allowed: true };
  }

  // Перенос на стадию другой воронки — это не переход, а смена воронки.
  if (
    targetStage.pipelineId !== null &&
    opportunity.pipelineId !== null &&
    targetStage.pipelineId !== opportunity.pipelineId
  ) {
    return {
      allowed: false,
      reason: "cross_pipeline_move",
      message:
        "Целевая стадия принадлежит другой воронке — используйте перенос между воронками."
    };
  }

  // Первичная установка стадии (сделка ещё без стадии) — без гвардов перехода.
  if (opportunity.stageId === null) {
    return { allowed: true };
  }

  // Воронка без объявленных переходов не ограничивает переносы — правила переходов
  // включаются опционально (обратная совместимость с одиночными воронками без правил).
  if (transitions.length === 0) {
    return { allowed: true };
  }

  const rule = transitions.find(
    (transition) =>
      transition.fromStageId === opportunity.stageId &&
      transition.toStageId === targetStage.id
  );
  if (!rule) {
    return {
      allowed: false,
      reason: "transition_not_allowed",
      message: "Переход между этими стадиями не разрешён в воронке."
    };
  }

  if (rule.minProbability !== null && opportunity.probability < rule.minProbability) {
    return {
      allowed: false,
      reason: "condition_probability",
      message: `Для перехода требуется вероятность ≥ ${rule.minProbability}% (сейчас ${opportunity.probability}%).`
    };
  }

  if (rule.requireFeasibilityOk && opportunity.feasibilityStatus !== FEASIBILITY_OK) {
    return {
      allowed: false,
      reason: "condition_feasibility",
      message: "Для перехода требуется пройденная проверка реализуемости (статус «ok»)."
    };
  }

  return { allowed: true };
}

export type PipelineChangeBlockReason =
  | "opportunity_finalized"
  | "pipeline_archived"
  | "deal_stage_inactive"
  | "stage_not_in_pipeline";

export type PipelineChangeDecision =
  | { allowed: true }
  | { allowed: false; reason: PipelineChangeBlockReason; message: string };

export function evaluatePipelineChange(input: {
  opportunity: { finalized: boolean };
  targetPipeline: { id: string; status: string };
  targetStage: { pipelineId: string | null; status: string };
}): PipelineChangeDecision {
  const { opportunity, targetPipeline, targetStage } = input;

  if (opportunity.finalized) {
    return {
      allowed: false,
      reason: "opportunity_finalized",
      message: "Сделка завершена — перенос между воронками недоступен."
    };
  }

  if (targetPipeline.status !== "active") {
    return {
      allowed: false,
      reason: "pipeline_archived",
      message: "Целевая воронка архивирована."
    };
  }

  if (targetStage.status !== "active") {
    return {
      allowed: false,
      reason: "deal_stage_inactive",
      message: "Целевая стадия архивирована."
    };
  }

  if (targetStage.pipelineId !== targetPipeline.id) {
    return {
      allowed: false,
      reason: "stage_not_in_pipeline",
      message: "Целевая стадия не принадлежит выбранной воронке."
    };
  }

  return { allowed: true };
}
