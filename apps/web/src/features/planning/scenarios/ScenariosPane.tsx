"use client";

import { useState } from "react";

import { planningApi } from "../planningApi";
import { AcceptRiskDialog } from "./AcceptRiskDialog";

import type { PlanningReadModel } from "@kiss-pm/planning-client";

export function ScenariosPane(props: {
  projectId: string;
  readModel: PlanningReadModel | undefined;
  planVersion: number;
  canPreview: boolean;
  canApply: boolean;
}) {
  const [proposals, setProposals] = useState<Array<Record<string, unknown>>>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [riskScenarioId, setRiskScenarioId] = useState<string | null>(null);

  return (
    <section className="planning-pane" data-testid="planning-scenarios-pane">
      <h2>Сценарии</h2>
      <button
        className="primary-button"
        type="button"
        disabled={!props.canPreview}
        onClick={async () => {
          const overloads =
            (props.readModel?.resourceLoad as { overloads?: Array<Record<string, unknown>> } | undefined)
              ?.overloads ?? [];
          const overload = overloads[0] ?? {
            type: "resource_overload",
            resourceId: "user-alpha-executor",
            date: "2026-06-10",
            overloadMinutes: 120,
            taskIds: []
          };
          const result = await planningApi.previewScenarios(props.projectId, {
            target: overload,
            clientPlanVersion: props.planVersion
          });
          setProposals(result.proposals);
          setExpiresAt(result.expiresAt);
        }}
      >
        Запросить предложения
      </button>
      {expiresAt ? <p className="planning-pane__muted">Действуют до {new Date(expiresAt).toLocaleString("ru-RU")}</p> : null}
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
          setRiskScenarioId(null);
        }}
      />
    </section>
  );
}
