import type { ReactNode } from "react";
import type { DemoStep } from "../../demo/machine";
import { STEP_META } from "../../demo/machine";
import { CAPSULES_BY_STEP, KIND_LABEL, type Capsule } from "../../demo/capsules";
import type { DemoFixture } from "../../demo/fixture";

interface Props {
  step: DemoStep;
  fixture: DemoFixture;
  onExplore: (message: string) => void;
}

export function DemoContextPanel({ step, fixture, onExplore }: Props) {
  const meta = STEP_META[step];
  const deal = fixture.deals[0]!;
  const ws = deal.workspace;

  if (step === "crm-deal" && ws) {
    return (
      <ContextShell eyebrow={`Шаг 2 · Сделка / ГК Север · ${deal.amount}`}>
        <ContextCard title="Карточка сделки" body={`Переписка и файлы у ${deal.id}. Контекст сохраняется при переходе в проект.`}>
          <ContextLink onClick={() => onExplore("Откроется карточка в CRM.")}>Открыть в CRM →</ContextLink>
        </ContextCard>
        <ContextCard title="Права и роли" body="Запуск ёмкости — для ролей с правом оценки портфеля.">
          <ContextLink muted onClick={() => onExplore("Раздел «Доступ» тенанта.")}>Настроить права</ContextLink>
        </ContextCard>
        <ContextChecklist
          title="Что дальше"
          items={[
            { label: "Проверить ёмкость", active: true },
            { label: "Оценить сроки", active: false },
            { label: "Согласовать план", active: false },
            { label: "Создать проект", active: false },
          ]}
        />
        <ContextPeople title="Кто участвует" people={ws.team} />
      </ContextShell>
    );
  }

  if (step === "crm-list") {
    return (
      <ContextShell eyebrow="Шаг 1 · CRM · воронка сделок">
        <ContextCard title="Портфель рядом" body="147 активных проектов — видно до принятия обязательств по новой сделке.">
          <ContextStat label="В работе" value="147" />
        </ContextCard>
        <ContextCard title="Фильтр сценария" body="Сделки «Готова к оценке» без проверки ёмкости — приоритет для PM.">
          <ContextLink onClick={() => onExplore("Фильтр сохраняется в представлении CRM.")}>3 активных фильтра</ContextLink>
        </ContextCard>
        <ContextChecklist
          title="Следующее действие"
          items={[{ label: "Открыть DEAL-204 · ГК Север", active: true }]}
        />
      </ContextShell>
    );
  }

  if (step === "intake") {
    return (
      <ContextShell eyebrow="Шаг 3 · Ёмкость · DEAL-204">
        <ContextCard title="Результат проверки" body="Ведущий инженер 112% на неделях 7–9. Без сдвига — риск для 4 проектов.">
          <ContextStat label="Порог" value="≤ 95%" />
          <ContextStat label="Сейчас" value="112%" warn />
        </ContextCard>
        <ContextCard title="Связь со сделкой" body="Проверка запущена из карточки ГК Север после согласования в обсуждении.">
          <ContextLink onClick={() => onExplore("Вернёт к карточке сделки.")}>DEAL-204 →</ContextLink>
        </ContextCard>
        <ContextChecklist
          title="Что дальше"
          items={[
            { label: "Просмотреть затронутые проекты", active: true },
            { label: "Открыть конфликтную задачу", active: false },
          ]}
        />
      </ContextShell>
    );
  }

  if (step === "project") {
    return (
      <ContextShell eyebrow="Шаг 4 · Портфель · контекст">
        <ContextCard title="Источник напряжения" body="Задача T-1041 связана с переносом слота ведущего инженера по DEAL-204.">
          <ContextLink onClick={() => onExplore("Откроется карточка задачи.")}>T-1041 →</ContextLink>
        </ContextCard>
        <ContextCard title="Сигналы" body="3 открытых сигнала по портфелю, один — по этой роли.">
          <ContextStat label="Критично" value="1" warn />
        </ContextCard>
        <ContextChecklist
          title="Что дальше"
          items={[{ label: "Открыть задачу с флагом сигнала", active: true }]}
        />
      </ContextShell>
    );
  }

  if (step === "task") {
    return (
      <ContextShell eyebrow="Шаг 5 · Задача · T-1041">
        <ContextCard title="Почему сейчас" body="Система связала перегруз роли с этой задачей и сделкой DEAL-204.">
          <ContextStat label="Загрузка" value="112%" warn />
        </ContextCard>
        <ContextCard title="Обсуждение" body="Комментарии задачи наследуют контекст проекта — отдельный чат не нужен.">
          <ContextLink muted onClick={() => onExplore("Тред задачи.")}>3 сообщения</ContextLink>
        </ContextCard>
        <ContextChecklist
          title="Что дальше"
          items={[{ label: "Открыть управленческий сигнал", active: true }]}
        />
      </ContextShell>
    );
  }

  if (step === "signal") {
    return (
      <ContextShell eyebrow="Шаг 6 · Сигнал · ресурсы">
        <ContextCard title="Рекомендация" body="Сдвинуть некритичный слот — минимальный сдвиг сроков при снижении перегруза до 94%.">
          <ContextStat label="Сценарий" value="Сбалансированный" />
        </ContextCard>
        <ContextCard title="RBAC" body="Доступны только действия, разрешённые ролью портфельного менеджера.">
          <ContextLink muted onClick={() => onExplore("Матрица прав.")}>3 из 3 сценариев</ContextLink>
        </ContextCard>
        <ContextChecklist
          title="Что дальше"
          items={[
            { label: "Выбрать сценарий", active: true },
            { label: "Подтвердить действие", active: false },
          ]}
        />
      </ContextShell>
    );
  }

  if (step === "action") {
    return (
      <ContextShell eyebrow="Шаг 7 · Действие · подтверждение">
        <ContextCard title="Команда приложения" body="Изменения плана и матрицы — через portfolio.scenario.apply, не прямое редактирование.">
          <ContextStat label="Аудит" value="#4128" />
        </ContextCard>
        <ContextCard title="Права" body="Нужны portfolio.scenario.apply и audit.write — у Анны К. в этом сценарии.">
          <ContextLink muted onClick={() => onExplore("Проверка прав перед применением.")}>Проверить права</ContextLink>
        </ContextCard>
        <ContextChecklist
          title="Что дальше"
          items={[
            { label: "Подтвердить сценарий", active: true },
            { label: "Просмотреть запись в аудите", active: false },
          ]}
        />
      </ContextShell>
    );
  }

  if (step === "audit") {
    return (
      <ContextShell eyebrow="Шаг 8 · Аудит · след решения">
        <ContextCard title="Неизменяемая запись" body="Фиксирует актора, действие, цель и причину — для ретроспективы и комплаенса.">
          <ContextStat label="Запись" value="#4128" />
        </ContextCard>
        <ContextCard title="Связь с контуром" body="DEAL-204 → проверка ёмкости → сценарий → 112% → 94%.">
          <ContextLink onClick={() => onExplore("Цепочка событий в ленте аудита.")}>Цепочка событий →</ContextLink>
        </ContextCard>
        <ContextCard title="Сценарий завершён" body="Можно начать демо сначала или вернуться к списку сделок.">
          <ContextLink muted onClick={() => onExplore("Сброс сценария — кнопка слева внизу.")}>Начать сначала</ContextLink>
        </ContextCard>
      </ContextShell>
    );
  }

  const capsules = CAPSULES_BY_STEP[step];
  return (
    <aside className="demo-context" aria-label="Подсказки к шагу">
      <header className="demo-context__head">
        <span className="demo-context__badge">{meta.badge}</span>
        <h3 className="demo-context__title">{meta.title}</h3>
      </header>
      <ul className="demo-context__capsules">
        {capsules.map((c) => (
          <li key={c.id}>
            <ContextCapsule capsule={c} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ContextShell({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <aside className="demo-context" aria-label="Контекст шага">
      <header className="demo-context__head">
        <p className="demo-context__eyebrow">{eyebrow}</p>
      </header>
      {children}
    </aside>
  );
}

function ContextCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="demo-context__card">
      <h4 className="demo-context__card-title">{title}</h4>
      <p className="demo-context__card-body">{body}</p>
      {children}
    </div>
  );
}

function ContextLink({
  children,
  onClick,
  muted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button type="button" className={`demo-context__link${muted ? " demo-context__link--muted" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function ContextStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`demo-context__stat${warn ? " demo-context__stat--warn" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ContextChecklist({
  title,
  items,
}: {
  title: string;
  items: ReadonlyArray<{ label: string; active: boolean }>;
}) {
  return (
    <div className="demo-context__card">
      <h4 className="demo-context__card-title">{title}</h4>
      <ul className="demo-context__checklist" role="list">
        {items.map((item) => (
          <li key={item.label} className={`demo-context__check${item.active ? " demo-context__check--active" : ""}`}>
            <span className="demo-context__radio" aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContextPeople({
  title,
  people,
}: {
  title: string;
  people: ReadonlyArray<{ initials: string; name: string; role: string; online?: boolean }>;
}) {
  return (
    <div className="demo-context__card">
      <h4 className="demo-context__card-title">{title}</h4>
      <ul className="demo-context__people" role="list">
        {people.map((person) => (
          <li key={person.initials} className="demo-context__person">
            <span className="demo-context__person-avatar">{person.initials}</span>
            <div>
              <span className="demo-context__person-name">{person.name}</span>
              <span className="demo-context__person-role">{person.role}</span>
            </div>
            {person.online ? <span className="demo-context__person-status">в сети</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContextCapsule({ capsule }: { capsule: Capsule }) {
  return (
    <article className={`demo-context__capsule demo-context__capsule--${capsule.kind}`}>
      <span className="demo-context__capsule-kind">{KIND_LABEL[capsule.kind]}</span>
      <h4 className="demo-context__capsule-title">{capsule.title}</h4>
      <p className="demo-context__capsule-body">{capsule.body}</p>
    </article>
  );
}
