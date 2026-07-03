import type { LandingLocale } from "../../lib/landing-i18n";
import type { DemoChange, DemoMessage } from "./types";
import { getLandingAgentDemoCopy } from "./scenario";
import { Icon } from "./icons";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type AgentWorkspaceFrameProps = {
  children: React.ReactNode;
  mobile?: boolean;
  locale?: LandingLocale;
};

export function AgentWorkspaceFrame({ children, mobile, locale = "ru" }: AgentWorkspaceFrameProps) {
  const copy = getLandingAgentDemoCopy(locale);
  return (
    <div className={cx("lad-shell", mobile && "lad-shell--mobile")}>
      <div className="lad-window" aria-label={copy.workspaceLabel}>
        {children}
      </div>
    </div>
  );
}

type CollapsedAppNavProps = {
  expanded: boolean;
  mobileOpen?: boolean;
  locale?: LandingLocale;
  onToggle: () => void;
  onNote?: (note: string) => void;
};

const navIcons = ["agent", "folder", "list", "users", "calendar", "file", "settings"] as const;
const historyIcons = ["calendar", "clock", "users", "file"] as const;

export function CollapsedAppNav({
  expanded,
  mobileOpen,
  locale = "ru",
  onToggle,
  onNote,
}: CollapsedAppNavProps) {
  const copy = getLandingAgentDemoCopy(locale);
  return (
    <nav
      className={cx(
        "lad-app-nav",
        expanded && "lad-app-nav--expanded",
        mobileOpen && "lad-app-nav--mobile-open",
      )}
      aria-label={copy.appNavLabel}
    >
      <button className="lad-icon-button lad-app-nav__toggle" type="button" onClick={onToggle}>
        <Icon name="panel" />
        <span className="lad-sr">{copy.toggleMenuLabel}</span>
      </button>
      <div className="lad-app-nav__items">
        {copy.navItems.map((item, index) => (
          <button
            key={item.label}
            className={cx("lad-app-nav__item", item.active && "is-active")}
            type="button"
            onClick={() => {
              if (!item.active) onNote?.(item.note);
            }}
          >
            <Icon name={navIcons[index] ?? "list"} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="lad-app-nav__profile" aria-hidden>
        <span>{copy.profileInitials}</span>
        <i />
      </div>
    </nav>
  );
}

export function AgentConversationList({
  locale = "ru",
  onNote,
}: {
  locale?: LandingLocale;
  onNote?: (note: string) => void;
}) {
  const copy = getLandingAgentDemoCopy(locale);
  return (
    <aside className="lad-history" aria-label={copy.historyLabel}>
      <div className="lad-history__title">
        <Icon name="history" />
        <span>{copy.historyTitle}</span>
      </div>
      <div className="lad-history__items">
        {copy.historyItems.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={cx("lad-history__item", item.active && "is-active")}
            onClick={() => {
              if (!item.active) onNote?.(item.note);
            }}
          >
            <Icon name={historyIcons[index] ?? "history"} />
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

type AgentChatPanelProps = {
  messages: DemoMessage[];
  inputValue: string;
  visibleSteps: number;
  phase: string;
  agentMenuOpen: boolean;
  reviewVisible: boolean;
  locale?: LandingLocale;
  note?: string | null;
  onNote?: (note: string) => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onToggleAgentMenu: () => void;
  onOpenMobileLeft?: () => void;
  onOpenMobileReview?: () => void;
};

export function AgentChatPanel({
  messages,
  inputValue,
  visibleSteps,
  phase,
  agentMenuOpen,
  reviewVisible,
  locale = "ru",
  note,
  onNote,
  onInputChange,
  onSend,
  onToggleAgentMenu,
  onOpenMobileLeft,
  onOpenMobileReview,
}: AgentChatPanelProps) {
  const copy = getLandingAgentDemoCopy(locale);
  const isThinking = phase === "thinking" || phase === "activity" || phase === "second-thinking";

  return (
    <section className="lad-chat" aria-label={copy.chatLabel}>
      <header className="lad-chat__header">
        <button className="lad-icon-button lad-mobile-only" type="button" onClick={onOpenMobileLeft}>
          <Icon name="menu" />
          <span className="lad-sr">{copy.openMenuLabel}</span>
        </button>
        <div className="lad-agent-title">
          <div className="lad-agent-title__mark">
            <Icon name="agent" />
          </div>
          <div>
            <h2>{copy.agentTitle}</h2>
            <span>{copy.agentSubtitle}</span>
          </div>
        </div>
        <div className="lad-chat__header-actions">
          {reviewVisible ? (
            <button className="lad-chip-button lad-mobile-only" type="button" onClick={onOpenMobileReview}>
              {copy.diffButton}
            </button>
          ) : null}
          <button className="lad-icon-button" type="button" onClick={onToggleAgentMenu}>
            <Icon name="sliders" />
            <span className="lad-sr">{copy.agentDetailsLabel}</span>
          </button>
        </div>
        {agentMenuOpen ? <AgentStatusMenu locale={locale} onNote={onNote} /> : null}
      </header>

      <div className="lad-chat__body">
        {messages.length === 0 ? (
          <div className="lad-chat__empty">
            <Icon name="message" />
            <span>{copy.emptyChat}</span>
          </div>
        ) : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} locale={locale} />
        ))}
        {isThinking ? <AgentActivitySteps visibleSteps={visibleSteps} locale={locale} /> : null}
      </div>

      {note ? (
        <div className="lad-note" role="status">
          {note}
        </div>
      ) : null}

      <form
        className="lad-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <input
          className="lad-input"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={copy.composerPlaceholder}
          aria-label={copy.composerLabel}
        />
        <button
          className="lad-icon-button lad-attach-button"
          type="button"
          aria-label={copy.attachLabel}
          onClick={() => onNote?.(copy.attachNote)}
        >
          <Icon name="paperclip" />
        </button>
        <button className="lad-send-button" type="submit" disabled={!inputValue.trim()}>
          <Icon name="send" />
          <span className="lad-sr">{copy.sendLabel}</span>
        </button>
      </form>
    </section>
  );
}

function MessageBubble({ message, locale }: { message: DemoMessage; locale: LandingLocale }) {
  const copy = getLandingAgentDemoCopy(locale);
  return (
    <article
      className={cx(
        "lad-message",
        message.author === "user" && "lad-message--user",
        message.variant === "client-note" && "lad-message--client-note",
      )}
    >
      <div className="lad-message__avatar">{message.author === "henry" ? <Icon name="agent" /> : copy.userAvatar}</div>
      <div className="lad-message__content">
        <div className="lad-message__meta">
          <span>{message.author === "henry" ? copy.agentName : copy.userName}</span>
          <time>{message.time}</time>
        </div>
        <p>{message.text}</p>
        {message.variant === "client-note" ? (
          <div className="lad-client-note">
            <span>{copy.clientNoteLabel}</span>
            <p>{copy.clientNoteBody}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function AgentActivitySteps({ visibleSteps, locale = "ru" }: { visibleSteps: number; locale?: LandingLocale }) {
  const copy = getLandingAgentDemoCopy(locale);
  return (
    <div className="lad-steps" aria-label={copy.activityLabel}>
      {copy.activitySteps.map((step, index) => (
        <div key={step} className={cx("lad-step", index < visibleSteps && "is-visible")}>
          <span className="lad-step__icon">
            <Icon name={index + 1 < visibleSteps ? "check" : "clock"} />
          </span>
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

export function AgentStatusMenu({
  locale = "ru",
  onNote,
}: {
  locale?: LandingLocale;
  onNote?: (note: string) => void;
}) {
  const copy = getLandingAgentDemoCopy(locale);
  return (
    <div className="lad-agent-menu">
      <div className="lad-agent-menu__head">
        <strong>{copy.agentTitle}</strong>
        <span>{copy.agentSubtitle}</span>
      </div>
      <dl>
        <div>
          <dt>{copy.menu.memory}</dt>
          <dd>{copy.menu.memoryProject}</dd>
          <dd>{copy.menu.memoryAudit}</dd>
        </div>
        <div>
          <dt>{copy.menu.access}</dt>
          <dd>{copy.menu.accessScope}</dd>
        </div>
        <div>
          <dt>{copy.menu.behavior}</dt>
          <dd>{copy.menu.behaviorDiff}</dd>
        </div>
      </dl>
      <button type="button" onClick={() => onNote?.(copy.menu.configureNote)}>
        {copy.menu.configure}
      </button>
    </div>
  );
}

type ChangeReviewPanelProps = {
  changes: DemoChange[];
  visible: boolean;
  opening: boolean;
  applied: boolean;
  activeChangeId: string;
  editingChangeId?: string;
  applying?: boolean;
  mobileOpen?: boolean;
  filterSelected?: boolean;
  locale?: LandingLocale;
  onToggleFilter?: () => void;
  onCloseMobile?: () => void;
  onSelectChange: (id: string) => void;
  onFocusChange: (id: string) => void;
  onRejectChange: (id: string) => void;
  onEditChange: (id: string) => void;
  onUpdateChange: (id: string, value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

export function ChangeReviewPanel({
  changes,
  visible,
  opening,
  applied,
  activeChangeId,
  editingChangeId,
  applying,
  mobileOpen,
  filterSelected,
  locale = "ru",
  onToggleFilter,
  onCloseMobile,
  onSelectChange,
  onFocusChange,
  onRejectChange,
  onEditChange,
  onUpdateChange,
  onApply,
  onReset,
}: ChangeReviewPanelProps) {
  const copy = getLandingAgentDemoCopy(locale);
  const selectedCount = changes.filter((change) => change.selected).length;
  const visibleChanges = filterSelected ? changes.filter((change) => change.selected) : changes;

  if (!visible && !mobileOpen) {
    return null;
  }

  return (
    <aside
      className={cx(
        "lad-review",
        opening && "lad-review--opening",
        mobileOpen && "lad-review--mobile-open",
      )}
      aria-label={copy.review.label}
    >
      <header className="lad-review__header">
        <div>
          <span>{copy.review.title}</span>
          <strong>{copy.review.changesCount}</strong>
        </div>
        <button className="lad-icon-button lad-mobile-only" type="button" onClick={onCloseMobile}>
          <Icon name="x" />
          <span className="lad-sr">{copy.review.close}</span>
        </button>
      </header>
      <div className="lad-review__summary">
        <span className="is-active">{selectedCount} {copy.review.selected}</span>
        <span>{copy.review.ready}</span>
        <button
          type="button"
          onClick={onToggleFilter}
          aria-pressed={filterSelected ?? false}
          title={filterSelected ? copy.review.showAllTitle : copy.review.showSelectedTitle}
        >
          {filterSelected ? copy.review.selectedOnly : copy.review.allChanges}
          <Icon name="chevron" />
        </button>
      </div>
      <div className="lad-review__list">
        {visibleChanges.map((change) => (
          <ChangeHunkCard
            key={change.id}
            change={change}
            active={change.id === activeChangeId}
            editing={change.id === editingChangeId}
            locale={locale}
            onSelect={() => onSelectChange(change.id)}
            onFocus={() => onFocusChange(change.id)}
            onReject={() => onRejectChange(change.id)}
            onEdit={() => onEditChange(change.id)}
            onUpdate={(value) => onUpdateChange(change.id, value)}
          />
        ))}
      </div>
      {applied ? (
        <div className="lad-apply-result">
          <Icon name="shield" />
          <div>
            <strong>{copy.review.appliedTitle}</strong>
            <span>{copy.review.appliedSubtitle}</span>
          </div>
        </div>
      ) : null}
      <div className="lad-review__actions">
        <button className="lad-action-button lad-action-button--primary" type="button" onClick={onApply} disabled={applied || applying}>
          <Icon name="check" />
          {applying ? copy.review.applying : copy.review.apply}
        </button>
        <button className="lad-action-button lad-action-button--secondary" type="button" onClick={onReset}>
          <Icon name="reset" />
          {copy.review.reset}
        </button>
      </div>
    </aside>
  );
}

type ChangeHunkCardProps = {
  change: DemoChange;
  active: boolean;
  editing: boolean;
  locale: LandingLocale;
  onSelect: () => void;
  onFocus: () => void;
  onReject: () => void;
  onEdit: () => void;
  onUpdate: (value: string) => void;
};

export function ChangeHunkCard({
  change,
  active,
  editing,
  locale,
  onSelect,
  onFocus,
  onReject,
  onEdit,
  onUpdate,
}: ChangeHunkCardProps) {
  const copy = getLandingAgentDemoCopy(locale);
  const status = statusClass(change.status);
  const locked = status === "applied" || status === "rejected";

  return (
    <article
      className={cx("lad-change", `lad-change--${status}`, active && "is-active")}
      onClick={onFocus}
    >
      <div className="lad-change__top">
        <span className="lad-change__number">{change.number}</span>
        <strong>{change.title}</strong>
        <button
          className={cx("lad-status", `lad-status--${status}`)}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!locked) onSelect();
          }}
        >
          {change.status}
          <Icon name="chevron" />
        </button>
      </div>
      <div className="lad-change__grid">
        <div>
          <span>{copy.review.before}</span>
          <p>{change.before}</p>
        </div>
        <div className="lad-change__arrow">→</div>
        <div>
          <span>{copy.review.after}</span>
          {editing ? (
            <EditableAfterValue change={change} locale={locale} onUpdate={onUpdate} />
          ) : (
            <p className="lad-change__after">{change.after}</p>
          )}
        </div>
      </div>
      <div className="lad-change__actions">
        <button type="button" onClick={onEdit} disabled={status === "applied"}>
          {copy.review.edit}
        </button>
        <button type="button" onClick={onReject} disabled={locked}>
          {copy.review.reject}
        </button>
      </div>
    </article>
  );
}

function EditableAfterValue({
  change,
  locale,
  onUpdate,
}: {
  change: DemoChange;
  locale: LandingLocale;
  onUpdate: (value: string) => void;
}) {
  const copy = getLandingAgentDemoCopy(locale);
  if (change.kind === "date") {
    const options = change.id === "meeting" ? copy.editOptions.meetingDates : copy.editOptions.deadlineDates;

    return (
      <div className="lad-date-picker" aria-label={`${copy.review.newValue}: ${change.title}`}>
        <div className="lad-date-picker__value">{change.after}</div>
        <div className="lad-date-picker__days">
          {options.map((option) => (
            <button
              key={option}
              className={cx(option === change.after && "is-selected")}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onUpdate(option);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (change.kind === "owner" || change.kind === "status") {
    const options = change.kind === "owner" ? copy.editOptions.owners : copy.editOptions.states;

    return (
      <select
        className="lad-change__select"
        value={change.after}
        onChange={(event) => onUpdate(event.target.value)}
        aria-label={`${copy.review.newValue}: ${change.title}`}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );
  }

  return (
    <textarea
      className="lad-change__textarea"
      value={change.after}
      onChange={(event) => onUpdate(event.target.value)}
      aria-label={`${copy.review.newValue}: ${change.title}`}
    />
  );
}

function statusClass(status: string) {
  if (status === "изменено" || status === "edited") return "edited";
  if (status === "отклонено" || status === "rejected") return "rejected";
  if (status === "требует прав" || status === "needs permission") return "permission";
  if (status === "устарело" || status === "stale") return "stale";
  if (status === "применено" || status === "applied") return "applied";
  return "selected";
}

export function MobileDrawerBackdrop({
  visible,
  locale = "ru",
  onClick,
}: {
  visible?: boolean;
  locale?: LandingLocale;
  onClick: () => void;
}) {
  const copy = getLandingAgentDemoCopy(locale);
  return visible ? (
    <button className="lad-mobile-backdrop" type="button" onClick={onClick} aria-label={copy.review.closeLayer} />
  ) : null;
}