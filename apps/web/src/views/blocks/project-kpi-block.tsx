"use client";

import { AlertTriangle, Target } from "lucide-react";
import { useMemo } from "react";

import { CellStack } from "@/components/domain/cell-stack";
import { CardPanel } from "@/components/domain/card-panel";
import { KpiAccentTile } from "@/components/domain/kpi-accent-tile";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { formatDate } from "@/lib/mock-data/format";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { userName } from "@/lib/mock-data/users";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { DashboardBentoSkeleton } from "@/views/blocks/dashboard-bento-skeleton";
import { ScreenBlockGate } from "@/views/blocks/screen-block-fetch";

export function ProjectKpiBlock() {
  const { fixtures } = useScenarioFixtures();
  const kpi = useMemo(
    () =>
      fixtures.kpiEvaluations.map((evaluation) => {
        const definition = fixtures.kpiDefinitions.find((item) => item.id === evaluation.definitionId)!;
        const threshold = evaluation.threshold;
        return {
          definition,
          evaluation,
          label: definition.label,
          value: `${evaluation.calculatedValue}${definition.unit === "percent" ? "%" : ""}`,
          delta: `${definition.code} · ${definition.period} · v${definition.version}`,
          thresholdLabel: threshold
            ? `Порог ${threshold.operator} ${threshold.value} · ${formatDate(evaluation.evaluatedAt)}`
            : `Без порога · ${formatDate(evaluation.evaluatedAt)}`
        };
      }),
    [fixtures.kpiDefinitions, fixtures.kpiEvaluations]
  );

  const intro = (
    <PageIntro
      title={mockProjectScreenTitle("KPI")}
      lead="Показатели и сигналы управления."
      actions={<Button variant="secondary">Открыть управленческую поверхность</Button>}
    />
  );

  return (
    <ScreenBlockGate
      intro={intro}
      skeleton={<DashboardBentoSkeleton />}
      errorTitle="Не удалось загрузить KPI проекта"
      forbiddenTitle="Нет доступа к KPI проекта"
    >
      <div className="bento">
        {kpi.map((item, index) => {
          if (index < 2) {
            return (
              <div key={item.label} className="bento__cell">
                <KpiAccentTile
                  tone={index === 0 ? "warm" : "cool"}
                  label={item.label}
                  value={item.value}
                  meta={
                    <>
                      <span className="tile__sub">{item.delta}</span>
                      <span className="tile__sub u-text-muted">{item.thresholdLabel}</span>
                    </>
                  }
                />
              </div>
            );
          }

          return (
            <div key={item.label} className="bento__cell tile tile--metric">
              <div className="tile__head">
                <span className="tile__label">{item.label}</span>
                <span className="tile__icon">
                  <Target className="size-4" aria-hidden />
                </span>
              </div>
              <div className="tile__value tile__value--kpi">{item.value}</div>
              <div className="tile__sub">{item.delta}</div>
              <div className="tile__sub u-text-muted">{item.thresholdLabel}</div>
            </div>
          );
        })}
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
                      Ответственный: {userName(signal.ownerUserId)} · действия:{" "}
                      {signal.allowedActions.join(", ")}
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
            title="Корректирующие действия"
            subtitle={`${fixtures.correctiveActions.length} записей`}
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
            title="Исполнения действий"
            subtitle={`${fixtures.actionExecutions.length} записей`}
          >
            {fixtures.actionExecutions.map((execution) => (
              <CellStack
                key={execution.id}
                title={`${execution.actionType} · ${execution.status}`}
                subtitle={`${execution.targetEntity.type}:${execution.targetEntity.id} · аудит ${execution.auditEventId ?? "—"} · ${formatDate(execution.createdAt)}`}
              />
            ))}
          </CardPanel>
        </div>
      </div>
    </ScreenBlockGate>
  );
}
