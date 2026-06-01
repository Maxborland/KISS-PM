import type { ReactNode } from "react";

import { AgentCockpitBlock } from "@/views/blocks/agent-cockpit-block";
import { AdminBlock } from "@/views/blocks/admin-block";
import { AvatarMenuBlock } from "@/views/blocks/avatar-menu-block";
import { DashboardBento } from "@/views/blocks/dashboard-bento";
import { DealsBlock } from "@/views/blocks/deals-block";
import { EntitiesBlock } from "@/views/blocks/entities-block";
import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
import { GanttSliceBlock } from "@/views/blocks/gantt-slice-block";
import { MyWorkBlock } from "@/views/blocks/my-work-block";
import { ProjectAuditBlock } from "@/views/blocks/project-audit-block";
import { ProjectBaselineBlock } from "@/views/blocks/project-baseline-block";
import { ProjectCalendarsBlock } from "@/views/blocks/project-calendars-block";
import { ProjectKpiBlock } from "@/views/blocks/project-kpi-block";
import { ProjectResourcesBlock } from "@/views/blocks/project-resources-block";
import { ProjectScenariosBlock } from "@/views/blocks/project-scenarios-block";
import { ProjectsListBlock } from "@/views/blocks/projects-list-block";
import { ScreenPlaceholderBlock } from "@/views/blocks/screen-placeholder-block";
import { SettingsBlock } from "@/views/blocks/settings-block";
import { SpaceDisciplineBlock } from "@/views/blocks/space-discipline-block";
import { StateScreenBlock } from "@/views/blocks/state-screen-block";
import { TaskCreateModalBlock } from "@/views/blocks/task-create-modal-block";
import { LoginScreenView } from "@/views/screens/login-screen-view";
import { MOCK_PROJECT_CRM, mockTaskProjectRef, type ScreenId } from "@/views/catalog";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";

const BLOCK_BY_ID: Record<ScreenId, () => ReactNode> = {
  "00-space-discipline": () => <SpaceDisciplineBlock />,
  "01-dashboard": () => <DashboardBento />,
  "02-my-work": () => <MyWorkBlock />,
  "03-task-card": () => (
    <EntityDetailBlock
      title="Согласовать ТЗ"
      subtitle={mockTaskProjectRef("MDS-39")}
      stage={{ label: "В работе", tone: "info" }}
      variant="task"
    />
  ),
  "04-create-task-modal": () => <TaskCreateModalBlock />,
  "05-deals": () => <DealsBlock />,
  "06-deal-card": () => (
    <EntityDetailBlock
      title="Сделка «Ромашка»"
      subtitle="DEAL-101 · ООО «Ромашка»"
      stage={{ label: "Квалификация", tone: "violet" }}
    />
  ),
  "07-projects-list": () => <ProjectsListBlock />,
  "07b-project-detail": () => (
    <EntityDetailBlock
      title={MOCK_PROJECT_CRM}
      subtitle="PRJ-2026-014 · ООО «Ромашка»"
      stage={{ label: "В работе", tone: "info" }}
    />
  ),
  "08-entities-clients": () => <EntitiesBlock kind="clients" />,
  "08-entities-contacts": () => <EntitiesBlock kind="contacts" />,
  "08-entities-products": () => <EntitiesBlock kind="products" />,
  "09-admin": () => <AdminBlock />,
  "10-settings": () => <SettingsBlock />,
  "11-avatar-menu": () => <AvatarMenuBlock />,
  "12-project-gantt": () => (
    <GanttSliceBlock title={`Гант · ${MOCK_PROJECT_CRM}`} lead="План-факт и WBS проекта." />
  ),
  "13-project-resources": () => <ProjectResourcesBlock />,
  "14-project-baseline": () => <ProjectBaselineBlock />,
  "15-project-scenarios": () => <ProjectScenariosBlock />,
  "16-project-kpi": () => <ProjectKpiBlock />,
  "17-project-audit": () => <ProjectAuditBlock />,
  "18-project-calendars": () => <ProjectCalendarsBlock />,
  "19-login": () => <LoginScreenView variant="default" />,
  "20-agent-cockpit": () => (
    <AgentCockpitBlock thread={{ context: {}, messages: [], proposals: [] }} variant="surface" />
  ),
  "state-empty": () => <StateScreenBlock kind="empty" />,
  "state-error": () => <StateScreenBlock kind="error" />,
  "state-forbidden": () => <StateScreenBlock kind="forbidden" />,
  "state-loading": () => <StateScreenBlock kind="loading" />
};

export function ScreenView({
  id,
  permissions
}: {
  id: ScreenId;
  permissions?: readonly string[] | undefined;
}) {
  const meta = getScreenRoute(id);
  const Block = BLOCK_BY_ID[id] ?? (() => <ScreenPlaceholderBlock title={meta.pageTitle} lead={meta.lead} />);

  if (meta.variant === "login") {
    return <LoginScreenView />;
  }

  if (meta.variant === "bare") {
    return (
      <div className="app-canvas">
        <div className="app-canvas__panel app-canvas__panel--bare">{Block()}</div>
      </div>
    );
  }

  return (
    <WorkspaceChrome meta={meta} permissions={permissions}>
      {Block()}
    </WorkspaceChrome>
  );
}
