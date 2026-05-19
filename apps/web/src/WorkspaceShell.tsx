"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  getDefaultRouteId,
  findRouteByQuery,
  getRouteIdFromPathname,
  getRoutePath,
  type WorkspaceRouteId
} from "./routes";
import { WorkspaceRouteRenderer } from "./WorkspaceRouteRenderer";
import {
  getNextFocusTrapIndex
} from "./workspaceForms";
import { LoginScreen, getFocusableElements } from "./components/workspace-ui";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspaceTopbar } from "./WorkspaceTopbar";
import { canStartDealCreation } from "./workspaceShellState";
import { useWorkspaceShellData } from "./useWorkspaceShellData";

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
  const {
    canOpenProfile,
    canOpenTheme,
    data,
    loginMutation,
    logoutMutation,
    meQuery,
    permissions,
    sectionStates,
    visibleRouteGroups,
    visibleRoutes
  } = useWorkspaceShellData();
  const activeRouteId = getRouteIdFromPathname(pathname);
  const activeOpportunityId = getOpportunityIdFromPathname(pathname);

  useEffect(() => {
    if (!meQuery.data) return;
    if (pathname === "/") {
      router.replace(getRoutePath("dashboard"));
      return;
    }
    const allowedRouteId = getDefaultRouteId(activeRouteId, permissions);
    if (allowedRouteId !== activeRouteId) {
      navigateRoute(allowedRouteId);
    }
  }, [activeRouteId, meQuery.data, pathname, permissions, router]);

  useEffect(() => {
    if (activeRouteId !== "opportunities") return;
    if (sessionStorage.getItem("kiss-pm.quick-create") === "deal") {
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
  const canQuickCreateDeal =
    activeRouteId === "opportunities" && canStartDealCreation(data);

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
      <WorkspaceSidebar
        activeRouteId={activeRouteId}
        canOpenProfile={canOpenProfile}
        canOpenTheme={canOpenTheme}
        data={data}
        isHiddenOnMobile={isNarrowViewport && !isMobileSidebarOpen}
        isLogoutPending={logoutMutation.isPending}
        openUserMenu={openUserMenu}
        sidebarRef={sidebarRef}
        sidebarUserMenuRef={sidebarUserMenuRef}
        visibleRouteGroups={visibleRouteGroups}
        onLogout={logoutFromUserMenu}
        onNavigate={navigateRoute}
        onProfile={() => navigateFromUserMenu("profile")}
        onQuickCreateDeal={canQuickCreateDeal ? () => {
          sessionStorage.setItem("kiss-pm.quick-create", "deal");
          setQuickCreateRequested(true);
          navigateRoute("opportunities");
        } : null}
        onTheme={() => navigateFromUserMenu("theme")}
        onToggleUserMenu={() =>
          setOpenUserMenu((value) => (value === "sidebar" ? null : "sidebar"))
        }
      />

      <section
        className="content-shell"
        inert={isNarrowViewport && isMobileSidebarOpen ? true : undefined}
      >
        <WorkspaceTopbar
          apiStatus={data.apiStatus}
          canOpenProfile={canOpenProfile}
          canOpenTheme={canOpenTheme}
          isLogoutPending={logoutMutation.isPending}
          navigationToggleLabel={navigationToggleLabel}
          navigationToggleRef={navigationToggleRef}
          openUserMenu={openUserMenu}
          routeSearch={routeSearch}
          topbarUserMenuRef={topbarUserMenuRef}
          userEmail={data.me.email}
          userName={data.me.name}
          onLogout={logoutFromUserMenu}
          onNavigationToggle={handleNavigationToggle}
          onProfile={() => navigateRoute("profile")}
          onRouteSearch={handleRouteSearch}
          onRouteSearchChange={setRouteSearch}
          onTheme={() => navigateRoute("theme")}
          onToggleUserMenu={() =>
            setOpenUserMenu((value) => (value === "topbar" ? null : "topbar"))
          }
        />

        {message ? <p className="toast">{message}</p> : null}
        <WorkspaceRouteRenderer
          activeRouteId={activeRouteId}
          activeOpportunityId={activeOpportunityId}
          data={data}
          openCreateRequested={quickCreateRequested}
          onChanged={setMessage}
          onQuickCreateConsumed={() => {
            setQuickCreateRequested(false);
          }}
          onOpenOpportunity={(opportunityId) => {
            router.push(`/opportunities/${encodeURIComponent(opportunityId)}`);
          }}
          onBackToOpportunities={() => {
            router.push(getRoutePath("opportunities"));
          }}
          sectionStates={sectionStates}
        />
      </section>
    </main>
  );
}

function getOpportunityIdFromPathname(pathname: string): string | null {
  const match = /^\/opportunities\/([^/]+)\/?$/.exec(pathname);
  const rawOpportunityId = match?.[1];
  return rawOpportunityId ? decodeURIComponent(rawOpportunityId) : null;
}
