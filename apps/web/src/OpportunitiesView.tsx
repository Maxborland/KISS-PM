import {
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  KanbanSquare,
  List,
  PlayCircle,
  PlusCircle,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { DealStage, Opportunity, OpportunityFinalStatus } from "./api";
import { DealFinalActionModal } from "./DealFinalActionModal";
import { DealFormModal, type DealFormSubmitInput } from "./DealFormModal";
import { DealsKanban } from "./DealsKanban";
import {
  buildKanbanStages,
  formatOpportunityEconomics,
  getOpportunityRelationshipLabel,
  getOpportunityStageLabel
} from "./opportunityDisplay";
import type { WorkspaceData } from "./workspaceData";
import { useProjectIntakeMutations } from "./workspaceQueries";
import {
  type FormErrors,
  getFieldErrorId,
} from "./workspaceForms";
import { filterOpportunitiesForTable } from "./workspaceTables";
import { formatDate, formatDateOnly, formatMoney } from "./workspaceViewHelpers";
import {
  canStartDealCreation,
  getErrorMessage,
  hasPermission,
  type SectionState
} from "./workspaceShellState";
import {
  CrudToolbar,
  DisabledAction,
  FieldError,
  Modal,
  Panel,
  SectionFeedback,
  StatusPill,
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";

type DealViewMode = "list" | "kanban";
type ModalKind = "deal" | null;

export function OpportunitiesView(props: {
  data: WorkspaceData;
  openCreateRequested: boolean;
  sectionState: SectionState;
  onChanged: (message: string) => void;
  onOpenOpportunity: (opportunityId: string) => void;
  onQuickCreateConsumed: () => void;
}) {
  const canManageOpportunities = hasPermission(
    props.data.permissions,
    "tenant.opportunities.manage"
  );
  const canReadFeasibility = hasPermission(
    props.data.permissions,
    "tenant.resource_feasibility.read"
  );
  const canCheckFeasibility = canReadFeasibility && canManageOpportunities;
  const canActivateProjects = hasPermission(
    props.data.permissions,
    "tenant.project_activation.manage"
  ) && hasPermission(props.data.permissions, "tenant.projects.manage");
  const projectMutations = useProjectIntakeMutations();
  const [modal, setModal] = useState<ModalKind>(null);
  const [activationTargetId, setActivationTargetId] = useState<string | null>(null);
  const [finalActionTarget, setFinalActionTarget] = useState<{
    opportunityId: string;
    action: OpportunityFinalStatus;
  } | null>(null);
  const [viewMode, setViewMode] = useState<DealViewMode>("list");
  const [tableSearch, setTableSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const filteredOpportunities = useMemo(
    () => filterOpportunitiesForTable(props.data.opportunities, tableSearch),
    [props.data.opportunities, tableSearch]
  );
  const activeStages = useMemo(
    () =>
      props.data.dealStages
        .filter((stage) => stage.status === "active")
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [props.data.dealStages]
  );
  const kanbanStages = useMemo(
    () => buildKanbanStages(props.data.dealStages, filteredOpportunities),
    [filteredOpportunities, props.data.dealStages]
  );
  const activeClients = useMemo(
    () => props.data.clients.filter((client) => client.status === "active"),
    [props.data.clients]
  );
  const activeProjectTypes = useMemo(
    () =>
      props.data.projectTypes.filter((projectType) => projectType.status === "active"),
    [props.data.projectTypes]
  );
  const readyToActivate = props.data.opportunities.filter(
    (opportunity) => opportunity.status === "ready_to_activate"
  ).length;
  const conflicts = props.data.opportunities.filter(
    (opportunity) => opportunity.feasibilityStatus === "conflict"
  ).length;
  const totalContractValue = props.data.opportunities.reduce(
    (sum, opportunity) => sum + opportunity.contractValue,
    0
  );
  const activationTarget = props.data.opportunities.find(
    (opportunity) => opportunity.id === activationTargetId
  ) ?? null;
  const isSaving =
    projectMutations.createOpportunity.isPending ||
    projectMutations.updateOpportunity.isPending ||
    projectMutations.checkFeasibility.isPending ||
    projectMutations.updateStage.isPending ||
    projectMutations.activateProject.isPending ||
    projectMutations.finalizeOpportunity.isPending;

  useEffect(() => {
    if (!props.openCreateRequested) return;
    setModal("deal");
    props.onQuickCreateConsumed();
  }, [props]);

  function closeModal() {
    if (isSaving) return;
    setModal(null);
    setActivationTargetId(null);
    setFinalActionTarget(null);
    resetFormState();
  }

  function resetFormState() {
    setFormError("");
    setFieldErrors({});
  }

  async function submitOpportunity(input: DealFormSubmitInput) {
    await projectMutations.createOpportunity.mutateAsync(input);
    closeModal();
    props.onChanged("Сделка создана");
  }

  async function checkFeasibility(opportunity: Opportunity) {
    setFormError("");
    try {
      await projectMutations.checkFeasibility.mutateAsync(opportunity.id);
      props.onChanged("Ресурсная проверка выполнена");
    } catch (error) {
      props.onChanged(getErrorMessage(error));
    }
  }

  async function updateStage(opportunity: Opportunity, stageId: string) {
    if (stageId === opportunity.stageId) return;
    try {
      await projectMutations.updateStage.mutateAsync({
        opportunityId: opportunity.id,
        input: { stageId }
      });
      props.onChanged("Этап сделки обновлен");
    } catch (error) {
      props.onChanged(getErrorMessage(error));
    }
  }

  async function activateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activationTarget) return;
    const form = new FormData(event.currentTarget);
    const acceptedRiskReason = String(form.get("acceptedRiskReason") ?? "").trim();

    if (activationTarget.feasibilityStatus === "conflict" && !acceptedRiskReason) {
      setFieldErrors({ acceptedRiskReason: "Для конфликта укажите причину принятия риска." });
      return;
    }

    try {
      await projectMutations.activateProject.mutateAsync({
        opportunityId: activationTarget.id,
        input: {
          acceptedRiskReason: acceptedRiskReason || null
        }
      });
      closeModal();
      props.onChanged("Проект активирован");
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function finalizeOpportunity(input: {
    status: OpportunityFinalStatus;
    reason: string;
  }) {
    if (!finalActionTarget) return;
    await projectMutations.finalizeOpportunity.mutateAsync({
      opportunityId: finalActionTarget.opportunityId,
      input
    });
    closeModal();
    props.onChanged(
      input.status === "won_closed" ? "Сделка закрыта как выигранная" : "Сделка отклонена"
    );
  }

  return (
    <>
      <Panel
        title="Сделки"
        subtitle="Клиенты, контакты, типы проектов и этапы сделок ведут входящий проект к ресурсной проверке и активации."
        actions={
          canManageOpportunities ? (
            <button
              className="primary-button"
              disabled={!canStartDealCreation(props.data)}
              title={
                !canStartDealCreation(props.data)
                  ? getCreateDealDisabledReason(props.data)
                  : undefined
              }
              type="button"
              onClick={() => setModal("deal")}
            >
              <PlusCircle aria-hidden="true" size={15} />
              Создать сделку
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.opportunities.manage" />
          )
        }
      >
        <div className="surface-summary-grid">
          <SummaryCard label="Всего сделок" value={props.data.opportunities.length} />
          <SummaryCard label="Готовы к активации" value={readyToActivate} tone="success" />
          <SummaryCard label="Конфликты ресурса" value={conflicts} tone="muted" />
        </div>
        <DealPrerequisitesStrip data={props.data} />
        <CrudToolbar
          searchLabel="Поиск сделок"
          searchPlaceholder="Клиент, контакт, проект, этап..."
          searchValue={tableSearch}
          resultCount={filteredOpportunities.length}
          totalCount={props.data.opportunities.length}
          onSearchChange={setTableSearch}
        >
          <span className="toolbar-chip">
            <Calculator aria-hidden="true" size={14} />
            {formatMoney(totalContractValue)}
          </span>
          <span className="segmented-control" aria-label="Вид сделок">
            <button
              aria-pressed={viewMode === "list"}
              type="button"
              onClick={() => setViewMode("list")}
            >
              <List aria-hidden="true" size={14} />
              Список
            </button>
            <button
              aria-pressed={viewMode === "kanban"}
              type="button"
              onClick={() => setViewMode("kanban")}
            >
              <KanbanSquare aria-hidden="true" size={14} />
              Канбан
            </button>
          </span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Сделки недоступны." />
        {props.sectionState.canRead && !props.sectionState.error && !props.sectionState.isLoading ? (
          viewMode === "list" ? (
            <DealsTable
              canActivateProjects={canActivateProjects}
              canCheckFeasibility={canCheckFeasibility}
              canManageOpportunities={canManageOpportunities}
              data={props.data}
              isPending={isSaving}
              opportunities={filteredOpportunities}
              onActivate={(opportunity) => {
                setFormError("");
                setFieldErrors({});
                setActivationTargetId(opportunity.id);
              }}
              onCheckFeasibility={checkFeasibility}
              onFinalize={(opportunity, action) =>
                setFinalActionTarget({ opportunityId: opportunity.id, action })
              }
              onOpenOpportunity={props.onOpenOpportunity}
            />
          ) : (
            <DealsKanban
              canManageOpportunities={canManageOpportunities}
              data={props.data}
              isPending={isSaving}
              opportunities={filteredOpportunities}
              stages={kanbanStages}
              onOpenOpportunity={props.onOpenOpportunity}
              onUpdateStage={updateStage}
            />
          )
        ) : null}
      </Panel>

      {modal === "deal" ? (
        <DealFormModal
          activeStages={activeStages}
          clients={activeClients}
          allContacts={props.data.contacts}
          error={formError}
          customFields={props.data.customFields}
          isSaving={isSaving}
          positions={props.data.positions}
          projectTemplates={props.data.projectTemplates}
          projectTypes={activeProjectTypes}
          users={props.data.users}
          onClose={closeModal}
          onSubmit={submitOpportunity}
        />
      ) : null}
      {activationTarget ? (
        <ActivationModal
          error={formError}
          fieldErrors={fieldErrors}
          isSaving={isSaving}
          opportunity={activationTarget}
          onClose={closeModal}
          onSubmit={activateProject}
        />
      ) : null}
      {finalActionTarget ? (
        (() => {
          const target = props.data.opportunities.find(
            (opportunity) => opportunity.id === finalActionTarget.opportunityId
          );
          return target ? (
            <DealFinalActionModal
              action={finalActionTarget.action}
              error={formError}
              isSaving={isSaving}
              opportunity={target}
              onClose={closeModal}
              onSubmit={finalizeOpportunity}
            />
          ) : null;
        })()
      ) : null}
    </>
  );
}

function DealPrerequisitesStrip(props: { data: WorkspaceData }) {
  return (
    <section className="crm-reference-strip" aria-label="Готовность справочников для сделок">
      <ReferenceTile label="Клиенты" value={props.data.clients.length} />
      <ReferenceTile label="Контакты" value={props.data.contacts.length} />
      <ReferenceTile label="Типы проектов" value={props.data.projectTypes.length} />
      <ReferenceTile label="Этапы сделок" value={props.data.dealStages.length} />
    </section>
  );
}

function ReferenceTile(props: {
  label: string;
  value: number;
}) {
  return (
    <div className="reference-tile">
      <span>
        <strong>{props.value}</strong>
        <small>{props.label}</small>
      </span>
    </div>
  );
}

function DealsTable(props: {
  canActivateProjects: boolean;
  canCheckFeasibility: boolean;
  canManageOpportunities: boolean;
  data: WorkspaceData;
  isPending: boolean;
  opportunities: Opportunity[];
  onActivate: (opportunity: Opportunity) => void;
  onCheckFeasibility: (opportunity: Opportunity) => void;
  onFinalize: (opportunity: Opportunity, action: OpportunityFinalStatus) => void;
  onOpenOpportunity: (opportunityId: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Сделки">
        <thead>
          <tr>
            <th>Сделка</th>
            <th>Этап</th>
            <th>Период</th>
            <th>План</th>
            <th>Потребность</th>
            <th>Ресурсная проверка</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {props.opportunities.length === 0 ? (
            <TableEmpty
              colSpan={7}
              label={
                props.data.opportunities.length === 0
                  ? "Сделок пока нет."
                  : "По фильтру ничего не найдено."
              }
            />
          ) : (
            props.opportunities.map((opportunity) => {
              const relationshipLabel = getOpportunityRelationshipLabel(props.data, opportunity);
              const economics = formatOpportunityEconomics(opportunity);

              return (
                <tr
                  className="clickable-row"
                  key={opportunity.id}
                  tabIndex={0}
                  onClick={(event) => {
                    if (isInteractiveElement(event.target)) return;
                    props.onOpenOpportunity(opportunity.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") props.onOpenOpportunity(opportunity.id);
                  }}
                >
                  <td>
                    <span className="entity-name-cell">
                      <span className="row-avatar">С</span>
                      <span>
                        <button
                          className="inline-link-button"
                          type="button"
                          onClick={() => props.onOpenOpportunity(opportunity.id)}
                        >
                          {opportunity.title}
                        </button>
                        <small>{relationshipLabel}</small>
                      </span>
                    </span>
                  </td>
                  <td>{formatStage(opportunity, props.data.dealStages)}</td>
                  <td>
                    <strong>{formatDateOnly(opportunity.plannedStart)}</strong>
                    <small className="muted">
                      {" -> "}
                      {formatDateOnly(opportunity.plannedFinish)}
                    </small>
                  </td>
                  <td>
                    <span
                      aria-label={`План: ${economics.plannedHoursLabel}; стоимость ${economics.contractValueLabel}; норма часа ${economics.plannedHourlyRateLabel}`}
                      className="deal-plan-cell"
                    >
                      <span className="deal-plan-main">
                        <small className="muted">Необходимые часы:</small>
                        {" "}
                        <strong>{economics.plannedHoursLabel}</strong>
                      </span>
                      <span className="sr-only">; </span>
                      <span className="deal-plan-meta">
                        <small>Стоимость: {economics.contractValueLabel}</small>
                        <small>Норма: {economics.plannedHourlyRateLabel}</small>
                      </span>
                    </span>
                  </td>
                  <td>{formatDemand(opportunity, props.data)}</td>
                  <td>{renderFeasibility(opportunity)}</td>
                  <td>
                    <span className="table-actions">
                      {props.canCheckFeasibility && !isFinalOpportunity(opportunity) ? (
                        <button
                          className="secondary-button"
                          disabled={props.isPending}
                          type="button"
                          onClick={() => props.onCheckFeasibility(opportunity)}
                        >
                          Проверить ресурсы
                        </button>
                      ) : null}
                      {renderActivationAction({
                        canActivateProjects: props.canActivateProjects,
                        isPending: props.isPending,
                        opportunity,
                        onActivate: () => props.onActivate(opportunity)
                      })}
                      {props.canManageOpportunities && !isFinalOpportunity(opportunity) ? (
                        <>
                          <button
                            className="secondary-button"
                            disabled={props.isPending}
                            type="button"
                            onClick={() => props.onFinalize(opportunity, "won_closed")}
                          >
                            <CheckCircle2 aria-hidden="true" size={14} />
                            Закрыть
                          </button>
                          <button
                            className="danger-button"
                            disabled={props.isPending}
                            type="button"
                            onClick={() => props.onFinalize(opportunity, "lost_rejected")}
                          >
                            <XCircle aria-hidden="true" size={14} />
                            Отклонить
                          </button>
                        </>
                      ) : null}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function ActivationModal(props: {
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  opportunity: Opportunity;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title="Активировать проект"
      description="После подтверждения сделка станет активным проектом и действие попадет в аудит."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={props.onSubmit}>
        <div className="danger-callout neutral">
          <strong>{props.opportunity.title}</strong>
          <span>
            {props.opportunity.clientName} · {props.opportunity.plannedHours} ч ·{" "}
            {getFeasibilityLabel(props.opportunity.feasibilityStatus)}
          </span>
        </div>
        {props.opportunity.feasibilityStatus === "conflict" ? (
          <label htmlFor="activation-risk-reason">
            Причина принятия риска
            <textarea
              id="activation-risk-reason"
              name="acceptedRiskReason"
              aria-describedby={
                props.fieldErrors.acceptedRiskReason
                  ? getFieldErrorId("activation", "acceptedRiskReason")
                  : undefined
              }
              aria-invalid={Boolean(props.fieldErrors.acceptedRiskReason)}
              data-autofocus
              rows={4}
            />
            <FieldError formId="activation" field="acceptedRiskReason" errors={props.fieldErrors} />
          </label>
        ) : null}
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel="Активировать проект"
          savingLabel="Активируем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
  );
}

function ModalActions(props: {
  error: string;
  isSaving: boolean;
  primaryLabel: string;
  savingLabel: string;
  onClose: () => void;
}) {
  return (
    <>
      {props.error ? <p className="error">{props.error}</p> : null}
      <div className="form-actions">
        <button className="primary-button" disabled={props.isSaving} type="submit">
          {props.isSaving ? props.savingLabel : props.primaryLabel}
        </button>
        <button className="secondary-button" disabled={props.isSaving} type="button" onClick={props.onClose}>
          Отменить
        </button>
      </div>
    </>
  );
}

function renderActivationAction(input: {
  canActivateProjects: boolean;
  isPending: boolean;
  opportunity: Opportunity;
  onActivate: () => void;
}) {
  if (input.opportunity.status === "won_closed") {
    return <span className="muted">Закрыта</span>;
  }
  if (input.opportunity.status === "lost_rejected") {
    return <span className="muted">Отклонена</span>;
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
        Активировать
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
      Активировать
    </button>
  );
}

function isFinalOpportunity(opportunity: Opportunity): boolean {
  return opportunity.status === "won_closed" || opportunity.status === "lost_rejected";
}

function renderFeasibility(opportunity: Opportunity) {
  if (!opportunity.feasibilityStatus) {
    return <span className="muted">Не проверено</span>;
  }

  return (
    <span className="chip-list">
      <StatusPill
        label={getFeasibilityLabel(opportunity.feasibilityStatus)}
        tone={opportunity.feasibilityStatus === "ok" ? "success" : "muted"}
      />
      {opportunity.feasibilityResult?.rows.map((row) => (
        <span className="permission-chip" key={row.positionId}>
          <ClipboardCheck aria-hidden="true" size={12} />
          {row.positionName}: {row.requiredHours}/{row.availableHours} ч
        </span>
      ))}
      {opportunity.feasibilityCheckedAt ? (
        <span className="muted">проверено {formatDate(opportunity.feasibilityCheckedAt)}</span>
      ) : null}
    </span>
  );
}

function formatDemand(opportunity: Opportunity, data: WorkspaceData) {
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

function getCreateDealDisabledReason(data: WorkspaceData): string {
  if (!hasPermission(data.permissions, "tenant.opportunities.manage")) {
    return "Нужно право tenant.opportunities.manage";
  }
  if (data.clients.every((client) => client.status !== "active")) {
    return "Сначала создайте активного клиента в разделе CRM -> Клиенты";
  }
  if (data.contacts.every((contact) => contact.status !== "active")) {
    return "Сначала создайте активный контакт в разделе CRM -> Контакты";
  }
  if (data.projectTypes.every((projectType) => projectType.status !== "active")) {
    return "Сначала создайте активный тип проекта в настройках";
  }
  if (data.dealStages.every((stage) => stage.status !== "active")) {
    return "Сначала создайте активный этап сделки в настройках";
  }
  if (data.positions.length === 0) return "Сначала добавьте должность";
  return "Недостаточно данных";
}

function getPositionName(data: WorkspaceData, positionId: string): string {
  return data.positions.find((position) => position.id === positionId)?.name ?? positionId;
}

function getFeasibilityLabel(status: Opportunity["feasibilityStatus"]): string {
  if (status === "ok") return "Достаточно ресурса";
  if (status === "warning") return "Есть предупреждения";
  if (status === "conflict") return "Конфликт ресурса";
  if (status === "blocked") return "Заблокировано";
  return "Не проверено";
}

function isInteractiveElement(target: EventTarget): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, a, input, select, textarea"));
}
