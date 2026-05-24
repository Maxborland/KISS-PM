import type { ScenarioProposal, ScenarioTarget } from "@kiss-pm/domain";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../api";
import type {
  PlanningScenarioApplyEnvelope,
  PlanningScenarioApplyResponse,
  PlanningScenarioPreviewResponse
} from "./planningApi";
import { formatPlanningHours } from "./planningFormatters";
import type { PlanningReadModel } from "./planningReadModelMapper";
import { scenarioTargetKey } from "./planningScenarioTarget";
import "./planningWorkspace.css";

export function PlanningScenarioPanel(props: {
  readModel: PlanningReadModel;
  target: ScenarioTarget | null;
  canPreviewScenarios: boolean;
  canApplyScenarios: boolean;
  isPreviewPending: boolean;
  isApplyPending: boolean;
  onPreview: (target: ScenarioTarget) => Promise<PlanningScenarioPreviewResponse>;
  onApply: (
    proposalId: string,
    envelope: PlanningScenarioApplyEnvelope
  ) => Promise<PlanningScenarioApplyResponse>;
  onApplied: (message: string) => void;
}) {
  const [preview, setPreview] = useState<PlanningScenarioPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [applyError, setApplyError] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [acceptedRiskReason, setAcceptedRiskReason] = useState("");
  const selectedProposal = useMemo(
    () => preview?.proposals.find((proposal) => proposal.id === selectedProposalId) ?? preview?.proposals[0] ?? null,
    [preview, selectedProposalId]
  );
  const requiresReason = selectedProposal ? proposalRequiresAcceptedRiskReason(selectedProposal) : false;
  const targetKey = props.target ? scenarioTargetKey(props.target) : null;

  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    setApplyError("");
    setSelectedProposalId(null);
    setAcceptedRiskReason("");
  }, [targetKey]);

  async function previewScenarios() {
    if (!props.target) return;
    setPreviewError("");
    setApplyError("");
    try {
      const response = await props.onPreview(props.target);
      setPreview(response);
      setSelectedProposalId(response.proposals[0]?.id ?? null);
    } catch (error) {
      setPreview(null);
      setSelectedProposalId(null);
      setPreviewError(errorMessage(error));
    }
  }

  async function applyScenario() {
    if (!selectedProposal || !preview) return;
    setApplyError("");
    try {
      const envelope: PlanningScenarioApplyEnvelope = {
        clientPlanVersion: preview.planVersion
      };
      if (requiresReason) envelope.acceptedRiskReason = acceptedRiskReason.trim();
      await props.onApply(selectedProposal.id, envelope);
      setPreview(null);
      setSelectedProposalId(null);
      setAcceptedRiskReason("");
      props.onApplied("Сценарий применен, planning read model обновлен.");
    } catch (error) {
      setApplyError(errorMessage(error));
    }
  }

  const previewDisabledReason = scenarioPreviewDisabledReason(props);
  const applyDisabledReason = scenarioApplyDisabledReason({
    canApplyScenarios: props.canApplyScenarios,
    selectedProposal,
    requiresReason,
    acceptedRiskReason,
    isApplyPending: props.isApplyPending
  });

  return (
    <section className="planning-side-panel planning-scenario-panel">
      <div>
        <h3>Сценарии</h3>
        <p className="muted">Сравнение вариантов от backend-движка сценариев.</p>
      </div>
      {props.target ? (
        <div className="planning-scenario-target">
          <strong>{props.target.resourceId} / {props.target.date}</strong>
          <span>{formatPlanningHours(props.target.overloadMinutes)} перегруза, {props.target.taskIds.length} задач</span>
        </div>
      ) : (
        <p className="muted">Выберите перегруз в ресурсной матрице, чтобы построить варианты.</p>
      )}
      <button
        className="secondary-button compact"
        disabled={Boolean(previewDisabledReason)}
        title={previewDisabledReason ?? "Сгенерировать варианты сценария"}
        type="button"
        onClick={() => void previewScenarios()}
      >
        Сгенерировать
      </button>
      {previewError ? <p className="planning-form-error">{previewError}</p> : null}
      {preview ? (
        <>
          <div className="planning-scenario-meta">
            <span className="toolbar-chip">planVersion {preview.planVersion}</span>
            <span className="toolbar-chip">{preview.engineVersion}</span>
            <span className="toolbar-chip">до {preview.expiresAt}</span>
          </div>
          {preview.proposals.length === 0 ? (
            <p className="muted">Backend не вернул применимых сценариев для этого конфликта.</p>
          ) : (
            <div className="planning-scenario-list">
              {preview.proposals.map((proposal) => (
                <button
                  className={
                    proposal.id === selectedProposal?.id
                      ? "planning-scenario-card active"
                      : "planning-scenario-card"
                  }
                  key={proposal.id}
                  type="button"
                  onClick={() => setSelectedProposalId(proposal.id)}
                >
                  <strong>{formatScenarioProfile(proposal.profile)}</strong>
                  <span>{formatConflictEffect(proposal.conflictEffect)}</span>
                  <small>
                    Финиш {proposal.explainability.finishDate ?? "не рассчитан"},
                    перегруз {formatPlanningHours(proposal.explainability.overloadMinutes)},
                    риск {proposal.explainability.riskScore}
                  </small>
                  <small>
                    Задачи {proposal.explainability.changedTaskIds.length},
                    назначения {proposal.explainability.changedAssignmentIds.length},
                    согласований {proposal.explainability.requiredApprovals.length}
                  </small>
                </button>
              ))}
            </div>
          )}
          {selectedProposal ? (
            <div className="planning-scenario-detail">
              <h4>Цена решения</h4>
              <dl>
                <div>
                  <dt>Сдвиг дедлайна</dt>
                  <dd>{selectedProposal.explainability.deadlineDeltaDays} дн.</dd>
                </div>
                <div>
                  <dt>Затронутые ресурсы</dt>
                  <dd>{selectedProposal.explainability.overloadedResourceIds.join(", ") || "нет"}</dd>
                </div>
                <div>
                  <dt>Команды</dt>
                  <dd>{selectedProposal.planDelta.commands.map((command) => command.type).join(", ")}</dd>
                </div>
              </dl>
              {selectedProposal.explainability.dependencyWarnings.length > 0 ? (
                <p className="planning-form-error">
                  {selectedProposal.explainability.dependencyWarnings.join("; ")}
                </p>
              ) : null}
              {requiresReason ? (
                <label className="planning-form-field">
                  <span>Причина принятия риска</span>
                  <textarea
                    minLength={3}
                    onChange={(event) => setAcceptedRiskReason(event.target.value)}
                    placeholder="Почему перегруз принимается управленчески"
                    rows={3}
                    value={acceptedRiskReason}
                  />
                </label>
              ) : null}
              <button
                className="primary-button compact"
                disabled={Boolean(applyDisabledReason)}
                title={applyDisabledReason ?? "Применить выбранный сценарий"}
                type="button"
                onClick={() => void applyScenario()}
              >
                Применить сценарий
              </button>
              {applyError ? <p className="planning-form-error">{applyError}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function proposalRequiresAcceptedRiskReason(proposal: ScenarioProposal): boolean {
  return proposal.planDelta.commands.some((command) => command.type === "risk.accept_overload");
}

function scenarioPreviewDisabledReason(props: {
  target: ScenarioTarget | null;
  canPreviewScenarios: boolean;
  isPreviewPending: boolean;
}): string | null {
  if (!props.target) return "Сначала выберите перегруз";
  if (!props.canPreviewScenarios) return "Нужно право tenant.planning_scenarios.preview";
  if (props.isPreviewPending) return "Генерация сценариев уже выполняется";
  return null;
}

function scenarioApplyDisabledReason(input: {
  canApplyScenarios: boolean;
  selectedProposal: ScenarioProposal | null;
  requiresReason: boolean;
  acceptedRiskReason: string;
  isApplyPending: boolean;
}): string | null {
  if (!input.selectedProposal) return "Сначала выберите вариант";
  if (!input.canApplyScenarios) return "Нужно право tenant.planning_scenarios.apply";
  if (input.requiresReason && input.acceptedRiskReason.trim().length < 3) {
    return "Нужна причина принятия риска";
  }
  if (input.isApplyPending) return "Применение сценария уже выполняется";
  return null;
}

function formatScenarioProfile(profile: ScenarioProposal["profile"]): string {
  if (profile === "aggressive") return "Aggressive";
  if (profile === "balanced") return "Balanced";
  return "Resilient";
}

function formatConflictEffect(effect: ScenarioProposal["conflictEffect"]): string {
  if (effect === "accepted") return "Риск принят";
  if (effect === "reduced") return "Перегруз снижен";
  return "Перегруз снят";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "accepted_risk_reason_required") return "Backend требует причину принятия риска.";
    if (error.code === "plan_version_conflict") return "Версия плана устарела. Обновите read model.";
    if (error.code === "scenario_expired") return "Сценарий истек. Сгенерируйте варианты заново.";
    if (error.code === "planning_scenario_target_mismatch") return "Конфликт изменился. Обновите read model.";
    return `Backend вернул ${error.code}.`;
  }
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить scenario action.";
}
