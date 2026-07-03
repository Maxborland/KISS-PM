import type { DemoChange, DemoMessage } from "./types";
import { ACTIVITY_STEPS, HISTORY_ITEMS, NAV_ITEMS } from "./scenario";
import { Icon } from "./icons";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type AgentWorkspaceFrameProps = {
  children: React.ReactNode;
  mobile?: boolean;
};

export function AgentWorkspaceFrame({ children, mobile }: AgentWorkspaceFrameProps) {
  return (
    <div className={cx("lad-shell", mobile && "lad-shell--mobile")}>
      <div className="lad-window" aria-label="Рабочее окно KISS PM">
        {children}
      </div>
    </div>
  );
}

type CollapsedAppNavProps = {
  expanded: boolean;
  mobileOpen?: boolean;
  onToggle: () => void;
  onNote?: (note: string) => void;
};

const navIcons = ["agent", "folder", "list", "users", "calendar", "file", "settings"] as const;
const historyIcons = ["calendar", "clock", "users", "file"] as const;

export function CollapsedAppNav({ expanded, mobileOpen, onToggle, onNote }: CollapsedAppNavProps) {
  return (
    <nav
      className={cx(
        "lad-app-nav",
        expanded && "lad-app-nav--expanded",
        mobileOpen && "lad-app-nav--mobile-open"
      )}
      aria-label="Навигация приложения"
    >
      <button className="lad-icon-button lad-app-nav__toggle" type="button" onClick={onToggle}>
        <Icon name="panel" />
        <span className="lad-sr">Раскрыть меню</span>
      </button>
      <div className="lad-app-nav__items">
        {NAV_ITEMS.map((item, index) => (
          <button
            key={item}
            className={cx("lad-app-nav__item", item === "Агент" && "is-active")}
            type="button"
            onClick={() => {
              if (item !== "Агент") {
                onNote?.(`Раздел «${item}» открывается в продукте — демо показывает работу агента.`);
              }
            }}
          >
            <Icon name={navIcons[index] ?? "list"} />
            <span>{item}</span>
          </button>
        ))}
      </div>
      <div className="lad-app-nav__profile" aria-hidden>
        <span>ГГ</span>
        <i />
      </div>
    </nav>
  );
}

export function AgentConversationList({ onNote }: { onNote?: (note: string) => void }) {
  return (
    <aside className="lad-history" aria-label="История запусков">
      <div className="lad-history__title">
        <Icon name="history" />
        <span>История</span>
      </div>
      <div className="lad-history__items">
        {HISTORY_ITEMS.map((item, index) => (
          <button
            key={item}
            type="button"
            className={cx("lad-history__item", item === "Задержка дизайна" && "is-active")}
            onClick={() => {
              if (item !== "Задержка дизайна") {
                onNote?.(`В демо открыт сценарий «Задержка дизайна» — остальная история доступна в продукте.`);
              }
            }}
          >
            <Icon name={historyIcons[index] ?? "history"} />
            {item}
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
  note,
  onNote,
  onInputChange,
  onSend,
  onToggleAgentMenu,
  onOpenMobileLeft,
  onOpenMobileReview,
}: AgentChatPanelProps) {
  const isThinking = phase === "thinking" || phase === "activity" || phase === "second-thinking";

  return (
    <section className="lad-chat" aria-label="Чат с проектным агентом">
      <header className="lad-chat__header">
        <button className="lad-icon-button lad-mobile-only" type="button" onClick={onOpenMobileLeft}>
          <Icon name="menu" />
          <span className="lad-sr">Открыть меню</span>
        </button>
        <div className="lad-agent-title">
          <div className="lad-agent-title__mark">
            <Icon name="agent" />
          </div>
          <div>
            <h2>Проектный агент</h2>
            <span>Агент проекта</span>
          </div>
        </div>
        <div className="lad-chat__header-actions">
          {reviewVisible ? (
            <button className="lad-chip-button lad-mobile-only" type="button" onClick={onOpenMobileReview}>
              Сверка
            </button>
          ) : null}
          <button className="lad-icon-button" type="button" onClick={onToggleAgentMenu}>
            <Icon name="sliders" />
            <span className="lad-sr">Сведения об агенте</span>
          </button>
        </div>
        {agentMenuOpen ? <AgentStatusMenu onNote={onNote} /> : null}
      </header>

      <div className="lad-chat__body">
        {messages.length === 0 ? (
          <div className="lad-chat__empty">
            <Icon name="message" />
            <span>Запрос уже набран. Отправьте его агенту.</span>
          </div>
        ) : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isThinking ? <AgentActivitySteps visibleSteps={visibleSteps} /> : null}
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
          placeholder="Опишите цель или попросите изменить проект..."
          aria-label="Сообщение проектному агенту"
        />
        <button
          className="lad-icon-button lad-attach-button"
          type="button"
          aria-label="Прикрепить файл"
          onClick={() => onNote?.("Вложения доступны в продукте — в демо агент работает с планом недели.")}
        >
          <Icon name="paperclip" />
        </button>
        <button className="lad-send-button" type="submit" disabled={!inputValue.trim()}>
          <Icon name="send" />
          <span className="lad-sr">Отправить</span>
        </button>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: DemoMessage }) {
  return (
    <article
      className={cx(
        "lad-message",
        message.author === "user" && "lad-message--user",
        message.variant === "client-note" && "lad-message--client-note"
      )}
    >
      <div className="lad-message__avatar">{message.author === "henry" ? <Icon name="agent" /> : "Вы"}</div>
      <div className="lad-message__content">
        <div className="lad-message__meta">
          <span>{message.author === "henry" ? "Проектный агент" : "Вы"}</span>
          <time>{message.time}</time>
        </div>
        <p>{message.text}</p>
        {message.variant === "client-note" ? (
          <div className="lad-client-note">
            <span>Сообщение клиенту</span>
            <p>
              Согласование сдвинулось на три дня. План недели обновлен, ответственный закреплен,
              встречу предлагаем провести 16 июня.
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function AgentActivitySteps({ visibleSteps }: { visibleSteps: number }) {
  return (
    <div className="lad-steps" aria-label="Действия проектного агента">
      {ACTIVITY_STEPS.map((step, index) => (
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

export function AgentStatusMenu({ onNote }: { onNote?: (note: string) => void }) {
  return (
    <div className="lad-agent-menu">
      <div className="lad-agent-menu__head">
        <strong>Проектный агент</strong>
        <span>Агент проекта</span>
      </div>
      <dl>
        <div>
          <dt>Память</dt>
          <dd>Контекст проектов и задач</dd>
          <dd>История решений в аудите</dd>
        </div>
        <div>
          <dt>Доступ</dt>
          <dd>Проекты, задачи, сроки, ресурсы</dd>
        </div>
        <div>
          <dt>Поведение</dt>
          <dd>Показывает сверку перед применением</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() => onNote?.("Память, доступ и поведение агента настраиваются в аккаунте продукта.")}
      >
        Настроить в аккаунте
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
        mobileOpen && "lad-review--mobile-open"
      )}
      aria-label="Сверка изменений"
    >
      <header className="lad-review__header">
        <div>
          <span>Сверка</span>
          <strong>5 изменений</strong>
        </div>
        <button className="lad-icon-button lad-mobile-only" type="button" onClick={onCloseMobile}>
          <Icon name="x" />
          <span className="lad-sr">Закрыть Сверку</span>
        </button>
      </header>
      <div className="lad-review__summary">
        <span className="is-active">{selectedCount} выбрано</span>
        <span>Готово к ревью</span>
        <button
          type="button"
          onClick={onToggleFilter}
          aria-pressed={filterSelected ?? false}
          title={filterSelected ? "Показать все изменения" : "Показать только выбранные"}
        >
          {filterSelected ? "Только выбранные" : "Все изменения"}
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
            <strong>4 изменения применены</strong>
            <span>запись в аудите создана</span>
          </div>
        </div>
      ) : null}
      <div className="lad-review__actions">
        <button className="lad-action-button lad-action-button--primary" type="button" onClick={onApply} disabled={applied || applying}>
          <Icon name="check" />
          {applying ? "Применяем..." : "Применить выбранное"}
        </button>
        <button className="lad-action-button lad-action-button--secondary" type="button" onClick={onReset}>
          <Icon name="reset" />
          Сбросить
        </button>
      </div>
    </aside>
  );
}

type ChangeHunkCardProps = {
  change: DemoChange;
  active: boolean;
  editing: boolean;
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
  onSelect,
  onFocus,
  onReject,
  onEdit,
  onUpdate,
}: ChangeHunkCardProps) {
  const locked = change.status === "применено" || change.status === "отклонено";

  return (
    <article
      className={cx("lad-change", `lad-change--${statusClass(change.status)}`, active && "is-active")}
      onClick={onFocus}
    >
      <div className="lad-change__top">
        <span className="lad-change__number">{change.number}</span>
        <strong>{change.title}</strong>
        <button
          className={cx("lad-status", `lad-status--${statusClass(change.status)}`)}
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
          <span>Было:</span>
          <p>{change.before}</p>
        </div>
        <div className="lad-change__arrow">→</div>
        <div>
          <span>Стало:</span>
          {editing ? (
            <EditableAfterValue change={change} onUpdate={onUpdate} />
          ) : (
            <p className="lad-change__after">{change.after}</p>
          )}
        </div>
      </div>
      <div className="lad-change__actions">
        <button type="button" onClick={onEdit} disabled={change.status === "применено"}>
          Редактировать
        </button>
        <button type="button" onClick={onReject} disabled={locked}>
          Отклонить
        </button>
      </div>
    </article>
  );
}

function EditableAfterValue({ change, onUpdate }: { change: DemoChange; onUpdate: (value: string) => void }) {
  if (change.kind === "date") {
    const options = change.id === "meeting"
      ? ["14 июня", "15 июня", "16 июня", "17 июня"]
      : ["13 июня", "14 июня", "15 июня", "16 июня"];

    return (
      <div className="lad-date-picker" aria-label={`Новое значение: ${change.title}`}>
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
    const options =
      change.kind === "owner"
        ? ["Анна Морозова", "Иван Петров", "Мария Лебедева"]
        : ["В работе", "На проверке", "Готово", "Отложено"];

    return (
      <select
        className="lad-change__select"
        value={change.after}
        onChange={(event) => onUpdate(event.target.value)}
        aria-label={`Новое значение: ${change.title}`}
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
      aria-label={`Новое значение: ${change.title}`}
    />
  );
}

function statusClass(status: string) {
  if (status === "изменено") return "edited";
  if (status === "отклонено") return "rejected";
  if (status === "требует прав") return "permission";
  if (status === "устарело") return "stale";
  if (status === "применено") return "applied";
  return "selected";
}

export function MobileDrawerBackdrop({ visible, onClick }: { visible?: boolean; onClick: () => void }) {
  return visible ? (
    <button className="lad-mobile-backdrop" type="button" onClick={onClick} aria-label="Закрыть слой" />
  ) : null;
}
