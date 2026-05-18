import {
  LogOut,
  Palette,
  Search,
  UserCircle,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, type FormEvent, type ReactNode } from "react";

import type { FormErrors } from "../workspaceForms";
import { getFieldErrorId, getNextFocusTrapIndex } from "../workspaceForms";

export type SectionState = {
  canRead: boolean;
  isLoading: boolean;
  error: string | null;
};

export function AccountMenu(props: {
  isLogoutPending: boolean;
  onLogout: () => void;
  onProfile: (() => void) | null;
  onTheme: (() => void) | null;
}) {
  return (
    <div className="account-menu" aria-label="Меню пользователя">
      {props.onProfile ? (
        <button className="account-menu-item" type="button" onClick={props.onProfile}>
          <UserCircle aria-hidden="true" size={16} />
          <span>
            <strong>Профиль</strong>
            <small>Личные данные и контакты</small>
          </span>
        </button>
      ) : null}
      {props.onTheme ? (
        <button className="account-menu-item" type="button" onClick={props.onTheme}>
          <Palette aria-hidden="true" size={16} />
          <span>
            <strong>Оформление</strong>
            <small>Тема и акцентный цвет</small>
          </span>
        </button>
      ) : null}
      <button
        className="account-menu-item danger"
        disabled={props.isLogoutPending}
        type="button"
        onClick={props.onLogout}
      >
        <LogOut aria-hidden="true" size={16} />
        <span>
          <strong>Выйти из рабочего пространства</strong>
          <small>{props.isLogoutPending ? "Завершаем сессию..." : "Закрыть текущую сессию"}</small>
        </span>
      </button>
    </div>
  );
}

export function LoginScreen(props: {
  isSubmitting: boolean;
  message: string;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
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

export function SummaryCard(props: {
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

export function CrudToolbar(props: {
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  resultCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  children?: ReactNode;
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

export function Metric(props: {
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

export function Panel(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
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

export function Modal(props: {
  title: string;
  description?: string;
  children: ReactNode;
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

export function ConfirmDialog(props: {
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

export function FieldError(props: { formId: string; field: string; errors: FormErrors }) {
  const error = props.errors[props.field];
  if (!error) return null;

  return (
    <span className="field-error" id={getFieldErrorId(props.formId, props.field)} role="alert">
      {error}
    </span>
  );
}

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"
    )
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}

export function EntityList<T>(props: {
  items: T[];
  emptyLabel: string;
  render: (item: T) => ReactNode;
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

export function PermissionList({ permissions }: { permissions: string[] }) {
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

export function StatusPill(props: { label: string; tone: "success" | "muted" }) {
  return <span className={`status-pill ${props.tone}`}>{props.label}</span>;
}

export function DisabledAction({ reason }: { reason: string }) {
  return (
    <button className="secondary-button" disabled title={reason} type="button">
      Нет прав
    </button>
  );
}

export function SectionFeedback(props: { state: SectionState; emptyLabel: string }) {
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

export function TableEmpty(props: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="empty-cell" colSpan={props.colSpan}>
        {props.label}
      </td>
    </tr>
  );
}
