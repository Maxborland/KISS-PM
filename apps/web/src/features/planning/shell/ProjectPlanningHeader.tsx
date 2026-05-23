"use client";

import Link from "next/link";

import {
  getProjectPlanningPath,
  type PlanningProjectTab
} from "../../../workspacePathIds";

const tabs: Array<{ id: PlanningProjectTab; label: string }> = [
  { id: "schedule", label: "График" },
  { id: "resources", label: "Ресурсы" },
  { id: "assignments", label: "Назначения" },
  { id: "calendars", label: "Календари" },
  { id: "scenarios", label: "Сценарии" },
  { id: "baseline", label: "Baseline" },
  { id: "audit", label: "Аудит" },
  { id: "settings", label: "Настройки" }
];

export function ProjectPlanningHeader(props: {
  projectId: string;
  projectTitle: string;
  planVersion: number | null;
  conflict: boolean;
  activeTab: PlanningProjectTab;
  onBack: () => void;
}) {
  return (
    <header className="planning-project-header">
      <button className="secondary-button" type="button" onClick={props.onBack}>
        ← Проекты
      </button>
      <div>
        <h1>{props.projectTitle}</h1>
        <p className="planning-project-header__meta">
          план v{props.planVersion ?? "—"}
          {props.conflict ? (
            <span className="planning-conflict-badge" data-testid="planning-conflict-banner">
              Конфликт версии
            </span>
          ) : null}
        </p>
      </div>
      <nav className="planning-tabs" aria-label="Вкладки проекта">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            className={tab.id === props.activeTab ? "planning-tab is-active" : "planning-tab"}
            href={getProjectPlanningPath(props.projectId, tab.id)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
