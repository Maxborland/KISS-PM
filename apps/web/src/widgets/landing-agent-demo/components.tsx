import {
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  FolderKanban,
  History,
  ListChecks,
  Menu,
  MessageSquare,
  PanelLeft,
  Paperclip,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

import { ACTIVITY_STEPS, HISTORY_ITEMS, NAV_ITEMS } from "./scenario";
import type { DemoChange, DemoMessage } from "./types";

type AgentWorkspaceFrameProps = {
  children: React.ReactNode;
  mobile?: boolean;
};

export function AgentWorkspaceFrame({ children, mobile }: AgentWorkspaceFrameProps) {
  return (
    <div className={cn("lad-shell", mobile && "lad-shell--mobile")}>
      <div className="lad-window" aria-label="Рабочее окно KISS PM">
        <div className="lad-window__bar">
          <span className="lad-window__dot" />
          <span className="lad-window__dot" />
          <span className="lad-window__dot" />
        </div>
        {children}
      </div>
    </div>
  );
}

type CollapsedAppNavProps = {
  expanded: boolean;
  mobileOpen?: boolean | undefined;
  onToggle: () => void;
};

const navIcons = [Bot, FolderKanban, ListChecks, Users, CalendarDays, FileText, Settings];
const historyIcons = [CalendarDays, Clock3, Users, FileText];

export function CollapsedAppNav({ expanded, mobileOpen, onToggle }: CollapsedAppNavProps) {
  return (
    <nav
      className={cn(
        "lad-app-nav",
        expanded && "lad-app-nav--expanded",
        mobileOpen && "lad-app-nav--mobile-open"
      )}
      aria-label="Навигация приложения"
    >
      <button className="lad-icon-button lad-app-nav__toggle" type="button" onClick={onToggle}>
        <PanelLeft aria-hidden />
        <span className="lad-sr">Раскрыть меню</span>
      </button>
      <div className="lad-app-nav__items">
        {NAV_ITEMS.map((item, index) => {
          const Icon = navIcons[index] ?? ListChecks;
          return (
            <button
              key={item}
              className={cn("lad-app-nav__item", item === "Агент" && "is-active")}
              type="button"
            >
              <Icon aria-hidden />
              <span>{item}</span>
            </button>
          );
        })}
      </div>
      <div className="lad-app-nav__profile" aria-hidden>
        <span>AI</span>
        <i />
      </div>
    </nav>
  );
}

export function AgentConversationList() {
  return (
    <aside className="lad-history" aria-label="История запусков">
      <div className="lad-history__title">
        <History aria-hidden />
        <span>История</span>
      </div>
      <div className="lad-history__items">
        {HISTORY_ITEMS.map((item, index) => {
          const Icon = historyIcons[index] ?? History;
          return (
          <button
            key={item}
            type="button"
            className={cn("lad-history__item", item === "Сроки согласования" && "is-active")}
          >
            <Icon aria-hidden />
            {item}
          </button>
          );
        })}
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
  onInputChange,
  onSend,
  onToggleAgentMenu,
  onOpenMobileLeft,
  onOpenMobileReview
}: AgentChatPanelProps) {
  const isThinking = phase === "thinking" || phase === "activity" || phase === "second-thinking";

  return (
    <section className="lad-chat" aria-label="Чат с Генри Ганттом">
      <header className="lad-chat__header">
        <button className="lad-icon-button lad-mobile-only" type="button" onClick={onOpenMobileLeft}>
          <Menu aria-hidden />
          <span className="lad-sr">Открыть меню</span>
        </button>
        <div className="lad-agent-title">
          <div className="lad-agent-title__mark">
            <Bot aria-hidden />
          </div>
          <div>
            <h2>Генри Гантт</h2>
            <span>Агент аккаунта</span>
          </div>
        </div>
        <div className="lad-chat__header-actions">
          {reviewVisible ? (
            <button className="lad-chip-button lad-mobile-only" type="button" onClick={onOpenMobileReview}>
              Сверка
            </button>
          ) : null}
          <button className="lad-icon-button" type="button" onClick={onToggleAgentMenu}>
            <SlidersHorizontal aria-hidden />
            <span className="lad-sr">Сведения об агенте</span>
          </button>
        </div>
        {agentMenuOpen ? <AgentStatusMenu /> : null}
      </header>

      <div className="lad-chat__body">
        {messages.length === 0 ? (
          <div className="lad-chat__empty">
            <MessageSquare aria-hidden />
            <span>Запрос уже набран. Отправьте его Генри.</span>
          </div>
        ) : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isThinking ? <AgentActivitySteps visibleSteps={visibleSteps} /> : null}
      </div>

      <form
        className="lad-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <Input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Сообщение Генри Гантту..."
          aria-label="Сообщение Генри Гантту"
        />
        <button className="lad-icon-button lad-attach-button" type="button" aria-label="Прикрепить файл">
          <Paperclip aria-hidden />
        </button>
        <button className="lad-send-button" type="submit" disabled={!inputValue.trim()}>
          <Send aria-hidden />
          <span className="lad-sr">Отправить</span>
        </button>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: DemoMessage }) {
  return (
    <article
      className={cn(
        "lad-message",
        message.author === "user" && "lad-message--user",
        message.variant === "client-note" && "lad-message--client-note"
      )}
    >
      <div className="lad-message__avatar">{message.author === "henry" ? <Bot aria-hidden /> : "Вы"}</div>
      <div className="lad-message__content">
        <div className="lad-message__meta">
          <span>{message.author === "henry" ? "Генри Гантт" : "Вы"}</span>
          <time>{message.time}</time>
        </div>
        <p>{message.text}</p>
        {message.variant === "client-note" ? (
          <div className="lad-client-note">
            <span>Сообщение клиенту</span>
            <p>
              Согласование сдвинулось на три дня. Мы уже обновили план недели, закрепили
              ответственного и предлагаем провести встречу 16 июня.
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function AgentActivitySteps({ visibleSteps }: { visibleSteps: number }) {
  return (
    <div className="lad-steps" aria-label="Действия Генри">
      {ACTIVITY_STEPS.map((step, index) => (
        <div key={step} className={cn("lad-step", index < visibleSteps && "is-visible")}>
          <span className="lad-step__icon">{index + 1 < visibleSteps ? <Check aria-hidden /> : <Clock3 aria-hidden />}</span>
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

export function AgentStatusMenu() {
  return (
    <div className="lad-agent-menu">
      <div className="lad-agent-menu__head">
        <strong>Генри Гантт</strong>
        <span>Агент аккаунта</span>
      </div>
      <dl>
        <div>
          <dt>Память</dt>
          <dd>Контекст примерных проектов</dd>
          <dd>История решений в примере</dd>
        </div>
        <div>
          <dt>Доступ</dt>
          <dd>Проекты, работы, сроки, ресурсы</dd>
        </div>
        <div>
          <dt>Поведение</dt>
          <dd>Спрашивает перед применением</dd>
        </div>
      </dl>
      <button type="button">Настроить в аккаунте →</button>
    </div>
  );
}

type ChangeReviewPanelProps = {
  changes: DemoChange[];
  visible: boolean;
  opening: boolean;
  applied: boolean;
  activeChangeId: string;
  editingChangeId?: string | undefined;
  mobileOpen?: boolean | undefined;
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
  mobileOpen,
  onCloseMobile,
  onSelectChange,
  onFocusChange,
  onRejectChange,
  onEditChange,
  onUpdateChange,
  onApply,
  onReset
}: ChangeReviewPanelProps) {
  const selectedCount = changes.filter((change) => change.selected).length;

  if (!visible && !mobileOpen) {
    return null;
  }

  return (
    <aside
      className={cn(
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
          <X aria-hidden />
          <span className="lad-sr">Закрыть Сверку</span>
        </button>
      </header>
      <div className="lad-review__summary">
        <span className="is-active">{selectedCount} выбрано</span>
        <span>Готово к проверке</span>
        <button type="button">
          Выбрано
          <ChevronDown aria-hidden />
        </button>
      </div>
      <div className="lad-review__list">
        {changes.map((change) => (
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
          <ShieldCheck aria-hidden />
          <div>
            <strong>Выбранные изменения применены</strong>
            <span>4 изменения записаны в журнал проекта</span>
          </div>
        </div>
      ) : null}
      <div className="lad-review__actions">
        <Button type="button" size="sm" onClick={onApply} disabled={applied}>
          <Check aria-hidden />
          Применить выбранное
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onReset}>
          <RotateCcw aria-hidden />
          Сбросить
        </Button>
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
  onUpdate
}: ChangeHunkCardProps) {
  return (
    <article
      className={cn("lad-change", `lad-change--${statusClass(change.status)}`, active && "is-active")}
      onClick={onFocus}
    >
      <div className="lad-change__top">
        <span className="lad-change__number">{change.number}</span>
        <strong>{change.title}</strong>
        <button
          className={cn("lad-status", `lad-status--${statusClass(change.status)}`)}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          {change.status}
          <ChevronDown aria-hidden />
        </button>
      </div>
      <div className="lad-change__grid">
        <div>
          <span>Было</span>
          <p>{change.before}</p>
        </div>
        <div className="lad-change__arrow">→</div>
        <div>
          <span>Стало</span>
          {editing ? (
            <EditableAfterValue change={change} onUpdate={onUpdate} />
          ) : (
            <p className="lad-change__after">{change.after}</p>
          )}
        </div>
      </div>
      <div className="lad-change__actions">
        <button type="button" onClick={onEdit}>
          Изменить
        </button>
        <button type="button" onClick={onReject}>
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
              className={cn(option === change.after && "is-selected")}
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

  if (change.kind === "owner") {
    return (
      <select
        className="lad-change__select"
        value={change.after}
        onChange={(event) => onUpdate(event.target.value)}
        aria-label={`Новый владелец: ${change.title}`}
      >
        <option>Анна Морозова</option>
        <option>Камил Бачанек</option>
        <option>Мария Лебедева</option>
      </select>
    );
  }

  return (
    <Textarea
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
  if (status === "применено") return "applied";
  return "selected";
}

export function MobileDrawerBackdrop({ visible, onClick }: { visible?: boolean | undefined; onClick: () => void }) {
  return visible ? <button className="lad-mobile-backdrop" type="button" onClick={onClick} aria-label="Закрыть слой" /> : null;
}
