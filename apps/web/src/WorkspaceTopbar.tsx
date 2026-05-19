import { Bell, Menu, Moon, Search, Settings } from "lucide-react";
import { type RefObject } from "react";

import { AccountMenu } from "./components/workspace-ui";

export function WorkspaceTopbar(props: {
  apiStatus: string;
  canOpenProfile: boolean;
  canOpenTheme: boolean;
  isLogoutPending: boolean;
  navigationToggleLabel: string;
  openUserMenu: "sidebar" | "topbar" | null;
  routeSearch: string;
  topbarUserMenuRef: RefObject<HTMLDivElement | null>;
  navigationToggleRef: RefObject<HTMLButtonElement | null>;
  userEmail: string;
  userName: string;
  onLogout: () => void;
  onNavigationToggle: () => void;
  onProfile: () => void;
  onRouteSearch: (event: React.FormEvent<HTMLFormElement>) => void;
  onRouteSearchChange: (value: string) => void;
  onTheme: () => void;
  onToggleUserMenu: () => void;
}) {
  return (
    <header className="topbar">
      <button
        aria-label={props.navigationToggleLabel}
        className="topbar-icon-button"
        ref={props.navigationToggleRef}
        type="button"
        onClick={props.onNavigationToggle}
      >
        <Menu aria-hidden="true" size={17} />
      </button>
      <span className="topbar-divider" aria-hidden="true" />
      <form className="quick-search" role="search" onSubmit={props.onRouteSearch}>
        <Search aria-hidden="true" size={16} />
        <input
          aria-label="Переход по разделам"
          placeholder="Перейти в раздел"
          value={props.routeSearch}
          onChange={(event) => props.onRouteSearchChange(event.target.value)}
        />
      </form>
      <div className="topbar-context">
        <div className="status-chip" title={`API: ${props.apiStatus}`}>
          <span className={props.apiStatus === "ok" ? "status-dot ok" : "status-dot"} />
          <span>{props.apiStatus}</span>
        </div>
        {props.canOpenTheme ? (
          <button
            aria-label="Открыть оформление"
            className="topbar-icon-button"
            type="button"
            onClick={props.onTheme}
          >
            <Moon aria-hidden="true" size={17} />
          </button>
        ) : null}
        {props.canOpenProfile ? (
          <button
            aria-label="Открыть настройки профиля"
            className="topbar-icon-button"
            type="button"
            onClick={props.onProfile}
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
        <div className="account-menu-anchor topbar-account-menu" ref={props.topbarUserMenuRef}>
          <button
            aria-expanded={props.openUserMenu === "topbar"}
            aria-label="Открыть меню пользователя"
            className="avatar-button"
            type="button"
            onClick={props.onToggleUserMenu}
          >
            {props.userName.slice(0, 1).toUpperCase()}
          </button>
          {props.openUserMenu === "topbar" ? (
            <AccountMenu
              isLogoutPending={props.isLogoutPending}
              onLogout={props.onLogout}
              onProfile={props.canOpenProfile ? props.onProfile : null}
              onTheme={props.canOpenTheme ? props.onTheme : null}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
