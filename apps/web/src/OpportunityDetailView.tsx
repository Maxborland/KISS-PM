import {
  ArrowLeft,
  ClipboardCheck,
  Pencil,
  PlayCircle,
} from "lucide-react";
import { useState } from "react";

import type { DealStage, Opportunity } from "./api";
import { DealFormModal, type DealFormSubmitInput } from "./DealFormModal";
import {
  formatOpportunityEconomics,
  getOpportunityClientLabel,
  getOpportunityContactLabel,
  getOpportunityProjectTypeLabel,
  getOpportunityStageLabel,
  getOpportunityStageOptions
} from "./opportunityDisplay";
import type { WorkspaceData } from "./workspaceData";
import { useOpportunityQuery, useProjectIntakeMutations } from "./workspaceQueries";
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
  SummaryCard
} from "./components/workspace-ui";

export function OpportunityDetailView(props: {
  data: WorkspaceData;
  opportunityId: string;
  onBack: () => void;
  onChanged: (message: string) => void;
  onOpenClient: (clientId: string) => void;
  onOpenContact: (contactId: string) => void;
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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const opportunity =
    opportunityQuery.data?.opportunity ??
    props.data.opportunities.find((item) => item.id === props.opportunityId) ??
    null;
  const isPending =
    mutations.checkFeasibility.isPending ||
    mutations.updateOpportunity.isPending ||
    mutations.updateStage.isPending ||
    mutations.activateProject.isPending;
  const activeClients = props.data.clients.filter((client) => client.status === "active");
  const activeProjectTypes = props.data.projectTypes.filter(
    (projectType) => projectType.status === "active"
  );
  const activeStages = props.data.dealStages.filter((stage) => stage.status === "active");

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

  async function submitOpportunityUpdate(input: DealFormSubmitInput) {
    if (!opportunity) return;
    await mutations.updateOpportunity.mutateAsync({
      opportunityId: opportunity.id,
      input
    });
    setIsEditOpen(false);
    props.onChanged("Сделка обновлена");
  }

  return (
    <Panel
      title="Детали сделки"
      subtitle="Карточка сделки показывает CRM-связи, экономику, ресурсную проверку и управляемые действия."
      actions={
        <span className="table-actions">
          {canManageOpportunities && opportunity && !isFinalOpportunity(opportunity) ? (
            <button
              className="primary-button"
              disabled={isPending}
              type="button"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil aria-hidden="true" size={14} />
              Редактировать
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={props.onBack}>
            <ArrowLeft aria-hidden="true" size={14} />
            К списку сделок
          </button>
        </span>
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
          {(() => {
            const economics = formatOpportunityEconomics(opportunity);
            const demandedHours = opportunity.demand.reduce(
              (sum, line) => sum + line.requiredHours,
              0
            );

            return (
              <>
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
            <SummaryCard label="Стоимость" value={economics.contractValueLabel} />
            <SummaryCard label="Норма часа" value={economics.plannedHourlyRateLabel} />
            <SummaryCard label="Необходимые часы" value={economics.plannedHoursLabel} />
            <SummaryCard
              label="Вероятность, %"
              value={opportunity.probability}
              tone="success"
            />
            <SummaryCard
              label="Потребность, ч"
              value={demandedHours}
              tone="muted"
            />
          </div>

          <div className="deal-detail-layout">
            <section className="detail-card">
              <h2>Связи и параметры</h2>
              <dl className="detail-list">
                <div>
                  <dt>Клиент</dt>
                  <dd>
                    {opportunity.clientId ? (
                      <button
                        className="inline-link-button"
                        type="button"
                        onClick={() => props.onOpenClient(opportunity.clientId!)}
                      >
                        {getOpportunityClientLabel(props.data, opportunity)}
                      </button>
                    ) : (
                      getOpportunityClientLabel(props.data, opportunity)
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Контакт</dt>
                  <dd>
                    {opportunity.primaryContactId ? (
                      <button
                        className="inline-link-button"
                        type="button"
                        onClick={() => props.onOpenContact(opportunity.primaryContactId!)}
                      >
                        {getOpportunityContactLabel(props.data, opportunity)}
                      </button>
                    ) : (
                      getOpportunityContactLabel(props.data, opportunity)
                    )}
                  </dd>
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
                  <dt>Стоимость</dt>
                  <dd>{economics.contractValueLabel}</dd>
                </div>
                <div>
                  <dt>Норма часа</dt>
                  <dd>{economics.plannedHourlyRateLabel}</dd>
                </div>
                <div>
                  <dt>Необходимые часы</dt>
                  <dd>{economics.plannedHoursLabel}</dd>
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
              </>
            );
          })()}
          {isEditOpen ? (
            <DealFormModal
              activeStages={activeStages}
              allContacts={props.data.contacts}
              clients={activeClients}
              error={actionError}
              initialOpportunity={opportunity}
              isSaving={isPending}
              positions={props.data.positions}
              projectTemplates={props.data.projectTemplates}
              projectTypes={activeProjectTypes}
              onClose={() => setIsEditOpen(false)}
              onSubmit={submitOpportunityUpdate}
            />
          ) : null}
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
