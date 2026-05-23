"use client";

import { useState } from "react";

import { planningApi } from "../planningApi";
import { AcceptRiskDialog } from "./AcceptRiskDialog";
import { ScenariosCompareTable } from "./ScenariosCompareTable";

import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { readResourceOverloads } from "../planningReadModelAccess";

export function ScenariosPane(props: {
  projectId: string;
  readModel: PlanningReadModel | undefined;
  planVersion: number;
  canPreview: boolean;
  canApply: boolean;
  onScenarioApplied?: () => void | Promise<void>;
}) {
  const [proposals, setProposals] = useState<Array<Record<string, unknown>>>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [riskScenarioId, setRiskScenarioId] = useState<string | null>(null);
  const overloads = readResourceOverloads(props.readModel);
  const previewTarget = overloads[0];

  return (
    <section className="planning-pane" data-testid="planning-scenarios-pane">
      <h2>Сценарии</h2>
      <button
        className="primary-button"
        type="button"
        disabled={!props.canPreview || !previewTarget}
        title={
          !props.canPreview
            ? "Нет права на предпросмотр сценариев"
            : !previewTarget
              ? "В плане нет перегрузок ресурсов для сценария"
              : undefined
        }
        onClick={async () => {
          if (!previewTarget) return;
          const result = await planningApi.previewScenarios(props.projectId, {
            target: previewTarget,
            clientPlanVersion: props.planVersion
          });
          setProposals(result.proposals);
          setExpiresAt(result.expiresAt);
        }}
      >
        Запросить предложения
      </button>
      {expiresAt ? <p className="planning-pane__muted">Действуют до {new Date(expiresAt).toLocaleString("ru-RU")}</p> : null}
      <ScenariosCompareTable proposals={proposals} />
      <ul className="planning-scenario-list">
        {proposals.map((proposal) => (
          <li key={String(proposal.id)}>
            <strong>{String(proposal.profile ?? proposal.id)}</strong>
            <button
              className="secondary-button"
              type="button"
              disabled={!props.canApply}
              onClick={() => setRiskScenarioId(String(proposal.id))}
            >
              Применить
            </button>
          </li>
        ))}
      </ul>
      <AcceptRiskDialog
        open={riskScenarioId !== null}
        onClose={() => setRiskScenarioId(null)}
        onConfirm={async (reason) => {
          if (!riskScenarioId) return;
          await planningApi.applyScenario(props.projectId, riskScenarioId, {
            clientPlanVersion: props.planVersion,
            acceptedRiskReason: reason
          });
          setProposals([]);
          setExpiresAt(null);
          setRiskScenarioId(null);
          await props.onScenarioApplied?.();
        }}
      />
    </section>
  );
}
