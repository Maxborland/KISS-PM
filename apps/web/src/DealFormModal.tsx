import { useMemo, useState } from "react";

import type {
  Client,
  Contact,
  CustomFieldDefinition,
  DealStage,
  Opportunity,
  OpportunityInput,
  OpportunityUpdateInput,
  ProjectType
} from "./api";
import type { WorkspaceData } from "./workspaceData";
import {
  type FormErrors,
  hasFormErrors,
  validateOpportunityCustomFields,
  validateOpportunityForm
} from "./workspaceForms";
import { getErrorMessage } from "./workspaceShellState";
import { formatHourlyRate, formatHours, formatMoney } from "./workspaceViewHelpers";
import { DatePickerField } from "./components/DatePickerField";
import { FieldError, Modal } from "./components/workspace-ui";

type DemandFormLine = {
  key: string;
  positionId: string;
  requiredHours: string;
};

export type DealFormSubmitInput = OpportunityInput | OpportunityUpdateInput;

export function DealFormModal(props: {
  activeStages: DealStage[];
  clients: Client[];
  customFields: CustomFieldDefinition[];
  error: string;
  initialOpportunity?: Opportunity | null;
  isSaving: boolean;
  positions: WorkspaceData["positions"];
  projectTemplates: WorkspaceData["projectTemplates"];
  projectTypes: ProjectType[];
  users: WorkspaceData["users"];
  allContacts: Contact[];
  onClose: () => void;
  onSubmit: (input: DealFormSubmitInput) => Promise<void>;
}) {
  const initial = props.initialOpportunity ?? null;
  const [formError, setFormError] = useState(props.error);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [selectedClientId, setSelectedClientId] = useState(initial?.clientId ?? "");
  const [selectedContactId, setSelectedContactId] = useState(
    initial?.primaryContactId ?? ""
  );
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState(
    initial?.ownerUserId ?? props.users.find((user) => user.status === "active")?.id ?? ""
  );
  const [contractValue, setContractValue] = useState(
    initial ? String(initial.contractValue) : ""
  );
  const [plannedHourlyRate, setPlannedHourlyRate] = useState(
    initial ? String(initial.plannedHourlyRate) : ""
  );
  const [plannedStart, setPlannedStart] = useState(toDateInputValue(initial?.plannedStart));
  const [plannedFinish, setPlannedFinish] = useState(toDateInputValue(initial?.plannedFinish));
  const [demandLines, setDemandLines] = useState<DemandFormLine[]>(
    initial?.demand.length
      ? initial.demand.map((line) => ({
          key: `demand-${line.positionId}`,
          positionId: line.positionId,
          requiredHours: String(line.requiredHours)
        }))
      : [defaultDemandLine()]
  );
  const availableContacts = useMemo(
    () =>
      props.allContacts.filter(
        (contact) => contact.clientId === selectedClientId && contact.status === "active"
      ),
    [props.allContacts, selectedClientId]
  );
  const activeOpportunityFields = useMemo(
    () =>
      props.customFields.filter(
        (field) => field.targetEntity === "opportunity" && field.status === "active"
      ),
    [props.customFields]
  );
  const plannedHoursPreview = calculatePlannedHoursPreview(
    contractValue,
    plannedHourlyRate
  );
  const demandedHoursPreview = demandLines.reduce(
    (sum, line) => sum + parsePositiveInteger(line.requiredHours),
    0
  );
  const formId = initial ? "opportunity-edit" : "opportunity";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const validationInput = {
      clientId: selectedClientId,
      primaryContactId: selectedContactId,
      title: String(form.get("title") ?? ""),
      projectTypeId: String(form.get("projectTypeId") ?? ""),
      stageId: String(form.get("stageId") ?? ""),
      plannedStart,
      plannedFinish,
      contractValue,
      plannedHourlyRate,
      probability: String(form.get("probability") ?? ""),
      demand: demandLines.map((line) => ({
        positionId: line.positionId,
        requiredHours: line.requiredHours
      }))
    };
    const customFieldValues = collectCustomFieldValues(form, activeOpportunityFields);
    const validationErrors = {
      ...validateOpportunityForm(validationInput),
      ...validateOpportunityCustomFields(activeOpportunityFields, customFieldValues)
    };
    setFormError("");
    setFieldErrors(validationErrors);
    if (hasFormErrors(validationErrors)) return;

    const input: DealFormSubmitInput = {
      ...(initial ? {} : { id: String(form.get("id") ?? "") || undefined }),
      clientId: validationInput.clientId,
      primaryContactId: validationInput.primaryContactId,
      ownerUserId: selectedOwnerUserId || null,
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
      customFieldValues,
      demand: demandLines
        .filter((line) => line.positionId.trim())
        .map((line) => ({
          positionId: line.positionId,
          requiredHours: Number(line.requiredHours)
        }))
    };

    try {
      await props.onSubmit(input);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  function updateDemandLine(index: number, patch: Partial<DemandFormLine>) {
    setDemandLines((lines) =>
      lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line)
    );
  }

  return (
    <Modal
      title={initial ? "Редактировать сделку" : "Создать сделку"}
      description="Стоимость и плановая норма часа вводятся отдельно; необходимые часы считаются автоматически."
      isDismissDisabled={props.isSaving}
      size="wide"
      onClose={props.onClose}
    >
      <form className="stack-form deal-form-dense" noValidate onSubmit={submit}>
        <div className="grid-4">
          <label htmlFor={`${formId}-clientId`}>
            Клиент
            <select
              id={`${formId}-clientId`}
              name="clientId"
              data-autofocus
              value={selectedClientId}
              onChange={(event) => {
                setSelectedClientId(event.target.value);
                setSelectedContactId("");
              }}
            >
              <option value="">Выберите клиента</option>
              {props.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <FieldError formId={formId} field="clientId" errors={fieldErrors} />
          </label>
          <label htmlFor={`${formId}-primaryContactId`}>
            Контакт
            <select
              id={`${formId}-primaryContactId`}
              name="primaryContactId"
              value={selectedContactId}
              onChange={(event) => setSelectedContactId(event.target.value)}
            >
              <option value="">Выберите контакт</option>
              {availableContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
            <FieldError formId={formId} field="primaryContactId" errors={fieldErrors} />
          </label>
          <label htmlFor={`${formId}-stageId`}>
            Этап
            <select
              id={`${formId}-stageId`}
              name="stageId"
              defaultValue={initial?.stageId ?? props.activeStages[0]?.id ?? ""}
            >
              <option value="">Выберите этап</option>
              {props.activeStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
            <FieldError formId={formId} field="stageId" errors={fieldErrors} />
          </label>
          <label htmlFor={`${formId}-ownerUserId`}>
            Ответственный
            <select
              id={`${formId}-ownerUserId`}
              name="ownerUserId"
              value={selectedOwnerUserId}
              onChange={(event) => setSelectedOwnerUserId(event.target.value)}
            >
              <option value="">Не назначен</option>
              {props.users
                .filter((user) => user.status === "active")
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label htmlFor={`${formId}-title`}>
          Название сделки
          <input id={`${formId}-title`} name="title" defaultValue={initial?.title ?? ""} />
          <FieldError formId={formId} field="title" errors={fieldErrors} />
        </label>
        <div className="grid-3">
          <label htmlFor={`${formId}-projectTypeId`}>
            Тип проекта
            <select
              id={`${formId}-projectTypeId`}
              name="projectTypeId"
              defaultValue={initial?.projectTypeId ?? ""}
            >
              <option value="">Выберите тип</option>
              {props.projectTypes.map((projectType) => (
                <option key={projectType.id} value={projectType.id}>
                  {projectType.name}
                </option>
              ))}
            </select>
            <FieldError formId={formId} field="projectTypeId" errors={fieldErrors} />
          </label>
          <span className="form-field-shell">
            <DatePickerField
              describedBy={
                fieldErrors.plannedStart ? `${formId}-plannedStart-error` : undefined
              }
              id={`${formId}-plannedStart`}
              invalid={Boolean(fieldErrors.plannedStart)}
              label="Старт"
              name="plannedStart"
              value={plannedStart}
              onChange={setPlannedStart}
            />
            <FieldError formId={formId} field="plannedStart" errors={fieldErrors} />
          </span>
          <span className="form-field-shell">
            <DatePickerField
              describedBy={
                fieldErrors.plannedFinish ? `${formId}-plannedFinish-error` : undefined
              }
              id={`${formId}-plannedFinish`}
              invalid={Boolean(fieldErrors.plannedFinish)}
              label="Плановый финиш"
              name="plannedFinish"
              value={plannedFinish}
              onChange={setPlannedFinish}
            />
            <FieldError formId={formId} field="plannedFinish" errors={fieldErrors} />
          </span>
        </div>
        <label htmlFor={`${formId}-description`}>
          Описание
          <textarea
            id={`${formId}-description`}
            name="description"
            defaultValue={initial?.description ?? ""}
            rows={3}
          />
        </label>
        <div className="grid-3">
          <label htmlFor={`${formId}-contractValue`}>
            Стоимость
            <input
              id={`${formId}-contractValue`}
              name="contractValue"
              type="number"
              min="1"
              value={contractValue}
              onChange={(event) => setContractValue(event.target.value)}
            />
            <FieldError formId={formId} field="contractValue" errors={fieldErrors} />
          </label>
          <label htmlFor={`${formId}-plannedHourlyRate`}>
            Норма часа
            <input
              id={`${formId}-plannedHourlyRate`}
              name="plannedHourlyRate"
              type="number"
              min="1"
              value={plannedHourlyRate}
              onChange={(event) => setPlannedHourlyRate(event.target.value)}
            />
            <FieldError formId={formId} field="plannedHourlyRate" errors={fieldErrors} />
          </label>
          <label htmlFor={`${formId}-probability`}>
            Вероятность, %
            <input
              id={`${formId}-probability`}
              name="probability"
              type="number"
              min="0"
              max="100"
              defaultValue={initial?.probability ?? 70}
            />
            <FieldError formId={formId} field="probability" errors={fieldErrors} />
          </label>
        </div>
        <label htmlFor={`${formId}-templateId`}>
          Шаблон проекта
          <select
            id={`${formId}-templateId`}
            name="templateId"
            defaultValue={initial?.templateId ?? ""}
          >
            <option value="">Без шаблона</option>
            {props.projectTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.tenantLabel}
              </option>
            ))}
          </select>
        </label>
        {activeOpportunityFields.length > 0 ? (
          <fieldset className="permission-grid">
            <legend>Поля сделки</legend>
            <div className="grid-3">
              {activeOpportunityFields.map((field) => (
                <label key={field.id} htmlFor={`${formId}-${field.id}`}>
                  {field.tenantLabel}
                  <input
                    id={`${formId}-${field.id}`}
                    name={`customField:${field.id}`}
                    type={getCustomFieldInputType(field)}
                    defaultValue={initial?.customFieldValues?.[field.id] ?? ""}
                    aria-describedby={
                      fieldErrors[field.id] ? `${formId}-${field.id}-error` : undefined
                    }
                    aria-invalid={Boolean(fieldErrors[field.id])}
                    required={field.required}
                  />
                  <FieldError formId={formId} field={field.id} errors={fieldErrors} />
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="deal-economics-preview" aria-live="polite">
          <span>
            <strong>{formatMoney(Number(contractValue) || 0)}</strong>
            Стоимость
          </span>
          <span>
            <strong>{formatHourlyRate(Number(plannedHourlyRate) || 0)}</strong>
            Норма часа
          </span>
          <span>
            <strong>{formatHours(plannedHoursPreview)}</strong>
            Необходимые часы
          </span>
          <span>
            <strong>{formatHours(demandedHoursPreview)}</strong>
            Потребность по должностям
          </span>
        </div>
        <fieldset className="permission-grid">
          <legend>Потребность: должность + часы</legend>
          {demandLines.map((line, index) => (
            <div className="grid-3" key={line.key}>
              <label htmlFor={`${line.key}-position`}>
                Должность
                <select
                  id={`${line.key}-position`}
                  value={line.positionId}
                  onChange={(event) =>
                    updateDemandLine(index, { positionId: event.target.value })
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
                    updateDemandLine(index, { requiredHours: event.target.value })
                  }
                />
              </label>
              <span className="form-actions">
                <button
                  className="secondary-button"
                  disabled={demandLines.length === 1}
                  type="button"
                  onClick={() =>
                    setDemandLines((lines) =>
                      lines.filter((_, lineIndex) => lineIndex !== index)
                    )
                  }
                >
                  Удалить строку
                </button>
              </span>
            </div>
          ))}
          <button
            className="secondary-button"
            type="button"
            onClick={() => setDemandLines((lines) => [...lines, defaultDemandLine()])}
          >
            Добавить строку потребности
          </button>
          <FieldError formId={formId} field="demand" errors={fieldErrors} />
          <FieldError formId={formId} field="demandDuplicates" errors={fieldErrors} />
        </fieldset>
        {formError ? <p className="error" role="alert">{formError}</p> : null}
        <div className="form-actions">
          <button className="primary-button" disabled={props.isSaving} type="submit">
            {props.isSaving
              ? "Сохраняем..."
              : initial ? "Сохранить сделку" : "Создать сделку"}
          </button>
          <button
            className="secondary-button"
            disabled={props.isSaving}
            type="button"
            onClick={props.onClose}
          >
            Отменить
          </button>
        </div>
      </form>
    </Modal>
  );
}

function defaultDemandLine(): DemandFormLine {
  return {
    key: `demand-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    positionId: "",
    requiredHours: ""
  };
}

function collectCustomFieldValues(
  form: FormData,
  fields: CustomFieldDefinition[]
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = String(form.get(`customField:${field.id}`) ?? "").trim();
    if (value) values[field.id] = value;
  }
  return values;
}

function getCustomFieldInputType(field: CustomFieldDefinition): string {
  if (field.fieldType === "number") return "number";
  if (field.fieldType === "date") return "date";
  return "text";
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

function toDateInputValue(value: string | undefined): string {
  return value ? value.slice(0, 10) : "";
}
