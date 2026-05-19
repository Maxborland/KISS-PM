import { Users } from "lucide-react";
import { useMemo, useState } from "react";

import { type Position } from "./api";
import { type WorkspaceData } from "./workspaceData";
import { usePositionMutations } from "./workspaceQueries";
import {
  type FormErrors,
  getFieldErrorId,
  hasFormErrors,
  validatePositionForm
} from "./workspaceForms";
import { filterPositionsForTable } from "./workspaceTables";
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
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";

export function PositionsView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManagePositions = hasPermission(
    props.data.permissions,
    "tenant.positions.manage"
  );
  const positionMutations = usePositionMutations();
  const [modal, setModal] = useState<
    | { type: "create" }
    | { type: "edit"; positionId: string }
    | { type: "delete"; positionId: string }
    | null
  >(null);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [tableSearch, setTableSearch] = useState("");
  const editingPosition =
    modal?.type === "edit"
      ? props.data.positions.find((position) => position.id === modal.positionId)
      : null;
  const deletingPosition =
    modal?.type === "delete"
      ? props.data.positions.find((position) => position.id === modal.positionId)
      : null;
  const isFormOpen = modal?.type === "create" || modal?.type === "edit";
  const isSaving =
    positionMutations.createPosition.isPending ||
    positionMutations.updatePosition.isPending ||
    positionMutations.deletePosition.isPending;
  const filteredPositions = useMemo(
    () => filterPositionsForTable(props.data.positions, tableSearch),
    [props.data.positions, tableSearch]
  );
  const assignedPositions = props.data.positions.filter((position) =>
    props.data.users.some((user) => user.positionId === position.id)
  ).length;
  const usersWithoutPosition = props.data.users.filter((user) => !user.positionId).length;

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
    const input = {
      name: String(form.get("name")),
      description: String(form.get("description"))
    };
    setFormError("");
    setFieldErrors({});

    try {
      const validationErrors = validatePositionForm(input);

      if (hasFormErrors(validationErrors)) {
        setFieldErrors(validationErrors);
        return;
      }

      if (editingPosition) {
        await positionMutations.updatePosition.mutateAsync({
          positionId: editingPosition.id,
          input
        });
      } else {
        await positionMutations.createPosition.mutateAsync({
          id: `position-${Date.now().toString(36)}`,
          ...input
        });
      }

      formElement.reset();
      setModal(null);
      setFieldErrors({});
      props.onChanged("Должности обновлены");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  async function removePosition(position: Position | null) {
    if (!position) return;
    setFormError("");
    try {
      await positionMutations.deletePosition.mutateAsync(position.id);
      setModal(null);
      props.onChanged("Должности обновлены");
    } catch (deleteError) {
      setFormError(getErrorMessage(deleteError));
    }
  }

  return (
    <>
      <Panel
        title="Должности"
        subtitle="Организационная роль человека в текущем рабочем пространстве."
        actions={
          canManagePositions ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setModal({ type: "create" })}
            >
              Создать должность
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.positions.manage" />
          )
        }
      >
        <div className="surface-summary-grid">
          <SummaryCard label="Всего должностей" value={props.data.positions.length} />
          <SummaryCard label="Используются" value={assignedPositions} tone="success" />
          <SummaryCard label="Без должности" value={usersWithoutPosition} tone="muted" />
        </div>
        <CrudToolbar
          searchLabel="Поиск должностей"
          searchPlaceholder="Название или описание..."
          searchValue={tableSearch}
          resultCount={filteredPositions.length}
          totalCount={props.data.positions.length}
          onSearchChange={setTableSearch}
        >
          <span className="toolbar-chip">
            <Users aria-hidden="true" size={14} />
            Назначения
          </span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Раздел недоступен." />
        {props.sectionState.canRead && !props.sectionState.error ? (
          <div className="table-wrap">
            <table className="data-table" aria-label="Должности">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Назначено пользователей</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.length === 0 ? (
                  <TableEmpty
                    colSpan={4}
                    label={
                      props.data.positions.length === 0
                        ? "Должностей пока нет."
                        : "По фильтру ничего не найдено."
                    }
                  />
                ) : (
                  filteredPositions.map((position) => {
                    const assignedUsers = props.data.users.filter(
                      (user) => user.positionId === position.id
                    ).length;

                    return (
                      <tr key={position.id}>
                        <td>
                          <span className="entity-name-cell">
                            <span className="row-avatar">
                              {position.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span>
                              <strong>{position.name}</strong>
                              <small>{position.id}</small>
                            </span>
                          </span>
                        </td>
                        <td>{position.description ?? "Описание не задано"}</td>
                        <td>{assignedUsers}</td>
                        <td>
                          {canManagePositions ? (
                            <span className="table-actions">
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() =>
                                  setModal({ type: "edit", positionId: position.id })
                                }
                              >
                                Редактировать
                              </button>
                              <button
                                className="danger-button"
                                disabled={assignedUsers > 0}
                                title={
                                  assignedUsers > 0
                                    ? "Нельзя удалить должность, пока она назначена пользователям"
                                    : undefined
                                }
                                type="button"
                                onClick={() =>
                                  setModal({ type: "delete", positionId: position.id })
                                }
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
          title={editingPosition ? "Редактировать должность" : "Создать должность"}
          description="Должность используется в карточках пользователей и будущей ресурсной модели."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingPosition?.id ?? "new-position"}
            noValidate
            onSubmit={submit}
          >
            <label htmlFor="position-form-name">
              Название должности
              <input
                id="position-form-name"
                name="name"
                aria-describedby={
                  fieldErrors.name ? getFieldErrorId("position-form", "name") : undefined
                }
                aria-invalid={Boolean(fieldErrors.name)}
                data-autofocus
                defaultValue={editingPosition?.name ?? ""}
                required
              />
              <FieldError formId="position-form" field="name" errors={fieldErrors} />
            </label>
            <label htmlFor="position-form-description">
              Описание
              <input
                id="position-form-description"
                name="description"
                defaultValue={editingPosition?.description ?? ""}
              />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving
                  ? "Сохраняем..."
                  : editingPosition
                    ? "Сохранить должность"
                    : "Создать должность"}
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
          title="Удалить должность"
          body={`Должность "${deletingPosition?.name ?? "выбранная должность"}" будет удалена. Это возможно только если она не назначена пользователям.`}
          confirmLabel="Удалить должность"
          pendingLabel="Удаляем должность..."
          isPending={isSaving}
          onCancel={closeModal}
          onConfirm={() => removePosition(deletingPosition ?? null)}
          error={formError}
        />
      ) : null}
    </>
  );
}
