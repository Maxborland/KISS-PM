import { PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { Client, Contact } from "./api";
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
  getFieldErrorId,
  hasFormErrors,
  validateClientForm,
  validateContactForm
} from "./workspaceForms";
import {
  filterClientsForTable,
  filterContactsForTable
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

type CrmModalKind = "client" | "contact";

export function ClientsView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageClients = hasPermission(props.data.permissions, "tenant.clients.manage");
  const crmMutations = useCrmMutations();
  const [search, setSearch] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formState = useEntityFormState();
  const editingClient = editingClientId
    ? props.data.clients.find((client) => client.id === editingClientId) ?? null
    : null;
  const isSaving = crmMutations.createClient.isPending || crmMutations.updateClient.isPending;
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
    const status = String(form.get("status") ?? "active");
    const errors = validateClientForm({ name, description, status });
    formState.setFieldErrors(errors);
    formState.setFormError("");
    if (hasFormErrors(errors)) return;

    try {
      if (editingClient) {
        await crmMutations.updateClient.mutateAsync({
          clientId: editingClient.id,
          input: {
            name: name.trim(),
            description: description.trim() || null,
            status: status as Client["status"]
          }
        });
      } else {
        await crmMutations.createClient.mutateAsync({
          id: makeClientGeneratedId("client", name),
          name: name.trim(),
          description: description.trim() || null
        });
      }
      setIsModalOpen(false);
      setEditingClientId(null);
      formState.reset();
      props.onChanged(editingClient ? "Клиент обновлен" : "Клиент создан");
    } catch (error) {
      formState.setFormError(getErrorMessage(error));
    }
  }

  function openCreateClient() {
    setEditingClientId(null);
    formState.reset();
    setIsModalOpen(true);
  }

  function openEditClient(clientId: string) {
    setEditingClientId(clientId);
    formState.reset();
    setIsModalOpen(true);
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
              onClick={openCreateClient}
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
          <ClientsTable
            canManage={canManageClients}
            clients={filteredClients}
            totalClients={props.data.clients.length}
            onEdit={openEditClient}
          />
        ) : null}
      </Panel>
      {isModalOpen ? (
        <ClientModal
          client={editingClient}
          error={formState.formError}
          fieldErrors={formState.fieldErrors}
          isSaving={isSaving}
          onClose={() => {
            if (isSaving) return;
            setIsModalOpen(false);
            setEditingClientId(null);
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
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formState = useEntityFormState();
  const editingContact = editingContactId
    ? props.data.contacts.find((contact) => contact.id === editingContactId) ?? null
    : null;
  const isSaving = crmMutations.createContact.isPending || crmMutations.updateContact.isPending;
  const filteredContacts = useMemo(
    () => filterContactsForTable(props.data.contacts, props.data.clients, search),
    [props.data.clients, props.data.contacts, search]
  );
  const activeClients = props.data.clients.filter((client) => client.status === "active");
  const activeContacts = props.data.contacts.filter((contact) => contact.status === "active").length;

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const clientId = String(form.get("clientId") ?? "");
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const status = String(form.get("status") ?? "active");
    const errors = validateContactForm({ clientId, name, email, status });
    formState.setFieldErrors(errors);
    formState.setFormError("");
    if (hasFormErrors(errors)) return;

    try {
      const input = {
        clientId,
        name: name.trim(),
        email: email.trim() || null,
        phone: String(form.get("phone") ?? "").trim() || null,
        telegram: String(form.get("telegram") ?? "").trim() || null,
        role: String(form.get("role") ?? "").trim() || null
      };
      if (editingContact) {
        await crmMutations.updateContact.mutateAsync({
          contactId: editingContact.id,
          input: {
            ...input,
            status: status as Contact["status"]
          }
        });
      } else {
        await crmMutations.createContact.mutateAsync({
          id: makeClientGeneratedId("contact", name),
          ...input
        });
      }
      setIsModalOpen(false);
      setEditingContactId(null);
      formState.reset();
      props.onChanged(editingContact ? "Контакт обновлен" : "Контакт создан");
    } catch (error) {
      formState.setFormError(getErrorMessage(error));
    }
  }

  function openCreateContact() {
    setEditingContactId(null);
    formState.reset();
    setIsModalOpen(true);
  }

  function openEditContact(contactId: string) {
    setEditingContactId(contactId);
    formState.reset();
    setIsModalOpen(true);
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
              disabled={activeClients.length === 0}
              title={activeClients.length === 0 ? "Сначала создайте активного клиента" : undefined}
              type="button"
              onClick={openCreateContact}
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
            canManage={canManageContacts}
            clients={props.data.clients}
            contacts={filteredContacts}
            totalContacts={props.data.contacts.length}
            onEdit={openEditContact}
          />
        ) : null}
      </Panel>
      {isModalOpen ? (
        <ContactModal
          contact={editingContact}
          clients={props.data.clients}
          error={formState.formError}
          fieldErrors={formState.fieldErrors}
          isSaving={isSaving}
          onClose={() => {
            if (isSaving) return;
            setIsModalOpen(false);
            setEditingContactId(null);
            formState.reset();
          }}
          onSubmit={submitContact}
        />
      ) : null}
    </>
  );
}

function ClientsTable(props: {
  canManage: boolean;
  clients: Client[];
  totalClients: number;
  onEdit: (clientId: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Клиенты">
        <thead>
          <tr>
            <th>Клиент</th>
            <th>Описание</th>
            <th>Статус</th>
            <th>Обновлено</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {props.clients.length === 0 ? (
            <TableEmpty
              colSpan={5}
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
                <td>
                  <EntityActions
                    canManage={props.canManage}
                    entityId={client.id}
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

function ContactsTable(props: {
  canManage: boolean;
  clients: Client[];
  contacts: Contact[];
  totalContacts: number;
  onEdit: (contactId: string) => void;
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
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {props.contacts.length === 0 ? (
            <TableEmpty
              colSpan={6}
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
                <td>
                  <EntityActions
                    canManage={props.canManage}
                    entityId={contact.id}
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

function ClientModal(props: {
  client: Client | null;
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title={props.client ? "Редактировать клиента" : "Создать клиента"}
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
            defaultValue={props.client?.name ?? ""}
          />
          <FieldError formId="client" field="name" errors={props.fieldErrors} />
        </label>
        <label htmlFor="client-description">
          Описание
          <textarea
            id="client-description"
            name="description"
            rows={3}
            defaultValue={props.client?.description ?? ""}
          />
        </label>
        <EntityStatusField
          defaultValue={props.client?.status ?? "active"}
          formId="client"
          fieldErrors={props.fieldErrors}
        />
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel={props.client ? "Сохранить клиента" : "Создать клиента"}
          savingLabel="Сохраняем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
  );
}

function ContactModal(props: {
  contact: Contact | null;
  clients: Client[];
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const selectableClients = props.clients.filter(
    (client) => client.status === "active" || client.id === props.contact?.clientId
  );

  return (
    <Modal
      title={props.contact ? "Редактировать контакт" : "Создать контакт"}
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
            defaultValue={props.contact?.clientId ?? ""}
          >
            <option value="">Выберите клиента</option>
            {selectableClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <FieldError formId="contact" field="clientId" errors={props.fieldErrors} />
        </label>
        <label htmlFor="contact-name">
          Имя контакта
          <input
            id="contact-name"
            name="name"
            aria-invalid={Boolean(props.fieldErrors.name)}
            defaultValue={props.contact?.name ?? ""}
          />
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
              defaultValue={props.contact?.email ?? ""}
            />
            <FieldError formId="contact" field="email" errors={props.fieldErrors} />
          </label>
          <label htmlFor="contact-phone">
            Телефон
            <input id="contact-phone" name="phone" defaultValue={props.contact?.phone ?? ""} />
          </label>
          <label htmlFor="contact-telegram">
            Telegram
            <input
              id="contact-telegram"
              name="telegram"
              defaultValue={props.contact?.telegram ?? ""}
            />
          </label>
        </div>
        <label htmlFor="contact-role">
          Роль у клиента
          <input id="contact-role" name="role" defaultValue={props.contact?.role ?? ""} />
        </label>
        <EntityStatusField
          defaultValue={props.contact?.status ?? "active"}
          formId="contact"
          fieldErrors={props.fieldErrors}
        />
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel={props.contact ? "Сохранить контакт" : "Создать контакт"}
          savingLabel="Сохраняем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
  );
}

function getClientName(clients: Client[], clientId: string): string {
  return clients.find((client) => client.id === clientId)?.name ?? clientId;
}
