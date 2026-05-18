"use client";

import {
  Activity,
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutDashboard,
  Mail,
  Menu,
  Moon,
  Palette,
  PlusCircle,
  Search,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  ApiError,
  type AccessRole,
  type AuditEvent,
  type CustomFieldDefinition,
  type Position,
  type ProjectTemplate,
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
  useCustomFieldsQuery,
  useHealthQuery,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  usePositionMutations,
  usePositionsQuery,
  useProjectTemplatesQuery,
  useProfileMutation,
  useThemeMutation,
  useUserMutations,
  useUsersQuery,
  useWorkspaceConfigMutations
} from "./workspaceQueries";
import { buildWorkspaceData, type WorkspaceData } from "./workspaceData";
import {
  type FormErrors,
  getFieldErrorId,
  getNextFocusTrapIndex,
  hasFormErrors,
  validateCustomFieldForm,
  validatePositionForm,
  validateProjectTemplateForm,
  validateRoleForm,
  validateUserForm
} from "./workspaceForms";
import {
  filterPositionsForTable,
  filterRolesForTable,
  filterUsersForTable
} from "./workspaceTables";
import {
  buildAuditChangeSummary,
  buildAuditPreviewRows
} from "./workspaceDashboard";

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
  { value: "tenant.audit_events.read", label: "Читать аудит" },
  { value: "tenant.workspace_config.read", label: "Читать настройки workspace" },
  { value: "tenant.workspace_config.manage", label: "Управлять настройками workspace" },
  { value: "profile.read", label: "Читать профиль" },
  { value: "profile.update", label: "Обновлять профиль" },
  { value: "workspace.theme.manage", label: "Управлять темой" }
] as const;

const routeIcons: Record<WorkspaceRouteId, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  "access-roles": ShieldCheck,
  positions: BriefcaseBusiness,
  audit: Activity,
  settings: Settings,
  profile: UserCircle,
  theme: Palette
};

const navigationFocusRestoreStorageKey = "kiss-pm.restore-navigation-focus";

export function App() {
  const pathname = usePathname();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [routeSearch, setRouteSearch] = useState("");
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [quickCreateRequested, setQuickCreateRequested] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const navigationToggleRef = useRef<HTMLButtonElement | null>(null);
  const navigationFocusRestoreTokenRef = useRef(0);
  const navigationFocusRestoreTimersRef = useRef<number[]>([]);
  const healthQuery = useHealthQuery();
  const meQuery = useMeQuery();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();

  const permissions = meQuery.data?.permissions ?? [];
  const canReadUsers = hasPermission(permissions, "tenant.users.read");
  const canReadPositions = hasPermission(permissions, "tenant.positions.read");
  const canReadAccessRoles = hasPermission(permissions, "tenant.access_profiles.read");
  const canReadAudit = hasPermission(permissions, "tenant.audit_events.read");
  const canReadWorkspaceConfig = hasPermission(
    permissions,
    "tenant.workspace_config.read"
  );

  const usersQuery = useUsersQuery(canReadUsers);
  const positionsQuery = usePositionsQuery(canReadPositions);
  const accessRolesQuery = useAccessRolesQuery(canReadAccessRoles);
  const auditEventsQuery = useAuditEventsQuery(canReadAudit);
  const customFieldsQuery = useCustomFieldsQuery(canReadWorkspaceConfig);
  const projectTemplatesQuery = useProjectTemplatesQuery(canReadWorkspaceConfig);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const syncViewport = () => {
      const isNarrow = mediaQuery.matches;
      const shouldMoveFocusFromSidebar = isNarrow && sidebarRef.current?.contains(document.activeElement);

      setIsNarrowViewport(isNarrow);
      if (isNarrow) {
        if (shouldMoveFocusFromSidebar) {
          queueNavigationToggleFocus();
        }
      } else {
        cancelNavigationToggleFocusRestore();
        setIsMobileSidebarOpen(false);
      }
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    return () => {
      cancelNavigationToggleFocusRestore({ clearStorage: false });
    };
  }, []);

  useEffect(() => {
    if (!isNarrowViewport || !isMobileSidebarOpen) return;

    const firstFocusable = getFocusableElements(sidebarRef.current)[0];
    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileSidebar();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(sidebarRef.current);
      const activeIndex = focusable.findIndex((element) => element === document.activeElement);
      const nextIndex = getNextFocusTrapIndex(activeIndex, focusable.length, event.shiftKey);
      if (nextIndex === null) return;

      event.preventDefault();
      focusable[nextIndex]?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSidebarOpen, isNarrowViewport]);

  useEffect(() => {
    if (!isNarrowViewport || isMobileSidebarOpen) return;
    if (sessionStorage.getItem(navigationFocusRestoreStorageKey) !== "1") return;

    restoreNavigationToggleFocus();
  }, [isMobileSidebarOpen, isNarrowViewport, pathname]);

  const data = useMemo<WorkspaceData | null>(() => {
    if (!meQuery.data) return null;

    return buildWorkspaceData({
      apiStatus: healthQuery.data?.status ?? (healthQuery.isError ? "ошибка" : "проверяем"),
      me: meQuery.data.user,
      permissions,
      users: usersQuery.data,
      positions: positionsQuery.data,
      accessRoles: accessRolesQuery.data,
      auditEvents: auditEventsQuery.data,
      customFields: customFieldsQuery.data,
      projectTemplates: projectTemplatesQuery.data
    });
  }, [
    accessRolesQuery.data?.accessRoles,
    auditEventsQuery.data?.auditEvents,
    healthQuery.data?.status,
    healthQuery.isError,
    meQuery.data,
    permissions,
    customFieldsQuery.data?.customFields,
    projectTemplatesQuery.data?.projectTemplates,
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
    auditEvents: getSectionState(canReadAudit, auditEventsQuery.isFetching, auditEventsQuery.error),
    workspaceConfig: getSectionState(
      canReadWorkspaceConfig,
      customFieldsQuery.isFetching || projectTemplatesQuery.isFetching,
      customFieldsQuery.error ?? projectTemplatesQuery.error
    )
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
    const shouldRestoreNavigationFocus = isNarrowViewport && isMobileSidebarOpen;
    if (shouldRestoreNavigationFocus) {
      if (routeId !== activeRouteId) {
        closeMobileSidebar({ deferFocusRestore: true });
      } else {
        closeMobileSidebar();
      }
    }
    router.push(getRoutePath(routeId));
  }

  function closeMobileSidebar(options: { deferFocusRestore?: boolean } = {}) {
    if (isNarrowViewport && isMobileSidebarOpen) {
      flushSync(() => {
        setIsMobileSidebarOpen(false);
      });
      if (options.deferFocusRestore) {
        sessionStorage.setItem(navigationFocusRestoreStorageKey, "1");
        return;
      }
      queueNavigationToggleFocus();
      return;
    }

    setIsMobileSidebarOpen(false);
  }

  function handleNavigationToggle() {
    if (isNarrowViewport) {
      cancelNavigationToggleFocusRestore();
      setIsMobileSidebarOpen((value) => !value);
      return;
    }

    setIsSidebarCompact((value) => !value);
  }

  function queueNavigationToggleFocus() {
    sessionStorage.setItem(navigationFocusRestoreStorageKey, "1");
    restoreNavigationToggleFocus();
  }

  function restoreNavigationToggleFocus() {
    cancelNavigationToggleFocusRestore({ clearStorage: false });
    const token = navigationFocusRestoreTokenRef.current + 1;
    navigationFocusRestoreTokenRef.current = token;
    const delays = [0, 80, 200, 400, 800, 1200];

    delays.forEach((delay) => {
      const timerId = window.setTimeout(() => {
        if (navigationFocusRestoreTokenRef.current !== token) return;
        if (!window.matchMedia("(max-width: 900px)").matches) return;

        const navigationToggle = navigationToggleRef.current;
        navigationToggle?.focus();
        if (document.activeElement === navigationToggle) {
          cancelNavigationToggleFocusRestore();
        }
      }, delay);
      navigationFocusRestoreTimersRef.current.push(timerId);
    });
  }

  function cancelNavigationToggleFocusRestore(options: { clearStorage?: boolean } = {}) {
    const clearStorage = options.clearStorage ?? true;
    navigationFocusRestoreTokenRef.current += 1;
    navigationFocusRestoreTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    navigationFocusRestoreTimersRef.current = [];

    if (clearStorage) {
      sessionStorage.removeItem(navigationFocusRestoreStorageKey);
    }
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

  const navigationToggleLabel = isNarrowViewport
    ? isMobileSidebarOpen
      ? "Закрыть навигацию"
      : "Открыть навигацию"
    : isSidebarCompact
      ? "Развернуть навигацию"
      : "Свернуть навигацию";

  return (
    <main
      className={`workspace-shell theme-${data.me.theme} ${
        isSidebarCompact ? "sidebar-compact" : ""
      } ${isMobileSidebarOpen ? "mobile-sidebar-open" : ""}`}
      style={cssVars}
    >
      {isMobileSidebarOpen ? (
        <button
          aria-label="Закрыть навигацию"
          className="sidebar-backdrop"
          type="button"
          onClick={() => closeMobileSidebar()}
        />
      ) : null}
      <aside
        aria-hidden={isNarrowViewport && !isMobileSidebarOpen ? "true" : undefined}
        className="sidebar"
        inert={isNarrowViewport && !isMobileSidebarOpen ? true : undefined}
        ref={sidebarRef}
      >
        <div className="brand-row">
          <div className="brand-block">
            <span className="brand-mark">K</span>
            <div>
              <strong>KISS PM</strong>
              <small>Рабочее пространство</small>
            </div>
          </div>
        </div>
        <div className="quick-create-row">
          <button
            className="quick-create-button"
            title="Быстро создать пользователя"
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
            title="Открыть профиль"
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
                    title={route.label}
                    onClick={() => navigateRoute(route.id)}
                    type="button"
                  >
                    <RouteIcon aria-hidden="true" size={16} />
                    <span>{route.label}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <section className="sidebar-note" aria-label="Текущий слой продукта">
          <strong>Текущий слой</strong>
          <p>Вход, пользователи, роли доступа, должности, профиль, тема и события аудита.</p>
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

      <section
        className="content-shell"
        inert={isNarrowViewport && isMobileSidebarOpen ? true : undefined}
      >
        <header className="topbar">
          <button
            aria-label={navigationToggleLabel}
            className="topbar-icon-button"
            ref={navigationToggleRef}
            type="button"
            onClick={handleNavigationToggle}
          >
            <Menu aria-hidden="true" size={17} />
          </button>
          <span className="topbar-divider" aria-hidden="true" />
          <form className="quick-search" role="search" onSubmit={handleRouteSearch}>
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="Переход по разделам"
              placeholder="Перейти в раздел"
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
          <Dashboard
            data={data}
            sectionStates={sectionStates}
          />
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
        {activeRouteId === "audit" ? (
          <AuditView
            data={data}
            sectionState={sectionStates.auditEvents}
          />
        ) : null}
        {activeRouteId === "settings" ? (
          <WorkspaceSettingsView
            data={data}
            sectionState={sectionStates.workspaceConfig}
            onChanged={setMessage}
          />
        ) : null}
        {activeRouteId === "profile" ? (
          <ProfileView
            data={data}
            onChanged={setMessage}
          />
        ) : null}
        {activeRouteId === "theme" ? (
          <ThemeView
            user={data.me}
            onChanged={setMessage}
          />
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
  const dashboardUsers = props.data.users.slice(0, 7);
  const auditRows = buildAuditPreviewRows(props.data.auditEvents, props.data.users);

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
        meta="Профили доступа"
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
        title="События аудита"
        value={props.data.auditEvents.length}
      />

      <section className="panel audit-preview-panel wide-panel">
        <div className="panel-heading audit-heading">
          <div>
            <h2>Рабочее пространство</h2>
            <p className="panel-subtitle">
              Базовый контур рабочего пространства: вход, пользователи, роли,
              должности, профиль, тема и журнал аудита.
            </p>
          </div>
        </div>
        <section className="audit-preview" aria-label="Последние события аудита">
          <h3>Последние события аудита</h3>
          <SectionFeedback
            state={props.sectionStates.auditEvents}
            emptyLabel="События аудита недоступны для текущей роли."
          />
          {props.sectionStates.auditEvents.canRead && !props.sectionStates.auditEvents.error ? (
            auditRows.length > 0 ? (
              <ol className="audit-list">
                {auditRows.map((event) => (
                  <li className="audit-list-item" key={event.id}>
                    <span className="audit-event-marker" aria-hidden="true" />
                    <div>
                      <strong>{event.actionLabel}</strong>
                      <small>
                        {event.actorName} · {event.createdAtLabel}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state">Событий аудита пока нет.</p>
            )
          ) : null}
        </section>
      </section>

      <section className="panel user-records-panel wide-panel">
        <div className="panel-heading">
          <div>
            <h2>{props.data.users.length} пользователей</h2>
            <p className="panel-subtitle">
              Учетные записи с ролью, должностью, статусом и рабочим контекстом.
            </p>
          </div>
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
                {dashboardUsers.length === 0 ? (
                  <TableEmpty colSpan={6} label="Пользователей пока нет." />
                ) : (
                  dashboardUsers.map((user) => {
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
                          <span className="muted">Текущее рабочее пространство</span>
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
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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
    if (isSaving) return;
    setModal(null);
    setFormError("");
    setFieldErrors({});
    setIsPasswordVisible(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setFormError("");
    setFieldErrors({});

    try {
      const input = {
        email: String(form.get("email")),
        name: String(form.get("name")),
        accessProfileId: String(form.get("accessProfileId")),
        positionId: String(form.get("positionId")) || null,
        status: String(form.get("status") ?? "active")
      };
      const validationErrors = validateUserForm(
        {
          ...input,
          password: String(form.get("password") ?? "")
        },
        mode
      );

      if (hasFormErrors(validationErrors)) {
        setFieldErrors(validationErrors);
        return;
      }

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
      setFieldErrors({});
      setIsPasswordVisible(false);
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
          description="Заполните обязательные поля. Изменения будут проверены правами и записаны в аудит."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingUser?.id ?? "new-user"}
            noValidate
            onSubmit={submit}
          >
            <label htmlFor="user-form-name">
              Имя
              <input
                id="user-form-name"
                name="name"
                aria-describedby={
                  fieldErrors.name ? getFieldErrorId("user-form", "name") : undefined
                }
                aria-invalid={Boolean(fieldErrors.name)}
                data-autofocus
                defaultValue={editingUser?.name ?? ""}
                required
              />
              <FieldError formId="user-form" field="name" errors={fieldErrors} />
            </label>
            <label htmlFor="user-form-email">
              Email
              <input
                id="user-form-email"
                name="email"
                aria-describedby={
                  fieldErrors.email ? getFieldErrorId("user-form", "email") : undefined
                }
                aria-invalid={Boolean(fieldErrors.email)}
                defaultValue={editingUser?.email ?? ""}
                required
                type="email"
              />
              <FieldError formId="user-form" field="email" errors={fieldErrors} />
            </label>
            {mode === "create" ? (
              <label htmlFor="user-form-password">
                Пароль
                <span className="password-field">
                  <input
                    id="user-form-password"
                    name="password"
                    aria-label="Пароль"
                    aria-describedby={
                      fieldErrors.password
                        ? getFieldErrorId("user-form", "password")
                        : "user-form-password-help"
                    }
                    aria-invalid={Boolean(fieldErrors.password)}
                    placeholder="минимум 8 символов"
                    required
                    type={isPasswordVisible ? "text" : "password"}
                  />
                  <button
                    aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
                    className="password-toggle"
                    type="button"
                    onClick={() => setIsPasswordVisible((value) => !value)}
                  >
                    {isPasswordVisible ? (
                      <EyeOff aria-hidden="true" size={16} />
                    ) : (
                      <Eye aria-hidden="true" size={16} />
                    )}
                  </button>
                </span>
                <small id="user-form-password-help" className="field-help">
                  Минимум 8 символов.
                </small>
                <FieldError formId="user-form" field="password" errors={fieldErrors} />
              </label>
            ) : null}
            <label htmlFor="user-form-accessProfileId">
              Роль доступа
              {isEditingSelf && editingUser ? (
                <>
                  <input name="accessProfileId" type="hidden" value={editingUser.accessProfileId} />
                  <input
                    id="user-form-accessProfileId"
                    readOnly
                    value={
                      props.data.accessRoles.find(
                        (role) => role.id === editingUser.accessProfileId
                      )?.name ?? editingUser.accessProfileId
                    }
                  />
                </>
              ) : (
                <select
                  id="user-form-accessProfileId"
                  name="accessProfileId"
                  aria-describedby={
                    fieldErrors.accessProfileId
                      ? getFieldErrorId("user-form", "accessProfileId")
                      : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.accessProfileId)}
                  defaultValue={editingUser?.accessProfileId}
                  required
                >
                  {props.data.accessRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              )}
              <FieldError formId="user-form" field="accessProfileId" errors={fieldErrors} />
            </label>
            <label htmlFor="user-form-positionId">
              Должность
              <select
                id="user-form-positionId"
                name="positionId"
                defaultValue={editingUser?.positionId ?? ""}
              >
                <option value="">Без должности</option>
                {props.data.positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="user-form-status">
              Статус
              {isEditingSelf ? (
                <>
                  <input name="status" type="hidden" value="active" />
                  <input id="user-form-status" readOnly value="Активен" />
                </>
              ) : (
                <select
                  id="user-form-status"
                  name="status"
                  aria-describedby={
                    fieldErrors.status ? getFieldErrorId("user-form", "status") : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.status)}
                  defaultValue={editingUser?.status ?? "active"}
                >
                  <option value="active">Активен</option>
                  <option value="inactive">Отключен</option>
                </select>
              )}
              <FieldError formId="user-form" field="status" errors={fieldErrors} />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving
                  ? "Сохраняем..."
                  : mode === "edit"
                    ? "Сохранить пользователя"
                    : "Создать пользователя"}
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
          title="Удалить пользователя"
          body={`Пользователь "${deletingUser?.name ?? "выбранный пользователь"}" будет удален из рабочего пространства.`}
          confirmLabel="Удалить пользователя"
          pendingLabel="Удаляем пользователя..."
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
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
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
    if (isSaving) return;
    setModal(null);
    setFormError("");
    setFieldErrors({});
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const permissions = form.getAll("permissions").map(String);
    setFormError("");
    setFieldErrors({});

    try {
      const input = {
        name: String(form.get("name")),
        permissions
      };
      const validationErrors = validateRoleForm(input);

      if (hasFormErrors(validationErrors)) {
        setFieldErrors(validationErrors);
        return;
      }

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
      setFieldErrors({});
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
          description="Роль определяет доступные действия пользователя в рабочем пространстве."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingRole?.id ?? "new-role"}
            noValidate
            onSubmit={submit}
          >
            <label htmlFor="role-form-name">
              Название роли
              <input
                id="role-form-name"
                name="name"
                aria-describedby={
                  fieldErrors.name ? getFieldErrorId("role-form", "name") : undefined
                }
                aria-invalid={Boolean(fieldErrors.name)}
                data-autofocus
                defaultValue={editingRole?.name ?? ""}
                required
              />
              <FieldError formId="role-form" field="name" errors={fieldErrors} />
            </label>
            <fieldset
              className="permission-grid"
              aria-describedby={
                fieldErrors.permissions
                  ? getFieldErrorId("role-form", "permissions")
                  : "role-form-permissions-help"
              }
              aria-invalid={Boolean(fieldErrors.permissions)}
            >
              <legend>Права роли</legend>
              <p id="role-form-permissions-help" className="field-help">
                Минимальный профиль должен иметь хотя бы одно право.
              </p>
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
              <FieldError formId="role-form" field="permissions" errors={fieldErrors} />
            </fieldset>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving
                  ? "Сохраняем..."
                  : editingRole
                    ? "Сохранить роль доступа"
                    : "Создать роль доступа"}
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
          title="Удалить роль доступа"
          body={`Роль "${deletingRole?.name ?? "выбранная роль"}" будет удалена. Это возможно только если она не назначена пользователям.`}
          confirmLabel="Удалить роль доступа"
          pendingLabel="Удаляем роль..."
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

function AuditView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
}) {
  const auditRows = buildAuditPreviewRows(props.data.auditEvents, props.data.users, 200);

  return (
    <Panel
      title="Аудит"
      subtitle="Проверяемый журнал административных действий и изменений настроек рабочего пространства."
      actions={
        <span className="toolbar-chip">
          <Activity aria-hidden="true" size={14} />
          {props.data.auditEvents.length} событий
        </span>
      }
    >
      <SectionFeedback state={props.sectionState} emptyLabel="Аудит недоступен для текущей роли." />
      {props.sectionState.canRead && !props.sectionState.error ? (
        <div className="table-wrap">
          <table className="data-table audit-table" aria-label="События аудита">
            <thead>
              <tr>
                <th>Событие</th>
                <th>Пользователь</th>
                <th>Рабочий поток</th>
                <th>Сущность</th>
                <th>Изменение</th>
                <th>ID корреляции</th>
                <th>Время</th>
              </tr>
            </thead>
            <tbody>
              {props.data.auditEvents.length === 0 ? (
                <TableEmpty colSpan={7} label="Событий аудита пока нет." />
              ) : (
                props.data.auditEvents.map((event) => {
                  const preview = auditRows.find((row) => row.id === event.id);
                  const actor = props.data.users.find(
                    (user) => user.id === event.actorUserId
                  );
                  const changeSummary = buildAuditChangeSummary(event);

                  return (
                    <tr key={event.id}>
                      <td>
                        <span className="entity-name-cell">
                          <span className="row-avatar">A</span>
                          <span>
                            <strong>{preview?.actionLabel ?? event.actionType}</strong>
                            <small>{event.actionType}</small>
                          </span>
                        </span>
                      </td>
                      <td>{actor?.name ?? event.actorUserId}</td>
                      <td>{event.sourceWorkflow ?? "Не задан"}</td>
                      <td>
                        {event.sourceEntity
                          ? `${event.sourceEntity.type}: ${event.sourceEntity.id}`
                          : "Не задана"}
                      </td>
                      <td>
                        <span className="entity-name-cell">
                          <span>
                            <strong>{changeSummary.title}</strong>
                            <small>{changeSummary.detail}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <code className="inline-code">{event.correlationId}</code>
                      </td>
                      <td>{preview?.createdAtLabel ?? formatDate(event.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}

function WorkspaceSettingsView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageConfig = hasPermission(
    props.data.permissions,
    "tenant.workspace_config.manage"
  );
  const configMutations = useWorkspaceConfigMutations();
  const [modal, setModal] = useState<
    | { type: "create-field" }
    | { type: "edit-field"; fieldId: string }
    | { type: "create-template" }
    | { type: "edit-template"; templateId: string }
    | null
  >(null);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [fieldSearch, setFieldSearch] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const editingField =
    modal?.type === "edit-field"
      ? props.data.customFields.find((field) => field.id === modal.fieldId)
      : null;
  const editingTemplate =
    modal?.type === "edit-template"
      ? props.data.projectTemplates.find((template) => template.id === modal.templateId)
      : null;
  const isFieldFormOpen = modal?.type === "create-field" || modal?.type === "edit-field";
  const isTemplateFormOpen =
    modal?.type === "create-template" || modal?.type === "edit-template";
  const isSaving =
    configMutations.createCustomField.isPending ||
    configMutations.updateCustomField.isPending ||
    configMutations.createProjectTemplate.isPending ||
    configMutations.updateProjectTemplate.isPending;
  const filteredFields = useMemo(
    () => filterCustomFields(props.data.customFields, fieldSearch),
    [props.data.customFields, fieldSearch]
  );
  const filteredTemplates = useMemo(
    () => filterProjectTemplates(props.data.projectTemplates, templateSearch),
    [props.data.projectTemplates, templateSearch]
  );
  const activeFields = props.data.customFields.filter((field) => field.status === "active").length;
  const activeTemplates = props.data.projectTemplates.filter(
    (template) => template.status === "active"
  ).length;

  function closeModal() {
    if (isSaving) return;
    setModal(null);
    setFormError("");
    setFieldErrors({});
  }

  async function submitCustomField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const systemKey = String(form.get("systemKey"));
    const input = {
      systemKey,
      tenantLabel: String(form.get("tenantLabel")),
      targetEntity: "project" as const,
      fieldType: String(form.get("fieldType")) as CustomFieldDefinition["fieldType"],
      required: form.get("required") === "on",
      status: String(form.get("status")) as CustomFieldDefinition["status"]
    };
    const validationErrors = validateCustomFieldForm(input);
    setFormError("");
    setFieldErrors({});

    if (hasFormErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      return;
    }

    try {
      if (editingField) {
        await configMutations.updateCustomField.mutateAsync({
          fieldId: editingField.id,
          input
        });
      } else {
        await configMutations.createCustomField.mutateAsync({
          id: `field-${Date.now().toString(36)}`,
          ...input
        });
      }

      formElement.reset();
      setModal(null);
      setFormError("");
      setFieldErrors({});
      props.onChanged("Пользовательские поля обновлены");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  async function submitProjectTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const systemKey = String(form.get("systemKey"));
    const input = {
      systemKey,
      tenantLabel: String(form.get("tenantLabel")),
      description: String(form.get("description") ?? ""),
      status: String(form.get("status")) as ProjectTemplate["status"]
    };
    const validationErrors = validateProjectTemplateForm(input);
    setFormError("");
    setFieldErrors({});

    if (hasFormErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      return;
    }

    try {
      if (editingTemplate) {
        await configMutations.updateProjectTemplate.mutateAsync({
          templateId: editingTemplate.id,
          input
        });
      } else {
        await configMutations.createProjectTemplate.mutateAsync({
          id: `template-${Date.now().toString(36)}`,
          ...input
        });
      }

      formElement.reset();
      setModal(null);
      setFormError("");
      setFieldErrors({});
      props.onChanged("Шаблоны проектов обновлены");
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  return (
    <>
      <div className="settings-grid">
        <Panel
          title="Пользовательские поля"
          subtitle="Названия рабочего пространства поверх стабильных системных ключей. Пока применяются к проектам."
          actions={
            canManageConfig ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setModal({ type: "create-field" })}
              >
                Создать поле
              </button>
            ) : (
              <DisabledAction reason="Нужно право tenant.workspace_config.manage" />
            )
          }
        >
          <div className="surface-summary-grid">
            <SummaryCard label="Всего полей" value={props.data.customFields.length} />
            <SummaryCard label="Активные" value={activeFields} tone="success" />
            <SummaryCard
              label="Черновики"
              value={props.data.customFields.length - activeFields}
              tone="muted"
            />
          </div>
          <CrudToolbar
            searchLabel="Поиск пользовательских полей"
            searchPlaceholder="Ключ, название, тип..."
            searchValue={fieldSearch}
            resultCount={filteredFields.length}
            totalCount={props.data.customFields.length}
            onSearchChange={setFieldSearch}
          >
            <span className="toolbar-chip">Системный ключ неизменяем</span>
          </CrudToolbar>
          <SectionFeedback state={props.sectionState} emptyLabel="Настройки недоступны." />
          {props.sectionState.canRead && !props.sectionState.error ? (
            <div className="table-wrap">
              <table className="data-table" aria-label="Пользовательские поля">
                <thead>
                  <tr>
                    <th>Поле</th>
                    <th>Тип</th>
                    <th>Обязательное</th>
                    <th>Статус</th>
                    <th>Обновлено</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFields.length === 0 ? (
                    <TableEmpty colSpan={6} label="Пользовательских полей пока нет." />
                  ) : (
                    filteredFields.map((field) => (
                      <tr key={field.id}>
                        <td>
                          <span className="entity-name-cell">
                            <span className="row-avatar">F</span>
                            <span>
                              <strong>{field.tenantLabel}</strong>
                              <small>{field.systemKey}</small>
                            </span>
                          </span>
                        </td>
                        <td>{getFieldTypeLabel(field.fieldType)}</td>
                        <td>{field.required ? "Да" : "Нет"}</td>
                        <td>
                          <StatusPill
                            tone={field.status === "active" ? "success" : "muted"}
                            label={field.status === "active" ? "Активно" : "Черновик"}
                          />
                        </td>
                        <td>{formatDate(field.updatedAt)}</td>
                        <td>
                          {canManageConfig ? (
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => setModal({ type: "edit-field", fieldId: field.id })}
                            >
                              Редактировать
                            </button>
                          ) : (
                            <span className="muted">Только просмотр</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Шаблоны проектов"
          subtitle="Базовые шаблоны проектов для будущего проектного контура. Сейчас редактируются название, описание и статус."
          actions={
            canManageConfig ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setModal({ type: "create-template" })}
              >
                Создать шаблон
              </button>
            ) : (
              <DisabledAction reason="Нужно право tenant.workspace_config.manage" />
            )
          }
        >
          <div className="surface-summary-grid">
            <SummaryCard label="Всего шаблонов" value={props.data.projectTemplates.length} />
            <SummaryCard label="Активные" value={activeTemplates} tone="success" />
            <SummaryCard
              label="Черновики"
              value={props.data.projectTemplates.length - activeTemplates}
              tone="muted"
            />
          </div>
          <CrudToolbar
            searchLabel="Поиск шаблонов"
            searchPlaceholder="Ключ, название, описание..."
            searchValue={templateSearch}
            resultCount={filteredTemplates.length}
            totalCount={props.data.projectTemplates.length}
            onSearchChange={setTemplateSearch}
          >
            <span className="toolbar-chip">Базовый набор</span>
          </CrudToolbar>
          <SectionFeedback state={props.sectionState} emptyLabel="Настройки недоступны." />
          {props.sectionState.canRead && !props.sectionState.error ? (
            <div className="table-wrap">
              <table className="data-table" aria-label="Шаблоны проектов">
                <thead>
                  <tr>
                    <th>Шаблон</th>
                    <th>Описание</th>
                    <th>Статус</th>
                    <th>Обновлено</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.length === 0 ? (
                    <TableEmpty colSpan={5} label="Шаблонов проектов пока нет." />
                  ) : (
                    filteredTemplates.map((template) => (
                      <tr key={template.id}>
                        <td>
                          <span className="entity-name-cell">
                            <span className="row-avatar">T</span>
                            <span>
                              <strong>{template.tenantLabel}</strong>
                              <small>{template.systemKey}</small>
                            </span>
                          </span>
                        </td>
                        <td>{template.description || "Описание не задано"}</td>
                        <td>
                          <StatusPill
                            tone={template.status === "active" ? "success" : "muted"}
                            label={template.status === "active" ? "Активен" : "Черновик"}
                          />
                        </td>
                        <td>{formatDate(template.updatedAt)}</td>
                        <td>
                          {canManageConfig ? (
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: "edit-template",
                                  templateId: template.id
                                })
                              }
                            >
                              Редактировать
                            </button>
                          ) : (
                            <span className="muted">Только просмотр</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>
      </div>

      {isFieldFormOpen ? (
        <Modal
          title={editingField ? "Редактировать пользовательское поле" : "Создать пользовательское поле"}
          description="Системный ключ задается при создании и дальше остается стабильным."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingField?.id ?? "new-custom-field"}
            noValidate
            onSubmit={submitCustomField}
          >
            <label htmlFor="custom-field-systemKey">
              Системный ключ
              <input
                id="custom-field-systemKey"
                name="systemKey"
                aria-describedby={
                  fieldErrors.systemKey
                    ? getFieldErrorId("custom-field", "systemKey")
                    : "custom-field-systemKey-help"
                }
                aria-invalid={Boolean(fieldErrors.systemKey)}
                data-autofocus
                defaultValue={editingField?.systemKey ?? ""}
                readOnly={Boolean(editingField)}
                required
              />
              <small id="custom-field-systemKey-help" className="field-help">
                Например: project_priority. После создания ключ не переименовывается.
              </small>
              <FieldError formId="custom-field" field="systemKey" errors={fieldErrors} />
            </label>
            <label htmlFor="custom-field-tenantLabel">
              Название в интерфейсе
              <input
                id="custom-field-tenantLabel"
                name="tenantLabel"
                aria-describedby={
                  fieldErrors.tenantLabel
                    ? getFieldErrorId("custom-field", "tenantLabel")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.tenantLabel)}
                defaultValue={editingField?.tenantLabel ?? ""}
                required
              />
              <FieldError formId="custom-field" field="tenantLabel" errors={fieldErrors} />
            </label>
            <input name="targetEntity" type="hidden" value="project" />
            <label htmlFor="custom-field-fieldType">
              Тип поля
              <select
                id="custom-field-fieldType"
                name="fieldType"
                aria-describedby={
                  fieldErrors.fieldType
                    ? getFieldErrorId("custom-field", "fieldType")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.fieldType)}
                defaultValue={editingField?.fieldType ?? "text"}
              >
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="date">Дата</option>
                <option value="select">Список</option>
              </select>
              <FieldError formId="custom-field" field="fieldType" errors={fieldErrors} />
            </label>
            <label className="checkbox-row">
              <input
                defaultChecked={editingField?.required ?? false}
                name="required"
                type="checkbox"
              />
              Обязательное поле
            </label>
            <label htmlFor="custom-field-status">
              Статус
              <select
                id="custom-field-status"
                name="status"
                aria-describedby={
                  fieldErrors.status
                    ? getFieldErrorId("custom-field", "status")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.status)}
                defaultValue={editingField?.status ?? "draft"}
              >
                <option value="draft">Черновик</option>
                <option value="active">Активно</option>
              </select>
              <FieldError formId="custom-field" field="status" errors={fieldErrors} />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Сохраняем..." : "Сохранить поле"}
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

      {isTemplateFormOpen ? (
        <Modal
          title={editingTemplate ? "Редактировать шаблон" : "Создать шаблон"}
          description="Шаблон хранит базовые метаданные для будущего контура проектов."
          isDismissDisabled={isSaving}
          onClose={closeModal}
        >
          <form
            className="stack-form"
            key={editingTemplate?.id ?? "new-project-template"}
            noValidate
            onSubmit={submitProjectTemplate}
          >
            <label htmlFor="project-template-systemKey">
              Системный ключ
              <input
                id="project-template-systemKey"
                name="systemKey"
                aria-describedby={
                  fieldErrors.systemKey
                    ? getFieldErrorId("project-template", "systemKey")
                    : "project-template-systemKey-help"
                }
                aria-invalid={Boolean(fieldErrors.systemKey)}
                data-autofocus
                defaultValue={editingTemplate?.systemKey ?? ""}
                readOnly={Boolean(editingTemplate)}
                required
              />
              <small id="project-template-systemKey-help" className="field-help">
                Например: implementation. После создания ключ не переименовывается.
              </small>
              <FieldError formId="project-template" field="systemKey" errors={fieldErrors} />
            </label>
            <label htmlFor="project-template-tenantLabel">
              Название шаблона
              <input
                id="project-template-tenantLabel"
                name="tenantLabel"
                aria-describedby={
                  fieldErrors.tenantLabel
                    ? getFieldErrorId("project-template", "tenantLabel")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.tenantLabel)}
                defaultValue={editingTemplate?.tenantLabel ?? ""}
                required
              />
              <FieldError formId="project-template" field="tenantLabel" errors={fieldErrors} />
            </label>
            <label htmlFor="project-template-description">
              Описание
              <textarea
                id="project-template-description"
                name="description"
                aria-describedby={
                  fieldErrors.description
                    ? getFieldErrorId("project-template", "description")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.description)}
                defaultValue={editingTemplate?.description ?? ""}
                rows={4}
              />
              <FieldError formId="project-template" field="description" errors={fieldErrors} />
            </label>
            <label htmlFor="project-template-status">
              Статус
              <select
                id="project-template-status"
                name="status"
                aria-describedby={
                  fieldErrors.status
                    ? getFieldErrorId("project-template", "status")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.status)}
                defaultValue={editingTemplate?.status ?? "draft"}
              >
                <option value="draft">Черновик</option>
                <option value="active">Активен</option>
              </select>
              <FieldError formId="project-template" field="status" errors={fieldErrors} />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Сохраняем..." : "Сохранить шаблон"}
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

function filterCustomFields(
  fields: readonly CustomFieldDefinition[],
  query: string
): CustomFieldDefinition[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...fields];

  return fields.filter((field) =>
    [
      field.systemKey,
      field.tenantLabel,
      field.fieldType,
      field.status,
      field.required ? "обязательное" : "необязательное"
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

function filterProjectTemplates(
  templates: readonly ProjectTemplate[],
  query: string
): ProjectTemplate[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...templates];

  return templates.filter((template) =>
    [template.systemKey, template.tenantLabel, template.description, template.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

function getFieldTypeLabel(fieldType: CustomFieldDefinition["fieldType"]): string {
  const labels = {
    text: "Текст",
    number: "Число",
    date: "Дата",
    select: "Список"
  } satisfies Record<CustomFieldDefinition["fieldType"], string>;

  return labels[fieldType];
}

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
  year: "numeric"
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
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
  description?: string;
  children: React.ReactNode;
  isDismissDisabled?: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const titleId = useMemo(() => `dialog-title-${props.title.replace(/\W+/g, "-")}`, [props.title]);
  const descriptionId = props.description ? `${titleId}-description` : undefined;

  useEffect(() => {
    const previousActiveElement = document.activeElement;
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      "[data-autofocus]"
    ) ?? panelRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );

    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (props.isDismissDisabled) return;
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
  }, [props.isDismissDisabled, props.onClose]);

  function handlePanelKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(panelRef.current);
    const activeIndex = focusable.findIndex((element) => element === document.activeElement);
    const nextIndex = getNextFocusTrapIndex(activeIndex, focusable.length, event.shiftKey);

    if (nextIndex === null) return;

    event.preventDefault();
    focusable[nextIndex]?.focus();
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!props.isDismissDisabled) props.onClose();
      }}
    >
      <section
        ref={panelRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-panel"
        role="dialog"
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{props.title}</h2>
            {props.description ? (
              <p id={descriptionId} className="modal-description">
                {props.description}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Закрыть"
            className="icon-button"
            disabled={props.isDismissDisabled}
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
  pendingLabel: string;
  error: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Modal
      title={props.title}
      description="Проверьте последствия перед подтверждением."
      isDismissDisabled={props.isPending}
      onClose={props.onCancel}
    >
      <div className="confirm-body">
        <div className="danger-callout" aria-live="polite">
          <strong>Действие необратимо</strong>
          <span>Если API примет команду, изменение попадет в журнал аудита.</span>
        </div>
        <p>{props.body}</p>
        {props.error ? <p className="error">{props.error}</p> : null}
        <div className="form-actions">
          <button
            className="danger-button solid"
            disabled={props.isPending}
            type="button"
            onClick={props.onConfirm}
          >
            {props.isPending ? props.pendingLabel : props.confirmLabel}
          </button>
          <button
            className="secondary-button"
            disabled={props.isPending}
            type="button"
            onClick={props.onCancel}
          >
            Отменить
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FieldError(props: { formId: string; field: string; errors: FormErrors }) {
  const error = props.errors[props.field];
  if (!error) return null;

  return (
    <span className="field-error" id={getFieldErrorId(props.formId, props.field)} role="alert">
      {error}
    </span>
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"
    )
  ).filter((element) => !element.hasAttribute("aria-hidden"));
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
  if (error instanceof ApiError) {
    return (
      apiErrorMessages[error.code] ??
      `Не удалось выполнить действие. Код ошибки: ${error.code}`
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}

const apiErrorMessages: Record<string, string> = {
  access_denied: "Недостаточно прав для этого действия.",
  custom_field_id_taken: "Поле с таким идентификатором уже существует.",
  custom_field_not_found: "Пользовательское поле не найдено.",
  custom_field_system_key_taken: "Поле с таким системным ключом уже существует.",
  invalid_body: "Проверьте данные формы.",
  invalid_config_id: "Системный идентификатор имеет недопустимый формат.",
  invalid_config_status: "Выберите корректный статус.",
  invalid_description: "Описание слишком длинное.",
  invalid_field_type: "Выберите корректный тип поля.",
  invalid_required_flag: "Некорректный признак обязательности.",
  invalid_system_key: "Системный ключ: латиница, цифры и _, начинается с буквы.",
  invalid_target_entity: "Целевая сущность пока должна быть проектом.",
  invalid_tenant_label: "Укажите название для интерфейса.",
  project_template_id_taken: "Шаблон с таким идентификатором уже существует.",
  project_template_not_found: "Шаблон проекта не найден.",
  project_template_system_key_taken: "Шаблон с таким системным ключом уже существует.",
  session_required: "Сессия истекла. Войдите заново.",
  system_key_immutable: "Системный ключ нельзя изменить после создания."
};
