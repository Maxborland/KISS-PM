import { AlertTriangle, Target } from "lucide-react";

import { CellStack } from "@/components/domain/cell-stack";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  MOCK_ACTION_EXECUTIONS,
  MOCK_CONTROL_SIGNALS,
  MOCK_CORRECTIVE_ACTIONS,
  MOCK_KPI_DEFINITIONS,
  MOCK_KPI_EVALUATIONS
} from "@/lib/mock-data/control";
import { formatDate } from "@/lib/mock-data/format";
import { userName } from "@/lib/mock-data/users";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

const KPI = MOCK_KPI_EVALUATIONS.map((evaluation) => {
  const definition = MOCK_KPI_DEFINITIONS.find((item) => item.id === evaluation.definitionId)!;
  return {
    definition,
    evaluation,
    label: definition.label,
    value: `${evaluation.calculatedValue}${definition.unit === "percent" ? "%" : ""}`,
    delta: `${definition.code} · ${definition.period} · v${definition.version}`,
    tone: evaluation.severity
  };
});

export function ProjectKpiBlock() {
  return (
    <>
      <PageIntro
        title={mockProjectScreenTitle("KPI")}
        lead="Показатели и сигналы управления."
        actions={<Button variant="secondary">Открыть управленческую поверхность</Button>}
      />
      <div className="bento">
        {KPI.map((k, i) => (
          <div
            key={k.label}
            className={`bento__cell tile ${i === 0 ? "tile--gradient-warm" : ""} ${i === 1 ? "tile--gradient-cool" : ""}`}
          >
            <div className="tile__head">
              <span className="tile__label">{k.label}</span>
              <span className="tile__icon">
                <Target className="size-4" aria-hidden />
              </span>
            </div>
            <div className="tile__value tile__value--xl">{k.value}</div>
            <div className="tile__sub">{k.delta}</div>
            <div className="tile__sub">
              threshold {k.evaluation.threshold?.operator ?? "—"} {k.evaluation.threshold?.value ?? "—"} · {formatDate(k.evaluation.evaluatedAt)}
            </div>
          </div>
        ))}
        <div className="bento__cell bento__cell--12">
          <CardPanel title="Сигналы контроля" subtitle={`${MOCK_CONTROL_SIGNALS.length} активных`}>
            <ul className="signal-list">
              {MOCK_CONTROL_SIGNALS.map((signal) => (
                <li key={signal.id} className="signal-list__item">
                  <span className={`tile__icon tile__icon--${signal.severity}`}>
                    <AlertTriangle className="size-4" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <div className="u-text-body u-text-strong">{signal.sourceMetric}</div>
                    <div className="u-text-xs u-text-muted">{signal.explanation}</div>
                    <div className="u-text-xs u-text-muted">
                      owner {userName(signal.ownerUserId)} · actions {signal.allowedActions.join(", ")} · proposals {signal.scenarioProposals.length}
                    </div>
                  </div>
                  <Chip variant={signal.severity === "warning" ? "warning" : "info"}>{signal.status}</Chip>
                </li>
              ))}
            </ul>
          </CardPanel>
        </div>
        <div className="bento__cell bento__cell--6">
          <CardPanel title="Corrective actions" subtitle={`${MOCK_CORRECTIVE_ACTIONS.length} action`}>
            {MOCK_CORRECTIVE_ACTIONS.map((action) => (
              <CellStack
                key={action.id}
                title={action.title}
                subtitle={`${action.status} · ${userName(action.responsibleUserId)} · ${action.dueDate ?? "без срока"}`}
              />
            ))}
          </CardPanel>
        </div>
        <div className="bento__cell bento__cell--6">
          <CardPanel title="Action executions" subtitle={`${MOCK_ACTION_EXECUTIONS.length} execution`}>
            {MOCK_ACTION_EXECUTIONS.map((execution) => (
              <CellStack
                key={execution.id}
                title={`${execution.actionType} · ${execution.status}`}
                subtitle={`${execution.targetEntity.type}:${execution.targetEntity.id} · audit ${execution.auditEventId ?? "—"} · ${formatDate(execution.createdAt)}`}
              />
            ))}
          </CardPanel>
        </div>
      </div>
    </>
  );
}
