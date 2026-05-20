import { CalendarDays, ExternalLink } from "lucide-react";
import { useState } from "react";

import type {
  Client,
  Contact,
  CustomFieldDefinition,
  DealStage,
  Opportunity,
  OpportunityUpdateInput
} from "./api";
import {
  formatOpportunityEconomics,
  getOpportunityClientLabel,
  getOpportunityContactLabel,
  getOpportunityProjectTypeLabel,
  getOpportunityStageLabel,
  getOpportunityStageOptions
} from "./opportunityDisplay";
import {
  buildOpportunityStageTimeline
} from "./opportunityDisplay";
import { toDateInputValue } from "./opportunityInlineEdit";
import type { WorkspaceData } from "./workspaceData";
import { formatDate, formatDateOnly } from "./workspaceViewHelpers";
import { getErrorMessage } from "./workspaceShellState";
import { StatusPill } from "./components/workspace-ui";

export function DealOverviewCard(props: {
  canManageOpportunities: boolean;
  data: WorkspaceData;
  isPending: boolean;
  opportunity: Opportunity;
  onSaveOpportunity: (patch: Partial<OpportunityUpdateInput>) => Promise<void>;
  onUpdateStage: (stageId: string) => void;
}) {
  const economics = formatOpportunityEconomics(props.opportunity);
  const timeline = buildOpportunityStageTimeline(props.data.dealStages, props.opportunity);
  const canInlineEdit =
    props.canManageOpportunities && !isFinalOpportunity(props.opportunity);
  const activeContacts = props.data.contacts.filter(
    (contact) =>
      contact.status === "active" &&
      (!props.opportunity.clientId || contact.clientId === props.opportunity.clientId)
  );

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
            {canInlineEdit ? (
              <InlineEditableValue
                disabled={props.isPending}
                label="Этап"
                mode="select"
                options={[
                  { label: "Этап не задан", value: "" },
                  ...getOpportunityStageOptions(props.data.dealStages, props.opportunity).map(
                    (stage) => ({
                      label: stage.status === "archived" ? `${stage.name} · архив` : stage.name,
                      value: stage.id
                    })
                  )
                ]}
                value={props.opportunity.stageId ?? ""}
                display={formatStage(props.opportunity, props.data.dealStages)}
                onSave={async (value) => props.onUpdateStage(value)}
              />
            ) : (
              formatStage(props.opportunity, props.data.dealStages)
            )}
          </DealFact>
          <DealFact label="Название">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Название"
              value={props.opportunity.title}
              onSave={(value) => props.onSaveOpportunity({ title: value.trim() })}
            />
          </DealFact>
          <DealFact label="Клиент">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Клиент"
              mode="select"
              options={props.data.clients
                .filter((client) => client.status === "active")
                .map((client) => ({ label: client.name, value: client.id }))}
              value={props.opportunity.clientId ?? ""}
              display={getOpportunityClientLabel(props.data, props.opportunity)}
              onSave={(value) => {
                const currentContactFitsClient = props.data.contacts.some(
                  (contact) =>
                    contact.id === props.opportunity.primaryContactId &&
                    contact.clientId === value
                );
                const nextContactId =
                  currentContactFitsClient
                    ? props.opportunity.primaryContactId ?? ""
                    : props.data.contacts.find(
                        (contact) =>
                          contact.clientId === value && contact.status === "active"
                      )?.id ?? "";
                return props.onSaveOpportunity({
                  clientId: value,
                  primaryContactId: nextContactId
                });
              }}
            />
          </DealFact>
          <DealFact label="Контакт">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Контакт"
              mode="select"
              options={activeContacts.map((contact) => ({
                label: contact.name,
                value: contact.id
              }))}
              value={props.opportunity.primaryContactId ?? ""}
              display={getOpportunityContactLabel(props.data, props.opportunity)}
              onSave={(value) => props.onSaveOpportunity({ primaryContactId: value })}
            />
          </DealFact>
          <DealFact label="Тип проекта">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Тип проекта"
              mode="select"
              options={props.data.projectTypes
                .filter((projectType) => projectType.status === "active")
                .map((projectType) => ({ label: projectType.name, value: projectType.id }))}
              value={props.opportunity.projectTypeId ?? ""}
              display={getOpportunityProjectTypeLabel(props.data, props.opportunity)}
              onSave={(value) => props.onSaveOpportunity({ projectTypeId: value })}
            />
          </DealFact>
          <DealFact label="Плановые часы">{economics.plannedHoursLabel}</DealFact>
          <DealFact label="Вероятность">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Вероятность"
              mode="number"
              suffix="%"
              value={String(props.opportunity.probability)}
              onSave={(value) => props.onSaveOpportunity({ probability: Number(value) })}
            />
          </DealFact>
          <DealFact label="Потребность">{renderDemand(props.data, props.opportunity)}</DealFact>
          <DealFact label="Бюджет (экономика)">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Бюджет"
              mode="number"
              suffix="₽"
              value={String(props.opportunity.contractValue)}
              display={economics.contractValueLabel}
              onSave={(value) => props.onSaveOpportunity({ contractValue: Number(value) })}
            />
          </DealFact>
          <DealFact label="Ставка">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Ставка"
              mode="number"
              suffix="₽/ч"
              value={String(props.opportunity.plannedHourlyRate)}
              display={economics.plannedHourlyRateLabel}
              onSave={(value) => props.onSaveOpportunity({ plannedHourlyRate: Number(value) })}
            />
          </DealFact>
        </dl>
        <dl className="deal-fact-list secondary">
          <DealFact label="Старт">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Старт"
              mode="date"
              value={toDateInputValue(props.opportunity.plannedStart)}
              display={
                <span className="deal-inline-icon">
                  <CalendarDays aria-hidden="true" size={14} />
                  {formatDateOnly(props.opportunity.plannedStart)}
                </span>
              }
              onSave={(value) => props.onSaveOpportunity({ plannedStart: value })}
            />
          </DealFact>
          <DealFact label="Плановый финиш">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Плановый финиш"
              mode="date"
              value={toDateInputValue(props.opportunity.plannedFinish)}
              display={formatDateOnly(props.opportunity.plannedFinish)}
              onSave={(value) => props.onSaveOpportunity({ plannedFinish: value })}
            />
          </DealFact>
          <DealFact label="Дата создания">{formatDate(props.opportunity.createdAt)}</DealFact>
          <DealFact label="Ответственный">{props.data.me.name}</DealFact>
          <DealFact label="Тип клиента">Клиент</DealFact>
          <DealFact label="Отрасль">-</DealFact>
          <DealFact label="Описание">
            <InlineEditableValue
              disabled={!canInlineEdit || props.isPending}
              label="Описание"
              mode="textarea"
              value={props.opportunity.description ?? ""}
              display={props.opportunity.description || "-"}
              onSave={(value) => props.onSaveOpportunity({ description: value.trim() })}
            />
          </DealFact>
          <RuntimeCustomFieldFacts
            canEdit={canInlineEdit}
            data={props.data}
            isPending={props.isPending}
            opportunity={props.opportunity}
            onSaveOpportunity={props.onSaveOpportunity}
          />
        </dl>
      </div>
    </section>
  );
}

export function DealRelationshipCards(props: {
  canManageClients: boolean;
  canManageContacts: boolean;
  data: WorkspaceData;
  isPending: boolean;
  opportunity: Opportunity;
  onOpenClient: (clientId: string) => void;
  onOpenContact: (contactId: string) => void;
  onSaveClient: (client: Client, patch: Partial<Client>) => Promise<void>;
  onSaveContact: (contact: Contact, patch: Partial<Contact>) => Promise<void>;
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
          <DealFact label="Название">
            {client ? (
              <InlineEditableValue
                disabled={!props.canManageClients || props.isPending}
                label="Название компании"
                value={client.name}
                onSave={(value) => props.onSaveClient(client, { name: value })}
              />
            ) : (
              "-"
            )}
          </DealFact>
          <DealFact label="Описание">
            {client ? (
              <InlineEditableValue
                disabled={!props.canManageClients || props.isPending}
                label="Описание компании"
                mode="textarea"
                value={client.description ?? ""}
                display={client.description || "Описание не задано"}
                onSave={(value) => props.onSaveClient(client, { description: value })}
              />
            ) : (
              "-"
            )}
          </DealFact>
          <DealFact label="Статус">
            {client ? (
              <InlineEditableValue
                disabled={!props.canManageClients || props.isPending}
                label="Статус компании"
                mode="select"
                options={crmStatusOptions}
                value={client.status}
                display={client.status === "active" ? "Активен" : "Архив"}
                onSave={(value) =>
                  props.onSaveClient(client, { status: value as Client["status"] })
                }
              />
            ) : (
              "-"
            )}
          </DealFact>
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
          <DealFact label="Имя">
            {contact ? (
              <InlineEditableValue
                disabled={!props.canManageContacts || props.isPending}
                label="Имя контакта"
                value={contact.name}
                onSave={(value) => props.onSaveContact(contact, { name: value })}
              />
            ) : (
              "-"
            )}
          </DealFact>
          <DealFact label="Email">
            {contact ? (
              <InlineEditableValue
                disabled={!props.canManageContacts || props.isPending}
                label="Email контакта"
                value={contact.email ?? ""}
                display={contact.email || "-"}
                onSave={(value) => props.onSaveContact(contact, { email: value })}
              />
            ) : (
              "-"
            )}
          </DealFact>
          <DealFact label="Телефон">
            {contact ? (
              <InlineEditableValue
                disabled={!props.canManageContacts || props.isPending}
                label="Телефон контакта"
                value={contact.phone ?? ""}
                display={contact.phone || "-"}
                onSave={(value) => props.onSaveContact(contact, { phone: value })}
              />
            ) : (
              "-"
            )}
          </DealFact>
          <DealFact label="Telegram">
            {contact ? (
              <InlineEditableValue
                disabled={!props.canManageContacts || props.isPending}
                label="Telegram контакта"
                value={contact.telegram ?? ""}
                display={contact.telegram || "-"}
                onSave={(value) => props.onSaveContact(contact, { telegram: value })}
              />
            ) : (
              "-"
            )}
          </DealFact>
          <DealFact label="Роль в сделке">
            {contact ? (
              <InlineEditableValue
                disabled={!props.canManageContacts || props.isPending}
                label="Роль контакта"
                value={contact.role ?? ""}
                display={contact.role || "-"}
                onSave={(value) => props.onSaveContact(contact, { role: value })}
              />
            ) : (
              "-"
            )}
          </DealFact>
          <DealFact label="Статус">
            {contact ? (
              <InlineEditableValue
                disabled={!props.canManageContacts || props.isPending}
                label="Статус контакта"
                mode="select"
                options={crmStatusOptions}
                value={contact.status}
                display={contact.status === "active" ? "Активен" : "Архив"}
                onSave={(value) =>
                  props.onSaveContact(contact, { status: value as Contact["status"] })
                }
              />
            ) : (
              "-"
            )}
          </DealFact>
          <DealFact label="Ответственный">{props.data.me.name}</DealFact>
        </dl>
      </section>
    </div>
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

const crmStatusOptions = [
  { label: "Активен", value: "active" },
  { label: "Архив", value: "archived" }
];

function RuntimeCustomFieldFacts(props: {
  canEdit: boolean;
  data: WorkspaceData;
  isPending: boolean;
  opportunity: Opportunity;
  onSaveOpportunity: (patch: Partial<OpportunityUpdateInput>) => Promise<void>;
}) {
  const fields = props.data.customFields.filter(
    (field) => field.targetEntity === "opportunity" && field.status === "active"
  );
  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((field) => (
        <DealFact key={field.id} label={field.tenantLabel}>
          <InlineEditableValue
            disabled={!props.canEdit || props.isPending}
            label={field.tenantLabel}
            mode={getInlineCustomFieldMode(field)}
            value={props.opportunity.customFieldValues[field.id] ?? ""}
            display={props.opportunity.customFieldValues[field.id] || "Не заполнено"}
            onSave={(value) =>
              props.onSaveOpportunity({
                customFieldValues: {
                  ...props.opportunity.customFieldValues,
                  [field.id]: value.trim()
                }
              })
            }
          />
        </DealFact>
      ))}
    </>
  );
}

function InlineEditableValue(props: {
  disabled?: boolean;
  display?: React.ReactNode;
  label: string;
  mode?: "date" | "number" | "select" | "text" | "textarea";
  options?: { label: string; value: string }[];
  suffix?: string;
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(props.value);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const mode = props.mode ?? "text";

  function startEdit() {
    if (props.disabled) return;
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
    setError("");
    setIsSaving(true);
    try {
      await props.onSave(draft);
      setIsEditing(false);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    if (props.disabled) {
      return (
        <span className="inline-readonly-value">
          {props.display ?? formatInlineDisplay(props.value, props.suffix)}
        </span>
      );
    }

    return (
      <button
        className="inline-edit-trigger"
        type="button"
        aria-label={`Редактировать поле ${props.label}`}
        onClick={startEdit}
      >
        {props.display ?? formatInlineDisplay(props.value, props.suffix)}
      </button>
    );
  }

  return (
    <span className="inline-edit-control">
      {mode === "select" ? (
        <select
          aria-label={props.label}
          autoFocus
          disabled={isSaving}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEdit();
          }}
        >
          {props.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : mode === "textarea" ? (
        <textarea
          aria-label={props.label}
          autoFocus
          disabled={isSaving}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEdit();
          }}
        />
      ) : (
        <input
          aria-label={props.label}
          autoFocus
          disabled={isSaving}
          type={mode}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEdit();
            if (event.key === "Enter") void save();
          }}
        />
      )}
      {error ? <small className="inline-edit-error" role="alert">{error}</small> : null}
      <span className="inline-edit-actions">
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
  );
}

function formatInlineDisplay(value: string, suffix?: string): string {
  const visibleValue = value.trim() || "-";
  return suffix && value.trim() ? `${visibleValue} ${suffix}` : visibleValue;
}

function getInlineCustomFieldMode(
  field: CustomFieldDefinition
): "date" | "number" | "text" {
  if (field.fieldType === "date") return "date";
  if (field.fieldType === "number") return "number";
  return "text";
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

function isFinalOpportunity(opportunity: Opportunity): boolean {
  return opportunity.status === "won_closed" || opportunity.status === "lost_rejected";
}
