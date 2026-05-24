import type { ValidationIssue } from "@kiss-pm/domain";

import "./planningWorkspace.css";

export function PlanningValidationPanel(props: {
  issues: readonly ValidationIssue[];
}) {
  if (props.issues.length === 0) {
    return (
      <section className="planning-side-panel">
        <h3>Проверки планирования</h3>
        <p className="muted">Blocking validation issues нет.</p>
      </section>
    );
  }

  return (
    <section className="planning-side-panel">
      <h3>Проверки планирования</h3>
      <ul className="planning-issue-list">
        {props.issues.map((issue, index) => (
          <li className={`planning-issue ${issue.severity}`} key={`${issue.code}:${index}`}>
            <strong>{issueLabel(issue.severity)}</strong>
            <span>{issue.message}</span>
            {issue.entity ? <small>{issue.entity.type}: {issue.entity.id}</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function issueLabel(severity: ValidationIssue["severity"]): string {
  if (severity === "error") return "Блокирует";
  if (severity === "warning") return "Риск";
  return "Инфо";
}
