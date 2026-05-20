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

export function ClientsView(props: {
  activeClientId?: string | null;
  data: WorkspaceData;
  onBack?: () => void;
  onOpenClient?: (clientId: string) => void;
  onOpenContact?: (contactId: string) => void;
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
  const activeClient = props.activeClientId
    ? props.data.clients.find((client) => client.id === props.activeClientId) ?? null
    : null;
  const activeClientContacts = activeClient
    ? props.data.contacts.filter((contact) => contact.clientId === activeClient.id)
    : [];
  const activeClientOpportunities = activeClient
    ? props.data.opportunities.filter((opportunity) => opportunity.clientId === activeClient.id)
    : [];

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

  if (props.activeClientId) {
    return (
      <>
        <Panel
          title="Карточка клиента"
          subtitle="Source of truth клиента для сделок, контактов и будущих проектов."
          actions={
            <span className="table-actions">
              {canManageClients && activeClient ? (
                <button
                  className="primary-button"
                  disabled={isSaving}
                  type="button"
                  onClick={() => openEditClient(activeClient.id)}
                >
                  Редактировать
                </button>
              ) : null}
              <button className="secondary-button" type="button" onClick={props.onBack}>
                <ArrowLeft aria-hidden="true" size={14} />
                К списку клиентов
              </button>
            </span>
          }
        >
          <SectionFeedback state={props.sectionState} emptyLabel="Клиенты недоступны." />
          {activeClient ? (
            <div className="crm-card-layout">
              <section className="detail-card">
                <h2>{activeClient.name}</h2>
                <dl className="detail-list">
                  <div>
                    <dt>Статус</dt>
                    <dd>{renderCrmStatus(activeClient.status)}</dd>
                  </div>
                  <div>
                    <dt>Описание</dt>
                    <dd>{activeClient.description || "Описание не задано"}</dd>
                  </div>
                  <div>
                    <dt>Контакты</dt>
                    <dd>{activeClientContacts.length}</dd>
                  </div>
                  <div>
                    <dt>Открытые сделки</dt>
                    <dd>{activeClientOpportunities.length}</dd>
                  </div>
                  <div>
                    <dt>Обновлено</dt>
                    <dd>{formatDate(activeClient.updatedAt)}</dd>
                  </div>
                </dl>
              </section>
              <aside className="detail-card">
                <h3>Связи клиента</h3>
                {activeClientContacts.length > 0 ? (
                  <ul className="entity-link-list">
                    {activeClientContacts.map((contact) => (
                      <li key={contact.id}>
                        <button
                          className="entity-row-link"
                          type="button"
                          onClick={() => props.onOpenContact?.(contact.id)}
                        >
                          {contact.name}
                        </button>
                        <span className="muted">{contact.email || "email не задан"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Контакты клиента пока не заведены.</p>
                )}
              </aside>
            </div>
          ) : (
            <p className="empty-state">Клиент не найден.</p>
          )}
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
            onOpen={props.onOpenClient}
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


function ClientsTable(props: {
  canManage: boolean;
  clients: Client[];
  totalClients: number;
  onEdit: (clientId: string) => void;
  onOpen: ((clientId: string) => void) | undefined;
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
                  <button
                    className="entity-row-link"
                    type="button"
                    onClick={() => props.onOpen?.(client.id)}
                  >
                    <EntityNameCell avatar="К" primary={client.name} secondary={client.id} />
                  </button>
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

