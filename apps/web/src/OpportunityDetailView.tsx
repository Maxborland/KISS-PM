import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  PlayCircle,
  Tag
} from "lucide-react";
import { useMemo, useState } from "react";

import type { AuditEvent, DealStage, Opportunity } from "./api";
import {
  getOpportunityClientLabel,
  getOpportunityContactLabel,
  getOpportunityProjectTypeLabel,
  getOpportunityStageLabel,
  getOpportunityStageOptions
} from "./opportunityDisplay";
import type { WorkspaceData } from "./workspaceData";
import { useOpportunityQuery, useProjectIntakeMutations } from "./workspaceQueries";
import { getAuditActionLabel } from "./workspaceDashboard";
import { formatDate, formatDateOnly } from "./workspaceViewHelpers";
import {
  getErrorMessage,
  hasPermission,
  type SectionState
} from "./workspaceShellState";
import {
  DisabledAction,
  Panel,
  SectionFeedback,
  StatusPill,
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";

export function OpportunityDetailView(props: {
  data: WorkspaceData;
  opportunityId: string;
  onBack: () => void;
  onChanged: (message: string) => void;
  sectionState: SectionState;
}) {
  const canManageOpportunities = hasPermission(
    props.data.permissions,
    "tenant.opportunities.manage"
  );
  const canCheckFeasibility =
    canManageOpportunities &&
    hasPermission(props.data.permissions, "tenant.resource_feasibility.read");
  const canActivateProjects =
    hasPermission(props.data.permissions, "tenant.project_activation.manage") &&
    hasPermission(props.data.permissions, "tenant.projects.manage");
  const opportunityQuery = useOpportunityQuery(
    props.opportunityId,
    props.sectionState.canRead
  );
  const mutations = useProjectIntakeMutations();
  const [riskReason, setRiskReason] = useState("");
  const [actionError, setActionError] = useState("");
  const opportunity =
    opportunityQuery.data?.opportunity ??
    props.data.opportunities.find((item) => item.id === props.opportunityId) ??
    null;
  const relatedAuditEvents = useMemo(
    () =>
      opportunity
        ? props.data.auditEvents.filter((event) => isAuditEventRelatedToOpportunity(event, opportunity.id))
        : [],
    [opportunity, props.data.auditEvents]
  );
  const isPending =
    mutations.checkFeasibility.isPending ||
    mutations.updateStage.isPending ||
    mutations.activateProject.isPending;

  async function updateStage(stageId: string) {
    if (!opportunity || stageId === opportunity.stageId) return;
    setActionError("");

    try {
      await mutations.updateStage.mutateAsync({
        opportunityId: opportunity.id,
        input: { stageId }
      });
      props.onChanged("Этап сделки обновлен");
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function checkFeasibility() {
    if (!opportunity) return;
    setActionError("");

    try {
      await mutations.checkFeasibility.mutateAsync(opportunity.id);
      props.onChanged("Ресурсная проверка выполнена");
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function activateProject() {
    if (!opportunity) return;
    setActionError("");

    if (opportunity.feasibilityStatus === "conflict" && !riskReason.trim()) {
      setActionError("Для ресурсного конфликта укажите причину принятия риска.");
      return;
    }

    try {
      await mutations.activateProject.mutateAsync({
        opportunityId: opportunity.id,
        input: {
          acceptedRiskReason: riskReason.trim() || null
        }
      });
      props.onChanged("Проект активирован");
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  return (
    <Panel
      title="Детали сделки"
      subtitle="Карточка сделки показывает CRM-связи, ресурсную проверку, управляемые действия и audit context."
      actions={
        <button className="secondary-button" type="button" onClick={props.onBack}>
          <ArrowLeft aria-hidden="true" size={14} />
          К списку сделок
        </button>
      }
    >
      <SectionFeedback state={props.sectionState} emptyLabel="Сделки недоступны." />
      {props.sectionState.canRead && opportunityQuery.isLoading && !opportunity ? (
        <p className="loading-state">Загружаем сделку...</p>
      ) : null}
      {opportunityQuery.isError ? (
        <p className="error">{getErrorMessage(opportunityQuery.error)}</p>
      ) : null}
      {props.sectionState.canRead && !opportunityQuery.isLoading && !opportunityQuery.isError && !opportunity ? (
        <p className="empty-state">Сделка не найдена.</p>
      ) : null}
      {opportunity ? (
        <div className="deal-detail-stack">
          <header className="deal-detail-header">
            <span className="row-avatar">С</span>
            <div className="deal-detail-title">
              <h1>{opportunity.title}</h1>
              <span className="muted">
                {getOpportunityClientLabel(props.data, opportunity)} ·{" "}
                {getOpportunityContactLabel(props.data, opportunity)}
              </span>
            </div>
            <StatusPill
              label={getOpportunityStatusLabel(opportunity.status)}
              tone={opportunity.status === "converted" ? "success" : "muted"}
            />
          </header>

          <div className="surface-summary-grid">
            <SummaryCard label="Плановые часы" value={opportunity.plannedHours} />
            <SummaryCard
              label="Вероятность, %"
              value={opportunity.probability}
              tone="success"
            />
            <SummaryCard
              label="Потребность, ч"
              value={opportunity.demand.reduce((sum, line) => sum + line.requiredHours, 0)}
              tone="muted"
            />
          </div>

          <div className="deal-detail-layout">
            <section className="detail-card">
              <h2>Связи и параметры</h2>
              <dl className="detail-list">
                <div>
                  <dt>Клиент</dt>
                  <dd>{getOpportunityClientLabel(props.data, opportunity)}</dd>
                </div>
                <div>
                  <dt>Контакт</dt>
                  <dd>{getOpportunityContactLabel(props.data, opportunity)}</dd>
                </div>
                <div>
                  <dt>Тип проекта</dt>
                  <dd>{getOpportunityProjectTypeLabel(props.data, opportunity)}</dd>
                </div>
                <div>
                  <dt>Этап</dt>
                  <dd>
                    {canManageOpportunities && !isFinalOpportunity(opportunity) ? (
                      <select
                        aria-label="Этап сделки"
                        disabled={isPending}
                        value={opportunity.stageId ?? ""}
                        onChange={(event) => updateStage(event.target.value)}
                      >
                        <option value="">Этап не задан</option>
                        {getOpportunityStageOptions(props.data.dealStages, opportunity).map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.status === "archived" ? `${stage.name} · архив` : stage.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatStage(opportunity, props.data.dealStages)
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Период</dt>
                  <dd>
                    {formatDateOnly(opportunity.plannedStart)} {"->"}{" "}
                    {formatDateOnly(opportunity.plannedFinish)}
                  </dd>
                </div>
                <div>
                  <dt>Экономика</dt>
                  <dd>
                    {formatMoney(opportunity.contractValue)} /{" "}
                    {formatMoney(opportunity.plannedHourlyRate)} за час
                  </dd>
                </div>
              </dl>
            </section>

            <section className="detail-card">
              <h2>Управляемые действия</h2>
              <div className="detail-action-stack">
                {canCheckFeasibility && !isFinalOpportunity(opportunity) ? (
                  <button
                    className="secondary-button"
                    disabled={isPending}
                    type="button"
                    onClick={checkFeasibility}
                  >
                    <ClipboardCheck aria-hidden="true" size={14} />
                    Проверить ресурсы
                  </button>
                ) : (
                  <DisabledAction reason="Нужны права на сделки и ресурсную проверку" />
                )}
                {renderActivationControl({
                  canActivateProjects,
                  isPending,
                  opportunity,
                  onActivate: activateProject
                })}
                {opportunity.feasibilityStatus === "conflict" && opportunity.status !== "converted" ? (
                  <label htmlFor="deal-risk-reason">
                    Причина принятия риска
                    <textarea
                      id="deal-risk-reason"
                      rows={3}
                      value={riskReason}
                      onChange={(event) => setRiskReason(event.target.value)}
                    />
                  </label>
                ) : null}
                {actionError ? <p className="error">{actionError}</p> : null}
              </div>
            </section>
          </div>

          <div className="deal-detail-layout">
            <section className="detail-card">
              <h2>Потребность: должность + часы</h2>
              <div className="chip-list">
                {opportunity.demand.map((line) => (
                  <span className="permission-chip" key={line.positionId}>
                    {getPositionName(props.data, line.positionId)}: {line.requiredHours} ч
                  </span>
                ))}
              </div>
            </section>

            <section className="detail-card">
              <h2>Ресурсная проверка</h2>
              {renderFeasibility(opportunity)}
            </section>
          </div>

          <section className="detail-card">
            <h2>Audit context</h2>
            <div className="table-wrap">
              <table className="data-table audit-table" aria-label="Аудит сделки">
                <thead>
                  <tr>
                    <th>Событие</th>
                    <th>Workflow</th>
                    <th>Корреляция</th>
                    <th>Время</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedAuditEvents.length === 0 ? (
                    <TableEmpty colSpan={4} label="Связанных событий аудита пока нет." />
                  ) : (
                    relatedAuditEvents.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <span className="entity-name-cell">
                            <Tag aria-hidden="true" size={14} />
                            <span>
                              <strong>{getAuditActionLabel(event.actionType)}</strong>
                              <small>{event.actionType}</small>
                            </span>
                          </span>
                        </td>
                        <td>{event.sourceWorkflow ?? "Не задан"}</td>
                        <td>
                          <code className="inline-code">{event.correlationId}</code>
                        </td>
                        <td>{formatDate(event.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </Panel>
  );
}

function renderActivationControl(input: {
  canActivateProjects: boolean;
  isPending: boolean;
  opportunity: Opportunity;
  onActivate: () => void;
}) {
  if (input.opportunity.status === "converted") {
    return <StatusPill label="Проект создан" tone="success" />;
  }
  if (input.opportunity.status === "rejected") {
    return <StatusPill label="Отклонена" tone="muted" />;
  }
  if (!input.canActivateProjects) {
    return (
      <DisabledAction reason="Нужны права tenant.project_activation.manage и tenant.projects.manage" />
    );
  }
  if (!input.opportunity.feasibilityStatus) {
    return (
      <button
        className="secondary-button"
        disabled
        title="Сначала выполните ресурсную проверку"
        type="button"
      >
        Активировать проект
      </button>
    );
  }

  return (
    <button
      className="primary-button"
      disabled={input.isPending}
      type="button"
      onClick={input.onActivate}
    >
      <PlayCircle aria-hidden="true" size={14} />
      Активировать проект
    </button>
  );
}

function renderFeasibility(opportunity: Opportunity) {
  if (!opportunity.feasibilityStatus) {
    return <p className="empty-state compact">Ресурсная проверка еще не выполнялась.</p>;
  }

  return (
    <div className="detail-action-stack">
      <StatusPill
        label={getFeasibilityLabel(opportunity.feasibilityStatus)}
        tone={opportunity.feasibilityStatus === "ok" ? "success" : "muted"}
      />
      {opportunity.feasibilityResult?.rows.map((row) => (
        <span className="permission-chip" key={row.positionId}>
          {row.positionName}: {row.requiredHours}/{row.availableHours} ч
        </span>
      ))}
      {opportunity.feasibilityCheckedAt ? (
        <span className="muted">
          Проверено {formatDate(opportunity.feasibilityCheckedAt)}
        </span>
      ) : null}
    </div>
  );
}

function formatStage(opportunity: Opportunity, stages: DealStage[]) {
  const stage = stages.find((item) => item.id === opportunity.stageId);
  return (
    <StatusPill
      label={getOpportunityStageLabel(stages, opportunity)}
      tone={stage?.status === "active" ? "success" : "muted"}
    />
  );
}

function getPositionName(data: WorkspaceData, positionId: string): string {
  return data.positions.find((position) => position.id === positionId)?.name ?? positionId;
}

function isFinalOpportunity(opportunity: Opportunity): boolean {
  return opportunity.status === "converted" || opportunity.status === "rejected";
}

function getOpportunityStatusLabel(status: Opportunity["status"]): string {
  const labels: Record<Opportunity["status"], string> = {
    new: "Новая",
    intake: "Приемка",
    feasibility: "Проверка ресурсов",
    ready_to_activate: "Готова к активации",
    rejected: "Отклонена",
    converted: "Проект создан"
  };

  return labels[status];
}

function getFeasibilityLabel(status: Opportunity["feasibilityStatus"]): string {
  if (status === "ok") return "Достаточно ресурса";
  if (status === "warning") return "Есть предупреждения";
  if (status === "conflict") return "Конфликт ресурса";
  if (status === "blocked") return "Заблокировано";
  return "Не проверено";
}

function isAuditEventRelatedToOpportunity(event: AuditEvent, opportunityId: string): boolean {
  return (
    event.sourceEntity?.id === opportunityId ||
    event.beforeState?.id === opportunityId ||
    event.afterState?.id === opportunityId
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "RUB"
  }).format(value);
}
