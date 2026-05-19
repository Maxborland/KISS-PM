"use client";

import {
  Bell,
  ChevronDown,
  Menu,
  Moon,
  PlusCircle,
  Search,
  Settings
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

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
  useUsersQuery,
} from "./workspaceQueries";
import { ProfileView, ThemeView } from "./AccountViews";
import { AuditView } from "./AuditView";
import { WorkspaceSettingsView } from "./WorkspaceSettingsView";
import { buildWorkspaceData, type WorkspaceData } from "./workspaceData";
import { DashboardView } from "./DashboardView";
import { PositionsView } from "./PositionsView";
import { RolesView } from "./RolesView";
import { UsersView } from "./UsersView";
import {
  getNextFocusTrapIndex
} from "./workspaceForms";
import {
  AccountMenu,
  EntityList,
  LoginScreen,
  getFocusableElements,
} from "./components/workspace-ui";
import {
  getSectionState,
  hasPermission
} from "./workspaceShellState";
import { useDocumentThemeClass } from "./useDocumentThemeClass";
import { workspaceRouteIcons } from "./workspaceRouteIcons";

const navigationFocusRestoreStorageKey = "kiss-pm.restore-navigation-focus";

export function WorkspaceShell() {
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
