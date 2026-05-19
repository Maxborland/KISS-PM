import { ProfileView, ThemeView } from "./AccountViews";
import { AuditView } from "./AuditView";
import { ClientsView, ContactsView } from "./CrmEntityViews";
import { DashboardView } from "./DashboardView";
import { OpportunityDetailView } from "./OpportunityDetailView";
import { OpportunitiesView } from "./OpportunitiesView";
import { PositionsView } from "./PositionsView";
import { ProjectDetailView } from "./ProjectDetailView";
import { MyWorkView } from "./MyWorkView";
import { ProjectsView } from "./ProjectsView";
import { RolesView } from "./RolesView";
import { DealStagesView, ProjectTypesView } from "./SettingsReferenceViews";
import { UsersView } from "./UsersView";
import { WorkspaceSettingsView } from "./WorkspaceSettingsView";
import { type WorkspaceRouteId } from "./routes";
import { type WorkspaceData } from "./workspaceData";
import { type SectionState } from "./workspaceShellState";

export function WorkspaceRouteRenderer(props: {
  activeRouteId: WorkspaceRouteId;
  activeOpportunityId: string | null;
  activeProjectId: string | null;
  data: WorkspaceData;
  openCreateRequested: boolean;
  onChanged: (message: string) => void;
  onBackToOpportunities: () => void;
  onOpenOpportunity: (opportunityId: string) => void;
  onBackToProjects: () => void;
  onOpenProject: (projectId: string) => void;
  onQuickCreateConsumed: () => void;
  sectionStates: {
    users: SectionState;
    positions: SectionState;
    accessRoles: SectionState;
    auditEvents: SectionState;
    clients: SectionState;
    contacts: SectionState;
    projectTypes: SectionState;
    dealStages: SectionState;
    opportunities: SectionState;
    projects: SectionState;
    myWork: SectionState;
    workspaceConfig: SectionState;
  };
}) {
  if (props.activeRouteId === "dashboard") {
    return (
      <DashboardView
        data={props.data}
        sectionStates={props.sectionStates}
      />
    );
  }

  if (props.activeRouteId === "users") {
    return (
      <UsersView
        data={props.data}
        openCreateRequested={props.openCreateRequested}
        onQuickCreateConsumed={props.onQuickCreateConsumed}
        sectionState={props.sectionStates.users}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "opportunities") {
    if (props.activeOpportunityId) {
      return (
        <OpportunityDetailView
          data={props.data}
          opportunityId={props.activeOpportunityId}
          onBack={props.onBackToOpportunities}
          onChanged={props.onChanged}
          sectionState={props.sectionStates.opportunities}
        />
      );
    }

    return (
      <OpportunitiesView
        data={props.data}
        openCreateRequested={props.openCreateRequested}
        onOpenOpportunity={props.onOpenOpportunity}
        onQuickCreateConsumed={props.onQuickCreateConsumed}
        sectionState={props.sectionStates.opportunities}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "my-work") {
    return (
      <MyWorkView
        data={props.data}
        sectionState={props.sectionStates.myWork}
        onOpenProject={props.onOpenProject}
      />
    );
  }

  if (props.activeRouteId === "clients") {
    return (
      <ClientsView
        data={props.data}
        sectionState={props.sectionStates.clients}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "contacts") {
    return (
      <ContactsView
        data={props.data}
        sectionState={props.sectionStates.contacts}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "projects") {
    if (props.activeProjectId) {
      return (
        <ProjectDetailView
          data={props.data}
          projectId={props.activeProjectId}
          onBack={props.onBackToProjects}
          onChanged={props.onChanged}
          sectionState={props.sectionStates.projects}
        />
      );
    }

    return (
      <ProjectsView
        data={props.data}
        onOpenProject={props.onOpenProject}
        sectionState={props.sectionStates.projects}
      />
    );
  }

  if (props.activeRouteId === "access-roles") {
    return (
      <RolesView
        data={props.data}
        sectionState={props.sectionStates.accessRoles}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "positions") {
    return (
      <PositionsView
        data={props.data}
        sectionState={props.sectionStates.positions}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "audit") {
    return (
      <AuditView
        data={props.data}
        sectionState={props.sectionStates.auditEvents}
      />
    );
  }

  if (props.activeRouteId === "settings") {
    return (
      <WorkspaceSettingsView
        data={props.data}
        sectionState={props.sectionStates.workspaceConfig}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "project-types") {
    return (
      <ProjectTypesView
        data={props.data}
        sectionState={props.sectionStates.projectTypes}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "deal-stages") {
    return (
      <DealStagesView
        data={props.data}
        sectionState={props.sectionStates.dealStages}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "profile") {
    return (
      <ProfileView
        data={props.data}
        onChanged={props.onChanged}
      />
    );
  }

  if (props.activeRouteId === "theme") {
    return (
      <ThemeView
        user={props.data.me}
        onChanged={props.onChanged}
      />
    );
  }

  return null;
}
