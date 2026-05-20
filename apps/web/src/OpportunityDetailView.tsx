import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  TrendingUp,
  UserRound,
  WalletCards,
  XCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import type { DealStage, Opportunity, OpportunityFinalStatus } from "./api";
import { OpportunityActivityPanel } from "./OpportunityActivityPanel";
import { DealFinalActionModal } from "./DealFinalActionModal";
import { DealFormModal, type DealFormSubmitInput } from "./DealFormModal";
import {
  buildOpportunityStageTimeline,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./components/ui/dropdown-menu";
import {
  DisabledAction,
  SectionFeedback,
  StatusPill
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
  const [finalAction, setFinalAction] = useState<OpportunityFinalStatus | null>(null);
  const opportunity =
    opportunityQuery.data?.opportunity ??
    props.data.opportunities.find((item) => item.id === props.opportunityId) ??
    null;
  const isPending =
    mutations.checkFeasibility.isPending ||
    mutations.updateOpportunity.isPending ||
    mutations.updateStage.isPending ||
    mutations.activateProject.isPending ||
    mutations.finalizeOpportunity.isPending;
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

  async function submitFinalAction(input: {
    status: OpportunityFinalStatus;
    reason: string;
  }) {
    if (!opportunity) return;
    await mutations.finalizeOpportunity.mutateAsync({
      opportunityId: opportunity.id,
      input
    });
    setFinalAction(null);
    props.onChanged(
      input.status === "won_closed" ? "Сделка закрыта как выигранная" : "Сделка отклонена"
    );
  }

  return (
    <section className="deal-page" aria-label="Карточка сделки">
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
        <>
          <div className="deal-workspace-layout">
            <div className="deal-workspace-main">
              <DealPageHeader
                canActivateProjects={canActivateProjects}
                canManageOpportunities={canManageOpportunities}
                data={props.data}
                isPending={isPending}
                opportunity={opportunity}
                onActivate={activateProject}
                onBack={props.onBack}
                onEdit={() => setIsEditOpen(true)}
                onFinalize={setFinalAction}
              />
              <DealMetricGrid opportunity={opportunity} />
              <DealOverviewCard
                canManageOpportunities={canManageOpportunities}
                data={props.data}
                isPending={isPending}
                opportunity={opportunity}
                onUpdateStage={updateStage}
              />
              <DealRelationshipCards
                data={props.data}
                opportunity={opportunity}
                onOpenClient={props.onOpenClient}
                onOpenContact={props.onOpenContact}
              />
              <DealResourceCard
                canCheckFeasibility={canCheckFeasibility}
                isPending={isPending}
                opportunity={opportunity}
                riskReason={riskReason}
                onCheckFeasibility={checkFeasibility}
                onRiskReasonChange={setRiskReason}
              />
              <RuntimeCustomFieldsCard data={props.data} opportunity={opportunity} />
              {actionError ? <p className="error deal-action-error">{actionError}</p> : null}
            </div>
            <OpportunityActivityPanel
              canManageOpportunities={canManageOpportunities}
              data={props.data}
              opportunityId={opportunity.id}
              onChanged={props.onChanged}
            />
          </div>

          {isEditOpen ? (
            <DealFormModal
              activeStages={activeStages}
              allContacts={props.data.contacts}
              clients={activeClients}
              customFields={props.data.customFields}
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
          {finalAction ? (
            <DealFinalActionModal
              action={finalAction}
              error={actionError}
              isSaving={isPending}
              opportunity={opportunity}
              onClose={() => setFinalAction(null)}
              onSubmit={submitFinalAction}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function DealPageHeader(props: {
  canActivateProjects: boolean;
  canManageOpportunities: boolean;
  data: WorkspaceData;
  isPending: boolean;
  opportunity: Opportunity;
  onActivate: () => void;
  onBack: () => void;
  onEdit: () => void;
  onFinalize: (action: OpportunityFinalStatus) => void;
}) {
  const createProjectDisabledReason = getCreateProjectDisabledReason({
    canActivateProjects: props.canActivateProjects,
    opportunity: props.opportunity
  });
  const isFinal = isFinalOpportunity(props.opportunity);

  return (
    <header className="deal-page-header">
      <div className="deal-page-title-block">
        <nav className="deal-breadcrumb" aria-label="Навигация сделки">
          <button type="button" onClick={props.onBack}>
            Сделки
          </button>
          <span>/</span>
          <span>{props.opportunity.title}</span>
        </nav>
        <div className="deal-page-title-row">
          <h1>{props.opportunity.title}</h1>
          <StatusPill
            label={getOpportunityStatusLabel(props.opportunity.status)}
            tone={props.opportunity.status === "won_closed" ? "success" : "muted"}
          />
        </div>
        <p>
          Клиент: {getOpportunityClientLabel(props.data, props.opportunity)} · Контакт:{" "}
          {getOpportunityContactLabel(props.data, props.opportunity)}
        </p>
      </div>
      <div className="deal-page-actions">
        {isFinal ? (
          <StatusPill label="Сделка финализирована" tone="muted" />
        ) : (
          <button
            className="primary-button deal-primary-action"
            disabled={props.isPending || Boolean(createProjectDisabledReason)}
            title={createProjectDisabledReason ?? undefined}
            type="button"
            onClick={props.onActivate}
          >
            <PlayCircle aria-hidden="true" size={16} />
            Создать проект
          </button>
        )}
        {props.canManageOpportunities && !isFinal ? (
          <button
            className="secondary-button"
            disabled={props.isPending}
            type="button"
            onClick={props.onEdit}
          >
            <Pencil aria-hidden="true" size={14} />
            Редактировать
          </button>
        ) : null}
        {props.canManageOpportunities && !isFinal ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Дополнительные действия по сделке"
                className="secondary-button icon-only-action"
                disabled={props.isPending}
                type="button"
              >
                <MoreHorizontal aria-hidden="true" size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="deal-action-menu">
              <DropdownMenuItem onSelect={() => props.onFinalize("won_closed")}>
                <CheckCircle2 aria-hidden="true" size={14} />
                Закрыть как выигранную
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => props.onFinalize("lost_rejected")}
              >
                <XCircle aria-hidden="true" size={14} />
                Отклонить сделку
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}

function DealMetricGrid(props: { opportunity: Opportunity }) {
  const economics = formatOpportunityEconomics(props.opportunity);
  const demandedHours = props.opportunity.demand.reduce(
    (sum, line) => sum + line.requiredHours,
    0
  );

  return (
    <section className="deal-metric-grid" aria-label="Ключевые показатели сделки">
      <DealMetric icon={Clock3} label="Плановые часы" value={economics.plannedHoursLabel} />
      <DealMetric
        icon={TrendingUp}
        label="Вероятность"
        value={`${props.opportunity.probability}%`}
      />
      <DealMetric
        icon={UserRound}
        label="Потребность"
        value={`${demandedHours} ч`}
      />
      <DealMetric
        icon={WalletCards}
        label="Экономика проекта"
        meta={economics.plannedHourlyRateLabel}
        value={economics.contractValueLabel}
      />
    </section>
  );
}

function DealMetric(props: {
  icon: LucideIcon;
  label: string;
  meta?: string;
  value: string;
}) {
  const Icon = props.icon;

  return (
    <article className="deal-metric-card">
      <span className="deal-metric-icon">
        <Icon aria-hidden="true" size={18} />
      </span>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.meta ? <small>{props.meta}</small> : null}
    </article>
  );
}

function DealOverviewCard(props: {
  canManageOpportunities: boolean;
  data: WorkspaceData;
  isPending: boolean;
  opportunity: Opportunity;
  onUpdateStage: (stageId: string) => void;
}) {
  const economics = formatOpportunityEconomics(props.opportunity);
  const timeline = buildOpportunityStageTimeline(props.data.dealStages, props.opportunity);

  return (
    <section className="deal-overview-card" aria-label="Обзор сделки">
      <header className="deal-card-header">
        <div>
          <h2>Обзор сделки</h2>
          <p>
            Период: {formatDateOnly(props.opportunity.plannedStart)} {"->"}{" "}
            {formatDateOnly(props.opportunity.plannedFinish)}
          </p>
        </div>
      </header>
      <ol className="deal-stage-timeline" aria-label="Этапы сделки">
        {timeline.map((stage) => (
          <li
            className={[
              stage.isReached ? "is-reached" : "",
              stage.isCurrent ? "is-current" : "",
              stage.isArchived ? "is-archived" : ""
            ].filter(Boolean).join(" ")}
            key={stage.id}
          >
            <span aria-hidden="true" />
            <strong>{stage.label}</strong>
          </li>
        ))}
      </ol>
      <div className="deal-overview-grid">
        <dl className="deal-fact-list">
          <DealFact label="Этап">
            {props.canManageOpportunities && !isFinalOpportunity(props.opportunity) ? (
              <select
                aria-label="Этап сделки"
                disabled={props.isPending}
                value={props.opportunity.stageId ?? ""}
                onChange={(event) => props.onUpdateStage(event.target.value)}
              >
                <option value="">Этап не задан</option>
                {getOpportunityStageOptions(props.data.dealStages, props.opportunity).map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.status === "archived" ? `${stage.name} · архив` : stage.name}
                  </option>
                ))}
              </select>
            ) : (
              formatStage(props.opportunity, props.data.dealStages)
            )}
          </DealFact>
          <DealFact label="Тип проекта">
            {getOpportunityProjectTypeLabel(props.data, props.opportunity)}
          </DealFact>
          <DealFact label="Плановые часы">{economics.plannedHoursLabel}</DealFact>
          <DealFact label="Вероятность">{props.opportunity.probability}%</DealFact>
          <DealFact label="Потребность">{renderDemand(props.data, props.opportunity)}</DealFact>
          <DealFact label="Бюджет (экономика)">{economics.contractValueLabel}</DealFact>
          <DealFact label="Ставка">{economics.plannedHourlyRateLabel}</DealFact>
        </dl>
        <dl className="deal-fact-list secondary">
          <DealFact label="Период">
            <span className="deal-inline-icon">
              <CalendarDays aria-hidden="true" size={14} />
              {formatDateOnly(props.opportunity.plannedStart)} {"->"}{" "}
              {formatDateOnly(props.opportunity.plannedFinish)}
            </span>
          </DealFact>
          <DealFact label="Дата создания">{formatDate(props.opportunity.createdAt)}</DealFact>
          <DealFact label="Ответственный">{props.data.me.name}</DealFact>
          <DealFact label="Тип клиента">Клиент</DealFact>
          <DealFact label="Отрасль">-</DealFact>
          <DealFact label="Описание">{props.opportunity.description || "-"}</DealFact>
        </dl>
      </div>
    </section>
  );
}

function DealFact(props: { children: React.ReactNode; label: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.children}</dd>
    </div>
  );
}

function DealRelationshipCards(props: {
  data: WorkspaceData;
  opportunity: Opportunity;
  onOpenClient: (clientId: string) => void;
  onOpenContact: (contactId: string) => void;
}) {
  const client = props.data.clients.find((item) => item.id === props.opportunity.clientId);
  const contact = props.data.contacts.find(
    (item) => item.id === props.opportunity.primaryContactId
  );

  return (
    <div className="deal-relationship-grid">
      <section className="deal-linked-card">
        <header>
          <h2>Компания</h2>
          {props.opportunity.clientId ? (
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => props.onOpenClient(props.opportunity.clientId!)}
            >
              Открыть
              <ExternalLink aria-hidden="true" size={13} />
            </button>
          ) : null}
        </header>
        <div className="deal-linked-identity">
          <span className="row-avatar">К</span>
          <div>
            {props.opportunity.clientId ? (
              <button
                className="inline-link-button"
                type="button"
                onClick={() => props.onOpenClient(props.opportunity.clientId!)}
              >
                {getOpportunityClientLabel(props.data, props.opportunity)}
              </button>
            ) : (
              <strong>{getOpportunityClientLabel(props.data, props.opportunity)}</strong>
            )}
            <small>{contact?.email ?? props.opportunity.contactName ?? "Контакт не задан"}</small>
            <small>{contact?.phone ?? "-"}</small>
          </div>
        </div>
        <dl className="deal-mini-list">
          <DealFact label="Тип клиента">Клиент</DealFact>
          <DealFact label="Отрасль">-</DealFact>
          <DealFact label="Сайт">-</DealFact>
          <DealFact label="Ответственный">{props.data.me.name}</DealFact>
        </dl>
      </section>

      <section className="deal-linked-card">
        <header>
          <h2>Контакт</h2>
          {props.opportunity.primaryContactId ? (
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => props.onOpenContact(props.opportunity.primaryContactId!)}
            >
              Открыть
              <ExternalLink aria-hidden="true" size={13} />
            </button>
          ) : null}
        </header>
        <div className="deal-linked-identity">
          <span className="row-avatar">C</span>
          <div>
            {props.opportunity.primaryContactId ? (
              <button
                className="inline-link-button"
                type="button"
                onClick={() => props.onOpenContact(props.opportunity.primaryContactId!)}
              >
                {contact?.name ?? props.opportunity.contactName ?? "Контакт не задан"}
              </button>
            ) : (
              <strong>{contact?.name ?? props.opportunity.contactName ?? "Контакт не задан"}</strong>
            )}
            <small>{contact?.email ?? "-"}</small>
            <small>{contact?.phone ?? "-"}</small>
          </div>
        </div>
        <dl className="deal-mini-list">
          <DealFact label="Должность">{contact?.role ?? "-"}</DealFact>
          <DealFact label="Роль в сделке">{contact?.role ?? "-"}</DealFact>
          <DealFact label="Ответственный">{props.data.me.name}</DealFact>
        </dl>
      </section>
    </div>
  );
}

function DealResourceCard(props: {
  canCheckFeasibility: boolean;
  isPending: boolean;
  opportunity: Opportunity;
  riskReason: string;
  onCheckFeasibility: () => void;
  onRiskReasonChange: (value: string) => void;
}) {
  return (
    <section className="deal-resource-card" aria-label="Ресурсная проверка">
      <header className="deal-card-header">
        <div>
          <h2>Ресурсная проверка</h2>
          {props.opportunity.feasibilityCheckedAt ? (
            <p>Проверено: {formatDate(props.opportunity.feasibilityCheckedAt)}</p>
          ) : (
            <p>Проверка еще не выполнялась.</p>
          )}
        </div>
        {props.opportunity.feasibilityStatus ? (
          <StatusPill
            label={getFeasibilityLabel(props.opportunity.feasibilityStatus)}
            tone={props.opportunity.feasibilityStatus === "ok" ? "success" : "muted"}
          />
        ) : null}
      </header>

      <div className="deal-resource-body">
        {props.opportunity.feasibilityResult?.rows.length ? (
          <div className="deal-resource-bars">
            {props.opportunity.feasibilityResult.rows.map((row) => (
              <ResourceProgressRow key={row.positionId} row={row} />
            ))}
          </div>
        ) : (
          <p className="empty-state compact">Нет результата ресурсной проверки.</p>
        )}

        <div className="deal-resource-actions">
          {props.canCheckFeasibility && !isFinalOpportunity(props.opportunity) ? (
            <button
              className="secondary-button"
              disabled={props.isPending}
              type="button"
              onClick={props.onCheckFeasibility}
            >
              <ClipboardCheck aria-hidden="true" size={14} />
              Проверить ресурсы
            </button>
          ) : (
            <DisabledAction reason="Нужны права на сделки и ресурсную проверку" />
          )}
          {props.opportunity.feasibilityStatus === "conflict" && !isFinalOpportunity(props.opportunity) ? (
            <label className="deal-risk-field" htmlFor="deal-risk-reason">
              Причина принятия риска
              <textarea
                id="deal-risk-reason"
                rows={3}
                value={props.riskReason}
                onChange={(event) => props.onRiskReasonChange(event.target.value)}
              />
            </label>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ResourceProgressRow(props: {
  row: NonNullable<Opportunity["feasibilityResult"]>["rows"][number];
}) {
  const percent = props.row.availableHours
    ? Math.min(100, Math.round((props.row.requiredHours / props.row.availableHours) * 100))
    : 100;

  return (
    <div className="deal-resource-row">
      <span>{props.row.positionName}</span>
      <strong>
        {props.row.requiredHours}/{props.row.availableHours} ч
      </strong>
      <div className="deal-progress-track" aria-label={`${props.row.positionName}: ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <small>{percent}%</small>
    </div>
  );
}

function RuntimeCustomFieldsCard(props: {
  data: WorkspaceData;
  opportunity: Opportunity;
}) {
  const fields = props.data.customFields.filter(
    (field) => field.targetEntity === "opportunity" && field.status === "active"
  );
  if (fields.length === 0) return null;

  return (
    <section className="deal-linked-card">
      <header>
        <h2>Поля сделки</h2>
      </header>
      <dl className="deal-mini-list">
        {fields.map((field) => (
          <DealFact key={field.id} label={field.tenantLabel}>
            {props.opportunity.customFieldValues[field.id] || "Не заполнено"}
          </DealFact>
        ))}
      </dl>
    </section>
  );
}

function renderDemand(data: WorkspaceData, opportunity: Opportunity) {
  if (opportunity.demand.length === 0) return "-";

  return (
    <span className="chip-list">
      {opportunity.demand.map((line) => (
        <span className="permission-chip" key={line.positionId}>
          {getPositionName(data, line.positionId)}: {line.requiredHours} ч
        </span>
      ))}
    </span>
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

function getCreateProjectDisabledReason(input: {
  canActivateProjects: boolean;
  opportunity: Opportunity;
}): string | null {
  if (!input.canActivateProjects) {
    return "Нужны права tenant.project_activation.manage и tenant.projects.manage";
  }
  if (!input.opportunity.feasibilityStatus) {
    return "Сначала выполните ресурсную проверку";
  }
  return null;
}

function isFinalOpportunity(opportunity: Opportunity): boolean {
  return opportunity.status === "won_closed" || opportunity.status === "lost_rejected";
}

function getOpportunityStatusLabel(status: Opportunity["status"]): string {
  const labels: Record<Opportunity["status"], string> = {
    new: "Новая",
    intake: "Приемка",
    feasibility: "Проверка ресурсов",
    ready_to_activate: "Проект создан",
    won_closed: "Закрыта как выигранная",
    lost_rejected: "Отклонена"
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
