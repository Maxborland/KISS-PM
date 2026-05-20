import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
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

import type {
  Client,
  ClientUpdateInput,
  Contact,
  ContactUpdateInput,
  Opportunity,
  OpportunityFinalStatus,
  OpportunityUpdateInput
} from "./api";
import {
  DealOverviewCard,
  DealRelationshipCards
} from "./OpportunityDetailFacts";
import { OpportunityActivityPanel } from "./OpportunityActivityPanel";
import { DealFinalActionModal } from "./DealFinalActionModal";
import { DealFormModal, type DealFormSubmitInput } from "./DealFormModal";
import {
  buildClientUpdateInput,
  buildContactUpdateInput,
  buildOpportunityUpdateInput,
  toDateInputValue
} from "./opportunityInlineEdit";
import {
  formatOpportunityEconomics,
  getOpportunityClientLabel,
  getOpportunityContactLabel
} from "./opportunityDisplay";
import type { WorkspaceData } from "./workspaceData";
import {
  useCrmMutations,
  useOpportunityQuery,
  useProjectIntakeMutations
} from "./workspaceQueries";
import {
  hasFormErrors,
  validateClientForm,
  validateContactForm,
  validateOpportunityCustomFields,
  validateOpportunityForm
} from "./workspaceForms";
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
  const crmMutations = useCrmMutations();
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
    mutations.finalizeOpportunity.isPending ||
    crmMutations.updateClient.isPending ||
    crmMutations.updateContact.isPending;
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

  async function saveOpportunityInline(patch: Partial<OpportunityUpdateInput>) {
    if (!opportunity) return;
    const input = buildOpportunityUpdateInput(opportunity, patch);
    const activeOpportunityFields = props.data.customFields.filter(
      (field) => field.targetEntity === "opportunity" && field.status === "active"
    );
    const errors = {
      ...validateOpportunityForm({
        clientId: input.clientId,
        primaryContactId: input.primaryContactId,
        title: input.title,
        projectTypeId: input.projectTypeId,
        stageId: input.stageId,
        plannedStart: input.plannedStart,
        plannedFinish: input.plannedFinish,
        contractValue: String(input.contractValue),
        plannedHourlyRate: String(input.plannedHourlyRate),
        probability: String(input.probability),
        demand: input.demand.map((line) => ({
          positionId: line.positionId,
          requiredHours: String(line.requiredHours)
        }))
      }),
      ...validateOpportunityCustomFields(
        activeOpportunityFields,
        input.customFieldValues ?? {}
      )
    };
    if (hasFormErrors(errors)) {
      throw new Error(Object.values(errors)[0] ?? "Проверьте значение поля.");
    }

    await mutations.updateOpportunity.mutateAsync({
      opportunityId: opportunity.id,
      input
    });
    props.onChanged("Поле сделки обновлено");
  }

  async function saveClientInline(client: Client, patch: Partial<Client>) {
    const patchInput: Partial<ClientUpdateInput> = {};
    if (typeof patch.name === "string") patchInput.name = patch.name.trim();
    if (typeof patch.description === "string") {
      patchInput.description = patch.description.trim() || null;
    }
    if (patch.status) patchInput.status = patch.status;
    const input = buildClientUpdateInput(client, patchInput);
    const errors = validateClientForm({
      name: input.name,
      description: input.description ?? "",
      status: input.status
    });
    if (hasFormErrors(errors)) {
      throw new Error(Object.values(errors)[0] ?? "Проверьте значение поля.");
    }

    await crmMutations.updateClient.mutateAsync({
      clientId: client.id,
      input
    });
    props.onChanged("Поле компании обновлено");
  }

  async function saveContactInline(contact: Contact, patch: Partial<Contact>) {
    const patchInput: Partial<ContactUpdateInput> = {};
    if (typeof patch.clientId === "string") patchInput.clientId = patch.clientId;
    if (typeof patch.name === "string") patchInput.name = patch.name.trim();
    if (typeof patch.email === "string") patchInput.email = patch.email.trim() || null;
    if (typeof patch.phone === "string") patchInput.phone = patch.phone.trim() || null;
    if (typeof patch.telegram === "string") {
      patchInput.telegram = patch.telegram.trim() || null;
    }
    if (typeof patch.role === "string") patchInput.role = patch.role.trim() || null;
    if (patch.status) patchInput.status = patch.status;
    const input = buildContactUpdateInput(contact, patchInput);
    const errors = validateContactForm({
      clientId: input.clientId,
      name: input.name,
      email: input.email ?? "",
      status: input.status
    });
    if (hasFormErrors(errors)) {
      throw new Error(Object.values(errors)[0] ?? "Проверьте значение поля.");
    }

    await crmMutations.updateContact.mutateAsync({
      contactId: contact.id,
      input
    });
    props.onChanged("Поле контакта обновлено");
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
                onSaveOpportunity={saveOpportunityInline}
              />
              <DealMetricGrid opportunity={opportunity} />
              <DealOverviewCard
                canManageOpportunities={canManageOpportunities}
                data={props.data}
                isPending={isPending}
                opportunity={opportunity}
                onUpdateStage={updateStage}
                onSaveOpportunity={saveOpportunityInline}
              />
              <DealRelationshipCards
                canManageClients={hasPermission(props.data.permissions, "tenant.clients.manage")}
                canManageContacts={hasPermission(props.data.permissions, "tenant.contacts.manage")}
                data={props.data}
                isPending={isPending}
                opportunity={opportunity}
                onOpenClient={props.onOpenClient}
                onOpenContact={props.onOpenContact}
                onSaveClient={saveClientInline}
                onSaveContact={saveContactInline}
              />
              <DealResourceCard
                canCheckFeasibility={canCheckFeasibility}
                isPending={isPending}
                opportunity={opportunity}
                riskReason={riskReason}
                onCheckFeasibility={checkFeasibility}
                onRiskReasonChange={setRiskReason}
              />
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
  onSaveOpportunity: (patch: Partial<OpportunityUpdateInput>) => Promise<void>;
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
          <h1 aria-label={props.opportunity.title}>
            <DealTitleInlineEditor
              disabled={
                props.isPending ||
                !props.canManageOpportunities ||
                isFinalOpportunity(props.opportunity)
              }
              label="Название сделки"
              value={props.opportunity.title}
              onSave={(value) => props.onSaveOpportunity({ title: value.trim() })}
            />
          </h1>
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

function DealTitleInlineEditor(props: {
  disabled: boolean;
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(props.value);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function startEdit() {
    setDraft(props.value);
    setError("");
    setIsEditing(true);
  }

  function cancelEdit() {
    setDraft(props.value);
    setError("");
    setIsEditing(false);
  }

  async function save() {
    const nextTitle = draft.trim();
    if (nextTitle.length < 3) {
      setError("Название сделки должно быть не короче 3 символов.");
      return;
    }
    if (nextTitle === props.value) {
      setIsEditing(false);
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await props.onSave(nextTitle);
      setIsEditing(false);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    if (props.disabled) {
      return <span className="deal-title-readonly">{props.value}</span>;
    }

    return (
      <button
        className="deal-title-edit-trigger"
        type="button"
        aria-label={`Редактировать поле ${props.label}`}
        onClick={startEdit}
      >
        {props.value}
      </button>
    );
  }

  return (
    <span className="deal-title-edit-control">
      <span className="deal-title-edit-input-row">
        <input
          aria-label={props.label}
          autoFocus
          className="deal-title-edit-input"
          disabled={isSaving}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEdit();
            if (event.key === "Enter") void save();
          }}
        />
        <span className="deal-title-edit-actions">
          <button
            className="primary-button compact"
            disabled={isSaving}
            type="button"
            onClick={save}
          >
            {isSaving ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            className="secondary-button compact"
            disabled={isSaving}
            type="button"
            onClick={cancelEdit}
          >
            Отмена
          </button>
        </span>
      </span>
      {error ? <small className="deal-title-edit-error" role="alert">{error}</small> : null}
    </span>
  );
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
