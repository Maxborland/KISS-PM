import { AlphaForm } from "./AlphaForm";
import { agentMessages, faqItems, problemCards, surfaceCards, useCases, workflowSteps } from "./alpha-content";
import { DiffReviewMock } from "./DiffReviewMock";

export function AlphaHeader() {
  return (
    <header className="alpha-header">
      <a className="alpha-brand" href="/" aria-label="KISS PM">
        <span>K</span>
        <b>KISS PM</b>
      </a>
      <nav aria-label="Разделы лендинга">
        <a href="#workflow">Workflow</a>
        <a href="#diff-review">Project diff</a>
        <a href="#alpha">Закрытая альфа</a>
      </nav>
      <a className="alpha-btn alpha-btn--dark" href="#alpha">
        Запросить доступ
      </a>
    </header>
  );
}

export function AlphaHero() {
  return (
    <section className="alpha-hero">
      <div className="alpha-hero__copy">
        <span className="alpha-kicker">Закрытая альфа · agent-first project management</span>
        <h1>Управляйте проектами через агента. Применяйте только одобренное.</h1>
        <p>
          KISS PM превращает цель в proposed project diff: проектный агент готовит изменения, человек
          ревьюит hunks и применяет только выбранное с audit trail.
        </p>
        <div className="alpha-hero__actions">
          <a className="alpha-btn alpha-btn--dark" href="#alpha">
            Запросить доступ
          </a>
          <a className="alpha-btn alpha-btn--light" href="#diff-review">
            Посмотреть diff
          </a>
        </div>
      </div>
      <div className="alpha-hero__proof" aria-label="Разговор с проектным агентом и proposed diff">
        <div className="alpha-agent-card">
          <div className="alpha-agent-card__top">
            <span>project agent</span>
            <b>AGT-248</b>
          </div>
          <div className="alpha-chat">
            {agentMessages.map((message) => (
              <article className="alpha-message" key={message.author}>
                <span>{message.author}</span>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
          <div className="alpha-mini-audit">
            <span>audit preview</span>
            <b>Цель сохранена · diff готов · применение ждет ревью</b>
          </div>
        </div>
        <DiffReviewMock compact />
      </div>
    </section>
  );
}

export function ProblemSection() {
  return (
    <section className="alpha-section alpha-section--tight" id="problem">
      <div className="alpha-section__head">
        <span className="alpha-kicker">Проблема</span>
        <h2>Управленческое решение редко живет в одном месте.</h2>
        <p>
          Когда портфель растет, ручная правка плана превращается в цепочку маленьких действий.
          KISS PM собирает эту цепочку в проверяемый diff.
        </p>
      </div>
      <div className="alpha-card-grid">
        {problemCards.map((card) => (
          <article className="alpha-info-card" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function WorkflowSection() {
  return (
    <section className="alpha-section" id="workflow">
      <div className="alpha-section__head">
        <span className="alpha-kicker">Новый workflow</span>
        <h2>Цель проходит полный контур до аудита.</h2>
      </div>
      <div className="alpha-workflow">
        {workflowSteps.map((step, index) => (
          <article className="alpha-step" key={step.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <b>{step.label}</b>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AgentRunDemoSection() {
  return (
    <section className="alpha-section alpha-demo" id="agent-run">
      <div className="alpha-section__head">
        <span className="alpha-kicker">Запуск агента</span>
        <h2>Сначала цель и контекст, затем предлагаемые изменения.</h2>
      </div>
      <div className="alpha-demo__grid">
        <div className="alpha-command">
          <span>команда</span>
          <p>Проверь проект и подготовь план на следующую неделю после задержки дизайна.</p>
          <button className="alpha-btn alpha-btn--dark" type="button">
            Demo: запустить агента
          </button>
        </div>
        <div className="alpha-run-log">
          <span>reasoning summary</span>
          <ol>
            <li>Проверены задачи, зависимости и ресурсная нагрузка.</li>
            <li>Найден риск перегруза frontend и сдвиг клиентского демо.</li>
            <li>Подготовлены hunks для ревью и будущей записи в audit trail.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

export function DiffReviewSection() {
  return (
    <section className="alpha-section alpha-section--proof">
      <div className="alpha-section__head">
        <span className="alpha-kicker">Ревью proposed diff</span>
        <h2>Главный артефакт страницы — проверяемое изменение проекта.</h2>
        <p>
          Hunk показывает объект, причину, before/after и статус ревью. На mobile hunks становятся
          вертикальными карточками.
        </p>
      </div>
      <DiffReviewMock />
    </section>
  );
}

export function ManualControlSection() {
  return (
    <section className="alpha-section alpha-section--split" id="control">
      <div>
        <span className="alpha-kicker">Ручной контроль</span>
        <h2>Человек сохраняет право на каждое существенное изменение.</h2>
        <p>
          Принять все, применить выбранное, отредактировать или отклонить hunk можно до записи в план.
          Demo-кнопки на лендинге меняют только локальное состояние mock.
        </p>
      </div>
      <div className="alpha-control-panel">
        <button className="alpha-btn alpha-btn--dark" type="button">Применить выбранное</button>
        <button className="alpha-btn alpha-btn--light" type="button">Редактировать</button>
        <button className="alpha-btn alpha-btn--ghost" type="button">Отклонить</button>
        <p>Права, stale data и риск внешнего deadline показываются до применения.</p>
      </div>
    </section>
  );
}

export function AuditTrustSection() {
  return (
    <section className="alpha-section" id="audit">
      <div className="alpha-section__head">
        <span className="alpha-kicker">Аудит и доверие</span>
        <h2>После применения остается понятная история решения.</h2>
      </div>
      <div className="alpha-audit-timeline">
        {["Цель создана", "Агент подготовил diff", "Hunks выбраны", "Изменения применены", "Audit trail обновлен"].map(
          (item) => (
            <article key={item}>
              <span />
              <b>{item}</b>
              <small>Зафиксированы автор, время, объект и причина.</small>
            </article>
          ),
        )}
      </div>
    </section>
  );
}

export function ContextSurfacesSection() {
  return (
    <section className="alpha-section" id="surfaces">
      <div className="alpha-section__head">
        <span className="alpha-kicker">Контекстные поверхности</span>
        <h2>Поверхности помогают ревьюить diff в контексте проекта.</h2>
      </div>
      <div className="alpha-card-grid alpha-card-grid--four">
        {surfaceCards.map((card) => (
          <article className="alpha-info-card alpha-info-card--surface" key={card.title}>
            <span>{card.title.slice(0, 2)}</span>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section className="alpha-section" id="use-cases">
      <div className="alpha-section__head">
        <span className="alpha-kicker">Сценарии</span>
        <h2>Альфа фокусируется на ситуациях, где нужна управляемая правка проекта.</h2>
      </div>
      <div className="alpha-use-cases">
        {useCases.map((item) => (
          <article key={item}>
            <span />
            <p>{item}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DifferentiationSection() {
  return (
    <section className="alpha-section alpha-section--split">
      <div>
        <span className="alpha-kicker">Отстройка</span>
        <h2>Фокус KISS PM — управляемое изменение, которое можно проверить.</h2>
      </div>
      <div className="alpha-copy-panel">
        <p>
          Главный proof на странице — связка agent conversation, proposed project diff, локальное
          ревью, выбранное применение и audit trail.
        </p>
        <p>
          Такой лендинг показывает будущий рабочий продукт: какие данные видит агент, какие hunks
          предлагает и как пользователь сохраняет контроль над планом.
        </p>
      </div>
    </section>
  );
}

export function AlphaSignupSection() {
  return (
    <section className="alpha-section alpha-signup" id="alpha">
      <div className="alpha-section__head">
        <span className="alpha-kicker">Закрытая альфа</span>
        <h2>Покажем KISS PM командам, где проектные изменения требуют ревью и следа.</h2>
        <p>Форма пока работает как честное локальное demo-состояние без backend submission.</p>
      </div>
      <AlphaForm />
    </section>
  );
}

export function AlphaFaqSection() {
  return (
    <section className="alpha-section" id="faq">
      <div className="alpha-section__head">
        <span className="alpha-kicker">FAQ</span>
        <h2>Коротко о закрытой альфе.</h2>
      </div>
      <div className="alpha-faq">
        {faqItems.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function AlphaFooter() {
  return (
    <footer className="alpha-footer">
      <a className="alpha-brand" href="/" aria-label="KISS PM">
        <span>K</span>
        <b>KISS PM</b>
      </a>
      <p>Агентная система управления проектами с proposed project diff, ревью и audit trail.</p>
      <a href="#alpha">Запросить доступ</a>
    </footer>
  );
}

export default function AlphaLandingPage() {
  return (
    <div className="alpha-page">
      <AlphaHeader />
      <AlphaHero />
      <ProblemSection />
      <WorkflowSection />
      <AgentRunDemoSection />
      <DiffReviewSection />
      <ManualControlSection />
      <AuditTrustSection />
      <ContextSurfacesSection />
      <UseCasesSection />
      <DifferentiationSection />
      <AlphaSignupSection />
      <AlphaFaqSection />
      <AlphaFooter />
    </div>
  );
}
