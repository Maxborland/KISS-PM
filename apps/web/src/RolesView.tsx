import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { type AccessRole } from "./api";
import { type WorkspaceData } from "./workspaceData";
import { useAccessRoleMutations } from "./workspaceQueries";
import {
  type FormErrors,
  getFieldErrorId,
  hasFormErrors,
  validateRoleForm
} from "./workspaceForms";
import { filterRolesForTable } from "./workspaceTables";
import { rolePermissionOptions } from "./workspaceViewHelpers";
import {
  getErrorMessage,
  hasPermission,
  type SectionState
} from "./workspaceShellState";
import {
  ConfirmDialog,
  CrudToolbar,
  DisabledAction,
  FieldError,
  Modal,
  Panel,
  PermissionList,
  SectionFeedback,
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";

export function RolesView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageRoles = hasPermission(
    props.data.permissions,
    "tenant.access_profiles.manage"
  );
  const accessRoleMutations = useAccessRoleMutations();
  const [modal, setModal] = useState<
    | { type: "create" }
    | { type: "edit"; roleId: string }
    | { type: "delete"; roleId: string }
    | null
  >(null);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [tableSearch, setTableSearch] = useState("");
  const editingRole =
    modal?.type === "edit"
      ? props.data.accessRoles.find((role) => role.id === modal.roleId)
      : null;
  const deletingRole =
    modal?.type === "delete"
      ? props.data.accessRoles.find((role) => role.id === modal.roleId)
      : null;
  const isFormOpen = modal?.type === "create" || modal?.type === "edit";
  const isSaving =
    accessRoleMutations.createAccessRole.isPending ||
    accessRoleMutations.updateAccessRole.isPending ||
    accessRoleMutations.deleteAccessRole.isPending;
  const filteredRoles = useMemo(
    () => filterRolesForTable(props.data.accessRoles, tableSearch),
    [props.data.accessRoles, tableSearch]
  );
  const totalPermissions = props.data.accessRoles.reduce(
    (sum, role) => sum + role.permissions.length,
    0
  );
  const assignedRoles = props.data.accessRoles.filter((role) =>
    props.data.users.some((user) => user.accessProfileId === role.id)
  ).length;

  function closeModal() {
    if (isSaving) return;
    setModal(null);
    setFormError("");
    setFieldErrors({});
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const permissions = form.getAll("permissions").map(String);
    setFormError("");
    setFieldErrors({});

    try {
      const input = {
        name: String(form.get("name")),
        permissions
      };
      const validationErrors = validateRoleForm(input);

      if (hasFormErrors(validationErrors)) {
        setFieldErrors(validationErrors);
        return;
      }

      if (editingRole) {
        await accessRoleMutations.updateAccessRole.mutateAsync({
          roleId: editingRole.id,
          input
        });
      } else {
        await accessRoleMutations.createAccessRole.mutateAsync({
          id: `access-role-${Date.now().toString(36)}`,
          ...input
        });
      }

      formElement.reset();
      setModal(null);
      setFieldErrors({});
      props.onChanged("Роли доступа обновлены");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  async function removeRole(role: AccessRole | null) {
    if (!role) return;
    setFormError("");
    try {
      await accessRoleMutations.deleteAccessRole.mutateAsync(role.id);
      setModal(null);
      props.onChanged("Роли доступа обновлены");
    } catch (deleteError) {
      setFormError(getErrorMessage(deleteError));
    }
  }

  return (
    <>
      <Panel
        title="Роли доступа"
        subtitle="Минимальный RBAC scaffold: наборы разрешений без SaaS-админки."
        actions={
          canManageRoles ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setModal({ type: "create" })}
            >
              Создать роль доступа
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.access_profiles.manage" />
          )
        }
      >
        <div className="surface-summary-grid">
          <SummaryCard label="Всего ролей" value={props.data.accessRoles.length} />
          <SummaryCard label="Назначены" value={assignedRoles} tone="success" />
          <SummaryCard label="Разрешений в матрице" value={totalPermissions} tone="muted" />
        </div>
        <CrudToolbar
          searchLabel="Поиск ролей доступа"
          searchPlaceholder="Роль или permission key..."
          searchValue={tableSearch}
          resultCount={filteredRoles.length}
          totalCount={props.data.accessRoles.length}
          onSearchChange={setTableSearch}
        >
          <span className="toolbar-chip">
            <ShieldCheck aria-hidden="true" size={14} />
            Permission set
          </span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Раздел недоступен." />
        {props.sectionState.canRead && !props.sectionState.error ? (
          <div className="table-wrap">
            <table className="data-table" aria-label="Роли доступа">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Права</th>
                  <th>Назначено</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.length === 0 ? (
                  <TableEmpty
                    colSpan={4}
                    label={
                      props.data.accessRoles.length === 0
                        ? "Ролей доступа пока нет."
                        : "По фильтру ничего не найдено."
                    }
                  />
                ) : (
                  filteredRoles.map((role) => {
                    const assignedUsers = props.data.users.filter(
                      (user) => user.accessProfileId === role.id
                    ).length;

                    return (
                      <tr key={role.id}>
                        <td>
                          <span className="entity-name-cell">
                            <span className="row-avatar">
                              {role.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span>
                              <strong>{role.name}</strong>
                              <small>{role.id}</small>
                            </span>
                          </span>
                        </td>
                        <td>
                          <PermissionList permissions={role.permissions} />
                        </td>
                        <td>{assignedUsers}</td>
                        <td>
                          {canManageRoles ? (
                            <span className="table-actions">
                              <button
                                className="secondary-button"
                                disabled={role.id === props.data.me.accessProfileId}
                                title={
                                  role.id === props.data.me.accessProfileId
                                    ? "Нельзя редактировать собственную роль доступа"
                                    : undefined
                                }
                                type="button"
                                onClick={() => setModal({ type: "edit", roleId: role.id })}
                              >
                                Редактировать
                              </button>
                              <button
                                className="danger-button"
                                disabled={assignedUsers > 0}
                                title={
                                  assignedUsers > 0
                                    ? "Нельзя удалить роль, пока она назначена пользователям"
                                    : undefined
                                }
                                type="button"
                                onClick={() => setModal({ type: "delete", roleId: role.id })}
                              >
                                Удалить
                              </button>
                            </span>
                          ) : (
                            <span className="muted">Только просмотр</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
      {isFormOpen ? (
        <Modal
          title={editingRole ? "Редактировать роль доступа" : "Создать роль доступа"}
          description="Роль определяет доступные действия пользователя в рабочем пространстве."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingRole?.id ?? "new-role"}
            noValidate
            onSubmit={submit}
          >
            <label htmlFor="role-form-name">
              Название роли
              <input
                id="role-form-name"
                name="name"
                aria-describedby={
                  fieldErrors.name ? getFieldErrorId("role-form", "name") : undefined
                }
                aria-invalid={Boolean(fieldErrors.name)}
                data-autofocus
                defaultValue={editingRole?.name ?? ""}
                required
              />
              <FieldError formId="role-form" field="name" errors={fieldErrors} />
            </label>
            <fieldset
              className="permission-grid"
              aria-describedby={
                fieldErrors.permissions
                  ? getFieldErrorId("role-form", "permissions")
                  : "role-form-permissions-help"
              }
              aria-invalid={Boolean(fieldErrors.permissions)}
            >
              <legend>Права роли</legend>
              <p id="role-form-permissions-help" className="field-help">
                Минимальный профиль должен иметь хотя бы одно право.
              </p>
              {rolePermissionOptions.map((permission) => (
                <label key={permission.value} className="checkbox-row">
                  <input
                    defaultChecked={
                      editingRole
                        ? editingRole.permissions.includes(permission.value)
                        : ["tenant.users.read", "profile.read", "profile.update"].includes(
                            permission.value
                          )
                    }
                    name="permissions"
                    type="checkbox"
                    value={permission.value}
                  />
                  {permission.label}
                </label>
              ))}
              <FieldError formId="role-form" field="permissions" errors={fieldErrors} />
            </fieldset>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving
                  ? "Сохраняем..."
                  : editingRole
                    ? "Сохранить роль доступа"
                    : "Создать роль доступа"}
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
      {modal?.type === "delete" ? (
        <ConfirmDialog
          title="Удалить роль доступа"
          body={`Роль "${deletingRole?.name ?? "выбранная роль"}" будет удалена. Это возможно только если она не назначена пользователям.`}
          confirmLabel="Удалить роль доступа"
          pendingLabel="Удаляем роль..."
          isPending={isSaving}
          onCancel={closeModal}
          onConfirm={() => removeRole(deletingRole ?? null)}
          error={formError}
        />
      ) : null}
    </>
  );
}
