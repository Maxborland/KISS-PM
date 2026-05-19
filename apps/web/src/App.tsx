"use client";

import {
  Activity,
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  Menu,
  Moon,
  PlusCircle,
  Search,
  Settings,
  ShieldCheck,
  Users
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  type AuditEvent,
  type CustomFieldDefinition,
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
  useAccessRolesQuery,
  useAuditEventsQuery,
  useCustomFieldsQuery,
  useHealthQuery,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  usePositionsQuery,
  useProjectTemplatesQuery,
  useProfileMutation,
  useThemeMutation,
  useUsersQuery,
  useWorkspaceConfigMutations
} from "./workspaceQueries";
import { buildWorkspaceData, type WorkspaceData } from "./workspaceData";
import { DashboardView } from "./DashboardView";
import { PositionsView } from "./PositionsView";
import { RolesView } from "./RolesView";
import { UsersView } from "./UsersView";
import {
  type FormErrors,
  getFieldErrorId,
  getNextFocusTrapIndex,
  hasFormErrors,
  validateCustomFieldForm,
  validateProjectTemplateForm
} from "./workspaceForms";
import { buildAuditChangeSummary, buildAuditPreviewRows } from "./workspaceDashboard";
import {
  filterCustomFields,
  filterProjectTemplates,
  formatDate,
  getFieldTypeLabel
} from "./workspaceViewHelpers";
import {
  AccountMenu,
  ConfirmDialog,
  CrudToolbar,
  DisabledAction,
  EntityList,
  FieldError,
  LoginScreen,
  Modal,
  Panel,
  SectionFeedback,
  StatusPill,
  SummaryCard,
  TableEmpty,
  getFocusableElements,
} from "./components/workspace-ui";
import {
  getErrorMessage,
  getSectionState,
  hasPermission,
  type SectionState
} from "./workspaceShellState";
import { useDocumentThemeClass } from "./useDocumentThemeClass";
import { workspaceRouteIcons } from "./workspaceRouteIcons";

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
  const [openUserMenu, setOpenUserMenu] = useState<"sidebar" | "topbar" | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarUserMenuRef = useRef<HTMLDivElement | null>(null);
  const topbarUserMenuRef = useRef<HTMLDivElement | null>(null);
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
  const canOpenProfile = hasPermission(permissions, "profile.read");
  const canOpenTheme = hasPermission(permissions, "workspace.theme.manage");

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

      setOpenUserMenu(null);
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
    if (!openUserMenu) return;

    function handlePointerDown(event: PointerEvent) {
      const menuRoot =
        openUserMenu === "sidebar"
          ? sidebarUserMenuRef.current
          : topbarUserMenuRef.current;
      if (menuRoot?.contains(event.target as Node)) return;
      setOpenUserMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        const menuRoot =
          openUserMenu === "sidebar"
            ? sidebarUserMenuRef.current
            : topbarUserMenuRef.current;
        const trigger = menuRoot?.querySelector("button");
        setOpenUserMenu(null);
        window.setTimeout(() => {
          trigger?.focus();
        }, 0);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openUserMenu]);

  useEffect(() => {
    if (!isNarrowViewport || !isMobileSidebarOpen) return;

    const firstFocusable = getFocusableElements(sidebarRef.current)[0];
    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (openUserMenu) return;
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
  }, [isMobileSidebarOpen, isNarrowViewport, openUserMenu]);

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

  useDocumentThemeClass(data?.me.theme);

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

  function navigateFromUserMenu(routeId: "profile" | "theme") {
    setOpenUserMenu(null);
    navigateRoute(routeId);
  }

  async function logoutFromUserMenu() {
    setOpenUserMenu(null);
    await handleLogout();
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
    setOpenUserMenu(null);
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
    setOpenUserMenu(null);
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
        </div>
        <nav className="nav-list" aria-label="Основная навигация">
          {visibleRouteGroups.map((group) => (
            <section className="nav-group" key={group.id}>
              <p className="nav-group-label">{group.label}</p>
              {group.routes.map((route) => {
                const RouteIcon = workspaceRouteIcons[route.id];

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
        <div className="account-menu-anchor sidebar-account-menu" ref={sidebarUserMenuRef}>
          <button
            aria-expanded={openUserMenu === "sidebar"}
            aria-label="Открыть меню профиля"
            className="sidebar-user account-trigger"
            type="button"
            onClick={() =>
              setOpenUserMenu((value) => (value === "sidebar" ? null : "sidebar"))
            }
          >
            <span className="avatar">{data.me.name.slice(0, 1).toUpperCase()}</span>
            <span className="account-trigger-copy">
              <strong>{data.me.name}</strong>
              <small>{data.me.email}</small>
            </span>
            <ChevronDown aria-hidden="true" className="account-trigger-icon" size={16} />
          </button>
          {openUserMenu === "sidebar" ? (
            <AccountMenu
              isLogoutPending={logoutMutation.isPending}
              onLogout={logoutFromUserMenu}
              onProfile={canOpenProfile ? () => navigateFromUserMenu("profile") : null}
              onTheme={canOpenTheme ? () => navigateFromUserMenu("theme") : null}
            />
          ) : null}
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
            {canOpenTheme ? (
              <button
                aria-label="Открыть оформление"
                className="topbar-icon-button"
                type="button"
                onClick={() => navigateRoute("theme")}
              >
                <Moon aria-hidden="true" size={17} />
              </button>
            ) : null}
            {canOpenProfile ? (
              <button
                aria-label="Открыть настройки профиля"
                className="topbar-icon-button"
                type="button"
                onClick={() => navigateRoute("profile")}
              >
                <Settings aria-hidden="true" size={17} />
              </button>
            ) : null}
            <button
              aria-label="Уведомления"
              className="topbar-icon-button"
              disabled
              title="Уведомления появятся вместе с control signals"
              type="button"
            >
              <Bell aria-hidden="true" size={17} />
            </button>
            <div className="account-menu-anchor topbar-account-menu" ref={topbarUserMenuRef}>
              <button
                aria-expanded={openUserMenu === "topbar"}
                aria-label="Открыть меню пользователя"
                className="avatar-button"
                type="button"
                onClick={() =>
                  setOpenUserMenu((value) => (value === "topbar" ? null : "topbar"))
                }
              >
                {data.me.name.slice(0, 1).toUpperCase()}
              </button>
              {openUserMenu === "topbar" ? (
                <AccountMenu
                  isLogoutPending={logoutMutation.isPending}
                  onLogout={logoutFromUserMenu}
                  onProfile={canOpenProfile ? () => navigateFromUserMenu("profile") : null}
                  onTheme={canOpenTheme ? () => navigateFromUserMenu("theme") : null}
                />
              ) : null}
            </div>
          </div>
        </header>

        {message ? <p className="toast">{message}</p> : null}
        {activeRouteId === "dashboard" ? (
          <DashboardView
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
