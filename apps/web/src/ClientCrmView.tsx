import { ArrowLeft, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { Client } from "./api";
import {
  CrmEntityActivityPlaceholder,
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
  getFieldErrorId,
  hasFormErrors,
  validateClientForm
} from "./workspaceForms";
import { filterClientsForTable } from "./workspaceTables";
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

  async function saveClientInline(client: Client, patch: Partial<Client>) {
    const input = {
      name: typeof patch.name === "string" ? patch.name.trim() : client.name,
      description:
        typeof patch.description === "string"
          ? patch.description.trim() || null
          : client.description,
      status: patch.status ?? client.status
    };
    const errors = validateClientForm({
      name: input.name,
      description: input.description ?? "",
      status: input.status
    });
    if (hasFormErrors(errors)) {
      throw new Error(Object.values(errors)[0] ?? "Проверьте поле клиента.");
    }

    await crmMutations.updateClient.mutateAsync({
      clientId: client.id,
      input
    });
    props.onChanged("Поле клиента обновлено");
  }

  if (props.activeClientId) {
    return (
      <>
        <SectionFeedback state={props.sectionState} emptyLabel="Клиенты недоступны." />
        {activeClient ? (
          <CrmEntityWorkspace
            activity={
              <CrmEntityActivityPlaceholder
                entityLabel="клиент"
                summary={`${activeClientContacts.length} контактов · ${activeClientOpportunities.length} сделок`}
              />
            }
            actions={
              canManageClients ? (
                <button
                  className="primary-button"
                  disabled={isSaving}
                  type="button"
                  onClick={() => openEditClient(activeClient.id)}
                >
                  Редактировать
                </button>
              ) : null
            }
            backLabel="Клиенты"
            eyebrow="Клиент"
            meta="Source of truth клиента для сделок, контактов и будущих проектов."
            status={renderCrmStatus(activeClient.status)}
            title={
              <InlineEditableValue
                disabled={!canManageClients || isSaving}
                label="Название клиента"
                value={activeClient.name}
                onSave={(value) => saveClientInline(activeClient, { name: value })}
              />
            }
            onBack={props.onBack ?? (() => undefined)}
          >
            <CrmEntitySection title="О клиенте">
              <CrmEntityFactList>
                <CrmEntityFact label="Название">
                  <InlineEditableValue
                    disabled={!canManageClients || isSaving}
                    label="Название клиента"
                    value={activeClient.name}
                    onSave={(value) => saveClientInline(activeClient, { name: value })}
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Описание">
                  <InlineEditableValue
                    disabled={!canManageClients || isSaving}
                    display={activeClient.description || "Описание не задано"}
                    label="Описание клиента"
                    mode="textarea"
                    value={activeClient.description ?? ""}
                    onSave={(value) => saveClientInline(activeClient, { description: value })}
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Статус">
                  <InlineEditableValue
                    disabled={!canManageClients || isSaving}
                    display={activeClient.status === "active" ? "Активно" : "Архив"}
                    label="Статус клиента"
                    mode="select"
                    options={crmStatusOptions}
                    value={activeClient.status}
                    onSave={(value) =>
                      saveClientInline(activeClient, { status: value as Client["status"] })
                    }
                  />
                </CrmEntityFact>
                <CrmEntityFact label="Контакты">{activeClientContacts.length}</CrmEntityFact>
                <CrmEntityFact label="Открытые сделки">
                  {activeClientOpportunities.length}
                </CrmEntityFact>
                <CrmEntityFact label="Обновлено">{formatDate(activeClient.updatedAt)}</CrmEntityFact>
              </CrmEntityFactList>
            </CrmEntitySection>
            <CrmEntitySection title="Контакты клиента">
              {activeClientContacts.length > 0 ? (
                <ul className="crm-related-list">
                  {activeClientContacts.map((contact) => (
                    <li key={contact.id}>
                      <button
                        className="entity-row-link"
                        type="button"
                        onClick={() => props.onOpenContact?.(contact.id)}
                      >
                        <EntityNameCell
                          avatar="К"
                          primary={contact.name}
                          secondary={contact.email || contact.phone || "Контакт без связи"}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state compact">Контакты клиента пока не заведены.</p>
              )}
            </CrmEntitySection>
            <CrmEntitySection title="Сделки клиента">
              {activeClientOpportunities.length > 0 ? (
                <ul className="crm-related-list">
                  {activeClientOpportunities.map((opportunity) => (
                    <li key={opportunity.id}>
                      <span className="entity-name-cell">
                        <span className="row-avatar">С</span>
                        <span>
                          <strong>{opportunity.title}</strong>
                          <small>{opportunity.status}</small>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state compact">Сделок по клиенту пока нет.</p>
              )}
            </CrmEntitySection>
          </CrmEntityWorkspace>
        ) : (
          <Panel title="Клиент не найден" subtitle="Запись не найдена в текущем workspace.">
            <p className="empty-state">Клиент не найден.</p>
            <button className="secondary-button" type="button" onClick={props.onBack}>
              <ArrowLeft aria-hidden="true" size={14} />
              К списку клиентов
            </button>
          </Panel>
        )}
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

const crmStatusOptions = [
  { label: "Активно", value: "active" },
  { label: "Архив", value: "archived" }
];


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

