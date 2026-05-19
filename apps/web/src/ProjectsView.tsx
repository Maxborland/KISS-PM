import { CalendarDays, ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";

import type { Project } from "./api";
import type { WorkspaceData } from "./workspaceData";
import { filterProjectsForTable } from "./workspaceTables";
import { formatDateOnly } from "./workspaceViewHelpers";
import type { SectionState } from "./workspaceShellState";
import {
  CrudToolbar,
  Panel,
  SectionFeedback,
  StatusPill,
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";

export function ProjectsView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
}) {
  const [tableSearch, setTableSearch] = useState("");
  const filteredProjects = useMemo(
    () => filterProjectsForTable(props.data.projects, tableSearch),
    [props.data.projects, tableSearch]
  );
  const totalPlannedHours = props.data.projects.reduce(
    (sum, project) => sum + project.plannedHours,
    0
  );
  const totalContractValue = props.data.projects.reduce(
    (sum, project) => sum + project.contractValue,
    0
  );

  return (
    <Panel
      title="Проекты"
      subtitle="Активные проекты, созданные из проверенной возможности. Черновик не отдельная сущность: проект входит в рабочую зону через статус."
    >
      <div className="surface-summary-grid">
        <SummaryCard label="Активные проекты" value={props.data.projects.length} />
        <SummaryCard label="Плановые часы" value={totalPlannedHours} tone="success" />
        <SummaryCard label="Контракты, руб." value={Math.round(totalContractValue)} tone="muted" />
      </div>
      <CrudToolbar
        searchLabel="Поиск проектов"
        searchPlaceholder="Клиент, проект, источник..."
        searchValue={tableSearch}
        resultCount={filteredProjects.length}
        totalCount={props.data.projects.length}
        onSearchChange={setTableSearch}
      >
        <span className="toolbar-chip">
          <CalendarDays aria-hidden="true" size={14} />
          Плановые даты
        </span>
        <span className="toolbar-chip">
          <ClipboardList aria-hidden="true" size={14} />
          Потребность должностей
        </span>
      </CrudToolbar>
      <SectionFeedback state={props.sectionState} emptyLabel="Проекты недоступны." />
      {props.sectionState.canRead && !props.sectionState.error ? (
        <div className="table-wrap">
          <table className="data-table" aria-label="Проекты">
            <thead>
              <tr>
                <th>Проект</th>
                <th>Период</th>
                <th>План</th>
                <th>Потребность</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <TableEmpty
                  colSpan={5}
                  label={
                    props.data.projects.length === 0
                      ? "Активных проектов пока нет."
                      : "По фильтру ничего не найдено."
                  }
                />
              ) : (
                filteredProjects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <span className="entity-name-cell">
                        <span className="row-avatar">P</span>
                        <span>
                          <strong>{project.title}</strong>
                          <small>
                            {project.clientName} · из {project.sourceOpportunityId}
                          </small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <strong>{formatDateOnly(project.plannedStart)}</strong>
                      <small className="muted">
                        {" -> "}
                        {formatDateOnly(project.plannedFinish)}
                      </small>
                    </td>
                    <td>
                      <strong>{project.plannedHours} ч</strong>
                      <small className="muted">{formatMoney(project.contractValue)}</small>
                    </td>
                    <td>{formatProjectDemand(project, props.data)}</td>
                    <td>
                      <StatusPill
                        label={project.status === "active" ? "Активен" : project.status}
                        tone={project.status === "active" ? "success" : "muted"}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}

function formatProjectDemand(project: Project, data: WorkspaceData) {
  return (
    <span className="chip-list">
      {project.demand.map((line) => (
        <span className="permission-chip" key={line.positionId}>
          {data.positions.find((position) => position.id === line.positionId)?.name ??
            line.positionId}
          : {line.requiredHours} ч
        </span>
      ))}
    </span>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "RUB"
  }).format(value);
}
