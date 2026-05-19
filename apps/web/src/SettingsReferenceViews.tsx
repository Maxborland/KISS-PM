import { PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { DealStage, ProjectType } from "./api";
import {
  canRenderSectionTable,
  EntityActions,
  EntityNameCell,
  EntityStatusField,
  EntitySummary,
  ModalActions,
  renderCrmStatus,
  useEntityFormState
} from "./EntityCrudShared";
import type { WorkspaceData } from "./workspaceData";
import { makeClientGeneratedId } from "./workspaceIds";
import { useCrmMutations } from "./workspaceQueries";
import {
  type FormErrors,
  hasFormErrors,
  validateDealStageForm,
  validateProjectTypeForm
} from "./workspaceForms";
import {
  filterDealStagesForTable,
  filterProjectTypesForTable
} from "./workspaceTables";
import { formatDate } from "./workspaceViewHelpers";
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
  TableEmpty
} from "./components/workspace-ui";

export function ProjectTypesView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageProjectTypes = hasPermission(
    props.data.permissions,
    "tenant.project_types.manage"
  );
  const crmMutations = useCrmMutations();
  const [search, setSearch] = useState("");
  const [editingProjectTypeId, setEditingProjectTypeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formState = useEntityFormState();
  const editingProjectType = editingProjectTypeId
    ? props.data.projectTypes.find((projectType) => projectType.id === editingProjectTypeId) ?? null
    : null;
  const isSaving =
    crmMutations.createProjectType.isPending || crmMutations.updateProjectType.isPending;
  const filteredProjectTypes = useMemo(
    () => filterProjectTypesForTable(props.data.projectTypes, search),
    [props.data.projectTypes, search]
  );
  const activeProjectTypes = props.data.projectTypes.filter(
    (projectType) => projectType.status === "active"
  ).length;

  async function submitProjectType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "");
    const status = String(form.get("status") ?? "active");
    const errors = validateProjectTypeForm({ name, description, status });
    formState.setFieldErrors(errors);
    formState.setFormError("");
    if (hasFormErrors(errors)) return;

    try {
      if (editingProjectType) {
        await crmMutations.updateProjectType.mutateAsync({
          projectTypeId: editingProjectType.id,
          input: {
            name: name.trim(),
            description: description.trim() || null,
            status: status as ProjectType["status"]
          }
        });
      } else {
        await crmMutations.createProjectType.mutateAsync({
          id: makeClientGeneratedId("project-type", name),
          name: name.trim(),
          description: description.trim() || null
        });
      }
      setIsModalOpen(false);
      setEditingProjectTypeId(null);
      formState.reset();
      props.onChanged(editingProjectType ? "Тип проекта обновлен" : "Тип проекта создан");
    } catch (error) {
      formState.setFormError(getErrorMessage(error));
    }
  }

  function openCreateProjectType() {
    setEditingProjectTypeId(null);
    formState.reset();
    setIsModalOpen(true);
  }

  function openEditProjectType(projectTypeId: string) {
    setEditingProjectTypeId(projectTypeId);
    formState.reset();
    setIsModalOpen(true);
  }

  return (
    <>
      <Panel
        title="Типы проектов"
        subtitle="Tenant-настройка, которую сделки используют для классификации будущего проекта."
        actions={
          canManageProjectTypes ? (
            <button
              className="primary-button"
              type="button"
              onClick={openCreateProjectType}
            >
              <PlusCircle aria-hidden="true" size={15} />
              Создать тип
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.project_types.manage" />
          )
        }
      >
        <EntitySummary
          total={props.data.projectTypes.length}
          active={activeProjectTypes}
          archived={props.data.projectTypes.length - activeProjectTypes}
        />
        <CrudToolbar
          searchLabel="Поиск типов проектов"
          searchPlaceholder="Название, описание, статус..."
          searchValue={search}
          resultCount={filteredProjectTypes.length}
          totalCount={props.data.projectTypes.length}
          onSearchChange={setSearch}
        >
          <span className="toolbar-chip">Настройка workspace</span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Типы проектов недоступны." />
        {canRenderSectionTable(props.sectionState) ? (
          <ProjectTypesTable
            canManage={canManageProjectTypes}
            projectTypes={filteredProjectTypes}
            totalProjectTypes={props.data.projectTypes.length}
            onEdit={openEditProjectType}
          />
        ) : null}
      </Panel>
      {isModalOpen ? (
        <ProjectTypeModal
          projectType={editingProjectType}
          error={formState.formError}
          fieldErrors={formState.fieldErrors}
          isSaving={isSaving}
          onClose={() => {
            if (isSaving) return;
            setIsModalOpen(false);
            setEditingProjectTypeId(null);
            formState.reset();
          }}
          onSubmit={submitProjectType}
        />
      ) : null}
    </>
  );
}

export function DealStagesView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageDealStages = hasPermission(
    props.data.permissions,
    "tenant.deal_stages.manage"
  );
  const crmMutations = useCrmMutations();
  const [search, setSearch] = useState("");
  const [editingDealStageId, setEditingDealStageId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formState = useEntityFormState();
  const editingDealStage = editingDealStageId
    ? props.data.dealStages.find((stage) => stage.id === editingDealStageId) ?? null
    : null;
  const isSaving =
    crmMutations.createDealStage.isPending || crmMutations.updateDealStage.isPending;
  const sortedDealStages = useMemo(
    () =>
      [...props.data.dealStages].sort(
        (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
      ),
    [props.data.dealStages]
  );
  const filteredDealStages = useMemo(
    () => filterDealStagesForTable(sortedDealStages, search),
    [search, sortedDealStages]
  );
  const activeDealStages = props.data.dealStages.filter((stage) => stage.status === "active").length;

  async function submitDealStage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const sortOrder = String(form.get("sortOrder") ?? "");
    const status = String(form.get("status") ?? "active");
    const errors = validateDealStageForm({ name, sortOrder, status });
    formState.setFieldErrors(errors);
    formState.setFormError("");
    if (hasFormErrors(errors)) return;

    try {
      if (editingDealStage) {
        await crmMutations.updateDealStage.mutateAsync({
          stageId: editingDealStage.id,
          input: {
            name: name.trim(),
            sortOrder: Number(sortOrder),
            status: status as DealStage["status"]
          }
        });
      } else {
        await crmMutations.createDealStage.mutateAsync({
          id: makeClientGeneratedId("deal-stage", name),
          name: name.trim(),
          sortOrder: Number(sortOrder)
        });
      }
      setIsModalOpen(false);
      setEditingDealStageId(null);
      formState.reset();
      props.onChanged(editingDealStage ? "Этап сделки обновлен" : "Этап сделки создан");
    } catch (error) {
      formState.setFormError(getErrorMessage(error));
    }
  }

  function openCreateDealStage() {
    setEditingDealStageId(null);
    formState.reset();
    setIsModalOpen(true);
  }

  function openEditDealStage(stageId: string) {
    setEditingDealStageId(stageId);
    formState.reset();
    setIsModalOpen(true);
  }

  return (
    <>
      <Panel
        title="Этапы сделок"
        subtitle="Tenant-настройка воронки. Активные этапы формируют канбан на странице сделок."
        actions={
          canManageDealStages ? (
            <button
              className="primary-button"
              type="button"
              onClick={openCreateDealStage}
            >
              <PlusCircle aria-hidden="true" size={15} />
              Создать этап
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.deal_stages.manage" />
          )
        }
      >
        <EntitySummary
          total={props.data.dealStages.length}
          active={activeDealStages}
          archived={props.data.dealStages.length - activeDealStages}
        />
        <CrudToolbar
          searchLabel="Поиск этапов сделок"
          searchPlaceholder="Название, порядок, статус..."
          searchValue={search}
          resultCount={filteredDealStages.length}
          totalCount={props.data.dealStages.length}
          onSearchChange={setSearch}
        >
          <span className="toolbar-chip">Канбан строится по sortOrder</span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Этапы сделок недоступны." />
        {canRenderSectionTable(props.sectionState) ? (
          <DealStagesTable
            canManage={canManageDealStages}
            dealStages={filteredDealStages}
            totalDealStages={props.data.dealStages.length}
            onEdit={openEditDealStage}
          />
        ) : null}
      </Panel>
      {isModalOpen ? (
        <DealStageModal
          defaultSortOrder={(sortedDealStages.at(-1)?.sortOrder ?? 0) + 10}
          dealStage={editingDealStage}
          error={formState.formError}
          fieldErrors={formState.fieldErrors}
          isSaving={isSaving}
          onClose={() => {
            if (isSaving) return;
            setIsModalOpen(false);
            setEditingDealStageId(null);
            formState.reset();
          }}
          onSubmit={submitDealStage}
        />
      ) : null}
    </>
  );
}

function ProjectTypesTable(props: {
  canManage: boolean;
  projectTypes: ProjectType[];
  totalProjectTypes: number;
  onEdit: (projectTypeId: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Типы проектов">
        <thead>
          <tr>
            <th>Тип</th>
            <th>Описание</th>
            <th>Статус</th>
            <th>Обновлено</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {props.projectTypes.length === 0 ? (
            <TableEmpty
              colSpan={5}
              label={
                props.totalProjectTypes === 0
                  ? "Типов проектов пока нет."
                  : "По фильтру ничего не найдено."
              }
            />
          ) : (
            props.projectTypes.map((projectType) => (
              <tr key={projectType.id}>
                <td>
                  <EntityNameCell avatar="Т" primary={projectType.name} secondary={projectType.id} />
                </td>
                <td>{projectType.description || "Описание не задано"}</td>
                <td>{renderCrmStatus(projectType.status)}</td>
                <td>{formatDate(projectType.updatedAt)}</td>
                <td>
                  <EntityActions
                    canManage={props.canManage}
                    entityId={projectType.id}
                    onEdit={props.onEdit}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DealStagesTable(props: {
  canManage: boolean;
  dealStages: DealStage[];
  totalDealStages: number;
  onEdit: (stageId: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Этапы сделок">
        <thead>
          <tr>
            <th>Этап</th>
            <th>Порядок</th>
            <th>Статус</th>
            <th>Обновлено</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {props.dealStages.length === 0 ? (
            <TableEmpty
              colSpan={5}
              label={
                props.totalDealStages === 0
                  ? "Этапов сделок пока нет."
                  : "По фильтру ничего не найдено."
              }
            />
          ) : (
            props.dealStages.map((stage) => (
              <tr key={stage.id}>
                <td>
                  <EntityNameCell avatar="Э" primary={stage.name} secondary={stage.id} />
                </td>
                <td>{stage.sortOrder}</td>
                <td>{renderCrmStatus(stage.status)}</td>
                <td>{formatDate(stage.updatedAt)}</td>
                <td>
                  <EntityActions
                    canManage={props.canManage}
                    entityId={stage.id}
                    onEdit={props.onEdit}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTypeModal(props: {
  projectType: ProjectType | null;
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title={props.projectType ? "Редактировать тип проекта" : "Создать тип проекта"}
      description="Тип проекта будет выбран в карточке сделки."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={props.onSubmit}>
        <label htmlFor="project-type-name">
          Название типа
          <input
            id="project-type-name"
            name="name"
            data-autofocus
            defaultValue={props.projectType?.name ?? ""}
          />
          <FieldError formId="project-type" field="name" errors={props.fieldErrors} />
        </label>
        <label htmlFor="project-type-description">
          Описание
          <textarea
            id="project-type-description"
            name="description"
            rows={3}
            defaultValue={props.projectType?.description ?? ""}
          />
        </label>
        <EntityStatusField
          defaultValue={props.projectType?.status ?? "active"}
          formId="project-type"
          fieldErrors={props.fieldErrors}
        />
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel={props.projectType ? "Сохранить тип проекта" : "Создать тип проекта"}
          savingLabel="Сохраняем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
  );
}

function DealStageModal(props: {
  defaultSortOrder: number;
  dealStage: DealStage | null;
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title={props.dealStage ? "Редактировать этап сделки" : "Создать этап сделки"}
      description="Активные этапы формируют канбан."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={props.onSubmit}>
        <label htmlFor="deal-stage-name">
          Название этапа
          <input
            id="deal-stage-name"
            name="name"
            data-autofocus
            defaultValue={props.dealStage?.name ?? ""}
          />
          <FieldError formId="deal-stage" field="name" errors={props.fieldErrors} />
        </label>
        <label htmlFor="deal-stage-sort-order">
          Порядок
          <input
            id="deal-stage-sort-order"
            name="sortOrder"
            type="number"
            min="1"
            defaultValue={props.dealStage?.sortOrder ?? props.defaultSortOrder}
          />
          <FieldError formId="deal-stage" field="sortOrder" errors={props.fieldErrors} />
        </label>
        <EntityStatusField
          defaultValue={props.dealStage?.status ?? "active"}
          formId="deal-stage"
          fieldErrors={props.fieldErrors}
        />
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel={props.dealStage ? "Сохранить этап" : "Создать этап"}
          savingLabel="Сохраняем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
  );
}
