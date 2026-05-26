import { AlertTriangle, Target } from "lucide-react";
import { useMemo } from "react";

import { CellStack } from "@/components/domain/cell-stack";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { formatDate } from "@/lib/mock-data/format";
import { ScenarioFetchGate, useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { userName } from "@/lib/mock-data/users";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

export function ProjectKpiBlock() {
  const { fixtures } = useScenarioFixtures();
  const kpi = useMemo(
    () =>
      fixtures.kpiEvaluations.map((evaluation) => {
        const definition = fixtures.kpiDefinitions.find((item) => item.id === evaluation.definitionId)!;
        return {
          definition,
          evaluation,
          label: definition.label,
          value: `${evaluation.calculatedValue}${definition.unit === "percent" ? "%" : ""}`,
          delta: `${definition.code} · ${definition.period} · v${definition.version}`,
          tone: evaluation.severity
        };
      }),
    [fixtures.kpiDefinitions, fixtures.kpiEvaluations]
  );

  return (
    <ScenarioFetchGate loadingLabel="Загрузка KPI…">
      <>
        <PageIntro
          title={mockProjectScreenTitle("KPI")}
          lead="Показатели и сигналы управления."
          actions={<Button variant="secondary">Открыть управленческую поверхность</Button>}
        />
        <div className="bento">
          {kpi.map((item, index) => (
            <div
              key={item.label}
              className={`bento__cell tile ${index === 0 ? "tile--gradient-warm" : ""} ${index === 1 ? "tile--gradient-cool" : ""}`}
            >
              <div className="tile__head">
                <span className="tile__label">{item.label}</span>
                <span className="tile__icon">
                  <Target className="size-4" aria-hidden />
                </span>
              </div>
              <div className="tile__value tile__value--xl">{item.value}</div>
              <div className="tile__sub">{item.delta}</div>
              <div className="tile__sub">
                threshold {item.evaluation.threshold?.operator ?? "—"}{" "}
                {item.evaluation.threshold?.value ?? "—"} · {formatDate(item.evaluation.evaluatedAt)}
              </div>
            </div>
          ))}
          <div className="bento__cell bento__cell--12">
            <CardPanel
              title="Сигналы контроля"
              subtitle={`${fixtures.controlSignals.length} активных`}
            >
              <ul className="signal-list">
                {fixtures.controlSignals.map((signal) => (
                  <li key={signal.id} className="signal-list__item">
                    <span className={`tile__icon tile__icon--${signal.severity}`}>
                      <AlertTriangle className="size-4" aria-hidden />
                    </span>
                    <div className="flex-1">
                      <div className="u-text-body u-text-strong">{signal.sourceMetric}</div>
                      <div className="u-text-xs u-text-muted">{signal.explanation}</div>
                      <div className="u-text-xs u-text-muted">
                        owner {userName(signal.ownerUserId)} · actions{" "}
                        {signal.allowedActions.join(", ")} · proposals {signal.scenarioProposals.length}
                      </div>
                    </div>
                    <Chip variant={signal.severity === "warning" ? "warning" : "info"}>
                      {signal.status}
                    </Chip>
                  </li>
                ))}
              </ul>
            </CardPanel>
          </div>
          <div className="bento__cell bento__cell--6">
            <CardPanel
              title="Corrective actions"
              subtitle={`${fixtures.correctiveActions.length} action`}
            >
              {fixtures.correctiveActions.map((action) => (
                <CellStack
                  key={action.id}
                  title={action.title}
                  subtitle={`${action.status} · ${userName(action.responsibleUserId)} · ${action.dueDate ?? "без срока"}`}
                />
              ))}
            </CardPanel>
          </div>
          <div className="bento__cell bento__cell--6">
            <CardPanel
              title="Action executions"
              subtitle={`${fixtures.actionExecutions.length} execution`}
            >
              {fixtures.actionExecutions.map((execution) => (
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
    </ScenarioFetchGate>
  );
}
