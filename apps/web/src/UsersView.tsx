import {
  BriefcaseBusiness,
  Eye,
  EyeOff,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { type WorkspaceUser } from "./api";
import { type WorkspaceData } from "./workspaceData";
import { useUserMutations } from "./workspaceQueries";
import {
  type FormErrors,
  getFieldErrorId,
  hasFormErrors,
  validateUserForm
} from "./workspaceForms";
import { filterUsersForTable } from "./workspaceTables";
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
  SectionFeedback,
  StatusPill,
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";

export function UsersView(props: {
  data: WorkspaceData;
  openCreateRequested: boolean;
  onQuickCreateConsumed: () => void;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageUsers = hasPermission(props.data.permissions, "tenant.users.manage");
  const userMutations = useUserMutations();
  const [modal, setModal] = useState<
    | { type: "create" }
    | { type: "edit"; userId: string }
    | { type: "delete"; userId: string }
    | null
  >(null);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const editingUser =
    modal?.type === "edit"
      ? props.data.users.find((user) => user.id === modal.userId)
      : null;
  const deletingUser =
    modal?.type === "delete"
      ? props.data.users.find((user) => user.id === modal.userId)
      : null;
  const mode = editingUser ? "edit" : "create";
  const isEditingSelf = editingUser?.id === props.data.me.id;
  const isFormOpen = modal?.type === "create" || modal?.type === "edit";
  const isSaving =
    userMutations.createUser.isPending ||
    userMutations.updateUser.isPending ||
    userMutations.deleteUser.isPending;
  const filteredUsers = useMemo(
    () => filterUsersForTable(props.data.users, props.data.accessRoles, tableSearch),
    [props.data.accessRoles, props.data.users, tableSearch]
  );
  const activeUsers = props.data.users.filter((user) => user.status === "active").length;
  const inactiveUsers = props.data.users.length - activeUsers;

  useEffect(() => {
    if (props.openCreateRequested) {
      if (canManageUsers) {
        setFormError("");
        setModal({ type: "create" });
      }
      props.onQuickCreateConsumed();
    }
  }, [canManageUsers, props.openCreateRequested, props.onQuickCreateConsumed]);

  function closeModal() {
    if (isSaving) return;
    setModal(null);
    setFormError("");
    setFieldErrors({});
    setIsPasswordVisible(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setFormError("");
    setFieldErrors({});

    try {
      const input = {
        email: String(form.get("email")),
        name: String(form.get("name")),
        accessProfileId: String(form.get("accessProfileId")),
        positionId: String(form.get("positionId")) || null,
        status: String(form.get("status") ?? "active")
      };
      const validationErrors = validateUserForm(
        {
          ...input,
          password: String(form.get("password") ?? "")
        },
        mode
      );

      if (hasFormErrors(validationErrors)) {
        setFieldErrors(validationErrors);
        return;
      }

      if (editingUser) {
        await userMutations.updateUser.mutateAsync({
          userId: editingUser.id,
          input
        });
      } else {
        await userMutations.createUser.mutateAsync({
          id: `user-${Date.now().toString(36)}`,
          ...input,
          password: String(form.get("password"))
        });
      }

      formElement.reset();
      setModal(null);
      setFieldErrors({});
      setIsPasswordVisible(false);
      props.onChanged("Пользователи обновлены");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  async function removeUser(user: WorkspaceUser | null) {
    if (!user) return;
    setFormError("");
    try {
      await userMutations.deleteUser.mutateAsync(user.id);
      setModal(null);
      props.onChanged("Пользователи обновлены");
    } catch (deleteError) {
      setFormError(getErrorMessage(deleteError));
    }
  }

  return (
    <>
      <Panel
        title="Пользователи"
        subtitle="Учетные записи, роли доступа, должности и статус работы."
        actions={
          canManageUsers ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setModal({ type: "create" })}
            >
              Создать пользователя
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.users.manage" />
          )
        }
      >
        <div className="surface-summary-grid">
          <SummaryCard label="Всего пользователей" value={props.data.users.length} />
          <SummaryCard label="Активные" value={activeUsers} tone="success" />
          <SummaryCard label="Отключенные" value={inactiveUsers} tone="muted" />
        </div>
        <CrudToolbar
          searchLabel="Поиск пользователей"
          searchPlaceholder="Имя, email, роль, должность..."
          searchValue={tableSearch}
          resultCount={filteredUsers.length}
          totalCount={props.data.users.length}
          onSearchChange={setTableSearch}
        >
          <span className="toolbar-chip">
            <ShieldCheck aria-hidden="true" size={14} />
            RBAC
          </span>
          <span className="toolbar-chip">
            <BriefcaseBusiness aria-hidden="true" size={14} />
            Должности
          </span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Раздел недоступен." />
        {props.sectionState.canRead && !props.sectionState.error ? (
          <div className="table-wrap">
            <table className="data-table" aria-label="Пользователи">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Роль</th>
                  <th>Должность</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <TableEmpty
                    colSpan={5}
                    label={
                      props.data.users.length === 0
                        ? "Пользователей пока нет."
                        : "По фильтру ничего не найдено."
                    }
                  />
                ) : (
                  filteredUsers.map((user) => {
                    const role = props.data.accessRoles.find(
                      (item) => item.id === user.accessProfileId
                    );

                    return (
                      <tr key={user.id}>
                        <td>
                          <span className="person-cell">
                            <span className="row-avatar">
                              {user.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span>
                              <strong>{user.name}</strong>
                              <small>{user.email}</small>
                            </span>
                          </span>
                        </td>
                        <td>{role?.name ?? user.accessProfileId}</td>
                        <td>{user.positionName ?? "Без должности"}</td>
                        <td>
                          <StatusPill
                            tone={user.status === "active" ? "success" : "muted"}
                            label={user.status === "active" ? "Активен" : "Отключен"}
                          />
                        </td>
                        <td>
                          {canManageUsers ? (
                            <span className="table-actions">
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => setModal({ type: "edit", userId: user.id })}
                              >
                                Редактировать
                              </button>
                              <button
                                className="danger-button"
                                disabled={user.id === props.data.me.id}
                                title={
                                  user.id === props.data.me.id
                                    ? "Нельзя удалить собственную учетную запись"
                                    : undefined
                                }
                                type="button"
                                onClick={() => setModal({ type: "delete", userId: user.id })}
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
          title={mode === "edit" ? "Редактировать пользователя" : "Создать пользователя"}
          description="Заполните обязательные поля. Изменения будут проверены правами и записаны в аудит."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingUser?.id ?? "new-user"}
            noValidate
            onSubmit={submit}
          >
            <label htmlFor="user-form-name">
              Имя
              <input
                id="user-form-name"
                name="name"
                aria-describedby={
                  fieldErrors.name ? getFieldErrorId("user-form", "name") : undefined
                }
                aria-invalid={Boolean(fieldErrors.name)}
                data-autofocus
                defaultValue={editingUser?.name ?? ""}
                required
              />
              <FieldError formId="user-form" field="name" errors={fieldErrors} />
            </label>
            <label htmlFor="user-form-email">
              Email
              <input
                id="user-form-email"
                name="email"
                aria-describedby={
                  fieldErrors.email ? getFieldErrorId("user-form", "email") : undefined
                }
                aria-invalid={Boolean(fieldErrors.email)}
                defaultValue={editingUser?.email ?? ""}
                required
                type="email"
              />
              <FieldError formId="user-form" field="email" errors={fieldErrors} />
            </label>
            {mode === "create" ? (
              <label htmlFor="user-form-password">
                Пароль
                <span className="password-field">
                  <input
                    id="user-form-password"
                    name="password"
                    aria-label="Пароль"
                    aria-describedby={
                      fieldErrors.password
                        ? getFieldErrorId("user-form", "password")
                        : "user-form-password-help"
                    }
                    aria-invalid={Boolean(fieldErrors.password)}
                    placeholder="минимум 8 символов"
                    required
                    type={isPasswordVisible ? "text" : "password"}
                  />
                  <button
                    aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
                    className="password-toggle"
                    type="button"
                    onClick={() => setIsPasswordVisible((value) => !value)}
                  >
                    {isPasswordVisible ? (
                      <EyeOff aria-hidden="true" size={16} />
                    ) : (
                      <Eye aria-hidden="true" size={16} />
                    )}
                  </button>
                </span>
                <small id="user-form-password-help" className="field-help">
                  Минимум 8 символов.
                </small>
                <FieldError formId="user-form" field="password" errors={fieldErrors} />
              </label>
            ) : null}
            <label htmlFor="user-form-accessProfileId">
              Роль доступа
              {isEditingSelf && editingUser ? (
                <>
                  <input name="accessProfileId" type="hidden" value={editingUser.accessProfileId} />
                  <input
                    id="user-form-accessProfileId"
                    readOnly
                    value={
                      props.data.accessRoles.find(
                        (role) => role.id === editingUser.accessProfileId
                      )?.name ?? editingUser.accessProfileId
                    }
                  />
                </>
              ) : (
                <select
                  id="user-form-accessProfileId"
                  name="accessProfileId"
                  aria-describedby={
                    fieldErrors.accessProfileId
                      ? getFieldErrorId("user-form", "accessProfileId")
                      : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.accessProfileId)}
                  defaultValue={editingUser?.accessProfileId}
                  required
                >
                  {props.data.accessRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              )}
              <FieldError formId="user-form" field="accessProfileId" errors={fieldErrors} />
            </label>
            <label htmlFor="user-form-positionId">
              Должность
              <select
                id="user-form-positionId"
                name="positionId"
                defaultValue={editingUser?.positionId ?? ""}
              >
                <option value="">Без должности</option>
                {props.data.positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="user-form-status">
              Статус
              {isEditingSelf ? (
                <>
                  <input name="status" type="hidden" value="active" />
                  <input id="user-form-status" readOnly value="Активен" />
                </>
              ) : (
                <select
                  id="user-form-status"
                  name="status"
                  aria-describedby={
                    fieldErrors.status ? getFieldErrorId("user-form", "status") : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.status)}
                  defaultValue={editingUser?.status ?? "active"}
                >
                  <option value="active">Активен</option>
                  <option value="inactive">Отключен</option>
                </select>
              )}
              <FieldError formId="user-form" field="status" errors={fieldErrors} />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving
                  ? "Сохраняем..."
                  : mode === "edit"
                    ? "Сохранить пользователя"
                    : "Создать пользователя"}
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
          title="Удалить пользователя"
          body={`Пользователь "${deletingUser?.name ?? "выбранный пользователь"}" будет удален из рабочего пространства.`}
          confirmLabel="Удалить пользователя"
          pendingLabel="Удаляем пользователя..."
          isPending={isSaving}
          onCancel={closeModal}
          onConfirm={() => removeUser(deletingUser ?? null)}
          error={formError}
        />
      ) : null}
    </>
  );
}
