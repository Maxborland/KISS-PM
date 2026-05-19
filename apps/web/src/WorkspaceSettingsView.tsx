import { useMemo, useState } from "react";

import { type CustomFieldDefinition, type ProjectTemplate } from "./api";
import { type WorkspaceData } from "./workspaceData";
import { useWorkspaceConfigMutations } from "./workspaceQueries";
import {
  type FormErrors,
  getFieldErrorId,
  hasFormErrors,
  validateCustomFieldForm,
  validateProjectTemplateForm
} from "./workspaceForms";
import {
  filterCustomFields,
  filterProjectTemplates,
  formatDate,
  getFieldTypeLabel
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
export function WorkspaceSettingsView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageConfig = hasPermission(
    props.data.permissions,
    "tenant.workspace_config.manage"
  );
  const configMutations = useWorkspaceConfigMutations();
  const [modal, setModal] = useState<
    | { type: "create-field" }
    | { type: "edit-field"; fieldId: string }
    | { type: "create-template" }
    | { type: "edit-template"; templateId: string }
    | null
  >(null);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [fieldSearch, setFieldSearch] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const editingField =
    modal?.type === "edit-field"
      ? props.data.customFields.find((field) => field.id === modal.fieldId)
      : null;
  const editingTemplate =
    modal?.type === "edit-template"
      ? props.data.projectTemplates.find((template) => template.id === modal.templateId)
      : null;
  const isFieldFormOpen = modal?.type === "create-field" || modal?.type === "edit-field";
  const isTemplateFormOpen =
    modal?.type === "create-template" || modal?.type === "edit-template";
  const isSaving =
    configMutations.createCustomField.isPending ||
    configMutations.updateCustomField.isPending ||
    configMutations.createProjectTemplate.isPending ||
    configMutations.updateProjectTemplate.isPending;
  const filteredFields = useMemo(
    () => filterCustomFields(props.data.customFields, fieldSearch),
    [props.data.customFields, fieldSearch]
  );
  const filteredTemplates = useMemo(
    () => filterProjectTemplates(props.data.projectTemplates, templateSearch),
    [props.data.projectTemplates, templateSearch]
  );
  const activeFields = props.data.customFields.filter((field) => field.status === "active").length;
  const activeTemplates = props.data.projectTemplates.filter(
    (template) => template.status === "active"
  ).length;

  function closeModal() {
    if (isSaving) return;
    setModal(null);
    setFormError("");
    setFieldErrors({});
  }

  async function submitCustomField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const systemKey = String(form.get("systemKey"));
    const input = {
      systemKey,
      tenantLabel: String(form.get("tenantLabel")),
      targetEntity: "project" as const,
      fieldType: String(form.get("fieldType")) as CustomFieldDefinition["fieldType"],
      required: form.get("required") === "on",
      status: String(form.get("status")) as CustomFieldDefinition["status"]
    };
    const validationErrors = validateCustomFieldForm(input);
    setFormError("");
    setFieldErrors({});

    if (hasFormErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      return;
    }

    try {
      if (editingField) {
        await configMutations.updateCustomField.mutateAsync({
          fieldId: editingField.id,
          input
        });
      } else {
        await configMutations.createCustomField.mutateAsync({
          id: `field-${Date.now().toString(36)}`,
          ...input
        });
      }

      formElement.reset();
      setModal(null);
      setFormError("");
      setFieldErrors({});
      props.onChanged("Пользовательские поля обновлены");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  async function submitProjectTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const systemKey = String(form.get("systemKey"));
    const input = {
      systemKey,
      tenantLabel: String(form.get("tenantLabel")),
      description: String(form.get("description") ?? ""),
      status: String(form.get("status")) as ProjectTemplate["status"]
    };
    const validationErrors = validateProjectTemplateForm(input);
    setFormError("");
    setFieldErrors({});

    if (hasFormErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      return;
    }

    try {
      if (editingTemplate) {
        await configMutations.updateProjectTemplate.mutateAsync({
          templateId: editingTemplate.id,
          input
        });
      } else {
        await configMutations.createProjectTemplate.mutateAsync({
          id: `template-${Date.now().toString(36)}`,
          ...input
        });
      }

      formElement.reset();
      setModal(null);
      setFormError("");
      setFieldErrors({});
      props.onChanged("Шаблоны проектов обновлены");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  return (
    <>
      <div className="settings-grid">
        <Panel
          title="Пользовательские поля"
          subtitle="Названия рабочего пространства поверх стабильных системных ключей. Пока применяются к проектам."
          actions={
            canManageConfig ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setModal({ type: "create-field" })}
              >
                Создать поле
              </button>
            ) : (
              <DisabledAction reason="Нужно право tenant.workspace_config.manage" />
            )
          }
        >
          <div className="surface-summary-grid">
            <SummaryCard label="Всего полей" value={props.data.customFields.length} />
            <SummaryCard label="Активные" value={activeFields} tone="success" />
            <SummaryCard
              label="Черновики"
              value={props.data.customFields.length - activeFields}
              tone="muted"
            />
          </div>
          <CrudToolbar
            searchLabel="Поиск пользовательских полей"
            searchPlaceholder="Ключ, название, тип..."
            searchValue={fieldSearch}
            resultCount={filteredFields.length}
            totalCount={props.data.customFields.length}
            onSearchChange={setFieldSearch}
          >
            <span className="toolbar-chip">Системный ключ неизменяем</span>
          </CrudToolbar>
          <SectionFeedback state={props.sectionState} emptyLabel="Настройки недоступны." />
          {props.sectionState.canRead && !props.sectionState.error ? (
            <div className="table-wrap">
              <table className="data-table" aria-label="Пользовательские поля">
                <thead>
                  <tr>
                    <th>Поле</th>
                    <th>Тип</th>
                    <th>Обязательное</th>
                    <th>Статус</th>
                    <th>Обновлено</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFields.length === 0 ? (
                    <TableEmpty colSpan={6} label="Пользовательских полей пока нет." />
                  ) : (
                    filteredFields.map((field) => (
                      <tr key={field.id}>
                        <td>
                          <span className="entity-name-cell">
                            <span className="row-avatar">F</span>
                            <span>
                              <strong>{field.tenantLabel}</strong>
                              <small>{field.systemKey}</small>
                            </span>
                          </span>
                        </td>
                        <td>{getFieldTypeLabel(field.fieldType)}</td>
                        <td>{field.required ? "Да" : "Нет"}</td>
                        <td>
                          <StatusPill
                            tone={field.status === "active" ? "success" : "muted"}
                            label={field.status === "active" ? "Активно" : "Черновик"}
                          />
                        </td>
                        <td>{formatDate(field.updatedAt)}</td>
                        <td>
                          {canManageConfig ? (
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => setModal({ type: "edit-field", fieldId: field.id })}
                            >
                              Редактировать
                            </button>
                          ) : (
                            <span className="muted">Только просмотр</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Шаблоны проектов"
          subtitle="Базовые шаблоны проектов для будущего проектного контура. Сейчас редактируются название, описание и статус."
          actions={
            canManageConfig ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setModal({ type: "create-template" })}
              >
                Создать шаблон
              </button>
            ) : (
              <DisabledAction reason="Нужно право tenant.workspace_config.manage" />
            )
          }
        >
          <div className="surface-summary-grid">
            <SummaryCard label="Всего шаблонов" value={props.data.projectTemplates.length} />
            <SummaryCard label="Активные" value={activeTemplates} tone="success" />
            <SummaryCard
              label="Черновики"
              value={props.data.projectTemplates.length - activeTemplates}
              tone="muted"
            />
          </div>
          <CrudToolbar
            searchLabel="Поиск шаблонов"
            searchPlaceholder="Ключ, название, описание..."
            searchValue={templateSearch}
            resultCount={filteredTemplates.length}
            totalCount={props.data.projectTemplates.length}
            onSearchChange={setTemplateSearch}
          >
            <span className="toolbar-chip">Базовый набор</span>
          </CrudToolbar>
          <SectionFeedback state={props.sectionState} emptyLabel="Настройки недоступны." />
          {props.sectionState.canRead && !props.sectionState.error ? (
            <div className="table-wrap">
              <table className="data-table" aria-label="Шаблоны проектов">
                <thead>
                  <tr>
                    <th>Шаблон</th>
                    <th>Описание</th>
                    <th>Статус</th>
                    <th>Обновлено</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.length === 0 ? (
                    <TableEmpty colSpan={5} label="Шаблонов проектов пока нет." />
                  ) : (
                    filteredTemplates.map((template) => (
                      <tr key={template.id}>
                        <td>
                          <span className="entity-name-cell">
                            <span className="row-avatar">T</span>
                            <span>
                              <strong>{template.tenantLabel}</strong>
                              <small>{template.systemKey}</small>
                            </span>
                          </span>
                        </td>
                        <td>{template.description || "Описание не задано"}</td>
                        <td>
                          <StatusPill
                            tone={template.status === "active" ? "success" : "muted"}
                            label={template.status === "active" ? "Активен" : "Черновик"}
                          />
                        </td>
                        <td>{formatDate(template.updatedAt)}</td>
                        <td>
                          {canManageConfig ? (
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: "edit-template",
                                  templateId: template.id
                                })
                              }
                            >
                              Редактировать
                            </button>
                          ) : (
                            <span className="muted">Только просмотр</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>
      </div>

      {isFieldFormOpen ? (
        <Modal
          title={editingField ? "Редактировать пользовательское поле" : "Создать пользовательское поле"}
          description="Системный ключ задается при создании и дальше остается стабильным."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingField?.id ?? "new-custom-field"}
            noValidate
            onSubmit={submitCustomField}
          >
            <label htmlFor="custom-field-systemKey">
              Системный ключ
              <input
                id="custom-field-systemKey"
                name="systemKey"
                aria-describedby={
                  fieldErrors.systemKey
                    ? getFieldErrorId("custom-field", "systemKey")
                    : "custom-field-systemKey-help"
                }
                aria-invalid={Boolean(fieldErrors.systemKey)}
                data-autofocus
                defaultValue={editingField?.systemKey ?? ""}
                readOnly={Boolean(editingField)}
                required
              />
              <small id="custom-field-systemKey-help" className="field-help">
                Например: project_priority. После создания ключ не переименовывается.
              </small>
              <FieldError formId="custom-field" field="systemKey" errors={fieldErrors} />
            </label>
            <label htmlFor="custom-field-tenantLabel">
              Название в интерфейсе
              <input
                id="custom-field-tenantLabel"
                name="tenantLabel"
                aria-describedby={
                  fieldErrors.tenantLabel
                    ? getFieldErrorId("custom-field", "tenantLabel")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.tenantLabel)}
                defaultValue={editingField?.tenantLabel ?? ""}
                required
              />
              <FieldError formId="custom-field" field="tenantLabel" errors={fieldErrors} />
            </label>
            <input name="targetEntity" type="hidden" value="project" />
            <label htmlFor="custom-field-fieldType">
              Тип поля
              <select
                id="custom-field-fieldType"
                name="fieldType"
                aria-describedby={
                  fieldErrors.fieldType
                    ? getFieldErrorId("custom-field", "fieldType")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.fieldType)}
                defaultValue={editingField?.fieldType ?? "text"}
              >
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="date">Дата</option>
                <option value="select">Список</option>
              </select>
              <FieldError formId="custom-field" field="fieldType" errors={fieldErrors} />
            </label>
            <label className="checkbox-row">
              <input
                defaultChecked={editingField?.required ?? false}
                name="required"
                type="checkbox"
              />
              Обязательное поле
            </label>
            <label htmlFor="custom-field-status">
              Статус
              <select
                id="custom-field-status"
                name="status"
                aria-describedby={
                  fieldErrors.status
                    ? getFieldErrorId("custom-field", "status")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.status)}
                defaultValue={editingField?.status ?? "draft"}
              >
                <option value="draft">Черновик</option>
                <option value="active">Активно</option>
              </select>
              <FieldError formId="custom-field" field="status" errors={fieldErrors} />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Сохраняем..." : "Сохранить поле"}
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

      {isTemplateFormOpen ? (
        <Modal
          title={editingTemplate ? "Редактировать шаблон" : "Создать шаблон"}
          description="Шаблон хранит базовые метаданные для будущего контура проектов."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingTemplate?.id ?? "new-project-template"}
            noValidate
            onSubmit={submitProjectTemplate}
          >
            <label htmlFor="project-template-systemKey">
              Системный ключ
              <input
                id="project-template-systemKey"
                name="systemKey"
                aria-describedby={
                  fieldErrors.systemKey
                    ? getFieldErrorId("project-template", "systemKey")
                    : "project-template-systemKey-help"
                }
                aria-invalid={Boolean(fieldErrors.systemKey)}
                data-autofocus
                defaultValue={editingTemplate?.systemKey ?? ""}
                readOnly={Boolean(editingTemplate)}
                required
              />
              <small id="project-template-systemKey-help" className="field-help">
                Например: implementation. После создания ключ не переименовывается.
              </small>
              <FieldError formId="project-template" field="systemKey" errors={fieldErrors} />
            </label>
            <label htmlFor="project-template-tenantLabel">
              Название шаблона
              <input
                id="project-template-tenantLabel"
                name="tenantLabel"
                aria-describedby={
                  fieldErrors.tenantLabel
                    ? getFieldErrorId("project-template", "tenantLabel")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.tenantLabel)}
                defaultValue={editingTemplate?.tenantLabel ?? ""}
                required
              />
              <FieldError formId="project-template" field="tenantLabel" errors={fieldErrors} />
            </label>
            <label htmlFor="project-template-description">
              Описание
              <textarea
                id="project-template-description"
                name="description"
                aria-describedby={
                  fieldErrors.description
                    ? getFieldErrorId("project-template", "description")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.description)}
                defaultValue={editingTemplate?.description ?? ""}
                rows={4}
              />
              <FieldError formId="project-template" field="description" errors={fieldErrors} />
            </label>
            <label htmlFor="project-template-status">
              Статус
              <select
                id="project-template-status"
                name="status"
                aria-describedby={
                  fieldErrors.status
                    ? getFieldErrorId("project-template", "status")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.status)}
                defaultValue={editingTemplate?.status ?? "draft"}
              >
                <option value="draft">Черновик</option>
                <option value="active">Активен</option>
              </select>
              <FieldError formId="project-template" field="status" errors={fieldErrors} />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Сохраняем..." : "Сохранить шаблон"}
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