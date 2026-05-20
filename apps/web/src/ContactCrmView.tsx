import { ArrowLeft, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { Client, Contact, Product } from "./api";
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
  validateContactForm,
  validateProductForm
} from "./workspaceForms";
import {
  filterClientsForTable,
  filterContactsForTable,
  filterProductsForTable
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

export function ContactsView(props: {
  activeContactId?: string | null;
  data: WorkspaceData;
  onBack?: () => void;
  onOpenClient?: (clientId: string) => void;
  onOpenContact?: (contactId: string) => void;
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
  const activeContact = props.activeContactId
    ? props.data.contacts.find((contact) => contact.id === props.activeContactId) ?? null
    : null;

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

  if (props.activeContactId) {
    return (
      <>
        <Panel
          title="Карточка контакта"
          subtitle="Контакт клиента для сделок и будущих коммуникаций."
          actions={
            <span className="table-actions">
              {canManageContacts && activeContact ? (
                <button
                  className="primary-button"
                  disabled={isSaving}
                  type="button"
                  onClick={() => openEditContact(activeContact.id)}
                >
                  Редактировать
                </button>
              ) : null}
              <button className="secondary-button" type="button" onClick={props.onBack}>
                <ArrowLeft aria-hidden="true" size={14} />
                К списку контактов
              </button>
            </span>
          }
        >
          <SectionFeedback state={props.sectionState} emptyLabel="Контакты недоступны." />
          {activeContact ? (
            <div className="crm-card-layout">
              <section className="detail-card">
                <h2>{activeContact.name}</h2>
                <dl className="detail-list">
                  <div>
                    <dt>Клиент</dt>
                    <dd>{getClientName(props.data.clients, activeContact.clientId)}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{activeContact.email || "Не задан"}</dd>
                  </div>
                  <div>
                    <dt>Телефон</dt>
                    <dd>{activeContact.phone || "Не задан"}</dd>
                  </div>
                  <div>
                    <dt>Telegram</dt>
                    <dd>{activeContact.telegram || "Не задан"}</dd>
                  </div>
                  <div>
                    <dt>Роль</dt>
                    <dd>{activeContact.role || "Роль не задана"}</dd>
                  </div>
                  <div>
                    <dt>Статус</dt>
                    <dd>{renderCrmStatus(activeContact.status)}</dd>
                  </div>
                  <div>
                    <dt>Обновлено</dt>
                    <dd>{formatDate(activeContact.updatedAt)}</dd>
                  </div>
                </dl>
              </section>
              <aside className="detail-card">
                <h3>Связанный клиент</h3>
                <button
                  className="entity-row-link"
                  type="button"
                  onClick={() => props.onOpenClient?.(activeContact.clientId)}
                >
                  {getClientName(props.data.clients, activeContact.clientId)}
                </button>
                <p className="muted">
                  Контакт используется в сделках и будущих коммуникациях. Отдельная
                  лента контакта появится вместе с моделью коммуникаций.
                </p>
              </aside>
            </div>
          ) : (
            <p className="empty-state">Контакт не найден.</p>
          )}
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
            onOpen={props.onOpenContact}
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


function ContactsTable(props: {
  canManage: boolean;
  clients: Client[];
  contacts: Contact[];
  totalContacts: number;
  onEdit: (contactId: string) => void;
  onOpen: ((contactId: string) => void) | undefined;
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
                  <button
                    className="entity-row-link"
                    type="button"
                    onClick={() => props.onOpen?.(contact.id)}
                  >
                    <EntityNameCell
                      avatar="К"
                      primary={contact.name}
                      secondary={contact.email ?? contact.telegram ?? contact.phone ?? contact.id}
                    />
                  </button>
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
