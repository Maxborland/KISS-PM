import { ChevronDown, PlusCircle } from "lucide-react";
import { type RefObject } from "react";

import { AccountMenu } from "./components/workspace-ui";
import { type getVisibleRouteGroups, type WorkspaceRouteId } from "./routes";
import { type WorkspaceData } from "./workspaceData";
import { workspaceRouteIcons } from "./workspaceRouteIcons";

type VisibleRouteGroup = ReturnType<typeof getVisibleRouteGroups>[number];

export function WorkspaceSidebar(props: {
  activeRouteId: WorkspaceRouteId;
  canOpenProfile: boolean;
  canOpenTheme: boolean;
  data: WorkspaceData;
  isHiddenOnMobile: boolean;
  isLogoutPending: boolean;
  openUserMenu: "sidebar" | "topbar" | null;
  sidebarRef: RefObject<HTMLElement | null>;
  sidebarUserMenuRef: RefObject<HTMLDivElement | null>;
  visibleRouteGroups: VisibleRouteGroup[];
  onLogout: () => void;
  onNavigate: (routeId: WorkspaceRouteId) => void;
  onProfile: () => void;
  onQuickCreateDeal: (() => void) | null;
  onTheme: () => void;
  onToggleUserMenu: () => void;
}) {
  return (
    <aside
      aria-hidden={props.isHiddenOnMobile ? "true" : undefined}
      className="sidebar"
      inert={props.isHiddenOnMobile ? true : undefined}
      ref={props.sidebarRef}
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
      {props.onQuickCreateDeal ? (
        <div className="quick-create-row">
          <button
            className="quick-create-button"
            title="Создать сделку в текущем разделе"
            type="button"
            onClick={props.onQuickCreateDeal}
          >
            <PlusCircle aria-hidden="true" size={16} />
            <span>Создать сделку</span>
          </button>
        </div>
      ) : null}
      <nav className="nav-list" aria-label="Основная навигация">
        {props.visibleRouteGroups.map((group) => (
          <section className="nav-group" key={group.id}>
            <p className="nav-group-label">{group.label}</p>
            {group.routes.map((route) => {
              const RouteIcon = workspaceRouteIcons[route.id];

              return (
                <button
                  key={route.id}
                  aria-current={route.id === props.activeRouteId ? "page" : undefined}
                  aria-label={route.label}
                  className={route.id === props.activeRouteId ? "nav-item active" : "nav-item"}
                  title={route.label}
                  onClick={() => props.onNavigate(route.id)}
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
        <p>CRM foundation, сделки, ресурсная проверка и активация проекта.</p>
      </section>
      <div className="account-menu-anchor sidebar-account-menu" ref={props.sidebarUserMenuRef}>
        <button
          aria-expanded={props.openUserMenu === "sidebar"}
          aria-label="Открыть меню профиля"
          className="sidebar-user account-trigger"
          type="button"
          onClick={props.onToggleUserMenu}
        >
          <span className="avatar">{props.data.me.name.slice(0, 1).toUpperCase()}</span>
          <span className="account-trigger-copy">
            <strong>{props.data.me.name}</strong>
            <small>{props.data.me.email}</small>
          </span>
          <ChevronDown aria-hidden="true" className="account-trigger-icon" size={16} />
        </button>
        {props.openUserMenu === "sidebar" ? (
          <AccountMenu
            isLogoutPending={props.isLogoutPending}
            onLogout={props.onLogout}
            onProfile={props.canOpenProfile ? props.onProfile : null}
            onTheme={props.canOpenTheme ? props.onTheme : null}
          />
        ) : null}
      </div>
    </aside>
  );
}
