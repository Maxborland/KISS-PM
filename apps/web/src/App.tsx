import { useEffect, useMemo, useState } from "react";

import {
  createAccessRole,
  createPosition,
  createUser,
  deleteAccessRole,
  deletePosition,
  deleteUser,
  fetchAccessRoles,
  fetchApiHealth,
  fetchAuditEvents,
  fetchMe,
  fetchPositions,
  fetchUsers,
  login,
  logout,
  updateAccessRole,
  updateProfile,
  updatePosition,
  updateTheme,
  updateUser,
  type AccessRole,
  type AuditEvent,
  type Position,
  type WorkspaceUser
} from "./api";

type AppData = {
  apiStatus: string;
  me: WorkspaceUser;
  permissions: string[];
  users: WorkspaceUser[];
  positions: Position[];
  accessRoles: AccessRole[];
  auditEvents: AuditEvent[];
};

const navItems = [
  "Главная",
  "Пользователи",
  "Роли доступа",
  "Должности",
  "Профиль",
  "Оформление"
] as const;

type NavItem = (typeof navItems)[number];

const navPermissionMap = {
  Главная: null,
  Пользователи: "tenant.users.read",
  "Роли доступа": "tenant.access_profiles.read",
  Должности: "tenant.positions.read",
  Профиль: "profile.read",
  Оформление: "workspace.theme.manage"
} satisfies Record<NavItem, string | null>;

const rolePermissionOptions = [
  { value: "tenant.users.read", label: "Читать пользователей" },
  { value: "tenant.users.manage", label: "Управлять пользователями" },
  { value: "tenant.access_profiles.read", label: "Читать роли доступа" },
  { value: "tenant.access_profiles.manage", label: "Управлять ролями доступа" },
  { value: "tenant.positions.read", label: "Читать должности" },
  { value: "tenant.positions.manage", label: "Управлять должностями" },
  { value: "tenant.audit_events.read", label: "Читать audit" },
  { value: "profile.read", label: "Читать профиль" },
  { value: "profile.update", label: "Обновлять профиль" },
  { value: "workspace.theme.manage", label: "Управлять темой" }
] as const;

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [activeView, setActiveView] = useState<NavItem>("Главная");
  const [status, setStatus] = useState<"loading" | "login" | "ready" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    void bootstrap();
  }, []);

  const cssVars = useMemo(
    () =>
      data
        ? ({
            "--accent": data.me.accentColor,
            "--accent-soft": `${data.me.accentColor}1a`
          } as React.CSSProperties)
        : undefined,
    [data]
  );
  const visibleNavItems = useMemo(
    () =>
      data
        ? navItems.filter((item) => {
            const permission = navPermissionMap[item];
            return permission === null || data.permissions.includes(permission);
          })
        : navItems,
    [data]
  );

  async function bootstrap() {
    try {
      const health = await fetchApiHealth();
      const me = await fetchMe();
      const loaded = await loadWorkspaceData(health.status, me.user, me.permissions);
      setData(loaded);
      setActiveView("Главная");
      setStatus("ready");
    } catch {
      setStatus("login");
    }
  }

  async function loadWorkspaceData(
    apiStatus: string,
    me: WorkspaceUser,
    permissions: string[]
  ): Promise<AppData> {
    const can = (permission: string) => permissions.includes(permission);
    const [users, positions, accessRoles, auditEvents] = await Promise.all([
      loadOptional(
        can("tenant.users.read"),
        fetchUsers,
        { users: [] as WorkspaceUser[] }
      ),
      loadOptional(
        can("tenant.positions.read"),
        fetchPositions,
        { positions: [] as Position[] }
      ),
      loadOptional(
        can("tenant.access_profiles.read"),
        fetchAccessRoles,
        { accessRoles: [] as AccessRole[] }
      ),
      loadOptional(
        can("tenant.audit_events.read"),
        fetchAuditEvents,
        { auditEvents: [] as AuditEvent[] }
      )
    ]);

    return {
      apiStatus,
      me,
      permissions,
      users: users.users,
      positions: positions.positions,
      accessRoles: accessRoles.accessRoles,
      auditEvents: auditEvents.auditEvents
    };
  }

  async function refresh(nextMessage?: string) {
    if (!data) return;
    const me = await fetchMe();
    setData(await loadWorkspaceData(data.apiStatus, me.user, me.permissions));
    if (nextMessage) setMessage(nextMessage);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");

    try {
      const me = await login({
        email: String(form.get("email")),
        password: String(form.get("password"))
      });
      const health = await fetchApiHealth();
      setData(await loadWorkspaceData(health.status, me.user, me.permissions));
      setActiveView("Главная");
      setStatus("ready");
    } catch {
      setMessage("Не удалось войти. Проверь email и пароль.");
    }
  }

  async function handleLogout() {
    await logout();
    setData(null);
    setActiveView("Главная");
    setStatus("login");
  }

  if (status === "loading") {
    return <main className="center-shell">Загружаем KISS PM...</main>;
  }

  if (status === "login" || !data) {
    return <LoginScreen message={message} onLogin={handleLogin} />;
  }

  return (
    <main className="workspace-shell" style={cssVars}>
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">K</span>
          <div>
            <strong>KISS PM</strong>
            <small>Single workspace</small>
          </div>
        </div>
        <nav className="nav-list" aria-label="Основная навигация">
          {visibleNavItems.map((item) => (
            <button
              key={item}
              className={item === activeView ? "nav-item active" : "nav-item"}
              onClick={() => setActiveView(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
        <button className="ghost-button" type="button" onClick={handleLogout}>
          Выйти
        </button>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">API: {data.apiStatus}</p>
            <h1>{activeView}</h1>
          </div>
          <div className="user-chip">
            <span>{data.me.name}</span>
            <small>{data.me.positionName ?? "Без должности"}</small>
          </div>
        </header>

        {message ? <p className="toast">{message}</p> : null}
        {activeView === "Главная" ? <Dashboard data={data} /> : null}
        {activeView === "Пользователи" ? (
          <UsersView data={data} onChanged={() => refresh("Пользователи обновлены")} />
        ) : null}
        {activeView === "Роли доступа" ? (
          <RolesView data={data} onChanged={() => refresh("Роли доступа обновлены")} />
        ) : null}
        {activeView === "Должности" ? (
          <PositionsView
            data={data}
            onChanged={() => refresh("Должности обновлены")}
          />
        ) : null}
        {activeView === "Профиль" ? (
          <ProfileView data={data} onChanged={() => refresh("Профиль обновлен")} />
        ) : null}
        {activeView === "Оформление" ? (
          <ThemeView user={data.me} onChanged={() => refresh("Тема обновлена")} />
        ) : null}
      </section>
    </main>
  );
}

async function loadOptional<T>(
  enabled: boolean,
  loader: () => Promise<T>,
  fallback: T
): Promise<T> {
  if (!enabled) return fallback;

  try {
    return await loader();
  } catch {
    return fallback;
  }
}

function hasPermission(data: AppData, permission: string): boolean {
  return data.permissions.includes(permission);
}

function LoginScreen(props: {
  message: string;
  onLogin: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <p className="eyebrow">KISS PM</p>
        <h1>Вход в рабочее пространство</h1>
        <p className="lead">
          Базис продукта начинается с понятной идентичности пользователя, роли
          доступа и управляемых действий.
        </p>
        <form className="stack-form" onSubmit={props.onLogin}>
          <label>
            Email
            <input name="email" defaultValue="admin@kiss-pm.local" />
          </label>
          <label>
            Пароль
            <input name="password" defaultValue="admin12345" type="password" />
          </label>
          <button className="primary-button" type="submit">
            Войти
          </button>
          {props.message ? <p className="error">{props.message}</p> : null}
        </form>
      </section>
    </main>
  );
}

function Dashboard({ data }: { data: AppData }) {
  return (
    <section className="grid-3">
      <Metric title="Пользователи" value={data.users.length} />
      <Metric title="Роли доступа" value={data.accessRoles.length} />
      <Metric title="Должности" value={data.positions.length} />
      <section className="panel wide-panel">
        <h2>Последние audit events</h2>
        <EntityList
          items={data.auditEvents.slice(0, 5)}
          render={(event) => (
            <>
              <span>{event.actionType}</span>
              <small>{event.correlationId}</small>
            </>
          )}
        />
      </section>
    </section>
  );
}

function UsersView(props: { data: AppData; onChanged: () => void | Promise<void> }) {
  const canManageUsers = hasPermission(props.data, "tenant.users.manage");
  const [modal, setModal] = useState<
    | { type: "create" }
    | { type: "edit"; userId: string }
    | { type: "delete"; userId: string }
    | null
  >(null);
  const [error, setError] = useState("");
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

  function closeModal() {
    setModal(null);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");

    try {
      const input = {
        email: String(form.get("email")),
        name: String(form.get("name")),
        accessProfileId: String(form.get("accessProfileId")),
        positionId: String(form.get("positionId")) || null,
        status: String(form.get("status") ?? "active")
      };

      if (editingUser) {
        await updateUser(editingUser.id, input);
      } else {
        await createUser({
          id: `user-${Date.now().toString(36)}`,
          ...input,
          password: String(form.get("password"))
        });
      }

      formElement.reset();
      setModal(null);
      await props.onChanged();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  async function removeUser(user: WorkspaceUser | null) {
    if (!user) return;
    setError("");
    try {
      await deleteUser(user.id);
      setModal(null);
      await props.onChanged();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  return (
    <>
      <Panel
        title="CRUD пользователей"
        actions={
          canManageUsers ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setModal({ type: "create" })}
            >
              Создать пользователя
            </button>
          ) : null
        }
      >
        <table className="data-table" aria-label="Пользователи">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Должность</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {props.data.users.map((user) => {
              const role = props.data.accessRoles.find(
                (item) => item.id === user.accessProfileId
              );

              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{role?.name ?? user.accessProfileId}</td>
                  <td>{user.positionName ?? "Без должности"}</td>
                  <td>{user.status === "active" ? "Активен" : "Отключен"}</td>
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
            })}
          </tbody>
        </table>
      </Panel>
      {isFormOpen ? (
        <Modal
          title={mode === "edit" ? "Редактировать пользователя" : "Создать пользователя"}
          onClose={closeModal}
        >
          <form className="stack-form" key={editingUser?.id ?? "new-user"} onSubmit={submit}>
            <label>
              Имя
              <input name="name" defaultValue={editingUser?.name ?? ""} required />
            </label>
            <label>
              Email
              <input name="email" defaultValue={editingUser?.email ?? ""} required />
            </label>
            {mode === "create" ? (
              <label>
                Пароль
                <input name="password" placeholder="минимум 8 символов" required />
              </label>
            ) : null}
            <label>
              Роль доступа
              {isEditingSelf && editingUser ? (
                <>
                  <input name="accessProfileId" type="hidden" value={editingUser.accessProfileId} />
                  <input
                    readOnly
                    value={
                      props.data.accessRoles.find(
                        (role) => role.id === editingUser.accessProfileId
                      )?.name ?? editingUser.accessProfileId
                    }
                  />
                </>
              ) : (
                <select name="accessProfileId" defaultValue={editingUser?.accessProfileId} required>
                  {props.data.accessRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label>
              Должность
              <select name="positionId" defaultValue={editingUser?.positionId ?? ""}>
                <option value="">Без должности</option>
                {props.data.positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Статус
              {isEditingSelf ? (
                <>
                  <input name="status" type="hidden" value="active" />
                  <input readOnly value="Активен" />
                </>
              ) : (
                <select name="status" defaultValue={editingUser?.status ?? "active"}>
                  <option value="active">Активен</option>
                  <option value="inactive">Отключен</option>
                </select>
              )}
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="form-actions">
              <button className="primary-button" type="submit">
                {mode === "edit" ? "Сохранить пользователя" : "Создать пользователя"}
              </button>
              <button className="secondary-button" type="button" onClick={closeModal}>
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
          onCancel={closeModal}
          onConfirm={() => removeUser(deletingUser ?? null)}
          error={error}
        />
      ) : null}
    </>
  );
}

function RolesView(props: { data: AppData; onChanged: () => void | Promise<void> }) {
  const canManageRoles = hasPermission(props.data, "tenant.access_profiles.manage");
  const [modal, setModal] = useState<
    | { type: "create" }
    | { type: "edit"; roleId: string }
    | { type: "delete"; roleId: string }
    | null
  >(null);
  const [error, setError] = useState("");
  const editingRole =
    modal?.type === "edit"
      ? props.data.accessRoles.find((role) => role.id === modal.roleId)
      : null;
  const deletingRole =
    modal?.type === "delete"
      ? props.data.accessRoles.find((role) => role.id === modal.roleId)
      : null;
  const isFormOpen = modal?.type === "create" || modal?.type === "edit";

  function closeModal() {
    setModal(null);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const permissions = form.getAll("permissions").map(String);
    setError("");

    try {
      const input = {
        name: String(form.get("name")),
        permissions
      };

      if (editingRole) {
        await updateAccessRole(editingRole.id, input);
      } else {
        await createAccessRole({
          id: `access-role-${Date.now().toString(36)}`,
          ...input
        });
      }

      formElement.reset();
      setModal(null);
      await props.onChanged();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  async function removeRole(role: AccessRole | null) {
    if (!role) return;
    setError("");
    try {
      await deleteAccessRole(role.id);
      setModal(null);
      await props.onChanged();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  return (
    <>
      <Panel
        title="CRUD ролей доступа"
        actions={
          canManageRoles ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setModal({ type: "create" })}
            >
              Создать роль доступа
            </button>
          ) : null
        }
      >
        <table className="data-table" aria-label="Роли доступа">
          <thead>
            <tr>
              <th>Название</th>
              <th>Права</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {props.data.accessRoles.map((role) => {
              const assignedUsers = props.data.users.filter(
                (user) => user.accessProfileId === role.id
              ).length;

              return (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.permissions.join(", ")}</td>
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
            })}
          </tbody>
        </table>
      </Panel>
      {isFormOpen ? (
        <Modal
          title={editingRole ? "Редактировать роль доступа" : "Создать роль доступа"}
          onClose={closeModal}
        >
        <form className="stack-form" key={editingRole?.id ?? "new-role"} onSubmit={submit}>
          <label>
            Название роли
            <input name="name" defaultValue={editingRole?.name ?? ""} required />
          </label>
          <fieldset className="permission-grid">
            <legend>Права роли</legend>
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
          </fieldset>
          {error ? <p className="error">{error}</p> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit">
              {editingRole ? "Сохранить роль доступа" : "Создать роль доступа"}
            </button>
            <button className="secondary-button" type="button" onClick={closeModal}>
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
          onCancel={closeModal}
          onConfirm={() => removeRole(deletingRole ?? null)}
          error={error}
        />
      ) : null}
    </>
  );
}

function PositionsView(props: { data: AppData; onChanged: () => void | Promise<void> }) {
  const canManagePositions = hasPermission(props.data, "tenant.positions.manage");
  const [modal, setModal] = useState<
    | { type: "create" }
    | { type: "edit"; positionId: string }
    | { type: "delete"; positionId: string }
    | null
  >(null);
  const [error, setError] = useState("");
  const editingPosition =
    modal?.type === "edit"
      ? props.data.positions.find((position) => position.id === modal.positionId)
      : null;
  const deletingPosition =
    modal?.type === "delete"
      ? props.data.positions.find((position) => position.id === modal.positionId)
      : null;
  const isFormOpen = modal?.type === "create" || modal?.type === "edit";

  function closeModal() {
    setModal(null);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = {
      name: String(form.get("name")),
      description: String(form.get("description"))
    };
    setError("");

    try {
      if (editingPosition) {
        await updatePosition(editingPosition.id, input);
      } else {
        await createPosition({
          id: `position-${Date.now().toString(36)}`,
          ...input
        });
      }

      formElement.reset();
      setModal(null);
      await props.onChanged();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  async function removePosition(position: Position | null) {
    if (!position) return;
    setError("");
    try {
      await deletePosition(position.id);
      setModal(null);
      await props.onChanged();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  return (
    <>
      <Panel
        title="CRUD должностей"
        actions={
          canManagePositions ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setModal({ type: "create" })}
            >
              Создать должность
            </button>
          ) : null
        }
      >
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
            {props.data.positions.map((position) => {
              const assignedUsers = props.data.users.filter(
                (user) => user.positionId === position.id
              ).length;

              return (
                <tr key={position.id}>
                  <td>{position.name}</td>
                  <td>{position.description ?? "Описание не задано"}</td>
                  <td>{assignedUsers}</td>
                  <td>
                    {canManagePositions ? (
                      <span className="table-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setModal({ type: "edit", positionId: position.id })}
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
                          onClick={() => setModal({ type: "delete", positionId: position.id })}
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
            })}
          </tbody>
        </table>
      </Panel>
      {isFormOpen ? (
        <Modal
          title={editingPosition ? "Редактировать должность" : "Создать должность"}
          onClose={closeModal}
        >
        <form className="stack-form" key={editingPosition?.id ?? "new-position"} onSubmit={submit}>
          <label>
            Название должности
            <input name="name" defaultValue={editingPosition?.name ?? ""} required />
          </label>
          <label>
            Описание
            <input name="description" defaultValue={editingPosition?.description ?? ""} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit">
              {editingPosition ? "Сохранить должность" : "Создать должность"}
            </button>
            <button className="secondary-button" type="button" onClick={closeModal}>
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
          onCancel={closeModal}
          onConfirm={() => removePosition(deletingPosition ?? null)}
          error={error}
        />
      ) : null}
    </>
  );
}

function ProfileView(props: { data: AppData; onChanged: () => void | Promise<void> }) {
  const canUpdate = hasPermission(props.data, "profile.update");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateProfile({
      name: String(form.get("name")),
      phone: String(form.get("phone")),
      telegram: String(form.get("telegram"))
    });
    await props.onChanged();
  }

  return (
    <Panel title="Профиль пользователя">
      <form className="stack-form compact-form" onSubmit={submit}>
        <label>
          Имя
          <input name="name" defaultValue={props.data.me.name} disabled={!canUpdate} />
        </label>
        <label>
          Телефон
          <input name="phone" defaultValue={props.data.me.phone ?? ""} disabled={!canUpdate} />
        </label>
        <label>
          Telegram
          <input name="telegram" defaultValue={props.data.me.telegram ?? ""} disabled={!canUpdate} />
        </label>
        {canUpdate ? (
          <button className="primary-button" type="submit">
            Сохранить профиль
          </button>
        ) : (
          <p className="muted">Профиль доступен только для просмотра.</p>
        )}
      </form>
    </Panel>
  );
}

function ThemeView(props: { user: WorkspaceUser; onChanged: () => void | Promise<void> }) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateTheme({
      theme: String(form.get("theme")),
      accentColor: String(form.get("accentColor"))
    });
    await props.onChanged();
  }

  return (
    <Panel title="Оформление">
      <form className="stack-form compact-form" onSubmit={submit}>
        <label>
          Тема
          <select name="theme" defaultValue={props.user.theme}>
            <option value="light">Светлая</option>
            <option value="dark">Темная</option>
          </select>
        </label>
        <label>
          Акцентный цвет
          <input name="accentColor" defaultValue={props.user.accentColor} type="color" />
        </label>
        <button className="primary-button" type="submit">
          Применить тему
        </button>
      </form>
    </Panel>
  );
}

function Metric(props: { title: string; value: number }) {
  return (
    <section className="metric-card">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
    </section>
  );
}

function Panel(props: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{props.title}</h2>
        {props.actions ? <div className="panel-actions">{props.actions}</div> : null}
      </div>
      {props.children}
    </section>
  );
}

function Modal(props: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section
        aria-label={props.title}
        aria-modal="true"
        className="modal-panel"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{props.title}</h2>
          <button
            aria-label="Закрыть"
            className="icon-button"
            type="button"
            onClick={props.onClose}
          >
            ×
          </button>
        </header>
        {props.children}
      </section>
    </div>
  );
}

function ConfirmDialog(props: {
  title: string;
  body: string;
  confirmLabel: string;
  error: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Modal title={props.title} onClose={props.onCancel}>
      <div className="confirm-body">
        <p>{props.body}</p>
        {props.error ? <p className="error">{props.error}</p> : null}
        <div className="form-actions">
          <button className="danger-button solid" type="button" onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
          <button className="secondary-button" type="button" onClick={props.onCancel}>
            Отменить
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EntityList<T>(props: {
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  if (props.items.length === 0) {
    return <p className="muted">Пока пусто.</p>;
  }

  return (
    <ul className="entity-list">
      {props.items.map((item, index) => (
        <li key={index}>{props.render(item)}</li>
      ))}
    </ul>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}
