import {
  Calculator,
  ClipboardCheck,
  PlayCircle
} from "lucide-react";
import { useMemo, useState } from "react";

import type { Opportunity, OpportunityInput } from "./api";
import type { WorkspaceData } from "./workspaceData";
import { useProjectIntakeMutations } from "./workspaceQueries";
import {
  type FormErrors,
  getFieldErrorId,
  hasFormErrors,
  validateOpportunityForm
} from "./workspaceForms";
import { filterOpportunitiesForTable } from "./workspaceTables";
import {
  formatDate,
  formatDateOnly
} from "./workspaceViewHelpers";
import {
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
  sectionState: SectionState;
  onChanged: (message: string) => void;
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
  const mutations = useProjectIntakeMutations();
  const [modal, setModal] = useState<"create" | null>(null);
  const [activationTargetId, setActivationTargetId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [demandLines, setDemandLines] = useState<DemandFormLine[]>([
    defaultDemandLine()
  ]);
  const [contractValue, setContractValue] = useState("");
  const [plannedHourlyRate, setPlannedHourlyRate] = useState("");
  const filteredOpportunities = useMemo(
    () => filterOpportunitiesForTable(props.data.opportunities, tableSearch),
    [props.data.opportunities, tableSearch]
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
  const isSaving =
    mutations.createOpportunity.isPending ||
    mutations.checkFeasibility.isPending ||
    mutations.activateProject.isPending;
  const activationTarget = props.data.opportunities.find(
    (opportunity) => opportunity.id === activationTargetId
  ) ?? null;

  function closeModal() {
    if (isSaving) return;
    setModal(null);
    setActivationTargetId(null);
    setFormError("");
    setFieldErrors({});
    setDemandLines([defaultDemandLine()]);
    setContractValue("");
    setPlannedHourlyRate("");
  }

  async function submitOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const validationInput = {
      clientName: String(form.get("clientName")),
      title: String(form.get("title")),
      projectType: String(form.get("projectType")),
      plannedStart: String(form.get("plannedStart")),
      plannedFinish: String(form.get("plannedFinish")),
      contractValue: String(form.get("contractValue")),
      plannedHourlyRate: String(form.get("plannedHourlyRate")),
      probability: String(form.get("probability")),
      demand: demandLines.map((line) => ({
        positionId: line.positionId,
        requiredHours: line.requiredHours
      }))
    };
    const validationErrors = validateOpportunityForm(validationInput);
    setFormError("");
    setFieldErrors({});

    if (hasFormErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      return;
    }

    const input: OpportunityInput = {
      clientName: validationInput.clientName.trim(),
      contactName: String(form.get("contactName") ?? "").trim(),
      title: validationInput.title.trim(),
      projectType: validationInput.projectType.trim(),
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
      await mutations.createOpportunity.mutateAsync(input);
      formElement.reset();
      closeModal();
      props.onChanged("Возможность создана");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  async function checkFeasibility(opportunity: Opportunity) {
    setFormError("");
    try {
      await mutations.checkFeasibility.mutateAsync(opportunity.id);
      props.onChanged("Ресурсная проверка выполнена");
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
      await mutations.activateProject.mutateAsync({
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
        title="Возможности"
        subtitle="Ручной CRM-вход: сделка, плановая ставка, потребность по должностям и проверка ресурса перед активацией проекта."
        actions={
          canManageOpportunities ? (
            <button
              className="primary-button"
              disabled={props.data.positions.length === 0}
              title={
                props.data.positions.length === 0
                  ? "Сначала добавьте хотя бы одну должность"
                  : undefined
              }
              type="button"
              onClick={() => setModal("create")}
            >
              Создать возможность
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.opportunities.manage" />
          )
        }
      >
        <div className="surface-summary-grid">
          <SummaryCard label="Всего возможностей" value={props.data.opportunities.length} />
          <SummaryCard label="Готовы к активации" value={readyToActivate} tone="success" />
          <SummaryCard label="Конфликты ресурса" value={conflicts} tone="muted" />
        </div>
        <CrudToolbar
          searchLabel="Поиск возможностей"
          searchPlaceholder="Клиент, проект, тип, статус..."
          searchValue={tableSearch}
          resultCount={filteredOpportunities.length}
          totalCount={props.data.opportunities.length}
          onSearchChange={setTableSearch}
        >
          <span className="toolbar-chip">
            <Calculator aria-hidden="true" size={14} />
            {formatMoney(totalContractValue)}
          </span>
          <span className="toolbar-chip">Ставка задается в сделке</span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Возможности недоступны." />
        {props.sectionState.canRead && !props.sectionState.error ? (
          <div className="table-wrap">
            <table className="data-table" aria-label="Возможности">
              <thead>
                <tr>
                  <th>Сделка</th>
                  <th>Период</th>
                  <th>План</th>
                  <th>Потребность</th>
                  <th>Ресурсная проверка</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpportunities.length === 0 ? (
                  <TableEmpty
                    colSpan={6}
                    label={
                      props.data.opportunities.length === 0
                        ? "Возможностей пока нет."
                        : "По фильтру ничего не найдено."
                    }
                  />
                ) : (
                  filteredOpportunities.map((opportunity) => (
                    <tr key={opportunity.id}>
                      <td>
                        <span className="entity-name-cell">
                          <span className="row-avatar">O</span>
                          <span>
                            <strong>{opportunity.title}</strong>
                            <small>
                              {opportunity.clientName}
                              {opportunity.contactName ? ` · ${opportunity.contactName}` : ""}
                            </small>
                          </span>
                        </span>
                      </td>
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
                          {canCheckFeasibility && !isFinalOpportunity(opportunity) ? (
                            <button
                              className="secondary-button"
                              disabled={mutations.checkFeasibility.isPending}
                              type="button"
                              onClick={() => checkFeasibility(opportunity)}
                            >
                              Проверить ресурсы
                            </button>
                          ) : null}
                          {renderActivationAction({
                            canActivateProjects,
                            isPending: mutations.activateProject.isPending,
                            opportunity,
                            onActivate: () => {
                              setFormError("");
                              setFieldErrors({});
                              setActivationTargetId(opportunity.id);
                            }
                          })}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      {modal === "create" ? (
        <Modal
          title="Создать возможность"
          description="Заполните карточку сделки. Плановые часы будут рассчитаны как стоимость контракта / плановая норма часа."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form className="stack-form" noValidate onSubmit={submitOpportunity}>
            <label htmlFor="opportunity-clientName">
              Клиент
              <input
                id="opportunity-clientName"
                name="clientName"
                aria-describedby={
                  fieldErrors.clientName
                    ? getFieldErrorId("opportunity", "clientName")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.clientName)}
                data-autofocus
                required
              />
              <FieldError formId="opportunity" field="clientName" errors={fieldErrors} />
            </label>
            <label htmlFor="opportunity-contactName">
              Контакт
              <input id="opportunity-contactName" name="contactName" />
            </label>
            <label htmlFor="opportunity-title">
              Название входящего проекта
              <input
                id="opportunity-title"
                name="title"
                aria-describedby={
                  fieldErrors.title ? getFieldErrorId("opportunity", "title") : undefined
                }
                aria-invalid={Boolean(fieldErrors.title)}
                required
              />
              <FieldError formId="opportunity" field="title" errors={fieldErrors} />
            </label>
            <label htmlFor="opportunity-projectType">
              Тип проекта
              <input
                id="opportunity-projectType"
                name="projectType"
                aria-describedby={
                  fieldErrors.projectType
                    ? getFieldErrorId("opportunity", "projectType")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.projectType)}
                placeholder="например: внедрение"
                required
              />
              <FieldError formId="opportunity" field="projectType" errors={fieldErrors} />
            </label>
            <label htmlFor="opportunity-description">
              Описание
              <textarea id="opportunity-description" name="description" rows={3} />
            </label>
            <div className="grid-3">
              <label htmlFor="opportunity-plannedStart">
                Старт
                <input
                  id="opportunity-plannedStart"
                  name="plannedStart"
                  type="date"
                  aria-describedby={
                    fieldErrors.plannedStart
                      ? getFieldErrorId("opportunity", "plannedStart")
                      : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.plannedStart)}
                  required
                />
                <FieldError formId="opportunity" field="plannedStart" errors={fieldErrors} />
              </label>
              <label htmlFor="opportunity-plannedFinish">
                Плановый финиш
                <input
                  id="opportunity-plannedFinish"
                  name="plannedFinish"
                  type="date"
                  aria-describedby={
                    fieldErrors.plannedFinish
                      ? getFieldErrorId("opportunity", "plannedFinish")
                      : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.plannedFinish)}
                  required
                />
                <FieldError formId="opportunity" field="plannedFinish" errors={fieldErrors} />
              </label>
              <label htmlFor="opportunity-probability">
                Вероятность, %
                <input
                  id="opportunity-probability"
                  name="probability"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="70"
                />
                <FieldError formId="opportunity" field="probability" errors={fieldErrors} />
              </label>
            </div>
            <div className="grid-3">
              <label htmlFor="opportunity-contractValue">
                Стоимость контракта
                <input
                  id="opportunity-contractValue"
                  name="contractValue"
                  type="number"
                  min="1"
                  value={contractValue}
                  onChange={(event) => setContractValue(event.target.value)}
                />
                <FieldError formId="opportunity" field="contractValue" errors={fieldErrors} />
              </label>
              <label htmlFor="opportunity-plannedHourlyRate">
                Плановая норма часа
                <input
                  id="opportunity-plannedHourlyRate"
                  name="plannedHourlyRate"
                  type="number"
                  min="1"
                  value={plannedHourlyRate}
                  onChange={(event) => setPlannedHourlyRate(event.target.value)}
                />
                <FieldError formId="opportunity" field="plannedHourlyRate" errors={fieldErrors} />
              </label>
              <label htmlFor="opportunity-templateId">
                Шаблон проекта
                <select id="opportunity-templateId" name="templateId" defaultValue="">
                  <option value="">Без шаблона</option>
                  {props.data.projectTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.tenantLabel}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="danger-callout" aria-live="polite">
              <strong>Плановая емкость: {plannedHoursPreview} ч</strong>
              <span>
                Потребность по должностям: {demandedHoursPreview} ч. Если потребность
                выше плановой емкости, проверка вернет конфликт.
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
                      {props.data.positions.map((position) => (
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
              <FieldError formId="opportunity" field="demand" errors={fieldErrors} />
              <FieldError formId="opportunity" field="demandDuplicates" errors={fieldErrors} />
            </fieldset>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Создаем..." : "Создать возможность"}
              </button>
              <button
                className="secondary-button"
                disabled={isSaving}
                type="button"
                onClick={closeModal}
              >
                Отменить
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {activationTarget ? (
        <Modal
          title="Активировать проект"
          description="После подтверждения возможность станет активным проектом и действие попадет в аудит."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form className="stack-form" noValidate onSubmit={activateProject}>
            <div className="danger-callout">
              <strong>{activationTarget.title}</strong>
              <span>
                {activationTarget.clientName} · {activationTarget.plannedHours} ч ·{" "}
                {getFeasibilityLabel(activationTarget.feasibilityStatus)}
              </span>
            </div>
            {activationTarget.feasibilityStatus === "conflict" ? (
              <label htmlFor="activation-risk-reason">
                Причина принятия риска
                <textarea
                  id="activation-risk-reason"
                  name="acceptedRiskReason"
                  aria-describedby={
                    fieldErrors.acceptedRiskReason
                      ? getFieldErrorId("activation", "acceptedRiskReason")
                      : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.acceptedRiskReason)}
                  data-autofocus
                  rows={4}
                />
                <FieldError formId="activation" field="acceptedRiskReason" errors={fieldErrors} />
              </label>
            ) : null}
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Активируем..." : "Активировать проект"}
              </button>
              <button
                className="secondary-button"
                disabled={isSaving}
                type="button"
                onClick={closeModal}
              >
                Отменить
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
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
