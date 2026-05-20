import { ArrowLeft, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { Client, Contact, ContactUpdateInput } from "./api";
import { CrmActivityPanel } from "./CrmActivityPanel";
import {
  CrmEntityFact,
  CrmEntityFactList,
  CrmEntitySection,
  CrmEntityWorkspace
} from "./CrmEntityWorkspace";
import { InlineEditableValue } from "./CrmInlineEdit";
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
  validateContactForm
} from "./workspaceForms";
import { filterContactsForTable } from "./workspaceTables";
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

  async function saveContactInline(contact: Contact, patch: Partial<Contact>) {
    const patchInput: Partial<ContactUpdateInput> = {};
    if (typeof patch.clientId === "string") patchInput.clientId = patch.clientId;
    if (typeof patch.name === "string") patchInput.name = patch.name.trim();
    if (typeof patch.email === "string") patchInput.email = patch.email.trim() || null;
    if (typeof patch.phone === "string") patchInput.phone = patch.phone.trim() || null;
    if (typeof patch.telegram === "string") patchInput.telegram = patch.telegram.trim() || null;
    if (typeof patch.role === "string") patchInput.role = patch.role.trim() || null;
    if (patch.status) patchInput.status = patch.status;
    const input = {
      clientId: patchInput.clientId ?? contact.clientId,
      name: patchInput.name ?? contact.name,
      email: "email" in patchInput ? patchInput.email ?? null : contact.email,
      phone: "phone" in patchInput ? patchInput.phone ?? null : contact.phone,
      telegram: "telegram" in patchInput ? patchInput.telegram ?? null : contact.telegram,
      role: "role" in patchInput ? patchInput.role ?? null : contact.role,
      status: patchInput.status ?? contact.status
    };
    const errors = validateContactForm({
      clientId: input.clientId,
      name: input.name,
      email: input.email ?? "",
      status: input.status
    });
    if (hasFormErrors(errors)) {
      throw new Error(Object.values(errors)[0] ?? "Проверьте поле контакта.");
    }

    await crmMutations.updateContact.mutateAsync({
      contactId: contact.id,
      input
    });
    props.onChanged("Поле контакта обновлено");
  }

  if (props.activeContactId) {
    const activeContactClient = activeContact
      ? props.data.clients.find((client) => client.id === activeContact.clientId) ?? null
      : null;

    return (
      <>
        <SectionFeedback state={props.sectionState} emptyLabel="Контакты недоступны." />
        {activeContact ? (
          <CrmEntityWorkspace
            activity={
              <CrmActivityPanel
                canManage={canManageContacts}
                data={props.data}
                entityId={activeContact.id}
                entityLabel="контакт"
                entityType="contact"
                managePermission="tenant.contacts.manage"
                onChanged={props.onChanged}
              />
            }
            actions={
              canManageContacts ? (
                <button
                  className="primary-button"
                  disabled={isSaving}
                  type="button"
                  onClick={() => openEditContact(activeContact.id)}
                >
                  Редактировать
                </button>
              ) : null
            }
            backLabel="Контакты"
            eyebrow="Контакт"
            meta={
              <>
                Клиент:{" "}
                <button
                  className="inline-link-button"
                  type="button"
                  onClick={() => props.onOpenClient?.(activeContact.clientId)}
                >
                  {activeContactClient?.name ?? activeContact.clientId}
                </button>
              </>
            }
            status={renderCrmStatus(activeContact.status)}
            title={
              <InlineEditableValue
                disabled={!canManageContacts || isSaving}
                label="Имя контакта"
                value={activeContact.name}
                onSave={(value) => saveContactInline(activeContact, { name: value })}
              />
            }
            onBack={props.onBack ?? (() => undefined)}
          >
            <CrmEntitySection title="О контакте">
              <CrmEntityFactList>
                <CrmEntityFact label="Клиент">
                  <InlineEditableValue
                    disabled={!canManageContacts || isSaving}
                    display={getClientName(props.data.clients, activeContact.clientId)}
                    label="Клиент контакта"
                    mode="select"
                    options={activeClients.map((client) => ({
                      label: client.name,
                      value: client.id
                    }))}
                    value={activeContact.clientId}
                    onSave={(value) => saveContactInline(activeContact, { clientId: value })}
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Имя">
                  <InlineEditableValue
                    disabled={!canManageContacts || isSaving}
                    label="Имя контакта"
                    value={activeContact.name}
                    onSave={(value) => saveContactInline(activeContact, { name: value })}
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Email">
                  <InlineEditableValue
                    disabled={!canManageContacts || isSaving}
                    display={activeContact.email || "Не задан"}
                    label="Email контакта"
                    value={activeContact.email ?? ""}
                    onSave={(value) => saveContactInline(activeContact, { email: value })}
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Телефон">
                  <InlineEditableValue
                    disabled={!canManageContacts || isSaving}
                    display={activeContact.phone || "Не задан"}
                    label="Телефон контакта"
                    value={activeContact.phone ?? ""}
                    onSave={(value) => saveContactInline(activeContact, { phone: value })}
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Telegram">
                  <InlineEditableValue
                    disabled={!canManageContacts || isSaving}
                    display={activeContact.telegram || "Не задан"}
                    label="Telegram контакта"
                    value={activeContact.telegram ?? ""}
                    onSave={(value) => saveContactInline(activeContact, { telegram: value })}
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Роль у клиента">
                  <InlineEditableValue
                    disabled={!canManageContacts || isSaving}
                    display={activeContact.role || "Роль не задана"}
                    label="Роль контакта"
                    value={activeContact.role ?? ""}
                    onSave={(value) => saveContactInline(activeContact, { role: value })}
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Статус">
                  <InlineEditableValue
                    disabled={!canManageContacts || isSaving}
                    display={activeContact.status === "active" ? "Активно" : "Архив"}
                    label="Статус контакта"
                    mode="select"
                    options={crmStatusOptions}
                    value={activeContact.status}
                    onSave={(value) =>
                      saveContactInline(activeContact, { status: value as Contact["status"] })
                    }
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Обновлено">{formatDate(activeContact.updatedAt)}</CrmEntityFact>
              </CrmEntityFactList>
            </CrmEntitySection>
            <CrmEntitySection title="Связанный клиент">
              <button
                className="entity-row-link"
                type="button"
                onClick={() => props.onOpenClient?.(activeContact.clientId)}
              >
                <EntityNameCell
                  avatar="К"
                  primary={activeContactClient?.name ?? activeContact.clientId}
                  secondary={activeContactClient?.description ?? "Клиент без описания"}
                />
              </button>
            </CrmEntitySection>
          </CrmEntityWorkspace>
        ) : (
          <Panel title="Контакт не найден" subtitle="Запись не найдена в текущем workspace.">
            <p className="empty-state">Контакт не найден.</p>
            <button className="secondary-button" type="button" onClick={props.onBack}>
              <ArrowLeft aria-hidden="true" size={14} />
              К списку контактов
            </button>
          </Panel>
        )}
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

const crmStatusOptions = [
  { label: "Активно", value: "active" },
  { label: "Архив", value: "archived" }
];

function getClientName(clients: Client[], clientId: string): string {
  return clients.find((client) => client.id === clientId)?.name ?? clientId;
}
