import { PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { Client, Contact, DealStage, ProjectType } from "./api";
import type { WorkspaceData } from "./workspaceData";
import { makeClientGeneratedId } from "./workspaceIds";
import { useCrmMutations } from "./workspaceQueries";
import {
  type FormErrors,
  getFieldErrorId,
  hasFormErrors,
  validateClientForm,
  validateContactForm,
  validateDealStageForm,
  validateProjectTypeForm
} from "./workspaceForms";
import {
  filterClientsForTable,
  filterContactsForTable,
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
  StatusPill,
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";

type CrmModalKind = "client" | "contact" | "projectType" | "dealStage";

export function ClientsView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageClients = hasPermission(props.data.permissions, "tenant.clients.manage");
  const crmMutations = useCrmMutations();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formState = useEntityFormState();
  const filteredClients = useMemo(
    () => filterClientsForTable(props.data.clients, search),
    [props.data.clients, search]
  );
  const activeClients = props.data.clients.filter((client) => client.status === "active").length;

  async function submitClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "");
    const errors = validateClientForm({ name, description });
    formState.setFieldErrors(errors);
    formState.setFormError("");
    if (hasFormErrors(errors)) return;

    try {
      await crmMutations.createClient.mutateAsync({
        id: makeClientGeneratedId("client", name),
        name: name.trim(),
        description: description.trim() || null
      });
      setIsModalOpen(false);
      formState.reset();
      props.onChanged("Клиент создан");
    } catch (error) {
      formState.setFormError(getErrorMessage(error));
    }
  }

  return (
    <>
      <Panel
        title="Клиенты"
        subtitle="Отдельный CRM-список организаций, которые используются в сделках и будущих проектах."
        actions={
          canManageClients ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsModalOpen(true)}
            >
              <PlusCircle aria-hidden="true" size={15} />
              Создать клиента
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.clients.manage" />
          )
        }
      >
        <EntitySummary
          total={props.data.clients.length}
          active={activeClients}
          archived={props.data.clients.length - activeClients}
        />
        <CrudToolbar
          searchLabel="Поиск клиентов"
          searchPlaceholder="Название, описание, статус..."
          searchValue={search}
          resultCount={filteredClients.length}
          totalCount={props.data.clients.length}
          onSearchChange={setSearch}
        >
          <span className="toolbar-chip">CRM source of truth</span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Клиенты недоступны." />
        {canRenderSectionTable(props.sectionState) ? (
          <ClientsTable clients={filteredClients} totalClients={props.data.clients.length} />
        ) : null}
      </Panel>
      {isModalOpen ? (
        <ClientModal
          error={formState.formError}
          fieldErrors={formState.fieldErrors}
          isSaving={crmMutations.createClient.isPending}
          onClose={() => {
            if (crmMutations.createClient.isPending) return;
            setIsModalOpen(false);
            formState.reset();
          }}
          onSubmit={submitClient}
        />
      ) : null}
    </>
  );
}

export function ContactsView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageContacts = hasPermission(props.data.permissions, "tenant.contacts.manage");
  const crmMutations = useCrmMutations();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formState = useEntityFormState();
  const filteredContacts = useMemo(
    () => filterContactsForTable(props.data.contacts, props.data.clients, search),
    [props.data.clients, props.data.contacts, search]
  );
  const activeContacts = props.data.contacts.filter((contact) => contact.status === "active").length;

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const clientId = String(form.get("clientId") ?? "");
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const errors = validateContactForm({ clientId, name, email });
    formState.setFieldErrors(errors);
    formState.setFormError("");
    if (hasFormErrors(errors)) return;

    try {
      await crmMutations.createContact.mutateAsync({
        id: makeClientGeneratedId("contact", name),
        clientId,
        name: name.trim(),
        email: email.trim() || null,
        phone: String(form.get("phone") ?? "").trim() || null,
        telegram: String(form.get("telegram") ?? "").trim() || null,
        role: String(form.get("role") ?? "").trim() || null
      });
      setIsModalOpen(false);
      formState.reset();
      props.onChanged("Контакт создан");
    } catch (error) {
      formState.setFormError(getErrorMessage(error));
    }
  }

  return (
    <>
      <Panel
        title="Контакты"
        subtitle="Люди на стороне клиента. Контакт всегда привязан к клиенту и выбирается в сделке."
        actions={
          canManageContacts ? (
            <button
              className="primary-button"
              disabled={props.data.clients.length === 0}
              title={props.data.clients.length === 0 ? "Сначала создайте клиента" : undefined}
              type="button"
              onClick={() => setIsModalOpen(true)}
            >
              <PlusCircle aria-hidden="true" size={15} />
              Создать контакт
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.contacts.manage" />
          )
        }
      >
        <EntitySummary
          total={props.data.contacts.length}
          active={activeContacts}
          archived={props.data.contacts.length - activeContacts}
        />
        <CrudToolbar
          searchLabel="Поиск контактов"
          searchPlaceholder="Имя, клиент, email, роль..."
          searchValue={search}
          resultCount={filteredContacts.length}
          totalCount={props.data.contacts.length}
          onSearchChange={setSearch}
        >
          <span className="toolbar-chip">Привязка к клиенту обязательна</span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Контакты недоступны." />
        {canRenderSectionTable(props.sectionState) ? (
          <ContactsTable
            clients={props.data.clients}
            contacts={filteredContacts}
            totalContacts={props.data.contacts.length}
          />
        ) : null}
      </Panel>
      {isModalOpen ? (
        <ContactModal
          clients={props.data.clients}
          error={formState.formError}
          fieldErrors={formState.fieldErrors}
          isSaving={crmMutations.createContact.isPending}
          onClose={() => {
            if (crmMutations.createContact.isPending) return;
            setIsModalOpen(false);
            formState.reset();
          }}
          onSubmit={submitContact}
        />
      ) : null}
    </>
  );
}

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formState = useEntityFormState();
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
    const errors = validateProjectTypeForm({ name, description });
    formState.setFieldErrors(errors);
    formState.setFormError("");
    if (hasFormErrors(errors)) return;

    try {
      await crmMutations.createProjectType.mutateAsync({
        id: makeClientGeneratedId("project-type", name),
        name: name.trim(),
        description: description.trim() || null
      });
      setIsModalOpen(false);
      formState.reset();
      props.onChanged("Тип проекта создан");
    } catch (error) {
      formState.setFormError(getErrorMessage(error));
    }
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
              onClick={() => setIsModalOpen(true)}
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
            projectTypes={filteredProjectTypes}
            totalProjectTypes={props.data.projectTypes.length}
          />
        ) : null}
      </Panel>
      {isModalOpen ? (
        <ProjectTypeModal
          error={formState.formError}
          fieldErrors={formState.fieldErrors}
          isSaving={crmMutations.createProjectType.isPending}
          onClose={() => {
            if (crmMutations.createProjectType.isPending) return;
            setIsModalOpen(false);
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formState = useEntityFormState();
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
    const errors = validateDealStageForm({ name, sortOrder });
    formState.setFieldErrors(errors);
    formState.setFormError("");
    if (hasFormErrors(errors)) return;

    try {
      await crmMutations.createDealStage.mutateAsync({
        id: makeClientGeneratedId("deal-stage", name),
        name: name.trim(),
        sortOrder: Number(sortOrder)
      });
      setIsModalOpen(false);
      formState.reset();
      props.onChanged("Этап сделки создан");
    } catch (error) {
      formState.setFormError(getErrorMessage(error));
    }
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
              onClick={() => setIsModalOpen(true)}
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
            dealStages={filteredDealStages}
            totalDealStages={props.data.dealStages.length}
          />
        ) : null}
      </Panel>
      {isModalOpen ? (
        <DealStageModal
          defaultSortOrder={(sortedDealStages.at(-1)?.sortOrder ?? 0) + 10}
          error={formState.formError}
          fieldErrors={formState.fieldErrors}
          isSaving={crmMutations.createDealStage.isPending}
          onClose={() => {
            if (crmMutations.createDealStage.isPending) return;
            setIsModalOpen(false);
            formState.reset();
          }}
          onSubmit={submitDealStage}
        />
      ) : null}
    </>
  );
}

function EntitySummary(props: {
  total: number;
  active: number;
  archived: number;
}) {
  return (
    <div className="surface-summary-grid">
      <SummaryCard label="Всего" value={props.total} />
      <SummaryCard label="Активные" value={props.active} tone="success" />
      <SummaryCard label="Архив" value={props.archived} tone="muted" />
    </div>
  );
}

function canRenderSectionTable(sectionState: SectionState): boolean {
  return sectionState.canRead && !sectionState.error && !sectionState.isLoading;
}

function ClientsTable(props: { clients: Client[]; totalClients: number }) {
  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Клиенты">
        <thead>
          <tr>
            <th>Клиент</th>
            <th>Описание</th>
            <th>Статус</th>
            <th>Обновлено</th>
          </tr>
        </thead>
        <tbody>
          {props.clients.length === 0 ? (
            <TableEmpty
              colSpan={4}
              label={
                props.totalClients === 0 ? "Клиентов пока нет." : "По фильтру ничего не найдено."
              }
            />
          ) : (
            props.clients.map((client) => (
              <tr key={client.id}>
                <td>
                  <EntityNameCell avatar="К" primary={client.name} secondary={client.id} />
                </td>
                <td>{client.description || "Описание не задано"}</td>
                <td>{renderCrmStatus(client.status)}</td>
                <td>{formatDate(client.updatedAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ContactsTable(props: {
  clients: Client[];
  contacts: Contact[];
  totalContacts: number;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Контакты">
        <thead>
          <tr>
            <th>Контакт</th>
            <th>Клиент</th>
            <th>Связь</th>
            <th>Статус</th>
            <th>Обновлено</th>
          </tr>
        </thead>
        <tbody>
          {props.contacts.length === 0 ? (
            <TableEmpty
              colSpan={5}
              label={
                props.totalContacts === 0
                  ? "Контактов пока нет."
                  : "По фильтру ничего не найдено."
              }
            />
          ) : (
            props.contacts.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <EntityNameCell
                    avatar="К"
                    primary={contact.name}
                    secondary={contact.email ?? contact.telegram ?? contact.phone ?? contact.id}
                  />
                </td>
                <td>{getClientName(props.clients, contact.clientId)}</td>
                <td>{contact.role || "Роль не задана"}</td>
                <td>{renderCrmStatus(contact.status)}</td>
                <td>{formatDate(contact.updatedAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTypesTable(props: {
  projectTypes: ProjectType[];
  totalProjectTypes: number;
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
          </tr>
        </thead>
        <tbody>
          {props.projectTypes.length === 0 ? (
            <TableEmpty
              colSpan={4}
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DealStagesTable(props: {
  dealStages: DealStage[];
  totalDealStages: number;
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
          </tr>
        </thead>
        <tbody>
          {props.dealStages.length === 0 ? (
            <TableEmpty
              colSpan={4}
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function EntityNameCell(props: {
  avatar: string;
  primary: string;
  secondary: string;
}) {
  return (
    <span className="entity-name-cell">
      <span className="row-avatar">{props.avatar}</span>
      <span>
        <strong>{props.primary}</strong>
        <small>{props.secondary}</small>
      </span>
    </span>
  );
}

function ClientModal(props: {
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title="Создать клиента"
      description="Клиент станет source of truth для новых сделок."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={props.onSubmit}>
        <label htmlFor="client-name">
          Название клиента
          <input
            id="client-name"
            name="name"
            aria-describedby={props.fieldErrors.name ? getFieldErrorId("client", "name") : undefined}
            aria-invalid={Boolean(props.fieldErrors.name)}
            data-autofocus
          />
          <FieldError formId="client" field="name" errors={props.fieldErrors} />
        </label>
        <label htmlFor="client-description">
          Описание
          <textarea id="client-description" name="description" rows={3} />
        </label>
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel="Создать клиента"
          savingLabel="Создаем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
  );
}

function ContactModal(props: {
  clients: Client[];
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title="Создать контакт"
      description="Контакт обязательно привязан к клиенту."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={props.onSubmit}>
        <label htmlFor="contact-client">
          Клиент
          <select
            id="contact-client"
            name="clientId"
            aria-invalid={Boolean(props.fieldErrors.clientId)}
            data-autofocus
            defaultValue=""
          >
            <option value="">Выберите клиента</option>
            {props.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <FieldError formId="contact" field="clientId" errors={props.fieldErrors} />
        </label>
        <label htmlFor="contact-name">
          Имя контакта
          <input id="contact-name" name="name" aria-invalid={Boolean(props.fieldErrors.name)} />
          <FieldError formId="contact" field="name" errors={props.fieldErrors} />
        </label>
        <div className="grid-3">
          <label htmlFor="contact-email">
            Email
            <input
              id="contact-email"
              name="email"
              type="email"
              aria-invalid={Boolean(props.fieldErrors.email)}
            />
            <FieldError formId="contact" field="email" errors={props.fieldErrors} />
          </label>
          <label htmlFor="contact-phone">
            Телефон
            <input id="contact-phone" name="phone" />
          </label>
          <label htmlFor="contact-telegram">
            Telegram
            <input id="contact-telegram" name="telegram" />
          </label>
        </div>
        <label htmlFor="contact-role">
          Роль у клиента
          <input id="contact-role" name="role" />
        </label>
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel="Создать контакт"
          savingLabel="Создаем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
  );
}

function ProjectTypeModal(props: {
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title="Создать тип проекта"
      description="Тип проекта будет выбран в карточке сделки."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={props.onSubmit}>
        <label htmlFor="project-type-name">
          Название типа
          <input id="project-type-name" name="name" data-autofocus />
          <FieldError formId="project-type" field="name" errors={props.fieldErrors} />
        </label>
        <label htmlFor="project-type-description">
          Описание
          <textarea id="project-type-description" name="description" rows={3} />
        </label>
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel="Создать тип проекта"
          savingLabel="Создаем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
  );
}

function DealStageModal(props: {
  defaultSortOrder: number;
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title="Создать этап сделки"
      description="Активные этапы формируют канбан."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={props.onSubmit}>
        <label htmlFor="deal-stage-name">
          Название этапа
          <input id="deal-stage-name" name="name" data-autofocus />
          <FieldError formId="deal-stage" field="name" errors={props.fieldErrors} />
        </label>
        <label htmlFor="deal-stage-sort-order">
          Порядок
          <input
            id="deal-stage-sort-order"
            name="sortOrder"
            type="number"
            min="1"
            defaultValue={props.defaultSortOrder}
          />
          <FieldError formId="deal-stage" field="sortOrder" errors={props.fieldErrors} />
        </label>
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel="Создать этап"
          savingLabel="Создаем..."
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
        <button
          className="secondary-button"
          disabled={props.isSaving}
          type="button"
          onClick={props.onClose}
        >
          Отменить
        </button>
      </div>
    </>
  );
}

function renderCrmStatus(status: Client["status"]) {
  return (
    <StatusPill
      tone={status === "active" ? "success" : "muted"}
      label={status === "active" ? "Активно" : "Архив"}
    />
  );
}

function getClientName(clients: Client[], clientId: string): string {
  return clients.find((client) => client.id === clientId)?.name ?? clientId;
}

function useEntityFormState() {
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  return {
    fieldErrors,
    formError,
    reset: () => {
      setFormError("");
      setFieldErrors({});
    },
    setFieldErrors,
    setFormError
  };
}
