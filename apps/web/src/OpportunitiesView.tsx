import {
  Calculator,
  ClipboardCheck,
  KanbanSquare,
  List,
  PlayCircle,
  PlusCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  Client,
  Contact,
  DealStage,
  Opportunity,
  OpportunityInput,
  ProjectType
} from "./api";
import type { WorkspaceData } from "./workspaceData";
import { useProjectIntakeMutations } from "./workspaceQueries";
import {
  type FormErrors,
  getFieldErrorId,
  hasFormErrors,
  validateOpportunityForm,
} from "./workspaceForms";
import { filterOpportunitiesForTable } from "./workspaceTables";
import { formatDate, formatDateOnly } from "./workspaceViewHelpers";
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

type DemandFormLine = {
  key: string;
  positionId: string;
  requiredHours: string;
};

const defaultDemandLine = (): DemandFormLine => ({
  key: `demand-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  positionId: "",
  requiredHours: ""
});

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
  const [viewMode, setViewMode] = useState<DealViewMode>("list");
  const [tableSearch, setTableSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [selectedClientId, setSelectedClientId] = useState("");
  const [demandLines, setDemandLines] = useState<DemandFormLine[]>([
    defaultDemandLine()
  ]);
  const [contractValue, setContractValue] = useState("");
  const [plannedHourlyRate, setPlannedHourlyRate] = useState("");
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
  const activeClients = useMemo(
    () => props.data.clients.filter((client) => client.status === "active"),
    [props.data.clients]
  );
  const activeProjectTypes = useMemo(
    () =>
      props.data.projectTypes.filter((projectType) => projectType.status === "active"),
    [props.data.projectTypes]
  );
  const selectedClientContacts = props.data.contacts.filter(
    (contact) => contact.clientId === selectedClientId && contact.status === "active"
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
  const plannedHoursPreview = calculatePlannedHoursPreview(
    contractValue,
    plannedHourlyRate
  );
  const demandedHoursPreview = demandLines.reduce(
    (sum, line) => sum + parsePositiveInteger(line.requiredHours),
    0
  );
  const activationTarget = props.data.opportunities.find(
    (opportunity) => opportunity.id === activationTargetId
  ) ?? null;
  const isSaving =
    projectMutations.createOpportunity.isPending ||
    projectMutations.checkFeasibility.isPending ||
    projectMutations.updateStage.isPending ||
    projectMutations.activateProject.isPending;

  useEffect(() => {
    if (!props.openCreateRequested) return;
    setModal("deal");
    props.onQuickCreateConsumed();
  }, [props]);

  function closeModal() {
    if (isSaving) return;
    setModal(null);
    setActivationTargetId(null);
    resetFormState();
  }

  function resetFormState() {
    setFormError("");
    setFieldErrors({});
    setSelectedClientId("");
    setDemandLines([defaultDemandLine()]);
    setContractValue("");
    setPlannedHourlyRate("");
  }

  async function submitOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const validationInput = {
      clientId: String(form.get("clientId") ?? ""),
      primaryContactId: String(form.get("primaryContactId") ?? ""),
      title: String(form.get("title") ?? ""),
      projectTypeId: String(form.get("projectTypeId") ?? ""),
      stageId: String(form.get("stageId") ?? ""),
      plannedStart: String(form.get("plannedStart") ?? ""),
      plannedFinish: String(form.get("plannedFinish") ?? ""),
      contractValue: String(form.get("contractValue") ?? ""),
      plannedHourlyRate: String(form.get("plannedHourlyRate") ?? ""),
      probability: String(form.get("probability") ?? ""),
      demand: demandLines.map((line) => ({
        positionId: line.positionId,
        requiredHours: line.requiredHours
      }))
    };
    const validationErrors = validateOpportunityForm(validationInput);
    setFormError("");
    setFieldErrors(validationErrors);

    if (hasFormErrors(validationErrors)) return;

    const input: OpportunityInput = {
      clientId: validationInput.clientId,
      primaryContactId: validationInput.primaryContactId,
      projectTypeId: validationInput.projectTypeId,
      stageId: validationInput.stageId,
      title: validationInput.title.trim(),
      description: String(form.get("description") ?? "").trim(),
      plannedStart: validationInput.plannedStart,
      plannedFinish: validationInput.plannedFinish,
      contractValue: Number(validationInput.contractValue),
      plannedHourlyRate: Number(validationInput.plannedHourlyRate),
      probability: Number(validationInput.probability),
      templateId: String(form.get("templateId") ?? "") || null,
      demand: demandLines
        .filter((line) => line.positionId.trim())
        .map((line) => ({
          positionId: line.positionId,
          requiredHours: Number(line.requiredHours)
        }))
    };

    try {
      await projectMutations.createOpportunity.mutateAsync(input);
      closeModal();
      props.onChanged("Сделка создана");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
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

  function updateDemandLine(index: number, patch: Partial<DemandFormLine>) {
    setDemandLines((lines) =>
      lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line)
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
              data={props.data}
              isPending={isSaving}
              opportunities={filteredOpportunities}
              onActivate={(opportunity) => {
                setFormError("");
                setFieldErrors({});
                setActivationTargetId(opportunity.id);
              }}
              onCheckFeasibility={checkFeasibility}
              onOpenOpportunity={props.onOpenOpportunity}
            />
          ) : (
            <DealsKanban
              canManageOpportunities={canManageOpportunities}
              data={props.data}
              isPending={isSaving}
              opportunities={filteredOpportunities}
              stages={activeStages}
              onOpenOpportunity={props.onOpenOpportunity}
              onUpdateStage={updateStage}
            />
          )
        ) : null}
      </Panel>

      {modal === "deal" ? (
        <DealModal
          activeStages={activeStages}
          clients={activeClients}
          contacts={selectedClientContacts}
          contractValue={contractValue}
          demandedHoursPreview={demandedHoursPreview}
          demandLines={demandLines}
          error={formError}
          fieldErrors={fieldErrors}
          isSaving={isSaving}
          plannedHourlyRate={plannedHourlyRate}
          plannedHoursPreview={plannedHoursPreview}
          positions={props.data.positions}
          projectTemplates={props.data.projectTemplates}
          projectTypes={activeProjectTypes}
          selectedClientId={selectedClientId}
          onAddDemandLine={() => setDemandLines((lines) => [...lines, defaultDemandLine()])}
          onClose={closeModal}
          onContractValueChange={setContractValue}
          onDemandLineChange={updateDemandLine}
          onPlannedHourlyRateChange={setPlannedHourlyRate}
          onRemoveDemandLine={(index) =>
            setDemandLines((lines) => lines.filter((_, lineIndex) => lineIndex !== index))
          }
          onSelectedClientChange={setSelectedClientId}
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
  data: WorkspaceData;
  isPending: boolean;
  opportunities: Opportunity[];
  onActivate: (opportunity: Opportunity) => void;
  onCheckFeasibility: (opportunity: Opportunity) => void;
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
            props.opportunities.map((opportunity) => (
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
                      <small>
                        {opportunity.clientName}
                        {opportunity.contactName ? ` · ${opportunity.contactName}` : ""}
                      </small>
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
                  <strong>{opportunity.plannedHours} ч</strong>
                  <small className="muted">
                    {formatMoney(opportunity.contractValue)} / {formatMoney(opportunity.plannedHourlyRate)}
                  </small>
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
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DealsKanban(props: {
  canManageOpportunities: boolean;
  data: WorkspaceData;
  isPending: boolean;
  opportunities: Opportunity[];
  stages: DealStage[];
  onOpenOpportunity: (opportunityId: string) => void;
  onUpdateStage: (opportunity: Opportunity, stageId: string) => void;
}) {
  if (props.stages.length === 0) {
    return <p className="empty-state">Создайте хотя бы один этап сделки для канбана.</p>;
  }

  return (
    <div className="deal-kanban" aria-label="Канбан сделок">
      {props.stages.map((stage) => {
        const columnDeals = props.opportunities.filter(
          (opportunity) => opportunity.stageId === stage.id
        );

        return (
          <section className="deal-kanban-column" key={stage.id}>
            <header>
              <strong>{stage.name}</strong>
              <span>{columnDeals.length}</span>
            </header>
            <div className="deal-card-list">
              {columnDeals.length === 0 ? (
                <p className="empty-state compact">Нет сделок на этапе</p>
              ) : (
                columnDeals.map((opportunity) => (
                  <article className="deal-card" key={opportunity.id}>
                    <button
                      className="inline-link-button"
                      type="button"
                      onClick={() => props.onOpenOpportunity(opportunity.id)}
                    >
                      {opportunity.title}
                    </button>
                    <small>{opportunity.clientName}</small>
                    <span className="chip-list">
                      <span className="permission-chip">{opportunity.plannedHours} ч</span>
                      <span className="permission-chip">{formatMoney(opportunity.contractValue)}</span>
                    </span>
                    <label htmlFor={`${opportunity.id}-stage`}>
                      <span className="sr-only">Этап сделки</span>
                      <select
                        id={`${opportunity.id}-stage`}
                        disabled={
                          props.isPending ||
                          isFinalOpportunity(opportunity) ||
                          !props.canManageOpportunities
                        }
                        title={
                          props.canManageOpportunities
                            ? undefined
                            : "Нужно право tenant.opportunities.manage"
                        }
                        value={opportunity.stageId ?? ""}
                        onChange={(event) => props.onUpdateStage(opportunity, event.target.value)}
                      >
                        {props.stages.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DealModal(props: {
  activeStages: DealStage[];
  clients: Client[];
  contacts: Contact[];
  contractValue: string;
  demandedHoursPreview: number;
  demandLines: DemandFormLine[];
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  plannedHourlyRate: string;
  plannedHoursPreview: number;
  positions: WorkspaceData["positions"];
  projectTemplates: WorkspaceData["projectTemplates"];
  projectTypes: ProjectType[];
  selectedClientId: string;
  onAddDemandLine: () => void;
  onClose: () => void;
  onContractValueChange: (value: string) => void;
  onDemandLineChange: (index: number, patch: Partial<DemandFormLine>) => void;
  onPlannedHourlyRateChange: (value: string) => void;
  onRemoveDemandLine: (index: number) => void;
  onSelectedClientChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title="Создать сделку"
      description="Плановые часы считаются как стоимость контракта / плановая норма часа."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={props.onSubmit}>
        <div className="grid-3">
          <label htmlFor="opportunity-clientId">
            Клиент
            <select
              id="opportunity-clientId"
              name="clientId"
              data-autofocus
              value={props.selectedClientId}
              onChange={(event) => props.onSelectedClientChange(event.target.value)}
            >
              <option value="">Выберите клиента</option>
              {props.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <FieldError formId="opportunity" field="clientId" errors={props.fieldErrors} />
          </label>
          <label htmlFor="opportunity-primaryContactId">
            Контакт
            <select id="opportunity-primaryContactId" name="primaryContactId" defaultValue="">
              <option value="">Выберите контакт</option>
              {props.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
            <FieldError formId="opportunity" field="primaryContactId" errors={props.fieldErrors} />
          </label>
          <label htmlFor="opportunity-stageId">
            Этап
            <select id="opportunity-stageId" name="stageId" defaultValue={props.activeStages[0]?.id ?? ""}>
              <option value="">Выберите этап</option>
              {props.activeStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
            <FieldError formId="opportunity" field="stageId" errors={props.fieldErrors} />
          </label>
        </div>
        <label htmlFor="opportunity-title">
          Название входящего проекта
          <input id="opportunity-title" name="title" />
          <FieldError formId="opportunity" field="title" errors={props.fieldErrors} />
        </label>
        <div className="grid-3">
          <label htmlFor="opportunity-projectTypeId">
            Тип проекта
            <select id="opportunity-projectTypeId" name="projectTypeId" defaultValue="">
              <option value="">Выберите тип</option>
              {props.projectTypes.map((projectType) => (
                <option key={projectType.id} value={projectType.id}>
                  {projectType.name}
                </option>
              ))}
            </select>
            <FieldError formId="opportunity" field="projectTypeId" errors={props.fieldErrors} />
          </label>
          <label htmlFor="opportunity-plannedStart">
            Старт
            <input id="opportunity-plannedStart" name="plannedStart" type="date" />
            <FieldError formId="opportunity" field="plannedStart" errors={props.fieldErrors} />
          </label>
          <label htmlFor="opportunity-plannedFinish">
            Плановый финиш
            <input id="opportunity-plannedFinish" name="plannedFinish" type="date" />
            <FieldError formId="opportunity" field="plannedFinish" errors={props.fieldErrors} />
          </label>
        </div>
        <label htmlFor="opportunity-description">
          Описание
          <textarea id="opportunity-description" name="description" rows={3} />
        </label>
        <div className="grid-3">
          <label htmlFor="opportunity-contractValue">
            Стоимость контракта
            <input
              id="opportunity-contractValue"
              name="contractValue"
              type="number"
              min="1"
              value={props.contractValue}
              onChange={(event) => props.onContractValueChange(event.target.value)}
            />
            <FieldError formId="opportunity" field="contractValue" errors={props.fieldErrors} />
          </label>
          <label htmlFor="opportunity-plannedHourlyRate">
            Плановая норма часа
            <input
              id="opportunity-plannedHourlyRate"
              name="plannedHourlyRate"
              type="number"
              min="1"
              value={props.plannedHourlyRate}
              onChange={(event) => props.onPlannedHourlyRateChange(event.target.value)}
            />
            <FieldError formId="opportunity" field="plannedHourlyRate" errors={props.fieldErrors} />
          </label>
          <label htmlFor="opportunity-probability">
            Вероятность, %
            <input id="opportunity-probability" name="probability" type="number" min="0" max="100" defaultValue="70" />
            <FieldError formId="opportunity" field="probability" errors={props.fieldErrors} />
          </label>
        </div>
        <label htmlFor="opportunity-templateId">
          Шаблон проекта
          <select id="opportunity-templateId" name="templateId" defaultValue="">
            <option value="">Без шаблона</option>
            {props.projectTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.tenantLabel}
              </option>
            ))}
          </select>
        </label>
        <div className="danger-callout neutral" aria-live="polite">
          <strong>Плановая емкость: {props.plannedHoursPreview} ч</strong>
          <span>Потребность по должностям: {props.demandedHoursPreview} ч.</span>
        </div>
        <fieldset className="permission-grid">
          <legend>Потребность: должность + часы</legend>
          {props.demandLines.map((line, index) => (
            <div className="grid-3" key={line.key}>
              <label htmlFor={`${line.key}-position`}>
                Должность
                <select
                  id={`${line.key}-position`}
                  value={line.positionId}
                  onChange={(event) =>
                    props.onDemandLineChange(index, { positionId: event.target.value })
                  }
                >
                  <option value="">Выберите должность</option>
                  {props.positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={`${line.key}-requiredHours`}>
                Часы
                <input
                  id={`${line.key}-requiredHours`}
                  type="number"
                  min="1"
                  value={line.requiredHours}
                  onChange={(event) =>
                    props.onDemandLineChange(index, { requiredHours: event.target.value })
                  }
                />
              </label>
              <span className="form-actions">
                <button
                  className="secondary-button"
                  disabled={props.demandLines.length === 1}
                  type="button"
                  onClick={() => props.onRemoveDemandLine(index)}
                >
                  Удалить строку
                </button>
              </span>
            </div>
          ))}
          <button className="secondary-button" type="button" onClick={props.onAddDemandLine}>
            Добавить строку потребности
          </button>
          <FieldError formId="opportunity" field="demand" errors={props.fieldErrors} />
          <FieldError formId="opportunity" field="demandDuplicates" errors={props.fieldErrors} />
        </fieldset>
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel="Создать сделку"
          savingLabel="Создаем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
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
  if (input.opportunity.status === "converted") {
    return <span className="muted">Проект создан</span>;
  }
  if (input.opportunity.status === "rejected") {
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
  return opportunity.status === "converted" || opportunity.status === "rejected";
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
      label={stage?.name ?? opportunity.stageId ?? "Без этапа"}
      tone={stage ? "success" : "muted"}
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

function calculatePlannedHoursPreview(contractValue: string, plannedHourlyRate: string): number {
  const value = Number(contractValue);
  const rate = Number(plannedHourlyRate);
  if (!Number.isFinite(value) || !Number.isFinite(rate) || value <= 0 || rate <= 0) {
    return 0;
  }

  return Math.floor(value / rate);
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "RUB"
  }).format(value);
}

function isInteractiveElement(target: EventTarget): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, a, input, select, textarea"));
}
