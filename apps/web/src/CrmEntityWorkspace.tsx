import { ArrowLeft } from "lucide-react";

export function CrmEntityWorkspace(props: {
  activity: React.ReactNode;
  actions?: React.ReactNode;
  backLabel: string;
  children: React.ReactNode;
  eyebrow: string;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  title: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <section className="crm-entity-page" aria-label={props.eyebrow}>
      <div className="crm-entity-workspace">
        <div className="crm-entity-main">
          <header className="crm-entity-header">
            <div>
              <nav className="deal-breadcrumb" aria-label="Навигация CRM-сущности">
                <button type="button" onClick={props.onBack}>
                  {props.backLabel}
                </button>
                <span>/</span>
                <span>{props.eyebrow}</span>
              </nav>
              <div className="crm-entity-title-row">
                <h1>{props.title}</h1>
                {props.status}
              </div>
              {props.meta ? <p>{props.meta}</p> : null}
            </div>
            <div className="crm-entity-actions">
              {props.actions}
              <button className="secondary-button" type="button" onClick={props.onBack}>
                <ArrowLeft aria-hidden="true" size={14} />
                {props.backLabel}
              </button>
            </div>
          </header>
          {props.children}
        </div>
        {props.activity}
      </div>
    </section>
  );
}

export function CrmEntitySection(props: {
  children: React.ReactNode;
  meta?: React.ReactNode;
  title: string;
}) {
  return (
    <section className="crm-entity-section">
      <header className="crm-entity-section-header">
        <h2>{props.title}</h2>
        {props.meta}
      </header>
      {props.children}
    </section>
  );
}

export function CrmEntityFactList(props: { children: React.ReactNode }) {
  return <dl className="crm-entity-fact-list">{props.children}</dl>;
}

export function CrmEntityFact(props: { children: React.ReactNode; label: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.children}</dd>
    </div>
  );
}

export function CrmEntityActivityPlaceholder(props: {
  children?: React.ReactNode;
  entityLabel: string;
  summary: string;
}) {
  return (
    <aside className="deal-activity-panel crm-entity-activity" aria-label={`Активность: ${props.entityLabel}`}>
      <header className="deal-activity-header">
        <div>
          <h2>Активность</h2>
          <p>{props.summary}</p>
        </div>
      </header>
      <div className="crm-activity-placeholder">
        {props.children ?? (
          <>
            <strong>Коммуникационная модель не подключена</strong>
            <p>
              История, задачи и файлы для этой сущности будут включены отдельным
              persisted-срезом. Сейчас здесь нет активных фейковых контролов.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
