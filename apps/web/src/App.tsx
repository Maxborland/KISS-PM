"use client";

import {
  Activity,
  ArrowUpDown,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Download,
  Gauge,
  LayoutDashboard,
  Mail,
  Menu,
  Moon,
  Palette,
  PlusCircle,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserCircle,
  UserPlus,
  Users,
  type LucideIcon
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  type AccessRole,
  type AuditEvent,
  type Position,
  type WorkspaceUser
} from "./api";
import {
  getDefaultRouteId,
  findRouteByQuery,
  getRouteById,
  getRouteIdFromPathname,
  getRoutePath,
  getVisibleRouteGroups,
  getVisibleRoutes,
  type WorkspaceRouteId
} from "./routes";
import {
  useAccessRoleMutations,
  useAccessRolesQuery,
  useAuditEventsQuery,
  useHealthQuery,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  usePositionMutations,
  usePositionsQuery,
  useProfileMutation,
  useThemeMutation,
  useUserMutations,
  useUsersQuery
} from "./workspaceQueries";
import { buildWorkspaceData, type WorkspaceData } from "./workspaceData";
import {
  filterPositionsForTable,
  filterRolesForTable,
  filterUsersForTable
} from "./workspaceTables";

type SectionState = {
  canRead: boolean;
  isLoading: boolean;
  error: string | null;
};

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

const routeIcons: Record<WorkspaceRouteId, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  "access-roles": ShieldCheck,
  positions: BriefcaseBusiness,
  profile: UserCircle,
  theme: Palette
};

const plannedNavigation = [
  { label: "Проекты", icon: Gauge },
  { label: "Ресурсы", icon: Activity },
  { label: "Gantt", icon: CalendarDays },
  { label: "KPI", icon: TrendingUp }
] as const;

export function App() {
  const pathname = usePathname();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [routeSearch, setRouteSearch] = useState("");
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);
  const [quickCreateRequested, setQuickCreateRequested] = useState(false);
  const healthQuery = useHealthQuery();
  const meQuery = useMeQuery();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();

  const permissions = meQuery.data?.permissions ?? [];
  const canReadUsers = hasPermission(permissions, "tenant.users.read");
  const canReadPositions = hasPermission(permissions, "tenant.positions.read");
  const canReadAccessRoles = hasPermission(permissions, "tenant.access_profiles.read");
  const canReadAudit = hasPermission(permissions, "tenant.audit_events.read");

  const usersQuery = useUsersQuery(canReadUsers);
  const positionsQuery = usePositionsQuery(canReadPositions);
  const accessRolesQuery = useAccessRolesQuery(canReadAccessRoles);
  const auditEventsQuery = useAuditEventsQuery(canReadAudit);

  const visibleRoutes = useMemo(
    () => getVisibleRoutes(permissions),
    [permissions]
  );
  const visibleRouteGroups = useMemo(
    () => getVisibleRouteGroups(permissions),
    [permissions]
  );
  const activeRouteId = getRouteIdFromPathname(pathname);
  const activeRoute = getRouteById(activeRouteId);

  useEffect(() => {
    if (!meQuery.data) return;
    const allowedRouteId = getDefaultRouteId(activeRouteId, permissions);
    if (allowedRouteId !== activeRouteId) {
      navigateRoute(allowedRouteId);
    }
  }, [activeRouteId, meQuery.data, permissions]);

  useEffect(() => {
    if (activeRouteId !== "users") return;
    if (sessionStorage.getItem("kiss-pm.quick-create") === "user") {
      sessionStorage.removeItem("kiss-pm.quick-create");
      setQuickCreateRequested(true);
    }
  }, [activeRouteId, pathname]);

  const data = useMemo<WorkspaceData | null>(() => {
    if (!meQuery.data) return null;

    return buildWorkspaceData({
      apiStatus: healthQuery.data?.status ?? (healthQuery.isError ? "ошибка" : "проверяем"),
      me: meQuery.data.user,
      permissions,
      users: usersQuery.data,
      positions: positionsQuery.data,
      accessRoles: accessRolesQuery.data,
      auditEvents: auditEventsQuery.data
    });
  }, [
    accessRolesQuery.data?.accessRoles,
    auditEventsQuery.data?.auditEvents,
    healthQuery.data?.status,
    healthQuery.isError,
    meQuery.data,
    permissions,
    positionsQuery.data?.positions,
    usersQuery.data?.users
  ]);

  const sectionStates = {
    users: getSectionState(canReadUsers, usersQuery.isFetching, usersQuery.error),
    positions: getSectionState(
      canReadPositions,
      positionsQuery.isFetching,
      positionsQuery.error
    ),
    accessRoles: getSectionState(
      canReadAccessRoles,
      accessRolesQuery.isFetching,
      accessRolesQuery.error
    ),
    auditEvents: getSectionState(canReadAudit, auditEventsQuery.isFetching, auditEventsQuery.error)
  };

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

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");

    try {
      await loginMutation.mutateAsync({
        email: String(form.get("email")),
        password: String(form.get("password"))
      });
      navigateRoute("dashboard");
    } catch {
      setMessage("Не удалось войти. Проверь email и пароль.");
    }
  }

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    setMessage("");
    navigateRoute("dashboard");
  }

  function navigateRoute(routeId: WorkspaceRouteId) {
    router.push(getRoutePath(routeId));
  }

  function handleRouteSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const matchedRoute = findRouteByQuery(visibleRoutes, routeSearch);

    if (matchedRoute) {
      navigateRoute(matchedRoute.id);
      setRouteSearch("");
      setMessage("");
      return;
    }

    setMessage("Раздел не найден или недоступен по текущим правам");
  }

  if (meQuery.isPending) {
    return <main className="center-shell">Загружаем KISS PM...</main>;
  }

  if (meQuery.isError || !data) {
    return (
      <LoginScreen
        isSubmitting={loginMutation.isPending}
        message={message}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <main
      className={`workspace-shell theme-${data.me.theme} ${
        isSidebarCompact ? "sidebar-compact" : ""
      }`}
      style={cssVars}
    >
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-block">
            <span className="brand-mark">K</span>
            <div>
              <strong>KISS PM</strong>
              <small>Control workspace</small>
            </div>
          </div>
        </div>
        <div className="quick-create-row">
          <button
            className="quick-create-button"
            type="button"
            onClick={() => {
              sessionStorage.setItem("kiss-pm.quick-create", "user");
              setQuickCreateRequested(true);
              navigateRoute("users");
            }}
          >
            <PlusCircle aria-hidden="true" size={16} />
            <span>Быстро создать</span>
          </button>
          <button
            aria-label="Открыть профиль"
            className="sidebar-icon-button"
            type="button"
            onClick={() => navigateRoute("profile")}
          >
            <Mail aria-hidden="true" size={16} />
          </button>
        </div>
        <nav className="nav-list" aria-label="Основная навигация">
          {visibleRouteGroups.map((group) => (
            <section className="nav-group" key={group.id}>
              <p className="nav-group-label">{group.label}</p>
              {group.routes.map((route) => {
                const RouteIcon = routeIcons[route.id];

                return (
                  <button
                    key={route.id}
                    aria-current={route.id === activeRouteId ? "page" : undefined}
                    aria-label={route.label}
                    className={route.id === activeRouteId ? "nav-item active" : "nav-item"}
                    onClick={() => navigateRoute(route.id)}
                    type="button"
                  >
                    <RouteIcon aria-hidden="true" size={16} />
                    <span>{route.label}</span>
                  </button>
                );
              })}
              {group.id === "workspace"
                ? plannedNavigation.map((item) => {
                    const PlannedIcon = item.icon;

                    return (
                      <button
                        key={item.label}
                        className="nav-item is-disabled"
                        disabled
                        title="Будет в следующих фазах продукта"
                        type="button"
                      >
                        <PlannedIcon aria-hidden="true" size={16} />
                        <span>{item.label}</span>
                        <small className="soon-badge">Скоро</small>
                      </button>
                    );
                  })
                : null}
            </section>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <section className="sidebar-note" aria-label="Следующий продуктовый слой">
          <strong>Нужна следующая поверхность?</strong>
          <p>Проекты, ресурсы и control signals подключаются поверх этого RBAC-базиса.</p>
        </section>
        <div className="sidebar-user">
          <span className="avatar">{data.me.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{data.me.name}</strong>
            <small>{data.me.email}</small>
          </div>
          <button
            aria-label="Выйти из рабочего пространства"
            className="kebab-button"
            disabled={logoutMutation.isPending}
            type="button"
            onClick={handleLogout}
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <button
            aria-label={isSidebarCompact ? "Развернуть навигацию" : "Свернуть навигацию"}
            className="topbar-icon-button"
            type="button"
            onClick={() => setIsSidebarCompact((value) => !value)}
          >
            <Menu aria-hidden="true" size={17} />
          </button>
          <span className="topbar-divider" aria-hidden="true" />
          <form className="quick-search" role="search" onSubmit={handleRouteSearch}>
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="Быстрый поиск по рабочему пространству"
              placeholder="Поиск"
              value={routeSearch}
              onChange={(event) => setRouteSearch(event.target.value)}
            />
          </form>
          <div className="topbar-context">
            <div className="status-chip" title={`API: ${data.apiStatus}`}>
              <span className={data.apiStatus === "ok" ? "status-dot ok" : "status-dot"} />
              <span>{data.apiStatus}</span>
            </div>
            <button
              aria-label="Открыть оформление"
              className="topbar-icon-button"
              type="button"
              onClick={() => navigateRoute("theme")}
            >
              <Moon aria-hidden="true" size={17} />
            </button>
            <button
              aria-label="Открыть настройки профиля"
              className="topbar-icon-button"
              type="button"
              onClick={() => navigateRoute("profile")}
            >
              <Settings aria-hidden="true" size={17} />
            </button>
            <button
              aria-label="Уведомления"
              className="topbar-icon-button"
              disabled
              title="Уведомления появятся вместе с control signals"
              type="button"
            >
              <Bell aria-hidden="true" size={17} />
            </button>
            <button className="avatar-button" type="button" onClick={() => navigateRoute("profile")}>
              {data.me.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        {message ? <p className="toast">{message}</p> : null}
        {activeRouteId === "dashboard" ? (
          <Dashboard data={data} sectionStates={sectionStates} />
        ) : null}
        {activeRouteId === "users" ? (
          <UsersView
            data={data}
            openCreateRequested={quickCreateRequested}
            onQuickCreateConsumed={() => {
              setQuickCreateRequested(false);
            }}
            sectionState={sectionStates.users}
            onChanged={setMessage}
          />
        ) : null}
        {activeRouteId === "access-roles" ? (
          <RolesView
            data={data}
            sectionState={sectionStates.accessRoles}
            onChanged={setMessage}
          />
        ) : null}
        {activeRouteId === "positions" ? (
          <PositionsView
            data={data}
            sectionState={sectionStates.positions}
            onChanged={setMessage}
          />
        ) : null}
        {activeRouteId === "profile" ? (
          <ProfileView data={data} onChanged={setMessage} />
        ) : null}
        {activeRouteId === "theme" ? (
          <ThemeView user={data.me} onChanged={setMessage} />
        ) : null}
      </section>
    </main>
  );
}

function LoginScreen(props: {
  isSubmitting: boolean;
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
            <input
              autoComplete="email"
              name="email"
              defaultValue="admin@kiss-pm.local"
              type="email"
            />
          </label>
          <label>
            Пароль
            <input
              autoComplete="current-password"
              name="password"
              type="password"
            />
          </label>
          <button className="primary-button" disabled={props.isSubmitting} type="submit">
            {props.isSubmitting ? "Входим..." : "Войти"}
          </button>
          {props.message ? <p className="error">{props.message}</p> : null}
        </form>
      </section>
    </main>
  );
}

function Dashboard(props: {
  data: WorkspaceData;
  sectionStates: {
    users: SectionState;
    positions: SectionState;
    accessRoles: SectionState;
    auditEvents: SectionState;
  };
}) {
  const activeUsers = props.data.users.filter((user) => user.status === "active").length;
  const recentUsers = props.data.users.slice(0, 7);

  return (
    <section className="dashboard-grid">
      <Metric
        icon={Users}
        hint={getMetricHint(props.sectionStates.users)}
        meta="Активные учетные записи"
        title="Пользователи"
        value={props.data.users.length}
      />
      <Metric
        icon={ShieldCheck}
        hint={getMetricHint(props.sectionStates.accessRoles)}
        meta="Профили RBAC"
        title="Роли доступа"
        value={props.data.accessRoles.length}
      />
      <Metric
        icon={BriefcaseBusiness}
        hint={getMetricHint(props.sectionStates.positions)}
        meta="Оргструктура"
        title="Должности"
        value={props.data.positions.length}
      />
      <Metric
        icon={Activity}
        hint={getMetricHint(props.sectionStates.auditEvents)}
        meta={`${activeUsers} активных пользователей`}
        title="Audit events"
        value={props.data.auditEvents.length}
      />

      <section className="panel chart-panel wide-panel">
        <div className="panel-heading chart-heading">
          <div>
            <h2>Активность рабочего пространства</h2>
            <p className="panel-subtitle">
              Срез действий, изменений прав и управляемых событий за последние недели.
            </p>
          </div>
          <div className="chart-toolbar" aria-label="Фильтры активности">
            <button className="secondary-button" type="button">
              3 месяца
              <ChevronRight aria-hidden="true" size={14} />
            </button>
            <button className="secondary-button" type="button">
              Все события
              <SlidersHorizontal aria-hidden="true" size={14} />
            </button>
          </div>
        </div>
        <div className="chart-legend" aria-hidden="true">
          <span><i className="legend-dot dark" /> Управляемые действия</span>
          <span><i className="legend-dot mid" /> Пользователи</span>
          <span><i className="legend-dot soft" /> RBAC/должности</span>
        </div>
        <div className="activity-chart" role="img" aria-label="График активности рабочего пространства">
          <svg viewBox="0 0 980 260" preserveAspectRatio="none">
            <path className="chart-grid-line" d="M0 40H980M0 100H980M0 160H980M0 220H980" />
            <polyline
              className="chart-line soft"
              points="0,70 24,145 48,125 72,176 96,118 120,188 144,160 168,92 192,172 216,135 240,150 264,112 288,186 312,155 336,128 360,174 384,88 408,160 432,126 456,178 480,132 504,54 528,169 552,121 576,172 600,114 624,184 648,104 672,150 696,86 720,156 744,120 768,169 792,98 816,158 840,128 864,72 888,168 912,96 936,178 960,146 980,118"
            />
            <polyline
              className="chart-line mid"
              points="0,174 24,178 48,176 72,180 96,177 120,181 144,179 168,176 192,182 216,180 240,178 264,181 288,177 312,179 336,182 360,178 384,181 408,176 432,179 456,181 480,178 504,182 528,180 552,177 576,179 600,181 624,178 648,176 672,180 696,179 720,177 744,181 768,178 792,180 816,177 840,179 864,181 888,176 912,179 936,178 960,180 980,177"
            />
            <polyline
              className="chart-line dark"
              points="0,192 24,195 48,194 72,196 96,193 120,195 144,194 168,197 192,195 216,193 240,196 264,194 288,195 312,197 336,194 360,196 384,195 408,193 432,196 456,197 480,194 504,195 528,196 552,193 576,195 600,197 624,194 648,196 672,195 696,193 720,196 744,194 768,195 792,197 816,194 840,196 864,195 888,193 912,196 936,194 960,195 980,193"
            />
          </svg>
          <div className="chart-axis">
            <span>Фев 20</span>
            <span>Мар 9</span>
            <span>Мар 27</span>
            <span>Апр 13</span>
            <span>Апр 30</span>
            <span>Май 18</span>
          </div>
        </div>
      </section>

      <section className="panel user-records-panel wide-panel">
        <div className="panel-heading">
          <div>
            <h2>{props.data.users.length} пользователей</h2>
            <p className="panel-subtitle">
              Последние учетные записи с ролью, должностью, статусом и рабочим контекстом.
            </p>
          </div>
          <button className="secondary-button" type="button">
            <Download aria-hidden="true" size={15} />
            Экспорт
          </button>
        </div>
        <div className="table-toolbar">
          <div className="table-search" aria-label="Поиск пользователей">
            <Search aria-hidden="true" size={15} />
            <span>Поиск пользователей...</span>
          </div>
          <button className="secondary-button" type="button">
            <UserPlus aria-hidden="true" size={15} />
            Статус
          </button>
          <button className="secondary-button" type="button">
            <CalendarDays aria-hidden="true" size={15} />
            Дата входа
          </button>
          <span className="toolbar-spacer" />
          <button className="secondary-button" type="button">
            <CircleCheck aria-hidden="true" size={15} />
            RBAC
          </button>
          <button className="secondary-button" type="button">
            <ArrowUpDown aria-hidden="true" size={15} />
            Сортировка
          </button>
        </div>
        <SectionFeedback state={props.sectionStates.users} emptyLabel="Пользователи недоступны." />
        {props.sectionStates.users.canRead && !props.sectionStates.users.error ? (
          <div className="table-wrap dashboard-table-wrap">
            <table className="data-table dashboard-table" aria-label="Последние пользователи">
              <thead>
                <tr>
                  <th className="select-column">
                    <span className="checkbox-visual" aria-hidden="true" />
                  </th>
                  <th>Пользователь</th>
                  <th>Статус</th>
                  <th>Роль доступа</th>
                  <th>Должность</th>
                  <th>Контекст</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.length === 0 ? (
                  <TableEmpty colSpan={6} label="Пользователей пока нет." />
                ) : (
                  recentUsers.map((user) => {
                    const role = props.data.accessRoles.find(
                      (item) => item.id === user.accessProfileId
                    );

                    return (
                      <tr key={user.id}>
                        <td className="select-column">
                          <span className="checkbox-visual" aria-hidden="true" />
                        </td>
                        <td>
                          <span className="person-cell">
                            <span className="row-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                            <span>
                              <strong>{user.name}</strong>
                              <small>{user.email}</small>
                            </span>
                          </span>
                        </td>
                        <td>
                          <StatusPill
                            tone={user.status === "active" ? "success" : "muted"}
                            label={user.status === "active" ? "Активен" : "Отключен"}
                          />
                        </td>
                        <td>{role?.name ?? user.accessProfileId}</td>
                        <td>{user.positionName ?? "Без должности"}</td>
                        <td>
                          <span className="muted">Single workspace</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function UsersView(props: {
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
    setModal(null);
    setFormError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setFormError("");

    try {
      const input = {
        email: String(form.get("email")),
        name: String(form.get("name")),
        accessProfileId: String(form.get("accessProfileId")),
        positionId: String(form.get("positionId")) || null,
        status: String(form.get("status") ?? "active")
      };

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
          onClose={closeModal}
        >
          <form className="stack-form" key={editingUser?.id ?? "new-user"} onSubmit={submit}>
            <label>
              Имя
              <input name="name" defaultValue={editingUser?.name ?? ""} required />
            </label>
            <label>
              Email
              <input name="email" defaultValue={editingUser?.email ?? ""} required type="email" />
            </label>
            {mode === "create" ? (
              <label>
                Пароль
                <input
                  name="password"
                  placeholder="минимум 8 символов"
                  required
                  type="password"
                />
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
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
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
          isPending={isSaving}
          onCancel={closeModal}
          onConfirm={() => removeUser(deletingUser ?? null)}
          error={formError}
        />
      ) : null}
    </>
  );
}

function RolesView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageRoles = hasPermission(
    props.data.permissions,
    "tenant.access_profiles.manage"
  );
  const accessRoleMutations = useAccessRoleMutations();
  const [modal, setModal] = useState<
    | { type: "create" }
    | { type: "edit"; roleId: string }
    | { type: "delete"; roleId: string }
    | null
  >(null);
  const [formError, setFormError] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const editingRole =
    modal?.type === "edit"
      ? props.data.accessRoles.find((role) => role.id === modal.roleId)
      : null;
  const deletingRole =
    modal?.type === "delete"
      ? props.data.accessRoles.find((role) => role.id === modal.roleId)
      : null;
  const isFormOpen = modal?.type === "create" || modal?.type === "edit";
  const isSaving =
    accessRoleMutations.createAccessRole.isPending ||
    accessRoleMutations.updateAccessRole.isPending ||
    accessRoleMutations.deleteAccessRole.isPending;
  const filteredRoles = useMemo(
    () => filterRolesForTable(props.data.accessRoles, tableSearch),
    [props.data.accessRoles, tableSearch]
  );
  const totalPermissions = props.data.accessRoles.reduce(
    (sum, role) => sum + role.permissions.length,
    0
  );
  const assignedRoles = props.data.accessRoles.filter((role) =>
    props.data.users.some((user) => user.accessProfileId === role.id)
  ).length;

  function closeModal() {
    setModal(null);
    setFormError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const permissions = form.getAll("permissions").map(String);
    setFormError("");

    try {
      const input = {
        name: String(form.get("name")),
        permissions
      };

      if (editingRole) {
        await accessRoleMutations.updateAccessRole.mutateAsync({
          roleId: editingRole.id,
          input
        });
      } else {
        await accessRoleMutations.createAccessRole.mutateAsync({
          id: `access-role-${Date.now().toString(36)}`,
          ...input
        });
      }

      formElement.reset();
      setModal(null);
      props.onChanged("Роли доступа обновлены");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  async function removeRole(role: AccessRole | null) {
    if (!role) return;
    setFormError("");
    try {
      await accessRoleMutations.deleteAccessRole.mutateAsync(role.id);
      setModal(null);
      props.onChanged("Роли доступа обновлены");
    } catch (deleteError) {
      setFormError(getErrorMessage(deleteError));
    }
  }

  return (
    <>
      <Panel
        title="Роли доступа"
        subtitle="Минимальный RBAC scaffold: наборы разрешений без SaaS-админки."
        actions={
          canManageRoles ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setModal({ type: "create" })}
            >
              Создать роль доступа
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.access_profiles.manage" />
          )
        }
      >
        <div className="surface-summary-grid">
          <SummaryCard label="Всего ролей" value={props.data.accessRoles.length} />
          <SummaryCard label="Назначены" value={assignedRoles} tone="success" />
          <SummaryCard label="Разрешений в матрице" value={totalPermissions} tone="muted" />
        </div>
        <CrudToolbar
          searchLabel="Поиск ролей доступа"
          searchPlaceholder="Роль или permission key..."
          searchValue={tableSearch}
          resultCount={filteredRoles.length}
          totalCount={props.data.accessRoles.length}
          onSearchChange={setTableSearch}
        >
          <span className="toolbar-chip">
            <ShieldCheck aria-hidden="true" size={14} />
            Permission set
          </span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Раздел недоступен." />
        {props.sectionState.canRead && !props.sectionState.error ? (
          <div className="table-wrap">
            <table className="data-table" aria-label="Роли доступа">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Права</th>
                  <th>Назначено</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.length === 0 ? (
                  <TableEmpty
                    colSpan={4}
                    label={
                      props.data.accessRoles.length === 0
                        ? "Ролей доступа пока нет."
                        : "По фильтру ничего не найдено."
                    }
                  />
                ) : (
                  filteredRoles.map((role) => {
                    const assignedUsers = props.data.users.filter(
                      (user) => user.accessProfileId === role.id
                    ).length;

                    return (
                      <tr key={role.id}>
                        <td>
                          <span className="entity-name-cell">
                            <span className="row-avatar">
                              {role.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span>
                              <strong>{role.name}</strong>
                              <small>{role.id}</small>
                            </span>
                          </span>
                        </td>
                        <td>
                          <PermissionList permissions={role.permissions} />
                        </td>
                        <td>{assignedUsers}</td>
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
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
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
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
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
          isPending={isSaving}
          onCancel={closeModal}
          onConfirm={() => removeRole(deletingRole ?? null)}
          error={formError}
        />
      ) : null}
    </>
  );
}

function PositionsView(props: {
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
    setModal(null);
    setFormError("");
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

    try {
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
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingPosition?.id ?? "new-position"}
            onSubmit={submit}
          >
            <label>
              Название должности
              <input name="name" defaultValue={editingPosition?.name ?? ""} required />
            </label>
            <label>
              Описание
              <input name="description" defaultValue={editingPosition?.description ?? ""} />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
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
          isPending={isSaving}
          onCancel={closeModal}
          onConfirm={() => removePosition(deletingPosition ?? null)}
          error={formError}
        />
      ) : null}
    </>
  );
}

function ProfileView(props: {
  data: WorkspaceData;
  onChanged: (message: string) => void;
}) {
  const canUpdate = hasPermission(props.data.permissions, "profile.update");
  const profileMutation = useProfileMutation();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await profileMutation.mutateAsync({
      name: String(form.get("name")),
      phone: String(form.get("phone")),
      telegram: String(form.get("telegram"))
    });
    props.onChanged("Профиль обновлен");
  }

  return (
    <Panel
      title="Профиль пользователя"
      subtitle="Поля текущего пользователя без tenant-management слоя."
    >
      <div className="settings-layout">
        <form className="stack-form settings-form" onSubmit={submit}>
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
          {profileMutation.error ? (
            <p className="error">{getErrorMessage(profileMutation.error)}</p>
          ) : null}
          {canUpdate ? (
            <button className="primary-button" disabled={profileMutation.isPending} type="submit">
              Сохранить профиль
            </button>
          ) : (
            <p className="muted">Профиль доступен только для просмотра.</p>
          )}
        </form>
        <aside className="settings-aside">
          <div className="profile-preview">
            <span className="avatar large">{props.data.me.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{props.data.me.name}</strong>
              <small>{props.data.me.email}</small>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Должность</dt>
              <dd>{props.data.me.positionName ?? "Без должности"}</dd>
            </div>
            <div>
              <dt>Статус</dt>
              <dd>
                <StatusPill
                  tone={props.data.me.status === "active" ? "success" : "muted"}
                  label={props.data.me.status === "active" ? "Активен" : "Отключен"}
                />
              </dd>
            </div>
            <div>
              <dt>Права</dt>
              <dd>{props.data.permissions.length}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </Panel>
  );
}

function ThemeView(props: {
  user: WorkspaceUser;
  onChanged: (message: string) => void;
}) {
  const themeMutation = useThemeMutation();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await themeMutation.mutateAsync({
      theme: String(form.get("theme")),
      accentColor: String(form.get("accentColor"))
    });
    props.onChanged("Тема обновлена");
  }

  return (
    <Panel
      title="Оформление"
      subtitle="Личная настройка темы и акцента для рабочего интерфейса."
    >
      <div className="settings-layout">
        <form className="stack-form settings-form" onSubmit={submit}>
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
          {themeMutation.error ? (
            <p className="error">{getErrorMessage(themeMutation.error)}</p>
          ) : null}
          <button className="primary-button" disabled={themeMutation.isPending} type="submit">
            Применить тему
          </button>
        </form>
        <aside className="theme-preview" style={{ "--preview-accent": props.user.accentColor } as React.CSSProperties}>
          <div className="theme-preview-topbar">
            <span />
            <span />
            <span />
          </div>
          <div className="theme-preview-body">
            <strong>KISS PM</strong>
            <p>Плотная рабочая поверхность с выбранным акцентом.</p>
            <span className="preview-accent-line" />
          </div>
        </aside>
      </div>
    </Panel>
  );
}

function SummaryCard(props: {
  label: string;
  value: number;
  tone?: "default" | "success" | "muted";
}) {
  return (
    <section className={`summary-card ${props.tone ?? "default"}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </section>
  );
}

function CrudToolbar(props: {
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  resultCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="crud-toolbar">
      <label className="crud-search">
        <Search aria-hidden="true" size={15} />
        <span className="sr-only">{props.searchLabel}</span>
        <input
          aria-label={props.searchLabel}
          placeholder={props.searchPlaceholder}
          value={props.searchValue}
          onChange={(event) => props.onSearchChange(event.target.value)}
        />
      </label>
      <div className="crud-toolbar-meta">
        <span className="toolbar-chip">
          {props.resultCount} из {props.totalCount}
        </span>
        {props.children}
      </div>
    </div>
  );
}

function Metric(props: {
  icon: LucideIcon;
  title: string;
  value: number;
  meta: string;
  hint: string;
}) {
  const Icon = props.icon;

  return (
    <section className="metric-card">
      <span className="metric-icon">
        <Icon aria-hidden="true" size={17} />
      </span>
      <span className="metric-title">{props.title}</span>
      <div className="metric-value-row">
        <strong>{props.value}</strong>
        <span className="metric-delta">{props.meta}</span>
      </div>
      <small>{props.hint}</small>
    </section>
  );
}

function Panel(props: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{props.title}</h2>
          {props.subtitle ? <p className="panel-subtitle">{props.subtitle}</p> : null}
        </div>
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
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement;
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );

    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        props.onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [props]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section
        ref={panelRef}
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
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Modal title={props.title} onClose={props.onCancel}>
      <div className="confirm-body">
        <p>{props.body}</p>
        {props.error ? <p className="error">{props.error}</p> : null}
        <div className="form-actions">
          <button
            className="danger-button solid"
            disabled={props.isPending}
            type="button"
            onClick={props.onConfirm}
          >
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
  emptyLabel: string;
  render: (item: T) => React.ReactNode;
}) {
  if (props.items.length === 0) {
    return <p className="empty-state">{props.emptyLabel}</p>;
  }

  return (
    <ul className="entity-list">
      {props.items.map((item, index) => (
        <li key={index}>{props.render(item)}</li>
      ))}
    </ul>
  );
}

function PermissionList({ permissions }: { permissions: string[] }) {
  if (permissions.length === 0) {
    return <span className="muted">Права не назначены</span>;
  }

  return (
    <span className="chip-list">
      {permissions.map((permission) => (
        <span className="permission-chip" key={permission}>
          {permission}
        </span>
      ))}
    </span>
  );
}

function StatusPill(props: { label: string; tone: "success" | "muted" }) {
  return <span className={`status-pill ${props.tone}`}>{props.label}</span>;
}

function DisabledAction({ reason }: { reason: string }) {
  return (
    <button className="secondary-button" disabled title={reason} type="button">
      Нет прав
    </button>
  );
}

function SectionFeedback(props: { state: SectionState; emptyLabel: string }) {
  if (!props.state.canRead) {
    return <p className="empty-state">{props.emptyLabel}</p>;
  }

  if (props.state.isLoading) {
    return <p className="loading-state">Загружаем данные...</p>;
  }

  if (props.state.error) {
    return <p className="error">{props.state.error}</p>;
  }

  return null;
}

function TableEmpty(props: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="empty-cell" colSpan={props.colSpan}>
        {props.label}
      </td>
    </tr>
  );
}

function getSectionState(
  canRead: boolean,
  isLoading: boolean,
  error: unknown
): SectionState {
  return {
    canRead,
    isLoading: canRead && isLoading,
    error: canRead && error ? getErrorMessage(error) : null
  };
}

function getMetricHint(state: SectionState): string {
  if (!state.canRead) return "Нет права на чтение";
  if (state.isLoading) return "Обновляем";
  if (state.error) return "Ошибка загрузки";
  return "Актуально";
}

function hasPermission(permissions: readonly string[], permission: string): boolean {
  return permissions.includes(permission);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}
